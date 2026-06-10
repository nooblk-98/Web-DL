<div align="center">

# Web-DL

**Download the complete source and assets of any website for offline viewing.**

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE.md)
[![CodeQL](https://img.shields.io/badge/CodeQL-enabled-2088FF?logo=github)](.github/workflows/codeql-analysis.yml)

![Web-DL demo](public/Record.gif)

</div>

Web-DL mirrors a website with [`wget`](https://www.gnu.org/software/wget/), compresses it with [`archiver`](https://www.npmjs.com/package/archiver), and streams live progress back to your browser over a [Socket.IO](https://socket.io) channel — then hands you a ready-to-download `.zip`.

## Features

- **Safe by design** — `wget` is launched with `spawn()` and an argument array (never a shell string), so a URL can't be interpreted as a command.
- **SSRF protection** — the server DNS-resolves each host and refuses private, loopback, link-local and cloud-metadata addresses.
- **Tunable downloads** — set crawl depth, include/exclude file types, a size quota, wait between requests, page requisites, and whether to follow external links.
- **Cancel anytime** — stop a running job; the `wget` process is killed and partial files are removed.
- **Concurrency control** — a configurable cap with a queue keeps the server from being overwhelmed.
- **Live progress** — real-time progress bar, file count, current file and downloaded size.
- **Download history** — list, re-download or delete previously generated zips.
- **Auto-cleanup** — old zips are swept on an interval so disk usage stays bounded.

## Getting started

> [!IMPORTANT]
> Web-DL shells out to `wget`. Make sure **Node.js 18+** and **`wget`** are installed and on your `PATH`.

```bash
git clone https://github.com/nooblk-98/Web-DL.git
cd Web-DL
npm install
npm start
```

Then open <http://localhost:3000>, paste a URL, tweak the options, and download.

## How it works

Every download is built from a fixed set of base `wget` flags:

```bash
wget --mirror --convert-links --adjust-extension --page-requisites --no-if-modified-since <url>
```

| Flag | Why |
| --- | --- |
| `--mirror` | recursive download of the whole site |
| `--convert-links` | rewrite links (incl. CSS) to relative paths for offline viewing |
| `--adjust-extension` | add `.html` / `.css` extensions based on content-type |
| `--page-requisites` | fetch the CSS, JS and images needed to render each page |
| `--no-if-modified-since` | always fetch resources instead of relying on conditional requests |

User-supplied options (depth, filters, `--no-parent`, etc.) are layered on top through a **strict allowlist** — raw flags from the client are never accepted.

The request flows through the server like this:

```text
Browser ──Socket.IO──▶ socket/socket.js ──▶ lib/jobQueue.js ──▶ wget/index.js (spawn wget)
   ▲                                                                    │
   │  live progress, file counts, status                               ▼
   └──────────────────── archiver/index.js ◀──── mirrored site folder (downloads/)
                                │
                                ▼
                    public/sites/<host>.zip  ──▶ served via express.static + /api/history
```

1. The client submits a URL and options over Socket.IO.
2. `lib/urlGuard.js` validates the URL and blocks SSRF targets; `lib/wgetArgs.js` builds a safe argument array.
3. `lib/jobQueue.js` enforces the concurrency cap; `wget/index.js` spawns `wget` and streams progress.
4. `archiver/index.js` zips the mirrored folder into `public/sites/`, the temp mirror is removed, and the download link is sent back.
5. `lib/cleanup.js` periodically deletes zips older than the configured TTL.

## Configuration

Everything is optional and falls back to sensible defaults. Set via environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `MAX_CONCURRENT_DOWNLOADS` | `3` | Max simultaneous `wget` jobs |
| `ZIP_TTL_MS` | `86400000` (24h) | Age after which generated zips are deleted |
| `CLEANUP_INTERVAL_MS` | `3600000` (1h) | How often the cleanup sweep runs |
| `DOWNLOAD_ROOT` | `./downloads` | Working directory for site mirrors |
| `MAX_DEPTH` | `10` | Upper bound for user-supplied crawl depth |
| `MAX_QUOTA_MB` | `2048` | Upper bound for user-supplied max download size |
| `MAX_WAIT_SECONDS` | `30` | Upper bound for the wait-between-requests option |
| `ALLOW_PRIVATE_HOSTS` | `false` | Set `true` to permit localhost/private hosts (local testing only) |

## HTTP API

Beyond the Socket.IO download channel, a small REST API manages generated zips:

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/history` | List generated zips (`name`, `size`, `modified`, `url`) |
| `DELETE` | `/api/history/:name` | Delete one zip (path-traversal guarded) |
| `GET` | `/sites/:name.zip` | Re-download a zip (served via `express.static`) |

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Run the server |
| `npm run dev` | Run with `NODE_ENV=development` |
| `npm test` | Run the Jest unit tests |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run format` | Prettier |

## Project structure

```text
app.js              Express app wiring (routes, views, error handling)
bin/www             Server entry point (HTTP + Socket.IO + cleanup)
routes/             HTTP routes (index, users, history API)
socket/             Socket.IO download orchestration
lib/                Core logic: urlGuard, wgetArgs, jobQueue, activeJobs, sites, cleanup
wget/               wget process spawning + progress parsing
archiver/           Zips a mirrored site folder
config/             Central config, limits and constants
views/              Handlebars templates
public/             Static assets + generated zips (public/sites)
__tests__/          Jest unit tests
```

## Security

> [!WARNING]
> `wget` re-resolves DNS and follows redirects itself, so a public host that redirects to an internal address could still be reached. Redirects are capped via `--max-redirect`; for hardened deployments, also run the server in a network-restricted environment.

## Credits

Web-DL is built on top of the original [**Website-downloader**](https://github.com/AhmadIbrahiim/Website-downloader) by [**Ahmad Ibrahim**](https://www.ahmed-ibrahim.com) — many thanks for the original work this project is based on.
