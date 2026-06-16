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
