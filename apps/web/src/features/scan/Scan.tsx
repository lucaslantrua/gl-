import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Images, Keyboard, PenLine, X } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { createDetector, isValidEan, type Detect } from '@/lib/barcode';
import { compressForUpload, drawToCanvas, loadDrawable } from '@/lib/image';
import { Button, cx, Field, ICON, Sheet } from '@/ui';
import { layout as l } from '@/ui/Page';
import { loadProductDraft, startLabelAnalysis, startPlateAnalysis } from './analyze';
import s from './scan.module.css';

type Mode = 'plate' | 'barcode' | 'label';
type Camera = 'starting' | 'live' | 'denied' | 'unavailable';

const MODES: { value: Mode; label: string }[] = [
  { value: 'plate', label: 'Plat' },
  { value: 'barcode', label: 'Code-barres' },
  { value: 'label', label: 'Étiquette' },
];

const HINT: Record<Mode, string> = {
  plate: 'Cadre ton assiette, vue du dessus si possible.',
  barcode: 'Place le code-barres dans le cadre.',
  label: 'Cadre le tableau nutritionnel, bien à plat.',
};

export default function Scan() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>((params.get('mode') as Mode) || 'plate');
  const [camera, setCamera] = useState<Camera>('starting');
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const detectorRef = useRef<Detect | null>(null);
  const lockRef = useRef(false);

  // Caméra arrière ; libérée quand on quitte l'écran.
  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unavailable');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(async (st) => {
        if (cancelled) return st.getTracks().forEach((t) => t.stop());
        stream = st;
        const v = videoRef.current;
        if (v) {
          v.srcObject = st;
          await v.play().catch(() => undefined);
        }
        setCamera('live');
      })
      .catch((e: unknown) => setCamera(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'unavailable'));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const lookup = useCallback(
    async (barcode: string) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setBusy(true);
      setFlash(true);
      navigator.vibrate?.(60);
      setStatus('Code détecté, je cherche le produit.');
      try {
        await loadProductDraft(barcode);
        navigate('/entry/new', { replace: true });
      } catch (e) {
        setFlash(false);
        setBusy(false);
        if (e instanceof ApiError && e.status === 404) setNotFound(barcode);
        else {
          setStatus(e instanceof Error ? e.message : 'La recherche a échoué.');
          window.setTimeout(() => (lockRef.current = false), 2500); // évite de boucler sur le même code
        }
      }
    },
    [navigate],
  );

  const getDetector = useCallback(async () => (detectorRef.current ??= await createDetector()), []);

  // Détection continue en mode code-barres.
  useEffect(() => {
    if (mode !== 'barcode' || camera !== 'live') return;
    let stop = false;
    let timer = 0;
    const tick = async () => {
      const v = videoRef.current;
      if (stop) return;
      if (v && v.readyState >= 2 && !lockRef.current) {
        try {
          const detect = await getDetector();
          const found = await detect(drawToCanvas(v, 960));
          if (!stop && found && isValidEan(found)) return void lookup(found);
        } catch {
          /* image suivante */
        }
      }
      timer = window.setTimeout(tick, 180);
    };
    void tick();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [mode, camera, lookup, getDetector]);

  const analyze = async (source: HTMLVideoElement | Blob) => {
    setBusy(true);
    try {
      const photo = await compressForUpload(source);
      if (mode === 'label') startLabelAnalysis(photo);
      else startPlateAnalysis(photo);
      navigate('/entry/new', { replace: true });
    } catch {
      setBusy(false);
      setStatus("Impossible de lire cette image. Essaie avec une autre.");
    }
  };

  const onFile = async (file: File) => {
    if (mode !== 'barcode') return analyze(file);
    setStatus('Je cherche un code-barres dans cette image.');
    try {
      const detect = await getDetector();
      const drawable = await loadDrawable(file);
      const found = (await detect(drawToCanvas(drawable, 1600))) ?? (await detect(drawToCanvas(drawable, 800)));
      if (found && isValidEan(found)) await lookup(found);
      else setStatus("Aucun code-barres lisible sur cette image. Essaie de plus près, ou saisis le code.");
    } catch {
      setStatus("Impossible de lire cette image. Essaie avec une autre.");
    }
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEan(code)) return;
    setCodeOpen(false);
    void lookup(code);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setStatus(null);
    setFlash(false);
    lockRef.current = false;
  };

  return (
    <main className={s.root}>
      <video ref={videoRef} className={s.video} playsInline muted aria-hidden />
      <h1 className="sr-only">Scanner</h1>

      <div className={s.top}>
        <button type="button" className={s.round} onClick={() => navigate(-1)} aria-label="Fermer le scan">
          <X {...ICON} aria-hidden />
        </button>
        <Link to="/entry/new?manual=1" replace className={s.round}>
          <PenLine size={18} strokeWidth={1.75} aria-hidden />
          Saisie manuelle
        </Link>
      </div>

      <div className={s.middle}>
        {camera === 'denied' || camera === 'unavailable' ? (
          <div className={s.message}>
            <p>{camera === 'denied' ? "Glu n'a pas accès à la caméra. Tu peux l'autoriser dans les réglages du navigateur." : 'Pas de caméra disponible sur cet appareil.'}</p>
            <p>Tu peux importer une photo{mode === 'barcode' ? ' ou saisir le code' : ''}.</p>
          </div>
        ) : (
          mode === 'barcode' && (
            <div className={cx(s.reticle, flash && s.flash)} aria-hidden>
              <span className={cx(s.corner, s.c1)} />
              <span className={cx(s.corner, s.c2)} />
              <span className={cx(s.corner, s.c3)} />
              <span className={cx(s.corner, s.c4)} />
              {!flash && <span className={s.laser} />}
            </div>
          )
        )}
        <p className={s.hint} role="status" aria-live="polite">
          {status ?? HINT[mode]}
        </p>
      </div>

      <div className={s.bottom}>
        <div className={s.controls}>
          <button type="button" className={s.round} style={{ justifySelf: 'start' }} onClick={() => fileRef.current?.click()} disabled={busy}>
            <Images size={20} strokeWidth={1.75} aria-hidden />
            Galerie
          </button>
          {mode === 'barcode' ? (
            <span />
          ) : (
            <button type="button" className={s.shutter} aria-label={mode === 'plate' ? 'Photographier le plat' : "Photographier l'étiquette"} disabled={busy || camera !== 'live'} onClick={() => videoRef.current && void analyze(videoRef.current)} />
          )}
          {mode === 'barcode' ? (
            <button type="button" className={s.round} style={{ justifySelf: 'end' }} onClick={() => setCodeOpen(true)} disabled={busy}>
              <Keyboard size={20} strokeWidth={1.75} aria-hidden />
              Saisir
            </button>
          ) : (
            <span />
          )}
        </div>
        <div className={s.modes} role="tablist" aria-label="Mode de scan">
          {MODES.map((m) => (
            <button key={m.value} type="button" role="tab" aria-selected={mode === m.value} className={cx(s.mode, mode === m.value && s.modeOn)} onClick={() => switchMode(m.value)}>
              {m.label}
            </button>
          ))}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          data-testid="scan-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void onFile(f);
          }}
        />
      </div>

      <Sheet open={codeOpen} onClose={() => setCodeOpen(false)} title="Saisir le code-barres">
        <form className={s.codeForm} onSubmit={submitCode}>
          <Field label="Les chiffres sous le code-barres" inputMode="numeric" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 13))} placeholder="3017620422003" />
          {code.length >= 8 && !isValidEan(code) && <p className={cx(l.small, l.soft)}>Ce code ne semble pas complet. Vérifie les chiffres.</p>}
          <Button type="submit" full disabled={!isValidEan(code)}>
            Chercher
          </Button>
        </form>
      </Sheet>

      <Sheet
        open={notFound != null}
        onClose={() => {
          setNotFound(null);
          lockRef.current = false;
        }}
        title="Produit introuvable"
      >
        <div className={l.stack}>
          <p>Ce produit n'est pas dans Open Food Facts, ou ses glucides ne sont pas renseignés. Photographie son étiquette : Glu lira le tableau nutritionnel.</p>
          <Button
            full
            onClick={() => {
              setNotFound(null);
              switchMode('label');
            }}
          >
            Photographier l'étiquette
          </Button>
          <Button full variant="ghost" onClick={() => navigate('/entry/new?manual=1', { replace: true })}>
            Saisir à la main
          </Button>
        </div>
      </Sheet>
    </main>
  );
}
