import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SOUNDS_STORAGE_KEY, playSound, setSoundsEnabled, useSound } from '@/hooks/useSound';

function mockAudioContext() {
  const osc = { type: 'sine', frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  const gain = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
  const ctor = vi.fn(function (this: Record<string, unknown>) {
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = {};
    this.resume = vi.fn(async () => undefined);
    this.createOscillator = vi.fn(() => osc);
    this.createGain = vi.fn(() => gain);
    this.createBuffer = vi.fn(() => ({ getChannelData: () => new Float32Array(10) }));
    this.createBufferSource = vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null }));
    this.createBiquadFilter = vi.fn(() => ({ type: '', Q: { value: 0 }, frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }));
  });
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = ctor;
  return { ctor, osc };
}

describe('useSound', () => {
  beforeEach(() => {
    localStorage.clear();
    setSoundsEnabled(true);
  });

  it('defaults to enabled and persists toggles to localStorage', () => {
    const { result } = renderHook(() => useSound());
    expect(result.current.enabled).toBe(true);
    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(SOUNDS_STORAGE_KEY)).toBe('false');
    act(() => result.current.setEnabled(true));
    expect(localStorage.getItem(SOUNDS_STORAGE_KEY)).toBe('true');
  });

  it('keeps multiple hook instances in sync', () => {
    const a = renderHook(() => useSound());
    const b = renderHook(() => useSound());
    act(() => a.result.current.setEnabled(false));
    expect(b.result.current.enabled).toBe(false);
  });

  it('creates the AudioContext lazily on first play and is silent when disabled', () => {
    const { ctor, osc } = mockAudioContext();
    setSoundsEnabled(false);
    playSound('correct');
    expect(ctor).not.toHaveBeenCalled();
    setSoundsEnabled(true);
    playSound('correct');
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(osc.start).toHaveBeenCalled();
    playSound('flip');
    playSound('treasure');
    expect(ctor).toHaveBeenCalledTimes(1); // reused
  });

  it('never throws when WebAudio is unavailable', () => {
    (globalThis as unknown as { AudioContext?: unknown }).AudioContext = undefined;
    expect(() => playSound('wrong')).not.toThrow();
  });
});
