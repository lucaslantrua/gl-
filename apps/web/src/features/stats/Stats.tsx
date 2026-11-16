import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Group } from '@visx/group';
import { Pie } from '@visx/shape';
import { db, entriesBetween } from '@/db/db';
import { MEAL_SLOTS, type MealSlot } from '@/db/types';
import { allItems, averageDaily, busiestWeekday, periodGi, seriesByDay, slotTotals, sugarSplit, sugaryDrinkStats, sweetestHour, topFoods, totalOf, trendPct } from '@/lib/aggregate';
import { SLOT_COLOR } from '@/lib/colors';
import { addDays, formatDecimalHour, SLOT_LABEL, startOfDay, WEEKDAYS_LONG } from '@/lib/dates';
import { fmt, giCategoryOf } from '@/lib/nutrition';
import { Card, Chip, cx, GiChip, Segmented } from '@/ui';
import { layout as l, Page } from '@/ui/Page';
import s from './stats.module.css';

type Period = '7' | '30' | '90' | 'all';

function Donut({ data }: { data: { key: MealSlot; value: number }[] }) {
  const size = 130;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Répartition des glucides par créneau repas">
      <Group top={size / 2} left={size / 2}>
        <Pie data={data} pieValue={(d) => d.value} outerRadius={size / 2} innerRadius={size / 2 - 24} padAngle={0.04} cornerRadius={5} pieSort={null}>
          {(pie) => pie.arcs.map((arc) => <path key={arc.data.key} d={pie.path(arc) ?? undefined} fill={SLOT_COLOR[arc.data.key]} />)}
        </Pie>
      </Group>
    </svg>
  );
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 100 / values.length;
  return (
    <svg className={s.spark} viewBox="0 0 100 56" preserveAspectRatio="none" aria-hidden>
      {values.map((v, i) => {
        const h = Math.max(v > 0 ? 2 : 0, (v / max) * 54);
        return <rect key={i} x={i * w + w * 0.15} y={56 - h} width={w * 0.7} height={h} rx={Math.min(1.5, w * 0.3)} fill="var(--honey)" />;
      })}
    </svg>
  );
}

