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

			getTileData: async ({ index }) => {
				const { x, y, z } = index;
				return fetch(
					`http://localhost:3000/api/voxel-tile/${z}/${x}/${y}`,
				).then(async (res) => {
					return await res.json();
				});
			},
			renderSubLayers: (props) => {
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
