import type { Route } from "next";
import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function WikiLink({
	href,
	children,
}: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) {
	if (href?.startsWith("/wiki/")) {
		return <Link href={href as Route}>{children}</Link>;
	}
	if (href?.startsWith("#")) {
		return <a href={href}>{children}</a>;
	}
	return (
		<a href={href} target="_blank" rel="noreferrer">
			{children}
		</a>
	);
}

function headingId(children: ReactNode): string | undefined {
	const text = Array.isArray(children)
		? children.map((c) => (typeof c === "string" ? c : "")).join("")
		: typeof children === "string"
			? children
			: "";
	const slug = text
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || undefined;
}

export default function Markdown({ content }: { content: string }) {
	return (
		<div className="wiki-content">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					a: WikiLink,
					h1: ({ children }) => <h2 className="wiki-h2">{children}</h2>,
					h2: ({ children }) => (
						<h2 className="wiki-h2" id={headingId(children)}>
							{children}
						</h2>
					),
					h3: ({ children }) => (
						<h3 className="wiki-h3" id={headingId(children)}>
							{children}
						</h3>
					),
					h4: ({ children }) => (
						<h4 className="wiki-h4" id={headingId(children)}>
							{children}
						</h4>
					),
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
