// Edge Function Supabase « api » : proxy vision + Open Food Facts de Glu.
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { MemoryCache, type Product } from './off.ts';
import { createAnthropicProvider } from './providers/anthropic.ts';
import { createOpenAiProvider } from './providers/openai.ts';

const config = loadConfig((name) => Deno.env.get(name));

Deno.serve(
  createApp({
    config,
    fetch,
    cache: new MemoryCache<Product | null>(),
    vision: config.visionProvider === 'anthropic' ? createAnthropicProvider(config) : createOpenAiProvider(config),
  }),
);
