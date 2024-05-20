import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";

const notoSansJP = Noto_Sans_JP({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "voxel-tile-visualization-demo",
	description: "A example of voxel tile visualization",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={notoSansJP.className}>{children}</body>
		</html>
	);
}
