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

Growth rises with tier (1.07 → 1.12) so higher tiers stay aspirational.

## Prestige

- RP gain `floor(sqrt(totalEarnedThisRun / 1e6))`.
- Each RP: **+5% global output** (passive, based on current RP held).
- Permanent research (RP cost): globalx2 (5), globalx3 (50), globalx5 (500),
  tapx10 (10), +4h offline (25), alignment suppression x2 (20), start-cash 1M (40).

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

## Offline

- Earns **50%** of current cps for elapsed time, capped at **8h** (+4h per
  Always-On Inference research). Rewarded ad **doubles** the collected amount.

## Ad boosts (all degrade gracefully without SDK)

- Rewarded: **2× revenue for 2h**, or instant cash = **10 min** of production,
  or double offline earnings.
- Interstitial: on prestige, min **120s** cooldown.
- Sticky banner: shown when available.
