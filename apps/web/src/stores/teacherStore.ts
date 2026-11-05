import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import {
  GameState,
  type ClientToServerEvents,
  type GameSettings,
  type GameSummary,
  type LeaderboardEntry,
  type ParticipantView,
  type ServerToClientEvents,
  type TeacherProfile,
  type TeacherRoomLive,
} from '@oc/shared';
import { teacherApi } from '@/services/teacherApi';
import { connectAsTeacher, disconnectSocket } from '@/services/socket';

export type AuthStatus = 'checking' | 'anonymous' | 'authenticated';

export type RoomAction = 'start' | 'pause' | 'resume' | 'finish' | 'next' | 'cancel';

/** אירועים חיים מהחדר – לצורך הצגת הודעות (toast) בממשק. */
export type LiveEvent =
  | { type: 'player:connected'; participantId: string; displayName: string; participantCount: number }
  | { type: 'player:disconnected'; participantId: string; displayName: string | null; participantCount: number }
  | { type: 'player:finished'; participantId: string; displayName: string | null; finishedCount: number; participantCount: number }
  | { type: 'player:removed'; participantId: string; reason: string }
  | { type: 'game:countdown'; seconds: number }
  | { type: 'game:started' }
  | { type: 'game:paused' }
  | { type: 'game:resumed' }
  | { type: 'game:finished' }
  | { type: 'question:started'; index: number; total: number }
  | { type: 'question:ended' }
  | { type: 'socket:connected' }
  | { type: 'socket:disconnected' }
  | { type: 'error'; code: string; message: string };

export type LiveEventListener = (event: LiveEvent) => void;

type TeacherSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface TeacherStoreState {
  profile: TeacherProfile | null;
  authStatus: AuthStatus;

  games: GameSummary[];
  gamesLoading: boolean;
  gamesError: string | null;

  live: TeacherRoomLive | null;
  liveRoomId: string | null;
  liveLoading: boolean;
  liveError: string | null;
  socketConnected: boolean;
  /** מזהה המשתתף שהמורה מסיר כרגע / פעולה שרצה כרגע – לנעילת כפתורים. */
  pendingAction: string | null;

  // auth
  checkAuth(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;

  // games
  loadGames(): Promise<void>;
  createGame(settings: GameSettings): Promise<GameSummary>;
  deleteGame(roomId: string): Promise<void>;

  // live room
  loadLive(roomId: string): Promise<void>;
  applyLive(live: TeacherRoomLive): void;
  clearLive(): void;
  bindRoom(roomId: string, onEvent?: LiveEventListener): () => void;
  runRoomAction(roomId: string, action: RoomAction): Promise<void>;
  setJoinOpen(roomId: string, open: boolean): Promise<void>;
  newRound(roomId: string): Promise<GameSummary>;
  removeParticipant(roomId: string, participantId: string): Promise<void>;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message || fallback;
  }
  return fallback;
}

function errorStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function mergeParticipantsFromLeaderboard(
  participants: ParticipantView[],
  entries: LeaderboardEntry[],
): ParticipantView[] {
  const byId = new Map(entries.map((e) => [e.participantId, e]));
  return participants.map((p) => {
    const entry = byId.get(p.id);
    if (!entry) return p;
    return {
      ...p,
      score: entry.score,
      answeredCount: entry.answeredCount,
      finished: entry.finished,
      connected: entry.connected,
    };
  });
}

/** Socket יחיד לחדר אחד – המורה צופה בחדר אחד בכל רגע (הסינגלטון מנוהל ב־services/socket). */
let socket: TeacherSocket | null = null;
let boundRoomId: string | null = null;
let refetchTimer: ReturnType<typeof setTimeout> | null = null;

function teardownSocket() {
  if (!socket) return;
  disconnectSocket();
  socket = null;
  boundRoomId = null;
}

