import Jimp from "jimp";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
	_req: NextRequest,
	{ params }: { params: { z: string; x: string; y: string } },
) {
	const { z: zUnchecked, x: xUnchecked, y: yUnchecked } = params;

	const z = Number.parseInt(zUnchecked, 10);
	const x = Number.parseInt(xUnchecked, 10);
	const y = Number.parseInt(yUnchecked, 10);

	if (![z, x, y].every(Number.isSafeInteger)) {
		return new NextResponse("Invalid parameters", { status: 400 });
	}

	const voxelTile = await createVoxelTile(z, x, y);

	if (voxelTile === null) {
		return new NextResponse("Failed to fetch tile", { status: 500 });
	}

	return NextResponse.json(voxelTile);
}

// ** ボクセル状の地形データを生成 **

// 標高タイルから高さデータを取得
async function fetchHeightTile(z: number, x: number, y: number) {
	return fetch(`https://cyberjapandata.gsi.go.jp/xyz/dem5a/${z}/${x}/${y}.txt`)
		.then((res) => res.text())
		.then((text) =>
			text
				.split("\n")
				.map((line) => line.split(",").map((v) => Number.parseFloat(v))),
		)
		.catch((e) => {
			console.error(e);
			return null;
		});
}

// 航空写真タイルから色データを取得
async function fetchColorTile(z: number, x: number, y: number) {
	return Jimp.read(
		// 256x256の航空写真タイルを取得
		`https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/${z}/${x}/${y}.jpg`,
	)
		.then((imag) => {
			const { width, height } = imag.bitmap;
			const colors: { r: number; g: number; b: number }[] = [];

			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const { r, g, b } = Jimp.intToRGBA(imag.getPixelColor(x, y));

					colors.push({ r, g, b });
				}
			}
			return colors;
		})
		.catch((e) => {
			console.error(e);
			return null;
		});
}

type Pixel = {
	height: number;
	quadKey: string;
	r: number;
	g: number;
	b: number;
};

// 高さデータと色データを結合
function joinHeightAndColor(
	x: number,
	y: number,
	z: number,
	height: number[][],
	colors: { r: number; g: number; b: number }[],
): Pixel[] {
	const tile_size = 256;
	// タイルの左上のピクセル座標
	const originX = x * tile_size;
	const originY = y * tile_size;
	// ピクセル座標はズームレベルが8大きいタイル座標と同じ
	const pixel_zoom_lv = z + 8;

	return height
		.flatMap((line, y) => {
			return line.map((height, x) => {
				const { r, g, b } = colors[tile_size * y + x] || { r: 0, g: 0, b: 0 };

				// 有効な値でなければnullを返す
				if (Number.isNaN(height)) return null;

				// タイル原点からの相対座標からピクセル座標を計算
				const pixel_x = originX + x;
				const pixel_y = originY + y;

				// 赤道の長さ [m]
				const equatorLength = 40075_000;

				// 簡易的な1ピクセルの分解能 [m]
				// 実際は緯度によって変化するため、本番の実装では正確な値を使う
				const pixelResolution = equatorLength / 2 ** pixel_zoom_lv;

				// 高さの分解能をピクセルの分解能に合わせる
				const voxelizedHeight =
					Math.round(height / pixelResolution) * pixelResolution;

				// ピクセル座標からQuadKeyを計算
				const quadKey = tileXYToQuadKey(pixel_x, pixel_y, pixel_zoom_lv);

				return { height: voxelizedHeight, quadKey, r, g, b };
			});
		})
		.filter((v) => v !== null) as Pixel[];
}

// ボクセルタイルを生成
async function createVoxelTile(
	z: number,
	x: number,
	y: number,
): Promise<Pixel[] | null> {
	const height = await fetchHeightTile(z, x, y);
	const colors = await fetchColorTile(z, x, y);

	if (height === null || colors === null) {
		return null;
	}

	return joinHeightAndColor(x, y, z, height, colors);
}

/**
 * タイルのXY座標を指定された詳細レベルのQuadKeyに変換
 * 参考: https://learn.microsoft.com/en-us/bingmaps/articles/bing-maps-tile-system?redirectedfrom=MSDN
 *
 * @param tileX タイルのX座標
 * @param tileY タイルのY座標
 * @param levelOfDetail 詳細レベル、1（最低詳細）から23（最高詳細）まで
 * @returns QuadKeyを含む文字列
 */
function tileXYToQuadKey(
	tileX: number,
	tileY: number,
	levelOfDetail: number,
): string {
	let quadKey = "";
	for (let i = levelOfDetail; i > 0; i--) {
		let digit = "0";
		const mask = 1 << (i - 1);
		if ((tileX & mask) !== 0) {
			digit = String.fromCharCode(digit.charCodeAt(0) + 1);
		}
		if ((tileY & mask) !== 0) {
			digit = String.fromCharCode(digit.charCodeAt(0) + 1);
			digit = String.fromCharCode(digit.charCodeAt(0) + 1);
		}
		quadKey += digit;
	}
	return quadKey;
}
