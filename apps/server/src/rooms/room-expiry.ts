import { GameState } from '@oc/shared';
import { ROOM_TTL_MS } from '../games/game-constants';

/** States in which a room is already closed for good – expiry never touches them. */
export const TERMINAL_ROOM_STATES: readonly GameState[] = [GameState.CANCELLED, GameState.EXPIRED];

export interface RoomExpiryFields {
  state: GameState | string;
  createdAt: Date;
  expiresAt: Date | null;
}

/** Effective expiry timestamp: `expiresAt` when set, otherwise `createdAt + ROOM_TTL_MS` (rows created before the column was used). */
export function roomExpiresAt(room: Pick<RoomExpiryFields, 'createdAt' | 'expiresAt'>): number {
  return room.expiresAt?.getTime() ?? room.createdAt.getTime() + ROOM_TTL_MS;
}

/** True when the room should be treated as EXPIRED (older than its TTL and not already terminal). */
export function isRoomStale(room: RoomExpiryFields, now: number = Date.now()): boolean {
  if (TERMINAL_ROOM_STATES.includes(room.state as GameState)) return false;
  return roomExpiresAt(room) <= now;
}

export function nextRoomExpiry(now: number = Date.now()): Date {
  return new Date(now + ROOM_TTL_MS);
}
