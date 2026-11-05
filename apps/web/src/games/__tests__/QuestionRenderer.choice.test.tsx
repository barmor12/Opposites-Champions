import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AnswerPayload, AnswerResult } from '@oc/shared';
import { QuestionRenderer } from '../QuestionRenderer';
import { choiceQuestion, resultFor, stubCanvas } from './fixtures';

beforeAll(() => stubCanvas());
afterEach(() => cleanup());

function setup(opts: { result?: AnswerResult | null; answer?: (p: AnswerPayload) => Promise<AnswerResult>; show?: boolean; q?: ReturnType<typeof choiceQuestion> } = {}) {
  const q = opts.q ?? choiceQuestion();
  const onAnswer = vi.fn(opts.answer ?? (async () => resultFor(q)));
  const onNext = vi.fn();
  const utils = render(
    <QuestionRenderer
      question={q}
      result={opts.result ?? null}
      onAnswer={onAnswer}
      onNext={onNext}
      soundsEnabled={false}
      showCorrectAnswers={opts.show ?? true}
      serverOffsetMs={0}
    />,
  );
  return { q, onAnswer, onNext, ...utils };
}

describe('QuestionRenderer – choice types', () => {
  it('renders the prompt and 4 options with keyboard hints', () => {
    setup();
    expect(screen.getByTestId('prompt-word').textContent).toBe('גָּדוֹל');
    const options = screen.getAllByRole('button', { name: /אָרוֹךְ|קָטָן|חַם|מָהִיר/ });
    expect(options).toHaveLength(4);
  });

  it('submits { sessionQuestionId, optionId } on click and shows success feedback', async () => {
    const { onAnswer } = setup();
    fireEvent.click(screen.getByTestId('option-2'));
    expect(onAnswer).toHaveBeenCalledWith({ sessionQuestionId: 'sq-1', optionId: 'b' });
    await waitFor(() => expect(screen.getByTestId('feedback-panel').dataset.kind).toBe('correct'));
    expect(screen.getByTestId('score-badge').textContent).toContain('+120 נְקוּדּוֹת');
    expect(screen.getByTestId('option-2').dataset.state).toBe('correct');
    expect(screen.getByTestId('next-button')).toBeTruthy();
  });

  it('locks input after the first click (no double submit)', async () => {
    const { onAnswer } = setup();
    fireEvent.click(screen.getByTestId('option-1'));
    fireEvent.click(screen.getByTestId('option-3'));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    await waitFor(() => screen.getByTestId('feedback-panel'));
  });

  it('shows encouraging wrong feedback, reveals the correct option and explanation', async () => {
    const q = choiceQuestion();
    const wrong = resultFor(q, { correct: false, scoreAwarded: 0, streak: 0, correctOptionId: 'b', explanation: 'גָּדוֹל וְקָטָן הֵם הֲפָכִים' });
    setup({ q, answer: async () => wrong });
    fireEvent.click(screen.getByTestId('option-1'));
    await waitFor(() => expect(screen.getByTestId('feedback-panel').dataset.kind).toBe('wrong'));
    expect(screen.getByTestId('option-1').dataset.state).toBe('wrong');
    expect(screen.getByTestId('option-2').dataset.state).toBe('reveal');
    expect(screen.getByTestId('correct-answer-text').textContent).toContain('קָטָן');
    expect(screen.getByTestId('explanation').textContent).toContain('גָּדוֹל וְקָטָן הֵם הֲפָכִים');
    // never negative tone
    expect(screen.getByTestId('feedback-panel').textContent).not.toMatch(/טָעוּת|נִכְשַׁל|לֹא נָכוֹן/);
  });

  it('does not reveal the correct option when showCorrectAnswers is false', async () => {
    const q = choiceQuestion();
    const wrong = resultFor(q, { correct: false, scoreAwarded: 0, correctOptionId: 'b' });
    setup({ q, answer: async () => wrong, show: false });
    fireEvent.click(screen.getByTestId('option-1'));
    await waitFor(() => screen.getByTestId('feedback-panel'));
    expect(screen.getByTestId('option-2').dataset.state).toBe('dim');
    expect(screen.queryByTestId('correct-answer-text')).toBeNull();
  });

  it('renders feedback from the result prop (shell-driven) and calls onNext from the button and Enter', async () => {
    const q = choiceQuestion();
    const { onNext, rerender } = setup({ q });
    fireEvent.click(screen.getByTestId('option-2'));
    rerender(
      <QuestionRenderer question={q} result={resultFor(q, { scoreAwarded: 150 })} onAnswer={async () => resultFor(q)} onNext={onNext} soundsEnabled={false} showCorrectAnswers serverOffsetMs={0} />,
    );
    await waitFor(() => screen.getByTestId('next-button'));
    expect(screen.getByTestId('score-badge').textContent).toContain('+150');
    fireEvent.click(screen.getByTestId('next-button'));
    expect(onNext).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onNext).toHaveBeenCalledTimes(1); // guarded – only once per question
  });

  it('selects options with digit keys 1-4', async () => {
    const { onAnswer } = setup();
    await act(async () => {
      fireEvent.keyDown(window, { key: '3' });
    });
    expect(onAnswer).toHaveBeenCalledWith({ sessionQuestionId: 'sq-1', optionId: 'c' });
  });

  it('disables input and shows a gentle timeout message when endsAt has passed (respecting serverOffsetMs)', () => {
    const q = choiceQuestion({ timeLimitMs: 15000, endsAt: Date.now() + 5000 });
    const onAnswer = vi.fn(async () => resultFor(q));
    render(
      <QuestionRenderer question={q} result={null} onAnswer={onAnswer} onNext={() => undefined} soundsEnabled={false} showCorrectAnswers serverOffsetMs={10000} />,
    );
    expect(screen.getByTestId('feedback-panel').dataset.kind).toBe('timeout');
    fireEvent.click(screen.getByTestId('option-1'));
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('renders the treasure path for treasure questions and the overlay when the treasure is completed', async () => {
    vi.useFakeTimers();
    try {
      const q = choiceQuestion({ isTreasure: true, treasureStep: 5, treasureTotal: 5 });
      const done = resultFor(q, { treasureCompleted: true, treasureBonus: 150, scoreAwarded: 250 });
      render(
        <QuestionRenderer question={q} result={done} onAnswer={async () => done} onNext={() => undefined} soundsEnabled={false} showCorrectAnswers serverOffsetMs={0} />,
      );
      expect(screen.getByTestId('treasure-path').getAttribute('aria-label')).toContain('שָׁלָב 5 מִתּוֹךְ 5');
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('treasure-overlay').textContent).toContain('מָצָאתָ אֶת הָאוֹצָר');
      expect(screen.getByTestId('treasure-overlay').textContent).toContain('+150 בּוֹנוּס');
    } finally {
      vi.useRealTimers();
    }
  });

  it('fills the sentence blank with the chosen word (COMPLETE_SENTENCE)', async () => {
    const q = choiceQuestion({ type: 'COMPLETE_SENTENCE', prompt: 'בַּקַּיִץ חַם וּבַחוֹרֶף ____' });
    setup({ q });
    expect(screen.getByTestId('sentence-blank').textContent).toBe('____');
    fireEvent.click(screen.getByTestId('option-2'));
    await waitFor(() => expect(screen.getByTestId('sentence-blank').textContent).toBe('קָטָן'));
  });
});
