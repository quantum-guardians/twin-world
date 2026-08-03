/**
 * Daylight palette for the 3D venue, the scene-side counterpart to the CSS
 * tokens in src/styles/app.css (three.js materials cannot read CSS custom
 * properties, so the two files are kept deliberately in step).
 *
 * Blue sky, green field, mixed building materials, and the street network cut
 * into it as a dark ribbon. The scene renders without a shadow pass, so form
 * comes from that tonal jump between the pale ground and the dark street plus
 * the variation between neighbouring blocks. Saturated signal color still
 * belongs to data alone - density ramp, bottleneck flash, the crowd.
 */

export const SKY_COLOR = "#bfe0f2";
export const GROUND_COLOR = "#d9eda4";
export const STREET_COLOR = "#5b6068";

/** Facade colors drawn from ordinary building materials - concrete, cream
 * plaster, brick, sandstone, glass-and-steel - rather than a decorative
 * spread, so a block of them still reads as a city. Assigned by index, which
 * is stable across re-renders because the layout is deterministic. */
export const BUILDING_PALETTE = [
  "#cfccc6", // concrete
  "#ded8ca", // cream plaster
  "#c3a79b", // brick
  "#d6c9b1", // sandstone
  "#bcc4c9", // glass and steel
  "#b09a90", // dark brick
  "#c7cbc4", // weathered render
];

/** Near-white crowd over the dark street: the highest-contrast pairing in
 * the scene, so individual people stay visible while the density tint
 * underneath them still shows through. */
export const AGENT_COLOR_MOVING = "#f7f9fb";
export const AGENT_COLOR_ARRIVED = "#8d97a3";
export const AGENT_COLOR_DEAD = "#e0322b";
/** Dark enough to read as hair against the near-white bodies at overview
 * distance, warm enough not to look like a black hole in the crowd. */
export const AGENT_COLOR_HAIR = "#2f2620";

export const BOTTLENECK_COLOR = "#ff2d2d";
