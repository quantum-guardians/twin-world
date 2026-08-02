/**
 * Social Force Model constants, ported from simulation_react's
 * src/simulation/presets.ts (see docs/agent-movement.md). That project
 * worked in canvas pixels at a fixed 20 px/m scale; twin-world's venue
 * coordinates are meters directly (scaleMetersPerUnit), so every constant
 * below has been converted by dimensional analysis rather than copied
 * as-is:
 *   - pure lengths and velocities (px, px/s) -> divide by 20
 *   - pure accelerations (px/s²) -> divide by 20
 *   - ratios where the same length unit appears top and bottom (e.g.
 *     SFM_K_BODY, an accel-per-meter-of-overlap) -> unchanged, the scale
 *     factor cancels
 *   - SFM_KAPPA has one length power in the denominator only
 *     (accel = KAPPA * overlap[length] * relSpeed[length/time]) -> multiply
 *     by 20
 *   - times, tick counts, and dimensionless ratios/fractions -> unchanged
 * Values are re-derived, not guessed: AGENT_MAX_SPEED converts to 1.25 m/s,
 * matching typical adult walking speed, which is a good sanity check that
 * the conversion is right.
 */

export const AGENT_RADIUS = 0.2; // m (was 4 px)
export const AGENT_MAX_SPEED = 1.25; // m/s (was 25 px/s)
export const ARRIVAL_RADIUS = 0.5; // m (was 10 px)
/** Offset from the corridor centerline used for right-hand traffic. */
export const AGENT_LANE_OFFSET = 0.25; // m (was 5 px)

export const DEFAULT_AGENT_COUNT = 150;
export const ADD_AGENTS_BATCH_SIZE = 5;
export const ADD_AGENTS_BATCH_INTERVAL_MS = 200;
export const RESPAWN_BATCH_SIZE = 3;

// ---------------------------------------------------------------------------
// Social Force Model (Helbing & Molnár).
// ---------------------------------------------------------------------------

export const SFM_TAU = 0.5; // s
export const SFM_A_AGENT = 15; // m/s² (was 300 px/s²)
export const SFM_B_AGENT = 0.2; // m (was 4 px)
export const SFM_A_WALL = 25; // m/s² (was 500 px/s²)
export const SFM_B_WALL = 0.2; // m (was 4 px)
export const SFM_K_BODY = 700; // 1/s², unit-invariant under rescale
export const SFM_KAPPA = 600; // 1/(m*s) (was 30 1/(px*s))
export const SFM_MAX_ACCEL = 125; // m/s² (was 2500 px/s²)
export const SFM_SPEED_FACTOR = 1.3;
export const SFM_CUTOFF_FACTOR = 5;
export const SFM_ANISOTROPY_LAMBDA = 0.5;

export const AGENT_SPEED_VARIANCE_MIN = 0.82;
export const AGENT_SPEED_VARIANCE_MAX = 1.18;

// ---------------------------------------------------------------------------
// Impatience ("faster is slower" clog-breaking).
// ---------------------------------------------------------------------------

export const STUCK_SPEED_FRACTION = 0.3;
export const STUCK_PATIENCE_TICKS = 90; // 1.5 s @ 60 Hz
export const STUCK_RAMP_TICKS = 120; // 2 s @ 60 Hz
export const STUCK_BOOST_MAX = 1;
export const STUCK_SOCIAL_FORCE_MIN = 0;
export const STUCK_JITTER_MAX_RAD = Math.PI / 8; // 22.5 deg

// ---------------------------------------------------------------------------
// Crowd-pressure exposure model. Relative risk indicator only - see plan's
// "고압력 위험 노출" framing, not a real injury/fatality predictor.
// ---------------------------------------------------------------------------

export const PRESSURE_CONTACT_RANGE_PX = 0.15; // m (was 3 px)
export const PRESSURE_DEATH_THRESHOLD = 3.5; // dimensionless compression ratio, unchanged
export const PRESSURE_DEATH_SECONDS = 3;
export const PRESSURE_RECOVERY_RATE = 3;

// ---------------------------------------------------------------------------
// Agent visual sizing. Deliberately exaggerated beyond real human
// proportions and kept entirely separate from AGENT_RADIUS above, which
// stays the tuned/tested SFM collision radius - changing that would ripple
// into every already-validated physics constant. At a venue that can span
// hundreds of meters, real 1.6-1.9 m humans read as invisible dots from the
// default overview camera, so rendered agents are scaled up for legibility.
// Height also varies per agent (child vs. adult) purely for visual variety;
// it has no effect on speed, radius, or any other physics quantity.
// ---------------------------------------------------------------------------

/** Fraction of spawned agents rendered as children rather than adults. */
export const AGENT_CHILD_FRACTION = 0.12;

// First pass (2.2-2.8 m adults) was still unreadable at the default
// overview distance covering a venue that can span hundreds of meters -
// bumped roughly 3x so agents show up as clearly visible colored figures
// rather than a few near-invisible pixels.
export const AGENT_RENDER_HEIGHT_ADULT_MIN = 6.0; // m, exaggerated for visibility
export const AGENT_RENDER_HEIGHT_ADULT_MAX = 7.5;
export const AGENT_RENDER_HEIGHT_CHILD_MIN = 3.2;
export const AGENT_RENDER_HEIGHT_CHILD_MAX = 4.2;

/** Rendered capsule radius at AGENT_RENDER_HEIGHT_ADULT_MAX; scaled down
 * proportionally for shorter agents so bodies stay human-shaped rather than
 * uniformly fat. Independent of (and larger than) the physics AGENT_RADIUS. */
export const AGENT_RENDER_RADIUS_AT_MAX_HEIGHT = 1.6;

/** Eye height as a fraction of an agent's own renderHeightM, used to
 * position the first-person "에이전트 시점" camera. A fixed real-world
 * value (~1.65 m) would put the viewer's eye far below neighboring
 * agents' now-exaggerated ~6-7.5 m bodies, making everyone else look like
 * giants; scaling with the same render exaggeration keeps the crowd
 * proportioned normally from inside it. 0.93 matches the typical human
 * eye-to-height ratio. */
export const AGENT_EYE_HEIGHT_RATIO = 0.93;
