/** Vérifie la clé de contrôle d'un code EAN-13, EAN-8 ou UPC-A. */
export function isValidEan(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export type Detect = (source: HTMLCanvasElement) => Promise<string | null>;

interface NativeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: {
      new (init: { formats: string[] }): NativeDetector;
      getSupportedFormats(): Promise<string[]>;
    };
  }
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

/** Détecteur natif si disponible, sinon @zxing/browser (chargé à la demande). */
export async function createDetector(): Promise<Detect> {
  if (window.BarcodeDetector) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.length) {
        const native = new window.BarcodeDetector({ formats });
        return async (source) => (await native.detect(source))[0]?.rawValue ?? null;
      }
    } catch {
      /* repli zxing */
    }
  }
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const hints = new Map<unknown, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new BrowserMultiFormatReader(hints as never);
  return async (source) => {
    try {
      return reader.decodeFromCanvas(source).getText();
    } catch {
      return null; // rien trouvé dans cette image
    }
  };
}
