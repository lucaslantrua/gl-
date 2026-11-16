/** Routage de l'API Glu. Proxy sans état : rien n'est stocké, ni les images ni les codes-barres ne sont journalisés. */
import type { Config } from './config.ts';
import { getProduct, OffUnavailable, type ProductCache } from './off.ts';
import { analyseLabel, analysePlate, HttpError, readImage, VisionInvalidResponse, VisionUnavailable, type VisionProvider } from './vision.ts';

export interface Deps {
  config: Config;
  fetch: typeof fetch;
  cache: ProductCache;
  vision: VisionProvider;
  now?: () => number;
  /** Journal minimal : un libellé d'erreur, jamais de contenu de requête. */
  log?: (message: string) => void;
}

function corsHeaders(config: Config, origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' };
  if (origin && config.allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

/** Limite par IP, en mémoire : un garde-fou par instance, pas un compteur global. */
function createLimiter(config: Config, now: () => number) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (ip: string): boolean => {
    const t = now();
    const cur = hits.get(ip);
    if (!cur || cur.reset <= t) {
      if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= t) hits.delete(k);
      hits.set(ip, { count: 1, reset: t + config.rateLimit.windowMs });
      return true;
    }
    cur.count += 1;
    return cur.count <= config.rateLimit.max;
  };
}

export function createApp(deps: Deps): (req: Request) => Promise<Response> {
  const { config } = deps;
  const allow = createLimiter(config, deps.now ?? Date.now);
  const log = deps.log ?? ((m: string) => console.error(m));

  return async (req) => {
    const cors = corsHeaders(config, req.headers.get('origin'));
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
    const fail = (status: number, detail: string) => json(status, { detail });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // Appelée en /functions/v1/api/..., la fonction voit /api/... : on ne garde que la suite.
    const path = new URL(req.url).pathname.replace(/^.*?\/api(?=\/|$)/, '') || '/';
    if (path === '/health' && req.method === 'GET') return json(200, { status: 'ok' });

    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || 'unknown';
    if (!allow(ip)) return fail(429, 'Trop de demandes à la suite. Réessaie dans une minute.');

    try {
      const product = /^\/products\/([^/]+)$/.exec(path);
      if (product && req.method === 'GET') {
        const barcode = decodeURIComponent(product[1]!);
        if (!/^\d{6,14}$/.test(barcode)) return fail(422, 'Code-barres invalide.');
        const found = await getProduct(barcode, { fetch: deps.fetch, cache: deps.cache, userAgent: config.offUserAgent });
        return found ? json(200, found) : fail(404, "Produit inconnu ou sans glucides renseignés. Essaie la photo d'étiquette.");
      }

      if (path === '/vision/plate' && req.method === 'POST') {
        const { image, mediaType } = await readImage(req);
        return json(200, await analysePlate(deps.vision, image, mediaType));
      }

      if (path === '/vision/label' && req.method === 'POST') {
        const { image, mediaType } = await readImage(req);
        const label = await analyseLabel(deps.vision, image, mediaType);
        // Glucides illisibles : on le dit, sans pousser le modèle à deviner.
        if (label.per100.carbs === null) return fail(422, "Glucides illisibles sur l'étiquette. Reprends la photo ou saisis la valeur à la main.");
        return json(200, label);
      }

      return fail(404, 'Route inconnue.');
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      if (e instanceof OffUnavailable) {
        log(`off unavailable: ${e.message}`);
        return fail(502, 'Open Food Facts est injoignable pour le moment.');
      }
      if (e instanceof VisionInvalidResponse) return fail(422, "L'analyse n'a pas donné de résultat exploitable. Réessaie.");
      if (e instanceof VisionUnavailable) {
        log(`vision unavailable: ${e.message}`);
        return fail(502, "Le service d'analyse est injoignable pour le moment.");
      }
      log(`unexpected: ${e instanceof Error ? e.name : 'error'}`);
      return fail(500, 'Le service ne répond pas. Réessaie dans un instant.');
    }
  };
}