export default function Stats() {
  const [period, setPeriod] = useState<Period>('30');
  const today = useMemo(() => startOfDay(new Date()), []);
  const data = useLiveQuery(async () => {
    const end = addDays(today, 1);
    if (period === 'all') return { current: await db.entries.orderBy('eatenAt').toArray(), previous: [] };
    const days = Number(period);
    const from = addDays(end, -days);
    const [current, previous] = await Promise.all([entriesBetween(from, end), entriesBetween(addDays(from, -days), from)]);
    return { current, previous };
  }, [period, today]);

  const stats = useMemo(() => {
    if (!data) return null;
    const { current, previous } = data;
    const avg = averageDaily(current);
    const prev = averageDaily(previous);
    const slots = slotTotals(current);
    const total = totalOf(current);
    const items = allItems(current);
    const giCarbs = items.filter((i) => i.glycemicIndex != null).reduce((a, i) => a + i.carbsG, 0);
    const first = current[0] ? startOfDay(new Date(current[0].eatenAt)) : today;
    const days = period === 'all' ? Math.min(120, Math.round((today.getTime() - first.getTime()) / 86_400_000) + 1) : Number(period);
    return {
      avg,
      trend: previous.length ? trendPct(avg.average, prev.average) : null,
      slots,
      total,
      split: sugarSplit(current),
      gi: periodGi(current),
      giCoverage: total > 0 ? Math.round((giCarbs / total) * 100) : 0,
      top: topFoods(current, 5),
      weekday: busiestWeekday(current),
      hour: sweetestHour(current),
      drinks: sugaryDrinkStats(current),
      series: seriesByDay(current, addDays(today, -(days - 1)), days).map((d) => d.total),
      count: current.length,
    };
  }, [data, period, today]);

  return (
    <Page title="Stats">
      <Segmented<Period>
        label="Période"
        value={period}
        onChange={setPeriod}
        options={[
          { value: '7', label: '7 j' },
          { value: '30', label: '30 j' },
          { value: '90', label: '90 j' },
          { value: 'all', label: 'Tout' },
        ]}
      />

      {stats && stats.count === 0 && (
        <div className={l.empty}>
          <p>Pas encore de données sur cette période. Scanne quelques repas et reviens voir.</p>
        </div>
      )}

      {stats && stats.count > 0 && (
        <>
          <Card>
            <div className={l.stack}>
              <span className={l.eyebrow}>Moyenne par jour</span>
              <div className={cx(l.row, l.between, l.wrap)}>
                <span className={cx('num', s.big)}>
                  {fmt(Math.round(stats.avg.average))}
                  <span className={s.unit}>g</span>
                </span>
                {stats.trend != null && (
                  <Chip tone={stats.trend < 0 ? 'sage' : stats.trend > 0 ? 'honey' : 'neutral'}>
                    {stats.trend > 0 ? '+' : ''}
                    {stats.trend} % vs période précédente
                  </Chip>
                )}
              </div>
              <Spark values={stats.series} />
              <span className={cx(l.small, l.soft)}>
                Calculée sur {stats.avg.trackedDays} jour{stats.avg.trackedDays > 1 ? 's' : ''} avec au moins une entrée. Valeurs issues d'estimations et de données fabricant.
              </span>
            </div>
          </Card>

          <Card>
            <div className={l.stack}>
              <h2 className={l.h2}>Par créneau repas</h2>
              <div className={s.donutRow}>
                <Donut data={MEAL_SLOTS.filter((k) => stats.slots[k] > 0).map((k) => ({ key: k, value: stats.slots[k] }))} />
                <ul className={s.legend}>
                  {MEAL_SLOTS.filter((k) => stats.slots[k] > 0).map((k) => (
                    <li key={k}>
                      <span className={s.swatch} style={{ background: SLOT_COLOR[k] }} />
                      {SLOT_LABEL[k]}
                      <span className={s.val}>{Math.round((stats.slots[k] / stats.total) * 100)} %</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card>
            <div className={l.stack}>
              <h2 className={l.h2}>Sucres et glucides complexes</h2>
              <div className={s.splitBar} role="img" aria-label={`Sucres ${fmt(stats.split.sugars)} g, glucides complexes ${fmt(stats.split.complex)} g, non renseigné ${fmt(stats.split.unknown)} g`}>
                {stats.split.sugars > 0 && <span style={{ flex: stats.split.sugars, background: 'var(--honey)' }} />}
                {stats.split.complex > 0 && <span style={{ flex: stats.split.complex, background: 'var(--sage)' }} />}
                {stats.split.unknown > 0 && <span style={{ flex: stats.split.unknown, background: 'var(--line)' }} />}
              </div>
              <ul className={s.legend}>
                <li>
                  <span className={s.swatch} style={{ background: 'var(--honey)' }} />
                  Sucres
                  <span className={s.val}>{Math.round((stats.split.sugars / stats.total) * 100)} %</span>
                </li>
                <li>
                  <span className={s.swatch} style={{ background: 'var(--sage)' }} />
                  Glucides complexes
                  <span className={s.val}>{Math.round((stats.split.complex / stats.total) * 100)} %</span>
                </li>
                {stats.split.unknown > 0 && (
                  <li>
                    <span className={s.swatch} style={{ background: 'var(--line)' }} />
                    Sucres non renseignés
                    <span className={s.val}>{Math.round((stats.split.unknown / stats.total) * 100)} %</span>
                  </li>
                )}
              </ul>
            </div>
          </Card>

          <div className={s.grid}>
            <Card tight>
              <div className={l.stack}>
                <span className={l.eyebrow}>IG moyen pondéré</span>
                {stats.gi != null ? (
                  <>
                    <span className={cx('num', s.mid)}>{stats.gi}</span>
                    <div>
                      <GiChip category={giCategoryOf(stats.gi)} />
                    </div>
                    <span className={cx(l.small, l.soft)}>IG connu pour {stats.giCoverage} % de tes glucides. Repère estimé.</span>
                  </>
                ) : (
                  <span className={cx(l.small, l.soft)}>IG non renseigné sur cette période.</span>
                )}
              </div>
            </Card>
            <Card tight>
              <div className={l.stack}>
                <span className={l.eyebrow}>Boissons sucrées</span>
                <span className={cx('num', s.mid)}>{stats.drinks.count}</span>
                <span className={cx(l.small, l.soft)}>
                  {stats.drinks.count > 0 ? `soit ${stats.drinks.cubes} morceaux de sucre (${fmt(stats.drinks.sugarsG)} g de sucres)` : 'aucune sur la période'}
                </span>
              </div>
            </Card>
            <Card tight>
              <div className={l.stack}>
                <span className={l.eyebrow}>Jour le plus chargé</span>
                {stats.weekday ? (
                  <>
                    <span className={cx('num', s.mid)} style={{ textTransform: 'capitalize' }}>
                      {WEEKDAYS_LONG[stats.weekday.index]}
                    </span>
                    <span className={cx(l.small, l.soft)}>{fmt(Math.round(stats.weekday.average))} g en moyenne</span>
                  </>
                ) : null}
              </div>
            </Card>
            <Card tight>
              <div className={l.stack}>
                <span className={l.eyebrow}>Prises les plus sucrées</span>
                {stats.hour != null ? (
                  <>
                    <span className={cx('num', s.mid)}>{formatDecimalHour(stats.hour)}</span>
                    <span className={cx(l.small, l.soft)}>heure moyenne du quart le plus sucré de tes prises</span>
                  </>
                ) : (
                  <span className={cx(l.small, l.soft)}>Sucres non renseignés sur cette période.</span>
                )}
              </div>
            </Card>
          </div>

          <Card>
            <div className={l.stack}>
              <h2 className={l.h2}>Top 5 des aliments</h2>
              <ol className={s.top}>
                {stats.top.map((f) => (
                  <li key={f.name} className={s.topRow}>
                    <div className={s.topHead}>
                      <span className={l.truncate}>{f.name}</span>
                      <span className="num">
                        {fmt(Math.round(f.carbsG))} g · {f.count}×
                      </span>
                    </div>
                    <div className={s.track}>
                      <div className={s.trackFill} style={{ width: `${(f.carbsG / (stats.top[0]?.carbsG || 1)) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        </>
      )}
    </Page>
  );
}
