import { describe, expect, it, vi } from 'vitest';
import { GameState } from '@oc/shared';
import type { GameRoom } from '@prisma/client';
import { generateRoomCode, isWeakCode, RoomsService } from './rooms.service';
import { mockPrisma } from '../games/testing/prisma-mock';
import type { GameEventsService } from '../websocket/game-events.service';

const HOUR = 60 * 60 * 1000;

function room(over: Partial<GameRoom> = {}): GameRoom {
  return {
    id: 'r1', code: '482913', teacherId: 't1', classroomId: null, className: 'ג1', state: GameState.WAITING_FOR_PLAYERS, joinOpen: true,
    settings: {}, mode: 'SELF_PACED', currentSessionId: 's1', createdAt: new Date(Date.now() - 30 * HOUR), updatedAt: new Date(),
    expiresAt: new Date(Date.now() - HOUR), deletedAt: null, ...over,
  } as GameRoom;
}

function build() {
  const prisma = mockPrisma({
    gameRoom: { updateMany: vi.fn(async () => ({ count: 1 })), findMany: vi.fn(async () => [{ id: 'r1' }]) },
    gameSession: { findMany: vi.fn(async () => [{ id: 's1' }]), updateMany: vi.fn(async () => ({ count: 1 })) },
    auditLog: { create: vi.fn(async () => ({})) },
  });
  const events = { toRoom: vi.fn(), toParticipant: vi.fn(), toTeacher: vi.fn(), disconnectParticipant: vi.fn(), disconnectRoom: vi.fn() };
  const service = new RoomsService(prisma, events as unknown as GameEventsService);
  vi.spyOn(service, 'emitRoomUpdated').mockResolvedValue(null);
  return { service, prisma, events };
}

describe('room codes', () => {
  it('are 6 digits, never sequential/repeated, and vary between calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const code = generateRoomCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(isWeakCode(code)).toBe(false);
      codes.add(code);
    }
    expect(codes.size).toBeGreaterThan(450);
  });

  it('flags weak codes', () => {
    for (const weak of ['000000', '111111', '123456', '654321', '456789', '901234', '098765']) expect(isWeakCode(weak)).toBe(true);
    for (const fine of ['482913', '120456', '135790']) expect(isWeakCode(fine)).toBe(false);
  });
});

describe('RoomsService.expireIfStale', () => {
  it('marks a 24h-old room and its non-final sessions EXPIRED, closes joining and notifies the room', async () => {
    const { service, prisma, events } = build();
    const result = await service.expireIfStale(room());
    expect(result.state).toBe(GameState.EXPIRED);
    expect(result.joinOpen).toBe(false);
    expect(prisma.gameRoom.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'r1', state: { notIn: [GameState.CANCELLED, GameState.EXPIRED] } }),
      data: { state: GameState.EXPIRED, joinOpen: false },
    }));
    expect(prisma.gameSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['s1'] } },
      data: expect.objectContaining({ state: GameState.EXPIRED }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'ROOM_EXPIRED' }) }));
    expect(events.toRoom).toHaveBeenCalledWith('r1', 'error:message', expect.objectContaining({ code: 'ROOM_EXPIRED' }));
  });

  it('leaves fresh rooms and terminal rooms untouched (no DB writes)', async () => {
    const { service, prisma } = build();
    const fresh = room({ expiresAt: new Date(Date.now() + HOUR) });
    expect(await service.expireIfStale(fresh)).toBe(fresh);
    const cancelled = room({ state: GameState.CANCELLED });
    expect(await service.expireIfStale(cancelled)).toBe(cancelled);
    expect(prisma.gameRoom.updateMany).not.toHaveBeenCalled();
  });

  it('is race-safe: a concurrent expiry (count 0) does not re-notify', async () => {
    const { service, prisma, events } = build();
    prisma.gameRoom.updateMany.mockResolvedValueOnce({ count: 0 });
    await service.expireIfStale(room());
    expect(events.toRoom).not.toHaveBeenCalled();
    expect(prisma.gameSession.updateMany).not.toHaveBeenCalled();
  });

  it('expireStaleRooms sweeps every stale room and reports the session ids for timer cleanup', async () => {
    const { service, prisma } = build();
    const result = await service.expireStaleRooms();
    expect(prisma.gameRoom.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ deletedAt: null, expiresAt: { lte: expect.any(Date) } }),
    }));
    expect(result).toEqual({ roomIds: ['r1'], sessionIds: ['s1'] });
  });
});
