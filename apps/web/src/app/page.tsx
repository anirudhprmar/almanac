import type { Route } from "next";
import Link from "next/link";
import WikiSearch from "@/components/wiki/WikiSearch";
import WikiShell from "@/components/wiki/WikiShell";
import { getArticles, getSiteBrand } from "@/lib/wiki";
import { excerpt, formatWikiDate } from "@/lib/wiki-ui";

export const dynamic = "force-dynamic";

function groupByLetter(articles: Awaited<ReturnType<typeof getArticles>>) {
	const map = new Map<string, typeof articles>();
	for (const a of articles) {
		const letter = (a.title.charAt(0).toUpperCase() || "#").replace(
			/[^A-Z]/,
			"#",
		);
		const list = map.get(letter);
		if (list) list.push(a);
		else map.set(letter, [a]);
	}
	return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export default async function Home() {
	const [articles, brand] = await Promise.all([getArticles(), getSiteBrand()]);
	const { pedia, name } = brand;
	const count = articles.length;
	const featured = articles[0] ?? null;
	const didYouKnow = articles.filter((a) => a.description).slice(0, 4);
	const recent = articles.slice(0, 6);
	const letters = groupByLetter(articles);

	return (
		<WikiShell
			brand={brand}
			namespaceTabs={[
				{ label: "Main Page", href: "/", active: true },
				{ label: "Talk", href: "/#talk" },
			]}
			viewTabs={[
				{ label: "Read", href: "/", active: true },
				{ label: "View source", href: "/#about" },
				{ label: "View history", href: "/#recent" },
			]}
		>
			<h1 className="wiki-title">Main Page</h1>
			<p className="mt-1 text-[#54595d] text-[12.5px]">
				From {pedia}, the free encyclopedia
			</p>

			{/* welcome banner */}
			<div className="mt-3 border border-[#a2a9b1] bg-[#f8f9fa] px-4 py-3 text-center">
				<p className="font-serif text-[22px]">Welcome to {pedia},</p>
				<p className="text-[13px]">
					the{" "}
					<Link href="/#about" className="wiki-link">
						free encyclopedia
					</Link>{" "}
					of{" "}
					<Link href="/#about" className="wiki-link font-bold">
						{name}
					</Link>{" "}
					—{" "}
					<Link href="/#about" className="wiki-link">
						anyone can read it
					</Link>
					, and it&apos;s built from your own notes.
				</p>
				<p className="mt-1 text-[13px]">
					{count === 0 ? (
						<>No articles yet. Add markdown files with a title to your vault.</>
					) : (
						<>
							<Link href="/#contents" className="wiki-link font-bold">
								{count.toLocaleString()} article{count === 1 ? "" : "s"}
							</Link>{" "}
							and counting
						</>
					)}
				</p>
				<div className="mx-auto mt-3 max-w-xl">
					<WikiSearch size="md" pedia={pedia} />
				</div>
				<p className="mt-2 text-[#54595d] text-[12.5px]">
					Portals:{" "}
					{[
						"Arts",
						"Biography",
						"Geography",
						"History",
						"Society",
						"Science",
					].map((p, i) => (
						<span key={p}>
							{i > 0 && " · "}
							<Link href={"/#contents" as Route} className="wiki-link">
								{p}
							</Link>
						</span>
					))}
				</p>
			</div>

			{count === 0 ? (
				<div className="wiki-ambox mt-3">
					Your vault is empty. Create a markdown file with frontmatter{" "}
					<code>title: My First Article</code> and it will appear here as a{" "}
					{pedia} entry, complete with infobox, table of contents, and
					backlinks.
				</div>
			) : (
				<>
					{/* two-column features */}
					<div className="mt-3 grid gap-2.5 lg:grid-cols-2">
						<div>
							<div className="wiki-mp-box" style={{ background: "#f5fffa" }}>
								<h2 style={{ background: "#cef2e0", borderColor: "#a3bfb1" }}>
									From today&apos;s featured article
								</h2>
								<div>
									{featured && (
										<>
											<p className="mb-1 font-bold text-[15px]">
												<Link href={`/wiki/${featured.slug}` as Route}>
													{featured.title}
												</Link>
											</p>
											<p>
												{featured.description ?? excerpt(featured.content, 260)}
											</p>
											<p className="mt-2 text-right text-[12.5px]">
												<Link
													href={`/wiki/${featured.slug}` as Route}
													className="wiki-link font-bold"
												>
													Full article…
												</Link>
											</p>
										</>
									)}
								</div>
							</div>
							<div className="wiki-mp-box" style={{ background: "#fff5fa" }}>
								<h2 style={{ background: "#f2cedd", borderColor: "#b1a3ad" }}>
									Did you know…
								</h2>
								<div>
									<ul className="list-disc pl-5">
										{didYouKnow.length === 0
											? articles.slice(0, 4).map((a) => (
													<li key={a.slug}>
														… that{" "}
														<Link
															href={`/wiki/${a.slug}` as Route}
															className="wiki-link font-bold"
														>
															{a.title}
														</Link>{" "}
														is documented in {pedia}?
													</li>
												))
											: didYouKnow.map((a) => (
													<li key={a.slug}>
														… that{" "}
														<Link
															href={`/wiki/${a.slug}` as Route}
															className="wiki-link font-bold"
														>
															{a.title}
														</Link>{" "}
														— {a.description}
													</li>
												))}
									</ul>
								</div>
							</div>
						</div>
						<div>
							<div className="wiki-mp-box" style={{ background: "#f5faff" }}>
								<h2
									id="news"
									style={{ background: "#cedff2", borderColor: "#a3b0bf" }}
								>
									In the news
								</h2>
								<div>
									<ul className="list-disc pl-5">
										{recent.slice(0, 5).map((a) => (
											<li key={a.slug}>
												<Link
													href={`/wiki/${a.slug}` as Route}
													className="wiki-link"
												>
													{a.title}
												</Link>{" "}
												<span className="text-[#72777d] text-[12px]">
													— edited {formatWikiDate(a.lastModified)}
												</span>
											</li>
										))}
									</ul>
									<p className="mt-2 text-right text-[12.5px]">
										<a href="/random" className="wiki-link font-bold">
											Read a random article →
										</a>
									</p>
								</div>
							</div>
							<div className="wiki-mp-box" style={{ background: "#fffef5" }}>
								<h2
									id="recent"
									style={{ background: "#f2e8ce", borderColor: "#bfae8e" }}
								>
									Recent changes
								</h2>
								<div>
									<ul className="space-y-1">
										{recent.map((a) => (
											<li key={a.slug} className="text-[13px]">
												<span className="text-[#72777d]">
													{formatWikiDate(a.lastModified)}
												</span>{" "}
												<Link
													href={`/wiki/${a.slug}` as Route}
													className="wiki-link"
												>
													{a.title}
												</Link>
											</li>
										))}
									</ul>
									<p className="mt-2 text-[12.5px]">
										Also available as a{" "}
										<Link href="/graph" className="wiki-link">
											graph view
										</Link>
										.
									</p>
								</div>
							</div>
						</div>
					</div>

					{/* contents A-Z */}
					<section id="contents" aria-label="Contents">
						<h2 className="wiki-h2">Contents</h2>
						<p className="text-[13px]">
							Browse all {count} article{count === 1 ? "" : "s"} alphabetically,
							or{" "}
							<Link href="/search" className="wiki-link">
								search {pedia}
							</Link>
							.
						</p>
						<p className="my-2 text-[13px]">
							{letters.map(([letter], i) => (
								<span key={letter}>
									{i > 0 && " · "}
									<a href={`#az-${letter}`} className="wiki-link font-bold">
										{letter}
									</a>
								</span>
							))}
						</p>
						{letters.map(([letter, list]) => (
							<div key={letter} className="mb-3">
								<h3 className="wiki-h3" id={`az-${letter}`}>
									{letter}
								</h3>
								<ul className="columns-1 gap-6 sm:columns-2 lg:columns-3">
									{list.map((a) => (
										<li
											key={a.slug}
											className="break-inside-avoid text-[13.5px]"
										>
											<Link href={`/wiki/${a.slug}` as Route}>{a.title}</Link>
										</li>
									))}
								</ul>
							</div>
						))}
					</section>

					{/* about / community anchors for sidebar links */}
					<section id="about" aria-label="About">
						<h2 className="wiki-h2">About {pedia}</h2>
						<p className="text-[13.5px]">
							{pedia} is the personal encyclopedia of <b>{name}</b>, presenting
							a markdown vault with the look and conventions of Wikipedia: every
							note is an <i>article</i> with a title, table of contents,
							infobox, <i>See also</i> links, <i>What links here</i> backlinks,
							categories, and history. Internal <code>[[wikilinks]]</code>{" "}
							become blue links between articles.
						</p>
						<p className="mt-2 text-[13.5px]">
							The name says it all: this vault belongs to {name}, so its
							encyclopedia is <b>{pedia}</b>. Change the vault name (for example
							with <code>almanac init --name &quot;YourName&quot;</code>) and
							the whole site rebrands.
						</p>
					</section>
					<section id="community" aria-label="Community">
						<h2 className="wiki-h2">Community portal</h2>
						<p className="text-[13.5px]">
							This is a single-vault demo, so the community is you. Keep writing
							notes and linking them with <code>[[Article title]]</code> — the
							Main Page, search index, and graph update automatically.
						</p>
					</section>
					<section id="talk" aria-label="Talk">
						<h2 className="wiki-h2">Talk: Main Page</h2>
						<div className="wiki-ambox">
							No discussion yet. This is the talk page for the {pedia} Main
							Page.
						</div>
					</section>
				</>
			)}
		</WikiShell>
	);
}
