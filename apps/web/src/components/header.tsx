"use client";
import Link from "next/link";

import { ModeToggle } from "./mode-toggle";
import SearchBox from "./search/SearchBox";

export default function Header() {
	const links = [
		{ to: "/", label: "Home" },
		{ to: "/search", label: "Search" },
		{ to: "/graph", label: "Graph" },
	] as const;

	return (
		<div>
			<div className="flex flex-row items-center justify-between px-2 py-1">
				<nav className="flex gap-4 text-lg">
					{links.map(({ to, label }) => {
						return (
							<Link key={to} href={to}>
								{label}
							</Link>
						);
					})}
				</nav>
				<div className="flex items-center gap-2">
					<SearchBox className="hidden w-48 sm:block md:w-64" />
					<ModeToggle />
				</div>
			</div>
			<hr />
		</div>
	);
}
