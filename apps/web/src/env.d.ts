/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SOCKET_URL?: string;
  /** '1' בבניית גרסת הדמו (שרת מדומה בדפדפן, ניתוב בזיכרון, נתיבי assets יחסיים) */
  readonly VITE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
