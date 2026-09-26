import { redirect } from "next/navigation";
import { getArticles } from "@/lib/wiki";

export const dynamic = "force-dynamic";

/** Special:Random — redirect to a random article, like Wikipedia. */
export async function GET() {
	const articles = await getArticles();
	if (articles.length === 0) redirect("/");
	const pick = articles[Math.floor(Math.random() * articles.length)];
	redirect(`/wiki/${pick.slug}`);
}
