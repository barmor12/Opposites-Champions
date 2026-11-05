import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AnswerPayload, AnswerResult, MatchAnswerPayload } from '@oc/shared';
import { QuestionRenderer } from '../QuestionRenderer';
import { matchQuestion, resultFor, stubCanvas } from './fixtures';

beforeAll(() => stubCanvas());
afterEach(() => cleanup());

const CORRECT = [
  { cardA: 'c-big', cardB: 'c-small' },
  { cardA: 'c-hot', cardB: 'c-cold' },
  { cardA: 'c-happy', cardB: 'c-sad' },
  { cardA: 'c-fast', cardB: 'c-slow' },
];

const card = (id: string) => document.querySelector(`[data-card-id="${id}"]`) as HTMLButtonElement;

describe('QuestionRenderer – MATCH_PAIRS', () => {
  it('collects pairs, allows unlinking (counted as a mistake) and submits when all pairs are linked', async () => {
    const q = matchQuestion();
    const onAnswer = vi.fn(async (p: AnswerPayload): Promise<AnswerResult> => {
      const mp = p as MatchAnswerPayload;
      return resultFor(q, { correct: true, correctMatches: CORRECT, scoreAwarded: 150 - mp.mistakes });
    });
    render(<QuestionRenderer question={q} result={null} onAnswer={onAnswer} onNext={() => undefined} soundsEnabled={false} showCorrectAnswers serverOffsetMs={0} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(screen.queryByTestId('check-button')).toBeNull();

    // link big-small
    fireEvent.click(card('c-big'));
    expect(card('c-big').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(card('c-small'));
    expect(card('c-big').dataset.linked).toBe('true');
    expect(card('c-small').dataset.linked).toBe('true');

    // change of mind: unlink by tapping a linked card
    fireEvent.click(card('c-small'));
    expect(card('c-big').dataset.linked).toBe('false');

    // link all four (one wrong on purpose: hot-sad, happy-cold)
    fireEvent.click(card('c-big'));
    fireEvent.click(card('c-small'));
    fireEvent.click(card('c-hot'));
    fireEvent.click(card('c-sad'));
    fireEvent.click(card('c-happy'));
    fireEvent.click(card('c-cold'));
    fireEvent.click(card('c-fast'));
    fireEvent.click(card('c-slow'));

    const check = await screen.findByTestId('check-button');
    fireEvent.click(check);
    expect(onAnswer).toHaveBeenCalledTimes(1);
    const payload = onAnswer.mock.calls[0]?.[0] as MatchAnswerPayload;
    expect(payload.sessionQuestionId).toBe('sq-m');
    expect(payload.mistakes).toBe(1);
    expect(payload.matches).toEqual([
      { cardA: 'c-big', cardB: 'c-small' },
      { cardA: 'c-hot', cardB: 'c-sad' },
      { cardA: 'c-happy', cardB: 'c-cold' },
      { cardA: 'c-fast', cardB: 'c-slow' },
    ]);

    await waitFor(() => screen.getByTestId('feedback-panel'));
    expect(card('c-big').dataset.result).toBe('correct');
    expect(card('c-hot').dataset.result).toBe('wrong');
    // correct pairs revealed for the missed ones
    expect(screen.getByTestId('correct-pairs').textContent).toContain('חם');
    expect(screen.getByTestId('correct-pairs').textContent).toContain('קר');
  });

  it('ignores taps after submission', async () => {
    const q = matchQuestion();
    const onAnswer = vi.fn(async () => resultFor(q, { correctMatches: CORRECT }));
    render(<QuestionRenderer question={q} result={null} onAnswer={onAnswer} onNext={() => undefined} soundsEnabled={false} showCorrectAnswers serverOffsetMs={0} />);
    for (const [a, b] of CORRECT.map((c) => [c.cardA, c.cardB] as const)) {
      fireEvent.click(card(a));
      fireEvent.click(card(b));
    }
    fireEvent.click(await screen.findByTestId('check-button'));
    await waitFor(() => screen.getByTestId('feedback-panel'));
    fireEvent.click(card('c-big'));
    expect(card('c-big').dataset.linked).toBe('true');
    expect(screen.getByTestId('feedback-panel').dataset.kind).toBe('correct');
  });
});
