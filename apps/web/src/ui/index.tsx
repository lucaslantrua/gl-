import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { ChartPie, History, House, Lightbulb, ScanLine } from 'lucide-react';
import type { Confidence, GiCategory } from '@/db/types';
import { giLabel } from '@/lib/gi-table';
import s from './ui.module.css';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export const ICON = { size: 22, strokeWidth: 1.75 } as const;

/* ---------- Button ---------- */
type Variant = 'primary' | 'soft' | 'ghost' | 'danger';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
  full?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', full, className, type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={cx(s.btn, s[variant], size === 'sm' && s.sm, full && s.full, className)} {...rest} />;
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}
export function IconButton({ label, className, type = 'button', ...rest }: IconButtonProps) {
  return <button type={type} aria-label={label} title={label} className={cx(s.iconBtn, className)} {...rest} />;
}

/* ---------- Card ---------- */
export function Card({
  children,
  flat,
  tight,
  className,
  style,
  as: Tag = 'section',
}: {
  children: ReactNode;
  flat?: boolean;
  tight?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: 'section' | 'div' | 'article' | 'li';
}) {
  return (
    <Tag className={cx(s.card, flat && s.cardFlat, tight && s.cardTight, className)} style={style}>
      {children}
    </Tag>
  );
}

/* ---------- Chip & badges ---------- */
type Tone = 'neutral' | 'honey' | 'sage' | 'plum' | 'terracotta';
const TONE: Record<Tone, string | undefined> = {
  neutral: undefined,
  honey: s.toneHoney,
  sage: s.toneSage,
  plum: s.tonePlum,
  terracotta: s.toneTerracotta,
};
export function Chip({
  children,
  tone = 'neutral',
  selected,
  onClick,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const cls = cx(s.chip, TONE[tone], selected && s.chipSelected, className);
  if (onClick) {
    return (
      <button type="button" className={cls} aria-pressed={selected} onClick={onClick}>
        {children}
      </button>
    );
  }
  return <span className={cls}>{children}</span>;
}

const GI_TONE: Record<GiCategory, Tone> = { low: 'sage', medium: 'honey', high: 'plum' };
const GI_DOT: Record<GiCategory, string | undefined> = { low: s.dotLow, medium: s.dotMedium, high: s.dotHigh };

export function GiDot({ category }: { category: GiCategory }) {
  return <span className={cx(s.dot, GI_DOT[category])} aria-hidden />;
}

/** Pastille IG : couleur + libellé (jamais la couleur seule). */
export function GiChip({ category, gi, estimated }: { category: GiCategory; gi?: number; estimated?: boolean }) {
  return (
    <Chip tone={GI_TONE[category]}>
      <GiDot category={category} />
      {giLabel(category)}
      {gi != null && <span className="num">{estimated ? '~' : ''}{Math.round(gi)}</span>}
    </Chip>
  );
}

/** Toute valeur nutritionnelle affichée indique sa source. */
export function SourceBadge({ confidence }: { confidence: Confidence }) {
  return confidence === 'estimate' ? (
    <span className={cx(s.badge, s.badgeEstimate)}>estimation</span>
  ) : (
    <span className={cx(s.badge, s.badgeManufacturer)}>donnée fabricant</span>
  );
}

/* ---------- Slider ---------- */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const p = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  return (
    <div className={s.slider}>
      <div className={s.sliderHead}>
        <label htmlFor={id}>{label}</label>
        <span className={cx('num', s.sliderValue)}>
          {String(value).replace('.', ',')}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        id={id}
        className={s.range}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--p': `${p}%` } as CSSProperties}
        aria-valuetext={`${value}${unit ? ` ${unit}` : ''}`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/* ---------- Segmented ---------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <div className={s.segmented} role="tablist" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="tab" aria-selected={on} className={cx(s.segment, on && s.segmentOn)} onClick={() => onChange(o.value)}>
            {on && <motion.span layoutId={`seg-${id}`} className={s.segmentPill} transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 36 }} />}
            <span className={s.segmentLabel}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Sheet ---------- */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !ref.current) return;
      const focusables = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => ref.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
      previous?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className={s.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={ref}
            className={s.sheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className={s.grabber} aria-hidden />
            <h2 id={titleId} className={s.sheetTitle}>
              {title}
            </h2>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- Bottom bar ---------- */
const TABS = [
  { to: '/', label: 'Jour', Icon: House, end: true },
  { to: '/history', label: 'Historique', Icon: History, end: false },
  null,
  { to: '/stats', label: 'Stats', Icon: ChartPie, end: false },
  { to: '/insights', label: 'Recos', Icon: Lightbulb, end: false },
] as const;

export function BottomBar() {
  return (
    <nav className={s.bar} aria-label="Navigation principale">
      {TABS.map((t) =>
        t ? (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cx(s.tab, isActive && s.tabOn)}>
            <t.Icon {...ICON} aria-hidden />
            {t.label}
          </NavLink>
        ) : (
          <NavLink key="scan" to="/scan" className={s.fab} aria-label="Scanner">
            <ScanLine size={30} strokeWidth={2} aria-hidden />
          </NavLink>
        ),
      )}
    </nav>
  );
}

/* ---------- Logo ---------- */
/** Wordmark "glu" : le "u" est un verre vu de face, à moitié plein de miel, avec une bulle qui remonte. */
export function Logo({ size = 40, bubble = true }: { size?: number; bubble?: boolean }) {
  const clip = useId();
  return (
    <span className={s.logo} style={{ fontSize: size }} role="img" aria-label="Glu">
      <span aria-hidden>gl</span>
      <svg className={s.logoU} viewBox="0 0 58 62" aria-hidden>
        <defs>
          <clipPath id={clip}>
            <path d="M7 4 V34 a22 22 0 0 0 44 0 V4 Z" />
          </clipPath>
        </defs>
        <rect x="0" y="26" width="58" height="40" fill="var(--honey)" clipPath={`url(#${clip})`} />
        <path d="M7 4 V34 a22 22 0 0 0 44 0 V4" fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="round" />
        {bubble && <circle className={s.bubble} cx="29" cy="-8" r="5" fill="var(--honey)" />}
      </svg>
    </span>
  );
}

/* ---------- Field ---------- */
interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, hint, className, ...rest }, ref) {
  return (
    <label className={s.field}>
      {label}
      <input ref={ref} className={cx(s.input, className)} {...rest} />
      {hint && <span style={{ fontWeight: 500 }}>{hint}</span>}
    </label>
  );
});

export { s as uiStyles };
