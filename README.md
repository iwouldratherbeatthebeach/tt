# Architect Assessment Site

## What changed
- much cleaner UI
- weighted scoring
- domain scoring
- local result history
- optional API logging to `/api/attempts`
- Cloudflare Pages Functions starter included

## Run locally
Use a local server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`

## Cloudflare Pages
Upload the whole folder to Pages or connect it to Git.
If you want result logging:
- keep the `functions/api/attempts.js` file
- create a D1 database
- bind it as `DB`
- run the SQL in `schema.sql`

The frontend already tries to POST final results to `/api/attempts`.
