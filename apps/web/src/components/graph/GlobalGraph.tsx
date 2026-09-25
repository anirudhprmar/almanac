"use client";

import type { GraphData } from "@almanac/core/graph";
import { useEffect, useState } from "react";
import { ENV } from "@/env";
import GraphCanvas from "./GraphCanvas";

type GlobalGraphProps = {
	hrefForNode?: (slug: string) => string;
	onSelect?: (slug: string) => void;
	height?: number;
};

const EMPTY: GraphData = { nodes: [], links: [] };

export default function GlobalGraph({
	hrefForNode,
	onSelect,
	height,
}: GlobalGraphProps) {
	const [data, setData] = useState<GraphData | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch(`${ENV.NEXT_PUBLIC_SERVER_URL}/api/graph`)
			.then((res) => {
				if (!res.ok) throw new Error(`Graph API returned ${res.status}`);
				return res.json() as Promise<GraphData>;
			})
			.then((json) => {
				if (!cancelled) setData(json);
			})
			.catch((err: unknown) => {
				if (!cancelled)
					setError(err instanceof Error ? err.message : "Failed to load graph");
			});
		return () => {
			cancelled = true;
		};
	}, []);

	if (error) {
		return (
			<p className="rounded-lg border p-6 text-muted-foreground text-sm">
				Could not load graph: {error}
			</p>
		);
	}
	if (!data) {
		return (
			<p className="rounded-lg border p-6 text-muted-foreground text-sm">
				Loading graph…
			</p>
		);
	}
	if (data.nodes.length === 0) {
		return (
			<p className="rounded-lg border p-6 text-muted-foreground text-sm">
				No articles yet. Add markdown notes with a <code>title</code> in
				frontmatter to your content directory and link them with{" "}
				<code>[[wikilinks]]</code>.
			</p>
		);
	}
	return (
		<GraphCanvas
			data={data ?? EMPTY}
			hrefForNode={hrefForNode}
			onSelect={onSelect}
			height={height}
		/>
	);
}
