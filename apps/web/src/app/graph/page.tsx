import GlobalGraph from "@/components/graph/GlobalGraph";

export const metadata = {
	title: "Graph · almanac",
	description: "Explore the wiki as a graph",
};

export default function GraphPage() {
	return (
		<div className="container mx-auto max-w-5xl px-4 py-6">
			<div className="mb-4">
				<h1 className="font-semibold text-2xl">Graph</h1>
				<p className="text-muted-foreground text-sm">
					Every note, connected by wikilinks. Click a node to open it, hover to
					preview.
				</p>
			</div>
			<GlobalGraph height={600} />
		</div>
	);
}
