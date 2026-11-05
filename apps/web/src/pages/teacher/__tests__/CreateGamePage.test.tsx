import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { GameMode, type GameSettings } from '@oc/shared';
import { CreateGamePage } from '../CreateGamePage';
import { teacherApi } from '@/services/teacherApi';
import { PROFILE, makeSummary, renderAt, resetStore } from './testUtils';

vi.mock('@/services/teacherApi', () => ({
  teacherApi: {
    auth: { login: vi.fn(), logout: vi.fn(), me: vi.fn() },
    games: { create: vi.fn() },
    wordPairs: {},
    categories: {},
    media: {},
  },
}));

const api = vi.mocked(teacherApi, true);

describe('CreateGamePage', () => {
  beforeEach(() => {
    resetStore({ authStatus: 'authenticated', profile: PROFILE });
  });

  it('בונה GameSettings נכון ומנווט לחדר החי', async () => {
    api.games.create.mockResolvedValue(makeSummary({ roomId: 'room-xyz' }));
    renderAt('new', <CreateGamePage />);

    fireEvent.change(screen.getByLabelText('שם הכיתה'), { target: { value: '  כיתה ג׳2 ' } });
    fireEvent.click(screen.getByRole('radio', { name: '15 שאלות' }));
    fireEvent.click(screen.getByRole('radio', { name: 'קשה' }));
    fireEvent.click(screen.getByRole('radio', { name: 'ללא הגבלה' }));
    // מורידים קטגוריה אחת (כולן נבחרות כברירת מחדל)
    fireEvent.click(screen.getByRole('checkbox', { name: 'רגשות' }));
    // מורידים סוג שאלה אחד
    fireEvent.click(screen.getByRole('checkbox', { name: 'בחירת תמונה' }));
    // אתגר האוצר
    fireEvent.click(screen.getByRole('switch', { name: /אתגר האוצר/ }));
    // קצב המורה
    fireEvent.click(screen.getByRole('radio', { name: /קצב המורה/ }));
    // כיבוי צלילים
    fireEvent.click(screen.getByRole('switch', { name: 'צלילים' }));

    fireEvent.click(screen.getByRole('button', { name: /יצירת חדר/ }));

    await waitFor(() => expect(api.games.create).toHaveBeenCalledTimes(1));
    const payload = api.games.create.mock.calls[0]?.[0] as GameSettings;
    expect(payload).toEqual({
      className: 'כיתה ג׳2',
      questionCount: 15,
      difficulty: 'HARD',
      categories: [
        'SIZES',
        'COLORS_LIGHT',
        'ACTIONS',
        'TIME_SPEED',
        'DIRECTIONS_PLACES',
        'ANIMALS_NATURE',
        'TRAITS_STATES',
        'OBJECTS_ENVIRONMENT',
        'CHALLENGING',
      ],
      timePerQuestionSec: 0,
      questionTypes: ['CHOOSE_OPPOSITE', 'MATCH_PAIRS', 'COMPLETE_SENTENCE'],
      mode: GameMode.TEACHER_PACED,
      competitionEnabled: true,
      showLeaderboard: true,
      showCorrectAnswers: true,
      soundsEnabled: false,
      treasureChallenge: true,
    });
    await waitFor(() => expect(screen.getByTestId('marker-room')).toBeTruthy());
  });

  it('לא שולח כשחסר שם כיתה או קטגוריות', async () => {
    renderAt('new', <CreateGamePage />);
    fireEvent.click(screen.getByRole('button', { name: 'בחירת הכול' })); // מבטל את כל הקטגוריות
    fireEvent.click(screen.getByRole('button', { name: /יצירת חדר/ }));
    expect(await screen.findByText('יש להזין שם כיתה')).toBeTruthy();
    expect(screen.getByText('יש לבחור לפחות קטגוריה אחת')).toBeTruthy();
    expect(api.games.create).not.toHaveBeenCalled();
  });
});
