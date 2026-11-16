import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useSettings } from '@/app/stores';
import { entriesBetween } from '@/db/db';
import { averageDaily, totalOf } from '@/lib/aggregate';
import { addDays, addMonths, formatDayLong, formatDayShort, formatMonth, startOfDay, startOfMonth, startOfWeek } from '@/lib/dates';
import { normalize } from '@/lib/gi-table';
import { fmt } from '@/lib/nutrition';
import { Card, cx, ICON, IconButton, Segmented } from '@/ui';
import { layout as l, Page } from '@/ui/Page';
import { EntryRow } from './EntryRow';
import { DayChart, GiLegend, MonthGrid, SlotLegend, WeekChart } from './views';
import s from './history.module.css';

type View = 'day' | 'week' | 'month';

function rangeOf(view: View, cursor: Date): { from: Date; to: Date; label: string } {
  if (view === 'day') {
    const from = startOfDay(cursor);
    return { from, to: addDays(from, 1), label: formatDayLong(from) };
  }
  if (view === 'week') {
    const from = startOfWeek(cursor);
    return { from, to: addDays(from, 7), label: `${formatDayShort(from)} – ${formatDayShort(addDays(from, 6))}` };
  }
  const from = startOfMonth(cursor);
  return { from, to: addMonths(from, 1), label: formatMonth(from) };
}

export default function History() {
  const goal = useSettings((st) => st.settings.dailyCarbGoalG);
  const [view, setView] = useState<View>('day');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [query, setQuery] = useState('');
  const touch = useRef<{ x: number; y: number } | null>(null);

  const { from, to, label } = useMemo(() => rangeOf(view, cursor), [view, cursor]);
  const entries = useLiveQuery(() => entriesBetween(from, to), [from.getTime(), to.getTime()]);
  const canNext = to <= new Date();

  const move = (dir: 1 | -1) => {
    if (dir === 1 && !canNext) return;
    setCursor((c) => (view === 'day' ? addDays(c, dir) : view === 'week' ? addDays(c, 7 * dir) : addMonths(c, dir)));
  };
  const pickDay = (d: Date) => {
    setCursor(startOfDay(d));
    setView('day');
  };

  const list = useMemo(() => {
    const q = normalize(query);
    const all = [...(entries ?? [])].reverse();
    return q ? all.filter((e) => e.items.some((i) => normalize(i.name).includes(q)) || (e.note && normalize(e.note).includes(q))) : all;
  }, [entries, query]);

  const total = entries ? totalOf(entries) : 0;
  const avg = entries ? averageDaily(entries) : { average: 0, trackedDays: 0 };

  return (
    <Page title="Historique">
      <Segmented<View>
        label="Période"
        value={view}
        onChange={setView}
        options={[
          { value: 'day', label: 'Jour' },
          { value: 'week', label: 'Semaine' },
          { value: 'month', label: 'Mois' },
        ]}
      />

      <div className={s.nav}>
        <IconButton label="Période précédente" onClick={() => move(-1)}>
          <ChevronLeft {...ICON} />
        </IconButton>
        <span className={s.navLabel} aria-live="polite">
          {label}
        </span>
        <IconButton label="Période suivante" onClick={() => move(1)} disabled={!canNext}>
          <ChevronRight {...ICON} />
        </IconButton>
      </div>

      <Card className={s.chartCard}>
        <div
          onTouchStart={(e) => (touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY })}
          onTouchEnd={(e) => {
            const start = touch.current;
            touch.current = null;
            if (!start) return;
            const dx = e.changedTouches[0]!.clientX - start.x;
            const dy = e.changedTouches[0]!.clientY - start.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
          }}
          className={l.stack}
        >
          <div className={s.summary}>
            <span className={cx('num', s.summaryNum)}>{fmt(Math.round(view === 'day' ? total : avg.average))} g</span>
            <span className={cx(l.small, l.soft)} style={{ textAlign: 'right' }}>
              {view === 'day' ? (goal ? `sur ${goal} g` : 'de glucides') : `en moyenne par jour · ${avg.trackedDays} jour${avg.trackedDays > 1 ? 's' : ''} suivi${avg.trackedDays > 1 ? 's' : ''}`}
            </span>
          </div>
          {entries && view === 'day' && (
            <>
              <DayChart entries={entries} />
              <GiLegend />
            </>
          )}
          {entries && view === 'week' && (
            <>
              <WeekChart entries={entries} weekStart={from} goal={goal} onPickDay={pickDay} />
              <SlotLegend />
            </>
          )}
          {entries && view === 'month' && (
            <>
              <MonthGrid entries={entries} month={from} goal={goal} onPickDay={pickDay} />
              <p className={cx(l.small, l.soft)}>Plus la case est foncée, plus la journée est chargée.{goal ? ' Entourée : au-dessus de ton objectif.' : ''}</p>
            </>
          )}
        </div>
      </Card>

      <div className={s.searchWrap}>
        <Search size={20} strokeWidth={1.75} className={s.searchIcon} aria-hidden />
        <input className={s.search} type="search" placeholder="Chercher un aliment" aria-label="Chercher un aliment dans cette période" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {entries && list.length === 0 ? (
        <div className={l.empty}>
          <p>{query ? 'Rien ne correspond à ta recherche sur cette période.' : 'Rien de noté sur cette période.'}</p>
        </div>
      ) : (
        <ul className={l.list}>
          {list.map((e) => (
            <EntryRow key={e.id} entry={e} showDate={view !== 'day'} />
          ))}
        </ul>
      )}
    </Page>
  );
}
