/**
 * Drag-and-drop id encoding for Feature 1 (see docs/DESIGN.md §4).
 *
 * Draggable ids:  `member:<memberId>:from:<containerId>`
 * Droppable ids:  `pool` | `car:<carId>:driver` | `car:<carId>:passenger` | `spot:<spotId>`
 */
import type { CarRole, ID } from '../../types';

export const POOL_ID = 'pool';

/** Matches the Mantine `md` breakpoint (62em) used to switch pool layout / sidebar stickiness. */
export const DESKTOP_QUERY = '(min-width: 62em)';

export type ContainerId =
  | { type: 'pool' }
  | { type: 'car'; carId: ID; role: CarRole }
  | { type: 'spot'; spotId: ID };

export function carContainerId(carId: ID, role: CarRole): string {
  return `car:${carId}:${role}`;
}

export function spotContainerId(spotId: ID): string {
  return `spot:${spotId}`;
}

/** Parses a droppable container id. Falls back to `pool` for anything unrecognized. */
export function parseContainerId(id: string): ContainerId {
  if (id === POOL_ID) return { type: 'pool' };
  const carMatch = /^car:(.+):(driver|passenger)$/.exec(id);
  if (carMatch) return { type: 'car', carId: carMatch[1], role: carMatch[2] as CarRole };
  const spotMatch = /^spot:(.+)$/.exec(id);
  if (spotMatch) return { type: 'spot', spotId: spotMatch[1] };
  return { type: 'pool' };
}

export function memberDraggableId(memberId: ID, fromContainerId: string): string {
  return `member:${memberId}:from:${fromContainerId}`;
}

export function parseMemberDraggableId(id: string): { memberId: ID; fromContainerId: string } | null {
  const match = /^member:([^:]+):from:(.+)$/.exec(id);
  if (!match) return null;
  return { memberId: match[1], fromContainerId: match[2] };
}
