# Singularity Inc. — Economy & Balance

All numbers live in `js/config.js`. This document records the final tuning and
the reasoning. The curve was validated with a greedy progression simulation
(`tmp/econ_sim.js`).

## Core formulas

- **Generator cost** (cumulative for buying `q` units from `owned`):
  `cost = baseCost · growth^owned · (growth^q − 1) / (growth − 1)`
- **Generator output:** `baseOut · count · milestoneMult(count) · perTierUpgrades
  · managerMult · globalMult`
- **Milestone multiplier:** ×2 at each of `[10, 25, 50, 100, 150, 200, 300, 400, 500]`
  owned (compounding).
- **Global multiplier:** `rpMult · prestigeUpgradeMults · allUpgradeMults ·
  boost · incidentPenalty`, where `rpMult = 1 + RP · 0.05`.
- **Tap value:** `TAP.base(2) · tapUpgrades · globalMult`.
- **Prestige RP gain:** `floor( K · sqrt(totalEarnedThisRun / SCALE) )`
  with `K = 1.4`, `SCALE = 1e6` (R11: K raised 1.0→1.4 so the first release lands
  in-window with a juicy reward; Singularity threshold raised to compensate).

## Generators (10 tiers)

| # | id | baseCost | growth | baseOut/sec |
|---|----|---------:|-------:|------------:|
| 1 | laptop | 15 | 1.070 | 0.10 |
| 2 | gpuRig | 110 | 1.075 | 1.0 |
| 3 | serverRack | 1.2K | 1.080 | 8.0 |
| 4 | gpuCluster | 13K | 1.085 | 47 |
| 5 | dataCenter | 140K | 1.090 | 260 |
| 6 | superComp | 1.6M | 1.095 | 1,400 |
| 7 | neuroArray | 20M | 1.100 | 7,800 |
| 8 | quantumNode | 330M | 1.105 | 44,000 |
| 9 | orbital | 5.1B | 1.110 | 260,000 |
| 10 | agiCore | 75B | 1.120 | 1,600,000 |
| 11 | dysonSwarm | 1.1T | 1.125 | 9,500,000 |
| 12 | matrioshka | 17T | 1.130 | 58,000,000 |

Growth rises with tier (1.07 → 1.13) so higher tiers stay aspirational. Tiers
11–12 are post-AGI mega-structures that extend the ceiling for long-term players
without changing the validated early/mid curve (they are only reachable after
several prestiges).

## Prestige

- RP gain `floor(sqrt(totalEarnedThisRun / 1e6))`.
- Each RP: **+5% global output** (passive, based on current RP held).
- Permanent research (RP cost): globalx2 (5), globalx3 (50), globalx5 (500),
  tapx10 (10), +4h offline (25), alignment suppression x2 (20), start-cash 1M (40),
  **globalx10 (5000)**, **+12h offline (200)**, **start-cash 1B (1500)**.
  (10 permanent upgrades total; the last three deepen the long-term loop.)

**Simulated progression (from the validated sim):**
- First run reaches ~125K/sec and ~109M total at 60 min.
- First prestige worth ≥1 RP at ~20 min, ≥5 RP at ~45 min, **~10 RP at 60 min** —
  i.e. the first meaningful prestige lands in the intended 30–60 min window.
- Carrying 10 RP (×1.5 global), the next run hits ~30 RP by 60 min — the loop
  accelerates without trivial runaway and without dead walls.

## Risk / Alignment (signature mechanic)

- `risk ∈ [0, 100]`. `dRisk/sec = GAIN(0.55) · log10(cps+10)/CAP_DIV(3) −
  align · SUPPRESS(0.20) · alignBoost`.
- Alignment cost: `200 · 1.18^owned`.
- At **risk ≥ 100** → **misalignment incident**: output **×0.2** for **90s**, or
  pay **35% of current cash** to contain instantly; risk resets to 35 afterwards.
- UI warns above 75%.

Tension: scaling fast raises capability → risk climbs; the player must divert
cash/RP into alignment or eat an incident. This is the decision layer on top of
"numbers go up."

## Random world events

Every **150–300s** (no earlier than 75s of play, never overlapping a timed one)
one of five events fires, each with RU+EN copy and a toast + top badge:

| id | kind | effect |
|----|------|--------|
| Research Grant | instant | +10 min of current production as cash |
| AI Hype Cycle | timed 60s | output ×2 |
| GPU Shortage | timed 45s | output ×0.5 |
| Data Leak | instant | Risk +25 (can trigger an incident) |
| Open-Source Release | instant | Risk −30 |

