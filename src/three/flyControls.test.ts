import { describe, expect, it } from "vitest";
import { AXIS_BY_KEY, flySpeed } from "./flyControls";

describe("flySpeed", () => {
  it("keeps the base speed at and below street level", () => {
    expect(flySpeed(1.6, false)).toBe(30);
    expect(flySpeed(20, false)).toBe(30);
  });

  it("scales with altitude so overview-height flying is not crawling", () => {
    expect(flySpeed(100, false)).toBeGreaterThan(flySpeed(20, false));
  });

  it("caps the altitude scale", () => {
    expect(flySpeed(10_000, false)).toBe(flySpeed(160, false));
  });

  it("multiplies by the boost factor", () => {
    expect(flySpeed(20, true)).toBe(flySpeed(20, false) * 3);
  });
});

describe("AXIS_BY_KEY", () => {
  it("maps Space and Shift to opposite vertical directions", () => {
    expect(AXIS_BY_KEY.Space[2]).toBe(1);
    expect(AXIS_BY_KEY.ShiftLeft[2]).toBe(-1);
    expect(AXIS_BY_KEY.ShiftRight[2]).toBe(-1);
  });

  it("keeps horizontal keys purely horizontal", () => {
    for (const code of ["KeyW", "KeyS", "KeyA", "KeyD"]) {
      expect(AXIS_BY_KEY[code][2]).toBe(0);
    }
  });
});
