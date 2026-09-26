import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

import { getSiteBrand } from "@/lib/wiki";

export async function generateMetadata(): Promise<Metadata> {
	const brand = await getSiteBrand().catch(() => null);
	const pedia = brand?.pedia ?? "Usernamepedia";
	return {
		title: {
			default: `${pedia}, the free encyclopedia`,
			template: `%s - ${pedia}`,
		},
		description: `${pedia} — the free encyclopedia of your notes, styled like Wikipedia.`,
	};
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
