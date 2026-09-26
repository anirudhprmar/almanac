export function printJson(value: unknown): void {
	console.log(JSON.stringify(value, null, 2));
}

export function fatal(message: string, exitCode = 1): never {
	console.error(`almanac: ${message}`);
	process.exit(exitCode);
}

/** Truncate a string to `max` chars with an ellipsis. */
export function truncate(input: string | undefined, max = 80): string {
	if (!input) return "";
	const singleLine = input.replace(/\s+/g, " ").trim();
	if (singleLine.length <= max) return singleLine;
	return `${singleLine.slice(0, max - 1)}…`;
}
