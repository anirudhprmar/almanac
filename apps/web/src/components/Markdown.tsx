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
		return (
			<Link className="underline underline-offset-4" href={href as Route}>
				{children}
			</Link>
		);
	}
	return (
		<a
			className="underline underline-offset-4"
			href={href}
			target="_blank"
			rel="noreferrer"
		>
			{children}
		</a>
	);
}

export default function Markdown({ content }: { content: string }) {
	return (
		<div className="text-[15px] leading-7">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					a: WikiLink,
					h1: ({ children }) => (
						<h1 className="mt-6 mb-3 font-semibold text-2xl">{children}</h1>
					),
					h2: ({ children }) => (
						<h2 className="mt-6 mb-2 font-semibold text-xl">{children}</h2>
					),
					h3: ({ children }) => (
						<h3 className="mt-4 mb-2 font-semibold text-lg">{children}</h3>
					),
					p: ({ children }) => <p className="my-3">{children}</p>,
					ul: ({ children }) => (
						<ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>
					),
					ol: ({ children }) => (
						<ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>
					),
					blockquote: ({ children }) => (
						<blockquote className="my-3 border-l-2 pl-4 text-muted-foreground italic">
							{children}
						</blockquote>
					),
					pre: ({ children }) => (
						<pre className="my-3 overflow-x-auto rounded-lg border bg-muted/50 p-4 text-sm">
							{children}
						</pre>
					),
					code: ({ children }) => (
						<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px]">
							{children}
						</code>
					),
					table: ({ children }) => (
						<div className="my-3 overflow-x-auto">
							<table className="w-full border-collapse text-sm">
								{children}
							</table>
						</div>
					),
					th: ({ children }) => (
						<th className="border px-3 py-2 text-left font-medium">
							{children}
						</th>
					),
					td: ({ children }) => (
						<td className="border px-3 py-2">{children}</td>
					),
					hr: () => <hr className="my-6" />,
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
