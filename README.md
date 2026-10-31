# Index

A calm daily record of world events, sourced from Wikipedia's Current Events
portal. Ongoing stories get a **Context** panel: a short, Gemma-written catch-up
plus links to the earlier days.

## How it works

```
Browser ──GET /api/today──▶ Express ──▶ Wikipedia Current Events portal (1 fetch)
                                     │
                                     ├─ parse 7 days (linkedom)
                                     ├─ pick newest day that has an ongoing story
                                     ├─ for each event, find earlier days with the
                                     │  same topic (>=2 earlier days = "ongoing")
                                     └─ cache 10 min  (X-Cache: HIT|MISS)

Browser ──POST /api/context──▶ Express ──▶ Gemma (Google) writes a 2-3 sentence
            {topic, history}              catch-up from the earlier entries only.
                                          Cached per story per day.
```

- Gemma runs only when a reader opens a Context panel, and each summary is
  cached, so the model is called at most once per ongoing story per day.
- The Gemma key stays server-side; the browser never sees it.

## Run locally

```bash
npm install
cp .env.example .env          # add your GEMMA_API_KEY (Google AI Studio)
npm start                     # http://localhost:3000
```

Get a key at https://aistudio.google.com.

### Local network notes
- If your network intercepts TLS (corporate proxy) and you see
  `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, run with the system cert store:
  `NODE_OPTIONS=--use-system-ca npm start`.
- To develop with no network at all, use the saved fixture:
  `USE_FIXTURE=1 npm start` (reads `fixture.json`). Regenerate the fixture with
  `node fetch-fixture.js`. Never set `USE_FIXTURE` in production.

## Deploy on Cloudways (Velocity)

1. Push this folder to a GitHub repo.
2. Cloudways → Velocity → connect the repo. It reads `package.json`, detects the
   `start` script, and runs `node server.js`. No Nginx/PM2/SSL to configure.
3. Add an environment variable `GEMMA_API_KEY` in the Cloudways dashboard.
4. Open the app URL. For a staging environment, deploy a second app on the same
   plan from a `staging` branch.

The app listens on `process.env.PORT` (Cloudways sets it).

## Files

| File | Role |
|------|------|
| `server.js` | Express: static files, `/api/today`, `/api/context`, caching |
| `parse.js` | Parses the portal HTML into days/sections/events (deepest topic) |
| `context.js` | Matches today's events to earlier days by topic |
| `gemma.js` | Calls Gemma to write the catch-up summary |
| `public/` | Frontend: `index.html`, `app.js`, `style.css` |
| `fetch-fixture.js`, `fixture.json` | Dev-only offline fixture |
