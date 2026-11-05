import { useCallback } from 'react';
import { useSound, type SoundName } from '@/hooks/useSound';

/** צליל המשחק: מנגן רק אם גם המורה אפשרה צלילים (הגדרות החדר) וגם התלמיד לא כיבה אותם */
export function useGameSound(soundsEnabled: boolean) {
  const { play } = useSound();
  return useCallback(
    (name: SoundName) => {
      if (soundsEnabled) play(name);
    },
    [play, soundsEnabled],
  );
}
