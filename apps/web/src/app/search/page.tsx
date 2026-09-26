import type { Route } from "next";
import Link from "next/link";
import WikiSearch from "@/components/wiki/WikiSearch";
import WikiShell from "@/components/wiki/WikiShell";
import { getSiteBrand, searchNotes } from "@/lib/wiki";

export const dynamic = "force-dynamic";

type SearchPageProps = {
	searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ searchParams }: SearchPageProps) {
	const { q } = await searchParams;
	const query = (q ?? "").trim();
	const brand = await getSiteBrand().catch(() => null);
	const pedia = brand?.pedia ?? "Usernamepedia";
	return {
		title: query ? `Search results for "${query}"` : "Search",
		description: query
			? `${pedia} search results for "${query}"`
			: `Search ${pedia}`,
	};
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
	const { q } = await searchParams;
	const query = (q ?? "").trim();
	const [hits, brand] = await Promise.all([
		query ? searchNotes(query) : Promise.resolve([]),
		getSiteBrand(),
	]);
	const { pedia } = brand;

	return (
		<WikiShell
			brand={brand}
			namespaceTabs={[{ label: "Special page", href: "/search", active: true }]}
			viewTabs={[]}
			searchDefault={query}
		>
			<h1 className="wiki-title">Search</h1>
			<p className="mt-1 text-[#54595d] text-[12.5px]">
				From {pedia}, the free encyclopedia
			</p>

			<div className="mt-3 max-w-xl">
				<WikiSearch defaultValue={query} size="md" pedia={pedia} />
			</div>
			<p className="mt-2 text-[#54595d] text-[13px]">
				Search across titles, descriptions, and content. Prefix matches and
				typos are tolerated. Try{" "}
				<a href="/random" className="wiki-link">
					a random article
				</a>{" "}
				if you&apos;re feeling lucky.
			</p>

			{!query ? (
				<div className="wiki-ambox mt-3">
					Type above and press <b>Search</b>. Results appear here, ranked by
					title and content matches — just like <i>Special:Search</i> on
					Wikipedia.
				</div>
			) : hits.length === 0 ? (
				<div className="mt-3">
					<h2 className="wiki-h2">Search results</h2>
					<p className="text-[13.5px]">
						There were no results matching the query <b>“{query}”</b>.
					</p>
					<ul className="mt-2 list-disc pl-6 text-[13.5px]">
						<li>Try fewer words or check your spelling.</li>
						<li>
							<Link href="/" className="wiki-link">
								Browse all articles A–Z
							</Link>{" "}
							from the Main Page.
						</li>
					</ul>
				</div>
			) : (
				<div className="mt-3">
					<h2 className="wiki-h2">Search results</h2>
					<p className="text-[#54595d] text-[13px]">
						{hits.length} result{hits.length === 1 ? "" : "s"} for{" "}
						<b>“{query}”</b>
					</p>
					<ol className="mt-2 space-y-3">
						{hits.map((h) => (
							<li key={h.slug}>
								<p className="wiki-search-result-title">
									<Link href={`/wiki/${h.slug}` as Route}>{h.title}</Link>
								</p>
								{h.description && (
									<p className="text-[#202122] text-[13px]">{h.description}</p>
								)}
								{h.excerpt && (
									<p className="line-clamp-2 text-[#54595d] text-[13px]">
										{h.excerpt}
									</p>
								)}
								<p className="wiki-search-result-meta">
									/{h.slug} · score {h.score.toFixed(1)}
								</p>
							</li>
						))}
					</ol>
				</div>
			)}
		</WikiShell>
	);
}
