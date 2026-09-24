# DemonZ Ripper — GitHub → Netlify + Vercel

Use ONE GitHub repository for both deployments. Do not split the repository.

## 1. Push this entire folder to GitHub

Keep this structure:

```text
DemonZ-Ripper-main/
├── api/                 # Vercel backend
├── apps/ripper-ui/      # Netlify frontend
├── packages/            # shared packages
├── services/            # rip engine
├── vercel.json
├── netlify.toml
└── package.json
```

## 2. Vercel

Import the same GitHub repository into Vercel.

- Root Directory: `./`
- Framework Preset: Other
- Build settings can be left at their detected values.
- `vercel.json` tells Vercel that `api/**/*.ts` are serverless functions.

Create these Vercel environment variables:

```text
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
CORS_ORIGIN=https://YOUR-SITE.netlify.app
```

After deployment, copy the Vercel URL, for example:

```text
https://demonz-ripper-api.vercel.app
```

Test:

```text
https://demonz-ripper-api.vercel.app/api/health
```

## 3. Netlify

Import the SAME GitHub repository into Netlify.

- Base directory: `/`
- Build command: `npm run build --workspace=apps/ripper-ui`
- Publish directory: `apps/ripper-ui/dist`
- Node: 20

`netlify.toml` already contains these settings, so Netlify can detect them from the repository.

Add ONE environment variable in Netlify:

```text
VITE_API_URL=https://YOUR-VERCEL-PROJECT.vercel.app
```

Important: Vite environment variables are baked into the frontend during the Netlify build, so this value must be set before redeploying the frontend.

## 4. Local development

For local development, keep `VITE_API_URL` empty. Vite proxies `/api` to `http://localhost:4010`.

## Important Vercel limitation

The rip engine uses Puppeteer + Chromium and can be CPU/memory/time intensive. The API is configured for the highest serverless resources available to the project, but the actual limits depend on the Vercel plan.
