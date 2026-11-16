import { assertEquals, assertMatch, assertRejects } from '@std/assert';
import { createApp, type Deps } from './app.ts';
import { loadConfig, parseRateLimit, type Config } from './config.ts';
import { MemoryCache, normalise, type Product } from './off.ts';
import { PROMPTS } from './prompts.ts';
import { createAnthropicClient, createAnthropicProvider } from './providers/anthropic.ts';
import { createOpenAiProvider } from './providers/openai.ts';
import { giCategory, InvalidModelOutput, LabelWire, normaliseLabel, normalisePlate } from './schemas.ts';
import { render } from './sync_prompts.ts';
import { extractJson, sniff, type VisionProvider, type VisionRequest } from './vision.ts';

const env = (vars: Record<string, string> = {}) => loadConfig((name) => vars[name]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const WEBP = new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map((c) => c.charCodeAt(0))));

const NUTELLA = {
  product_name: 'Nutella',
  brands: 'Ferrero,Nutella',
  serving_quantity: '15',
  product_quantity: 400,
  nutriscore_grade: 'E',
  image_front_small_url: 'https://images.openfoodfacts.org/nutella.jpg',
  categories_tags: ['en:spreads', 'en:sweet-spreads'],
  nutriments: { carbohydrates_100g: 57.5, sugars_100g: 56.3, fiber_100g: 0, proteins_100g: 6.3, fat_100g: 30.9 },
};
const PLATE = {
  items: [{ name: 'Pâtes cuites', estimatedQuantityG: 220, unit: 'g', carbsG: 66, carbsMinG: 55, carbsMaxG: 80, sugarsG: null, fiberG: 4, proteinG: 12, fatG: null, glycemicIndex: 50, box: null }],
  notes: 'Sauce tomate probablement sucrée, impact faible.',
  overallConfidence: 'medium',
};
const LABEL = { name: 'Biscuits', unit: 'g', per100: { carbs: 64, sugars: 22, fiber: null, protein: 7, fat: 18 }, servingQuantity: 30 };

/** Fournisseur vision factice : renvoie les réponses dans l'ordre et garde les requêtes reçues. */
function fakeVision(...answers: (string | Error)[]): VisionProvider & { calls: VisionRequest[] } {
  const calls: VisionRequest[] = [];
  return {
    calls,
    ask(req) {
      calls.push(req);
      const next = answers[Math.min(calls.length - 1, answers.length - 1)]!;
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
  };
}

function app(over: Partial<Deps> & { vars?: Record<string, string> } = {}) {
  const logs: string[] = [];
  const offCalls: Request[] = [];
  const offFetch: typeof fetch = (input, init) => {
    offCalls.push(new Request(input as string, init));
    return Promise.resolve(Response.json({ status: 1, product: NUTELLA }));
  };
  const handler = createApp({
    config: env(over.vars),
    fetch: offFetch,
    cache: new MemoryCache<Product | null>(),
    vision: fakeVision(JSON.stringify(PLATE)),
    log: (m) => logs.push(m),
    ...over,
  });
  return { handler, logs, offCalls };
}

const get = (path: string, headers: Record<string, string> = {}) => new Request(`https://x.supabase.co/functions/v1${path}`, { headers });
function upload(path: string, bytes: Uint8Array = JPEG, type = 'image/jpeg'): Request {
  const form = new FormData();
  form.append('image', new File([bytes as BlobPart], 'photo', { type }));
  return new Request(`https://x.supabase.co/functions/v1${path}`, { method: 'POST', body: form });
}

Deno.test('santé', async () => {
  const res = await app().handler(get('/api/health'));
  assertEquals([res.status, await res.json()], [200, { status: 'ok' }]);
});

Deno.test('produit : normalisation et User-Agent', async () => {
  const { handler, offCalls } = app();
  const res = await handler(get('/api/products/3017620422003'));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), {
    barcode: '3017620422003',
    name: 'Nutella',
    brand: 'Ferrero',
    unit: 'g',
    per100: { carbs: 57.5, sugars: 56.3, fiber: 0, protein: 6.3, fat: 30.9 },
    servingQuantity: 15,
    packageQuantity: 400,
    nutriscore: 'e',
    imageUrl: 'https://images.openfoodfacts.org/nutella.jpg',
    isBeverage: false,
    categories: ['en:spreads', 'en:sweet-spreads'],
  });
  assertEquals(offCalls[0]!.headers.get('user-agent'), 'Glu/0.1 (contact@example.com)');
  assertMatch(offCalls[0]!.url, /product\/3017620422003\.json\?fields=.*categories_tags/);
});

