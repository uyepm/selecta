# SELECTA — multiplayer edition (Render)

Phone web app + tiny relay server. No dependencies, no build step.

## Deploy
1. Create a GitHub repo (e.g. `selecta`) and upload ALL files in this folder (keep `public/` structure).
2. Give the repo URL to Claude — the Render service gets created from chat — or in Render: New → Blueprint → pick the repo (render.yaml does the rest).
3. Open `https://<service>.onrender.com` on any phone. HOST A TABLE on one, JOIN on another. Share the link freely — no accounts.

## Honest caveats (playtest grade)
- Games live in server memory: a restart or free-tier spin-down ends open tables (free tier sleeps after idle; first visit then takes ~30–60s to wake).
- Privacy is playtest-grade: hands travel under random ids, not real auth.
- Solo vs bots works entirely in-browser; the server only matters for live tables.
