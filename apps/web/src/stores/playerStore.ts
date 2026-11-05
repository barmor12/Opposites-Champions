import { create } from 'zustand';
import {
  GameState,
  GameMode,
  type AchievementType,
  type AnswerPayload,
  type AnswerResult,
  type AvatarId,
  type JoinRoomRequest,
  type JoinRoomResponse,
  type LeaderboardEntry,
  type ParticipantView,
  type PlayerSession,
  type QuestionView,
  type RoomPublicView,
  type ServerToClientEvents,
} from '@oc/shared';
import { apiClient, ApiError } from '@/services/api';
import {
  connectAsPlayer,
  disconnectSocket,
  emitWithAck,
  getServerOffsetMs,
  onServerOffsetChange,
  setServerOffset,
  type AppSocket,
} from '@/services/socket';
import { getPlayerToken, session as sessionStore, setPlayerToken } from '@/lib/storage';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type SessionStatus = 'idle' | 'joining' | 'restoring' | 'ready' | 'error';

export type QuestionEndedInfo = Parameters<ServerToClientEvents['question:ended']>[0];

const LEADERBOARD_CACHE_KEY = 'oc.player.leaderboard';

export interface PlayerState {
  token: string | null;
  status: SessionStatus;
  error: string | null;

  participantId: string | null;
  displayName: string;
  avatar: AvatarId | null;

  room: RoomPublicView | null;
  participants: ParticipantView[];
  participantCount: number;
  gameSessionId: string | null;
  gameState: GameState | null;
  countdown: { seconds: number; startsAt: number } | null;

  currentQuestion: QuestionView | null;
  lastResult: AnswerResult | null;
  questionEnded: QuestionEndedInfo | null;
  /** teacher-paced: ענינו/נגמר הזמן ומחכים שהמורה תמשיך */
  awaitingTeacher: boolean;
  submitting: boolean;

  score: number;
  correctAnswers: number;
  answeredCount: number;
  streak: number;
  finished: boolean;
  finishedCount: number;
  leaderboard: LeaderboardEntry[];
  achievements: AchievementType[];

  connection: ConnectionStatus;
  serverOffsetMs: number;
  removedReason: string | null;
  socketError: { code: string; message: string } | null;
}

export interface PlayerActions {
  join: (req: JoinRoomRequest) => Promise<JoinRoomResponse>;
  restoreSession: () => Promise<PlayerSession | null>;
  bindSocket: () => AppSocket | null;
  unbindSocket: () => void;
  submitAnswer: (payload: AnswerPayload) => Promise<AnswerResult>;
  next: () => Promise<void>;
  leave: () => void;
  clearRemoved: () => void;
  /** עדכון ידני של מצב (לבדיקות / תצוגה מקדימה) */
  hydrate: (partial: Partial<PlayerState>) => void;
  reset: () => void;
}

export type PlayerStore = PlayerState & PlayerActions;

export const initialPlayerState: PlayerState = {
  token: getPlayerToken(),
  status: 'idle',
  error: null,
  participantId: null,
  displayName: '',
  avatar: null,
  room: null,
  participants: [],
  participantCount: 0,
  gameSessionId: null,
  gameState: null,
  countdown: null,
  currentQuestion: null,
  lastResult: null,
  questionEnded: null,
  awaitingTeacher: false,
  submitting: false,
  score: 0,
  correctAnswers: 0,
  answeredCount: 0,
  streak: 0,
  finished: false,
  finishedCount: 0,
  leaderboard: sessionStore.getJSON<LeaderboardEntry[]>(LEADERBOARD_CACHE_KEY, []),
  achievements: [],
  connection: 'idle',
  serverOffsetMs: 0,
  removedReason: null,
  socketError: null,
};

let boundSocket: AppSocket | null = null;
let unsubscribeOffset: (() => void) | null = null;