Deno.test('produit : boisson en ml, cache, inconnu, glucides absents, code invalide, OFF en panne', async () => {
  assertEquals(normalise('1', { ...NUTELLA, categories_tags: ['en:beverages', 'en:sodas'] })!.unit, 'ml');
  assertEquals(normalise('1', { ...NUTELLA, nutriments: { sugars_100g: 3 } }), null);
  assertEquals(normalise('1', { ...NUTELLA, product_quantity: '2 x 150 g' })!.packageQuantity, null);

  const cached = app();
  await cached.handler(get('/api/products/3017620422003'));
  await cached.handler(get('/api/products/3017620422003'));
  assertEquals(cached.offCalls.length, 1);

  const missing = app({ fetch: () => Promise.resolve(Response.json({ status: 0 })) });
  assertEquals((await missing.handler(get('/api/products/3017620422003'))).status, 404);
  const notFound = app({ fetch: () => Promise.resolve(new Response('', { status: 404 })) });
  assertEquals((await notFound.handler(get('/api/products/3017620422003'))).status, 404);

  assertEquals((await app().handler(get('/api/products/abc'))).status, 422);

  const down = app({ fetch: () => Promise.resolve(new Response('', { status: 503 })) });
  assertEquals((await down.handler(get('/api/products/3017620422003'))).status, 502);
  assertEquals(down.logs, ['off unavailable: HTTP 503']);
});

Deno.test('plat : réponse valide, cohérence de la fourchette et catégorie IG dérivée', async () => {
  const odd = { ...PLATE, items: [{ ...PLATE.items[0], carbsMinG: 70, carbsMaxG: 60, glycemicIndex: 72 }] };
  const res = await app({ vision: fakeVision('```json\n' + JSON.stringify(odd) + '\n```') }).handler(upload('/api/vision/plate'));
  assertEquals(res.status, 200);
  const item = (await res.json()).items[0];
  assertEquals([item.carbsMinG, item.carbsMaxG, item.giCategory, item.unit], [66, 66, 'high', 'g']);
});

Deno.test('plat : JSON invalide puis retry réussi, avec la raison transmise au modèle', async () => {
  const vision = fakeVision('je vois des pâtes', JSON.stringify(PLATE));
  const res = await app({ vision }).handler(upload('/api/vision/plate', WEBP, 'image/webp'));
  assertEquals(res.status, 200);
  assertEquals(vision.calls.length, 2);
  assertEquals(vision.calls[1]!.retry, { previous: 'je vois des pâtes', error: 'not parseable as JSON' });
  assertEquals([vision.calls[0]!.mediaType, vision.calls[0]!.system], ['image/webp', PROMPTS.plate]);
});

Deno.test('plat : invalide deux fois → 422, valeur hors bornes rejetée, aucune nourriture → items vides', async () => {
  const twice = fakeVision('{"items": "oops"}');
  assertEquals((await app({ vision: twice }).handler(upload('/api/vision/plate'))).status, 422);
  assertEquals(twice.calls.length, 2);

  const huge = { ...PLATE, items: [{ ...PLATE.items[0], carbsG: 99999 }] };
  assertEquals((await app({ vision: fakeVision(JSON.stringify(huge)) }).handler(upload('/api/vision/plate'))).status, 422);

  const empty = await app({ vision: fakeVision(JSON.stringify({ items: [], notes: 'Aucun aliment visible.', overallConfidence: 'low' })) }).handler(upload('/api/vision/plate'));
  assertEquals(await empty.json(), { items: [], notes: 'Aucun aliment visible.', overallConfidence: 'low' });
});

Deno.test('image : trop lourde → 413, mauvais type → 415, contenu qui ment sur son type → 415, champ absent → 422', async () => {
  const big = new Uint8Array(2 * 1024 * 1024 + 10);
  big.set(JPEG);
  assertEquals((await app().handler(upload('/api/vision/plate', big))).status, 413);
  assertEquals((await app().handler(upload('/api/vision/plate', JPEG, 'image/png'))).status, 415);
  assertEquals((await app().handler(upload('/api/vision/plate', new Uint8Array([1, 2, 3, 4]), 'image/jpeg'))).status, 415);
  const noFile = new Request('https://x/api/vision/plate', { method: 'POST', body: new FormData() });
  assertEquals((await app().handler(noFile)).status, 422);
  assertEquals([sniff(JPEG), sniff(WEBP), sniff(new Uint8Array(4))], ['image/jpeg', 'image/webp', null]);
});

