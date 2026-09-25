"use client";

import { Input } from "@almanac/ui/components/input";
import { cn } from "@almanac/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SearchBoxProps = {
	defaultValue?: string;
	placeholder?: string;
	autoFocus?: boolean;
	className?: string;
};

/** Search input that navigates to /search?q=... on submit. */
export default function SearchBox({
	defaultValue = "",
	placeholder = "Search notes…",
	autoFocus = false,
	className,
}: SearchBoxProps) {
	const router = useRouter();
	const [value, setValue] = useState(defaultValue);

	return (
		<search className={cn("w-full", className)}>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					const q = value.trim();
					router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
				}}
			>
				<Input
					type="search"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder={placeholder}
					autoFocus={autoFocus}
					aria-label="Search notes"
				/>
			</form>
		</search>
	);
}
