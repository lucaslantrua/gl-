import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { EyeOff } from 'lucide-react';
import { useSettings } from '@/app/stores';
import { entriesBetween } from '@/db/db';
import { DISCLAIMER } from '@/lib/copy';
import { addDays, startOfDay } from '@/lib/dates';
import { Button, Card, Chip, cx, ICON, IconButton } from '@/ui';
import { layout as l, Page } from '@/ui/Page';
import { selectInsights } from './engine';
import s from './insights.module.css';

export default function Insights() {
  const { settings, update } = useSettings();
  const now = useMemo(() => new Date(), []);
  const entries = useLiveQuery(() => entriesBetween(addDays(startOfDay(now), -30), addDays(startOfDay(now), 1)), [now]);
  const insights = useMemo(() => (entries ? selectInsights({ entries, settings, now }) : []), [entries, settings, now]);
  const hidden = settings.hiddenInsights ?? [];

  return (
    <Page title="Recos">
      <p className={l.soft}>Des idées tirées de tes 30 derniers jours. Des suggestions, pas des consignes.</p>

      {entries && insights.length === 0 && (
        <div className={l.empty}>
          <p>{entries.length < 6 ? 'Encore quelques repas à noter et Glu aura des idées pour toi.' : "Rien à signaler pour l'instant. Tout roule."}</p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {insights.map((i) => (
          <motion.div key={i.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.25 }}>
            <Card as="article" className={cx(s.card, i.tone === 'positive' && s.positive)}>
              <div className={s.head}>
                <h2 className={s.title}>{i.title}</h2>
                <IconButton label={`Masquer la reco « ${i.title} »`} onClick={() => void update({ hiddenInsights: [...hidden, i.id] })}>
                  <EyeOff {...ICON} />
                </IconButton>
              </div>
              <p>{i.body}</p>
              <Chip tone={i.tone === 'positive' ? 'sage' : 'honey'} className={s.evidence}>
                {i.evidence}
              </Chip>
              {i.alternative && <p className={s.alt}>{i.alternative}</p>}
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      {hidden.length > 0 && (
        <Button variant="ghost" size="sm" onClick={() => void update({ hiddenInsights: [] })}>
          Réafficher les {hidden.length > 1 ? `${hidden.length} recos masquées` : 'recos masquées'}
        </Button>
      )}

      <p className={cx(l.small, l.soft)}>{DISCLAIMER}</p>
    </Page>
  );
}