Events add light variance and interact with the Risk system (a Data Leak during
a high-risk push can tip you into an incident).

## Active-play / viral mechanics (Round 3)

- **Overclock heat (tap combo):** each tap adds +0.085 heat (cap 1.0), decaying
  0.40/sec. Tap value is multiplied by `1 + heat·4` → up to **×5** while hot.
  Rewards active tapping bursts; drives the TRAIN button's heat glow.
- **Insight Flash** (golden-cookie hook): a glowing collectible spawns every
  **45–95s** (first after 40s) and stays **13s**. Tapping it grants one of:
  *Frenzy* (×7 output, 30s), *Click Frenzy* (×100 tap value, 15s), or *Eureka*
  (instant 15 min of income). Signature active-play hook.
- **Breakthrough** (active, chainable): ×10 output for 20s, **180s** cooldown.
  Re-firing within **8s** of the previous one ending chains it to **×15 for 25s**.
- **Milestone ×2** (AdVenture-Capitalist style): every 25/50/100/150/200/300/
  400/500 owned doubles that generator permanently (already in the curve), now
  with an icon color-shift (cyan→gold→white glow at 25/100/200) + celebratory pop.

All multipliers stack multiplicatively with prestige/upgrades but are time-boxed,
so they spike engagement without breaking the long-term curve. RU+EN copy for all.

## Endgame / meta-progression (Round 4)

- **Tech Tree** (12 techs, RP-cost 12→2000, gated by tech/generator reqs):
  category multipliers — tap ×3/×5, early/mid/late hardware ×2/×2/×3, all ×1.5/×2/×3,
  offline ×2/×3, risk ×0.7/×0.5. Persists across model-release; resets on Singularity.
- **Artifacts** (9, granted 1 per model-release, equip up to 3): effects all×1.10–1.15,
  tap×3, late-hw×1.25, risk×0.70–0.80, offline×2, plus a gamble (×0.6–3.0). Each tag
  shared by ≥2 equipped artifacts → **+20% all per matched tag** (build-crafting).
- **The Singularity** (2nd prestige): unlocks at **500 lifetime RP** or first **AGI Core**.
  Cores = `floor(sqrt(RP / 100) × coreGain)`; each Core **+10% global forever**; resets
  generators + tech + RP. 8-node Core meta-tree (Cores): global ×3/×5/×10, RP-gain ×2,
  tap ×10, risk ×0.5, +24h offline, core-gain ×2 — permanent, never reset.

**Balance audit (sim with all mechanics):**
- Fresh 30-min run yields ~2 RP → first prestige lands in the **30–45 min** window.
- First Singularity ≈ **10 prestiges / ~5h active** (faster with offline + ads + insight/
  breakthrough) — a meaningful long-term goal, no dead wall.
- Dual unlock path (500 RP *or* AGI Core) keeps it reachable for both idle and active styles.
- No runaway: deep-run cps stays finite (≈55B in a boosted 1h run); numbers format
  cleanly into the suffix/scientific range.

## Deep playtest (Round 5 — bot drives the real engine)

A bot (`tmp/playtest.js`) plays the actual `game.js` with every mechanic active
(tap+combo, generators, milestone ×2, upgrades, tech, prestige, artifacts+synergy,
Singularity, risk/incidents, insight, breakthrough, events). Findings + fixes:

- **Hook (first 60s):** strong — ~3K cash and the first generator within the first
  minute; tap value scales with combo so early tapping feels good. ✓
- **First prestige:** RP≥5 reached ~9–30 min depending on play intensity; the
  natural first prestige lands when growth walls (~30 min). ✓
- **Both prestige layers reachable:** Singularity reached in active play; cores
  accrue steadily (no dead end). ✓
- **Mid-game wall (fixed):** the sim exposed a stretch (~30 min) where the next
  generator tier is far off. This is the *intended* first-prestige trigger — so the
  fix is signposting, not flattening the curve: a **next-goal nudge** now tells the
  player exactly what to do ("Growth is slowing — release a model for +N RP"),
  eliminating the "lost at the wall" problem. The nudge also surfaces affordable
  upgrades, near milestones (≤5 away), risk/incident warnings, and Singularity
  readiness, in priority order.
