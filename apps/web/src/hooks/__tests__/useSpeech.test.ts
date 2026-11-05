import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSpeechSupported, pickHebrewVoice, useSpeech } from '@/hooks/useSpeech';

type W = { speechSynthesis?: unknown; SpeechSynthesisUtterance?: unknown };

afterEach(() => {
  delete (window as unknown as W).speechSynthesis;
  delete (window as unknown as W).SpeechSynthesisUtterance;
});

function voice(lang: string, name = lang): SpeechSynthesisVoice {
  return { lang, name, default: false, localService: true, voiceURI: name } as SpeechSynthesisVoice;
}

function mockSpeech(voices: SpeechSynthesisVoice[] = []) {
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
  const queue: FakeUtterance[] = [];
  const synth = {
    speak: vi.fn((u: FakeUtterance) => {
      queue.push(u);
      u.onstart?.();
    }),
    cancel: vi.fn(),
    getVoices: vi.fn(() => voices),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  (window as unknown as W).speechSynthesis = synth;
  (window as unknown as W).SpeechSynthesisUtterance = FakeUtterance;
  return { synth, queue };
}

describe('useSpeech', () => {
  it('is safe without speechSynthesis (jsdom): supported=false and nothing throws', () => {
    expect(isSpeechSupported()).toBe(false);
    const { result } = renderHook(() => useSpeech());
    expect(result.current.supported).toBe(false);
    expect(result.current.speaking).toBe(false);
    expect(() => {
      act(() => {
        result.current.speak('שָׁלוֹם');
        result.current.cancel();
      });
    }).not.toThrow();
  });

  it('speaks with lang he-IL, prefers a Hebrew voice and cancels the previous utterance', () => {
    const he = voice('he-IL', 'Carmit');
    const { synth, queue } = mockSpeech([voice('en-US'), he]);
    const { result } = renderHook(() => useSpeech());
    expect(result.current.supported).toBe(true);

    act(() => result.current.speak('גָּדוֹל'));
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(queue[0]?.text).toBe('גָּדוֹל');
    expect(queue[0]?.lang).toBe('he-IL');
    expect(queue[0]?.voice).toBe(he);
    expect(result.current.speaking).toBe(true);

    act(() => result.current.speak('קָטָן'));
    expect(synth.cancel).toHaveBeenCalled();
    expect(queue[1]?.text).toBe('קָטָן');

    act(() => queue[1]?.onend?.());
    expect(result.current.speaking).toBe(false);
  });

  it('falls back to the default voice but still sets lang he-IL when no Hebrew voice exists', () => {
    const { queue } = mockSpeech([voice('en-US')]);
    const { result } = renderHook(() => useSpeech());
    act(() => result.current.speak('חַם'));
    expect(queue[0]?.lang).toBe('he-IL');
    expect(queue[0]?.voice).toBeNull();
  });

  it('ignores empty text and cancel() resets speaking', () => {
    const { synth } = mockSpeech();
    const { result } = renderHook(() => useSpeech());
    act(() => result.current.speak('   '));
    expect(synth.speak).not.toHaveBeenCalled();
    act(() => result.current.speak('קַר'));
    expect(result.current.speaking).toBe(true);
    act(() => result.current.cancel());
    expect(synth.cancel).toHaveBeenCalled();
    expect(result.current.speaking).toBe(false);
  });

  it('pickHebrewVoice prefers he-IL over other he-* voices', () => {
    const heX = voice('he', 'generic');
    const heIL = voice('he_IL', 'exact');
    expect(pickHebrewVoice([voice('en-US'), heX, heIL])).toBe(heIL);
    expect(pickHebrewVoice([voice('en-US'), heX])).toBe(heX);
    expect(pickHebrewVoice([voice('en-US')])).toBeNull();
  });
});