function sessionToState(s: PlayerSession): Partial<PlayerState> {
  return {
    participantId: s.participantId,
    displayName: s.displayName,
    avatar: s.avatar,
    room: s.room,
    participantCount: s.room.participantCount,
    gameSessionId: s.gameSessionId,
    gameState: s.room.state,
    score: s.score,
    correctAnswers: s.correctAnswers,
    answeredCount: s.answeredCount,
    finished: s.finished,
    currentQuestion: s.currentQuestion,
    lastResult: s.lastResult,
    achievements: s.achievements,
    awaitingTeacher: false,
    questionEnded: null,
    countdown: null,
    status: 'ready',
    error: null,
  };
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  ...initialPlayerState,

  async join(req) {
    set({ status: 'joining', error: null, removedReason: null });
    try {
      const res = await apiClient.post<JoinRoomResponse>('/rooms/join', req);
      setPlayerToken(res.sessionToken);
      sessionStore.remove(LEADERBOARD_CACHE_KEY);
      set({
        token: res.sessionToken,
        participantId: res.participantId,
        displayName: res.displayName,
        avatar: res.avatar,
        room: res.room,
        participantCount: res.room.participantCount,
        gameState: res.room.state,
        status: 'ready',
        score: 0,
        correctAnswers: 0,
        answeredCount: 0,
        streak: 0,
        finished: false,
        currentQuestion: null,
        lastResult: null,
        leaderboard: [],
        achievements: [],
        countdown: null,
      });
      return res;
    } catch (err) {
      set({ status: 'error', error: err instanceof ApiError ? err.message : 'ההצטרפות נכשלה. נסו שוב' });
      throw err;
    }
  },

  async restoreSession() {
    const token = get().token ?? getPlayerToken();
    if (!token) {
      set({ status: 'idle' });
      return null;
    }
    set({ status: 'restoring', token, error: null });
    try {
      const s = await apiClient.get<PlayerSession>('/player/session');
      set(sessionToState(s));
      return s;
    } catch (err) {
      const gone = err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404);
      if (gone) {
        setPlayerToken(null);
        set({ ...initialPlayerState, token: null, leaderboard: [], status: 'idle', error: null });
      } else {
        set({ status: 'error', error: err instanceof ApiError ? err.message : 'לא הצלחנו לחזור למשחק' });
      }
      return null;
    }
  },

  bindSocket() {
    const token = get().token ?? getPlayerToken();
    if (!token) return null;
    const s = connectAsPlayer(token);
    if (boundSocket === s) return s;
    get().unbindSocket();
    boundSocket = s;
    set({ connection: s.connected ? 'connected' : 'connecting', serverOffsetMs: getServerOffsetMs() });
    unsubscribeOffset = onServerOffsetChange((offset) => set({ serverOffsetMs: offset }));

    let hadConnection = s.connected;
    s.on('connect', () => {
      set({ connection: 'connected', socketError: null });
      emitWithAck(s, 'player:join', { sessionToken: token }).catch(() => {
        /* השרת עשוי לצרף אוטומטית לפי auth.token */
      });
      if (hadConnection) {
        // התחברות מחדש – מסנכרנים מצב מהשרת
        void get().restoreSession();
      }
      hadConnection = true;
    });
    s.on('disconnect', (reason) => {
      set({ connection: reason === 'io client disconnect' ? 'disconnected' : 'reconnecting' });
    });
    s.on('connect_error', () => {
      set({ connection: hadConnection ? 'reconnecting' : 'connecting' });
    });
    s.io.on('reconnect_attempt', () => set({ connection: 'reconnecting' }));

    s.on('player:connected', (p) => {
      set({ participantCount: p.participantCount });
    });
    s.on('player:disconnected', (p) => {
      set({ participantCount: p.participantCount });
    });
    s.on('player:removed', (p) => {
      if (p.participantId !== get().participantId) return;
      setPlayerToken(null);
      get().unbindSocket();
      set({ ...initialPlayerState, token: null, leaderboard: [], removedReason: p.reason || 'המורה הסירה אותך מהמשחק', status: 'idle' });
    });
    s.on('room:updated', ({ room, participants }) => {
      const prev = get();
      const newRound = prev.room && room.state === GameState.WAITING_FOR_PLAYERS && prev.gameState !== GameState.WAITING_FOR_PLAYERS;
      set({
        room,
        participants,
        participantCount: room.participantCount,
        gameState: room.state,
        ...(newRound
          ? {
              currentQuestion: null,
              lastResult: null,
              questionEnded: null,
              finished: false,
              finishedCount: 0,
              score: 0,
              correctAnswers: 0,
              answeredCount: 0,
              streak: 0,
              countdown: null,
              awaitingTeacher: false,
              leaderboard: [],
              achievements: [],
            }
          : {}),
      });
      if (newRound) sessionStore.remove(LEADERBOARD_CACHE_KEY);
    });
    s.on('game:countdown', (p) => {
      setServerOffset(p.serverNow - Date.now());
      set({
        countdown: { seconds: p.seconds, startsAt: p.startsAt },
        gameState: GameState.COUNTDOWN,
        currentQuestion: null,
        lastResult: null,
        questionEnded: null,
        finished: false,
        finishedCount: 0,
        awaitingTeacher: false,
        score: 0,
        correctAnswers: 0,
        answeredCount: 0,
        streak: 0,
        leaderboard: [],
      });
    });
    s.on('game:started', (p) => {
      set({ gameSessionId: p.gameSessionId, gameState: GameState.QUESTION_ACTIVE, countdown: null, finished: false, finishedCount: 0 });
    });
    s.on('question:started', (q) => {
      set({
        currentQuestion: q,
        lastResult: null,
        questionEnded: null,
        awaitingTeacher: false,
        countdown: null,
        gameState: GameState.QUESTION_ACTIVE,
        finished: false,
      });
    });
    s.on('question:ended', (info) => {
      const { currentQuestion, lastResult, score } = get();
      if (!currentQuestion || currentQuestion.sessionQuestionId !== info.sessionQuestionId) return;
      const merged: AnswerResult = lastResult
        ? { ...lastResult, correctOptionId: info.correctOptionId ?? lastResult.correctOptionId, correctMatches: info.correctMatches ?? lastResult.correctMatches, explanation: info.explanation ?? lastResult.explanation }
        : {
            sessionQuestionId: info.sessionQuestionId,
            correct: false,
            scoreAwarded: 0,
            totalScore: score,
            correctOptionId: info.correctOptionId,
            correctMatches: info.correctMatches,
            explanation: info.explanation,
            elapsedMs: currentQuestion.timeLimitMs,
            streak: 0,
          };
      set({ questionEnded: info, lastResult: merged, gameState: GameState.QUESTION_RESULTS });
    });
    s.on('answer:result', (r) => {
      if (get().lastResult?.sessionQuestionId === r.sessionQuestionId) return;
      applyResult(r);
    });
    s.on('leaderboard:updated', (lb) => {
      set({ leaderboard: lb.entries });
    });
    s.on('achievement:awarded', (awards) => {
      const me = get().participantId;
      const mine = awards.filter((a) => a.participantId === me).map((a) => a.type);
      if (!mine.length) return;
      set({ achievements: Array.from(new Set([...get().achievements, ...mine])) });
    });
    s.on('game:paused', () => {
      set({ gameState: GameState.PAUSED });
    });
    s.on('game:resumed', (p) => {
      set({
        gameState: GameState.QUESTION_ACTIVE,
        ...(p.question ? { currentQuestion: p.question, lastResult: null, questionEnded: null, awaitingTeacher: false } : {}),
      });
    });
    s.on('game:finished', (p) => {
      sessionStore.setJSON(LEADERBOARD_CACHE_KEY, p.leaderboard.entries);
      set({ gameState: GameState.FINAL_RESULTS, leaderboard: p.leaderboard.entries, gameSessionId: p.gameSessionId, currentQuestion: null, countdown: null, finished: true });
    });
    s.on('player:finished', (p) => {
      set({ finishedCount: p.finishedCount, participantCount: p.participantCount, ...(p.participantId === get().participantId ? { finished: true } : {}) });
    });
    s.on('error:message', (e) => {
      set({ socketError: e });
    });
    return s;
  },

  unbindSocket() {
    if (boundSocket) {
      boundSocket.removeAllListeners();
      boundSocket.io.off('reconnect_attempt');
      boundSocket = null;
    }
    unsubscribeOffset?.();
    unsubscribeOffset = null;
  },

  async submitAnswer(payload) {
    if (!boundSocket) throw new Error('אין חיבור למשחק');
    set({ submitting: true });
    try {
      const result = await emitWithAck(boundSocket, 'answer:submit', payload);
      applyResult(result);
      return result;
    } finally {
      set({ submitting: false });
    }
  },

  async next() {
    const { currentQuestion, room } = get();
    if (!currentQuestion) return;
    if (room?.mode === GameMode.TEACHER_PACED) {
      set({ awaitingTeacher: true });
      return;
    }
    if (!boundSocket) throw new Error('אין חיבור למשחק');
    const res = await emitWithAck(boundSocket, 'question:next', { sessionQuestionId: currentQuestion.sessionQuestionId });
    if (res.finished || !res.question) {
      set({ finished: true, currentQuestion: null, lastResult: null, questionEnded: null });
    } else {
      set({ currentQuestion: res.question, lastResult: null, questionEnded: null, awaitingTeacher: false, gameState: GameState.QUESTION_ACTIVE });
    }
  },

  leave() {
    get().unbindSocket();
    disconnectSocket();
    setPlayerToken(null);
    sessionStore.remove(LEADERBOARD_CACHE_KEY);
    set({ ...initialPlayerState, token: null, leaderboard: [], status: 'idle', connection: 'idle' });
  },

  clearRemoved() {
    set({ removedReason: null });
  },

  hydrate(partial) {
    set(partial);
  },

  reset() {
    get().unbindSocket();
    set({ ...initialPlayerState, token: getPlayerToken(), leaderboard: [] });
  },
}));