Deno.test('étiquette : donnée fabricant, nulls conservés, glucides illisibles → 422 sans retry', async () => {
  const ok = await app({ vision: fakeVision(JSON.stringify(LABEL)) }).handler(upload('/api/vision/label'));
  assertEquals(await ok.json(), { ...LABEL, confidence: 'manufacturer' });

  const vision = fakeVision(JSON.stringify({ ...LABEL, per100: { ...LABEL.per100, carbs: null } }));
  const res = await app({ vision }).handler(upload('/api/vision/label'));
  assertEquals([res.status, vision.calls.length], [422, 1]);
  assertMatch((await res.json()).detail, /Glucides illisibles/);
});

Deno.test('vision en panne → 502, sans rien journaliser de la requête', async () => {
  const { handler, logs } = app({ vision: fakeVision(new (await import('./vision.ts')).VisionUnavailable('HTTP 529')) });
  assertEquals((await handler(upload('/api/vision/plate'))).status, 502);
  assertEquals(logs, ['vision unavailable: HTTP 529']);
});

Deno.test('rate limit par IP, sauf la route de santé', async () => {
  const { handler } = app({ vars: { RATE_LIMIT: '2/minute' }, now: () => 1000 });
  const ip = { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' };
  const statuses = [];
  for (let i = 0; i < 3; i++) statuses.push((await handler(get('/api/products/3017620422003', ip))).status);
  assertEquals(statuses, [200, 200, 429]);
  assertEquals((await handler(get('/api/products/3017620422003', { 'x-forwarded-for': '198.51.100.2' }))).status, 200);
  assertEquals((await handler(get('/api/health', ip))).status, 200);
  assertEquals(parseRateLimit('10/hour'), { max: 10, windowMs: 3_600_000 });
  assertEquals(parseRateLimit('n’importe quoi'), { max: 30, windowMs: 60_000 });
});

Deno.test('CORS : origine autorisée seulement, pré-vol sans authentification', async () => {
  const { handler } = app({ vars: { ALLOWED_ORIGINS: 'https://glu.example, http://localhost:5173' } });
  const pre = await handler(new Request('https://x/api/vision/plate', { method: 'OPTIONS', headers: { origin: 'https://glu.example' } }));
  assertEquals([pre.status, pre.headers.get('access-control-allow-origin')], [204, 'https://glu.example']);
  assertMatch(pre.headers.get('access-control-allow-headers')!, /authorization, apikey/);
  const other = await handler(get('/api/health', { origin: 'https://evil.example' }));
  assertEquals(other.headers.get('access-control-allow-origin'), null);
});

Deno.test('route inconnue → 404', async () => {
  assertEquals((await app().handler(get('/api/nope'))).status, 404);
});

Deno.test('configuration : fournisseur et modèle par défaut', () => {
  assertEquals([env().visionProvider, env().visionModel], ['openai', 'gpt-4o-mini']);
  const claude = env({ ANTHROPIC_API_KEY: 'k' });
  assertEquals([claude.visionProvider, claude.visionModel], ['anthropic', 'claude-opus-5-5']);
  assertEquals(env({ ANTHROPIC_API_KEY: 'k', VISION_PROVIDER: 'openai', VISION_JSON_MODE: 'false' }).visionJsonMode, false);
});

Deno.test('validation : schémas et utilitaires', () => {
  assertEquals([54, 55, 69, 70].map(giCategory), ['low', 'medium', 'medium', 'high']);
  assertEquals(extractJson('Voici : {"a": 1} merci'), { a: 1 });
  assertEquals(normaliseLabel({ per100: { carbs: 12 } }).unit, 'g');
  let caught: unknown;
  try {
    normaliseLabel({ per100: { carbs: 250 } });
  } catch (e) {
    caught = e;
  }
  assertEquals(caught instanceof InvalidModelOutput, true);
  assertEquals(normalisePlate({ items: [{ name: 'Riz', estimatedQuantityG: 150, carbsG: 40, carbsMinG: 30, carbsMaxG: 50, box: { x: 2, y: 0, w: 1, h: 1 } }] }).items[0]!.box, null);
});

Deno.test('prompts.ts est synchronisé avec apps/api/app/prompts', async () => {
  assertEquals(await Deno.readTextFile(new URL('./prompts.ts', import.meta.url)), await render());
});

/* ---------- Fournisseurs : forme exacte des requêtes envoyées ---------- */

function capture(reply: unknown, status = 200) {
  const requests: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const impl: typeof fetch = async (input, init) => {
    const req = new Request(input as string, init);
    requests.push({ url: req.url, headers: req.headers, body: await req.json() });
    return Response.json(reply, { status });
  };
  return { requests, impl };
}

const ASK: VisionRequest = { kind: 'label', system: PROMPTS.label, schema: LabelWire, image: JPEG, mediaType: 'image/jpeg' };

Deno.test('Claude : image en base64, schéma de sortie, repli sur refus', async () => {
  const config: Config = env({ ANTHROPIC_API_KEY: 'sk-test', VISION_EFFORT: 'low' });
  const { requests, impl } = capture({
    id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
    content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: JSON.stringify(LABEL) }],
    usage: { input_tokens: 10, output_tokens: 10 },
  });
  const text = await createAnthropicProvider(config, createAnthropicClient(config, impl)).ask(ASK);
  assertEquals(JSON.parse(text), LABEL);

  const { url, headers, body } = requests[0]!;
  assertMatch(url, /\/v1\/messages/);
  // Le SDK choisit l'en-tête d'authentification : on vérifie seulement que la clé part bien.
  assertMatch(`${headers.get('x-api-key')} ${headers.get('authorization')}`, /sk-test/);
  assertMatch(headers.get('anthropic-beta')!, /server-side-fallback-2026-07-01/);
  assertEquals([body.model, body.fallbacks, body.system], ['claude-opus-5-5', 'default', PROMPTS.label]);
  const output = body.output_config as { effort: string; format: { type: string } };
  assertEquals([output.effort, output.format.type], ['low', 'json_schema']);
  const content = (body.messages as { content: { type: string; source?: { type: string; media_type: string } }[] }[])[0]!.content;
  assertEquals([content[0]!.type, content[0]!.source!.type, content[0]!.source!.media_type, content[1]!.type], ['image', 'base64', 'image/jpeg', 'text']);
  assertEquals('thinking' in body || 'temperature' in body, false);
});

