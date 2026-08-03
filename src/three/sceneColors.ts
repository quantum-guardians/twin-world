/**
 * Daylight palette for the 3D venue, the scene-side counterpart to the CSS
 * tokens in src/styles/app.css (three.js materials cannot read CSS custom
 * properties, so the two files are kept deliberately in step).
 *
 * The scene is built on one strong contrast rather than a spread of tones:
 * a pale field (ground, then buildings one step darker) with the walkable
 * street network cut into it as a dark ribbon. Everything structural is
 * neutral; saturated color belongs to data alone - the density ramp, the
 * bottleneck flash, the crowd itself - and it reads loudest over that dark
 * street. Earlier warm-grey variants of this palette turned to mud, since
 * the scene renders without shadows and needs the tonal jump to give form.
 */

export const SKY_COLOR = "#eef2f5";
export const GROUND_COLOR = "#e4e5e1";
export const STREET_COLOR = "#3f4854";

/** Small deterministic lightness variation per building so a whole block
 * doesn't read as one flat slab, all within one step of the ground. */
export const BUILDING_PALETTE = ["#d3d2cc", "#cbcac3", "#dad9d3", "#c4c3bc", "#cfcec7"];

/** Near-white crowd over the dark street: the highest-contrast pairing in
 * the scene, so individual people stay visible while the density tint
 * underneath them still shows through. */
export const AGENT_COLOR_MOVING = "#f7f9fb";
export const AGENT_COLOR_ARRIVED = "#8d97a3";
export const AGENT_COLOR_DEAD = "#e0322b";

export const BOTTLENECK_COLOR = "#ff2d2d";
