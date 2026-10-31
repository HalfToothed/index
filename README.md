# Index

A calm, daily record of world events.

Index is not a news app. It doesn't chase breaking updates, trends, or
engagement. It presents each day as a structured document — clear, organized,
and readable. No personalization. No algorithms. No infinite feed.

It's meant to be opened, read once, and closed.

For ongoing stories, Index adds a **Context** panel: a short, Gemma-written
breakdown of what's happened, why it matters, and background on the broader
situation — so a reader can catch up on a story without digging through past
days themselves.

**Live:** https://index.abhishekpatil.tech/

---

## Source & Acknowledgment

Index uses Wikipedia's [Current Events portal](https://en.wikipedia.org/wiki/Portal:Current_events)
as its source. This choice is intentional:

- Entries are human-curated, not algorithm-ranked
- Events are structured by category
- Language is neutral and factual
- The format reflects a daily log, not a live feed

Content is maintained by Wikipedia contributors and is licensed under
[CC-BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Thank you to
the editors who maintain the Current Events portal and keep the daily record
accurate and structured.

---

## How it works

**`GET /api/today`**
```
Browser → Express → Wikipedia Current Events portal (1 fetch)

- Parses 7 days of entries (linkedom)
- Picks the newest day that has an ongoing story
- For each event, finds earlier days with the same topic
  (2+ earlier days = "ongoing")
- Cached 10 min (`X-Cache: HIT|MISS`)
```
**`POST /api/context`**
```
Browser → Express → Gemma (Google)
{ topic, seedDescription, history }

Gemma returns three parts, cached per story per day:
- **WHAT** — the pattern across entries
- **WHY** — why it matters, grounded only in the entries
- **BACKGROUND** — general context from the model's own knowledge

- Gemma runs only when a reader opens a Context panel, and each summary is
  cached, so the model is called at most once per ongoing story per day.
- WHAT/WHY are grounded strictly in the Wikipedia entries; BACKGROUND draws on
  Gemma's own knowledge and is labeled separately in the UI so readers can
  tell sourced facts from general context.
- The Gemma key stays server-side; the browser never sees it.
```
---

## Run locally

```bash
npm install
cp .env          # add your GEMMA_API_KEY (Google AI Studio)
npm start                     # http://localhost:3000
```
---

## Deploy on Cloudways (Velocity)

1. Push this folder to a GitHub repo.
2. Cloudways → Velocity → connect the repo. It reads `package.json`, detects the
   `start` script, and runs `node server.js`. No Nginx/PM2/SSL to configure.
3. Add an environment variable `GEMMA_API_KEY` in the Cloudways dashboard.
4. Hit deploy and open the app url.
---

## Files

| File | Role |
|------|------|
| `server.js` | Express: static files, `/api/today`, `/api/context`, caching |
| `parse.js` | Parses the portal HTML into days/sections/events (deepest topic) |
| `context.js` | Matches today's events to earlier days by topic |
| `gemma.js` | Calls Gemma to generate the WHAT/WHY/BACKGROUND context panel |
| `public/` | Frontend: `index.html`, `app.js`, `style.css` |
| `fetch-fixture.js`, `fixture.json` | Dev-only offline fixture |