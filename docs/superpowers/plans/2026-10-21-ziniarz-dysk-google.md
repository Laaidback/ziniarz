# Ziny na Dysku Google: plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Selected zines sync to a `.zin` file on the owner's Google Drive and can be opened by other people the file is shared with (one at a time, conflicts resolved by a dialog).

**Architecture:** Static site, no server. Google Identity Services token client (`drive.file` scope) + Google Picker + Drive REST v3 over `fetch`. Zine ↔ file links live in a new IndexedDB store; sync decisions are pure (`decideSync`), orchestration (`cloudSync.ts`) reuses the `.zin` bundle code. Services are injected through a React context so tests run against an in-memory fake Drive.

**Tech Stack:** React 19, Zustand, idb, JSZip, Vitest (node + browser), Playwright (`page.route` stubs for Google).

Spec: `docs/superpowers/specs/2026-10-21-ziniarz-dysk-google-design.md`.

---

## File map

| File | Responsibility |
|---|---|
| `src/cloud/config.ts` | Build-time Google ids (`VITE_GOOGLE_*`), `cloudConfigured()` |
| `src/cloud/errors.ts` | `CloudError` (kind + Polish message), `cloudErrorOf(unknown)` |
| `src/cloud/sync.ts` | Pure: `decideSync`, `lastChangeText`, `timeAgo` |
| `src/cloud/driveApi.ts` | `DriveClient` interface and `createDriveClient({ token, fetch })` over REST v3 |
| `src/cloud/fakeDrive.ts` | In-memory `DriveClient` for tests (also used by e2e stub logic via its own copy) |
| `src/cloud/links.ts` | `driveLinks` store access: get/put/delete/byFile/list |
| `src/cloud/cloudSync.ts` | `linkToDrive`, `syncZine`, `resolveConflict`, `openFromDrive`, `unlink`, `relinkAsNew`, per-zine queue |
| `src/cloud/cloudStatus.ts` | Zustand store: per-zine sync state for list and editor |
| `src/cloud/googleAuth.ts` | GIS script loader, token cache (memory + sessionStorage), `signIn()` |
| `src/cloud/picker.ts` | Picker script loader, `pickZinFile(token)` |
| `src/cloud/CloudContext.ts` | `CloudServices` type, context, `useCloud()`, default Google services |
| `src/cloud/CloudStatusView.tsx` | Editor top-bar status / login / „Wczytaj” bar / „Zapisz na Dysku” |
| `src/cloud/ConflictDialog.tsx`, `src/cloud/conflict.ts` | Conflict question store + host dialog (like `confirm.ts`) |
| `src/cloud/useEditorCloudSync.ts` | Editor hook: debounce 10 s, flush, sync, status |
| `src/storage/db.ts` | DB version 2 with `driveLinks` store |
| `src/storage/zinFile.ts` | `replaceFromBundle(db, zineId, bundle)` |
| `src/home/HomeScreen.tsx`, `ZineCard.tsx` | Drive buttons, badge, background sync before prune |
| `src/editor/EditorScreen.tsx`, `TopBar.tsx` | Sync before open, reload after download, status in bar |
| `src/App.tsx` | `CloudContext` provider (default real services), `ConflictHost` |
| `e2e/drive.spec.ts`, `e2e/fakeGoogle.ts` | Two-person flow on stubbed Google |
| `playwright.config.ts` | Build with test `VITE_GOOGLE_*` values |
| `.github/workflows/deploy.yml` | Pass repo variables to `npm run build` |
| `README.md`, `CLAUDE.md` | Google setup steps, invariants |

## Tasks

### Task 1: DB version 2 + links
- [ ] Test (`src/cloud/links.test.ts`, node, fake-indexeddb): put/get/delete link, `linkByFileId`, opening a v1 database upgrades and keeps zines.
- [ ] `db.ts`: `openDB(name, 2, upgrade(db, oldVersion))`, create v1 stores only when `oldVersion < 1`, `driveLinks` (keyPath `zineId`, index `byFile` on `fileId`) when `oldVersion < 2`.
- [ ] `links.ts`: `DriveLink { zineId, fileId, version, syncedUpdatedAt, modifiedTime, modifiedBy }`.
- [ ] Run `npm run test:unit`, commit.

### Task 2: pure sync logic
- [ ] Tests `src/cloud/sync.test.ts`: all four `decideSync` cases; `timeAgo` (przed chwilą, 1 min, 5 min, 2 godz., wczoraj → date); `lastChangeText` with name / `me` → „ty” / no user.
- [ ] Implement, run, commit.

### Task 3: errors + Drive REST client
- [ ] Tests `src/cloud/driveApi.test.ts` with a scripted fake `fetch`: resumable create (POST metadata → `Location` → PUT bytes → meta), update (PATCH → PUT), meta fields query, download, folder find-or-create, error mapping (TypeError → offline, 401 → auth, 403 `storageQuotaExceeded` → quota, 403 other → forbidden, 404 → notFound, trashed → notFound, 500 → other).
- [ ] Implement `errors.ts`, `driveApi.ts`.
- [ ] `fakeDrive.ts` (in-memory, versions increment, users) + its own small test.
- [ ] Run, commit.

### Task 4: replaceFromBundle
- [ ] Tests in `src/storage/zinFile.test.ts`: replaces zine under the same id; identical font family keeps id; changed family used by another zine gets a new id and the other zine's family is untouched.
- [ ] Implement, run, commit.

### Task 5: cloudSync orchestration
- [ ] Tests `src/cloud/cloudSync.test.ts` (fake-indexeddb + fake Drive): link uploads into folder „Ziniarz” and records version; unchanged → none; local change → upload; remote change → download (allowDownload) or `remoteNewer`; both → conflict; resolve theirs / mine / copy; openFromDrive new + same file again → same zine; notFound / offline results; unlink keeps file; title change renames file; operations on one zine run in order.
- [ ] Implement, run, commit.

### Task 6: status store, Google auth, picker, context
- [ ] `cloudStatus.ts` + test.
- [ ] `googleAuth.ts` (script loader with one promise, token cache with expiry minus 60 s, sessionStorage in try/catch), `picker.ts`, `CloudContext.ts` (default services only when configured).
- [ ] Typecheck, commit.

### Task 7: UI
- [ ] `conflict.ts` + `ConflictDialog.tsx` (three buttons + Anuluj not offered: choice required? — „Anuluj” leaves the zine as is and stops syncing until next try).
- [ ] Home: „Otwórz z Dysku Google”, card buttons/badge, background `syncAll` before prune, delete message mentions Drive.
- [ ] Editor: `useEditorCloudSync`, sync-before-open in `EditorScreen`, `CloudStatusView` in `TopBar`, reload key.
- [ ] Browser tests: `src/cloud/CloudStatusView.browser.test.tsx`, Home card buttons with fake services, conflict dialog choices, no buttons without config.
- [ ] Run `npm test`, commit.

### Task 8: e2e + build + docs
- [ ] `playwright.config.ts`: build with `VITE_GOOGLE_CLIENT_ID=e2e-client` etc.
- [ ] `e2e/fakeGoogle.ts`: route stubs for `accounts.google.com/gsi/client`, `apis.google.com/js/api.js`, `www.googleapis.com/**` (shared in-memory Drive across two contexts).
- [ ] `e2e/drive.spec.ts`: Ala links zine → Ola opens from Drive, adds a text → Ala opens, sees text.
- [ ] Workflow vars, README Google setup, CLAUDE.md section, `npm run typecheck && npm test && npm run test:e2e && npm run build && npm run check:dist`, commit.