function applyResult(r: AnswerResult) {
  const prev = usePlayerStore.getState();
  const alreadyCounted = prev.lastResult?.sessionQuestionId === r.sessionQuestionId;
  usePlayerStore.setState({
    lastResult: r,
    score: r.totalScore,
    streak: r.streak,
    answeredCount: alreadyCounted ? prev.answeredCount : prev.answeredCount + 1,
    correctAnswers: alreadyCounted ? prev.correctAnswers : prev.correctAnswers + (r.correct ? 1 : 0),
    gameState: prev.room?.mode === GameMode.TEACHER_PACED ? prev.gameState : GameState.QUESTION_RESULTS,
  });
}

// ===== Selectors =====
export const selectMe = (s: PlayerStore) => ({ id: s.participantId, name: s.displayName, avatar: s.avatar });
export const selectIsPaused = (s: PlayerStore) => s.gameState === GameState.PAUSED;
export const selectProgress = (s: PlayerStore) => ({
  index: s.currentQuestion?.index ?? s.answeredCount,
  total: s.currentQuestion?.total ?? s.room?.questionCount ?? 0,
});

// חשיפה בסביבת פיתוח לצורך דיבוג / תצוגה מקדימה
declare global {
  interface Window {
    __oc?: { playerStore: typeof usePlayerStore };
  }
}
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__oc = { ...(window.__oc ?? {}), playerStore: usePlayerStore };
}
