import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useSpeech – הקראה קולית (TTS) בעברית באמצעות `window.speechSynthesis`.
 * - מעדיף קול `he-IL` / `he*` אם קיים; אחרת קול ברירת המחדל עם `lang='he-IL'`.
 * - `speak` מבטל הקראה קודמת לפני שמתחיל חדשה.
 * - בטוח לחלוטין בסביבה ללא תמיכה (SSR / jsdom): `supported=false` ואף פונקציה לא זורקת.
 */
export interface UseSpeechResult {
  supported: boolean;
  speak: (text: string) => void;
  cancel: () => void;
  speaking: boolean;
}

export const SPEECH_LANG = 'he-IL';

type Synth = SpeechSynthesis;

function getSynth(): Synth | null {
  try {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as { speechSynthesis?: Synth; SpeechSynthesisUtterance?: unknown };
    if (!w.speechSynthesis || typeof w.SpeechSynthesisUtterance !== 'function') return null;
    return w.speechSynthesis;
  } catch {
    return null;
  }
}

/** האם יש תמיכה ב־TTS בדפדפן הנוכחי (ללא תלות ב־React) */
export function isSpeechSupported(): boolean {
  return getSynth() !== null;
}

/** בחירת קול עברי: `he-IL` מדויק קודם, אחר כך כל קול שמתחיל ב־`he` */
export function pickHebrewVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const norm = (l: string) => l.toLowerCase().replace('_', '-');
  const exact = voices.find((v) => norm(v.lang) === 'he-il');
  if (exact) return exact;
  const any = voices.find((v) => norm(v.lang).startsWith('he'));
  return any ?? null;
}

function readVoices(synth: Synth): SpeechSynthesisVoice[] {
  try {
    return synth.getVoices?.() ?? [];
  } catch {
    return [];
  }
}

export function useSpeech(): UseSpeechResult {
  const [supported] = useState<boolean>(() => isSpeechSupported());
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const currentRef = useRef<SpeechSynthesisUtterance | null>(null);
  const mounted = useRef(true);

  // טעינת קולות (ב־Chrome הרשימה נטענת אסינכרונית → voiceschanged)
  useEffect(() => {
    mounted.current = true;
    const synth = getSynth();
    if (!synth) return undefined;
    const load = () => {
      voiceRef.current = pickHebrewVoice(readVoices(synth));
    };
    load();
    try {
      synth.addEventListener?.('voiceschanged', load);
    } catch {
      /* ignore */
    }
    return () => {
      mounted.current = false;
      try {
        synth.removeEventListener?.('voiceschanged', load);
      } catch {
        /* ignore */
      }
      // עוצרים הקראה שהרכיב התחיל, כדי שלא תימשך אחרי unmount (מעבר שאלה)
      if (currentRef.current) {
        try {
          synth.cancel();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const cancel = useCallback(() => {
    const synth = getSynth();
    currentRef.current = null;
    if (!synth) return;
    try {
      synth.cancel();
    } catch {
      /* ignore */
    }
    if (mounted.current) setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    const synth = getSynth();
    const clean = (text ?? '').trim();
    if (!synth || !clean) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = SPEECH_LANG;
      if (!voiceRef.current) voiceRef.current = pickHebrewVoice(readVoices(synth));
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = 0.9;
      u.pitch = 1.05;
      u.volume = 1;
      const done = () => {
        if (currentRef.current === u) currentRef.current = null;
        if (mounted.current) setSpeaking(false);
      };
      u.onstart = () => {
        if (mounted.current) setSpeaking(true);
      };
      u.onend = done;
      u.onerror = done;
      currentRef.current = u;
      synth.speak(u);
    } catch {
      currentRef.current = null;
      if (mounted.current) setSpeaking(false);
    }
  }, []);

  return { supported, speak, cancel, speaking };
}

export default useSpeech;
