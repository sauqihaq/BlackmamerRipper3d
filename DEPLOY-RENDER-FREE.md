# DemonZ Ripper — Netlify + Render Free

## Architecture
- Netlify: `apps/ripper-ui` frontend
- Render Free: Docker Web Service backend + Chromium/Puppeteer

## Render
1. Push this repository to GitHub with `package.json`, `render.yaml`, `Dockerfile`, `api/`, `apps/`, `packages/`, and `services/` at the repository root.
2. Render → New → Blueprint → select the GitHub repository.
3. `render.yaml` creates `demonz-ripper-api` using the Free plan.
4. Set `CORS_ORIGIN` to your Netlify URL after Netlify is deployed.
5. Health check: `/api/health`.

This Free configuration uses ephemeral `/tmp` storage so no paid blob storage is required. Jobs/files disappear if the service restarts or sleeps. A rip must finish while the service is alive.

## Netlify
Build command: `npm run build --workspace=apps/ripper-ui`
Publish directory: `apps/ripper-ui/dist`
Environment variable: `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com`
