import { useNavigate } from 'react-router-dom';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear, scaleSqrt } from '@visx/scale';
import { Bar } from '@visx/shape';
import { MEAL_SLOTS, type Entry } from '@/db/types';
import { dailyTotals, entriesOfDay, slotTotals } from '@/lib/aggregate';
import { GI_COLOR, SLOT_COLOR } from '@/lib/colors';
import { addDays, dayKey, formatDayShort, formatTime, isSameDay, SLOT_LABEL, startOfMonth, WEEKDAYS_SHORT, weekdayIndex } from '@/lib/dates';
import { entryGi, entryTitle, fmt, giCategoryOf } from '@/lib/nutrition';
import { cx } from '@/ui';
import s from './history.module.css';

const onKey = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
};

/* ---------- Jour : une bulle par prise sur un axe 0h-24h ---------- */
export function DayChart({ entries }: { entries: Entry[] }) {
  const navigate = useNavigate();
  const W = 340;
  const H = 150;
  const x = scaleLinear({ domain: [0, 24], range: [14, W - 14] });
  const max = Math.max(60, ...entries.map((e) => e.totalCarbsG));
  const r = scaleSqrt({ domain: [0, max], range: [7, 34] });
  return (
    <svg className={s.svg} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Prises de la journée, de 0 h à 24 h">
      <line x1={x(0)} x2={x(24)} y1={112} y2={112} stroke="var(--line)" strokeWidth={2} strokeLinecap="round" />
      {[0, 6, 12, 18, 24].map((h) => (
        <g key={h}>
          <line x1={x(h)} x2={x(h)} y1={108} y2={116} stroke="var(--ink-soft)" strokeWidth={1.5} strokeLinecap="round" />
          <text className={s.axisText} x={x(h)} y={134} textAnchor="middle">
            {h}h
          </text>
        </g>
      ))}
      {[...entries]
        .sort((a, b) => b.totalCarbsG - a.totalCarbsG)
        .map((e) => {
          const d = new Date(e.eatenAt);
          const gi = entryGi(e);
          const radius = r(e.totalCarbsG);
          const cxPos = x(d.getHours() + d.getMinutes() / 60);
          const go = () => navigate(`/entry/${e.id}`);
          return (
            <g
              key={e.id}
              className={s.bubble}
              role="link"
              tabIndex={0}
              aria-label={`${formatTime(d)}, ${entryTitle(e)}, ${fmt(e.totalCarbsG)} g de glucides${gi != null ? `, IG ${gi}` : ''}`}
              onClick={go}
              onKeyDown={onKey(go)}
            >
              <circle cx={cxPos} cy={112 - radius - 6} r={radius} fill={gi != null ? GI_COLOR[giCategoryOf(gi)] : 'var(--sunken)'} stroke="var(--paper)" strokeWidth={2} fillOpacity={0.92} />
              {gi == null && <circle cx={cxPos} cy={112 - radius - 6} r={radius - 1} fill="none" stroke="var(--ink-soft)" strokeWidth={1.5} strokeDasharray="3 3" />}
              {radius >= 15 && (
                <text className={s.bubbleText} x={cxPos} y={112 - radius - 2} textAnchor="middle" style={gi == null || giCategoryOf(gi) === 'high' ? { fill: gi == null ? 'var(--ink)' : '#fffaf2' } : undefined}>
                  {Math.round(e.totalCarbsG)}
                </text>
              )}
            </g>
          );
        })}
    </svg>
  );
}

export function GiLegend() {
  return (
    <div className={s.legend}>
      {(['low', 'medium', 'high'] as const).map((c) => (
        <span key={c} className={s.legendItem}>
          <span className={s.swatch} style={{ background: GI_COLOR[c], borderRadius: '50%' }} />
          IG {c === 'low' ? 'bas' : c === 'medium' ? 'moyen' : 'haut'}
        </span>
      ))}
      <span className={s.legendItem}>
        <span className={s.swatch} style={{ borderRadius: '50%', boxShadow: 'inset 0 0 0 1.5px var(--ink-soft)' }} />
        IG inconnu
      </span>
    </div>
  );
}

