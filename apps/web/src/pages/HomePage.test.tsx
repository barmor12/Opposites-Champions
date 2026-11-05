import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '@/services/api';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

vi.mock('@/hooks/useSound', () => ({
  useSound: () => ({ play: vi.fn(), enabled: true, setEnabled: vi.fn() }),
}));
vi.mock('@/animations', () => ({
  FloatingStars: () => null,
  Confetti: () => null,
}));
vi.mock('@/services/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('@/services/api');
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn(), url: actual.apiClient.url } };
});

import { apiClient } from '@/services/api';
import { usePlayerStore, initialPlayerState } from '@/stores/playerStore';
import { HomePage } from './HomePage';

function renderHome(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/join/:code" element={<HomePage />} />
        <Route path="/play" element={<div>PLAY</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    usePlayerStore.setState({ ...initialPlayerState, token: null, leaderboard: [] });
  });

  it('renders title and join form', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('אלופי');
    expect(screen.getByText('מי יהיה אלוף ההפכים של הכיתה?')).toBeTruthy();
    expect(screen.getByLabelText('מה השם שלך?')).toBeTruthy();
    expect(screen.getByLabelText('קוד המשחק')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(16);
    expect(screen.getByRole('button', { name: /בואו נשחק/ })).toBeTruthy();
  });

  it('requires a name, a 6-digit code and an avatar', async () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: /בואו נשחק/ }));
    const alerts = await screen.findAllByRole('alert');
    const text = alerts.map((a) => a.textContent).join(' | ');
    expect(text).toContain('כתבו שם');
    expect(text).toContain('קוד המשחק');
    expect(text).toContain('בחרו דמות');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('rejects a short code and strips non-digits', async () => {
    renderHome();
    fireEvent.change(screen.getByLabelText('מה השם שלך?'), { target: { value: 'נועה' } });
    const code = screen.getByLabelText('קוד המשחק') as HTMLInputElement;
    fireEvent.change(code, { target: { value: '12a3' } });
    expect(code.value).toBe('123');
    expect(code.getAttribute('dir')).toBe('ltr');
    fireEvent.click(screen.getByRole('radio', { name: 'שועל' }));
    fireEvent.click(screen.getByRole('button', { name: /בואו נשחק/ }));
    await screen.findByText('הקוד צריך להיות 6 ספרות');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('rejects a one-letter name', async () => {
    renderHome();
    fireEvent.change(screen.getByLabelText('מה השם שלך?'), { target: { value: 'א' } });
    fireEvent.click(screen.getByRole('button', { name: /בואו נשחק/ }));
    await screen.findByText('השם קצר מדי');
  });

  it('prefills the code from /join/:code', () => {
    renderHome('/join/654321');
    expect((screen.getByLabelText('קוד המשחק') as HTMLInputElement).value).toBe('654321');
  });

  it('joins, greets and navigates to /play', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      participantId: 'p1',
      sessionToken: 'tok',
      displayName: 'נועה',
      avatar: 'fox',
      room: {
        roomId: 'r', code: '123456', className: 'ג׳1', state: 'WAITING_FOR_PLAYERS', joinOpen: true, mode: 'SELF_PACED',
        participantCount: 1, questionCount: 10, currentQuestionIndex: null,
        settings: { timePerQuestionSec: 20, showLeaderboard: true, showCorrectAnswers: true, soundsEnabled: true, competitionEnabled: true },
      },
    });
    renderHome();
    fireEvent.change(screen.getByLabelText('מה השם שלך?'), { target: { value: 'נועה' } });
    fireEvent.change(screen.getByLabelText('קוד המשחק'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('radio', { name: 'שועל' }));
    fireEvent.click(screen.getByRole('button', { name: /בואו נשחק/ }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/rooms/join', { code: '123456', displayName: 'נועה', avatar: 'fox' }));
    await screen.findByText(/שלום נועה/);
    await waitFor(() => expect(screen.queryByText('PLAY')).toBeTruthy(), { timeout: 4000 });
  }, 8000);
});
