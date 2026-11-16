import { motion, useReducedMotion } from 'framer-motion';
import s from './today.module.css';

const C = 110;
const R = 74;
const DOUGH = 44;
const GLAZE = 30;

const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
};

// Coulures du glaçage : petites bosses sur les bords, tout autour de l'anneau.
const DRIPS = Array.from({ length: 24 }, (_, i) => ({ deg: i * 15 + 6, r: i % 2 ? R + GLAZE / 2 - 1 : R - GLAZE / 2 + 1, size: 4.5 + ((i * 7) % 5) * 0.7 }));
// Vermicelles : position, rotation et couleur fixes, pour un rendu identique à chaque fois.
const COLORS = ['var(--paper)', 'var(--plum)', 'var(--sage)', 'var(--terracotta)'];
const SPRINKLES = Array.from({ length: 22 }, (_, i) => ({ deg: i * 16.2 + 9, r: R + (((i * 5) % 7) - 3) * 2.6, rot: (i * 47) % 180, color: COLORS[i % COLORS.length]! }));

/** Jauge du jour : un donut dont le glaçage avance avec les glucides consommés. `ratio` = consommé / objectif. */
export function DonutGauge({ ratio, label }: { ratio: number; label: string }) {
  const reduce = useReducedMotion();
  const fill = Math.max(0, Math.min(1, ratio));
  const reached = fill * 360;
  const spring = reduce ? { duration: 0.3 } : { type: 'spring' as const, stiffness: 40, damping: 13 };
  const pop = (deg: number) => ({
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: reduce ? { duration: 0.2 } : { type: 'spring' as const, stiffness: 420, damping: 16, delay: 0.25 + (deg / 360) * 0.7 },
  });
  return (
    <svg className={s.gauge} viewBox="0 0 220 220" role="img" aria-label={label}>
      {/* Pâte */}
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--dough-edge)" strokeWidth={DOUGH + 6} />
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--dough)" strokeWidth={DOUGH} />
      {/* Glaçage */}
      {fill > 0 && (
        <>
          <motion.circle cx={C} cy={C} r={R} fill="none" stroke="var(--honey)" strokeWidth={GLAZE} strokeLinecap="round" transform={`rotate(-90 ${C} ${C})`} initial={{ pathLength: 0 }} animate={{ pathLength: fill }} transition={spring} />
          {DRIPS.filter((d) => d.deg <= reached - 4).map((d) => {
            const p = polar(d.deg, d.r);
            return <motion.circle key={d.deg} cx={p.x} cy={p.y} r={d.size} fill="var(--honey)" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} {...pop(d.deg)} />;
          })}
          <motion.circle cx={C} cy={C} r={R + 6} fill="none" stroke="#fffaf2" strokeOpacity={0.45} strokeWidth={4} strokeLinecap="round" transform={`rotate(-90 ${C} ${C})`} initial={{ pathLength: 0 }} animate={{ pathLength: Math.max(0, fill - 0.03) }} transition={spring} />
          {SPRINKLES.filter((d) => d.deg <= reached - 5).map((d) => {
            const p = polar(d.deg, d.r);
            return (
              <g key={d.deg} transform={`translate(${p.x} ${p.y}) rotate(${d.rot})`}>
                <motion.rect x={-5} y={-1.75} width={10} height={3.5} rx={1.75} fill={d.color} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} {...pop(d.deg)} />
              </g>
            );
          })}
        </>
      )}
    </svg>
  );
}
