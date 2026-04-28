# Architect Readiness Assessment

A web-based technical assessment platform designed to evaluate readiness for **Splunk Architect / TSE → TAM transition roles**.

This system delivers a **100-question weighted domain assessment**, calculates strengths and gaps, and generates structured readiness reports per candidate.

## Features

- Domain-weighted scoring
- Weak-area detection
- Persistent attempt storage with Cloudflare D1
- Optional PDF report export with Cloudflare Browser Rendering and R2
- Serverless deployment via Cloudflare Pages Functions

## Assessment Coverage

The test evaluates candidates across infrastructure and Splunk architecture domains:

| Domain | Questions |
|--------|-----------|
| Linux fundamentals | 10 |
| Windows administration | 10 |
| Networking | 10 |
| Identity / PKI / LDAP / SAML | 10 |
| Splunk data ingest | 15 |
| Splunk search architecture | 15 |
| Splunk auth and security | 10 |
| Splunk clustering and scaling | 10 |
| Splunk troubleshooting | 5 |
| Splunk architecture judgment | 5 |

Each question includes:

- domain
- subcategory
- difficulty
- weight

Weighted scoring produces readiness classification.

## Readiness Bands

| Score | Classification |
|------|----------------|
| 85–100% | Architect Ready |
| 70–84% | Near Ready |
| 50–69% | Developing |
| Below 50% | Needs Foundation Work |

## Architecture Overview

### Frontend

```text
index.html
app.js
styles.css
questions.json
```

### Backend

```text
functions/api/attempts.js
```

### Persistence

```text
Cloudflare D1 database
```

### Optional report storage

```text
Cloudflare R2 bucket
```

### Optional PDF rendering

```text
Cloudflare Browser Rendering
```

## Project Structure

```text
.
├── index.html
├── app.js
├── styles.css
├── questions.json
├── README.md
├── wrangler.jsonc
└── functions/
    └── api/
        └── attempts.js
```

## Deployment on Cloudflare Pages

### Step 1: Push repository to GitHub

```bash
git init
git add .
git commit -m "initial assessment app"
git push origin main
```

### Step 2: Create a Pages project

In the Cloudflare dashboard:

**Workers & Pages → Create Application → Pages → Connect to Git**

Use these build settings:

```text
Build command: leave blank
Output directory: /
Framework preset: None
```

Deploy the site.

## Configure Database (D1)

Create a database in:

**Workers & Pages → D1 → Create database**

Example name:

```text
architect_assessment
```

Then add the binding in your Pages project:

**Pages → Settings → Bindings → Add binding**

```text
Type: D1
Variable: DB
Database: architect_assessment
```

## Create the Attempts Table

Run this in the D1 SQL console:

```sql
CREATE TABLE attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_name TEXT,
  candidate_email TEXT,
  readiness_band TEXT,
  overall_percent REAL,
  raw_correct INTEGER,
  total_questions INTEGER,
  answered_count INTEGER,
  domain_scores_json TEXT,
  weak_areas_json TEXT,
  completed_at TEXT,
  pdf_key TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Optional: Enable PDF Report Storage (R2)

Create a bucket in:

**Workers & Pages → R2 → Create bucket**

Use a bucket without jurisdiction restriction.

Example bucket name:

```text
reports
```

Then add the binding in Pages:

```text
Type: R2 bucket
Variable: REPORTS
Bucket: reports
```

## Optional: Enable PDF Rendering

Enable Browser Rendering in:

**Workers & Pages → Settings → Functions → Browser Rendering**

Use this binding name:

```text
BROWSER
```

## API Endpoints

Store attempts:

```text
POST /api/attempts
```

Retrieve attempts:

```text
GET /api/attempts
```

Example response:

```json
{
  "ok": true,
  "results": []
}
```

## Assessment Workflow

```text
Enter name and email
↓
Answer questions
↓
Auto-advance per selection
↓
Submit assessment
↓
Score computed
↓
Results stored in D1
↓
Optional PDF generated
↓
Optional PDF stored in R2
```

## Scoring Model

Each question contributes:

```text
difficulty × weight
```

Domain score:

```text
sum(weighted correct) / sum(weighted total)
```

Overall readiness:

```text
sum(all weighted correct) / sum(all weighted total)
```

Weak areas are identified where a domain or subcategory falls below threshold.

## Local Testing

Install Wrangler:

```bash
npm install -g wrangler
```

Run locally:

```bash
wrangler pages dev .
```

## Troubleshooting

### Start Assessment button does nothing

Check:

```text
questions.json loads successfully
app.js loads successfully
no console errors
```

Open browser console with:

```text
F12 → Console
```

### /api/attempts returns HTML instead of JSON

Deployment likely failed. Check:

```text
Cloudflare Pages → Deployments → Logs
```

### Deployment error: invalid jurisdiction

Example:

```text
binding REPORTS of type r2_bucket contains an invalid jurisdiction
```

Fix by creating a new R2 bucket without jurisdiction restriction.

### wrangler.json warning during deploy

Example:

```text
wrangler.json file not valid for Pages
```

This can be ignored if you are configuring bindings in the Pages dashboard.

## Future Improvements

- Admin dashboard for reviewing attempts
- Candidate leaderboard
- Adaptive question difficulty
- Per-subcategory scoring visualization
- PDF branding customization
- Export to CSV
- Slack notification integration
- SSO login support
- Reviewer comments workflow

## License

Internal technical assessment tooling for Splunk TAM readiness evaluation.
