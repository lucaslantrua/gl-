import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import s from './today.module.css';

const TOP = 16;
const BOTTOM = 228;
const GLASS = 'M26 12 L44 208 Q46 228 66 228 L134 228 Q154 228 156 208 L174 12';
// Vague périodique (période 100) tracée sur 400 de large pour pouvoir défiler en boucle.
const wave = (amp: number) => `M0 0 ${Array.from({ length: 8 }, (_, i) => `Q${i * 50 + 25} ${i % 2 ? amp : -amp} ${i * 50 + 50} 0`).join(' ')} V260 H0 Z`;

/** Jauge du jour : un verre qui se remplit de miel. `ratio` = consommé / objectif. */
export function GlassGauge({ ratio, label }: { ratio: number; label: string }) {
  const clip = useId();
  const reduce = useReducedMotion();
  const fill = Math.max(0, Math.min(1, ratio));
  const y = BOTTOM - fill * (BOTTOM - TOP - 8);
  const transition = reduce ? { duration: 0.3 } : { type: 'spring' as const, stiffness: 48, damping: 11, mass: 1.1 };
  return (
    <svg className={s.glass} viewBox="0 0 200 240" role="img" aria-label={label}>
      <defs>
        <clipPath id={clip}>
          <path d={`${GLASS} Z`} />
        </clipPath>
      </defs>
      <path d={`${GLASS} Z`} fill="var(--glass)" />
      <g clipPath={`url(#${clip})`}>
        <motion.g initial={{ y: BOTTOM }} animate={{ y }} transition={transition}>
          <g className={s.waveBack}>
            <path d={wave(7)} fill="var(--honey)" opacity="0.45" transform="translate(-30 -5)" />
          </g>
          <g className={s.waveFront}>
            <path d={wave(5)} fill="var(--honey)" />
          </g>
        </motion.g>
        {fill > 0.08 && !reduce && (
          <g fill="var(--paper)" opacity="0.55">
            <circle className={s.b1} cx="78" cy="214" r="4" />
            <circle className={s.b2} cx="112" cy="218" r="3" />
            <circle className={s.b3} cx="96" cy="210" r="2.5" />
          </g>
        )}
      </g>
      <path d="M150 34 L138 176" stroke="#fffaf2" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
      <path d={GLASS} fill="none" stroke="var(--ink)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
