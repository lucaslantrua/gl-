import { useState } from 'react';
import { Button, Card, Chip, GiChip, Logo, Segmented, Sheet, Slider, SourceBadge } from '@/ui';
import { layout as l, Page } from '@/ui/Page';
import { DonutGauge } from '../today/DonutGauge';
import s from './settings.module.css';

const SWATCHES = ['cream', 'paper', 'ink', 'ink-soft', 'terracotta', 'honey', 'sage', 'plum'];

/** Planche de la direction artistique : tokens et composants de base. */
export default function Styleguide() {
  const [q, setQ] = useState(120);
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');
  const [open, setOpen] = useState(false);
  const [ratio, setRatio] = useState(0.36);
  return (
    <Page bare title={<Logo size={56} />}>
      <Card>
        <div className={l.stack}>
          <h2 className={l.h2}>Palette</h2>
          <div className={s.swatches}>
            {SWATCHES.map((n) => (
              <div key={n} className={s.swatch} style={{ background: `var(--${n})`, color: n === 'cream' || n === 'paper' || n === 'honey' ? '#2b2420' : '#fffaf2' }}>
                {n}
              </div>
            ))}
          </div>
        </div>
      </Card>
      <Card>
        <div className={l.stack}>
          <span className={l.eyebrow}>Bricolage Grotesque 800</span>
          <span className="num" style={{ fontSize: '4.5rem', lineHeight: 1 }}>47 g</span>
          <h2 className={l.h2}>Grosse journée côté sucre</h2>
          <p className={l.soft}>Manrope pour le texte courant : phrases courtes, tutoiement, jamais de morale.</p>
        </div>
      </Card>
      <Card>
        <div className={l.stack}>
          <h2 className={l.h2}>Boutons</h2>
          <div className={`${l.row} ${l.wrap}`}>
            <Button>Enregistrer</Button>
            <Button variant="soft">Ajouter</Button>
            <Button variant="ghost">Annuler</Button>
            <Button variant="danger" size="sm">Effacer</Button>
          </div>
          <h2 className={l.h2}>Chips et badges</h2>
          <div className={`${l.row} ${l.wrap}`}>
            <GiChip category="low" gi={32} />
            <GiChip category="medium" gi={58} estimated />
            <GiChip category="high" gi={75} />
            <SourceBadge confidence="estimate" />
            <SourceBadge confidence="manufacturer" />
            <Chip tone="terracotta">= 9 morceaux de sucre</Chip>
          </div>
          <Segmented label="Démo" value={tab} onChange={setTab} options={[{ value: 'a', label: 'Jour' }, { value: 'b', label: 'Semaine' }, { value: 'c', label: 'Mois' }]} />
          <Slider label="Quantité" value={q} min={10} max={500} step={5} unit="g" onChange={setQ} />
          <Button variant="soft" onClick={() => setOpen(true)}>Ouvrir une Sheet</Button>
        </div>
      </Card>
      <Card>
        <div className={l.stack}>
          <h2 className={l.h2}>Jauge du jour</h2>
          <div style={{ width: 170, margin: '0 auto' }}>
            <DonutGauge ratio={ratio} label="Démo de jauge" />
          </div>
          <Slider label="Remplissage" value={Math.round(ratio * 100)} min={0} max={100} unit="%" onChange={(v) => setRatio(v / 100)} />
        </div>
      </Card>
      <Sheet open={open} onClose={() => setOpen(false)} title="Une sheet">
        <div className={l.stack}>
          <p>Rayons généreux, ombre chaude, ressort à l'ouverture.</p>
          <Button full onClick={() => setOpen(false)}>Fermer</Button>
        </div>
      </Sheet>
    </Page>
  );
}
