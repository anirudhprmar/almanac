import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SiteBrand } from "@/lib/wiki";
import PuzzleLogo from "./PuzzleLogo";
import WikiSearch from "./WikiSearch";

export type WikiTab = {
	label: string;
	href: string;
	active?: boolean;
};

type WikiShellProps = {
	children: ReactNode;
	brand: SiteBrand;
	namespaceTabs?: WikiTab[];
	viewTabs?: WikiTab[];
	searchDefault?: string;
};

const PERSONAL = ["Talk", "Contributions", "Create account", "Log in"];

function SidebarSection({
	title,
	links,
}: {
	title: string;
	links: { label: string; href: string }[];
}) {
	return (
		<nav
			aria-label={title}
			className="border-[#c8ccd1] border-b px-3 py-2 last:border-0"
		>
			<h3 className="mb-1 border-[#c8ccd1] border-b pb-1 font-normal text-[#54595d] text-[11px]">
				{title}
			</h3>
			<ul className="space-y-[2px] text-[12.5px] leading-5">
				{links.map((l) => (
					<li key={l.label}>
						<Link href={l.href as Route} className="wiki-link">
							{l.label}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}

export default function WikiShell({
	children,
	brand,
	namespaceTabs,
	viewTabs,
	searchDefault = "",
}: WikiShellProps) {
	const { pedia, name } = brand;
	const ns = namespaceTabs ?? [
		{ label: "Article", href: "/", active: true },
		{ label: "Talk", href: "/#talk" },
	];
	const views = viewTabs ?? [
		{ label: "Read", href: "/", active: true },
		{ label: "View history", href: "/#history" },
	];

	return (
		<div className="wiki-page min-h-svh bg-[#f6f6f6] text-[#202122]">
			{}
			<div className="flex items-center justify-end gap-3 px-4 pt-1 text-[#54595d] text-[12px]">
				<span className="hidden items-center gap-1 sm:flex">
					<span
						className="inline-block h-4 w-4 rounded-full border border-[#72777d]"
						aria-hidden="true"
					/>
					Not logged in
				</span>
				{PERSONAL.map((label) => (
					<Link key={label} href="/search" className="wiki-link">
						{label}
					</Link>
				))}
			</div>

			<div className="mx-auto flex max-w-[1440px] items-start gap-0 px-0 sm:px-2">
				{}
				<aside className="hidden w-[11em] shrink-0 md:block">
					<PuzzleLogo pedia={pedia} />
					<div className="overflow-hidden">
						<SidebarSection
							title="Navigation"
							links={[
								{ label: "Main page", href: "/" },
								{ label: "Contents", href: "/#contents" },
								{ label: "Current events", href: "/#news" },
								{ label: "Random article", href: "/random" },
								{ label: `About ${pedia}`, href: "/#about" },
								{ label: "Contact us", href: "/#about" },
							]}
						/>
						<SidebarSection
							title="Contribute"
							links={[
								{ label: "Help", href: "/#about" },
								{ label: "Community portal", href: "/#community" },
								{ label: "Recent changes", href: "/#recent" },
								{ label: "Upload file", href: "/search" },
							]}
						/>
						<SidebarSection
							title="Tools"
							links={[
								{ label: "What links here", href: "/#whatlinkshere" },
								{ label: "Related changes", href: "/graph" },
								{ label: "Graph view", href: "/graph" },
								{ label: "Special pages", href: "/search" },
								{ label: "Printable version", href: "/" },
							]}
						/>
						<SidebarSection
							title={`About ${name}`}
							links={[
								{ label: "Vault contents", href: "/#contents" },
								{ label: "Graph view", href: "/graph" },
								{ label: `Search ${pedia}`, href: "/search" },
							]}
						/>
					</div>
				</aside>

				{}
				<div className="min-w-0 flex-1 pb-8">
					{}
					<div className="flex flex-wrap items-end justify-between gap-2 px-3 pt-1 md:hidden">
						<Link href="/" className="font-serif text-lg">
							{pedia}
						</Link>
						<WikiSearch pedia={pedia} />
					</div>
					<div className="mt-1 flex flex-wrap items-end justify-between gap-y-0 px-3">
						<ul className="flex items-end" aria-label="Namespaces">
							{ns.map((t) => (
								<li key={t.label}>
									<Link
										href={t.href as Route}
										aria-current={t.active ? "page" : undefined}
										className={
											t.active ? "wiki-tab wiki-tab-active" : "wiki-tab"
										}
									>
										{t.label}
									</Link>
								</li>
							))}
						</ul>
						<div className="flex items-end gap-2">
							<ul className="hidden items-end sm:flex" aria-label="Views">
								{views.map((t) => (
									<li key={t.label}>
										<Link
											href={t.href as Route}
											aria-current={t.active ? "page" : undefined}
											className={
												t.active ? "wiki-tab wiki-tab-active" : "wiki-tab"
											}
										>
											{t.label}
										</Link>
									</li>
								))}
							</ul>
							<div className="hidden pb-1 md:block">
								<WikiSearch defaultValue={searchDefault} pedia={pedia} />
							</div>
						</div>
					</div>

					{}
					<main className="wiki-content mx-1 border border-[#a7d7f9] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.06)] sm:px-6 md:ml-0">
						{children}
					</main>

					{}
					<footer className="px-4 pt-4 text-[#202122] text-[12px]">
						<div className="border-[#c8ccd1] border-t pt-3">
							<p className="mb-2">
								This page was last edited on{" "}
								<span className="text-[#54595d]">this vault build</span>, at{" "}
								<span className="text-[#54595d]">local time</span>.
							</p>
							<p className="mb-3">
								Text is available under the{" "}
								<Link href="/#about" className="wiki-link">
									Creative Commons Attribution-ShareAlike License
								</Link>
								; additional terms may apply. By using this site, you agree to
								the{" "}
								<Link href="/#about" className="wiki-link">
									Terms of Use
								</Link>{" "}
								and{" "}
								<Link href="/#about" className="wiki-link">
									Privacy Policy
								</Link>
								. {pedia}® is {name}&apos;s personal encyclopedia.
							</p>
							<ul className="flex flex-wrap gap-x-4 gap-y-1">
								{[
									"Privacy policy",
									`About ${pedia}`,
									"Disclaimers",
									`Contact ${pedia}`,
									"Code of Conduct",
									"Developers",
									"Statistics",
									"Cookie statement",
								].map((l) => (
									<li key={l}>
										<Link href="/#about" className="wiki-link">
											{l}
										</Link>
									</li>
								))}
							</ul>
							<div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-[#c8ccd1] border-t pt-3 text-[#54595d]">
								<span>
									A <span className="font-serif">{pedia}</span> demo · {name}
									&apos;s vault · {new Date().getFullYear()}
								</span>
								<span className="flex items-center gap-2">
									<span className="border border-[#a2a9b1] bg-white px-2 py-1 font-bold text-[11px]">
										MediaWiki-ish
									</span>
									<span className="border border-[#a2a9b1] bg-white px-2 py-1 text-[11px]">
										Wikimedia-style demo
									</span>
								</span>
							</div>
						</div>
					</footer>
				</div>
			</div>
		</div>
	);
}
