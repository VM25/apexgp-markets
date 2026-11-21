# Data sources: licences, terms and limits

Access date for everything below: **2026-11-21** (UTC). Every row was read from the
primary page named in the "Evidence" sections; nothing here is from memory unless it
is explicitly marked *unverified*. Evidence is given as short verbatim key phrases
(kept under 15 words each) plus the URL and where on the page it sits.

This is a research note, not legal advice. "OK for this project" means: a public,
non-commercial GitHub + Netlify portfolio project that redistributes small derived
JSON files and trades fictional capital only.

## Summary table

| # | Source | Code licence | Data licence / terms | Attribution | Rate limit (free, no auth) | Redistributing small derived JSON in this project |
|---|--------|--------------|----------------------|-------------|----------------------------|---------------------------------------------------|
| 1 | OpenF1 (`api.openf1.org`) | Repo `LICENSE` is CC BY-NC-SA 4.0 (GitHub reports "Other") | Site footer: CC BY-NC-SA 4.0; stated purpose is non-commercial analysis and fan use | FAQ says credits are not required; the CC licence itself asks for credit + licence link + change notice | 3 req/s and 30 req/min | **Restrictive: NC + SA.** OK if the project stays non-commercial, credits OpenF1, and the derived JSON is itself offered under CC BY-NC-SA 4.0. Historical data (2023+) only; live data is paid. |
| 2 | Jolpica F1 (`api.jolpi.ca/ergast/f1`) | Apache-2.0 | CC BY-NC-SA 4.0 (TERMS.md) | Required by the CC licence; no specific wording prescribed | Burst 4 req/s, sustained 500 req/h; custom User-Agent required | **Restrictive: NC + SA.** Same conditions as OpenF1. Commercial use needs contact / paid dump tier. |
| 3 | Kaggle "Formula 1 World Championship (1950 - 2020)" by rohanrao (title now reads "1950 - 2024") | n/a | Labelled **CC0: Public Domain** on Kaggle; content is compiled from Ergast, whose own terms were non-commercial | None required (CC0); Ergast asked for an optional "Ergast API" credit | n/a (file download; no-login download not verified, see below) | Permissive on its face. Caveat: the CC0 label is the uploader's; upstream Ergast terms were non-commercial. Safe here because the project is non-commercial anyway. Data stops at the 2024 season. |
| 4 | FastF1 (`theOehrly/Fast-F1`) | MIT | No licence granted over the data. Timing/telemetry comes from F1's live-timing archive, which **now requires an F1 TV login** | MIT notice only if the code is redistributed | n/a | **Do not use for timing/telemetry.** Needs a paid login (breaks the $0 / no-login rule) and the maintainer states F1's terms do not allow re-hosting. Only the Jolpica-backed results path is still free. |
| 5 | TUMFTM racetrack-database | LGPL-3.0 (whole repo, no separate data licence) | Same LGPL-3.0; centre lines derived from OpenStreetMap (ODbL) | Keep LGPL notice + credit TUMFTM; credit OpenStreetMap contributors | n/a (static files) | **Copyleft.** OK: ship derived track JSON under LGPL-3.0 with the licence text, a change note and the source link. 8 of 24 circuits on the 2025 calendar are missing. Geometry dates from mid-2020. |

**Restrictive (non-commercial + share-alike):** OpenF1, Jolpica. **Copyleft:** TUMFTM
(LGPL-3.0, plus ODbL upstream). **Unusable without paid login:** FastF1 timing data.
**Permissive label:** Kaggle CC0 (with the upstream caveat).

## What CC BY-NC-SA 4.0 asks for (applies to sources 1 and 2)

