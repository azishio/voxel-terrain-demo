"use client";

import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

export default function Home() {
	const mapContainerRef = useRef<HTMLInputElement>(null);
	const mapRef = useRef<HTMLInputElement>(null);
	const [long, setLong] = useState(0);
	const [lat, setLat] = useState(0);
	const [zoom, setZoom] = useState(1);

	useEffect(() => {
		if (mapRef.current) return;

		mapRef.current = new maplibregl.Map({
			container: mapContainerRef.current as HTMLElement,
			style: "https://demotiles.maplibre.org/style.json",
			center: [long, lat],
			zoom: zoom,
		});
		mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");
	}, [long, lat, zoom]);

	return (
		<main>
			<div
				ref={mapRef}
				style={{ height: "100%", width: "100%" }}
				className="map"
			/>
			<div>
				{long}_{lat}_{zoom}
			</div>
		</main>
	);
}
