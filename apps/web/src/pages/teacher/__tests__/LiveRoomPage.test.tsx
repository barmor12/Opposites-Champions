import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { GameMode, GameState } from '@oc/shared';
import { LiveRoomPage } from '../LiveRoomPage';
import { teacherApi } from '@/services/teacherApi';
import { PROFILE, makeLive, renderAt, resetStore } from './testUtils';

vi.mock('@/services/teacherApi', () => ({
  teacherApi: {
    auth: { login: vi.fn(), logout: vi.fn(), me: vi.fn() },
    games: {
      get: vi.fn(),
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      finish: vi.fn(),
      next: vi.fn(),
      cancel: vi.fn(),
      setJoinOpen: vi.fn(),
      newRound: vi.fn(),
      removeParticipant: vi.fn(),
    },
    wordPairs: {},
    categories: {},
    media: {},
  },
}));

const fakeSocket = {
  connected: false,
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
};
vi.mock('@/services/socket', () => ({
  connectAsTeacher: vi.fn(() => fakeSocket),
  disconnectSocket: vi.fn(),
}));

const api = vi.mocked(teacherApi, true);

const controls = async () => {
  const group = await screen.findByRole('group', { name: 'פעולות' });
  return within(group).queryAllByRole('button').map((b) => b.textContent?.trim() ?? '');
};

describe('LiveRoomPage – כפתורים לפי מצב', () => {
  beforeEach(() => {
    resetStore({ authStatus: 'authenticated', profile: PROFILE });
  });

  it('מציג קוד, QR וקישור הצטרפות', async () => {
    api.games.get.mockResolvedValue(makeLive(GameState.WAITING_FOR_PLAYERS));
    renderAt('rooms/room-1', <LiveRoomPage />);
    expect(await screen.findByLabelText('קוד חדר 482913')).toBeTruthy();
    expect(screen.getByLabelText('QR להצטרפות')).toBeTruthy();
    expect(screen.getByText('https://opposites.example/join?code=482913')).toBeTruthy();
    expect(screen.getByText('נועה')).toBeTruthy();
    expect(screen.getByText('יובל')).toBeTruthy();
  });

  it('WAITING_FOR_PLAYERS: התחל משחק, סגור הצטרפות, בטל', async () => {
    api.games.get.mockResolvedValue(makeLive(GameState.WAITING_FOR_PLAYERS));
    renderAt('rooms/room-1', <LiveRoomPage />);
    const names = await controls();
    expect(names).toContain('התחל משחק');
    expect(names).toContain('סגור הצטרפות');
    expect(names).toContain('בטל');
    expect(names).not.toContain('השהה');
    expect(names).not.toContain('שאלה הבאה');
    expect(names).not.toContain('סיים משחק');
  });

  it('QUESTION_ACTIVE בקצב אישי: השהה וסיים, בלי "שאלה הבאה"', async () => {
    api.games.get.mockResolvedValue(makeLive(GameState.QUESTION_ACTIVE, GameMode.SELF_PACED));
    renderAt('rooms/room-1', <LiveRoomPage />);
    const names = await controls();
    expect(names).toContain('השהה');
    expect(names).toContain('סיים משחק');
    expect(names).not.toContain('שאלה הבאה');
    expect(names).not.toContain('התחל משחק');
  });

  it('QUESTION_RESULTS בקצב המורה: מציג "שאלה הבאה" ומספר שאלה', async () => {
    api.games.get.mockResolvedValue(makeLive(GameState.QUESTION_RESULTS, GameMode.TEACHER_PACED));
    api.games.next.mockResolvedValue(makeLive(GameState.QUESTION_ACTIVE, GameMode.TEACHER_PACED, { currentQuestionIndex: 4 }));
    renderAt('rooms/room-1', <LiveRoomPage />);
    const names = await controls();
    expect(names).toContain('שאלה הבאה');
    expect(screen.getByText('שאלה נוכחית')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /שאלה הבאה/ }));
    await waitFor(() => expect(api.games.next).toHaveBeenCalledWith('room-1'));
  });

  it('PAUSED: המשך', async () => {
    api.games.get.mockResolvedValue(makeLive(GameState.PAUSED));
    renderAt('rooms/room-1', <LiveRoomPage />);
    const names = await controls();
    expect(names).toContain('המשך');
    expect(names).toContain('סיים משחק');
    expect(names).not.toContain('השהה');
  });

  it('COMPLETED: סבב חדש, בלי התחל/בטל', async () => {
    api.games.get.mockResolvedValue(makeLive(GameState.COMPLETED));
    renderAt('rooms/room-1', <LiveRoomPage />);
    const names = await controls();
    expect(names).toContain('סבב חדש');
    expect(names).not.toContain('התחל משחק');
    expect(names).not.toContain('בטל');
  });

  it('סיום משחק דורש אישור ורק אז קורא ל־API', async () => {
    api.games.get.mockResolvedValue(makeLive(GameState.QUESTION_ACTIVE));
    api.games.finish.mockResolvedValue(makeLive(GameState.COMPLETED));
    renderAt('rooms/room-1', <LiveRoomPage />);
    fireEvent.click(await screen.findByRole('button', { name: /סיים משחק/ }));
    expect(api.games.finish).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'סיים משחק' }));
    await waitFor(() => expect(api.games.finish).toHaveBeenCalledWith('room-1'));
  });

  it('מתחבר ל־socket של החדר', async () => {
    api.games.get.mockResolvedValue(makeLive(GameState.WAITING_FOR_PLAYERS));
    renderAt('rooms/room-1', <LiveRoomPage />);
    await screen.findByLabelText('קוד חדר 482913');
    expect(fakeSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(fakeSocket.on).toHaveBeenCalledWith('room:updated', expect.any(Function));
  });
});
