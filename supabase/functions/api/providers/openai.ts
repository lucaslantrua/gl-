/** Fournisseur vision : toute API compatible OpenAI (/chat/completions). */
import type { Config } from '../config.ts';
import { correction, toBase64, USER_INSTRUCTION, VisionUnavailable, type VisionProvider } from '../vision.ts';

export function createOpenAiProvider(config: Config, fetchImpl: typeof fetch = fetch): VisionProvider {
  return {
    async ask(req) {
      const messages: unknown[] = [
        { role: 'system', content: req.system },
        {
          role: 'user',
          content: [
            { type: 'text', text: USER_INSTRUCTION },
            { type: 'image_url', image_url: { url: `data:${req.mediaType};base64,${toBase64(req.image)}` } },
          ],
        },
      ];
      if (req.retry) messages.push({ role: 'assistant', content: req.retry.previous }, { role: 'user', content: correction(req.retry.error) });

      let res: Response;
      try {
        res = await fetchImpl(`${config.visionApiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(config.visionApiKey ? { Authorization: `Bearer ${config.visionApiKey}` } : {}) },
          body: JSON.stringify({
            model: config.visionModel,
            messages,
            temperature: 0.2,
            // Marge pour les modèles qui raisonnent avant de répondre : leurs tokens de réflexion comptent dans ce plafond.
            max_tokens: 4096,
            ...(config.visionJsonMode ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (e) {
        throw new VisionUnavailable(e instanceof Error ? e.name : 'network');
      }
      if (!res.ok) throw new VisionUnavailable(`HTTP ${res.status}`);
      try {
        const content = (await res.json()).choices[0].message.content;
        if (Array.isArray(content)) return content.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('');
        return typeof content === 'string' ? content : '';
      } catch {
        throw new VisionUnavailable('unexpected response shape');
      }
    },
  };
}