Deno.test('Claude : refus → réponse inexploitable ; erreur API → service indisponible ; Haiku sans repli', async () => {
  const config = env({ ANTHROPIC_API_KEY: 'sk-test', VISION_MODEL: 'claude-haiku-5-5' });
  const refusal = capture({ id: 'm', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', stop_reason: 'refusal', stop_sequence: null, content: [], usage: { input_tokens: 1, output_tokens: 0 } });
  await assertRejects(() => createAnthropicProvider(config, createAnthropicClient(config, refusal.impl)).ask(ASK), Error, 'refusal');
  assertEquals('fallbacks' in refusal.requests[0]!.body, false);

  const denied = capture({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401);
  await assertRejects(() => createAnthropicProvider(config, createAnthropicClient(config, denied.impl)).ask(ASK), Error, 'authentication');
});

Deno.test('compatible OpenAI : image en data URL, mode JSON, message de correction au retry', async () => {
  const config = env({ VISION_API_KEY: 'k', VISION_API_BASE_URL: 'https://llm.example/v1/' });
  const { requests, impl } = capture({ choices: [{ message: { content: JSON.stringify(LABEL) } }] });
  const provider = createOpenAiProvider(config, impl);
  assertEquals(JSON.parse(await provider.ask({ ...ASK, retry: { previous: 'bof', error: 'per100.carbs: must be between 0 and 100' } })), LABEL);
  const { url, headers, body } = requests[0]!;
  assertEquals([url, headers.get('authorization')], ['https://llm.example/v1/chat/completions', 'Bearer k']);
  assertEquals(body.response_format, { type: 'json_object' });
  const messages = body.messages as { role: string; content: unknown }[];
  assertEquals(messages.map((m) => m.role), ['system', 'user', 'assistant', 'user']);
  assertMatch(String(messages[3]!.content), /per100\.carbs/);
  assertMatch(JSON.stringify(messages[1]!.content), /data:image\/jpeg;base64,/);

  const down = capture({}, 500);
  await assertRejects(() => createOpenAiProvider(config, down.impl).ask(ASK), Error, 'HTTP 500');
});
