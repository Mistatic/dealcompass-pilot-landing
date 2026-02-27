# DealCompass Local Dev Workflow

Use this to make copy/layout edits locally first, then batch deploy to staging once approved.

## Start local preview

### Option A — fastest static preview (recommended for copy/layout)
```bash
cd /Users/clayspicer/.openclaw/workspace/dealcompass-pilot-landing
./scripts/local-dev.sh static 4173
```
Open: http://127.0.0.1:4173

### Option B — Vercel dev (use when testing API routes under `/api`)
```bash
cd /Users/clayspicer/.openclaw/workspace/dealcompass-pilot-landing
./scripts/local-dev.sh vercel 4173
```

## Stop local preview
```bash
cd /Users/clayspicer/.openclaw/workspace/dealcompass-pilot-landing
./scripts/local-dev-stop.sh 4173
```

## Recommended low-noise release flow
1. Make all copy/UI tweaks locally.
2. Review in browser until approved.
3. Commit once on `staging`.
4. Push to `master` only after explicit approval.

This keeps Vercel deployments cleaner and reduces preview-rate churn.
