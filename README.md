# Glu

Glu : comme glucides, et comme le glou-glou de ta canette. Une PWA mobile-first pour suivre ses apports en glucides, sans morale.

Trois façons d'ajouter un aliment : photo du plat (modèle vision), scan du code-barres (Open Food Facts), photo de l'étiquette. Tout est historisé sur l'appareil, avec des statistiques et des recommandations locales.

## Garde-fous

- Glu est un outil d'information et de suivi. Ce n'est pas un dispositif médical.
- L'app ne calcule aucune consigne de traitement. Un test (`apps/web/src/guardrails.test.ts`) échoue si le vocabulaire interdit apparaît dans l'UI hors disclaimer.
- Toute valeur affichée indique sa source : badge « estimation » (avec fourchette min / max) ou « donnée fabricant ».
- Une donnée inconnue reste vide (IG, sucres, fibres) : rien n'est inventé.
- Les données de santé restent dans IndexedDB, sur l'appareil. Le backend est un proxy sans base de données : il ne persiste rien et ne journalise ni les requêtes ni les images.

## Structure

```
apps/
  web/   front Vite + React 18 + TypeScript strict (PWA)
    src/app        routes, stores Zustand
    src/features   scan, entry, today, history, stats, insights, settings, onboarding
    src/db         schéma Dexie, données de démo
    src/lib        client API, calculs nutrition, agrégations, table IG, dates
    src/ui         composants du design system
    src/styles     tokens.css, global.css
    e2e            tests Playwright
  api/   backend FastAPI (proxy vision + Open Food Facts), pour le local et l'auto-hébergement
    app/routes     vision.py, products.py, health.py
    app/services   vision_client.py, off_client.py, cache.py
    app/prompts    plate.md, label.md (source de référence des prompts)
    tests          pytest + fixtures
supabase/
  functions/api/   le même backend en Edge Function Supabase (Deno), pour la production
docker-compose.yml
```

## Démarrer

### En développement

```bash
cd apps/api
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env   # renseigner VISION_API_KEY
.venv/bin/uvicorn app.main:app --reload --port 8000 --no-access-log
```

```bash
cd apps/web
npm install
npm run dev            # http://localhost:5173, /api est proxifié vers :8000
```

Sans clé vision, le scan code-barres et la saisie manuelle fonctionnent ; seules les photos de plat et d'étiquette en ont besoin.
Pour voir l'app remplie : Réglages → « Charger des données de démo » (30 jours générés). La planche de la direction artistique est sur `/styleguide`.

### Avec Docker

```bash
cp apps/api/.env.example apps/api/.env   # renseigner VISION_API_KEY
docker compose up --build                # http://localhost:8080
```

Redis est optionnel : `docker compose --profile redis up` avec `REDIS_URL=redis://redis:6379/0`. Sans Redis, le cache est en mémoire (LRU, 7 jours pour Open Food Facts).

### Backend sur Supabase

La fonction `supabase/functions/api` expose les mêmes routes et le même contrat que le FastAPI. Elle n'utilise ni table ni stockage : c'est un proxy sans état.

```bash
npx supabase login
```

```bash
cp supabase/.env.example supabase/.env   # renseigner VISION_API_KEY et ALLOWED_ORIGINS
npx supabase secrets set --env-file supabase/.env --project-ref aphyftissweqozxxxmra
```

```bash
npx supabase functions deploy api --project-ref aphyftissweqozxxxmra
```

Côté front, copier `apps/web/.env.example` en `apps/web/.env` et y mettre la clé publique « anon » du projet.

Le modèle vision est appelé par une API compatible OpenAI, réglable par trois secrets (`VISION_API_BASE_URL`, `VISION_API_KEY`, `VISION_MODEL`). Par défaut : `gemma-4-26b-a4b-it` chez Scaleway Generative APIs (`https://api.scaleway.ai/v1`), hébergé en Europe.

Limites à connaître : le cache Open Food Facts et la limite par IP vivent en mémoire, le temps d'une instance de la fonction. Le front garde de toute façon sa propre copie des produits scannés.

Si les prompts changent dans `apps/api/app/prompts/`, régénérer leur copie avec `deno task sync-prompts` (un test échoue tant que ce n'est pas fait).

### Variables d'environnement (backend FastAPI)

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `VISION_API_BASE_URL` | API compatible OpenAI (Scaleway, Gemini, OpenAI, vLLM…) | `https://api.scaleway.ai/v1` |
| `VISION_API_KEY` | Clé du modèle vision | |
| `VISION_MODEL` | Nom du modèle | `gemma-4-26b-a4b-it` |
| `VISION_REASONING_EFFORT` | Optionnel. `none` saute la phase de réflexion du modèle (plus rapide) | |
| `VISION_JSON_MODE` | Envoie `response_format=json_object` ; à couper si le serveur le refuse | `true` |
| `OFF_USER_AGENT` | User-Agent exigé par Open Food Facts | `Glu/0.1 (contact@example.com)` |
| `REDIS_URL` | Cache Redis, optionnel | |
| `ALLOWED_ORIGINS` | Origines CORS | `http://localhost:5173` |
| `RATE_LIMIT` | Limite par IP | `30/minute` |

Côté front, `VITE_API_BASE` permet de pointer vers un backend sur un autre domaine.

## Tests

```bash
cd apps/web && npm test            # Vitest : calculs, agrégations, règles de reco, contrastes AA, garde-fous
cd apps/web && npm run e2e         # Playwright sur le build PWA : scan, ajout manuel, hors ligne, accessibilité (axe)
cd apps/api && .venv/bin/pytest    # pytest : Open Food Facts et modèle vision mockés
cd supabase/functions/api && deno task test   # Edge Function : routes, validation, requêtes envoyées aux modèles
```

Les photos de `apps/api/tests/fixtures/` sont des images de synthèse en attendant de vraies photos (voir le README du dossier).

## Choix à connaître

- **Index glycémique** : `apps/web/src/lib/gi-table.ts` (environ 180 aliments, sources en tête de fichier). Produits scannés : correspondance par catégorie Open Food Facts, sinon IG laissé vide. Plats : IG renvoyé par le modèle, affiché comme estimation.
- **Boisson sucrée** : item en ml avec au moins 2,5 g de sucres pour 100 ml.
- **Moyennes** : calculées sur les jours ayant au moins une entrée, pour ne pas compter les jours non suivis comme des jours à 0 g.
- **Recos** : une règle par fichier dans `features/insights/rules/`, 3 affichées au plus, masquables.
- **Couleurs** : la palette de la spec sert aux aplats ; des dérivés plus contrastés (`--cta`, `--accent-text`, `--honey-text`…) portent le texte pour tenir le niveau AA dans les deux thèmes.

## Crédits

Données produits : [Open Food Facts](https://world.openfoodfacts.org), sous licence [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/). © les contributeurs d'Open Food Facts.
Polices : Bricolage Grotesque et Manrope (SIL Open Font License), auto-hébergées.
