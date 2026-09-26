/**
 * Pure, client-safe encyclopedia branding helpers (no fs, no Node APIs —
 * importable from client components and Next.js server components alike).
 */

export const DEFAULT_SITE_NAME = "My Almanac";
export const FALLBACK_PEDIA = "Usernamepedia";

export type SiteBrand = {
	/** Raw Almanac/vault name, e.g. "Anirudh". */
	name: string;
	/** Encyclopedia name, e.g. "Anirudhpedia". */
	pedia: string;
};

/**
 * Turn a vault name into its Wikipedia-style encyclopedia name:
 * "Anirudh" -> "Anirudhpedia". Names already ending in "pedia" are kept,
 * and blank/default names fall back to "Usernamepedia".
 */
export function toPediaName(siteName: string): string {
	const name = siteName.trim().replace(/\s+/g, " ");
	if (!name || name.toLowerCase() === DEFAULT_SITE_NAME.toLowerCase()) {
		return FALLBACK_PEDIA;
	}
	if (/pedia$/i.test(name)) return name;
	return `${name}pedia`;
}

/** Split "Anirudhpedia" into { prefix: "Anirudh", suffix: "pedia" } for wordmark styling. */
export function splitPedia(pedia: string): { prefix: string; suffix: string } {
	const m = /^(.*)(pedia)$/i.exec(pedia.trim());
	if (!m) return { prefix: pedia.trim(), suffix: "" };
	return { prefix: m[1] ?? "", suffix: m[2] ?? "" };
}

export function brandOf(siteName: string): SiteBrand {
	const name = siteName.trim().replace(/\s+/g, " ") || DEFAULT_SITE_NAME;
	return { name, pedia: toPediaName(name) };
}
