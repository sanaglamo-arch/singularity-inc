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
  with `K = 1`, `SCALE = 1e6`.

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

## Offline

- Earns **50%** of current cps for elapsed time, capped at **8h** (+4h per
  Always-On Inference research). Rewarded ad **doubles** the collected amount.

## Ad boosts (all degrade gracefully without SDK)

- Rewarded: **2× revenue for 2h**, or instant cash = **10 min** of production,
  or double offline earnings.
- Interstitial: on prestige, min **120s** cooldown.
- Sticky banner: shown when available.
