import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChartPie, Lightbulb, ScanLine } from 'lucide-react';
import { Button, cx, ICON, Logo } from '@/ui';
import { useSettings } from '@/app/stores';
import { DISCLAIMER, DISCLAIMER_MORE } from '@/lib/copy';
import s from './onboarding.module.css';

const FEATURES = [
  { Icon: ScanLine, bg: 'var(--terracotta-wash)', fg: 'var(--accent-text)', text: 'Photo du plat, code-barres ou étiquette : tu scannes, Glu compte les glucides.' },
  { Icon: ChartPie, bg: 'var(--honey-wash)', fg: 'var(--honey-text)', text: 'Ton historique par jour, semaine et mois, toujours sous la main.' },
  { Icon: Lightbulb, bg: 'var(--sage-wash)', fg: 'var(--sage-text)', text: 'Des idées simples, basées sur tes habitudes. Jamais de morale.' },
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [goal, setGoal] = useState('');
  const update = useSettings((st) => st.update);
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const finish = async (withGoal: boolean) => {
    const n = Number(goal);
    await update({
      onboardingDone: true,
      disclaimerAcceptedAt: new Date().toISOString(),
      dailyCarbGoalG: withGoal && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined,
    });
    navigate('/', { replace: true });
  };

  const goalValid = Number(goal) >= 10 && Number(goal) <= 1000;

  return (
    <main className={s.wrap}>
      <div className={s.dots} role="img" aria-label={`Étape ${step + 1} sur 3`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={cx(s.dot, i === step && s.dotOn)} />
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className={s.step}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -32 }}
          transition={{ duration: 0.25 }}
        >
          {step === 0 && (
            <>
              <Logo size={72} />
              <h1 className={s.big}>Vois ce que tu manges en glucides.</h1>
              <ul className={s.features}>
                {FEATURES.map(({ Icon, bg, fg, text }) => (
                  <li key={text} className={s.feature}>
                    <span className={s.featureIcon} style={{ background: bg, color: fg }}>
                      <Icon {...ICON} aria-hidden />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </>
          )}
          {step === 1 && (
            <>
              <h1 className={s.big}>Avant de commencer</h1>
              <p className={s.lead}>{DISCLAIMER}</p>
              <p className={s.lead}>{DISCLAIMER_MORE}</p>
              <p className={s.lead}>Tes données restent sur ton appareil.</p>
              <label className={s.check}>
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                <span>J'ai compris : Glu m'informe, il ne remplace pas un professionnel de santé.</span>
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <h1 className={s.big}>Un objectif par jour ?</h1>
              <p className={s.lead}>C'est optionnel. À définir idéalement avec ton médecin ou diététicien.</p>
              <label className={s.goalInput}>
                <span className="sr-only">Objectif quotidien de glucides en grammes</span>
                <input inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="130" value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, ''))} />
                <span className={s.goalUnit}>g / jour</span>
              </label>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className={s.actions}>
        {step === 0 && (
          <Button full onClick={() => setStep(1)}>
            C'est parti
          </Button>
        )}
        {step === 1 && (
          <Button full disabled={!accepted} onClick={() => setStep(2)}>
            Continuer
          </Button>
        )}
        {step === 2 && (
          <>
            <Button full disabled={!goalValid} onClick={() => void finish(true)}>
              Valider mon objectif
            </Button>
            <Button full variant="ghost" onClick={() => void finish(false)}>
              Je n'ai pas d'objectif
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
