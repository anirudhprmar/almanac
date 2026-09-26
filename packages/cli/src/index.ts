import { defineCommand, runMain } from "citty";
import backlinks from "./commands/backlinks.ts";
import compile from "./commands/compile.ts";
import dev from "./commands/dev.ts";
import graph from "./commands/graph.ts";
import index from "./commands/index.ts";
import init from "./commands/init.ts";
import links from "./commands/links.ts";
import list from "./commands/list.ts";
import fresh from "./commands/new.ts";
import search from "./commands/search.ts";
import show from "./commands/show.ts";
import stats from "./commands/stats.ts";
import validate from "./commands/validate.ts";

const main = defineCommand({
	meta: {
		name: "almanac",
		version: "0.0.0",
		description:
			"Almanac vault CLI — init, dev, compile, search, graph and validate your markdown wiki",
	},
	subCommands: {
		init,
		dev,
		compile,
		list,
		show,
		search,
		graph,
		backlinks,
		links,
		index,
		stats,
		validate,
		new: fresh,
	},
});

runMain(main);
