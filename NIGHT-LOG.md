# Singularity Inc. — Night-build log

> Tech-lead night builds. Newest on top. Each entry: what changed, why, proof, commits.

---

## 2026-06-17 — NIGHT BUILD: time scale + economy rebalance (two load-bearing fixes)

Implemented the two core changes from the GDD/audit rework, both gated by a mandatory
throwaway proof-sim that drives the REAL shipping code (config.js + game.js loaded headless
in a stubbed sandbox). Committed time and economy separately.

### 1. TIME SCALE — `DAY_SEC` 60 → 300  (commit `f0f7e9f`)
- 1 in-game day = 5 real minutes (300s). MONTH_SEC derives automatically (×30 = 9000s = 2.5h).
- Real month ≈ 8,640 in-game days ≈ ~23.7 in-game years; full v1→AGI arc ~3.5–5 real weeks
  (gated by the wall-clock training timers, which already advance offline).
- Day-derived timers rescale sensibly: debt grace stays in in-game days (60d Normal = 5 real
  hours red before bankruptcy); decision no-repeat cadence rescales the same way.
- No discrete bill/tax/accountant timers exist in code yet (electricity is still a continuous
  burn share), so nothing else to retune. Block-1 debt timer unaffected (it reads DAY_SEC).
- Saves store `playtime` in REAL seconds → old saves reinterpret correctly, NO migration needed.

### 2. ECONOMY — building pays off FROM v1  (commit `66682fa`)
Root bug (audit A1/A2/A3): revenue was sublinear (`cps^0.72 × 0.022`) vs LINEAR burn → marginal
generator buy net-NEGATIVE at depth → "building loses money" + a "park" exploit; the round-mult
revenue ladder was DEAD (never read in `moneyRate()`); Impossible was mathematically unwinnable.

Fixes (all in `js/config.js` CORE + DIFFICULTY, `js/game.js` moneyRate):
- **ADOPTION_EXP 0.72 → 1.0** — revenue LINEAR in compute. `d(rev)/d(compute)` is now CONSTANT,
  so a marginal buy is net-positive from v1 at ANY cps depth (the old curve decayed to negative).
- **REV_COMPUTE_COEF 0.022 → 0.0075, REV_GEN_STEP 1.68 → 1.35** — re-tuned for the linear curve +
  the newly-wired round-mult so a mature lab's margin isn't absurd; gen1 marginal stays positive
  on all 4 difficulties.
- **WIRED the dead round-mult** — new `fundingRevMult()` (Seed ×1.10 … IPO ×1.40) is now applied
  in `moneyRate()` so funding rounds permanently COMPOUND revenue (was a one-time cash lump only).
  Kept separate from `revGenFactor()` (the per-generation ladder) so the two never double-count.
- **Impossible retune** — burnMult 1.5 → 1.3, computePriceMult 1.4 → 1.25.

### PROOF-SIM (throwaway, ran against the committed code; deleted after)
All gates on all 4 difficulties:
- **Marginal generator buy BUILD-OK from gen1** on Easy/Normal/Hard/Impossible, at owned-depth
  5/100/300 (net/compute constant & positive — linearity confirmed). PASS.
- **Reasonable player reaches AGI without bankruptcy:** Easy/Normal/Hard win (~44–56 real days);
  Impossible is TIGHT (reaches gen 10/11 at the 75-day cap, not bankrupt). PASS.
- **Reckless greedy over-buyer FAILS** (zero buffer + skips funding rounds): bankrupt/stalled on
  Impossible (gen 6/11); forgiven on easier tiers (intended). 
- **Idle / never-ship FAILS** everywhere (stuck at v1 — can't reach AGI without shipping). PASS.
- **Park exploit DEAD:** building net ≥ parking net on all difficulties. PASS.

### Quality gates
- `node --check` clean on both files.
- Headless load: **0 console errors**; all economy primitives finite.
- **Save migration confirmed:** an old v11 save (modelGen 4, gens, cash, funding) loads → v16,
  every field preserved, `fundingRevMult` correctly applies (1.265 = seed×A), 0 errors.

### Honest notes
- Late-game rev/burn is healthy-to-high once you've shipped several gens — an inherent consequence
  of "building pays off from v1 + a compounding gen ladder." Challenge now comes from fixed costs,
  the exponential generator cost curve, the compute-STOCK gate on shipping, rivals, and difficulty
  (as the mandate specifies), not from compute being a money-loser.
- "Greedy over-buyer fails" holds where it matters most (Impossible) and is realistically
  difficulty-dependent (per GDD §4.2a). The full game's incident/black-swan/rival layer punishes
  zero-buffer play further than the isolated base-economy sim can show.
- Accountant / discrete bills+taxes (GDD §1) remain UNimplemented — separate larger feature, out
  of scope for this build. The time change is forward-compatible with adding them later.
