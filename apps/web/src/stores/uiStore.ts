import { create } from 'zustand';
import type { AvatarId } from '@oc/shared';
import { storage } from '@/lib/storage';

const DRAFT_KEY = 'oc.ui.joinDraft';

export interface JoinDraft {
  displayName: string;
  code: string;
  avatar: AvatarId | null;
}

interface UiState {
  /** טיוטת טופס ההצטרפות (נשמרת כדי שתלמיד שרענן לא יקליד מחדש) */
  joinDraft: JoinDraft;
  setJoinDraft: (patch: Partial<JoinDraft>) => void;
  clearJoinDraft: () => void;
  /** ברכה שמוצגת אחרי הצטרפות מוצלחת */
  greeting: string | null;
  setGreeting: (name: string | null) => void;
  /** הפחתת תנועה שנבחרה ידנית (בנוסף להעדפת המערכת) */
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
}

const defaultDraft: JoinDraft = { displayName: '', code: '', avatar: null };

export const useUiStore = create<UiState>((set, get) => ({
  joinDraft: storage.getJSON<JoinDraft>(DRAFT_KEY, defaultDraft),
  setJoinDraft: (patch) => {
    const next = { ...get().joinDraft, ...patch };
    storage.setJSON(DRAFT_KEY, { ...next, code: '' });
    set({ joinDraft: next });
  },
  clearJoinDraft: () => {
    storage.remove(DRAFT_KEY);
    set({ joinDraft: defaultDraft });
  },
  greeting: null,
  setGreeting: (name) => set({ greeting: name }),
  reducedMotion: storage.get('oc.ui.reducedMotion') === '1',
  setReducedMotion: (v) => {
    storage.set('oc.ui.reducedMotion', v ? '1' : '0');
    set({ reducedMotion: v });
  },
}));
