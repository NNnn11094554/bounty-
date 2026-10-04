/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_BOT_USERNAME?: string;
  readonly VITE_MINIAPP_SHORT_NAME?: string;
  readonly VITE_TONCONNECT_MANIFEST_URL?: string;
  /** ссылки сайта: X (Twitter) и сообщество — без них кнопки показывают «Soon» */
  readonly VITE_X_URL?: string;
  readonly VITE_COMMUNITY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
