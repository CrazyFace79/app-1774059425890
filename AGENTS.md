# AGENTS.md

## Cursor Cloud specific instructions

This is a Next.js 14 app using the **Pages Router** (`pages/` directory), React 18, and TypeScript. There is no backend, database, or auth wired up yet; the app currently renders a single static page (`pages/index.tsx`).

### Services

Single service: the Next.js web app.

- Run dev server: `npm run dev` — serves on `0.0.0.0:3000` (host binding is set in the `dev`/`start` scripts so it is reachable from outside the VM).
- Lint: `npm run lint` (`next lint`, config in `.eslintrc.json`).
- Build: `npm run build`.
- Production start (after build): `npm start`.

### Notes

- There are no automated tests in this repo yet.
- Dependencies are managed with npm (`package-lock.json`). The update script runs `npm install`.
