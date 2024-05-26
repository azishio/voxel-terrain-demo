"use client";

import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import { MapView, QuadkeyLayer } from "deck.gl";
import React from "react";

export default function App() {
	const layer = [
		new TileLayer({
			id: "TileLayer",
			data: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
			maxZoom: 18,
			minZoom: 2,

			renderSubLayers: (props) => {
				const { boundingBox } = props.tile;

				return new BitmapLayer(props, {
					image: props.data,
					// ここを省略するとエラー
					data: null as unknown as undefined,
					bounds: [
						boundingBox[0][0],
						boundingBox[0][1],
						boundingBox[1][0],
						boundingBox[1][1],
					],
				});
			},
			pickable: true,
		}),
		new TileLayer({
			id: "height",
			maxZoom: 12,
			minZoom: 10,
			getTileData: async (tile) => {
				const { z, x, y } = tile.index;
				const height_res = await fetch(
					// テキスト形式のタイル
					// 本番は軽量なpng形式を使う
					`https://cyberjapandata.gsi.go.jp/xyz/dem5a/${z}/${x}/${y}.txt`,
				);

				const color_res = await fetch(
					`https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/${z}/${x}/${y}.jpg`,
				);

				const blob = await color_res.blob();
				// BlobをImageオブジェクトに変換
				const img = await createImageBitmap(blob);

				// Canvasを作成して画像を描画
				const canvas = document.createElement("canvas");
				canvas.width = img.width;
				canvas.height = img.height;
				const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
				ctx.drawImage(img, 0, 0);

				// CanvasからImageDataを取得
				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				const pixels = imageData.data;
				// 各画素の色情報を配列として取り出す
				const colors: { r: number; g: number; b: number; a: number }[] = [];
				for (let i = 0; i < pixels.length; i += 4) {
					const r = pixels[i];
					const g = pixels[i + 1];
					const b = pixels[i + 2];
					const a = pixels[i + 3];
					colors.push({ r, g, b, a });
				}

				console.log(colors);

				if (tile.signal?.aborted) {
					console.log("aborted");
					return null;
				}

				const height = (await height_res.text())
					.split("\n")
					.map((line) => line.split(",").map((v) => Number.parseFloat(v)));

				const tile_size = 2 ** 8;
				const originX = x * tile_size;
				const originY = y * tile_size;
				const pixel_zoom_lv = z + 8;

				const c = height
					.flatMap((line, y) =>
						line.map((height, x) => {
							if (Number.isNaN(height)) return null;

							// heightを整数値に変換
							const heightInt = Math.round(height);

							const pixel_x = originX + x;
							const pixel_y = originY + y;

							const quadKey = tileXYToQuadKey(pixel_x, pixel_y, pixel_zoom_lv);

							const { r, g, b } = colors[256 * y + x];

							return { height: heightInt, quadKey, r, g, b };
						}),
					)
					.filter((v) => v !== null) as { height: number; quadKey: string }[];
				return c;
			},
			renderSubLayers: (props) => {
				console.log(props);
				return new QuadkeyLayer(props, {
					data: props.data,
					elevationScale: 1,
					extruded: true,
					getQuadkey: (d) => d.quadKey,
					getElevation: (d) => d.height,
					getFillColor: (d) => [d.r, d.g, d.b],
					pickable: true,
				});
			},
		}),
	];

	return (
		<DeckGL
			initialViewState={{
				longitude: 140,
				latitude: 40,
				zoom: 5,
			}}
			controller
			views={new MapView({ controller: true })}
			layers={layer}
		/>
	);
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