- **No trivialize:** insight/breakthrough/combo are time-boxed multipliers that
  accelerate without breaking the curve; deep-run numbers stay finite.

## Management-sim layer (Round 7)

- **Multi-vector risk** (replaces the single spam-defeatable bar): Capability (output
  growth), Privacy/Data (data-heavy gens), Public Trust/Regulatory (hype + a +11 spike
  per prestige), Security (accrues over time). Alignment investment suppresses ALL
  vectors' growth (full on Capability, 50% on the rest). **No instant pay-to-clear** —
  the reactive **Audit** only lowers the highest vector, costs 18% cash, 120s cooldown.
  A maxed vector → output crisis. **The tap-to-zero exploit is removed** (verified in
  the smoke suite: no `containIncident`; audit enforces a cooldown).
- **Crises** are decision cards (gated to post-first-prestige): 4 types, each 2–3
  tradeoff choices (pay cash / accept regulatory / accept an output crisis). Ignored
  crises **escalate** (output penalty + −8 Trust + the vector jumps back up).
- **News & Decisions / Trust**: news/opportunity cards spawn every 70–140s; choices
  move **Trust** (0–100, starts 60), which gates content (e.g. the government contract
  needs Trust ≥ 70). One-time opportunities (chip drop = +5% permanent output, raise a
  round = cash) are time-limited.
- **Market**: 4 assets (CMP/NVX/DTA/ALN), random-walk prices (ALN low-vol), 1% trade
  fee, buy 10%-of-cash / sell-all. A bonus skill layer — the fee + volatility keep it
  from being a risk-free exploit.
- **Gating**: early game is just tap→buy. The World tab (Newsroom + Market), Trust HUD,
  and crisis *cards* all unlock at the **first prestige**, each with a one-line hint.
- Sim with everything active: hook strong (~3.7K @60s), both prestige layers reachable,
  **no runaway** (deep-run cps finite), no new exploit.

## Progressive unlock & prestige rework (Round 11)

Two core-design fixes: (1) stop dumping every system on the player at once, and
(2) make prestige *obviously* worth it.

### Player journey — one deliberate, sticky unlock schedule

All gates are monotonic on lifetime metrics, so a revealed feature never re-hides
(even across a release). The **bottom nav shows only unlocked tabs** (Stage 1 = Lab
+ More→Settings). Each unlock fires one skippable `state.seen` hint, in order.
Returning saves silently mark already-satisfied reveals (no retroactive spam).

| Stage | Name | Trigger | Reveals |
|------|------|---------|---------|
| 1 | Garage | fresh save | TRAIN, cash, **one** generator (laptop), buy ×1. Nothing else — no tabs beyond Lab+Settings, no risk bar, no buy-modes. |
| 2 | Scaling | next gens within reach (cash ≥ ½ cost or prev tier ≥10); earned ≥250 / ≥500 / ≥1.5K / ≥25K | next generators, **buy ×10/×100/Max**, milestone ×2 (first-milestone hint), **Upgrades** tab, **Insight Flash**, **Breakthrough** |
| 3 | Automation | earned ≥60K | **Managers**; **Autopilot** stays at the existing first-release gate |
| 4 | First Release | `prestigeGain ≥ FIRST_RP(5)` (~35–40 min) | guided celebratory **"Release a Frontier Model"** CTA on the Lab that *teaches* the loop; afterward the **Research** tab + RP |
| 5 | Risks of Scale | first release (`prestiges ≥ 1`) | multi-vector **Risk**, **Alignment** tab, **Crises** (decision cards). Risk does not accrue and crises cannot fire before this. |
| 6 | The Industry | `prestiges ≥ 2` or `totalRP ≥ 70` | **World** tab — Newsroom, **Trust** HUD, **Market**, rival labs |
| 7 | Endgame | `totalRP ≥ 700` or first AGI Core | **Singularity**, **Artifacts**, **Endings/Race** |

Audit: a brand-new save shows ONLY Stage-1 UI (verified headless at 360/390/414 —
nav `[Lab, More]`, one generator, no risk bar, no buy-modes, no other tabs).

### RP made obviously worth it

- **Baseline passive (the headline):** each RP = **+5% global output, FOREVER**
  (`rpMult = 1 + RP·0.05`). The release screen shows it LOUD: *"+X% output now (→
  +Y% total, permanent) · Next model ~S× faster to here"*, and on release a gold
  toast confirms *"Output permanently +Z%"*. No more "got RP and nothing."
