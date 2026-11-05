import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState, GameMode, type JoinRoomResponse, type PlayerSession, type QuestionView, type RoomPublicView } from '@oc/shared';

// ===== socket mock =====
type Handler = (...args: unknown[]) => void;
const handlers = new Map<string, Handler[]>();
const ioHandlers = new Map<string, Handler[]>();
const emitMock = vi.fn();
const fakeSocket = {
  connected: true,
  auth: { token: 'tok' },
  on: vi.fn((ev: string, h: Handler) => {
    handlers.set(ev, [...(handlers.get(ev) ?? []), h]);
    return fakeSocket;
  }),
  io: { on: vi.fn((ev: string, h: Handler) => ioHandlers.set(ev, [h])), off: vi.fn() },
  emit: emitMock,
  removeAllListeners: vi.fn(() => handlers.clear()),
  disconnect: vi.fn(),
};
function fire(ev: string, ...args: unknown[]) {
  (handlers.get(ev) ?? []).forEach((h) => h(...args));
}

vi.mock('@/services/socket', () => ({
  connectAsPlayer: vi.fn(() => fakeSocket),
  disconnectSocket: vi.fn(),
  getServerOffsetMs: () => 0,
  onServerOffsetChange: () => () => {},
  setServerOffset: vi.fn(),
  emitWithAck: vi.fn((_s: unknown, event: string, payload: unknown) => emitMock(event, payload)),
}));

vi.mock('@/services/api', async () => {
  const actual = await vi.importActual<typeof import('@/services/api')>('@/services/api');
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn(), url: actual.apiClient.url } };
});

import { apiClient } from '@/services/api';
import { usePlayerStore, initialPlayerState } from './playerStore';
import { getPlayerToken } from '@/lib/storage';

const room: RoomPublicView = {
  roomId: 'r1',
  code: '123456',
  className: 'ג׳2',
  state: GameState.WAITING_FOR_PLAYERS,
  joinOpen: true,
  mode: GameMode.SELF_PACED,
  participantCount: 3,
  questionCount: 10,
  currentQuestionIndex: null,
  settings: { timePerQuestionSec: 20, showLeaderboard: true, showCorrectAnswers: true, soundsEnabled: true, competitionEnabled: true },
};

const question: QuestionView = {
  sessionQuestionId: 'sq1',
  index: 0,
  total: 10,
  type: 'CHOOSE_OPPOSITE',
  prompt: 'גדול',
  options: [
    { id: 'a', text: 'קטן' },
    { id: 'b', text: 'חם' },
  ],
  isTreasure: false,
  timeLimitMs: 20000,
  startedAt: 1000,
  endsAt: 21000,
  serverNow: 1000,
};

