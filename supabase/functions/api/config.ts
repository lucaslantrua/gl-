/** Configuration lue dans les secrets de la fonction. */
export interface Config {
  visionModel: string;
  visionApiBaseUrl: string;
  visionApiKey: string;
  visionJsonMode: boolean;
  visionReasoningEffort: string;
  offUserAgent: string;
  allowedOrigins: string[];
  rateLimit: { max: number; windowMs: number };
}

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const OFF_CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
export const OFF_NEGATIVE_CACHE_TTL_MS = 3600 * 1000;

const WINDOWS: Record<string, number> = { second: 1000, minute: 60_000, hour: 3_600_000 };

/** "30/minute" → { max: 30, windowMs: 60000 }. */
export function parseRateLimit(value: string | undefined): { max: number; windowMs: number } {
  const m = /^(\d+)\s*\/\s*(second|minute|hour)$/.exec((value ?? '').trim());
  return m ? { max: Number(m[1]), windowMs: WINDOWS[m[2]]! } : { max: 30, windowMs: 60_000 };
}

export function loadConfig(env: (name: string) => string | undefined): Config {
  return {
    visionModel: env('VISION_MODEL') || 'gemma-4-26b-a4b-it',
    visionApiBaseUrl: (env('VISION_API_BASE_URL') || 'https://api.scaleway.ai/v1').replace(/\/+$/, ''),
    visionApiKey: env('VISION_API_KEY') ?? '',
    visionJsonMode: !['0', 'false', 'no', 'off'].includes((env('VISION_JSON_MODE') ?? 'true').trim().toLowerCase()),
    visionReasoningEffort: (env('VISION_REASONING_EFFORT') ?? '').trim().toLowerCase(),
    offUserAgent: env('OFF_USER_AGENT') || 'Glu/0.1 (contact@example.com)',
    allowedOrigins: (env('ALLOWED_ORIGINS') || 'http://localhost:5173').split(',').map((o) => o.trim()).filter(Boolean),
    rateLimit: parseRateLimit(env('RATE_LIMIT')),
  };
}
