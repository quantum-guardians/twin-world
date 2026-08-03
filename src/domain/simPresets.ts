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

export const DEFAULT_AGENT_COUNT = 150;
export const ADD_AGENTS_BATCH_SIZE = 5;
export const ADD_AGENTS_BATCH_INTERVAL_MS = 200;
export const RESPAWN_BATCH_SIZE = 3;

// ---------------------------------------------------------------------------
// Vision-based steering heuristics (Moussaïd, Helbing & Theraulaz 2011,
// PNAS 108(17), doi:10.1073/pnas.1016507108). Replaces the exponential
// psychological repulsion of classic Helbing SFM: each agent picks the
// direction in its field of vision that minimizes anticipated detour given
// the distance-to-collision f(α), and walks no faster than it could stop
// within (v = min(v0, f/τ)). Physical contact forces below are unchanged.
// ---------------------------------------------------------------------------

/** Half-angle of the field of vision around the goal direction (paper: 75°). */
export const VISION_PHI_RAD = (75 * Math.PI) / 180;
/** Horizon dmax: collisions farther than this are ignored (paper: ~8-10 m). */
export const VISION_HORIZON_M = 8;
/** Candidate directions sampled across the vision field (odd → includes α0). */
export const VISION_RAY_COUNT = 21;
/** Physics ticks a chosen direction stays cached before re-planning (6 ticks
 * = 100 ms @ 60 Hz, on the order of human steering reaction time). */
export const VISION_DECISION_INTERVAL_TICKS = 6;
/** Nearest neighbors within the horizon considered per decision. */
export const VISION_NEIGHBOR_MAX = 12;
/** Multiplicative cost discount for rightward rays. Breaks perfectly
 * symmetric head-on ties deterministically and encodes the right-hand
 * walking norm that the removed lane-offset hack used to hard-code. */
export const VISION_RIGHT_BIAS = 0.02;

// ---------------------------------------------------------------------------
// Physical contact forces (Helbing, Farkas & Vicsek 2000, Nature 407).
// These act only when bodies/walls actually touch and are the source of the
// crowd-crush pressure metric - never removed or scaled by steering.
// ---------------------------------------------------------------------------

export const SFM_TAU = 0.5; // s, driving-force relaxation & stopping time τ
export const SFM_K_BODY = 700; // 1/s², unit-invariant under rescale
export const SFM_KAPPA = 600; // 1/(m*s) (was 30 1/(px*s))
export const SFM_MAX_ACCEL = 125; // m/s² numeric-stability clamp
/** Absolute velocity cap (numeric safety only). Deliberately far above
 * walking speed so dense-crowd contact forces can shove people around -
 * crowd turbulence - instead of being clipped at 1.3× desired speed. */
export const MAX_PHYSICAL_SPEED = 5; // m/s

export const AGENT_SPEED_VARIANCE_MIN = 0.82;
export const AGENT_SPEED_VARIANCE_MAX = 1.18;

// ---------------------------------------------------------------------------
// Urgency (rushing/panic). Moussaïd et al. 2011 reproduce crowd disasters
// not at normal walking parameters but when pedestrians rush: desired
// speed rises and people keep pressing forward into contact instead of
// stopping politely. Urgency ∈ [0, 1] scales exactly that. At 0 the crowd
// is calm and self-limiting; toward 1, sustained pushing loads the contact
// springs row by row and crush pressure becomes reachable at bottlenecks.
// ---------------------------------------------------------------------------

/** Desired-speed multiplier at full urgency (1.25 m/s walk → ~2.2 m/s rush). */
export const URGENCY_SPEED_MULTIPLIER = 1.8;
/** Forward pressing speed at full urgency: blocked agents keep shoving at
 * this floor instead of stopping, transmitting force through the crowd.
 * People caught in real crushes are moved involuntarily at ~1 m/s. */
export const URGENCY_PRESS_SPEED = 0.8; // m/s
/** Above this urgency agents stop politely sidestepping when boxed in. */
export const URGENCY_NO_YIELD_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Crowd-pressure exposure model. Relative risk indicator only - see plan's
// "고압력 위험 노출" framing, not a real injury/fatality predictor.
//
// Measured from body *overlap* (compression depth), not proximity: under
// the vision-heuristic steering model a calm standing crowd naturally
// packs to touching distance (gap ≈ 0), which is harmless. Danger begins
// when driving forces squeeze bodies into each other - exactly the regime
// where the contact springs in socialForce.ts carry sustained load.
// ---------------------------------------------------------------------------

/** Overlap depth at which one contact counts as a full unit of crushing
 * compression. Calibrated to what sustained pushing can actually maintain:
 * positional overlap resolution wipes interpenetration every tick, so the
 * steady-state overlap a shoving neighbor re-creates per 60 Hz tick is
 * press-speed/60 ≈ 13 mm - a calm crowd's transient jostle stays well
 * under this, several simultaneous shoved contacts clear the death
 * threshold. */
export const PRESSURE_OVERLAP_FULL_M = 0.015;
// Calibrated against measured extremes on the Busan preset (1500 agents,
// 3 sim-minutes): calm crowds peak near 1.6, full-urgency crushes reach
// ~3.5 momentarily. 2.5 sits between - unreachable when walking calmly,
// held long enough to kill only inside a genuinely loaded crush.
export const PRESSURE_DEATH_THRESHOLD = 2.5;
export const PRESSURE_DEATH_SECONDS = 3;
export const PRESSURE_RECOVERY_RATE = 3;

// ---------------------------------------------------------------------------
// Agent visual sizing. The rendered capsule footprint uses each body's
// physics radius (AGENT_RADIUS) directly, so what you see is exactly the
// shoulder width the SFM collides with - capsules touch when bodies touch
// instead of interpenetrating in dense crowds. Heights are realistic human
// heights to match that footprint. Height varies per agent (child vs.
// adult) purely for visual variety; it has no effect on speed, radius, or
// any other physics quantity.
// ---------------------------------------------------------------------------

/** Fraction of spawned agents rendered as children rather than adults. */
export const AGENT_CHILD_FRACTION = 0.12;

export const AGENT_RENDER_HEIGHT_ADULT_MIN = 1.6; // m, realistic human heights
export const AGENT_RENDER_HEIGHT_ADULT_MAX = 1.9;
export const AGENT_RENDER_HEIGHT_CHILD_MIN = 1.1;
export const AGENT_RENDER_HEIGHT_CHILD_MAX = 1.4;

/** Eye height as a fraction of an agent's own renderHeightM, used to
 * position the first-person "에이전트 시점" camera. 0.93 matches the
 * typical human eye-to-height ratio. */
export const AGENT_EYE_HEIGHT_RATIO = 0.93;
