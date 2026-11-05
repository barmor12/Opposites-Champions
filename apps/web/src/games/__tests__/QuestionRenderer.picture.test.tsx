import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { QuestionType, type AnswerPayload, type AnswerResult, type QuestionView } from '@oc/shared';
import { QuestionRenderer } from '../QuestionRenderer';
import { choiceQuestion, resultFor, stubCanvas } from './fixtures';

beforeAll(() => stubCanvas());
afterEach(() => {
  cleanup();
  delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
  delete (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
});

const WORDS = ['קַר', 'קָטָן', 'מָהִיר', 'לַיְלָה'];

function pictureQuestion(over: Partial<QuestionView> = {}): QuestionView {
  return choiceQuestion({
    sessionQuestionId: 'sq-p',
    type: QuestionType.PICTURE_TO_PICTURE,
    prompt: 'גָּדוֹל',
    promptImage: '/images/pairs/big-small/word.svg',
    options: [
      { id: 'a', text: 'קַר', image: '/images/pairs/hot-cold/opposite.svg' },
      { id: 'b', text: 'קָטָן', image: '/images/pairs/big-small/opposite.svg' },
      { id: 'c', text: 'מָהִיר', image: '/images/pairs/fast-slow/word.svg' },
      { id: 'd', text: 'לַיְלָה', image: '/images/pairs/day-night/opposite.svg' },
    ],
    ...over,
  });
}

/** speechSynthesis מזויף – מחזיר את ה־utterances שנאמרו */
function mockSpeech() {
  const spoken: Array<{ text: string; lang: string; voice: SpeechSynthesisVoice | null }> = [];
  class FakeUtterance {
    text: string;
    lang = '';
    voice: SpeechSynthesisVoice | null = null;
    rate = 1;
    pitch = 1;
    volume = 1;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  const synth = {
    speak: vi.fn((u: FakeUtterance) => {
      spoken.push({ text: u.text, lang: u.lang, voice: u.voice });
      u.onstart?.();
    }),
    cancel: vi.fn(),
    getVoices: vi.fn(() => [
      { lang: 'en-US', name: 'English', default: true, localService: true, voiceURI: 'en' },
      { lang: 'he-IL', name: 'Carmit', default: false, localService: true, voiceURI: 'he' },
    ] as SpeechSynthesisVoice[]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  (window as unknown as { speechSynthesis: unknown }).speechSynthesis = synth;
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance;
  return { synth, spoken };
}

function setup(opts: { answer?: (p: AnswerPayload) => Promise<AnswerResult>; show?: boolean; q?: QuestionView; sounds?: boolean } = {}) {
  const q = opts.q ?? pictureQuestion();
  const onAnswer = vi.fn(opts.answer ?? (async () => resultFor(q)));
  const onNext = vi.fn();
  const utils = render(
    <QuestionRenderer
      question={q}
      result={null}
      onAnswer={onAnswer}
      onNext={onNext}
      soundsEnabled={opts.sounds ?? false}
      showCorrectAnswers={opts.show ?? true}
      serverOffsetMs={0}
    />,
  );
  return { q, onAnswer, onNext, ...utils };
}

/** טקסט גלוי בלבד (ללא alt / aria-label) */
function visibleText(el: HTMLElement): string {
  return el.textContent ?? '';
}

describe('QuestionRenderer – PICTURE_TO_PICTURE', () => {
  it('renders a large prompt image and 4 image tiles without any visible word text', () => {
    const { container } = setup();
    const renderer = screen.getByTestId('question-renderer');
    expect(renderer.dataset.type).toBe('PICTURE_TO_PICTURE');

    // prompt image with the word as alt only
    const promptImg = within(screen.getByTestId('prompt-image')).getByRole('img', { name: 'גָּדוֹל' });
    expect(promptImg.getAttribute('src')).toBe('/images/pairs/big-small/word.svg');
    expect(screen.queryByTestId('prompt-word')).toBeNull();

    // four tiles, each an image, labelled for screen readers only
    for (let i = 1; i <= 4; i++) {
      const tile = screen.getByTestId(`option-${i}`);
      expect(tile.querySelector('img')).not.toBeNull();
      expect(tile.getAttribute('aria-label')).toBe(WORDS[i - 1]);
    }
    expect(screen.getByTestId('options').querySelectorAll('img')).toHaveLength(4);

    // no visible word anywhere (prompt or options)
    const text = visibleText(container as HTMLElement);
    expect(text).not.toContain('גָּדוֹל');
    for (const w of WORDS) expect(text).not.toContain(w);
    // number badges 1..4 are kept for keyboard digits
    expect(visibleText(screen.getByTestId('option-3'))).toContain('3');
  });

  it('submits { sessionQuestionId, optionId } when a tile is clicked and shows picture feedback', async () => {
    const { onAnswer } = setup();
    fireEvent.click(screen.getByTestId('option-2'));
    expect(onAnswer).toHaveBeenCalledWith({ sessionQuestionId: 'sq-p', optionId: 'b' });
    await waitFor(() => expect(screen.getByTestId('feedback-panel').dataset.kind).toBe('correct'));
    expect(screen.getByTestId('feedback-panel').dataset.variant).toBe('picture');
    expect(screen.getByTestId('feedback-icon')).toBeTruthy();
    expect(screen.getByTestId('option-2').dataset.state).toBe('correct');
    expect(screen.getByTestId('next-button')).toBeTruthy();
    // caption revealed only after the result
    expect(within(screen.getByTestId('option-2')).getByTestId('option-caption').textContent).toBe('קָטָן');
  });

  it('selects tiles with digit keys 1-4', async () => {
    const { onAnswer } = setup();
    await act(async () => {
      fireEvent.keyDown(window, { key: '4' });
    });
    expect(onAnswer).toHaveBeenCalledWith({ sessionQuestionId: 'sq-p', optionId: 'd' });
  });

  it('reveals the correct tile and its image in the feedback on a wrong answer', async () => {
    const q = pictureQuestion();
    const wrong = resultFor(q, { correct: false, scoreAwarded: 0, streak: 0, correctOptionId: 'b' });
    setup({ q, answer: async () => wrong });
    fireEvent.click(screen.getByTestId('option-1'));
    await waitFor(() => expect(screen.getByTestId('feedback-panel').dataset.kind).toBe('wrong'));
    expect(screen.getByTestId('option-1').dataset.state).toBe('wrong');
    expect(screen.getByTestId('option-2').dataset.state).toBe('reveal');
    const fig = screen.getByTestId('correct-answer-image');
    expect(fig.querySelector('img')?.getAttribute('src')).toBe('/images/pairs/big-small/opposite.svg');
    expect(screen.getByTestId('correct-answer-text').textContent).toBe('קָטָן');
    expect(screen.getByTestId('feedback-panel').textContent).not.toMatch(/טָעוּת|נִכְשַׁל|לֹא נָכוֹן/);
  });

  it('hides speaker buttons when speechSynthesis is unavailable', () => {
    setup();
    expect(screen.queryByTestId('speak-prompt')).toBeNull();
    expect(screen.queryByTestId('speak-option-1')).toBeNull();
  });

  it('speaks the word on the speaker buttons without selecting the option', async () => {
    const { synth, spoken } = mockSpeech();
    const { onAnswer } = setup();

    fireEvent.click(screen.getByTestId('speak-prompt'));
    expect(spoken.at(-1)).toMatchObject({ text: 'גָּדוֹל', lang: 'he-IL' });
    expect(spoken.at(-1)?.voice?.lang).toBe('he-IL');

    fireEvent.click(screen.getByTestId('speak-option-3'));
    expect(spoken.at(-1)).toMatchObject({ text: 'מָהִיר', lang: 'he-IL' });
    expect(synth.cancel).toHaveBeenCalled();

    // the speaker never submits an answer
    expect(onAnswer).not.toHaveBeenCalled();
    expect(screen.queryByTestId('feedback-panel')).toBeNull();
  });

  it('auto-speaks the prompt word once on mount when sounds are enabled, and not when disabled', () => {
    vi.useFakeTimers();
    try {
      const { spoken } = mockSpeech();
      const first = setup({ sounds: true });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(spoken.map((s) => s.text)).toEqual(['גָּדוֹל']);
      first.unmount();

      spoken.length = 0;
      setup({ sounds: false });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(spoken).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