export const useTeacherStore = create<TeacherStoreState>()((set, get) => {
  const updateLive = (updater: (live: TeacherRoomLive) => TeacherRoomLive) => {
    const current = get().live;
    if (!current) return;
    set({ live: updater(current) });
  };

  const scheduleRefetch = (roomId: string, delayMs = 250) => {
    if (refetchTimer) clearTimeout(refetchTimer);
    refetchTimer = setTimeout(() => {
      refetchTimer = null;
      if (get().liveRoomId !== roomId) return;
      teacherApi.games
        .get(roomId)
        .then((live) => {
          if (get().liveRoomId === roomId) set({ live });
        })
        .catch(() => {
          /* נשאר עם המצב המקומי */
        });
    }, delayMs);
  };

  return {
    profile: null,
    authStatus: 'checking',
    games: [],
    gamesLoading: false,
    gamesError: null,
    live: null,
    liveRoomId: null,
    liveLoading: false,
    liveError: null,
    socketConnected: false,
    pendingAction: null,

    async checkAuth() {
      try {
        const profile = await teacherApi.auth.me();
        set({ profile, authStatus: 'authenticated' });
      } catch {
        set({ profile: null, authStatus: 'anonymous' });
      }
    },

    async login(email, password) {
      const profile = await teacherApi.auth.login(email, password);
      set({ profile, authStatus: 'authenticated' });
    },

    async logout() {
      try {
        await teacherApi.auth.logout();
      } finally {
        get().clearLive();
        set({ profile: null, authStatus: 'anonymous', games: [] });
      }
    },

    async loadGames() {
      set({ gamesLoading: true, gamesError: null });
      try {
        const games = await teacherApi.games.list();
        set({ games, gamesLoading: false });
      } catch (err) {
        set({ gamesLoading: false, gamesError: errorMessage(err, 'לֹא הִצְלַחְנוּ לִטְעוֹן אֶת רְשִׁימַת הַמִּשְׂחָקִים') });
        if (errorStatus(err) === 401) set({ authStatus: 'anonymous', profile: null });
      }
    },

    async createGame(settings) {
      const summary = await teacherApi.games.create(settings);
      set((s) => ({ games: [summary, ...s.games] }));
      return summary;
    },

    async deleteGame(roomId) {
      await teacherApi.games.remove(roomId);
      set((s) => ({ games: s.games.filter((g) => g.roomId !== roomId) }));
      if (get().liveRoomId === roomId) get().clearLive();
    },

    async loadLive(roomId) {
      set({ liveLoading: true, liveError: null, liveRoomId: roomId });
      try {
        const live = await teacherApi.games.get(roomId);
        if (get().liveRoomId !== roomId) return;
        set({ live, liveLoading: false });
      } catch (err) {
        if (get().liveRoomId !== roomId) return;
        const status = errorStatus(err);
        set({
          liveLoading: false,
          liveError:
            status === 404 ? 'הַחֶדֶר לֹא נִמְצָא – יִיתָּכֵן שֶׁנִּמְחַק' : errorMessage(err, 'לֹא הִצְלַחְנוּ לִטְעוֹן אֶת הַחֶדֶר'),
        });
        if (status === 401) set({ authStatus: 'anonymous', profile: null });
      }
    },

    applyLive(live) {
      set({ live, liveRoomId: live.room.roomId, liveError: null });
      set((s) => ({
        games: s.games.map((g) =>
          g.roomId === live.room.roomId
            ? {
                ...g,
                state: live.room.state,
                joinOpen: live.room.joinOpen,
                participantCount: live.room.participantCount,
                currentSessionId: live.gameSessionId,
              }
            : g,
        ),
      }));
    },

    clearLive() {
      if (refetchTimer) {
        clearTimeout(refetchTimer);
        refetchTimer = null;
      }
      teardownSocket();
      set({ live: null, liveRoomId: null, liveLoading: false, liveError: null, socketConnected: false });
    },

    bindRoom(roomId, onEvent) {
      const emit = (event: LiveEvent) => onEvent?.(event);
      const nameOf = (participantId: string): string | null =>
        get().live?.participants.find((p) => p.id === participantId)?.displayName ?? null;

      // חדר אחר היה מחובר – מנתקים קודם
      if (socket && boundRoomId !== roomId) teardownSocket();
      if (!socket) socket = connectAsTeacher();
      const s = socket;
      boundRoomId = roomId;

      const joinRoom = () => {
        s.emit('teacher:join', { roomId }, (ack) => {
          if (!ack.ok) emit({ type: 'error', code: ack.error.code, message: ack.error.message });
          else scheduleRefetch(roomId, 0);
        });
      };

      const onConnect = () => {
        set({ socketConnected: true });
        emit({ type: 'socket:connected' });
        joinRoom();
      };
      const onDisconnect = () => {
        set({ socketConnected: false });
        emit({ type: 'socket:disconnected' });
      };

      const handlers: { [K in keyof ServerToClientEvents]?: ServerToClientEvents[K] } = {
        'room:updated': ({ room, participants }) => {
          updateLive((live) => ({
            ...live,
            room,
            participants,
            finishedCount: participants.filter((p) => p.finished).length,
          }));
        },
        'player:connected': (p) => {
          const known = get().live?.participants.some((x) => x.id === p.participantId) ?? false;
          updateLive((live) => ({
            ...live,
            room: { ...live.room, participantCount: p.participantCount },
            participants: live.participants.map((x) => (x.id === p.participantId ? { ...x, connected: true } : x)),
          }));
          if (!known) scheduleRefetch(roomId);
          emit({ type: 'player:connected', ...p });
        },
        'player:disconnected': (p) => {
          const displayName = nameOf(p.participantId);
          updateLive((live) => ({
            ...live,
            room: { ...live.room, participantCount: p.participantCount },
            participants: live.participants.map((x) => (x.id === p.participantId ? { ...x, connected: false } : x)),
          }));
          emit({ type: 'player:disconnected', participantId: p.participantId, displayName, participantCount: p.participantCount });
        },
        'player:removed': (p) => {
          updateLive((live) => ({
            ...live,
            participants: live.participants.filter((x) => x.id !== p.participantId),
            leaderboard: live.leaderboard.filter((x) => x.participantId !== p.participantId),
          }));
          emit({ type: 'player:removed', ...p });
        },
        'player:finished': (p) => {
          const displayName = nameOf(p.participantId);
          updateLive((live) => ({
            ...live,
            finishedCount: p.finishedCount,
            participants: live.participants.map((x) => (x.id === p.participantId ? { ...x, finished: true } : x)),
          }));
          emit({ type: 'player:finished', participantId: p.participantId, displayName, finishedCount: p.finishedCount, participantCount: p.participantCount });
        },
        'leaderboard:updated': (lb) => {
          updateLive((live) => ({
            ...live,
            leaderboard: lb.entries,
            participants: mergeParticipantsFromLeaderboard(live.participants, lb.entries),
          }));
        },
        'game:countdown': (p) => {
          updateLive((live) => ({ ...live, room: { ...live.room, state: GameState.COUNTDOWN } }));
          emit({ type: 'game:countdown', seconds: p.seconds });
        },
        'game:started': (p) => {
          updateLive((live) => ({
            ...live,
            gameSessionId: p.gameSessionId,
            room: { ...live.room, state: GameState.QUESTION_ACTIVE, mode: p.mode, questionCount: p.questionCount },
            finishedCount: 0,
          }));
          scheduleRefetch(roomId);
          emit({ type: 'game:started' });
        },
        'game:paused': () => {
          updateLive((live) => ({ ...live, room: { ...live.room, state: GameState.PAUSED } }));
          emit({ type: 'game:paused' });
        },
        'game:resumed': (p) => {
          updateLive((live) => ({
            ...live,
            room: { ...live.room, state: GameState.QUESTION_ACTIVE },
            currentQuestionIndex: p.question ? p.question.index : live.currentQuestionIndex,
          }));
          scheduleRefetch(roomId);
          emit({ type: 'game:resumed' });
        },
        'game:finished': (p) => {
          updateLive((live) => ({
            ...live,
            leaderboard: p.leaderboard.entries,
            participants: mergeParticipantsFromLeaderboard(live.participants, p.leaderboard.entries),
            room: { ...live.room, state: GameState.FINAL_RESULTS },
          }));
          // השרת עובר ל־COMPLETED מיד אחרי – נרענן
          scheduleRefetch(roomId, 800);
          emit({ type: 'game:finished' });
        },
        'question:started': (q) => {
          updateLive((live) => ({
            ...live,
            currentQuestionIndex: q.index,
            room: { ...live.room, state: GameState.QUESTION_ACTIVE, currentQuestionIndex: q.index },
          }));
          emit({ type: 'question:started', index: q.index, total: q.total });
        },
        'question:ended': () => {
          updateLive((live) => ({ ...live, room: { ...live.room, state: GameState.QUESTION_RESULTS } }));
          emit({ type: 'question:ended' });
        },
        'error:message': (p) => emit({ type: 'error', ...p }),
      };

      s.on('connect', onConnect);
      s.on('disconnect', onDisconnect);
      for (const [event, handler] of Object.entries(handlers)) {
        // socket.io typings require the union key – מבצעים cast מקומי
        (s.on as (ev: string, fn: (...args: never[]) => void) => void)(event, handler as (...args: never[]) => void);
      }
      if (s.connected) onConnect();

      return () => {
        s.off('connect', onConnect);
        s.off('disconnect', onDisconnect);
        for (const [event, handler] of Object.entries(handlers)) {
          (s.off as (ev: string, fn: (...args: never[]) => void) => void)(event, handler as (...args: never[]) => void);
        }
        if (boundRoomId === roomId && socket === s) {
          teardownSocket();
          set({ socketConnected: false });
        }
      };
    },

    async runRoomAction(roomId, action) {
      set({ pendingAction: action });
      try {
        const api = teacherApi.games;
        const call: Record<RoomAction, (id: string) => Promise<TeacherRoomLive>> = {
          start: api.start,
          pause: api.pause,
          resume: api.resume,
          finish: api.finish,
          next: api.next,
          cancel: api.cancel,
        };
        const live = await call[action](roomId);
        get().applyLive(live);
      } finally {
        set({ pendingAction: null });
      }
    },

    async setJoinOpen(roomId, open) {
      set({ pendingAction: 'join-open' });
      try {
        const live = await teacherApi.games.setJoinOpen(roomId, open);
        get().applyLive(live);
      } finally {
        set({ pendingAction: null });
      }
    },

    async newRound(roomId) {
      set({ pendingAction: 'new-round' });
      try {
        const summary = await teacherApi.games.newRound(roomId);
        set((s) => ({
          games: s.games.map((g) => (g.roomId === summary.roomId ? summary : g)),
        }));
        await get().loadLive(roomId);
        return summary;
      } finally {
        set({ pendingAction: null });
      }
    },

    async removeParticipant(roomId, participantId) {
      set({ pendingAction: `remove:${participantId}` });
      try {
        const live = await teacherApi.games.removeParticipant(roomId, participantId);
        get().applyLive(live);
      } finally {
        set({ pendingAction: null });
      }
    },
  };
});

/** עוזרים לבחירה בקומפוננטות */
export const selectIsAuthenticated = (s: TeacherStoreState) => s.authStatus === 'authenticated';
