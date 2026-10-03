import assert from "node:assert/strict";
import test from "node:test";
import { bodiesFor } from "./life.ts";
import { markFor } from "./vehicleMarks.ts";

test("a bike mark is a bike and does not reuse a car mark", () => {
  const bikes = bodiesFor("bike").map((body) => markFor(body));
  const cars = bodiesFor("car").map((body) => markFor(body));
  assert.ok(bikes.length >= 4);
  assert.ok(cars.length >= 4);
  for (const bike of bikes) {
    assert.equal(bike.role, "bike");
    assert.equal(bike.cabin, null);
    assert.ok(bike.bars);
    assert.ok(bike.wheel.r >= 11);
    assert.match(bike.id, /^bike-/);
    for (const car of cars) {
      assert.notEqual(bike.id, car.id);
      assert.notEqual(JSON.stringify(bike), JSON.stringify(car));
      assert.notDeepEqual(bike.strokes, car.strokes);
    }
  }
  for (const car of cars) {
    assert.equal(car.role, "car");
    assert.equal(car.bars, null);
    assert.ok(car.cabin);
    assert.ok(car.wheel.r <= 9);
    assert.match(car.id, /^car-/);
  }
  const ids = new Set([...bikes, ...cars].map((mark) => mark.id));
  assert.equal(ids.size, bikes.length + cars.length);
});
