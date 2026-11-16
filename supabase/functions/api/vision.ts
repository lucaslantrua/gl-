/** Analyse d'image : lecture du fichier, appel du modèle, validation, un seul retry. L'image reste en mémoire. */
import { MAX_IMAGE_BYTES } from './config.ts';
import { PROMPTS } from './prompts.ts';
import { InvalidModelOutput, normaliseLabel, normalisePlate, type LabelResponse, type PlateResponse } from './schemas.ts';

export type Kind = 'plate' | 'label';
export type MediaType = 'image/jpeg' | 'image/webp';

export interface VisionRequest {
  kind: Kind;
  system: string;
  image: Uint8Array;
  mediaType: MediaType;
  /** Présent au second essai : la réponse rejetée et la raison. */
  retry?: { previous: string; error: string };
}

/** Un fournisseur renvoie le texte JSON produit par le modèle. */
export interface VisionProvider {
  ask(req: VisionRequest): Promise<string>;
}

/** Le service de vision est injoignable, mal configuré ou en erreur. */
export class VisionUnavailable extends Error {}
/** Pas de JSON exploitable, même après un retry (ou refus du modèle). */
export class VisionInvalidResponse extends Error {}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const USER_INSTRUCTION = 'Analyse this image and answer with the JSON object only.';

export function correction(error: string): string {
  return `Your previous answer was not valid for the required schema (${error}). Answer again with ONLY one JSON object that follows the schema exactly: no markdown, no code fences, no commentary.`;
}

/** Type réel de l'image d'après ses premiers octets. */
export function sniff(data: Uint8Array): MediaType | null {
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  const ascii = (from: number, to: number) => String.fromCharCode(...data.subarray(from, to));
  if (data.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const BAD_TYPE = "Format d'image non pris en charge (WebP ou JPEG).";

export async function readImage(req: Request): Promise<{ image: Uint8Array; mediaType: MediaType }> {
  // Refus rapide sur la taille annoncée, avant de lire le corps.
  if (Number(req.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES + 64 * 1024) throw new HttpError(413, 'Image trop lourde (2 Mo maximum).');
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get('image');
  } catch {
    throw new HttpError(422, "Aucune image reçue : envoie un champ « image » en multipart.");
  }
  if (!(file instanceof File)) throw new HttpError(422, "Aucune image reçue : envoie un champ « image » en multipart.");
  const declared = file.type.split(';')[0]!.trim().toLowerCase();
  if (declared !== 'image/jpeg' && declared !== 'image/webp') throw new HttpError(415, BAD_TYPE);
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError(413, 'Image trop lourde (2 Mo maximum).');
  const image = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniff(image);
  if (!mediaType) throw new HttpError(415, BAD_TYPE);
  return { image, mediaType };
}

const FENCE = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i;

/** Parse la sortie du modèle en tolérant les balises ```json et le texte autour. */
export function extractJson(text: string): unknown {
  let t = text.trim();
  const fenced = FENCE.exec(t);
  if (fenced) t = fenced[1]!;
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start !== -1 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new InvalidModelOutput('not parseable as JSON');
  }
}

async function analyse<T>(provider: VisionProvider, base: Omit<VisionRequest, 'retry'>, normalise: (raw: unknown) => T): Promise<T> {
  let retry: VisionRequest['retry'];
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await provider.ask({ ...base, retry });
    try {
      return normalise(extractJson(text));
    } catch (e) {
      if (!(e instanceof InvalidModelOutput) && !(e instanceof SyntaxError)) throw e;
      retry = { previous: text, error: e instanceof InvalidModelOutput ? e.message : 'not parseable as JSON' };
    }
  }
  throw new VisionInvalidResponse(retry?.error ?? 'invalid');
}

export function analysePlate(provider: VisionProvider, image: Uint8Array, mediaType: MediaType): Promise<PlateResponse> {
  return analyse(provider, { kind: 'plate', system: PROMPTS.plate, image, mediaType }, normalisePlate);
}

export function analyseLabel(provider: VisionProvider, image: Uint8Array, mediaType: MediaType): Promise<LabelResponse> {
  return analyse(provider, { kind: 'label', system: PROMPTS.label, image, mediaType }, normaliseLabel);
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
