import { createContext, useContext } from 'react';

export interface Crumb {
  label: string;
  to?: string;
}

export interface TeacherChrome {
  /** עדכון פירורי הלחם בסרגל העליון של ה־Layout. */
  setCrumbs: (crumbs: Crumb[]) => void;
}

/** ברירת מחדל ללא־פעולה – כך עמודים נבדקים גם בלי ה־Layout. */
export const TeacherChromeContext = createContext<TeacherChrome>({ setCrumbs: () => undefined });

export function useTeacherChrome(): TeacherChrome {
  return useContext(TeacherChromeContext);
}
