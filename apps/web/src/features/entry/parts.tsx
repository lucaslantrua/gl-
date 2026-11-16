import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import type { DraftItem } from '@/app/stores';
import type { FoodItem, OffProduct } from '@/db/types';
import { giCategoryOf, glycemicLoad, fmt, quickQuantities, scaleItem, sugarCubes, uid } from '@/lib/nutrition';
import { matchGiByName } from '@/lib/gi-table';
import { Button, Card, Chip, cx, Field, GiChip, ICON, IconButton, Segmented, Sheet, SourceBadge, uiStyles } from '@/ui';
import { layout as l } from '@/ui/Page';
import s from './entry.module.css';

/* ---------- Photo + chips "découpe" ---------- */
export function PhotoStage({ url, analyzing, items, small }: { url: string; analyzing: boolean; items: DraftItem[]; small?: boolean }) {
  const reduce = useReducedMotion();
  const withBox = items.length > 0 && items.every((i) => i.box);
  const pop = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.3, y: 14 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: reduce ? { duration: 0.2 } : { type: 'spring' as const, stiffness: 520, damping: 18, delay: 0.15 + i * 0.08 },
  });
  return (
    <div className={cx(s.stage, analyzing && s.frozen, small && s.stageSmall)}>
      <img src={url} alt="Photo de ce que tu as scanné" />
      {analyzing && (
        <>
          <div className={s.sweep} aria-hidden />
          <span className={s.analyzing} role="status">
            Analyse en cours…
          </span>
        </>
      )}
      {!analyzing && !small && withBox &&
        items.map((it, i) => (
          <span key={it.ref.id} className={s.pin} style={{ left: `${(it.box!.x + it.box!.w / 2) * 100}%`, top: `${(it.box!.y + it.box!.h / 2) * 100}%` }}>
            <motion.span className={s.pinChip} {...pop(i)}>
              {it.ref.name}
            </motion.span>
          </span>
        ))}
      {!analyzing && !small && !withBox && items.length > 0 && (
        <div className={s.chipList}>
          {items.map((it, i) => (
            <motion.span key={it.ref.id} className={s.pinChip} {...pop(i)}>
              {it.ref.name}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Carte d'un item ---------- */
export function ItemCard({
  draft,
  product,
  onChange,
  onRemove,
}: {
  draft: DraftItem;
  product?: OffProduct;
  onChange: (d: DraftItem) => void;
  onRemove: () => void;
}) {
  const item = scaleItem(draft.ref, draft.quantityG);
  const [fixing, setFixing] = useState(false);
  const max = Math.max(Math.ceil((draft.ref.quantityG * 2.5) / 50) * 50, item.unit === 'ml' ? 1000 : 300, draft.quantityG);
  const p = Math.min(100, (draft.quantityG / max) * 100);
  const setQty = (q: number) => onChange({ ...draft, quantityG: Math.max(0, Math.min(5000, q)) });
  const quick = product ? quickQuantities(product) : [];

  return (
    <Card className={s.item} as="article">
      <div className={s.nameRow}>
        <input className={s.nameInput} value={draft.ref.name} aria-label="Nom de l'aliment" onChange={(e) => onChange({ ...draft, ref: { ...draft.ref, name: e.target.value } })} />
        <IconButton label={`Supprimer ${draft.ref.name}`} onClick={onRemove}>
          <Trash2 {...ICON} />
        </IconButton>
      </div>

      <div className={s.carbRow}>
        <div>
          <span className={cx('num', s.carbs)} data-testid="item-carbs">
            {item.confidence === 'estimate' ? '~' : ''}
            {fmt(item.carbsG)}
          </span>
          <span className={s.carbsUnit}>g de glucides</span>
          {item.carbsMinG != null && item.carbsMaxG != null && (
            <div className={s.range}>
              entre {fmt(item.carbsMinG)} et {fmt(item.carbsMaxG)} g
            </div>
          )}
        </div>
        <SourceBadge confidence={item.confidence} />
      </div>

      <div className={l.stack}>
        <div className={s.qtyHead}>
          <label htmlFor={`q-${draft.ref.id}`}>Quantité</label>
          <span className={l.row} style={{ gap: 6 }}>
            <input className={s.qtyInput} inputMode="decimal" aria-label={`Quantité en ${item.unit}`} value={draft.quantityG || ''} onChange={(e) => setQty(Number(e.target.value.replace(',', '.').replace(/[^\d.]/g, '')) || 0)} />
            {item.unit}
          </span>
        </div>
        <input id={`q-${draft.ref.id}`} className={uiStyles.range} type="range" min={0} max={max} step={5} value={draft.quantityG} style={{ '--p': `${p}%` } as React.CSSProperties} aria-valuetext={`${draft.quantityG} ${item.unit}`} onChange={(e) => setQty(Number(e.target.value))} />
        {quick.length > 0 && (
          <div className={l.scrollX}>
            {quick.map((q) => (
              <Chip key={q.id} selected={draft.quantityG === q.quantity} onClick={() => setQty(q.quantity)}>
                {q.label}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <div className={s.meta}>
        {item.giCategory ? (
          <>
            <GiChip category={item.giCategory} gi={item.glycemicIndex} estimated />
            {item.glycemicIndex != null && <Chip>Charge glycémique {fmt(glycemicLoad(item.glycemicIndex, item.carbsG))}</Chip>}
          </>
        ) : (
          <Chip>IG non renseigné</Chip>
        )}
        {item.sugarsG != null && <Chip tone="honey">dont sucres {fmt(item.sugarsG)} g</Chip>}
        {item.fiberG != null && <Chip tone="sage">fibres {fmt(item.fiberG)} g</Chip>}
      </div>

      {item.confidence === 'estimate' &&
        (fixing ? (
          <Field
            label={`Glucides pour ${fmt(draft.quantityG)} ${item.unit} (g)`}
            inputMode="decimal"
            defaultValue={String(item.carbsG).replace('.', ',')}
            onChange={(e) => {
              const v = Number(e.target.value.replace(',', '.'));
              if (!Number.isFinite(v) || v < 0 || draft.quantityG <= 0) return;
              // Une valeur corrigée à la main remplace l'estimation et sa fourchette.
              const { carbsMinG: _a, carbsMaxG: _b, ...rest } = item;
              onChange({ ...draft, ref: { ...rest, carbsG: v } });
            }}
          />
        ) : (
          <button type="button" className={s.linkBtn} onClick={() => setFixing(true)}>
            Corriger les glucides
          </button>
        ))}
    </Card>
  );
}

/* ---------- Équivalence en morceaux de sucre ---------- */
const MAX_CUBES = 24;
export function SugarCubes({ sugarsG, partial }: { sugarsG: number; partial: boolean }) {
  const reduce = useReducedMotion();
  const n = sugarCubes(sugarsG);
  const shown = Math.min(n, MAX_CUBES);
  return (
    <Card className={s.cubesCard}>
      <div className={l.stack}>
        <span className={l.eyebrow}>Équivalence</span>
        <span className="num" style={{ fontSize: '1.5rem', lineHeight: 1.1 }} data-testid="sugar-cubes">
          = {n} {n > 1 ? 'morceaux' : 'morceau'} de sucre
        </span>
        <span className={cx(l.small, l.soft)}>
          {fmt(sugarsG)} g de sucres, 5 g par morceau.{partial ? ' Sucres non renseignés pour une partie des aliments.' : ''}
        </span>
      </div>
      <div className={s.cubes} aria-hidden>
        {Array.from({ length: shown }, (_, i) => (
          <motion.span
            key={`${shown}-${i}`}
            className={s.cube}
            initial={reduce ? { opacity: 0 } : { y: -90, opacity: 0, rotate: i % 2 ? 25 : -25 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 380, damping: 17, delay: i * 0.045 }}
          />
        ))}
      </div>
    </Card>
  );
}

/* ---------- Ajout manuel ---------- */
const num = (v: string): number | undefined => {
  const n = Number(v.replace(',', '.'));
  return v.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function AddItemSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (d: DraftItem) => void }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<'g' | 'ml'>('g');
  const [carbs, setCarbs] = useState('');
  const [sugars, setSugars] = useState('');
  const [fiber, setFiber] = useState('');
  const [fromPack, setFromPack] = useState(false);
  const gi = name.trim().length >= 3 ? matchGiByName(name) : undefined;
  const q = num(qty);
  const c = num(carbs);
  const valid = name.trim().length > 0 && q != null && q > 0 && c != null && (unit === 'ml' || c <= q);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || q == null || c == null) return;
    const ref: FoodItem = {
      id: uid(),
      name: name.trim(),
      quantityG: q,
      unit,
      carbsG: c,
      sugarsG: num(sugars),
      fiberG: num(fiber),
      glycemicIndex: gi?.gi,
      giCategory: gi ? giCategoryOf(gi.gi) : undefined,
      confidence: fromPack ? 'manufacturer' : 'estimate',
    };
    onAdd({ ref, quantityG: q });
    setName('');
    setQty('');
    setCarbs('');
    setSugars('');
    setFiber('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Ajouter un aliment">
      <form className={l.stack} onSubmit={submit}>
        <Field label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Baguette, pomme, riz…" autoComplete="off" />
        {gi && (
          <p className={cx(l.small, l.soft)}>
            Repère IG : {gi.gi} ({gi.name}, tables internationales).
          </p>
        )}
        <div className={s.two}>
          <Field label="Quantité" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="60" />
          <div className={l.stack} style={{ gap: 6 }}>
            <span className={cx(l.small, l.soft)} style={{ fontWeight: 600 }}>Unité</span>
            <Segmented label="Unité" value={unit} onChange={setUnit} options={[{ value: 'g', label: 'g' }, { value: 'ml', label: 'ml' }]} />
          </div>
        </div>
        <Field label="Glucides pour cette quantité (g)" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="34" />
        {q != null && c != null && unit === 'g' && c > q && <p className={cx(l.small)} style={{ color: 'var(--plum-text)' }}>Les glucides ne peuvent pas dépasser la quantité.</p>}
        <div className={s.two}>
          <Field label="Dont sucres (g), optionnel" inputMode="decimal" value={sugars} onChange={(e) => setSugars(e.target.value)} />
          <Field label="Fibres (g), optionnel" inputMode="decimal" value={fiber} onChange={(e) => setFiber(e.target.value)} />
        </div>
        <label className={s.checkRow}>
          <input type="checkbox" checked={fromPack} onChange={(e) => setFromPack(e.target.checked)} />
          Valeurs lues sur l'emballage
        </label>
        <Button type="submit" full disabled={!valid}>
          Ajouter
        </Button>
      </form>
    </Sheet>
  );
}
