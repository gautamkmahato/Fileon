# fileon

A faster, calmer way to browse your Google Drive.

fileon is a Next.js client for Google Drive that adds an application layer on top of the Drive API: tags, smart spaces, saved views, an inbox for new files, cleanup tooling, and a share-link manager — all while keeping Google Drive as the single source of truth for your files.

Nothing is uploaded to a fileon server. Files stay in Google Drive; app-level metadata (tags, pins, views, cleanup scans, share links) is stored in the browser's IndexedDB, scoped to the signed-in Google account.

The app uses the Google Drive API with the `drive` scope so your library syncs automatically after sign-in. That scope is **restricted** by Google: production use beyond test users typically requires OAuth app verification and a CASA security assessment.

## Features

- **Browse** – grid / list / gallery views, breadcrumbs, folder tree, drag-and-drop upload and move, cut/copy/paste, keyboard shortcuts, command palette, global search.
- **Preview** – images, PDFs (page-1 thumbnails), CSV and Markdown rendered offline; Quick Look for the selected file.
- **Organize** – star, pin to dashboard, favorite folders, hide items, folder cover images, "recently worked in" shortcuts.
- **Tags** – user, status, people, and project tag kinds with colors, emoji, exclusive status tags, bulk tagging, and tag filtering (AND / OR).
- **Saved views** – capture a view scope + filters + sort and pin it to the sidebar.
- **Smart spaces** – rule-based virtual folders (type, size, date, name, tags) that update as your Drive changes.
- **Inbox** – newly uploaded files land in an inbox for triage.
- **Cleanup** – detects duplicates, near-duplicates, stale/dead/unused files, empty folders, broken shortcuts, orphaned and unorganized files, with a health score.
- **Share links** – app-managed links with expiry, download toggle, view/download counts, and revoke, alongside Drive's native "anyone with the link" permission.
- **Activity log with undo** – rename, move, trash, and tag changes can be undone.

## Getting started

### 1. Create Google credentials

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project and enable the **Google Drive API**.
2. Under **APIs & Services → Credentials** create an **OAuth client ID** of type *Web application*.
   Add `http://localhost:3000` (and your production origin) to **Authorized JavaScript origins**.
3. Under **OAuth consent screen**, add the scopes the app requests: `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/drive`.
   The `drive` scope is restricted; plan for Google's verification process before launching to the public.

### 2. Configure and run

```bash
cp .env.example .env
# edit .env and set NEXT_PUBLIC_GOOGLE_CLIENT_ID

npm install
npm run dev
```

Open http://localhost:3000.

### Scripts

| Command             | Description                        |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Start the dev server (Turbopack)   |
| `npm run build`     | Production build                   |
| `npm run start`     | Serve the production build         |
| `npm run typecheck` | `tsc --noEmit`                     |

## Project structure

```
app/
  (marketing)/        Landing page, sign-in, privacy, terms
  (app)/              Signed-in shell; each page.tsx is a route anchor,
                      the UI is rendered by AppShell based on the parsed route
    providers.tsx     Feature providers composed in one place
  api/share-links/    Public share-link endpoints (view, hit, manage, stats)
  s/[token]/          Public share-link landing page
  _components/        Feature-organized React components
    auth/ brand/ cleanup/ drive/ favorites/ folder-covers/ hidden/
    inbox/ layout/ pins/ shares/ spaces/ tags/ ui/ views/
    drive/context/    DriveBrowseProvider + hooks; actions/ holds the
                      action groups (files, trash, move, clipboard, …)
  _hooks/             Cross-feature hooks that depend on providers

lib/
  activity/           Activity log + undo stack
  cache/              In-memory / IndexedDB caches (folder tree, thumbnails, counts)
  cleanup/            Cleanup scan, analyzers, and persistence
  collections/        Favorites, pins, hidden, inbox, folder covers, recent folders
  config/             Brand + shared constants
  db/                 IndexedDB engines (local-db for app metadata, engine/schema
                      for the table-shaped cleanup / spaces / share-link stores)
  drive/              Google Drive REST client and helpers
  navigation/         Route definitions, route parsing, sidebar model
  preview/            Thumbnail + preview pipelines (PDF, CSV, Markdown)
  shares/             Share-link domain: types, status, tokens, repository, API client
  spaces/             Smart-space rules, query, and repository
  stores/             Zustand stores (files, selection, browse, clipboard)
  tags/               Tag kinds, colors, repository, activity
  views/              Saved views
  hooks/ types/ ui/ utils/
```

### Architecture notes

- **Route anchors.** Pages under `app/(app)` render `null`; `AppShell` decides what to show from `useDriveRoute()`. This keeps the file list mounted across navigation and avoids refetching.
- **Two persistence layers.** `lib/db/local-db.ts` is a simple key/value IndexedDB for tags, pins, views, activity, etc. `lib/db/engine.ts` + `schema.ts` is a table-shaped IndexedDB (with an in-memory fallback) used by cleanup, smart spaces, and share links; every row is scoped by the Google account `sub`.
- **Share links.** Owners keep links in IndexedDB. Public view/download counts are served by the API routes under `app/api/share-links`, backed by a JSON file in `.data/` (gitignored) so a self-hosted instance works without a database. Swap `lib/shares/server-store.ts` for a real store when deploying at scale.
- **Drive stays authoritative.** fileon never mirrors file content; hiding, pinning, tagging, and inboxing are app-level metadata only.

## Contributing

1. Fork and create a branch.
2. `npm run typecheck` must pass.
3. Keep features self-contained: domain logic in `lib/<feature>/`, UI in `app/_components/<feature>/`.
