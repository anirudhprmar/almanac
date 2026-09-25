"use client";

import type { GraphData } from "@almanac/core/graph";
import type { Route } from "next";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ForceGraphMethods } from "react-force-graph-2d";
import { wikiHref } from "@/lib/wiki-href";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
	ssr: false,
});

type CanvasNode = {
	id: string;
	title: string;
	description?: string;
	degree: number;
	isCurrent?: boolean;
	x?: number;
	y?: number;
};

type HoverState = {
	node: CanvasNode;
	x: number;
	y: number;
};

type GraphCanvasProps = {
	data: GraphData;
	/** Highlighted node (local graph center). Defaults to none. */
	currentSlug?: string;
	/** Where a node click navigates. Defaults to /wiki/[slug]. */
	hrefForNode?: (slug: string) => string;
	/** Override navigation (e.g. open in a panel instead). */
	onSelect?: (slug: string) => void;
	height?: number;
};

const LINK_COLOR = "rgba(148, 163, 184, 0.45)";

export default function GraphCanvas({
	data,
	currentSlug,
	hrefForNode = wikiHref,
	onSelect,
	height = 520,
}: GraphCanvasProps) {
	const router = useRouter();
	const wrapRef = useRef<HTMLDivElement>(null);
	const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
	const fittedRef = useRef(false);
	const mouseRef = useRef({ x: 0, y: 0 });
	const [width, setWidth] = useState(0);
	const [hover, setHover] = useState<HoverState | null>(null);
	const [dark, setDark] = useState(false);

	useEffect(() => {
		const el = wrapRef.current;
		if (!el) return;
		const updateDark = () =>
			setDark(
				el.ownerDocument.documentElement.classList.contains("dark") ||
					window.matchMedia("(prefers-color-scheme: dark)").matches,
			);
		updateDark();
		const ro = new ResizeObserver(() => setWidth(el.clientWidth));
		ro.observe(el);
		setWidth(el.clientWidth);
		// Tracked via listener (not JSX props): feeds the hover tooltip position only.
		const onMove = (e: MouseEvent) => {
			const rect = el.getBoundingClientRect();
			mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
			setHover((h) =>
				h ? { ...h, x: mouseRef.current.x, y: mouseRef.current.y } : h,
			);
		};
		const onLeave = () => setHover(null);
		el.addEventListener("mousemove", onMove);
		el.addEventListener("mouseleave", onLeave);
		return () => {
			ro.disconnect();
			el.removeEventListener("mousemove", onMove);
			el.removeEventListener("mouseleave", onLeave);
		};
	}, []);

	const graphData = useMemo(
		() => ({
			nodes: data.nodes.map((n) => ({ ...n })) as CanvasNode[],
			links: data.links.map((l) => ({ ...l })),
		}),
		[data],
	);

	const nodeColor = useCallback(
		(node: CanvasNode) => {
			if (node.id === currentSlug || node.isCurrent) return "#6366f1";
			if (node.degree >= 4) return "#38bdf8";
			return dark ? "#94a3b8" : "#64748b";
		},
		[currentSlug, dark],
	);

	const paintNode = useCallback(
		(node: CanvasNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
			const x = node.x ?? 0;
			const y = node.y ?? 0;
			const isCurrent = node.id === currentSlug || node.isCurrent;
			const r = (isCurrent ? 6 : 3.5) + Math.sqrt(node.degree) * 1.2;

			ctx.beginPath();
			ctx.arc(x, y, r, 0, Math.PI * 2);
			ctx.fillStyle = nodeColor(node);
			ctx.fill();

			if (isCurrent) {
				ctx.beginPath();
				ctx.arc(x, y, r + 3, 0, Math.PI * 2);
				ctx.strokeStyle = "#6366f1";
				ctx.lineWidth = 1.5 / globalScale;
				ctx.stroke();
			}

			// Labels for the current node, hubs, and the hovered node
			if (isCurrent || node.degree >= 3 || hover?.node.id === node.id) {
				const fontSize = Math.max(11 / globalScale, 3);
				ctx.font = `${isCurrent ? "600 " : ""}${fontSize}px sans-serif`;
				ctx.textAlign = "center";
				ctx.textBaseline = "top";
				ctx.fillStyle = dark ? "#e2e8f0" : "#334155";
				ctx.fillText(node.title, x, y + r + 2 / globalScale);
			}
		},
		[currentSlug, dark, hover, nodeColor],
	);

	const handleHover = useCallback((node: CanvasNode | null) => {
		if (!node) {
			setHover(null);
			return;
		}
		setHover({ node, x: mouseRef.current.x, y: mouseRef.current.y });
	}, []);

	const handleClick = useCallback(
		(node: CanvasNode) => {
			if (onSelect) {
				onSelect(node.id);
			} else {
				router.push(hrefForNode(node.id) as Route);
			}
		},
		[hrefForNode, onSelect, router],
	);

	return (
		<div
			ref={wrapRef}
			className="relative w-full overflow-hidden rounded-lg border"
			style={{ height }}
		>
			{width > 0 && (
				<ForceGraph2D
					ref={fgRef}
					width={width}
					height={height}
					graphData={graphData}
					nodeLabel={(n) => (n as CanvasNode).title}
					nodeCanvasObject={paintNode as never}
					nodePointerAreaPaint={(n, color, ctx) => {
						const node = n as unknown as CanvasNode;
						const r = 6 + Math.sqrt(node.degree) * 1.2 + 2;
						ctx.fillStyle = color;
						ctx.beginPath();
						ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2);
						ctx.fill();
					}}
					onNodeHover={handleHover as never}
					onNodeClick={handleClick as never}
					onEngineStop={() => {
						if (!fittedRef.current) {
							fittedRef.current = true;
							fgRef.current?.zoomToFit(400);
						}
					}}
					linkColor={() => LINK_COLOR}
					linkWidth={1}
					cooldownTicks={120}
					d3VelocityDecay={0.35}
				/>
			)}

			{hover && (
				<div
					className="pointer-events-none absolute z-10 w-56 rounded-md border bg-background p-3 shadow-lg"
					style={{
						left: Math.min(hover.x + 14, (width || 300) - 232),
						top: Math.max(hover.y - 10, 8),
					}}
				>
					<p className="truncate font-medium text-sm">{hover.node.title}</p>
					{hover.node.description && (
						<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
							{hover.node.description}
						</p>
					)}
					<p className="mt-1 text-muted-foreground text-xs">
						{hover.node.degree} connection{hover.node.degree === 1 ? "" : "s"} ·
						Click to open
					</p>
				</div>
			)}
		</div>
	);
}
