"use client";

import { splitPedia } from "@almanac/core/site-brand";
import Link from "next/link";

/**
 * Approximate Wikipedia puzzle-globe mark, drawn inline so no image
 * asset is needed. Paired with the <Name>pedia wordmark in the sidebar.
 */
export default function PuzzleLogo({
	pedia,
	compact = false,
}: {
	pedia: string;
	compact?: boolean;
}) {
	const { prefix, suffix } = splitPedia(pedia);
	return (
		<Link
			href="/"
			className="group flex flex-col items-center py-4"
			aria-label={`${pedia} home`}
		>
			<svg
				width={compact ? 80 : 120}
				height={compact ? 80 : 120}
				viewBox="0 0 120 120"
				role="img"
				aria-hidden="true"
				className="drop-shadow-sm transition-transform group-hover:rotate-3"
			>
				<circle
					cx="60"
					cy="60"
					r="52"
					fill="#fff"
					stroke="#a7d7f9"
					strokeWidth="3"
				/>
				{/* puzzle seams */}
				<g stroke="#a7a7a7" strokeWidth="1.6" fill="none">
					<path d="M8 60 H112" />
					<path d="M60 8 V112" />
					<ellipse cx="60" cy="60" rx="26" ry="52" />
					<ellipse cx="60" cy="60" rx="44" ry="52" />
					<path d="M22 34 Q60 46 98 34" />
					<path d="M22 86 Q60 74 98 86" />
				</g>
				{/* puzzle tabs */}
				<g fill="#fff" stroke="#72777d" strokeWidth="1.6">
					<rect x="30" y="22" width="18" height="14" rx="2" />
					<rect x="72" y="46" width="18" height="14" rx="2" />
					<rect x="44" y="72" width="18" height="14" rx="2" />
				</g>
				{/* glyphs */}
				<g
					fontSize="13"
					textAnchor="middle"
					fontFamily="Georgia, serif"
					fill="#202122"
				>
					<text x="39" y="33">
						{prefix.charAt(0).toUpperCase() || "U"}
					</text>
					<text x="81" y="57">
						p
					</text>
					<text x="53" y="83">
						Ω
					</text>
					<text x="66" y="103" fontSize="11">
						π
					</text>
				</g>
				{/* missing piece */}
				<path
					d="M88 20 l14 -8 l4 14 l-14 8 z"
					fill="#f6f6f6"
					stroke="#72777d"
					strokeWidth="1.6"
				/>
			</svg>
			<span className="mt-1 max-w-[11em] text-center font-serif leading-none">
				<span className="block break-words text-[#202122] text-[19px] tracking-tight">
					{prefix.toUpperCase()}
					{suffix && (
						<span className="text-[#54595d]">{suffix.toUpperCase()}</span>
					)}
				</span>
				<span className="mt-1 block text-[#54595d] text-[11px]">
					The Free Encyclopedia
				</span>
			</span>
		</Link>
	);
}
