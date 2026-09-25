import Link from "next/link";
import { getArticles } from "@/lib/wiki";

export const dynamic = "force-dynamic";

export default async function Home() {
	const articles = await getArticles();

	return (
		<div className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
			<div>
				<h1 className="font-semibold text-3xl">Notes</h1>
				<p className="text-muted-foreground text-sm">
					{articles.length === 0
						? "No notes yet. Add markdown files with a title in frontmatter to your content directory."
						: `${articles.length} note${articles.length === 1 ? "" : "s"}. Explore them as a `}
					{articles.length > 0 && (
						<Link className="underline underline-offset-4" href="/graph">
							graph
						</Link>
					)}
					{articles.length > 0 && "."}
				</p>
			</div>

			{articles.length > 0 && (
				<ul className="divide-y rounded-lg border">
					{articles.map((a) => (
						<li key={a.slug}>
							<Link
								className="block p-4 transition-colors hover:bg-muted/50"
								href={`/wiki/${a.slug}`}
							>
								<p className="font-medium">{a.title}</p>
								{a.description && (
									<p className="mt-0.5 line-clamp-2 text-muted-foreground text-sm">
										{a.description}
									</p>
								)}
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