Read from the licence text shipped in the OpenF1 repo
(<https://github.com/br-g/openf1/blob/main/LICENSE>):

- NonCommercial is defined as "not primarily intended for or directed towards
  commercial advantage or monetary compensation" (Section 1(k)).
- Attribution (Section 3(a)(1)): identify the creator, keep the licence and warranty
  notices, link to the material, and "indicate if You modified the Licensed Material".
- ShareAlike (Section 3(b)): adapted material must go out under a CC licence "with the
  same License Elements", i.e. BY-NC-SA or a compatible one.

Practical consequence: any JSON derived from OpenF1 or Jolpica data that is committed
to the public repo should carry a `LICENSE`/`NOTICE` saying it is CC BY-NC-SA 4.0,
naming the two sources with links, and saying it was transformed. The application
*code* can stay under a different licence as long as the data files are marked
separately. Adding ads, paid tiers or sponsorship to the deployed site would put the
non-commercial condition in doubt.

Suggested credit line (my wording, not prescribed by any source):

> F1 timing data: OpenF1 (openf1.org), CC BY-NC-SA 4.0. Results and standings:
> Jolpica F1 (github.com/jolpica/jolpica-f1), CC BY-NC-SA 4.0. Track outlines:
> TUMFTM racetrack-database (LGPL-3.0), based on © OpenStreetMap contributors (ODbL).
> Unofficial; not associated with the Formula 1 companies. F1, FORMULA ONE and related
> marks are trade marks of Formula One Licensing B.V.

---

## 1. OpenF1

| Fact | Evidence (short quote) | URL |
|------|------------------------|-----|
| Historical data free without auth | "Historical data (from 2023 onwards) is free and accessible without authentication." | <https://openf1.org/docs/> (Introduction) |
| Live data is paid | "Real-time data requires a paid subscription" | <https://openf1.org/docs/> (Introduction) |
| What counts as live | "Data is considered live from 30 minutes before a session starts" (until 30 min after it ends) | <https://openf1.org/> (FAQ) |
| Free-tier rate limit | "Up to 3 requests per second and 30 requests per minute" | <https://openf1.org/> (Access & Support, Community tier) |
| Rate limit, FAQ wording | "The free tier allows 3 req/s and 30 req/min" | <https://openf1.org/> (FAQ) |
| Paid tier | Sponsor tier, EUR 9.90/month: live data over REST/MQTT/WebSocket, 6 req/s and 60 req/min | <https://openf1.org/> (Access & Support) |
| Licence shown on site | "Licensed under CC BY-NC-SA 4.0" | <https://openf1.org/> (footer) |
| Licence file in repo | First line: "Attribution-NonCommercial-ShareAlike 4.0 International" | <https://github.com/br-g/openf1/blob/main/LICENSE> |
| Intended use | "educational purposes, personal learning projects, research, and non-commercial fan engagement" | <https://openf1.org/> (FAQ) |
| Data statement | "intended solely for non-commercial analysis and fan engagement" | <https://openf1.org/> (footer) |
| Credit | "No, credits are not required in your project." (a link back is appreciated) | <https://openf1.org/> (FAQ) |
| Unofficial disclaimer | "OpenF1 is an unofficial project and is not associated in any way with the Formula 1 companies." | <https://openf1.org/docs/> (Introduction) |
| Trademark disclaimer | "All F1-related trademarks are owned by Formula One Licensing B.V." | <https://github.com/br-g/openf1/blob/main/README.md> (Disclaimer) |

Other checks made:

- GitHub's licence API reports `spdx_id: NOASSERTION` ("Other") for `br-g/openf1`
  (<https://api.github.com/repos/br-g/openf1>); the `LICENSE` file was last changed on
  2024-10-05 in the commit titled "Release v1.0".
- Live test, no auth, generic User-Agent: `GET https://api.openf1.org/v1/meetings?year=2025`
  returned HTTP 200 with 25 meetings (the 24 race weekends plus one extra Sakhir
  entry ahead of round 1, presumably pre-season testing).
- The `/docs/` page itself does not state the rate limit; it is on the home page.
- The docs note that team-radio coverage has dropped sharply from 2026.

Tension to be aware of: the FAQ says credits are optional, while the CC BY-NC-SA licence
named in the footer makes attribution a condition. Crediting is the safe reading.

## 2. Jolpica F1

| Fact | Evidence (short quote) | URL |
|------|------------------------|-----|
| Code licence | Apache License 2.0 (`LICENSE`; GitHub API `spdx_id: Apache-2.0`) | <https://github.com/jolpica/jolpica-f1/blob/main/LICENSE> |
| Data licence | "The data is licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International" | <https://github.com/jolpica/jolpica-f1/blob/main/TERMS.md> (1. Usage; last updated 2025-08-27) |
| Non-commercial | "The API is freely available for non-commercial use." | same, 1. Usage |
| Terms apply by use | "By using the jolpica-f1 API, you agree to our Terms of Use" | <https://github.com/jolpica/jolpica-f1/blob/main/README.md> |
| Burst limit | "Burst Limit: 4 requests per second" | <https://github.com/jolpica/jolpica-f1/blob/main/docs/rate_limits.md> |
| Sustained limit | "Sustained Limit: 500 requests per hour" | same |
| Limits will tighten | "These limits are subject to change, and will decrease in the future" | same |
| Over-limit behaviour | HTTP 429, body says the request was throttled; abuse can lead to blocking | rate_limits.md and TERMS.md (2. Fair Use) |
| User-Agent | "We require a custom user agent to be set when using our API." | <https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md> |
| Paging | `limit` defaults to 30, maximum 100; `offset` for paging | same |
| Bulk dumps, free tier | "Dumps available for download 14 days after they are uploaded", no auth, non-commercial | <https://github.com/jolpica/jolpica-f1/blob/main/docs/database_dumps.md> |
| Bulk dumps, paid tier | Supporter tier: latest dumps, licensed for commercial use, API key | same |
| No warranty | Volunteer-run; no guarantee of uptime or correctness | TERMS.md (3. Disclaimer) |

Live test: `GET https://api.jolpi.ca/ergast/f1/2025/races/?limit=100` and the 2026
equivalent both returned HTTP 200 without auth (24 and 23 races).

No attribution wording is prescribed; the CC BY-NC-SA conditions above apply. The
README still describes the API as the Ergast-compatible successor.

## 3. Kaggle: "Formula 1 World Championship (1950 - 2020)" (rohanrao)

| Fact | Evidence | URL |
|------|----------|-----|
| Licence on the dataset | `licenseName: "CC0: Public Domain"`; the page's JSON-LD `license` field carries the same label | <https://www.kaggle.com/datasets/rohanrao/formula-1-world-championship-1950-2020> and its public metadata endpoint `https://www.kaggle.com/api/v1/datasets/view/rohanrao/formula-1-world-championship-1950-2020` |
| Current title / coverage | "Formula 1 World Championship (1950 - 2024)"; subtitle "F1 race data from 1950 to 2024" | same |
| Version / date | Version 24, last updated 2025-01-29, about 22 MB | same (metadata) |
| Provenance | "The data is compiled from http://ergast.com/mrd/" | dataset description (Acknowledgements) |

Ergast terms (upstream). The live page `https://ergast.com/mrd/terms/` returned
**HTTP 404** on the access date, so this is from the Internet Archive copy of
2024-05-18: <http://web.archive.org/web/20240518210519/https://ergast.com/mrd/terms/>

| Fact | Evidence (short quote) |
|------|------------------------|
| Purpose | "a historical record of motor racing data for non-commercial purposes" |
| Permitted use | "personal, non-commercial applications and services including educational and research purposes" |
| No charging | "you must not charge for any application or service which makes use of this API" |
| Ad-supported sites | "Use by websites and applications supported by advertising is permitted." |
| Attribution | "You are not required to attribute this site" (a link to `http://ergast.com/mrd` is described as ideal) |
| Rate limit (historic) | no more than "four times per second or more than 200 times per hour" |

Notes:

- The CC0 label is whatever the uploader selected; it cannot grant more than the
  upstream allowed. For a non-commercial project the difference does not bite.
- Not verified: whether the CSV archive can be downloaded without a Kaggle login. An
  unauthenticated `HEAD` on the API download path returned HTTP 404; I did not
  attempt a download or sign in.
- Because the dataset ends at 2024, Jolpica is the route for 2025-2026 results.

## 4. FastF1

| Fact | Evidence (short quote) | URL |
|------|------------------------|-----|
| Code licence | "MIT License", "Copyright (c) 2026 Philipp Schäfer" | <https://github.com/theOehrly/Fast-F1/blob/master/LICENSE> |
| Unofficial notice | "unofficial and are not associated in any way with the Formula 1 companies" | <https://github.com/theOehrly/Fast-F1/blob/master/README.md> (Notice) |
| Results source | README lists full support for the Ergast-compatible jolpica-f1 API | same (Main Features) |
| Archive locked | Issue title: "livetiming.formula1.com/static archive returns 401 since ~15 Oct 2026" | <https://github.com/theOehrly/Fast-F1/issues/978> (opened 2026-10-16, still open) |
| When | Reporter narrows it to between 14 Oct 2026 ~18:30 UTC and 15 Oct 2026 20:00 UTC; a second user confirms downloads worked on 14 Oct and failed from 15 Oct | issue body and first comment |
| Scope | All seasons affected (2021 and 2024 files also 401); response is generated at the CloudFront edge; the FastF1 mirror only has 2021-2022 indexes | issue body and first comment |
| Maintainer confirmation | "F1 does now require authentication for accessing the livetiming archive data." | <https://github.com/theOehrly/Fast-F1/issues/978#issuecomment-6252884330> (2026-10-18) |
| What is now needed | An F1 TV Access subscription or higher tier | same comment |
| What stays free | Results data via Jolpica-F1 | same comment |
| Library response | v3.9.0a0 (2026-10-18) added authenticated access; stable release announced 2026-10-24 | <https://github.com/theOehrly/Fast-F1/pull/981> and later comments on #978 |
| Re-hosting | "Terms and conditions do not allow rehosting the data like this." | <https://github.com/theOehrly/Fast-F1/issues/978#issuecomment-6587808886> (2026-11-02) |
| Related | CI runners get a CloudFront 403 even with a valid token | <https://github.com/theOehrly/Fast-F1/issues/988> (title only read) |

Own check on the access date: `GET https://livetiming.formula1.com/static/2025/Index.json`
with a generic User-Agent and no credentials returned **HTTP 401**, matching the issue.

Consequence for ApexGP: FastF1 cannot supply lap timing or telemetry within the
no-login / $0 constraints, and cached F1 timing data should not be committed to the
repo. OpenF1 (2023+) is the remaining free route for lap and stint data.

## 5. TUMFTM racetrack-database

| Fact | Evidence (short quote) | URL |
|------|------------------------|-----|
| Licence | "GNU LESSER GENERAL PUBLIC LICENSE, Version 3" (GitHub API `spdx_id: LGPL-3.0`); no separate data licence | <https://github.com/TUMFTM/racetrack-database/blob/master/LICENSE> |
| Content | "center lines (x- and y-coordinates), track widths and race lines for over 20 race tracks" | <https://github.com/TUMFTM/racetrack-database/blob/master/README.md> |
| File format | `tracks/*.csv` columns: `x_m, y_m, w_tr_right_m, w_tr_left_m` | same (Content and Data Format) |
| Upstream source | "fetched as GPS points from the OpenStreetMap project" | same (Data Source and Processing) |
| Quality warning | source quality "varies greatly depending on the location" | same |
| OSM licence | "licensed under the Open Data Commons Open Database License (ODbL)" | <https://www.openstreetmap.org/copyright> |
| OSM credit | free to use "as long as you credit OpenStreetMap and its contributors" | same |
| Age of the data | Last commit touching `tracks/`: 2020-06-04 ("Added IMS"); first: 2020-05-06 | <https://api.github.com/repos/TUMFTM/racetrack-database/commits?path=tracks> |

### Exact contents of `tracks/` (25 files)

Read from <https://api.github.com/repos/TUMFTM/racetrack-database/contents/tracks>:

`Austin.csv`, `BrandsHatch.csv`, `Budapest.csv`, `Catalunya.csv`, `Hockenheim.csv`,
`IMS.csv`, `Melbourne.csv`, `MexicoCity.csv`, `Montreal.csv`, `Monza.csv`,
`MoscowRaceway.csv`, `Norisring.csv`, `Nuerburgring.csv`, `Oschersleben.csv`,
`Sakhir.csv`, `SaoPaulo.csv`, `Sepang.csv`, `Shanghai.csv`, `Silverstone.csv`,
`Sochi.csv`, `Spa.csv`, `Spielberg.csv`, `Suzuka.csv`, `YasMarina.csv`, `Zandvoort.csv`

### Coverage of the 2025 F1 calendar

Calendar read from Jolpica (`/ergast/f1/2025/races/`, 24 rounds).

| Rd | Grand Prix | Jolpica circuitId | TUMFTM file |
|----|------------|-------------------|-------------|
| 1 | Australian | albert_park | Melbourne.csv |
| 2 | Chinese | shanghai | Shanghai.csv |
| 3 | Japanese | suzuka | Suzuka.csv |
| 4 | Bahrain | bahrain | Sakhir.csv |
| 5 | Saudi Arabian | jeddah | **missing** |
| 6 | Miami | miami | **missing** |
| 7 | Emilia Romagna | imola | **missing** |
| 8 | Monaco | monaco | **missing** |
| 9 | Spanish | catalunya | Catalunya.csv |
| 10 | Canadian | villeneuve | Montreal.csv |
| 11 | Austrian | red_bull_ring | Spielberg.csv |
| 12 | British | silverstone | Silverstone.csv |
| 13 | Belgian | spa | Spa.csv |
| 14 | Hungarian | hungaroring | Budapest.csv |
| 15 | Dutch | zandvoort | Zandvoort.csv |
| 16 | Italian | monza | Monza.csv |
| 17 | Azerbaijan | baku | **missing** |
| 18 | Singapore | marina_bay | **missing** |
| 19 | United States | americas | Austin.csv |
| 20 | Mexico City | rodriguez | MexicoCity.csv |
| 21 | São Paulo | interlagos | SaoPaulo.csv |
| 22 | Las Vegas | vegas | **missing** |
| 23 | Qatar | losail | **missing** |
| 24 | Abu Dhabi | yas_marina | YasMarina.csv |

**Not covered for 2025 (8 of 24):** Jeddah, Miami, Imola, Monaco, Baku, Marina Bay
(Singapore), Las Vegas, Lusail (Qatar). Covered: 16.

For the 2026 calendar as Jolpica lists it (23 rounds): the missing set is Miami,
Monaco, Madrid (`madring`), Baku, Marina Bay, Las Vegas and Lusail (7 of 23). Sepang,
which Jolpica lists for 2026 round 16, is covered by `Sepang.csv`.

Caveats:

- All geometry was committed in May-June 2020, so any circuit reconfigured since then
  is not reflected. *Unverified recollection, check before use:* Albert Park, Yas
  Marina, Catalunya and Zandvoort have had layout changes since 2020, and the README
  lists Zandvoort as a DTM track.
- LGPL-3.0 is a software licence applied to a data repo. Treat derived track JSON as
  a modified version: keep it under LGPL-3.0, ship the licence text, state what was
  changed, and link the source. Add the OpenStreetMap credit, since the centre lines
  originate there.
- For the 8 missing circuits another outline source is needed. OpenF1's `location`
  endpoint (car x/y positions, about 3.7 Hz per its docs) can be used to trace one
  from a historical session, which then falls under CC BY-NC-SA 4.0.

---

## Things I could not verify

- Whether the Kaggle archive downloads without a login (not attempted beyond a `HEAD`).
- What licence the OpenF1 repo carried before its 2024-10-05 `LICENSE` change.
- Which TUMFTM circuits have changed layout since 2020 (flagged above as recollection).
- F1's own live-timing terms were not read directly; the re-hosting statement is the
  FastF1 maintainer's reading in issue #978.
