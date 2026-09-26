"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
	defaultValue?: string;
	id?: string;
	size?: "sm" | "md";
	pedia?: string;
};

/** Vector-style search box: input + Search button. Navigates to /search?q=... */
export default function WikiSearch({
	defaultValue = "",
	id = "wiki-search",
	size = "sm",
	pedia = "Usernamepedia",
}: Props) {
	const router = useRouter();
	const [value, setValue] = useState(defaultValue);

	return (
		<search className="block">
			<form
				aria-label={`Search ${pedia}`}
				className="flex items-stretch"
				onSubmit={(e) => {
					e.preventDefault();
					const q = value.trim();
					router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
				}}
			>
				<input
					id={id}
					type="search"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder={`Search ${pedia}`}
					aria-label={`Search ${pedia}`}
					className={
						size === "md"
							? "h-9 w-full border border-[#a2a9b1] bg-white px-3 text-[#202122] text-[14px] outline-none placeholder:text-[#72777d] focus:border-[#3366cc]"
							: "h-7 w-44 border border-[#a2a9b1] bg-white px-2 text-[#202122] text-[13px] outline-none placeholder:text-[#72777d] focus:border-[#3366cc] lg:w-56"
					}
				/>
				<button
					type="submit"
					className={
						size === "md"
							? "h-9 shrink-0 border border-[#a2a9b1] border-l-0 bg-[#f8f9fa] px-4 font-bold text-[#202122] text-[14px] hover:bg-white hover:text-[#3366cc]"
							: "h-7 shrink-0 border border-[#a2a9b1] border-l-0 bg-[#f8f9fa] px-3 font-bold text-[#202122] text-[13px] hover:bg-white hover:text-[#3366cc]"
					}
				>
					Search
				</button>
			</form>
		</search>
	);
}
