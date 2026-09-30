# Shiva Mobiles

Website for a second-hand mobile phone shop. Customers browse checked phones, compare them, sell their old phone and get a digital bill with a warranty card. The shop manages everything from a phone-friendly admin panel.

The public site works in **English and Telugu**. The admin panel is in English.

---

## What it does

**For customers**

- Browse phones with filters (brand, price, RAM, storage, condition, battery health, 5G, box and bill) and quick tags like "Good for games" or "Easy for parents".
- Each phone page has photos, a health report (grade, battery, 12-point test), "IMEI verified", shop warranty and full specs.
- Compare up to 3 phones side by side. The better value in each row is highlighted.
- **Sell your phone:** 6 quick questions, an instant price range, optional photos, and a private link to follow the request.
- **Notify me:** leave a number and the shop messages them when a matching phone comes in.
- **Bill and warranty card** on a private link, printable, with a QR code. **Warranty check** with bill number and mobile number.
- Contact by WhatsApp or call from every phone.

**For the shop (admin panel at `/admin`)**

- Add a phone in a few minutes. Type the model name or number and the specs fill in from Wikipedia (read by a free AI) for you to check before saving. Photos are straightened, watermarked with the shop name and made small for fast loading.
- **Share to WhatsApp:** a ready poster image, the photos, and captions in English and Telugu, to share to chats, groups or Status.
- IMEI numbers are never stored. Staff check the IMEI in the government database and record only the result. A phone can't go live until the check is marked clear and it has a photo.
- Mark sold → digital bill and warranty card, sent on WhatsApp in one tap. Later, ask for a Google review.
- Sell requests: new → contacted → offer → pickup → bought → "Add to stock". The seller sees each update on their link.
- Notify list with phones in stock that match each request.
- Sales by month with margin (owner only) and an Excel download.
- Phone catalog, buying prices and price-cut rules for the sell estimate.
- Team: owner and staff roles. Staff don't see buying costs or settings.
- Activity log, 2-step login for everyone, recovery codes, and a list of logged-in devices.

---

## Run it on your computer

You need **Node.js 22** (20.9 or newer works).

```bash
npm install
npm run db:seed    # demo phones, requests, sales and an owner account
npm run dev
```

- Website: http://localhost:3000
- Admin: http://localhost:3000/admin (username `owner`, the password is printed by `db:seed`)

At the first login you set up 2-step login with an authenticator app (Google Authenticator, Microsoft Authenticator, 2FAS…).

Locally the database is an embedded Postgres stored in `.data/`, so nothing else needs installing. `npm run db:reset` wipes it and loads the demo data again. Stop `npm run dev` before seeding.

Useful commands:

| Command               | What it does                                    |
| --------------------- | ----------------------------------------------- |
| `npm run dev`         | Start the site for development                  |
| `npm run typecheck`   | Check types                                     |
| `npm run lint`        | Check code style and common mistakes            |
| `npm test`            | Unit tests (pricing, matching, security, …)     |
| `npm run format`      | Format all code with Prettier                   |
| `npm run build`       | Production build                                |
| `npm run db:generate` | Create a migration after changing the schema    |
| `npm run db:migrate`  | Apply migrations to the `DATABASE_URL` database |

---

## Quick online preview on Render

To get a live link in about 15 minutes, with nothing to install. `render.yaml` sets everything up: the website and its database in Singapore, Render's closest region to India.

