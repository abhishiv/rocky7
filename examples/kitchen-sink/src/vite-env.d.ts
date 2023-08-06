/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_VERCEL_GIT_PULL_REQUEST_ID: string;
  readonly VITE_VERCEL_GIT_COMMIT_REF: string;
  readonly VITE_VERCEL_GIT_COMMIT_SHA: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
