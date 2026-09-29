import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LocalGraph from "@/components/graph/LocalGraph";
import Markdown from "@/components/Markdown";
import WikiShell from "@/components/wiki/WikiShell";
import {
	getArticleDetail,
	getArticles,
	getSiteBrand,
	resolveWikilinks,
} from "@/lib/wiki";
import {
	articleCategories,
	buildToc,
	excerpt,
	extractOutgoing,
	formatWikiDate,
	infoboxRows,
	wordCount,
} from "@/lib/wiki-ui";

type WikiPageProps = {
	params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: WikiPageProps) {
	const { slug } = await params;
	const detail = await getArticleDetail(slug).catch(() => null);
	const article = detail?.article;
	return {
		title: article ? article.title : "Not found",
		description: article?.description ?? `Usernamepedia article: ${slug}`,
	};
}

export default async function WikiPage({ params }: WikiPageProps) {
	const { slug } = await params;
	const detail = await getArticleDetail(slug).catch(() => null);
	if (!detail) notFound();
	const { article, backlinks } = detail;

	const [all, brand] = await Promise.all([getArticles(), getSiteBrand()]);
	const { pedia } = brand;
	const body = resolveWikilinks(article.content, all);
	const toc = buildToc(article.content);
	const outgoing = extractOutgoing(article.content, all).slice(0, 12);
	const categories = articleCategories(article);
	const infoRows = infoboxRows(article);
	const words = wordCount(article.content);
	const lead = article.description ?? excerpt(article.content, 220);

	return (
		<WikiShell
			brand={brand}
			namespaceTabs={[
				{ label: "Article", href: `/wiki/${article.slug}`, active: true },
				{ label: "Talk", href: `/wiki/${article.slug}#talk` },
			]}
			viewTabs={[
				{ label: "Read", href: `/wiki/${article.slug}`, active: true },
				{ label: "Edit", href: `/wiki/${article.slug}#edit` },
				{ label: "View history", href: `/wiki/${article.slug}#history` },
			]}
		>
			<h1 className="wiki-title">{article.title}</h1>
			<p className="mt-1 text-[#54595d] text-[12.5px]">
				From {pedia}, the free encyclopedia
			</p>
			{lead && lead !== article.content.slice(0, lead.length) && (
				<p className="wiki-hatnote">
					This article is about <b>{article.title}</b>. {lead}
				</p>
			)}

			{}
			<aside
				className="wiki-infobox"
				aria-label={`${article.title} quick facts`}
			>
				<div className="wiki-infobox-title">{article.title}</div>
				{article.description && (
					<div className="px-2 py-2 text-center text-[12.5px] italic">
						{article.description}
					</div>
				)}
				<div className="wiki-infobox-row">
					<span className="wiki-infobox-label">Article</span>
					<span className="wiki-infobox-value">
						<Link href={`/wiki/${article.slug}` as Route} className="wiki-link">
							{article.slug}
						</Link>
					</span>
				</div>
				{infoRows.map((r) => (
					<div key={r.label} className="wiki-infobox-row">
						<span className="wiki-infobox-label">{r.label}</span>
						<span className="wiki-infobox-value">{r.value}</span>
					</div>
				))}
				<div className="wiki-infobox-row">
					<span className="wiki-infobox-label">Length</span>
					<span className="wiki-infobox-value">
						{words.toLocaleString()} words
					</span>
				</div>
				<div className="wiki-infobox-row">
					<span className="wiki-infobox-label">Last edited</span>
					<span className="wiki-infobox-value">
						{formatWikiDate(article.lastModified)}
					</span>
				</div>
				<div className="wiki-infobox-row">
					<span className="wiki-infobox-label">Links out</span>
					<span className="wiki-infobox-value">{outgoing.length}</span>
				</div>
				<div className="wiki-infobox-row">
					<span className="wiki-infobox-label">Linked by</span>
					<span className="wiki-infobox-value">
						{backlinks.length} articles
					</span>
				</div>
			</aside>

			<p className="mt-2 text-[14px]">
				<b>{article.title}</b>
				{article.description ? ` — ${article.description}` : " "} is an entry in{" "}
				<Link href="/" className="wiki-link">
					{pedia}
				</Link>
				, the free encyclopedia of this vault. You are reading the <i>Read</i>{" "}
				revision; use the tabs above to discuss, edit, or inspect its history.
			</p>

			{toc.length > 0 && (
				<nav className="wiki-toc" aria-label="Contents">
					<div className="flex items-baseline justify-between gap-4">
						<span className="font-bold">Contents</span>
						<span className="text-[#54595d] text-[12px]">[hide]</span>
					</div>
					<ol>
						{toc.map((t, i) => (
							<li key={t.id + i} style={{ marginLeft: (t.level - 2) * 14 }}>
								<span className="text-[#54595d]">{i + 1} </span>
								<a href={`#${t.id}`}>{t.text}</a>
							</li>
						))}
						{backlinks.length > 0 && (
							<li>
								<span className="text-[#54595d]">{toc.length + 1} </span>
								<a href="#whatlinkshere">What links here</a>
							</li>
						)}
						<li>
							<span className="text-[#54595d]">
								{toc.length + (backlinks.length > 0 ? 2 : 1)}{" "}
							</span>
							<a href="#history">History</a>
						</li>
					</ol>
				</nav>
			)}

			<Markdown content={body} />

			{}
			{outgoing.length > 0 && (
				<section aria-label="See also">
					<h2 className="wiki-h2" id="see-also">
						See also
					</h2>
					<ul>
						{outgoing.map((o) => (
							<li key={o.slug}>
								<Link href={`/wiki/${o.slug}` as Route}>{o.title}</Link>
							</li>
						))}
					</ul>
				</section>
			)}

			{}
			<section id="whatlinkshere" aria-label="What links here">
				<h2 className="wiki-h2">What links here</h2>
				<p className="text-[#54595d] text-[13px]">
					{backlinks.length === 0
						? "No other Usernamepedia articles link to this page yet."
						: `${backlinks.length} article${backlinks.length === 1 ? "" : "s"} link${backlinks.length === 1 ? "s" : ""} to ${article.title}:`}
				</p>
				{backlinks.length > 0 && (
					<ul>
						{backlinks.map((b) => (
							<li key={b.slug}>
								<Link href={`/wiki/${b.slug}` as Route}>{b.title}</Link>{" "}
								<span className="text-[#72777d] text-[12px]">‎ (← links)</span>
							</li>
						))}
					</ul>
				)}
				<p className="mt-2 text-[13px]">
					<Link href="/graph" className="wiki-link">
						Open the graph view
					</Link>{" "}
					to explore these connections visually.
				</p>
			</section>

			{}
			<section aria-label="Graph">
				<h2 className="wiki-h2" id="graph">
					Graph
				</h2>
				<p className="mb-2 text-[#54595d] text-[13px]">
					Interactive neighborhood of <b>{article.title}</b> — drag nodes, click
					to open articles, or{" "}
					<Link href="/graph" className="wiki-link">
						open the full graph
					</Link>
					.
				</p>
				<LocalGraph slug={article.slug} depth={1} height={320} />
			</section>

			{}
			<section id="talk" aria-label="Talk">
				<h2 className="wiki-h2">Talk</h2>
				<div className="wiki-ambox">
					This is the talk page for discussing improvements to{" "}
					<b>{article.title}</b>. No discussion yet — start one by editing your
					vault notes.
				</div>
			</section>

			<section id="edit" aria-label="Edit">
				<h2 className="wiki-h2">Edit</h2>
				<div className="wiki-ambox">
					Usernamepedia mirrors markdown files in your vault, so editing happens
					there rather than in the browser. Open{" "}
					<code className="rounded border border-[#eaecf0] bg-[#f8f9fa] px-1">
						{article.path}
					</code>{" "}
					to change this article, then revalidate the site.
				</div>
			</section>

			<section id="history" aria-label="History">
				<h2 className="wiki-h2">View history</h2>
				<ul className="text-[13px]">
					<li>
						<span className="text-[#54595d]">
							{formatWikiDate(article.lastModified)}
						</span>{" "}
						<span className="text-[#72777d]">(current revision)</span> — last
						modified on disk at{" "}
						<code className="rounded border border-[#eaecf0] bg-[#f8f9fa] px-1">
							{article.path}
						</code>
					</li>
				</ul>
			</section>

			{}
			<div className="wiki-catbox">
				<b>Categories</b>
				{": "}
				{categories.length > 0 ? (
					categories.map((c, i) => (
						<span key={c}>
							{i > 0 && " | "}
							<Link
								href={`/search?q=${encodeURIComponent(c)}` as Route}
								className="wiki-link"
							>
								{c}
							</Link>
						</span>
					))
				) : (
					<span>
						<Link href="/#contents" className="wiki-link">
							{pedia} articles
						</Link>
						{" | "}
						<Link href="/" className="wiki-link">
							All articles A–Z
						</Link>
					</span>
				)}
			</div>
		</WikiShell>
	);
}
