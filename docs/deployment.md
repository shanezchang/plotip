# Deploy to Vercel

The project uses the FastAPI framework preset. `pyproject.toml` points to `app:app`; `.python-version` selects Python 3.12 and `uv.lock` pins dependencies. The build runs `npm ci && npm run build` and writes the frontend into root `public/`, which Vercel serves through its CDN.

The XDB files and `places.json` are outside `public/` and are included only in the Python Function. Do not move them into frontend assets. `vercel.json` excludes caches, source frontend files, tests and Node modules from the function. No environment secrets are required.

For your own deployment, import your fork into Vercel, choose FastAPI, leave the root directory at repository root, and use the committed configuration. Confirm that your deployment's root HTML, map worker and `/api/lookup` work. Confirm `/data/ip2region_v4.xdb` returns 404.

Static map assets consume normal CDN traffic; lookup results are small JSON responses. Functions consume invocation/CPU/memory allowances. Personal non-commercial use can fit Hobby's included resources, but free hosting is not unlimited. Do not turn on paid upgrades automatically.

Use Vercel's platform protection and usage monitoring if traffic grows. Application memory is per-instance and cannot provide global rate limits. This app does not proxy arbitrary URLs, perform DNS resolution, or call paid providers.

## Maintainer workflow

Verify the linked project with `vercel project inspect --non-interactive`. Deploy with `vercel deploy --prod --skip-domain`, check via `vercel curl --deployment <url>`, then `vercel promote <url>` after successful checks. Never reuse another project's `.vercel/` directory.

A first deployment may receive the production alias automatically. Test it immediately; for subsequent updates keep the old production deployment in place until verification passes.