- **First release is taught + rewarding:** the CTA only appears once the gain is
  juicy (≥5 RP, ~35–40 min) — enough to buy the first ×2 upgrade *and* feel the
  passive. A one-time teaching panel explains "reset, but come back permanently
  stronger & faster — the heart of the game."
- **Flat starting-cash items REMOVED** (`p_start` 1e6, `p_start2` 1e9 — meaningless
  once you earn them in seconds). Replaced with **scaling/structural** boosts:
  - **Seed Capital** (`p_seed`, 40 RP): start each release with **5%** of your best
    run's earnings — scales forever.
  - **War Chest** (`p_seed2`, 1500 RP): **25%** of best run.
  - **Legacy Hardware** (`p_keepgen`, 120 RP): keep **10%** of every generator's
    level on release — structural compounding, never a flat pittance.
  - Multipliers/tap/offline/align upgrades retained.
- **Two layers stay distinct:** Research/RP = the *frequent* reset (permanent
  multipliers, done often); Singularity/Cores = the *rare, deep* reset (also resets
  RP, for the stronger meta-currency). Each screen states its own one-line purpose.

### Safe save migration (SAVE_VERSION 3)

- `p_start`→`p_seed`, `p_start2`→`p_seed2` (grandfathered to the equal-or-better
  scaling items — never robbed). `bestRunEarned` seeded from the current run so %
  start-cash has a baseline. RP and all other purchases preserved. Verified by
  `tmp/r11_test.js` (load a v2 save with the old items → mapped, RP intact, not broken).

### Tuned numbers (validated)

- `econ_sim`: first release **≥5 RP at ~35 min**, ~9 RP at ~45 min (in the 30–45
  window); ~8 releases to Singularity (threshold 700) ≈ a healthy long-term arc.
- `bestRunEarned`-based start-cash can never exceed a fraction of what you already
  earned, so it's a head-start, not a printer (no runaway; deep-run cps finite).

## Offline

- Earns **50%** of current cps for elapsed time, capped at **8h** (+4h per
  Always-On Inference research). Rewarded ad **doubles** the collected amount.

## Ad boosts (all degrade gracefully without SDK)

- Rewarded: **2× revenue for 2h**, or instant cash = **10 min** of production,
  or double offline earnings.
- Interstitial: on prestige, min **120s** cooldown.
- Sticky banner: shown when available.

## Round 13 — Fun & Balance audit (deep multi-persona sim + economy hardening)

A headless harness (`tmp/harness.js` + `tmp/sim.js`) drives the **real engine**
under a virtual clock and plays the full arc as three personas, so every number
below is measured from the shipping economy, not estimated. Probes:
`tmp/risk.js` (alignment teeth), `tmp/mkt.js` (market printer).

### Money printers found & closed (the headline fixes)

1. **Market money printer — CRITICAL.** The old mean-reverting market let a
   patient trader compound the reversion edge: a perfect 4h bot turned a 1M
   bankroll into **25,361×**. A mean-reverting bounded market is *provably*
   exploitable (buy-below-anchor has positive expectation; reinvestment
   compounds it). **Fix:** made it a **driftless bounded random walk**
   (`REVERT 0.06→0`), real fee (`FEE 1.5%→4%/side`), tighter visible band
   (`BAND 0.55→0.25`). Now there is **no statistical edge** — buy-low/sell-high
   is a coin-flip that loses to the fee. Perfect-bot 4h result: **~2–3×**
   (flavor-tier; a normal player nets ~neutral). It can never fund the economy.
2. **World `cashGift` printer.** News/opportunity cards paid `cps × seconds`
   with values up to **6000s = 100 min** of production, scaling with cps and
   resolved every ~2 min → **625B** of free cash in one optimizer arc, collapsing
   the mid-game. **Fix:** cut values to thematic windfalls (raise-a-round 240s,
   grant 300s, defense 420s, viral 180s, data-sale 120s), spaced news out
   (`70–140s → 100–180s`), and **capped each gift at 4% of best proven run**
   (`CARDS.CASHGIFT_CAP_FRAC`).
3. **Buff-amplified windfall printer.** "X seconds of production" windfalls used
   *current* cps, so claiming an Insight *Eureka* during a stacked ×15
   Breakthrough + ×7 Frenzy paid ×105-inflated cash that compounded (**24.5
   Qi** free cash in one arc). **Fix:** all windfalls (Eureka, event grant, ad
   cash, cashGift) now use **`baseCps()`** — transient buffs stripped — and are
   capped at **8% of best run** (`WINDFALL.CAP_FRAC`). Free cash per arc dropped
   to the low millions.

