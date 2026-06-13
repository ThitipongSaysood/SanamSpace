import { mockApi, type Api } from "./mock";
import { httpApi } from "./http";

/**
 * Single swap point. When NEXT_PUBLIC_API_URL is set (e.g. via frontend/.env.local)
 * the app talks to the real Laravel /api/v1 backend; otherwise it uses the in-memory
 * mock (also used by the test suite, which never sets the env var).
 */
const USE_REAL = !!process.env.NEXT_PUBLIC_API_URL;

export const api: Api = USE_REAL ? httpApi : mockApi;
export type { Api };
