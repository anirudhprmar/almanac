import type { BooleanArgDef, StringArgDef } from "citty";

export const dirArg: StringArgDef = {
	type: "string",
	description:
		"Vault content directory (defaults to CONTENT_DIR env or ./wiki)",
	alias: "d",
	valueHint: "dir",
};

export const jsonArg: BooleanArgDef = {
	type: "boolean",
	description: "Output raw JSON",
	alias: "j",
	default: false,
};