1. Put this code in a GitHub repository.
2. Sign in at [render.com](https://render.com) with GitHub.
3. Choose **New → Blueprint**, pick the repository, and click **Apply**. The first build takes about 10 minutes.
4. Your link is shown on the `shiva-mobiles` service, for example `https://shiva-mobiles.onrender.com`. If that name is taken, Render adds a few letters.
5. Open the service's **Environment** tab and copy `SETUP_TOKEN`. Then open `<your link>/admin/setup` and create the owner account. **Also copy `APP_SECRET` somewhere safe.**

The free plans are only for trying the site:

- The website sleeps after 15 minutes without visitors; the next visit takes about a minute.
- Render **deletes a free database 30 days after it was made** (plus 14 days' grace) unless it's moved to a paid plan.
- The free database holds 1 GB, roughly 250 phones with photos.

For the real shop, change both to paid plans in Render (about $7 a month for the website and $6 for the database in September 2026, plus storage), or use your own server as below. Add your own domain under the service's **Settings → Custom Domains**, and put it in **Shop settings → Website address**.

---

## Put it online on your own server

The simplest long-term setup is **one small Linux server with Docker**. It runs the website, its Postgres database and Caddy, which gets the HTTPS certificate automatically.

**Server size:** 2 GB RAM is comfortable (1 GB works with swap). Both DigitalOcean (Bangalore) and AWS Lightsail (Mumbai) had 2 GB plans for about $12 a month in September 2026; check current prices before buying.

1. **Create the server** with Ubuntu 24.04 in an Indian region.
2. **Buy a domain** (for example `shivamobiles.in`) and add an `A` record that points to the server's IP address.
3. **Install Docker** on the server:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
4. **Copy the code** to `/opt/shiva-mobiles` (with `git clone`, or upload the zip and unzip it there).
5. **Fill in the settings:**
   ```bash
   cd /opt/shiva-mobiles
   cp .env.example .env
   nano .env
   ```
   Set `APP_SECRET`, `SITE_URL`, `SITE_DOMAIN`, `POSTGRES_PASSWORD` and `SETUP_TOKEN`. The file explains each one. **Save `APP_SECRET` somewhere safe off the server** — without it, bill links and 2-step logins stop working.
6. **Open the firewall** for web traffic only:
   ```bash
   ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
   ```
7. **On a 1–2 GB server, add swap** so the first build doesn't run out of memory:
   ```bash
   fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   ```
8. **Start it:**
   ```bash
   docker compose up -d --build
   ```
   The first build takes a few minutes. The database tables are created automatically.
9. **Create the owner account:** open `https://your-domain/admin/setup`, enter the `SETUP_TOKEN`, then log in and set up 2-step login. Print or write down the recovery codes.
10. **Remove `SETUP_TOKEN`** from `.env` and run `docker compose up -d`.
11. In the admin panel, fill in **Shop settings** (WhatsApp number, address, Google Maps link, Google review link, GSTIN if registered), check **Buying prices**, and add staff under **Team**.
12. **Turn on nightly backups** (see below).

**Updating to a new version:** copy the new code, then `docker compose up -d --build`. Database changes are applied automatically when the new version starts.

**Useful:** `docker compose logs -f app` shows the website's log; `docker compose ps` shows what is running.

### Backups

Everything (phones, photos, requests, bills) is in the database. `scripts/backup.sh` saves a copy and keeps 14 days of them in `backups/`:

```bash
crontab -e
# add this line:
30 2 * * * cd /opt/shiva-mobiles && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Copy the `backups` folder off the server now and then (for example to Google Drive with `rclone`). To restore a copy:

```bash
docker compose exec -T db pg_restore -U shiva -d shiva --clean --if-exists < backups/shiva-2026-09-29.dump
```

### Other ways to host

Any host that runs Node.js 22 and a Postgres database works (Railway, Render, a VPS without Docker…):

- Build with `npm ci && npm run build`. Start with `node .next/standalone/server.js` after copying `.next/static` to `.next/standalone/.next/static` and `public` to `.next/standalone/public` (or use the `Dockerfile`).
- Set `DATABASE_URL`, and either `MIGRATE_ON_START=1` or run `npm run db:migrate` before each start.
- Photos are stored in the database, so expect up to about 4 MB per phone listed. Free database plans fill up quickly.
- Set the visitor IP header for your host (next section).

### Visitor IP addresses

Rate limits and the activity log use the visitor's IP address, which reaches the app through a header set by the proxy in front of it. Set these to match your setup:

| Setup                           | Setting                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| The Docker Compose setup above  | Nothing to do (`TRUSTED_IP_HEADER=x-real-ip` is already set)                                  |
| nginx in front                  | `TRUSTED_IP_HEADER=x-real-ip` and `proxy_set_header X-Real-IP $remote_addr;` in nginx         |
| Render                          | Already set in `render.yaml` (`true-client-ip,cf-connecting-ip`)                              |
| Railway or another single proxy | Leave both empty (the last `X-Forwarded-For` address is used)                                 |
| Cloudflare proxy in front       | `TRUSTED_IP_HEADER=cf-connecting-ip`, and only let Cloudflare's IP addresses reach the server |

Never let visitors reach the Node server directly; without a proxy in front, these headers can be faked.

### All settings

| Setting                                      | Needed?     | What it is                                                                                                                                                           |
| -------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_SECRET`                                 | Yes         | 32+ random characters. Encrypts 2-step keys and bill links.                                                                                                          |
| `DATABASE_URL`                               | Yes*        | Postgres connection string (*Docker Compose sets it)                                                                                                                 |
| `SITE_URL`                                   | Yes*        | Website address for WhatsApp posts, bills and the sitemap (*on Render, the onrender.com address is used until you set one)                                           |
| `SETUP_TOKEN`                                | Once        | Allows creating the first owner at `/admin/setup`                                                                                                                    |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Recommended | Cloudflare Turnstile "I am human" check on public forms (free)                                                                                                       |
| `OPENROUTER_API_KEY`                         | Recommended | Lets the free AI read specs from Wikipedia and remember phones Wikipedia lacks. Only free models are used. In OpenRouter, allow free models under Settings → Privacy |
| `OPENROUTER_MODEL`                           | No          | A free model (ending in `:free`) to try first. By default the site tries Nemotron 3 Super, Gemma 4 31B, Gemma 4 26B and Qwen3.8 27B in turn                          |
| `TRUSTED_IP_HEADER`, `TRUSTED_PROXY_HOPS`    | Depends     | See "Visitor IP addresses". Several headers can be listed, comma-separated                                                                                           |
| `MIGRATE_ON_START`                           | No          | `1` applies database migrations when the server starts                                                                                                               |
| `CRON_SECRET`                                | No          | Lets an outside scheduler call `POST /api/cron/cleanup`                                                                                                              |
| `DATABASE_POOL_MAX`                          | No          | Database connections (default 5)                                                                                                                                     |
| `SITE_DOMAIN`, `POSTGRES_PASSWORD`           | Docker only | Domain for Caddy, and the database password                                                                                                                          |

Without Turnstile keys the public forms still have a hidden spam trap and rate limits, but the keys are recommended once the site is public.

---

## Using the admin panel

**Add a phone** — tap **+**. Type the model name or number (for example `Galaxy A54` or `SM-A546E`). If it's not in your catalog yet, tap **Get specs**: the site looks the phone up on Wikipedia and the free AI reads the specs out for you to check (a few seconds; works for new phones too). If Wikipedia has no page, the free AI answers from memory. If nothing knows the phone, tap **Add by hand**, or **Paste specs** to copy them from any specs website. Check the specs, remove variants not sold in India, add launch prices if you know them, and save. The model is then in your catalog for next time.

Then pick the variant, colour and grade, fill in battery health and the 12 tests, what comes in the box, the price, and (owner only) what you paid. Add 4 or more photos on a plain background. Check the IMEI (dial `*#06#`, then SMS `KYM <IMEI>` to 14422 or use the Sanchar Saathi app), mark the result, and tap **Publish**. The IMEI number itself is never saved; if one is typed into a notes box by mistake, the form asks you to remove it.

> Since 22 October 2025, the Telecommunications (Telecom Cyber Security) Amendment Rules, 2025 require dealers in used phones to check each phone's IMEI against the government database before buying or selling it. Do the check on the official portal, then record the result (and any reference number, never the IMEI) here. Check the current rules with the Department of Telecommunications.

**Hide prices** — in **Shop settings → Prices**, untick *Show selling prices on the website*. Visitors then see "Ask for price" on the website, posters and WhatsApp captions, price filters and "you save" lines disappear, and they contact you instead. Bills and the admin panel keep showing prices.

**Share to WhatsApp** — on the phone's page, tap **Share to WhatsApp**. The poster and photos open in WhatsApp's share screen; the caption is copied, so long-press and paste it. Links carry `?src=wa`, so the phone's page shows how many visits came from WhatsApp.

**Sell requests** — new requests appear under **Sell requests** with the seller's answers, photos and the website's estimate. Send an offer on WhatsApp in the seller's language, book a pickup, and after buying tap **Add to stock** to create the phone from the request.

**Notify list** — people waiting for a phone. When a matching phone is in stock it's shown under their request, with a ready WhatsApp message.

**Selling** — on the phone's page tap **Mark sold**, enter the customer's name and mobile, and send the bill on WhatsApp. Sold phones are locked so the bill never changes. Only the owner can cancel a sale; the bill is then marked cancelled, not deleted.

**Team** — add staff with a temporary password. At first login they set up 2-step login and choose their own password.

**Lost phone** — log in with one of your recovery codes, then go to **My login and security → Set up on a new phone**. If a staff member loses theirs, the owner can reset it under **Team**.

---

## Security

- Admin accounts only (customers don't need accounts). Passwords hashed with PBKDF2 (600,000 rounds). 2-step login is required for everyone, codes can't be reused, and there are one-time recovery codes.
- Login sessions are stored in the database, end after 3 days unused (14 days at most), and end everywhere when a password changes. Devices that logged in before get their own attempt limit, so strangers' wrong tries can't lock the owner out.
- Owner-only areas: buying costs, margins, settings, team, activity log, cancelling sales, deleting.
- IMEI numbers are never stored: only the result of the government check is saved. Staff notes that contain an IMEI are refused, and IMEIs typed by customers are removed.
- 2-step keys and bill links are encrypted (AES-256-GCM).
- Specs lookups read Wikipedia (one search and one article per lookup, with the site's name in the user agent) and, for pasted GSMArena links, that one page. Both have timeouts, size limits and rate limits. GSMArena's search is never used.
- Every form is checked on the server. Public forms have rate limits, a spam trap and optional Turnstile. Photos are checked, re-encoded and stripped of location data.
- Strict Content Security Policy with a fresh nonce per page, HSTS, no framing, no-store and noindex on admin pages.
- An activity log records logins, changes, sales and exports.

## Privacy

The site collects only what each request needs: name, mobile, area and the phone's details. It deletes "notify me" requests after 90 days, and sell requests (with their photos) a set number of days after their last update (365 by default, in Shop settings). The privacy note is at `/privacy` and the warranty terms at `/terms`. **Read both with the owner and change anything that doesn't match how the shop works** — the text is in `src/content/legal.ts`. If a customer asks for their data to be deleted, the owner can delete their sell request or notify-me entry from the admin panel.

---

## How the code is organised

```
src/app/(site)/          public pages: home, phones, compare, sell, wanted, bill, warranty, privacy, terms
src/app/admin/           login, 2-step setup and the admin panel ((panel)/…), each with its server actions
src/app/api/             photo upload, WhatsApp poster, click tracking, clean-up
src/components/          site/, admin/ and shared ui/ components
src/db/                  database schema (Drizzle) and connection
src/i18n/                English and Telugu text
src/lib/                 business logic: listings, pricing, matching, bills, media, security, auth
src/content/legal.ts     privacy note and warranty terms
scripts/                 seed data, migrations, backup
drizzle/                 database migrations
```

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Drizzle ORM with Postgres, and sharp for photos.

## Good to know

- **Photos live in the database.** That keeps backups simple and is fine for hundreds of phones. If it grows past a few GB, move photos to object storage such as Cloudflare R2.
- **Demo data is only for trying the site.** The sample catalog specs are examples; in production the catalog starts empty and fills as you add models.
- **WhatsApp sharing is manual on purpose.** WhatsApp's official API can't post to Status and its group features are limited, and unofficial bots risk getting the shop's number banned. Sharing from the phone is safe and takes a few taps.
- Not included yet: exchange offers (old phone as part payment), online payments, and delivery tracking.