/* ---------- Semaine : 7 barres empilées par créneau + ligne d'objectif ---------- */
export function WeekChart({ entries, weekStart, goal, onPickDay }: { entries: Entry[]; weekStart: Date; goal?: number; onPickDay: (d: Date) => void }) {
  const W = 340;
  const H = 190;
  const top = 14;
  const bottom = 160;
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const list = entriesOfDay(entries, day);
    return { day, slots: slotTotals(list), total: list.reduce((a, e) => a + e.totalCarbsG, 0) };
  });
  const max = Math.max(goal ? goal * 1.1 : 0, ...days.map((d) => d.total), 50);
  const x = scaleBand({ domain: days.map((_, i) => i), range: [0, W], padding: 0.32 });
  const y = scaleLinear({ domain: [0, max], range: [bottom, top] });
  const today = new Date();
  return (
    <svg className={s.svg} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Glucides par jour de la semaine, empilés par créneau repas">
      <line x1={0} x2={W} y1={bottom} y2={bottom} stroke="var(--line)" strokeWidth={2} />
      {days.map((d, i) => {
        let acc = 0;
        const bx = x(i) ?? 0;
        const go = () => onPickDay(d.day);
        return (
          <Group key={i}>
            {MEAL_SLOTS.filter((k) => d.slots[k] > 0).map((k) => {
              const y1 = y(acc + d.slots[k]);
              const h = y(acc) - y1;
              acc += d.slots[k];
              return <Bar key={k} x={bx} y={y1 + 1} width={x.bandwidth()} height={Math.max(0, h - 2)} rx={4} fill={SLOT_COLOR[k]} />;
            })}
            {d.total > 0 && (
              <text className={s.axisText} x={bx + x.bandwidth() / 2} y={y(d.total) - 5} textAnchor="middle" style={{ fill: 'var(--ink)' }}>
                {Math.round(d.total)}
              </text>
            )}
            <text className={s.axisText} x={bx + x.bandwidth() / 2} y={bottom + 18} textAnchor="middle" style={isSameDay(d.day, today) ? { fill: 'var(--accent-text)', fontSize: 12 } : undefined}>
              {WEEKDAYS_SHORT[i]}
            </text>
            <rect
              className={s.barHit}
              x={bx - 6}
              y={top}
              width={x.bandwidth() + 12}
              height={bottom - top + 24}
              rx={8}
              role="link"
              tabIndex={0}
              aria-label={`${formatDayShort(d.day)} : ${Math.round(d.total)} g. Voir le jour`}
              onClick={go}
              onKeyDown={onKey(go)}
            />
          </Group>
        );
      })}
      {goal ? (
        <g>
          <line x1={0} x2={W} y1={y(goal)} y2={y(goal)} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="5 5" />
          <text className={s.axisText} x={W} y={y(goal) - 5} textAnchor="end" style={{ fill: 'var(--ink)' }}>
            objectif {goal} g
          </text>
        </g>
      ) : null}
    </svg>
  );
}

export function SlotLegend() {
  return (
    <div className={s.legend}>
      {MEAL_SLOTS.map((k) => (
        <span key={k} className={s.legendItem}>
          <span className={s.swatch} style={{ background: SLOT_COLOR[k] }} />
          {SLOT_LABEL[k]}
        </span>
      ))}
    </div>
  );
}

/* ---------- Mois : heatmap calendrier ---------- */
export function MonthGrid({ entries, month, goal, onPickDay }: { entries: Entry[]; month: Date; goal?: number; onPickDay: (d: Date) => void }) {
  const first = startOfMonth(month);
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const totals = dailyTotals(entries);
  const values = Array.from({ length: count }, (_, i) => totals.get(dayKey(addDays(first, i))) ?? 0);
  const max = Math.max(goal ?? 0, ...values, 1);
  const today = new Date();
  return (
    <div className={s.cal}>
      {WEEKDAYS_SHORT.map((d, i) => (
        <span key={i} className={s.calHead} aria-hidden>
          {d}
        </span>
      ))}
      {Array.from({ length: weekdayIndex(first) }, (_, i) => (
        <span key={`pad-${i}`} />
      ))}
      {values.map((total, i) => {
        const day = addDays(first, i);
        const over = goal != null && total > goal;
        const future = day > today;
        return (
          <button
            key={i}
            type="button"
            className={cx(s.calCell, over && s.calOver, isSameDay(day, today) && s.calToday)}
            disabled={future}
            aria-label={`${day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} : ${total > 0 ? `${Math.round(total)} g de glucides` : 'aucune entrée'}${over ? ', au-dessus de ton objectif' : ''}`}
            onClick={() => onPickDay(day)}
          >
            {total > 0 && <span className={s.calFill} style={{ opacity: 0.15 + 0.75 * Math.min(1, total / max) }} />}
            <span className={s.calNum}>{i + 1}</span>
          </button>
        );
      })}
    </div>
  );
}