### Prestige-loop runaway — tamed

After the printers were closed, the optimizer still hyper-accelerated (Singularity
in ~16 min) via cross-run launchpads. Reduced them so reruns are a *head-start*,
not a cannon: `p_seed` start-cash **5%→3%**, `p_seed2` **25%→10%**, `p_keepgen`
**10%→6%**; raised the Singularity gate **700→1200 lifetime RP**. The loop still
*accelerates* (each run faster) without the cps exploding into nonsense ranges.

### Risk/Alignment — from "5-and-done" toggle to ongoing decision

The probe showed **5 cheap alignment buys** zeroed all risk for an hour — the
signature mechanic was trivially switch-off-able, and ignoring it spammed **28
crises/hour** (naggy). **Fix:** per-unit suppression **0.20→0.12** (alignment is
now an investment that scales with your capability — ~9 units at 1M cps, more as
you grow), cost growth softened **1.18→1.16** so ongoing funding stays affordable,
and crisis cadence spaced out (`CRISIS_CD_BASE 130→165`, `MIN 65→95`). Funding vs
ignoring is now a real cash-vs-output / interruptions tradeoff.

### Multi-persona pacing (measured, post-tuning)

Time-to-beat (active **Casual** = 4 taps/s + manual buys; **Idle** = autopilot,
2-min-active / 8-min-away cycles, light taps):

| Beat | Casual (active) | Idle (low-effort) |
|------|----------------:|------------------:|
| First generator | 0s | seconds |
| First milestone ×2 (10 owned) | ~13s | <2m |
| Buy-modes unlock (250 earned) | ~15s | a few min |
| Upgrades tab (500) | ~29s | — |
| Insight Flash (1.5K) | ~1m | — |
| Breakthrough (25K) | ~2.5m | — |
| Managers (60K) | ~3m | — |
| **First prestige ready (≥5 RP)** | ~6 min | **~26–32 min** |
| First Singularity | ~22 min (try-hard) | **~1h40m–2h13m (6–9 prestiges)** |

- **Hook (first 60s):** strong — a generator in the first second, first ×2
  milestone ~13s, cash building from taps+combo. ✓
- **First 10 min:** continuous unlocks + the next-goal nudge → never idle, never
  lost. (Engaged players blow through the early unlock ladder fast — brisk, not a
  slog. The idle path spreads the same beats over ~30 min.)
- **No walls:** prestige cadence stays every few minutes; the nudge always points
  at the next action.
- **First prestige** lands in the intended **30–45 min** window for realistic
  (idle/casual) play; try-hards can reach it sooner — a fair reward for effort.
- **Offline vs active:** windfalls are capped to proven earnings and offline is
  50%-rate capped, so active play (catching Insight, timing Breakthrough,
  managing crises) stays meaningfully ahead without trivializing idle return.

### Verdict

No money printers, no infinite/instant paths, no dead walls; the prestige loop
accelerates without exploding; the management layer is a genuine (if light)
decision rather than filler. Honest caveat: a *frame-perfect* optimizer still
reaches the first Singularity unusually fast (~22 min) — that is an upper bound no
human/autopilot buy-rate achieves, and the realistic arc (≈2h, 6–9 prestiges) is
healthy. The biggest remaining lever for "flagship" is **long-tail depth past the
first Singularity** (Cores/endings pacing), which this round did not deepen
(feature-freeze).

## GDD v3 — continuous no-reset arc (P9 balance)

The meta was rewritten (GAME-DESIGN.md): no resets, model generations, real-time
timed processes, market-share race. Arc measured by `tmp/sim2.js` (drives the real
engine as an engaged player). Training is **wall-clock** (advances offline too), so
the arc length is set by the trainSec ladder ÷ processSpeed.

### Tuned arc (engaged player, processSpeed capped ~3×)
| Gen | model | reached | note |
|----|----|----|----|
| v1 | Model v1 | ~1 min | garage: tap→GPU→train |
| v2 | Model v2 | ~5 min | |
| v3 | Model v3 | ~19 min | "ChatGPT moment" |
| v4 | Model v4 | ~47 min | first hour = 4 generations (strong hook) |
| v5 | Model v5 | ~2.5 h | become market #1 around here |
| v6 | Model v6 | ~9 h | |
| v7 | Frontier v7 | ~1.1 d | |
| v8 | Frontier v8 | ~2.7 d | |
| v9 | Frontier v9 | ~5.8 d | |
| v10 | Proto-AGI | ~11 d | |
| v11 | **AGI** | **~19 d** | win (casual/offline ≈ a month+) |

