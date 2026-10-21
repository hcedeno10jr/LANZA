# LANZA

Throwing practice for Ultimate Frisbee. Athletes can start a session in one tap. When they finish, they can upload it to Strava and compare scores on a team board.

## What's in this folder

| File | What it does |
|---|---|
| `index.html` | The whole app. It works offline and can be added to a phone's home screen. |
| `sw.js` | Offline cache. It also loads new versions in the background. |
| `manifest.webmanifest`, `icon*.png`, `icon.svg` | Home-screen name and icons |
| `netlify/functions/config.mjs` | Sends the public settings to the app (Strava client ID, whether ads are on) |
| `netlify/functions/strava.mjs` | Strava sign-in and activity upload. The client secret stays on the server. |
| `netlify/functions/team.mjs`, `team-core.mjs` | Team board and monthly team challenge. Data is stored in Netlify Blobs, which is free and needs no extra account. |
| `netlify/functions/backup.mjs`, `backup-core.mjs` | History backup, tied to each athlete's Strava account |
| `netlify/functions/pro.mjs`, `stripe-webhook.mjs`, `pro-core.mjs` | LANZA Pro subscription (Stripe) |
| `netlify/functions/usage.mjs`, `usage-core.mjs`, `usage.html` | Anonymous daily usage counts and the owner's usage page |
| `i18n.js` | All languages |
| `privacy.html` | Privacy policy (Strava requires one) |
| `netlify.toml`, `package.json` | Netlify build settings |

## One-time setup (owner only)

1. **Deploy from GitHub.** Push this folder to a GitHub repo. In Netlify, choose Add new site > Import an existing project and pick the repo. The build settings come from `netlify.toml`. Every push after that deploys on its own. The server functions need a Git or CLI deploy, so Netlify drag-and-drop won't work for this app.
2. **Create the Strava API app** at https://www.strava.com/settings/api
   - Set Authorization Callback Domain to your Netlify domain, for example `lanza.netlify.app`, with no `https://`.
   - Since 2026, Strava requires API developers to have a Strava subscription.
   - New Strava apps can connect only a small number of athletes at first: 1 at the start, and up to 10 without a review. To open the app to more athletes, submit it for Strava's review from the same page.
3. **Set the environment variables** in Netlify (Site configuration > Environment variables):

| Variable | Value |
|---|---|
| `STRAVA_CLIENT_ID` | From the Strava API page |
| `STRAVA_CLIENT_SECRET` | From the Strava API page. Keep it secret. |
| `ADS_ENABLED` | Leave unset for now. Set it to `true` to turn on the weekly ad gate. |
| `AD_UNIT_PATH` | Optional. A Google Ad Manager rewarded ad unit, for example `/1234567/lanza_rewarded` |
| `FREE_SESSIONS_PER_WEEK` | Optional. Defaults to `1`. |
| `PRO_PAYMENT_LINK` | Optional. Your Stripe Payment Link for LANZA Pro. Leave unset to hide Pro. |
| `PRO_PORTAL_URL` | Optional. Stripe customer portal link, so subscribers can cancel themselves. |
| `PRO_PRICE_LABEL` | Optional. The price shown on the button, for example `$2.99/month`. |
| `STRIPE_WEBHOOK_SECRET` | Needed with Pro. The signing secret of the Stripe webhook (starts with `whsec_`). |
| `USAGE_KEY` | Any long password. You type it on `/usage.html` to see usage numbers. |

4. **Fill in your contact email** in `privacy.html` (replace both `CONTACT_EMAIL`).

After changing environment variables, redeploy once (Deploys > Trigger deploy).

## Getting approved by Strava

New Strava apps can connect only a few athletes until Strava reviews them. The app already follows Strava's brand rules: the orange "Connect with Strava" button, "Powered by Strava" next to Strava data, "View on Strava" links, a privacy page, and a Disconnect button that revokes access.

