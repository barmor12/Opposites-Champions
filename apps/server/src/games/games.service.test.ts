import { describe, expect, it, vi } from 'vitest';
import { GameState } from '@prisma/client';
import { GamesService } from './games.service';
import { GameError } from './game-error';
import { TimerRegistry } from './timer-registry';
import { mockPrisma } from './testing/prisma-mock';
import type { QuestionsService } from '../questions/questions.service';
import type { LeaderboardService } from '../leaderboard/leaderboard.service';
import type { GameEventsService } from '../websocket/game-events.service';
import type { RoomsService } from '../rooms/rooms.service';
import type { AppConfigService } from '../config/app-config.service';

function build(sessionState: GameState) {
  const session: Record<string, unknown> = { id: 's1', roomId: 'r1', state: sessionState, mode: 'SELF_PACED', settings: {} };
  const prisma = mockPrisma({
    gameSession: {
      findUnique: vi.fn(async (): Promise<Record<string, unknown> | null> => session),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: vi.fn(async () => ({ ...session, state: 'UPDATED' })),
    },
    gameRoom: { updateMany: vi.fn(async () => ({ count: 1 })) },
  });
  const events = { toRoom: vi.fn(), toParticipant: vi.fn(), toTeacher: vi.fn(), disconnectParticipant: vi.fn(), disconnectRoom: vi.fn() };
  const service = new GamesService(
    prisma,
    {} as QuestionsService,
    {} as LeaderboardService,
    events as unknown as GameEventsService,
    {} as RoomsService,
    new TimerRegistry(),
    { appUrl: 'http://localhost:5173' } as AppConfigService,
  );
  return { service, prisma };
}

describe('GamesService.transition', () => {
  it('allows WAITING_FOR_PLAYERS → COUNTDOWN and mirrors state on the room', async () => {
    const { service, prisma } = build(GameState.WAITING_FOR_PLAYERS);
    await service.transition('s1', GameState.COUNTDOWN, { startedAt: new Date() });
    expect(prisma.gameSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 's1', state: GameState.WAITING_FOR_PLAYERS },
      data: expect.objectContaining({ state: GameState.COUNTDOWN }),
    }));
    expect(prisma.gameRoom.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { state: GameState.COUNTDOWN } }));
  });

  it('rejects an illegal transition with 409 INVALID_TRANSITION', async () => {
    const { service, prisma } = build(GameState.WAITING_FOR_PLAYERS);
    await expect(service.transition('s1', GameState.QUESTION_ACTIVE)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    expect(prisma.gameSession.updateMany).not.toHaveBeenCalled();
  });

  it('rejects transitions out of terminal states', async () => {
    const { service } = build(GameState.CANCELLED);
    await expect(service.transition('s1', GameState.WAITING_FOR_PLAYERS)).rejects.toBeInstanceOf(GameError);
  });

  it('fails with STATE_CHANGED when the compare-and-set finds a different state (race)', async () => {
    const { service, prisma } = build(GameState.QUESTION_ACTIVE);
    prisma.gameSession.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.transition('s1', GameState.FINAL_RESULTS)).rejects.toMatchObject({ code: 'STATE_CHANGED' });
  });

  it('allows PAUSED → QUESTION_ACTIVE and QUESTION_ACTIVE → PAUSED', async () => {
    await expect(build(GameState.PAUSED).service.transition('s1', GameState.QUESTION_ACTIVE)).resolves.toBeTruthy();
    await expect(build(GameState.QUESTION_ACTIVE).service.transition('s1', GameState.PAUSED)).resolves.toBeTruthy();
  });

  it('returns 404 for an unknown session', async () => {
    const { service, prisma } = build(GameState.WAITING_FOR_PLAYERS);
    prisma.gameSession.findUnique.mockResolvedValueOnce(null);
    await expect(service.transition('nope', GameState.COUNTDOWN)).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });
});

describe('TimerRegistry', () => {
  it('replaces timers of the same kind and clears per session', () => {
    vi.useFakeTimers();
    const registry = new TimerRegistry();
    const first = vi.fn();
    const second = vi.fn();
    registry.set('s', 'countdown', 1000, first);
    registry.set('s', 'countdown', 1000, second);
    registry.set('s', 'question', 500, vi.fn());
    expect(registry.has('s', 'question')).toBe(true);
    registry.clear('s', 'question');
    expect(registry.has('s', 'question')).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(registry.has('s', 'countdown')).toBe(false);
    vi.useRealTimers();
  });
});
