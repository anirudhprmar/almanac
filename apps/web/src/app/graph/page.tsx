import GlobalGraph from "@/components/graph/GlobalGraph";
import WikiShell from "@/components/wiki/WikiShell";
import { getSiteBrand } from "@/lib/wiki";

export const dynamic = "force-dynamic";

export const metadata = {
	title: "Graph",
	description: "Explore the encyclopedia as a graph — Special:Graph",
};

export default async function GraphPage() {
	const brand = await getSiteBrand();
	return (
		<WikiShell
			brand={brand}
			namespaceTabs={[{ label: "Special page", href: "/graph", active: true }]}
			viewTabs={[]}
		>
			<h1 className="wiki-title">Graph</h1>
			<p className="mt-1 text-[#54595d] text-[12.5px]">
				From {brand.pedia}, the free encyclopedia
			</p>
			<p className="wiki-hatnote">
				This <b>special page</b> visualizes every article as a node, connected
				by wikilinks. Drag to pan, scroll to zoom, click a node to open its
				article; hover to preview.
			</p>
			<GlobalGraph height={600} />
		</WikiShell>
	);
}
