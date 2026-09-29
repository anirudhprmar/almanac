import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/mcp.ts"],
	format: "esm",
	outDir: "./dist",
	clean: true,
	deps: {
		alwaysBundle: [/@almanac\/.*/],
	},
});