1. Deploy the app and connect your own Strava account. Post 2 or 3 real sessions so there is something to show.
2. In https://www.strava.com/settings/api fill in:
   - **Application name:** LANZA. **Category:** Training. **Website:** your app address.
   - **Icon:** upload `icon-512.png`.
   - **Authorization Callback Domain:** your domain only, e.g. `lanza.netlify.app`.
3. Submit the review form linked on that page (Strava's "Developer Program" form). Useful answers:
   - What it does: "Throwing practice for Ultimate Frisbee players. After a session, it uploads one manual Workout activity with the score and stats to the athlete's own Strava account."
   - Scopes: `read` (name and photo in the app) and `activity:write` (post the session). The app never reads activities, routes or other athletes.
   - Data: the athlete's own sessions; privacy policy at `https://<your-app>/privacy.html`; athletes can disconnect and delete their backup in the app.
   - Expected athletes: your club or league size to start.
   - Screenshots: the You screen with the Connect button, a result screen after posting, and the post on Strava.
4. Optional: swap the drawn Strava button and "Powered by Strava" label for Strava's official image files from their brand guidelines page, if the reviewer asks.

## Making money

There are two switches. Both are off until you set them, and both can run together.

**Rewarded ads.** Each athlete gets `FREE_SESSIONS_PER_WEEK` free sessions a week; each extra one asks them to watch an ad first.
1. Get a Google Ad Manager account. It's free, but Google has to approve it and link it to AdSense. Then create a rewarded ad unit for web.
2. Set `AD_UNIT_PATH` to that unit and `ADS_ENABLED=true`, then redeploy.

If there's no ad to show, or no ad unit is set, a 15-second sponsor slot unlocks the session instead. That slot earns nothing, but athletes never get stuck.

**LANZA Pro (subscription).** Pro removes ads, makes sessions unlimited and unlocks coach view (each player's throws on the team board). Pro follows the athlete's Strava account to any phone.
1. In Stripe, create a product "LANZA Pro" with a monthly price, then a **Payment Link** for it. Under the link's After payment settings, choose "Don't show confirmation page" and redirect to `https://<your-app>/?pro=1`.
2. In Stripe > Developers > Webhooks, add the endpoint `https://<your-app>/.netlify/functions/stripe-webhook` with the events `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted`. Copy its signing secret.
3. Optional: turn on the Stripe customer portal and copy its login link.
4. Set `PRO_PAYMENT_LINK`, `STRIPE_WEBHOOK_SECRET`, and optionally `PRO_PORTAL_URL` and `PRO_PRICE_LABEL`, then redeploy. The Pro section appears in the You screen, on the ad screen and in coach view.

## Usage numbers

Open `https://<your-app>/usage.html` and type your `USAGE_KEY`. It shows the last 30 days: daily opens, installs, sessions, Strava posts, team joins, invite opens and Pro sign-ups, split by where people came from (`strava` for the link in Strava posts, `invite` for team invite links, or the website that sent them). Nothing identifies an athlete: only daily totals are stored.

## Updating the app

- Ask in the project chat. Claude edits the files and pushes them to GitHub, and Netlify deploys the new version.
- Before each release, bump `APP_VERSION` in `index.html` and `VERSION` in `sw.js`. Installed phones then pick up the new version. The app reloads into it only when no practice is running.
- Changes to the code never touch secrets, ad settings or team data. Secrets and switches live in Netlify environment variables, and team sessions live in Netlify Blobs.
- Athletes' own sessions are saved on their phone under storage keys starting with `kmos.`. Don't rename those keys. If the shape of the saved data changes, bump `DATA_VERSION` and add a step to `migrate()`, so old sessions are upgraded rather than lost.

## Rebranding

1. Change the colors and fonts in the **BRAND TOKENS** block at the top of the `<style>` in `index.html`.
2. Change the name, tagline and Strava signature in the `BRAND` object at the top of the script.
3. Replace `icon.svg` and the PNG icons, and update `name` and `short_name` in `manifest.webmanifest`.
4. Update the `<title>` and the logo text in the header.

## Scoring

The Skill Score is a 0–100 rating of how good a session was. It's the same everywhere: in the app, on the team board (the server recalculates it, so nobody can post a made-up number) and on Strava.

- **Accuracy (counted):** (makes + 5) ÷ (throws + 10). Short sessions sit near 50%, so a high score takes many throws made, not a lucky few. 9/12 counts as 64%, while 45/50 counts as 83%.
- **Target and distance:** the athlete hand-draws the target on a to-scale scene (person, 2 m net, 3.05 m hoop, tree), then picks a distance of 2–60 m (starts at 5 m). The size tier comes from the drawn area: under 3× a disc is pinpoint (×2.5), 3–8× chest (×1.8), 8–18× catch zone (×1.2), above that endzone (×0.8). Distance counts ×0.7 at 2 m, ×1.0 at 10 m and ×2.0 at 40 m and beyond.
- **Difficulty 1–10:** target size × distance × wind × wet disc, on a log scale. An endzone-sized target at 2 m, calm and dry, is 1. A pinpoint at 40 m+ in a gale with a wet disc is 10. Most sessions land between 3 and 7.
- **Score:** 100 × accuracy × (0.5 + 0.05 × difficulty). Difficulty only scales accuracy between half and full, so making your throws always matters most.

| Score | Meaning |
|---|---|
| 90–100 | World class |
| 80–89 | Elite |
| 65–79 | Sharp |
| 50–64 | Solid |
| 30–49 | Building |
| 0–29 | Warming up |

Examples:
- 9/12 at a catch-zone target, 21 m, cross wind: **48**
- 10/10 at an endzone target, 5 m: **44**
- 45/50 at a chest target, 20 m, breeze: **66**
- 20/20 at a pinpoint target, 30 m: **72**
- 50/50 at a pinpoint target, 40 m, gale, wet disc: **92**

Saved sessions are rescored automatically when the formula changes (DATA_VERSION in index.html).

## Strava posts

Once an athlete connects Strava (one time), every finished session posts itself as a Workout; they can switch this off on the result screen. Renaming the session or changing wind and ground afterwards updates the Strava post. The title is the name the athlete picks on the result screen. They can tap a quick name (Evening throwing session, Hucks, Blades, Lefties and so on) or type their own. The quick names are `BRAND.sessionNames` in index.html.

The description lists the Skill Score (with a PB note), makes and streak, distance and target, conditions, this month's team rank, and a link to the app. The link uses `BRAND.appUrl`, or the site address when that is empty.

Strava's API can't attach photos. Instead, the **Card** button (and **Add the photo card** after posting) saves a 1080×1350 session card that the athlete adds to the post (it also fits Instagram).

In the Strava API settings, upload `icon-512.png` as the app icon so the sign-in screen shows LANZA. New Strava API apps only connect a few athletes until Strava reviews them, so request the review in the Strava developer settings before inviting the team.

## Languages

The app speaks English, Spanish, Portuguese (Brazil), French, German, Italian, Dutch, Japanese, Chinese (Simplified and Traditional), Korean, Hebrew (right to left) and Hindi. On first launch it shows a language picker with the phone's language preselected; the globe button next to the logo changes it later. Voice logging listens for "make"/"miss" in the chosen language, and English words always work too.

All translations live in `i18n.js`. The English text in `index.html` is the key, so English needs no entry.

To fix a word: open `i18n.js`, find the English phrase under that language and change the translation. Keep anything in `{curly braces}` as it is.

To add a language: add an entry to `languages` (code, native name, locale, speech code, `match` prefixes, voice words, `dir: "rtl"` for right-to-left scripts) and a block in `strings` with every English phrase translated. `LANZA.phrases()` in the browser console lists the data words (throws, wind, bands). Phrases left out fall back to English.

## Known limits

- Anyone with a team code can read that team's board and post to it. Sessions posted with a connected Strava account are marked "Strava ✓".
- Voice tracking needs HTTPS and Chrome on Android or Safari on iPhone.
- The weekly session count is stored on each phone, so clearing the browser's data resets it.
