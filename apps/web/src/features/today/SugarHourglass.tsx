import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import s from './today.module.css';

const NECK = 120;
const TOP = 'M48 20 C48 80 92 96 92 120 H108 C108 96 152 80 152 20 Z';
const BOTTOM = 'M92 120 C92 144 48 160 48 220 H152 C152 160 108 144 108 120 Z';
const OUTLINE = 'M48 20 C48 80 92 96 92 120 C92 144 48 160 48 220 M152 20 C152 80 108 96 108 120 C108 144 152 160 152 220';

/**
 * Jauge du jour : un sablier de sucre. Le haut contient ce qu'il reste avant l'objectif,
 * le bas ce qui est déjà consommé. `ratio` = consommé / objectif.
 */
export function SugarHourglass({ ratio, label }: { ratio: number; label: string }) {
  const id = useId();
  const reduce = useReducedMotion();
  const fill = Math.max(0, Math.min(1, ratio));
  const topY = 26 + fill * (NECK - 26); // surface du sucre restant : descend quand on consomme
  const bottomY = 220 - fill * 88; // sommet du tas : monte quand on consomme
  const flowing = fill > 0 && fill < 1;
  const transition = reduce ? { duration: 0.3 } : { type: 'spring' as const, stiffness: 46, damping: 12, mass: 1.1 };
  return (
    <svg className={s.gauge} viewBox="0 0 200 240" role="img" aria-label={label}>
      <defs>
        <clipPath id={`${id}t`}>
          <path d={TOP} />
        </clipPath>
        <clipPath id={`${id}b`}>
          <path d={BOTTOM} />
        </clipPath>
      </defs>
      <path d={TOP} fill="var(--glass)" />
      <path d={BOTTOM} fill="var(--glass)" />

      {/* Haut : le sucre qu'il reste, creusé en entonnoir vers le col. */}
      <g clipPath={`url(#${id}t)`}>
        <motion.g initial={{ y: 26 }} animate={{ y: topY }} transition={transition}>
          <path d="M0 0 H200 V200 H0 Z" fill="var(--honey)" opacity="0.5" />
          <path d="M60 0 Q100 16 140 0 Z" fill="var(--paper)" opacity="0.5" />
        </motion.g>
      </g>

      {/* Bas : le sucre consommé, en tas arrondi. */}
      <g clipPath={`url(#${id}b)`}>
        {flowing && <line className={s.stream} x1="100" x2="100" y1={NECK - 4} y2="222" stroke="var(--honey)" strokeWidth="4" strokeLinecap="round" strokeDasharray="3 7" />}
        <motion.g initial={{ y: 220 }} animate={{ y: bottomY }} transition={transition}>
          <path d="M0 14 Q100 -14 200 14 V240 H0 Z" fill="var(--honey)" />
        </motion.g>
        {flowing && !reduce && (
          <g fill="var(--paper)" stroke="var(--honey)" strokeWidth="1.5">
            <rect className={s.grain1} x="95" y={NECK} width="9" height="9" rx="2" />
            <rect className={s.grain2} x="97" y={NECK} width="7" height="7" rx="2" />
          </g>
        )}
      </g>

      <path d="M142 34 C140 62 128 78 116 92" fill="none" stroke="#fffaf2" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
      <path d={OUTLINE} fill="none" stroke="var(--ink)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 14 H164 M36 226 H164" stroke="var(--ink)" strokeWidth="12" strokeLinecap="round" />
    </svg>
  );
}
