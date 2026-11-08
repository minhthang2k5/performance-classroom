# Deploy Performance Lab on Render Free

Create an empty GitHub repository for Performance Lab. Upload the contents of
this `performance-classroom` folder directly at the repository root, including
`package.json`, `package-lock.json`, `render.yaml`, `frontend/`, `server/` and `scripts/`.
Then use the repository's root-level `render.yaml` to create a Blueprint on Render.
The Blueprint creates one free Node.js web service serving the React frontend
and the Express API together.

## Configuration

| Setting | Value |
| --- | --- |
| Root directory | Leave empty (repository root) |
| Build | `npm ci --include=dev && npm run build` |
| Start | `npm start` |
| Health check | `/api/health` |
| Node.js | `24.21.0` |
| `HOST` | `0.0.0.0` |
| `COOKIE_SECURE` | `true` |
| `ADMIN_PASSWORD` | Set privately in Render's environment settings |

The password is not part of the committed source. The environment variable
sets the admin password consistently across service restarts.

The learner entry point is `/`; the admin entry point is `/#/admin`.
All four lesson data sets are included in `server/content/`; deployment does
not require the `Newver` checkout, EShop backend, k6, or a separate database service.

## Files to exclude

The included `.gitignore` excludes `.env`, `node_modules/`, `server/data/`,
`frontend/dist/` and local logs. Do not upload the local database or the admin
password file. Set `ADMIN_PASSWORD` privately on Render when creating the service.
The original `Group4_WinRAR` repository and `Newver` checkout are not required
to build or start this standalone service. `npm run import:data` is only a
developer task for regenerating lesson snapshots from the original source data.

## Free service storage

Participant names, attempts, scores, ranking, and sessions are stored in the
local SQLite database. Render Free does not retain this database across sleeps,
restarts, or redeploys. The lesson definitions and bundled measurements are
restored from the source on each deployment.

## Verification

After deployment, check `/api/health`, join the learner page, complete Smoke,
and verify the participant and score appear in `/#/admin`.
