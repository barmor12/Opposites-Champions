import { useCallback, useSyncExternalStore } from 'react';

/**
 * useSound – צלילים מקוריים קצרים המסונתזים ב־WebAudio (ללא קבצי אודיו).
 * - מצב "מופעל/כבוי" נשמר ב־localStorage תחת המפתח `oc.sounds` (ברירת מחדל: מופעל).
 * - AudioContext נוצר בעצלתיים בפעם הראשונה שמנגנים (בתוך מחוות משתמש).
 * - לעולם לא זורק שגיאה אם WebAudio אינו זמין (למשל ב־jsdom).
 * - חנות מודולרית קטנה + useSyncExternalStore כדי שכל הרכיבים יישארו מסונכרנים.
 */

export type SoundName = 'correct' | 'wrong' | 'click' | 'tick' | 'fanfare' | 'join' | 'flip' | 'treasure';

export const SOUNDS_STORAGE_KEY = 'oc.sounds';

// ---------- store ----------
type Listener = () => void;
const listeners = new Set<Listener>();

function readPersisted(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    const raw = localStorage.getItem(SOUNDS_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== 'false' && raw !== '0';
  } catch {
    return true;
  }
}

let enabledState: boolean = readPersisted();

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore listener errors */
    }
  });
}

export function getSoundsEnabled(): boolean {
  return enabledState;
}

export function setSoundsEnabled(value: boolean): void {
  const next = Boolean(value);
  if (next === enabledState) return;
  enabledState = next;
  try {
    localStorage.setItem(SOUNDS_STORAGE_KEY, next ? 'true' : 'false');
  } catch {
    /* storage unavailable – keep in memory only */
  }
  emit();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// sync between tabs
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  try {
    window.addEventListener('storage', (e) => {
      if (e.key === SOUNDS_STORAGE_KEY) {
        const next = readPersisted();
        if (next !== enabledState) {
          enabledState = next;
          emit();
        }
      }
    });
  } catch {
    /* ignore */
  }
}

// ---------- audio engine ----------
type Ctx = AudioContext;
let ctx: Ctx | null = null;

function getCtx(): Ctx | null {
  try {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      return ctx;
    }
    const w = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

interface ToneOpts {
  freq: number;
  start: number; // seconds offset from now
  dur: number; // seconds
  type?: OscillatorType;
  gain?: number;
  glideTo?: number; // optional end frequency
  attack?: number;
}

function tone(ac: Ctx, o: ToneOpts) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  const t0 = ac.currentTime + o.start;
  const peak = o.gain ?? 0.18;
  const attack = o.attack ?? 0.01;
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t0 + o.dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

function whoosh(ac: Ctx, start: number, dur: number, from: number, to: number, gain = 0.2) {
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  const t0 = ac.currentTime + start;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(ac.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// note frequencies (Hz)
const N = {
  G4: 392.0, A4: 440.0, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
  C6: 1046.5, E6: 1318.5, G6: 1568.0, B6: 1975.5,
};

const recipes: Record<SoundName, (ac: Ctx) => void> = {
  // rising major arpeggio – C E G C
  correct: (ac) => {
    [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => {
      tone(ac, { freq: f, start: i * 0.09, dur: 0.28, type: 'triangle', gain: 0.16 });
      tone(ac, { freq: f * 2, start: i * 0.09, dur: 0.18, type: 'sine', gain: 0.05 });
    });
  },
  // soft low "bonk" – gentle, never harsh
  wrong: (ac) => {
    tone(ac, { freq: 220, glideTo: 130, start: 0, dur: 0.32, type: 'triangle', gain: 0.14, attack: 0.02 });
    tone(ac, { freq: 165, glideTo: 110, start: 0.16, dur: 0.3, type: 'sine', gain: 0.1, attack: 0.02 });
  },
  // tiny tick
  click: (ac) => {
    tone(ac, { freq: 1300, glideTo: 900, start: 0, dur: 0.05, type: 'sine', gain: 0.12, attack: 0.003 });
  },
  // soft metronome
  tick: (ac) => {
    tone(ac, { freq: 880, start: 0, dur: 0.035, type: 'sine', gain: 0.07, attack: 0.002 });
  },
  // 4-note celebration
  fanfare: (ac) => {
    const seq: Array<[number, number, number]> = [
      [N.G4, 0, 0.16],
      [N.C5, 0.16, 0.16],
      [N.E5, 0.32, 0.16],
      [N.G5, 0.48, 0.6],
    ];
    seq.forEach(([f, s, d]) => {
      tone(ac, { freq: f, start: s, dur: d, type: 'square', gain: 0.07 });
      tone(ac, { freq: f, start: s, dur: d, type: 'triangle', gain: 0.14 });
    });
    tone(ac, { freq: N.C6, start: 0.52, dur: 0.6, type: 'sine', gain: 0.06 });
  },
  // sparkle
  join: (ac) => {
    [N.E6, N.G6, N.B6].forEach((f, i) => {
      tone(ac, { freq: f, start: i * 0.06, dur: 0.22, type: 'sine', gain: 0.1 });
    });
    tone(ac, { freq: N.B6 * 1.5, start: 0.2, dur: 0.3, type: 'sine', gain: 0.04 });
  },
  // whoosh
  flip: (ac) => {
    whoosh(ac, 0, 0.22, 400, 2200, 0.18);
  },
  // glissando + shimmering chord
  treasure: (ac) => {
    tone(ac, { freq: 300, glideTo: 1600, start: 0, dur: 0.6, type: 'sine', gain: 0.14 });
    [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => {
      tone(ac, { freq: f, start: 0.55 + i * 0.03, dur: 0.9, type: 'triangle', gain: 0.08 });
    });
    [N.E6, N.G6, N.B6].forEach((f, i) => {
      tone(ac, { freq: f, start: 0.75 + i * 0.08, dur: 0.25, type: 'sine', gain: 0.06 });
    });
  },
};

/** מנגן צליל אם הצלילים מופעלים. בטוח לקריאה בכל סביבה. */
export function playSound(name: SoundName): void {
  if (!enabledState) return;
  try {
    const ac = getCtx();
    if (!ac) return;
    const recipe = recipes[name];
    if (recipe) recipe(ac);
  } catch {
    /* audio unavailable – silently ignore */
  }
}

export interface UseSoundResult {
  play: (name: SoundName) => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

export function useSound(): UseSoundResult {
  const enabled = useSyncExternalStore(subscribe, getSoundsEnabled, getSoundsEnabled);
  const play = useCallback((name: SoundName) => playSound(name), []);
  return { play, enabled, setEnabled: setSoundsEnabled };
}

export default useSound;
