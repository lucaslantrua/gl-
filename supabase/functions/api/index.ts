// Edge Function Supabase « api » : proxy vision + Open Food Facts de Glu.
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { MemoryCache, type Product } from './off.ts';
import { createOpenAiProvider } from './providers/openai.ts';

const config = loadConfig((name) => Deno.env.get(name));

Deno.serve(
  createApp({
    config,
    fetch,
    cache: new MemoryCache<Product | null>(),
    vision: createOpenAiProvider(config),
  }),
);
