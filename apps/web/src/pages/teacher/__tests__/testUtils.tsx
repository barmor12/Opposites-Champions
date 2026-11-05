import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render } from '@testing-library/react';
import { GameMode, GameState, type GameSummary, type TeacherProfile, type TeacherRoomLive } from '@oc/shared';
import { useTeacherStore } from '@/stores/teacherStore';

export const PROFILE: TeacherProfile = { id: 't1', email: 'teacher@school.edu', name: 'רותי כהן' };

export function resetStore(partial: Partial<ReturnType<typeof useTeacherStore.getState>> = {}) {
  useTeacherStore.setState({
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
    ...partial,
  });
}

/** מרנדר עמוד תחת /teacher/<path> עם נתיבי-עוגן לזיהוי ניווט */
export function renderAt(path: string, element: ReactNode, extraRoutes?: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[`/teacher/${path}`]}>
      <Routes>
        <Route path="/teacher">
          <Route index element={<div data-testid="marker-dashboard">DASHBOARD</div>} />
          <Route path="login" element={path === 'login' ? element : <div data-testid="marker-login">LOGIN</div>} />
          <Route path="rooms/:id" element={path.startsWith('rooms/') && !path.endsWith('results') ? element : <div data-testid="marker-room">ROOM</div>} />
          <Route path="new" element={path === 'new' ? element : null} />
          {extraRoutes}
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

export function makeSummary(over: Partial<GameSummary> = {}): GameSummary {
  return {
    roomId: 'room-1',
    code: '482913',
    className: 'כיתה ג׳2',
    state: GameState.WAITING_FOR_PLAYERS,
    joinOpen: true,
    mode: GameMode.SELF_PACED,
    createdAt: new Date('2026-11-05T08:00:00Z').toISOString(),
    participantCount: 0,
    sessionCount: 1,
    currentSessionId: 'sess-1',
    settings: {
      className: 'כיתה ג׳2',
      questionCount: 12,
      difficulty: 'MIXED',
      categories: ['SIZES'],
      timePerQuestionSec: 20,
      questionTypes: ['CHOOSE_OPPOSITE'],
      mode: GameMode.SELF_PACED,
      competitionEnabled: true,
      showLeaderboard: true,
      showCorrectAnswers: true,
      soundsEnabled: true,
      treasureChallenge: false,
    },
    ...over,
  };
}

export function makeLive(state: GameState, mode: GameMode = GameMode.SELF_PACED, over: Partial<TeacherRoomLive> = {}): TeacherRoomLive {
  return {
    room: {
      roomId: 'room-1',
      code: '482913',
      className: 'כיתה ג׳2',
      state,
      joinOpen: true,
      mode,
      participantCount: 2,
      questionCount: 12,
      currentQuestionIndex: mode === GameMode.TEACHER_PACED ? 3 : null,
      settings: { timePerQuestionSec: 20, showLeaderboard: true, showCorrectAnswers: true, soundsEnabled: true, competitionEnabled: true },
    },
    participants: [
      { id: 'p1', displayName: 'נועה', avatar: 'fox', connected: true, finished: false, answeredCount: 4, score: 420 },
      { id: 'p2', displayName: 'יובל', avatar: 'lion', connected: false, finished: true, answeredCount: 12, score: 1100 },
    ],
    finishedCount: 1,
    leaderboard: [],
    gameSessionId: 'sess-1',
    currentQuestionIndex: mode === GameMode.TEACHER_PACED ? 3 : null,
    joinUrl: 'https://opposites.example/join?code=482913',
    ...over,
  };
}
