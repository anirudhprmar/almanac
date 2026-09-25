"use client";

import type { GraphData } from "@almanac/core/graph";
import { useEffect, useState } from "react";
import { ENV } from "@/env";
import GraphCanvas from "./GraphCanvas";

type LocalGraphProps = {
	slug: string;
	depth?: 1 | 2;
	hrefForNode?: (slug: string) => string;
	onSelect?: (slug: string) => void;
	height?: number;
};

export default function LocalGraph({
	slug,
	depth = 1,
	hrefForNode,
	onSelect,
	height = 360,
}: LocalGraphProps) {
	const [data, setData] = useState<GraphData | null>(null);
	const [missing, setMissing] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setData(null);
		setMissing(false);
		fetch(
			`${ENV.NEXT_PUBLIC_SERVER_URL}/api/graph/${encodeURIComponent(slug)}?depth=${depth}`,
		)
			.then((res) => {
				if (res.status === 404) {
					if (!cancelled) setMissing(true);
					return null;
				}
				if (!res.ok) throw new Error(`Graph API returned ${res.status}`);
				return res.json() as Promise<GraphData>;
			})
			.then((json) => {
				if (!cancelled && json) setData(json);
			})
			.catch(() => {
				if (!cancelled) setMissing(true);
			});
		return () => {
			cancelled = true;
		};
	}, [slug, depth]);

	if (missing) return null;
	if (!data) {
		return (
			<p className="rounded-lg border p-6 text-muted-foreground text-sm">
				Loading local graph…
			</p>
		);
	}
	if (data.nodes.length <= 1) {
		return (
			<p className="rounded-lg border p-6 text-muted-foreground text-sm">
				No linked notes yet. Link this note with <code>[[wikilinks]]</code> to
				grow the graph.
			</p>
		);
	}
	return (
		<GraphCanvas
			data={data}
			currentSlug={slug}
			hrefForNode={hrefForNode}
			onSelect={onSelect}
			height={height}
		/>
	);
}
