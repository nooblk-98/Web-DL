# Web-DL — Complete Website Downloader 💾

Download the complete source code and assets of **any website** for offline viewing 🔨.

Web-DL mirrors a site with `wget`, compresses it with `archiver`, and streams live
progress back to your browser over a Socket.IO channel — then hands you a ready-to-download
`.zip`.

<div align="center">

  ![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
  ![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## Description 📒

Web-DL works with `wget` and `archiver` to download all of a website's assets, compress
them, and send the zip back to the user over a Socket.IO channel.

**Base `wget` params being used**

```
wget --mirror --convert-links --adjust-extension --page-requisites --no-if-modified-since <url>
```

**Explanation of the various flags:**

- `--mirror` – makes (among other things) the download recursive.
- `--convert-links` – convert all the links (also to stuff like CSS stylesheets) to relative, so it will be suitable for offline viewing.
- `--adjust-extension` – adds suitable extensions to filenames (`.html` or `.css`) depending on their content-type.
- `--page-requisites` – download things like CSS stylesheets and images required to properly display the page offline.
- `--no-if-modified-since` – always fetch resources rather than relying on conditional requests.

User-supplied options (crawl depth, file filters, `--no-parent`, etc.) are layered on top
through a **strict allowlist** — raw flags from the client are never accepted.

## Features ✨

- **Safe by design** – URLs are launched with `spawn()` + an argument array (no shell), so a URL can never be interpreted as a command.
- **SSRF protection** – the server refuses to download private, loopback, link-local or cloud-metadata addresses (it DNS-resolves the host first).
- **Download options** – choose crawl depth, include/exclude file types, max size, wait between requests, whether to fetch page requisites, and whether to follow external links.
- **Cancel / Stop** – stop a running download; the `wget` process is killed and partial files are removed.
- **Concurrency control** – a configurable cap with a queue so the server can't be overwhelmed.
- **Live progress** – real progress bar, file count, current file and downloaded size.
- **Download history** – list, re-download or delete previously generated zips (`GET /api/history`, `DELETE /api/history/:name`).
- **Auto-cleanup** – old zips are swept on an interval so disk usage stays bounded.

## How it works 🧠

```
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

## Configuration ⚙️

All optional; sensible defaults are used. Set via environment variables:

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

## How to run it 🤔

Prerequisites: **Node.js 18+** and **`wget`** installed and on your `PATH`.

```bash
git clone https://github.com/nooblk-98/Web-DL.git
cd Web-DL
npm install
npm start
# open http://localhost:3000/
```

## Development scripts 🧰

- `npm start` – run the server
- `npm run dev` – run with `NODE_ENV=development`
- `npm test` – run the Jest unit tests
- `npm run lint` / `npm run lint:fix` – ESLint
- `npm run format` – Prettier

## Project structure 🗂️

```
app.js              Express app wiring (routes, views, error handling)
bin/www             Server entry point
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

## Security note 🔒

> `wget` re-resolves DNS and follows redirects itself, so a public host that redirects to an
> internal address could still be reached. Redirects are capped (`--max-redirect`); for
> hardened deployments, also run the server in a network-restricted environment.

## How to contribute 🤝

- Open issue(s) with any bugs you notice.
- Please create Pull Requests if you think it would be an added value towards the project.

## Credits 🙏

Web-DL is built on top of the original
[**Website-downloader**](https://github.com/AhmadIbrahiim/Website-downloader) by
[**Ahmad Ibrahim**](https://www.ahmed-ibrahim.com). Huge thanks to him for the original work
that this project is based on.

- 🌐 Website: <https://www.ahmed-ibrahim.com>
- ✉️ Email: me@ahmed-ibrahim.com
- ☕ Support the original author:
  <a href="https://www.buymeacoffee.com/aibrahim" target="_blank">Buy Me A Coffee</a>

## License 📄

Released under the [MIT License](LICENSE.md).
