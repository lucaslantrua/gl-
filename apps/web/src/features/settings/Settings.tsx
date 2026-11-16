import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useSettings } from '@/app/stores';
import { db, wipeAll } from '@/db/db';
import { clearDemo, seedDemo } from '@/db/seed';
import { MEAL_SLOTS, type MealSlot, type Theme } from '@/db/types';
import { buildBackup, download, entriesToCsv, importBackup } from '@/lib/backup';
import { DISCLAIMER, DISCLAIMER_MORE } from '@/lib/copy';
import { dayKey, SLOT_LABEL } from '@/lib/dates';
import { Button, Card, cx, Field, ICON, IconButton, Segmented, Sheet } from '@/ui';
import { layout as l, Page } from '@/ui/Page';
import s from './settings.module.css';

const DEFAULT_SPLIT: Record<MealSlot, number> = { breakfast: 25, lunch: 35, snack: 10, dinner: 30, other: 0 };

export default function SettingsScreen() {
  const { settings, update, load } = useSettings();
  const navigate = useNavigate();
  const [goal, setGoal] = useState(settings.dailyCarbGoalG ? String(settings.dailyCarbGoalG) : '');
  const [split, setSplit] = useState<Record<MealSlot, number>>(settings.mealSplit ?? DEFAULT_SPLIT);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [wipeStep, setWipeStep] = useState<0 | 1 | 2>(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const splitSum = MEAL_SLOTS.reduce((a, k) => a + (split[k] || 0), 0);

  const saveGoal = (raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, 4);
    setGoal(clean);
    const n = Number(clean);
    void update({ dailyCarbGoalG: n >= 10 && n <= 1000 ? n : undefined });
  };

  const saveSplit = (k: MealSlot, raw: string) => {
    const next = { ...split, [k]: Math.min(100, Number(raw.replace(/\D/g, '')) || 0) };
    setSplit(next);
    const total = MEAL_SLOTS.reduce((a, x) => a + next[x], 0);
    if (total === 100) void update({ mealSplit: next });
  };

  const run = async (fn: () => Promise<string>) => {
    try {
      setStatus({ text: await fn() });
    } catch (e) {
      setStatus({ text: e instanceof Error ? e.message : 'Quelque chose a coincé.', error: true });
    }
  };

  const stamp = dayKey(new Date());

  return (
    <Page
      title="Réglages"
      lead={
        <IconButton label="Retour" onClick={() => navigate(-1)}>
          <ChevronLeft {...ICON} />
        </IconButton>
      }
    >
      <Card>
        <div className={l.stack}>
          <h2 className={l.h2}>Objectif quotidien</h2>
          <Field label="Glucides par jour (g)" inputMode="numeric" placeholder="Pas d'objectif" value={goal} onChange={(e) => saveGoal(e.target.value)} hint="À définir idéalement avec ton médecin ou diététicien. Laisse vide si tu n'en as pas." />
        </div>
      </Card>

      <Card>
        <div className={l.stack}>
          <h2 className={l.h2}>Répartition par repas</h2>
          <p className={cx(l.small, l.soft)}>En % de ton objectif. Optionnel : ça sert à suggérer une répartition sur la journée.</p>
          <div className={s.split}>
            {MEAL_SLOTS.map((k) => (
              <label key={k} className={s.splitCell}>
                {SLOT_LABEL[k]}
                <input inputMode="numeric" value={split[k]} onChange={(e) => saveSplit(k, e.target.value)} aria-label={`${SLOT_LABEL[k]} en pourcentage`} />
              </label>
            ))}
          </div>
          <p className={cx(s.status, splitSum !== 100 && s.error)} role="status">
            {splitSum === 100 ? 'Total : 100 %, enregistré.' : `Total : ${splitSum} %. Il faut arriver à 100 % pour enregistrer.`}
          </p>
        </div>
      </Card>

      <Card>
        <div className={l.stack}>
          <h2 className={l.h2}>Thème</h2>
          <Segmented<Theme>
            label="Thème"
            value={settings.theme}
            onChange={(theme) => void update({ theme })}
            options={[
              { value: 'light', label: 'Clair' },
              { value: 'dark', label: 'Sombre' },
              { value: 'system', label: 'Système' },
            ]}
          />
        </div>
      </Card>

      <Card>
        <div className={l.stack}>
          <h2 className={l.h2}>Tes données</h2>
          <p className={cx(l.small, l.soft)}>Tout est stocké sur cet appareil. Rien n'est envoyé ni gardé sur un serveur.</p>
          <div className={cx(l.row, l.wrap)}>
            <Button size="sm" variant="soft" onClick={() => void run(async () => (download(`glu-${stamp}.json`, JSON.stringify(await buildBackup(), null, 2), 'application/json'), 'Sauvegarde JSON téléchargée.'))}>
              Exporter en JSON
            </Button>
            <Button size="sm" variant="soft" onClick={() => void run(async () => (download(`glu-${stamp}.csv`, entriesToCsv(await db.entries.toArray()), 'text/csv;charset=utf-8'), 'Fichier CSV téléchargé.'))}>
              Exporter en CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
              Importer un JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              data-testid="import-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void run(async () => { const n = await importBackup(await file.text()); await load(); return `${n} entrées importées.`; });
              }}
            />
          </div>
          <div className={cx(l.row, l.wrap)}>
            <Button size="sm" variant="ghost" onClick={() => void run(async () => `${await seedDemo()} entrées de démo ajoutées (30 jours).`)}>
              Charger des données de démo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void run(async () => (await clearDemo(), 'Données de démo retirées.'))}>
              Retirer la démo
            </Button>
          </div>
          {status && (
            <p className={cx(s.status, status.error && s.error)} role="status">
              {status.text}
            </p>
          )}
          <Button variant="danger" onClick={() => setWipeStep(1)}>
            Effacer toutes les données
          </Button>
        </div>
      </Card>

      <Card flat>
        <div className={l.stack}>
          <h2 className={l.h2}>À savoir</h2>
          <p>{DISCLAIMER}</p>
          <p className={cx(l.small, l.soft)}>{DISCLAIMER_MORE}</p>
        </div>
      </Card>

      <Card flat>
        <div className={l.stack}>
          <h2 className={l.h2}>À propos</h2>
          <p className={l.small}>Glu 0.1 : comme glucides, et comme le glou-glou de ta canette.</p>
          <p className={cx(l.small, l.soft)}>
            Les données produits viennent d'<a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a>, mises à disposition sous licence{' '}
            <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">Open Database License (ODbL)</a>. © les contributeurs d'Open Food Facts.
          </p>
          <p className={cx(l.small, l.soft)}>Les index glycémiques viennent des tables internationales (Atkinson, Foster-Powell, Brand-Miller). Ce sont des repères moyens.</p>
        </div>
      </Card>

      <Sheet open={wipeStep > 0} onClose={() => setWipeStep(0)} title={wipeStep === 1 ? 'Tout effacer ?' : 'Vraiment sûr ?'}>
        <div className={l.stack}>
          <p>{wipeStep === 1 ? 'Ton historique, tes réglages et ton objectif seront supprimés de cet appareil.' : "C'est définitif : sans export, impossible de revenir en arrière."}</p>
          {wipeStep === 1 ? (
            <Button variant="danger" full onClick={() => setWipeStep(2)}>
              Oui, continuer
            </Button>
          ) : (
            <Button
              variant="danger"
              full
              onClick={() =>
                void (async () => {
                  await wipeAll();
                  setWipeStep(0);
                  await load();
                  navigate('/onboarding', { replace: true });
                })()
              }
            >
              Effacer définitivement
            </Button>
          )}
          <Button variant="ghost" full onClick={() => setWipeStep(0)}>
            Annuler
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}
