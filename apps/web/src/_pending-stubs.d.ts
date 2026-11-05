/**
 * TEMPORARY – הצהרות לקבצים שנבנים במקביל ע"י סוכנים אחרים.
 * למחוק כשהמודולים האמיתיים קיימים: src/games, src/animations, src/hooks/useSound, src/pages/teacher.
 */
declare module '@/games' {
  import type { ComponentType } from 'react';
  import type { AnswerPayload, AnswerResult, QuestionView } from '@oc/shared';
  export interface QuestionRendererProps {
    question: QuestionView;
    result: AnswerResult | null;
    onAnswer: (payload: AnswerPayload) => Promise<AnswerResult>;
    onNext: () => void;
    soundsEnabled: boolean;
    showCorrectAnswers: boolean;
    serverOffsetMs: number;
  }
  export const QuestionRenderer: ComponentType<QuestionRendererProps>;
}

declare module '@/animations' {
  import type { ComponentType } from 'react';
  export const Confetti: ComponentType<{ active: boolean }>;
  export const FloatingStars: ComponentType<{ count?: number }>;
}

declare module '@/hooks/useSound' {
  export type SoundName = 'correct' | 'wrong' | 'click' | 'tick' | 'fanfare' | 'join';
  export function useSound(): { play: (name: SoundName) => void; enabled: boolean; setEnabled: (v: boolean) => void };
}

declare module '@/pages/teacher' {
  import type { ComponentType } from 'react';
  export const TeacherRoutes: ComponentType;
}
