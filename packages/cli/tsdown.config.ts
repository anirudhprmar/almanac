import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/index.ts",
	format: "esm",
	outDir: "./dist",
	clean: true,
	dts: false,
	minify: false,
	banner: {
		js: "#!/usr/bin/env node",
	},
	fixedExtension: false,
	outExtensions: () => ({ js: ".js" }),
	deps: {
		alwaysBundle: [/@almanac\/.*/],
	},
});
