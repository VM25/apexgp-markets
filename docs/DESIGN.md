# Design

## Brief

The interface had to be unrecognisable against the June 2026 terminal, credible as a financial product, clearly about motorsport, readable for long analytical sessions, and fully usable on a 320 px phone. It also had to solve one specific problem the old one never addressed: a visitor must be able to tell at a glance which numbers are recorded history, which are a model's estimate, which are a simulated quote, and which are their own trades.

## Three directions

### A. Timing Sheet — *chosen*

Warm paper, black ink, hairline rules; an expanded grotesque for headings, a monospace for every number, a serif for long-form explanation. The reference is the printed timing sheet and the pit-wall strategy printout: ruled rows, tabular figures, a lap ruler as the time axis. Colour is not decoration; each hue is a provenance channel.

### B. Night Race

Near-black surfaces, sodium-amber and track-light accents, broadcast-style glow. Dramatic and on-theme.

### C. Broadcast

Bold colour blocks in team liveries, condensed italics, big position numerals — the grammar of a TV graphics package.

### Evaluation

| Criterion | A. Timing Sheet | B. Night Race | C. Broadcast |
|---|---|---|---|
| Originality against v2 | Opposite in every respect (light, ruled, typographic) | Closest to the old dark terminal | Different, but familiar from TV |
| Financial credibility | Reads like a research document | Reads like a crypto dashboard | Reads like a sportsbook |
| Motorsport character | Timing-sheet idiom, lap ruler, tyre and flag conventions | Strong | Strongest |
| Ease of understanding | Calm hierarchy, labelled provenance | Glow competes with data | Loud |
| Data readability | High contrast, tabular figures | Good, harder for long sessions | Team colours fight semantic colours |
| Responsiveness | Rules and rows collapse naturally | Fine | Large blocks are hard at 320 px |
| Accessibility | AA contrast straightforward on paper | Needs care with glows | Colour-dependent |
| Sustained analytical work | Best | Fatiguing | Poor |

B was rejected for being a better-looking version of what was replaced; C because livery colours would collide with the provenance colours the product depends on, and because it promises entertainment where the product delivers analysis.

## The system

**Colour** (`src/app/globals.css`, `@theme`)

| Token | Value | Meaning |
|---|---|---|
| `paper`, `paper-2`, `paper-3`, `sheet` | `#f3efe6` … | surfaces |
| `ink`, `ink-2`, `ink-3` | `#14161a`, `#454952`, `#5c6068` | **recorded** data and text |
| `model` | `#2447d5` | **estimated**: every model probability |
| grey band | ink at 10–15% | **simulated**: the dealer's bid–ask |
| `you` | `#c23412` | **yours**: orders, fills, the primary action |
| `gain` / `loss` | `#14774a` / `#b8322a` | profit and loss, nothing else |
| flag colours | green, yellow, amber, red | track status, as on a circuit |
| hatch | 45° lines | hypothetical outcomes (the risk histogram, the review banner) |

**YES is solid, NO is hollow.** Side is never encoded in colour — a filled chip or button is YES, an outlined one is NO — which leaves green and red free to mean profit and loss and keeps the interface usable without colour vision.

**Type.** Archivo (variable width; headings set at 125% width, 800 weight, upper-case), IBM Plex Mono (all figures, labels, codes), Newsreader (explanatory prose). Smallest label is 10.5 px; data 12.5–14 px; body 13.5–15 px; long-form 17.5 px.

**Layout.** Rules, not cards: sections open with a heavy rule, an index number and a title. Corners are square. A faint 32 px drafting grid sits behind everything. Content width is capped at 1,760 px and centred, so a 2,560 px display gains margins rather than stretched tables.

**The clock strip and lap ruler.** One market clock for the whole product, always on screen: round, lap, track status, transport. The lap ruler — one tick per lap, hatched bands for safety cars, markers for your fills — is the shared time axis of the strip, the race view and every chart.

**Motion.** A staggered rise on page load, a linear glide of the ruler cursor and of cars on the gap map, a sheet sliding up on phones. Nothing loops except the "busy" dot. `prefers-reduced-motion` removes all of it.

**Wordmark.** A black square with a racing line clipping an apex marked in the action colour; "APEX" in ink, "GP" in the action colour.

## Composition by size

| Width | Shell | Markets | Race |
|---|---|---|---|
| < 640 | Icon-only mark, clock strip with play and step, bottom tab bar | List; a contract opens as a bottom sheet with chart, ladder and ticket | One pane at a time (Timing · Map · Chart · Events); speed and "to flag" under the header |
| 640–1023 | Adds wordmark, speed, lap ruler (from 768) | Same, wider rows with sparklines | Same |
| 1024–1535 | Top navigation, account summary, full strip | List beside a sticky detail panel; ticket under the chart, beside the ladder from 1280 | Timing beside contenders and map; positions and events below |
| ≥ 1536 | Same | Same | Three columns with a sticky positions/events rail |

Tables that cannot fit scroll inside their own focusable region; the page itself never scrolls sideways. On phones the lowest-value columns are dropped first (bid, wins, sparkline) and row actions shrink to a 34 px target.

## Interaction rules

- Every control does something real; there are no decorative buttons.
- Orders take two presses: *Review* shows exactly what will happen, *Confirm* does it. Changing any field disarms the confirm.
- Rejections explain themselves in a sentence and say what to do instead.
- Explanations sit behind an ⓘ that opens on tap, click or keyboard and closes on Escape or an outside press. Nothing depends on hover.
- Empty states say how to fill them. Errors say what failed and offer a retry; a rendering fault in one view leaves the session untouched.
- The review mode is visibly different (hatched banner) and has no trade controls at all.

## Accessibility

Target WCAG 2.2 AA. Verified by an automated axe scan of all five views at 390 px and 1,440 px with zero violations (`tests/e2e/a11y.spec.ts`), plus keyboard, focus and reduced-motion tests. Specifics: skip link; visible focus ring; native `<dialog>` for modals (focus trap, Escape); labelled form fields; `aria-current` on navigation; charts expose a text summary and are keyboard-inspectable; every scrollable region is focusable and named; touch targets ≥ 24 px (primary controls 44 px, compact row actions 34–36 px); text ≥ 4.5:1.
