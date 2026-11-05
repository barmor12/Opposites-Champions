import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { LoginPage } from '../LoginPage';
import { teacherApi } from '@/services/teacherApi';
import { PROFILE, renderAt, resetStore } from './testUtils';

vi.mock('@/services/teacherApi', () => ({
  teacherApi: {
    auth: { login: vi.fn(), logout: vi.fn(), me: vi.fn() },
    games: {},
    wordPairs: {},
    categories: {},
    media: {},
  },
}));

const api = vi.mocked(teacherApi, true);

describe('LoginPage', () => {
  beforeEach(() => {
    resetStore({ authStatus: 'anonymous' });
  });

  it('שולח אימייל וסיסמה ומנווט ללוח הבקרה', async () => {
    api.auth.login.mockResolvedValue(PROFILE);
    renderAt('login', <LoginPage />);

    fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: 'teacher@school.edu' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /התחברות/ }));

    await waitFor(() => expect(api.auth.login).toHaveBeenCalledWith('teacher@school.edu', 'secret123'));
    await waitFor(() => expect(screen.getByTestId('marker-dashboard')).toBeTruthy());
  });

  it('מציג שגיאת ולידציה בלי לקרוא ל־API', async () => {
    renderAt('login', <LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: /התחברות/ }));
    expect(await screen.findByText('יש להזין כתובת אימייל')).toBeTruthy();
    expect(api.auth.login).not.toHaveBeenCalled();
  });

  it('מציג הודעה ידידותית כשההתחברות נכשלת (401)', async () => {
    api.auth.login.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    renderAt('login', <LoginPage />);
    fireEvent.change(screen.getByLabelText('אימייל'), { target: { value: 'teacher@school.edu' } });
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /התחברות/ }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'האימייל או הסיסמה שגויים. נסו שוב.');
  });

  it('מפנה ללוח הבקרה כשכבר מחוברים', async () => {
    resetStore({ authStatus: 'authenticated', profile: PROFILE });
    renderAt('login', <LoginPage />);
    await waitFor(() => expect(screen.getByTestId('marker-dashboard')).toBeTruthy());
  });
});
