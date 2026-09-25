/** Client-safe wiki helpers (no fs, no cache — importable from client components). */
export function wikiHref(slug: string): string {
	return `/wiki/${slug}`;
}
