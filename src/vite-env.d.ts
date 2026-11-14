/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" ise uygulama disk olmadan, örnek verilerle açılır (npm run dev:demo). */
  readonly VITE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
