import assert from "node:assert/strict";
import test from "node:test";
import { combineStations, haversineKm, mapsRouteLink, parseStations, stationLabel } from "./stations.ts";

test("v0.12: OSM fuel rows become stations; names without brands are kept", () => {
  const data = {
    elements: [
      { type: "node", id: 1, lat: 12.97, lon: 77.6, tags: { amenity: "fuel", name: "Shell HSR", brand: "Shell" } },
      { type: "node", id: 2, lat: 12.98, lon: 77.61, tags: { amenity: "fuel" } },
      { type: "node", id: 3, lat: 12.99, lon: 77.62, tags: { amenity: "fuel", brand: "IndianOil" } },
      { type: "way", id: 4, tags: { amenity: "fuel" } },
    ],
  };
  const list = parseStations(data, 12.97, 77.6);
  assert.deepEqual(list.map((s) => s.name), ["Shell HSR", "IndianOil fuel"]);
});

test("v0.12: favorites and COCO come first, then the map by distance", () => {
  const fetched = [
    { id: "osm-far", name: "Far bunk", lat: 1.1, lon: 1.1 },
    { id: "osm-near", name: "Near bunk", lat: 1.01, lon: 1.01 },
  ];
  const saved = [
    { id: "osm-far", name: "Far bunk", lat: 1.1, lon: 1.1, favorite: true },
    { id: "own-1", name: "COCO by the toll", lat: 1.2, lon: 1.2, coco: true },
  ];
  const list = combineStations(saved, fetched, { lat: 1.0, lon: 1.0 });
  assert.deepEqual(list.map((s) => s.name), ["Far bunk", "COCO by the toll", "Near bunk"]);
  const distance = haversineKm(12.9712, 77.6413, 12.9712, 77.645);
  assert.ok(distance > 0.4 && distance < 1, `got ${distance}`);
});

test("v0.12: the Maps link opens a route preview to the pin, not walking or searching", () => {
  assert.equal(mapsRouteLink({ lat: 12.971, lon: 77.643 }), "https://www.google.com/maps/dir/?api=1&destination=12.971,77.643&travelmode=driving");
  assert.equal(stationLabel({ id: "s", name: "Five bunk", favorite: true }), "★ Five bunk");
  assert.equal(stationLabel({ id: "s", name: "Relay pump", coco: true }), "Relay pump (COCO)");
});
