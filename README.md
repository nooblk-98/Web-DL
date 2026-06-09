## Complete Website Downloader 💾
Download the complete source code of any website (including all assets) 🔨.

👉 Live Demo: https://website-downloader.onrender.com

![enter image description here](https://github.com/AhmadIbrahiim/Website-downloader/blob/master/public/Record.gif?raw=true)
<div align="center">

  <a href="">![CodeFactor](https://www.codefactor.io/repository/github/ahmadibrahiim/website-downloader/badge)</a>

</div>

## Description 📒
 Website downloader works with `wget` and `archiver` to download all of a website's assets, compress them, and send the zip back to the user over a Socket.IO channel.

 **wget params being used**

 `wget --mirror --convert-links --adjust-extension --page-requisites
--no-parent http://example.org`

 **Explanation of the various flags:**

 - --mirror – Makes (among other things) the download recursive.
- --convert-links – convert all the links (also to stuff like CSS stylesheets) to relative, so it will be suitable for offline viewing.
- --adjust-extension – Adds suitable extensions to filenames (html or css) depending on their content-type.
- --page-requisites – Download things like CSS style-sheets and images required to properly display the page offline.
- --no-parent – When recursing do not ascend to the parent directory. It useful for restricting the download to only a portion of the site

## Features ✨

- **Safe by design** – URLs are launched with `spawn()` + an argument array (no shell), so a URL can never be interpreted as a command.
- **SSRF protection** – the server refuses to download private, loopback, link-local or cloud-metadata addresses (it DNS-resolves the host first).
- **Download options** – choose crawl depth, include/exclude file types, max size, wait between requests, whether to fetch page requisites, and whether to follow external links.
- **Cancel / Stop** – stop a running download; the wget process is killed and partial files are removed.
- **Concurrency control** – a configurable cap with a queue so the server can't be overwhelmed.
- **Live progress** – real progress bar, file count, current file and downloaded size.
- **Download history** – list, re-download or delete previously generated zips (`GET /api/history`, `DELETE /api/history/:name`).
- **Auto-cleanup** – old zips are swept on an interval so disk usage stays bounded.

### Configuration ⚙️

All optional; sensible defaults are used. Set via environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `MAX_CONCURRENT_DOWNLOADS` | `3` | Max simultaneous wget jobs |
| `ZIP_TTL_MS` | `86400000` (24h) | Age after which generated zips are deleted |
| `CLEANUP_INTERVAL_MS` | `3600000` (1h) | How often the cleanup sweep runs |
| `DOWNLOAD_ROOT` | `./downloads` | Working directory for site mirrors |
| `ALLOW_PRIVATE_HOSTS` | `false` | Set `true` to permit localhost/private hosts (local testing only) |

### Development scripts 🧰

- `npm start` – run the server
- `npm run dev` – run with `NODE_ENV=development`
- `npm test` – run the Jest unit tests
- `npm run lint` / `npm run lint:fix` – ESLint
- `npm run format` – Prettier

> **Security note:** wget re-resolves DNS and follows redirects itself, so a public host that redirects to an internal address could still be reached. Redirects are capped (`--max-redirect`); for hardened deployments, also run the server in a network-restricted environment.

### Deploy on cloud providers
[![Run on Replit](https://binbashbanana.github.io/deploy-buttons/buttons/remade/replit.svg)](https://replit.com/github/AhmadIbrahiim/Website-downloader)
[![Remix on Glitch](https://binbashbanana.github.io/deploy-buttons/buttons/remade/glitch.svg)](https://glitch.com/edit/#!/import/github/AhmadIbrahiim/Website-downloader)
[![Deploy on Railway](https://binbashbanana.github.io/deploy-buttons/buttons/remade/railway.svg)](https://railway.app/new/template?template=https://github.com/AhmadIbrahiim/Website-downloader)
[![Deploy to Cyclic](https://binbashbanana.github.io/deploy-buttons/buttons/remade/cyclic.svg)](https://app.cyclic.sh/api/app/deploy/AhmadIbrahiim/Website-downloader)
[![Deploy to Koyeb](https://binbashbanana.github.io/deploy-buttons/buttons/remade/koyeb.svg)](https://app.koyeb.com/deploy?type=git&repository=github.com/AhmadIbrahiim/Website-downloader&branch=main&name=Website-downloader)
[![Deploy to Render](https://binbashbanana.github.io/deploy-buttons/buttons/remade/render.svg)](https://render.com/deploy?repo=https://github.com/AhmadIbrahiim/Website-downloader)


## How to run it 🤔

Prerequisites: **Node.js 18+** and **`wget`** installed and on your `PATH`.

- `git clone https://github.com/AhmadIbrahiim/Website-downloader.git`
- `cd Website-downloader`
- `$ npm install`
- `$ npm start`
- `http://localhost:3000/`



# How To Contribute:
 - Open Issue(s) with any bugs you notice.
 - Please create Pull Requests if you think it would be an added value towards our program.

## Liked it ? You can buy a coffee:

<a href="https://www.buymeacoffee.com/aibrahim" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

Thank you,

Email: me@ahmed-ibrahim.com

https://www.ahmed-ibrahim.com
