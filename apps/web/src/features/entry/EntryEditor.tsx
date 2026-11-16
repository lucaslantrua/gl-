import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Plus } from 'lucide-react';
import { useDraft, type DraftItem } from '@/app/stores';
import { db } from '@/db/db';
import type { Entry, MealSlot } from '@/db/types';
import { SLOT_LABEL, slotForDate, toLocalInput } from '@/lib/dates';
import { makeThumb } from '@/lib/image';
import { carbRange, fmt, scaleItem, totalCarbs, uid } from '@/lib/nutrition';
import { Button, Card, Chip, cx, ICON, IconButton, Sheet } from '@/ui';
import { layout as l } from '@/ui/Page';
import { useObjectUrl } from '@/ui/Thumb';
import { AddItemSheet, ItemCard, PhotoStage, SugarCubes } from './parts';
import s from './entry.module.css';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner', 'other'];

export default function EntryEditor() {
  const { id = 'new' } = useParams();
  const isNew = id === 'new';
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const storeDraft = useDraft((st) => st.draft);
  const setDraft = useDraft((st) => st.setDraft);
  const manual = isNew && (params.get('manual') === '1' || !storeDraft);
  const draft = isNew && !manual ? storeDraft : null;

  const [items, setItems] = useState<DraftItem[]>([]);
  const [eatenAt, setEatenAt] = useState(() => new Date());
  const [slot, setSlot] = useState<MealSlot>(() => slotForDate(new Date()));
  const [slotTouched, setSlotTouched] = useState(false);
  const [note, setNote] = useState('');
  const [existing, setExisting] = useState<Entry | null>(null);
  const [missing, setMissing] = useState(false);
  const [addOpen, setAddOpen] = useState(manual);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const synced = useRef<DraftItem[] | null>(null);

  // Entrée existante : on la charge depuis IndexedDB.
  useEffect(() => {
    if (isNew) return;
    void db.entries.get(id).then((e) => {
      if (!e) return setMissing(true);
      setExisting(e);
      setItems(e.items.map((ref) => ({ ref, quantityG: ref.quantityG })));
      setEatenAt(new Date(e.eatenAt));
      setSlot(e.mealSlot);
      setSlotTouched(true);
      setNote(e.note ?? '');
    });
  }, [id, isNew]);

  // Nouveau scan : on récupère les items quand l'analyse est prête.
  useEffect(() => {
    if (draft?.status === 'ready' && synced.current !== draft.items) {
      synced.current = draft.items;
      setItems(draft.items);
    }
  }, [draft]);

  const analyzing = draft?.status === 'analyzing';
  const photo = draft?.photo ?? existing?.photoThumb;
  const photoUrl = useObjectUrl(photo);
  const scaled = useMemo(() => items.map((d) => scaleItem(d.ref, d.quantityG)), [items]);
  const total = totalCarbs(scaled);
  const range = carbRange(scaled);
  const withSugars = scaled.filter((i) => i.sugarsG != null);
  const sugars = withSugars.reduce((a, i) => a + (i.sugarsG ?? 0), 0);
  const anyEstimate = scaled.some((i) => i.confidence === 'estimate');

  const close = () => {
    setDraft(null);
    navigate(isNew ? '/' : -1 as never, { replace: isNew });
  };

  const save = async () => {
    if (!scaled.length || saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    let photoThumb = existing?.photoThumb;
    if (!photoThumb && draft?.photo) photoThumb = await makeThumb(draft.photo).catch(() => undefined);
    const entry: Entry = {
      id: existing?.id ?? uid(),
      createdAt: existing?.createdAt ?? now,
      eatenAt: eatenAt.toISOString(),
      mealSlot: slot,
      source: existing?.source ?? draft?.source ?? 'manual',
      ...(photoThumb ? { photoThumb } : {}),
      items: scaled,
      totalCarbsG: total,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    await db.entries.put(entry);
    setDraft(null);
    navigate('/', { replace: true });
  };

  if (missing) {
    return (
      <div className={s.wrap}>
        <div className={l.empty}>
          <p>Cette entrée n'existe plus.</p>
          <Button onClick={() => navigate('/', { replace: true })}>Retour à l'accueil</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <header className={cx(l.row, l.between)}>
        <div className={l.row}>
          <IconButton label="Retour" onClick={close}>
            <ChevronLeft {...ICON} />
          </IconButton>
          <h1 className={l.title} style={{ fontSize: '1.4rem' }}>
            {isNew ? (analyzing ? 'Je regarde ça' : 'Voilà ce que je vois') : 'Modifier'}
          </h1>
        </div>
      </header>

      {photoUrl && <PhotoStage url={photoUrl} analyzing={analyzing} items={items} small={!isNew} />}

      {draft?.status === 'error' && (
        <div className={cx(s.note, s.noteError)} role="alert">
          <p>{draft.error}</p>
          <div className={cx(l.row, l.wrap)} style={{ marginTop: 12 }}>
            <Button size="sm" variant="soft" onClick={() => navigate('/scan', { replace: true })}>
              Reprendre une photo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAddOpen(true)}>
              Ajouter à la main
            </Button>
          </div>
        </div>
      )}

      {draft?.status === 'ready' && draft.source === 'plate_photo' && draft.items.length === 0 && (
        <div className={s.note} role="status">
          Je ne vois pas d'aliment sur cette photo. {draft.notes}
        </div>
      )}
      {draft?.status === 'ready' && draft.notes && draft.items.length > 0 && <div className={s.note}>{draft.notes}</div>}

      {items.map((d, i) => (
        <ItemCard
          key={d.ref.id}
          draft={d}
          product={draft?.product}
          onChange={(next) => setItems((xs) => xs.map((x, j) => (j === i ? next : x)))}
          onRemove={() => setItems((xs) => xs.filter((_, j) => j !== i))}
        />
      ))}

      {!analyzing && (
        <Button variant="soft" onClick={() => setAddOpen(true)}>
          <Plus {...ICON} aria-hidden />
          Ajouter un aliment
        </Button>
      )}

      {scaled.length > 0 && withSugars.length > 0 && <SugarCubes sugarsG={sugars} partial={withSugars.length < scaled.length} />}
      {scaled.length > 0 && withSugars.length === 0 && (
        <Card flat tight>
          <span className={cx(l.small, l.soft)}>Sucres non renseignés : pas d'équivalence en morceaux de sucre pour cette entrée.</span>
        </Card>
      )}

      {!analyzing && (
        <Card>
          <div className={l.stack}>
            <h2 className={l.h2}>Quand ?</h2>
            <div className={l.scrollX} role="group" aria-label="Créneau repas">
              {SLOTS.map((k) => (
                <Chip
                  key={k}
                  selected={slot === k}
                  onClick={() => {
                    setSlot(k);
                    setSlotTouched(true);
                  }}
                >
                  {SLOT_LABEL[k]}
                </Chip>
              ))}
            </div>
            <input
              className={s.when}
              type="datetime-local"
              aria-label="Date et heure"
              value={toLocalInput(eatenAt)}
              max={toLocalInput(new Date(Date.now() + 86_400_000))}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (Number.isNaN(d.getTime())) return;
                setEatenAt(d);
                if (!slotTouched) setSlot(slotForDate(d));
              }}
            />
            <input className={s.when} style={{ fontWeight: 500 }} aria-label="Note" placeholder="Une note ? (optionnel)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          </div>
        </Card>
      )}

      {existing && (
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          Supprimer cette entrée
        </Button>
      )}

      <div className={s.footer}>
        <div className={cx(s.total, l.grow)}>
          <span className={cx('num', s.totalNum)} data-testid="entry-total">
            {anyEstimate ? '~' : ''}
            {fmt(total)} g
          </span>
          <span className={cx(l.small, l.soft)}>{range ? `entre ${fmt(range.min)} et ${fmt(range.max)} g` : 'de glucides'}</span>
        </div>
        <Button onClick={() => void save()} disabled={!scaled.length || analyzing || saving}>
          Enregistrer
        </Button>
      </div>

      <AddItemSheet open={addOpen} onClose={() => setAddOpen(false)} onAdd={(d) => setItems((xs) => [...xs, d])} />

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer cette entrée ?">
        <div className={l.stack}>
          <Button
            variant="danger"
            full
            onClick={() =>
              void (async () => {
                if (existing) await db.entries.delete(existing.id);
                navigate('/', { replace: true });
              })()
            }
          >
            Supprimer
          </Button>
          <Button variant="ghost" full onClick={() => setConfirmDelete(false)}>
            Annuler
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
