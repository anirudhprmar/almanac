import Link from "next/link";
import SearchBox from "@/components/search/SearchBox";
import { searchNotes } from "@/lib/wiki";

export const dynamic = "force-dynamic";

type SearchPageProps = {
	searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ searchParams }: SearchPageProps) {
	const { q } = await searchParams;
	const query = (q ?? "").trim();
	return {
		title: query ? `Search: ${query} · almanac` : "Search · almanac",
		description: query
			? `Full-text search results for "${query}"`
			: "Search all notes",
	};
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
	const { q } = await searchParams;
	const query = (q ?? "").trim();
	const hits = query ? await searchNotes(query) : [];

	return (
		<div className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
			<div className="space-y-3">
				<h1 className="font-semibold text-3xl">Search</h1>
				<SearchBox defaultValue={query} autoFocus />
			</div>

			{!query ? (
				<p className="text-muted-foreground text-sm">
					Type above to search across titles, descriptions, and content. Prefix
					matches and typos are tolerated.
				</p>
			) : hits.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					No results for “{query}”. Try fewer words or check spelling.
				</p>
			) : (
				<div className="space-y-2">
					<p className="text-muted-foreground text-sm">
						{hits.length} result{hits.length === 1 ? "" : "s"} for “{query}”
					</p>
					<ul className="divide-y rounded-lg border">
						{hits.map((h) => (
							<li key={h.slug}>
								<Link
									className="block p-4 transition-colors hover:bg-muted/50"
									href={`/wiki/${h.slug}`}
								>
									<p className="font-medium">{h.title}</p>
									{h.description && (
										<p className="mt-0.5 text-muted-foreground text-sm">
											{h.description}
										</p>
									)}
									{h.excerpt && (
										<p className="mt-0.5 line-clamp-2 text-muted-foreground text-sm">
											{h.excerpt}
										</p>
									)}
								</Link>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
