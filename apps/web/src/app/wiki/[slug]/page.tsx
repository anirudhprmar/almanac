import Link from "next/link";
import { notFound } from "next/navigation";
import LocalGraph from "@/components/graph/LocalGraph";
import Markdown from "@/components/Markdown";
import { getArticleDetail, getArticles, resolveWikilinks } from "@/lib/wiki";

type WikiPageProps = {
	params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: WikiPageProps) {
	const { slug } = await params;
	const detail = await getArticleDetail(slug).catch(() => null);
	const article = detail?.article;
	return {
		title: article ? `${article.title} · almanac` : "Not found · almanac",
		description: article?.description,
	};
}

export default async function WikiPage({ params }: WikiPageProps) {
	const { slug } = await params;
	const detail = await getArticleDetail(slug).catch(() => null);
	if (!detail) notFound();
	const { article, backlinks } = detail;

	const all = await getArticles();
	const body = resolveWikilinks(article.content, all);

	return (
		<div className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
			<article>
				<h1 className="font-semibold text-3xl">{article.title}</h1>
				{article.description && (
					<p className="mt-1 text-muted-foreground">{article.description}</p>
				)}
				<div className="mt-2">
					<Markdown content={body} />
				</div>
			</article>

			<section>
				<h2 className="mb-2 font-medium">Local graph</h2>
				<LocalGraph slug={article.slug} depth={1} />
			</section>

			<section className="rounded-lg border p-4">
				<h2 className="mb-2 font-medium">
					Backlinks{" "}
					<span className="text-muted-foreground">({backlinks.length})</span>
				</h2>
				{backlinks.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No notes link here yet.
					</p>
				) : (
					<ul className="space-y-1">
						{backlinks.map((b) => (
							<li key={b.slug}>
								<Link
									className="underline underline-offset-4"
									href={`/wiki/${b.slug}`}
								>
									{b.title}
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