- **No dead time (0%)** — datacenter-build + research run in parallel with training,
  so there's always something progressing while a model trains.
- **No walls** — compute (the early bottleneck) and money keep pace; later, the
  time-gate (trainSec) is the deliberate month-long pacing mechanism.
- **No exploits** — market/trading removed (funding rounds instead); windfalls were
  retired with the prestige meta; rivals creep but you overtake by shipping.
- **Funding** rounds gate by generation (Seed g1 → A g2 → B g4 → C g6 → IPO g8),
  unlocking progressively; each pays a **head-start cash lump = a few minutes of your
  CURRENT income** + a **permanent revenue mult** (the lasting value).

### Funding & valuation rework (2026-06 — fixed a game-breaking payout)
**Bug:** `valuation()` annualised per-second `moneyRate` (× `SECONDS_YEAR` ≈ 31.5M) ×
`VAL_REV_MULT` 20, so valuation ran ~1e6–1e8× the player's real cash ($164T at $1.4M
cash). `takeFunding()` paid `valuation × cashFrac` → every round dumped ~3.5 YEARS of
income (Seed handed $771M to a player holding $2K). That was the "free money from nowhere".

**Funding payout — now self-scaling, never a skip.** `fundingPayout = moneyRate × secs`,
floored to `GEN[0].baseCost × 40` so a barely-bootstrapped gen-1 lab still gets a usable
seed. `secs` per round: **Seed 180s · A 240s · B 300s · C 420s · IPO 600s** (~3→10 min of
*current* income). Because it's minutes-of-income it can never trivialise the next stage
(you'd earn it in those minutes anyway). The permanent `mult` (1.10/1.15/1.20/1.25/1.40)
is unchanged — that's funding's real long-term value. Measured payouts:
early Seed ≈ $1.1K @ $2K cash (3 min, a real head-start) · mid A ≈ $239K @ $1.42M cash
(~4 min) — meaningful, not game-breaking.

**Valuation — now believable, in-scale with cash.** `valuation = (cash + compute ×
VAL_COMPUTE_ASSET(1) + lifetimeEarnings × VAL_GOODWILL_MULT(3)) × (1 + share% ×
VAL_SHARE_PREMIUM(2)/100)`. Company-worth model: liquid cash + physical compute assets +
goodwill from PROVEN lifetime earnings, boosted by market dominance. Cumulative-earnings
basis is **monotonic** — right for a pride metric (a revenue basis would *drop* during big
training runs when compute is consumed). Measured: mid $1.42M cash → **$40M valuation**
(was $164T); val/cash ≈ 9× early → 28× mid → 66× late — grows impressively but plausibly.
Funding no longer reads valuation at all, so valuation is now a pure display/pride metric
with zero economic leverage.

**Money-scenario audit (all sources sane, no printer):** every `addCash` is one of —
core income `moneyRate×dt` (infra-bounded); tiny tap value; funding (above); or a windfall
(daily / ad-burst / events / news cashGift) routed through `windfallCash = min(baseCps ×
seconds, bestRunEarned × frac)` — income-scaled by construction AND capped at 4–8% of your
best proven run. `moneyRate` itself is bounded (share ≤100, genMult by gen count, funding
mults ≤1.4⁵). Arc re-simmed after the fix: **AGI @18d22h, 0% dead, all 5 rounds taken** —
the old giant injections were never load-bearing.

### Levers
- `MODELGEN[].trainSec` — the raw real-time ladder (1 min → 20 d). The primary month lever.
- `PROCESS` caps — researchers ≤ +120%, research ≤ +100% → max process speed ~3×
  (a meaningful reward without collapsing the month).
- `CORE.REV_PER_COMPUTE`, generator/`DATACENTER`/`RESEARCH2` numbers — money/compute curve.

### Known: late-game numbers go exponential (valuation reaches ~1e30 by AGI). This is
inherent to an idle game with per-generation permanent multipliers; the realism is in
the STRUCTURE, pacing and real-world anchors, not the absolute late-game $ (genre-normal).
