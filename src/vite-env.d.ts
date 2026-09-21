/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND?: 'local' | 'supabase';
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_RECEIPT_PARSER?: 'tesseract' | 'claude' | 'manual';
  readonly VITE_RECEIPT_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