describe('playerStore', () => {
  beforeEach(() => {
    handlers.clear();
    emitMock.mockReset();
    usePlayerStore.setState({ ...initialPlayerState, token: null, leaderboard: [] });
    usePlayerStore.getState().unbindSocket();
  });

  it('join stores token + participant info', async () => {
    const res: JoinRoomResponse = { participantId: 'p1', sessionToken: 'tok-1', displayName: 'נועה', avatar: 'fox', room };
    vi.mocked(apiClient.post).mockResolvedValueOnce(res);
    await usePlayerStore.getState().join({ code: '123456', displayName: 'נועה', avatar: 'fox' });
    const s = usePlayerStore.getState();
    expect(apiClient.post).toHaveBeenCalledWith('/rooms/join', { code: '123456', displayName: 'נועה', avatar: 'fox' });
    expect(s.token).toBe('tok-1');
    expect(getPlayerToken()).toBe('tok-1');
    expect(s.participantId).toBe('p1');
    expect(s.gameState).toBe(GameState.WAITING_FOR_PLAYERS);
    expect(s.status).toBe('ready');
  });

  it('restoreSession hydrates from GET /player/session', async () => {
    usePlayerStore.setState({ token: 'tok-1' });
    const session: PlayerSession = {
      participantId: 'p1',
      displayName: 'נועה',
      avatar: 'fox',
      room: { ...room, state: GameState.QUESTION_ACTIVE },
      gameSessionId: 'gs1',
      score: 150,
      correctAnswers: 2,
      answeredCount: 3,
      finished: false,
      currentQuestion: question,
      lastResult: null,
      achievements: [],
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce(session);
    const r = await usePlayerStore.getState().restoreSession();
    expect(r).toEqual(session);
    const s = usePlayerStore.getState();
    expect(s.score).toBe(150);
    expect(s.currentQuestion?.sessionQuestionId).toBe('sq1');
    expect(s.gameState).toBe(GameState.QUESTION_ACTIVE);
  });

  it('restoreSession clears token on 401', async () => {
    const { ApiError } = await vi.importActual<typeof import('@/services/api')>('@/services/api');
    usePlayerStore.setState({ token: 'tok-dead' });
    vi.mocked(apiClient.get).mockRejectedValueOnce(new ApiError(401, 'לא מחובר'));
    await usePlayerStore.getState().restoreSession();
    expect(usePlayerStore.getState().token).toBeNull();
    expect(getPlayerToken()).toBeNull();
  });

  describe('socket events', () => {
    beforeEach(() => {
      usePlayerStore.setState({ token: 'tok-1', participantId: 'p1', room, gameState: room.state, status: 'ready' });
      usePlayerStore.getState().bindSocket();
    });

    it('subscribes to all server events', () => {
      const expected = [
        'player:connected', 'player:disconnected', 'player:removed', 'room:updated', 'game:countdown', 'game:started',
        'question:started', 'question:ended', 'answer:result', 'leaderboard:updated', 'achievement:awarded',
        'game:paused', 'game:resumed', 'game:finished', 'player:finished', 'error:message',
      ];
      for (const ev of expected) expect(handlers.has(ev), ev).toBe(true);
    });

    it('game:countdown → countdown + COUNTDOWN state', () => {
      fire('game:countdown', { seconds: 3, startsAt: 5000, serverNow: 2000 });
      const s = usePlayerStore.getState();
      expect(s.gameState).toBe(GameState.COUNTDOWN);
      expect(s.countdown).toEqual({ seconds: 3, startsAt: 5000 });
    });

    it('question:started sets current question and clears result', () => {
      usePlayerStore.setState({ lastResult: { sessionQuestionId: 'old', correct: true, scoreAwarded: 1, totalScore: 1, elapsedMs: 1, streak: 1 } });
      fire('question:started', question);
      const s = usePlayerStore.getState();
      expect(s.currentQuestion).toEqual(question);
      expect(s.lastResult).toBeNull();
      expect(s.gameState).toBe(GameState.QUESTION_ACTIVE);
    });

    it('game:paused / game:resumed', () => {
      fire('game:paused', { serverNow: 1 });
      expect(usePlayerStore.getState().gameState).toBe(GameState.PAUSED);
      fire('game:resumed', { serverNow: 2, question });
      expect(usePlayerStore.getState().gameState).toBe(GameState.QUESTION_ACTIVE);
      expect(usePlayerStore.getState().currentQuestion).toEqual(question);
    });

    it('leaderboard:updated replaces entries', () => {
      const entry = { participantId: 'p1', displayName: 'נועה', avatar: 'fox' as const, score: 10, correctAnswers: 1, answeredCount: 1, accuracy: 100, totalResponseMs: 1, rank: 1, connected: true, finished: false };
      fire('leaderboard:updated', { gameSessionId: 'gs', entries: [entry], updatedAt: 1 });
      expect(usePlayerStore.getState().leaderboard).toEqual([entry]);
    });

    it('participant count follows player:connected/disconnected', () => {
      fire('player:connected', { participantId: 'p2', displayName: 'x', participantCount: 7 });
      expect(usePlayerStore.getState().participantCount).toBe(7);
      fire('player:disconnected', { participantId: 'p2', participantCount: 6 });
      expect(usePlayerStore.getState().participantCount).toBe(6);
    });

    it('game:finished → FINAL_RESULTS with leaderboard', () => {
      fire('game:finished', { gameSessionId: 'gs', leaderboard: { gameSessionId: 'gs', entries: [], updatedAt: 1 } });
      expect(usePlayerStore.getState().gameState).toBe(GameState.FINAL_RESULTS);
      expect(usePlayerStore.getState().finished).toBe(true);
    });

    it('achievement:awarded keeps only mine', () => {
      fire('achievement:awarded', [
        { participantId: 'p1', type: 'FIVE_STREAK' },
        { participantId: 'p9', type: 'TEN_CORRECT' },
      ]);
      expect(usePlayerStore.getState().achievements).toEqual(['FIVE_STREAK']);
    });

    it('player:removed clears session and records reason', () => {
      fire('player:removed', { participantId: 'p1', reason: 'המורה הסירה אותך' });
      const s = usePlayerStore.getState();
      expect(s.token).toBeNull();
      expect(s.removedReason).toBe('המורה הסירה אותך');
    });

    it('room:updated with new round resets progress', () => {
      usePlayerStore.setState({ gameState: GameState.COMPLETED, score: 300, finished: true, currentQuestion: question });
      fire('room:updated', { room: { ...room, state: GameState.WAITING_FOR_PLAYERS }, participants: [] });
      const s = usePlayerStore.getState();
      expect(s.gameState).toBe(GameState.WAITING_FOR_PLAYERS);
      expect(s.score).toBe(0);
      expect(s.finished).toBe(false);
      expect(s.currentQuestion).toBeNull();
    });

    it('question:ended without an answer synthesizes a result with the correct option', () => {
      usePlayerStore.setState({ currentQuestion: question, lastResult: null, score: 40 });
      fire('question:ended', { sessionQuestionId: 'sq1', correctOptionId: 'a', explanation: 'ההפך של גדול הוא קטן' });
      const s = usePlayerStore.getState();
      expect(s.lastResult?.correct).toBe(false);
      expect(s.lastResult?.correctOptionId).toBe('a');
      expect(s.lastResult?.totalScore).toBe(40);
      expect(s.gameState).toBe(GameState.QUESTION_RESULTS);
    });
  });

  describe('actions over socket', () => {
    beforeEach(() => {
      usePlayerStore.setState({ token: 'tok-1', participantId: 'p1', room, gameState: GameState.QUESTION_ACTIVE, status: 'ready', currentQuestion: question });
      usePlayerStore.getState().bindSocket();
    });

    it('submitAnswer emits answer:submit and applies the result', async () => {
      emitMock.mockResolvedValueOnce({ sessionQuestionId: 'sq1', correct: true, scoreAwarded: 130, totalScore: 130, elapsedMs: 900, streak: 1 });
      const r = await usePlayerStore.getState().submitAnswer({ sessionQuestionId: 'sq1', optionId: 'a' });
      expect(emitMock).toHaveBeenCalledWith('answer:submit', { sessionQuestionId: 'sq1', optionId: 'a' });
      expect(r.correct).toBe(true);
      const s = usePlayerStore.getState();
      expect(s.score).toBe(130);
      expect(s.correctAnswers).toBe(1);
      expect(s.answeredCount).toBe(1);
      expect(s.lastResult?.sessionQuestionId).toBe('sq1');
      expect(s.gameState).toBe(GameState.QUESTION_RESULTS);
    });

    it('next emits question:next and loads the next question', async () => {
      const q2 = { ...question, sessionQuestionId: 'sq2', index: 1 };
      emitMock.mockResolvedValueOnce({ question: q2, finished: false });
      await usePlayerStore.getState().next();
      expect(emitMock).toHaveBeenCalledWith('question:next', { sessionQuestionId: 'sq1' });
      expect(usePlayerStore.getState().currentQuestion?.sessionQuestionId).toBe('sq2');
    });

    it('next marks finished when server says so', async () => {
      emitMock.mockResolvedValueOnce({ question: null, finished: true });
      await usePlayerStore.getState().next();
      const s = usePlayerStore.getState();
      expect(s.finished).toBe(true);
      expect(s.currentQuestion).toBeNull();
    });

    it('next in teacher-paced mode only waits for the teacher', async () => {
      usePlayerStore.setState({ room: { ...room, mode: GameMode.TEACHER_PACED } });
      await usePlayerStore.getState().next();
      expect(emitMock).not.toHaveBeenCalled();
      expect(usePlayerStore.getState().awaitingTeacher).toBe(true);
    });

    it('leave clears everything', () => {
      usePlayerStore.getState().leave();
      expect(usePlayerStore.getState().token).toBeNull();
      expect(getPlayerToken()).toBeNull();
      expect(usePlayerStore.getState().room).toBeNull();
    });
  });
});
