import { useEffect, useState } from 'react';
import { Barcode, Camera, PenLine, ScanText } from 'lucide-react';
import type { Entry, Source } from '@/db/types';

const ICONS: Record<Source, typeof Camera> = { plate_photo: Camera, barcode: Barcode, label_photo: ScanText, manual: PenLine };
const BG: Record<Source, string> = {
  plate_photo: 'var(--terracotta-wash)',
  barcode: 'var(--honey-wash)',
  label_photo: 'var(--sage-wash)',
  manual: 'var(--sunken)',
};

export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** Miniature d'une entrée : photo locale, image OFF, ou icône de la source. */
export function Thumb({ entry, size = 48 }: { entry: Pick<Entry, 'photoThumb' | 'source' | 'items'>; size?: number }) {
  const local = useObjectUrl(entry.photoThumb);
  const [broken, setBroken] = useState(false);
  const remote = entry.items.find((i) => i.offImageUrl)?.offImageUrl;
  const src = local ?? (broken ? undefined : remote);
  const Icon = ICONS[entry.source];
  const style = { width: size, height: size, borderRadius: size * 0.32, flex: 'none' as const };
  if (src) return <img src={src} alt="" width={size} height={size} loading="lazy" onError={() => setBroken(true)} style={{ ...style, objectFit: 'cover', background: 'var(--sunken)' }} />;
  return (
    <span aria-hidden style={{ ...style, display: 'grid', placeItems: 'center', background: BG[entry.source], color: 'var(--ink)' }}>
      <Icon size={size * 0.44} strokeWidth={1.75} />
    </span>
  );
}
