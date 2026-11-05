import { describe, expect, it } from 'vitest';
import { GameState } from '@oc/shared';
import { isRoomStale, nextRoomExpiry, roomExpiresAt } from './room-expiry';
import { ROOM_TTL_MS } from '../games/game-constants';

const NOW = Date.UTC(2026, 0, 2, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

describe('room expiry (24h TTL)', () => {
  it('uses expiresAt when present, otherwise createdAt + TTL', () => {
    expect(roomExpiresAt({ expiresAt: new Date(NOW + HOUR), createdAt: new Date(NOW - 30 * HOUR) })).toBe(NOW + HOUR);
    expect(roomExpiresAt({ expiresAt: null, createdAt: new Date(NOW) })).toBe(NOW + ROOM_TTL_MS);
    expect(roomExpiresAt({})).toBeNull();
  });

  it('marks rooms past their expiry as stale, but never terminal ones', () => {
    expect(isRoomStale({ state: GameState.WAITING_FOR_PLAYERS, expiresAt: new Date(NOW - 1) }, NOW)).toBe(true);
    expect(isRoomStale({ state: GameState.QUESTION_ACTIVE, expiresAt: new Date(NOW) }, NOW)).toBe(true);
    expect(isRoomStale({ state: GameState.COMPLETED, expiresAt: new Date(NOW - HOUR) }, NOW)).toBe(true);
    expect(isRoomStale({ state: GameState.WAITING_FOR_PLAYERS, expiresAt: new Date(NOW + 1) }, NOW)).toBe(false);
    expect(isRoomStale({ state: GameState.WAITING_FOR_PLAYERS, expiresAt: null, createdAt: new Date(NOW - 25 * HOUR) }, NOW)).toBe(true);
    expect(isRoomStale({ state: GameState.WAITING_FOR_PLAYERS, expiresAt: null, createdAt: new Date(NOW - 23 * HOUR) }, NOW)).toBe(false);
    expect(isRoomStale({ state: GameState.EXPIRED, expiresAt: new Date(NOW - HOUR) }, NOW)).toBe(false);
    expect(isRoomStale({ state: GameState.CANCELLED, expiresAt: new Date(NOW - HOUR) }, NOW)).toBe(false);
  });

  it('is lenient with partial rows (unit-test mocks without dates are never stale)', () => {
    expect(isRoomStale({ state: GameState.QUESTION_ACTIVE }, NOW)).toBe(false);
  });

  it('nextRoomExpiry is exactly 24 hours ahead', () => {
    expect(nextRoomExpiry(NOW).getTime()).toBe(NOW + 24 * HOUR);
  });
});
