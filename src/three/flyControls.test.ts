import { describe, expect, it } from "vitest";
import { AXIS_BY_KEY, BOOST_KEYS, flySpeed, isTypingTarget } from "./flyControls";

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

  it("multiplies by the toolbar speed scale", () => {
    expect(flySpeed(20, false, 0.25)).toBe(flySpeed(20, false) * 0.25);
    expect(flySpeed(20, true, 4)).toBe(flySpeed(20, true) * 4);
  });

  it("multiplies by the boost factor", () => {
    expect(flySpeed(20, true)).toBe(flySpeed(20, false) * 3);
  });
});

describe("AXIS_BY_KEY", () => {
  it("maps the up and down keys to opposite vertical directions", () => {
    expect(AXIS_BY_KEY.Space[2]).toBe(1);
    expect(AXIS_BY_KEY.KeyE[2]).toBe(1);
    expect(AXIS_BY_KEY.KeyQ[2]).toBe(-1);
  });

  it("keeps Ctrl unbound so Ctrl+W cannot close the tab", () => {
    expect(AXIS_BY_KEY.ControlLeft).toBeUndefined();
    expect(BOOST_KEYS.has("ControlLeft")).toBe(false);
  });

  it("ignores keys typed into text fields but not the canvas", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(isTypingTarget({ tagName } as unknown as EventTarget)).toBe(true);
    }
    expect(isTypingTarget({ isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "CANVAS" } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it("keeps horizontal keys purely horizontal", () => {
    for (const code of ["KeyW", "KeyS", "KeyA", "KeyD"]) {
      expect(AXIS_BY_KEY[code][2]).toBe(0);
    }
  });
});
