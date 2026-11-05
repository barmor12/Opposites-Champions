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
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('אַלּוּפֵי');
    expect(screen.getByText('מִי יִהְיֶה אַלּוּף הַהֲפָכִים שֶׁל הַכִּיתָּה?')).toBeTruthy();
    expect(screen.getByLabelText('מָה הַשֵּׁם שֶׁלְּךָ?')).toBeTruthy();
    expect(screen.getByLabelText('קוֹד הַמִּשְׂחָק')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(16);
    expect(screen.getByRole('button', { name: /בּוֹאוּ נְשַׂחֵק/ })).toBeTruthy();
  });

  it('requires a name, a 6-digit code and an avatar', async () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: /בּוֹאוּ נְשַׂחֵק/ }));
    const alerts = await screen.findAllByRole('alert');
    const text = alerts.map((a) => a.textContent).join(' | ');
    expect(text).toContain('כָּתְבוּ שֵׁם');
    expect(text).toContain('קוֹד הַמִּשְׂחָק');
    expect(text).toContain('בַּחֲרוּ דְּמוּת');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('rejects a short code and strips non-digits', async () => {
    renderHome();
    fireEvent.change(screen.getByLabelText('מָה הַשֵּׁם שֶׁלְּךָ?'), { target: { value: 'נוֹעָה' } });
    const code = screen.getByLabelText('קוֹד הַמִּשְׂחָק') as HTMLInputElement;
    fireEvent.change(code, { target: { value: '12a3' } });
    expect(code.value).toBe('123');
    expect(code.getAttribute('dir')).toBe('ltr');
    fireEvent.click(screen.getByRole('radio', { name: 'שׁוּעָל' }));
    fireEvent.click(screen.getByRole('button', { name: /בּוֹאוּ נְשַׂחֵק/ }));
    await screen.findByText('הַקּוֹד צָרִיךְ לִהְיוֹת 6 סְפָרוֹת');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('rejects a one-letter name', async () => {
    renderHome();
    fireEvent.change(screen.getByLabelText('מָה הַשֵּׁם שֶׁלְּךָ?'), { target: { value: 'א' } });
    fireEvent.click(screen.getByRole('button', { name: /בּוֹאוּ נְשַׂחֵק/ }));
    await screen.findByText('הַשֵּׁם קָצָר מִדַּי');
  });

  it('prefills the code from /join/:code', () => {
    renderHome('/join/654321');
    expect((screen.getByLabelText('קוֹד הַמִּשְׂחָק') as HTMLInputElement).value).toBe('654321');
  });

  it('joins, greets and navigates to /play', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      participantId: 'p1',
      sessionToken: 'tok',
      displayName: 'נוֹעָה',
      avatar: 'fox',
      room: {
        roomId: 'r', code: '123456', className: 'ג׳1', state: 'WAITING_FOR_PLAYERS', joinOpen: true, mode: 'SELF_PACED',
        participantCount: 1, questionCount: 10, currentQuestionIndex: null,
        settings: { timePerQuestionSec: 20, showLeaderboard: true, showCorrectAnswers: true, soundsEnabled: true, competitionEnabled: true },
      },
    });
    renderHome();
    fireEvent.change(screen.getByLabelText('מָה הַשֵּׁם שֶׁלְּךָ?'), { target: { value: 'נוֹעָה' } });
    fireEvent.change(screen.getByLabelText('קוֹד הַמִּשְׂחָק'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('radio', { name: 'שׁוּעָל' }));
    fireEvent.click(screen.getByRole('button', { name: /בּוֹאוּ נְשַׂחֵק/ }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/rooms/join', { code: '123456', displayName: 'נוֹעָה', avatar: 'fox' }));
    await screen.findByText(/שָׁלוֹם נוֹעָה/);
    await waitFor(() => expect(screen.queryByText('PLAY')).toBeTruthy(), { timeout: 4000 });
  }, 8000);
});
