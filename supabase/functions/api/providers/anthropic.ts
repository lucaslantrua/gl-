/** Fournisseur vision : API Claude via le SDK officiel, avec sortie JSON contrainte par schéma. */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { Config } from '../config.ts';
import { toBase64, USER_INSTRUCTION, VisionInvalidResponse, VisionUnavailable, type VisionProvider } from '../vision.ts';

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
/** Modèles qui acceptent le repli côté serveur quand un classifieur décline la requête. */
const WITH_FALLBACKS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-fable-5-1']);
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

export function createAnthropicClient(config: Config, fetchImpl?: typeof fetch): Anthropic {
  return new Anthropic({ apiKey: config.anthropicApiKey, timeout: 45_000, maxRetries: 1, ...(fetchImpl ? { fetch: fetchImpl } : {}) });
}

export function createAnthropicProvider(config: Config, client: Anthropic = createAnthropicClient(config)): VisionProvider {
  return {
    async ask(req) {
      // Au second essai, on repart d'une conversation neuve : l'image, la consigne et la raison du rejet.
      const text = req.retry ? `${USER_INSTRUCTION}\n\nA previous attempt was rejected: ${req.retry.error}. Keep every value within its allowed range.` : USER_INSTRUCTION;
      const effort = EFFORTS.has(config.visionEffort) ? { effort: config.visionEffort as 'low' | 'medium' | 'high' | 'xhigh' | 'max' } : {};
      const fallbacks: { betas?: string[]; fallbacks?: 'default' } = WITH_FALLBACKS.has(config.visionModel) ? { betas: [FALLBACK_BETA], fallbacks: 'default' } : {};
      try {
        const response = await client.beta.messages.create({
          model: config.visionModel,
          max_tokens: 16000,
          system: req.system,
          ...fallbacks,
          output_config: { format: zodOutputFormat(req.schema), ...effort },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: req.mediaType, data: toBase64(req.image) } },
                { type: 'text', text },
              ],
            },
          ],
        });
        if (response.stop_reason === 'refusal') throw new VisionInvalidResponse('refusal');
        if (response.stop_reason === 'max_tokens') throw new VisionInvalidResponse('truncated');
        return response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
      } catch (error) {
        if (error instanceof VisionInvalidResponse) throw error;
        // On ne journalise que la nature de l'erreur : jamais l'image ni la réponse.
        if (error instanceof Anthropic.AuthenticationError) throw new VisionUnavailable('authentication');
        if (error instanceof Anthropic.RateLimitError) throw new VisionUnavailable('rate_limited');
        if (error instanceof Anthropic.APIError) throw new VisionUnavailable(`HTTP ${error.status ?? 'network'}`);
        throw new VisionUnavailable('unexpected');
      }
    },
  };
}
