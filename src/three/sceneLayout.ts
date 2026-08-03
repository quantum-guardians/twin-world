/** Vertical layout shared by the scene's large flat surfaces.
 *
 * The ground plane sits well below the street slab (StreetFloor's 0.15 m
 * boxes on y=0) instead of just under it: both are wide parallel surfaces
 * viewed at grazing angles across a venue that can span hundreds of meters,
 * and at that distance a small gap is not representable in the depth buffer,
 * which showed up as the road surface flickering. Building blocks extend
 * down to the same level so the extra gap never reads as floating geometry.
 */
export const GROUND_Y = -1;
