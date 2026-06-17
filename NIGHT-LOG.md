# Singularity Inc. — Night-build log

> Tech-lead night builds. Newest on top. Each entry: what changed, why, proof, commits.

---

## 2026-06-17 — NIGHT BUILD: decision-cadence verify · finish plain-language · audit §E polish

Commits: `5cdd605` (RU jargon) · `<audio>` · `<save>` · `<ui>` (volume/export/colorblind).

### 1. Decision cadence — VERDICT: already REAL-TIME, no retune needed
- The pacer (`updateDecisions`/`decisionInterval` in game.js) is driven by `Date.now()` epoch-ms
  via `state.nextDecisionAt`; `INTERVAL_MIN/MAX = 120/240s` are REAL seconds. The only `playtime`
  coupling is `FIRST_DELAY` (25s active). **DAY_SEC=300 does NOT affect cadence** — game-days are
  not in the loop. `NO_REPEAT_SEC`/`CATEGORY_COOLDOWN` are small fixed real-seconds (anti-cluster).
- **Simulated active play (real engine, 30 virtual minutes, 1s ticks):** 15 decisions fired →
  **1 per ~2.0 min** (mix: ~3 interrupt modals, ~6 bankable inbox, ~5 ambient auto-resolve, ~1
  ticker). Matches the design target "~1 meaningful decision per few minutes". Not 0, not a flood.
  No change made — verification only.

### 2. Plain-language relabel finished — 0 RU jargon leaks
- Scan method: flag RU strings still saying "компьют/Компьют" **only where the parity EN string
  uses the relabeled term "Power"** (so we don't touch the deliberately-unchanged EN flavor that
  still says lowercase "compute"). Exactly **2 leaks** found & fixed:
  - `finance_tip` (HUD burn breakdown): "Компьют −$…/мес" → **"Мощность −$…/мес"**.
  - `train_need`: "Нужно {v} компьюта…" → **"Нужно {v} Мощности…"**.
- Re-scan after: **0 leaks** vs every relabeled-EN label. EN left as-is; cool buyable names untouched.

### 3. Polish (audit §E)
- **Volume sliders** (SFX + Music) in Settings: 0-100% range inputs scaling the audio/music master
  gain live. `GAME_AUDIO.setVolume`/`GAME_MUSIC.setVolume` added (clamped, NaN-safe; music ramps
  smoothly while playing). State `sfxVol`/`musicVol` (default 0.7), persisted + migration-backfilled,
  disabled when the channel is off.
- **Save export/import**: `exportSave()` → `SINGv1:`+base64(JSON), shown in a copyable box + Copy
  button; `importSave()` decodes (base64 or raw JSON, prefix optional), migrates, replaces state,
  re-renders the whole UI. Malformed input rejected without touching the live save.
- **Colorblind-safe meters**: runway HUD + the 4 relationship meters now prefix a **STATE GLYPH**
  (✓ ok / ▲ caution / ⚠ critical) so the green/amber/red channel no longer relies on hue alone
  (deutan/protan/tritan safe). Red runway also keeps its motion cue (pulse).

### Quality gates
- `node --check` clean on all 12 page scripts per commit.
- Headless smoke (real engine, eval-shim): volume setters clamp/NaN-safe; export→mutate→import
  round-trip restores cash/compute/volume; garbage/empty import rejected; raw-JSON import tolerated.
- Glyph coverage: every `meterBand()` output (0..100) + every runway state maps to a distinct glyph.
- **i18n EN/RU parity: 1071 keys each, 0 orphans.** Cache-buster bumped v=13 → v=14 (JS+CSS changed).
- :8080 serves the updated v=14 bundle (verified via curl).

### Honest notes
- "0 console errors headless" is proxied by `node --check` + the eval-shim engine harness (no
  puppeteer/jsdom in this env). A full DOM-stub init runs deep into the render pipeline; the only
  stop is stub-DOM gaps (style.setProperty / cosmetic-swatch dataset), not game code.
- Music `setVolume` is a no-op in the headless harness (no WebAudio `AudioContext`); the real-browser
  branch scales the master ramp. Verified by code path, not audible playback.
- Many lower-tier RU flavor strings still say "компьют" (upgrades, onboarding, breakthroughs) — but
  their EN counterparts ALSO still say lowercase "compute", so changing them would BREAK parity with
  the intentionally-unchanged EN. Left as-is per "keep EN as-is" + the "2 leaks" scope.
- dist zip rebuild deferred (per standing instruction) — live tree on :8080 is current.

---

## 2026-06-17 — NIGHT BUILD: 4 RELATIONSHIP METERS (owner ask + audit §C fix)

**What:** Implemented the 4 relationship meters from DESIGN-bills-meters §4-5, with the
audit §C cross-pressure / open-doors fix and the §C Safety positive-pull. `state.trust`
kept as the engine field, RELABELED in UI as **Public Approval / Одобрение населения**;
added `govLoyalty`, `industryRel`, `morale` (default ~55). SAVE_VERSION 17→18, safe migrate.

**The 4 meters (0-100, icon+color green/amber/red, plain tooltip EN+RU):**
- 👥 Approval (= trust) · 🏛 Gov Loyalty · 🤝 Industry Rel · 🧑‍🔬 Morale.

**Drivers wired (real game events):**
- Gov ↑ paying taxes in full (settleOnline + offline settle); ↓ on shortfall/evasion.
- Morale ↓ layoffs (−12), crunch; ↑ hiring (+1), shipping a generation (+3).
- Approval ↑ shipping a generation (+2); (↓ incidents/layoffs already existed).
- Decision-tagged drivers for all three (see below).

**Consequences (low meters bite):**
- Low Gov → feeds nationalizationEligible() (new gate, augments trust/reg) + higher tax
  accrual (govTaxPressure up to +25%).
- Low Morale → harder poach/mole on acquisition turns (moraleMoleBonus) + slower research
  (processSpeed × moraleResearchMult; pivots at ~55 = neutral).
- Low Industry → trips acqWeakSignal() (easier hostile takeover).
- Low Approval → product-revenue drag (approvalRevMult, only <35).

**Cross-pressure + open doors (audit §C):** ~13 decisions tagged with genuine trade-offs
(comply → gov↑ but cash + morale↓ crunch; open-source → approval+industry↑ but share↓;
price war → share↑ but industry↓; layoffs-tout → valuation↑ but morale/approval↓). Added
3 OPEN-DOOR opportunity decisions gated by HIGH meters: high Industry → co-funded compute
consortium (+runway); high Gov → government contract (+cash/share); high Morale → team
moonshot (perm +3% output). All EN+RU.

**Safety positive pull (§C):** clean risk + shipped + decent approval → trustedReleaseMult
= ×1.08 product revenue ("trusted release" premium) — Safety now has an UPSIDE.

**UI:** Relationships panel on the World tab (reuses risk-bar styling), 4 rows with
icon + name + colored bar + %, one plain tooltip each. Renders clean at 360px, no overflow.

**Proof:** node --check all files; headless harness 0 errors — v17→v18 migration defaults
gov/ind/morale to 55; payTaxes full +4 / short −6; layoffs −12 / hire +1; low-gov feeds
nat gate; trustedReleaseMult 1.08; processSpeed 1.0@55→0.88@10; netCashRate stays positive
(economy intact). Screenshot at 360px read — green/amber/red bands all correct. index.html
boots in headless Chrome with 0 JS console errors.

**Commits:** 51d2893 (state/migration/applyEffect) · 76ee609 (drivers/consequences/Safety
pull) · 7d4e218 (decision tags + open doors + i18n) · 16c8e7a (UI strip).

**Honest notes:** Drivers/consequences/open-doors are all WIRED (not stubbed) and tested.
Morale-mole hook rides the existing acquisition poach turns (not a separate black-swan
event). Tagged ~13 of 62 decisions (a representative subset, per prompt). The trust HUD
in the topbar still shows the raw number relabeled via tooltip; the full 4-meter panel
lives on the World tab. dist zip rebuild deferred (live tree on :8080 is current).

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

---

## Night build — ACCOUNTANT + discrete BILLS/TAXES (DESIGN-time-accountant lock)

Implemented the accountant + discrete electricity bill + monthly taxes the GDD/audit described but
the code lacked (electricity was a continuous burn share; no taxes). Commits: c127876, eccc76b,
3b45cf3, a23ceb3.

### What landed
1. **Electricity → discrete accruing BILL.** Pulled out of continuous `burnBreakdown().total`
   (verified `EXCLUDED_OK`): continuous net/sec is now salaries+compute+upkeep+overhead+debt only.
   Electricity accrues `state.powerOwed += electricityPerSec()×dt`, settles every 7 in-game days.
2. **Taxes — monthly (30 in-game days).** `state.taxOwed += 12% × positive revenue × dt`; $0 before
   any profit. Settles on the 30-day boundary.
3. **Batching / no per-bill spam.** Bills accrue VISIBLY (running owed number in the Bills view);
   no popup per bill. FIRST electricity bill fires a one-time TEACH popup (what/where/consequences);
   otherwise online bills auto-settle on their boundary (no fee).
4. **The ACCOUNTANT.** Auto-hires at 120s playtime (≈2 real min) → toast "В компании появился
   бухгалтер…" (no "free"). ONLINE: player pays in Bills view, no fee. OFFLINE/on-return: accountant
   auto-pays electricity+taxes from cash + a per-bill SERVICE FEE. The "while you were away" report
   now lists electricity paid, taxes paid, **accountant fee ("кусается на старте!")**, earned, cash.
5. **Partial-shutoff FLOOR (audit §B).** Cash can't cover a bill → accountant pays what it can, the
   rest rolls into debt + a **−30% generator throttle** (NOT full shutoff). Cleared on payment.
   Verified throttle ratio = **0.700** exactly; online pay clears it.
6. **Bills view** on the Lab: ⚡ owed + "settles in N days", 🧾 next tax + "in N days", pay-now
   buttons (online, no fee), shutoff warning. Compact, no overflow at 360. EN+RU.

### Fee curve (bites early, trivial late) — `FEE_BASE + FEE_LOG×log10(bill)`, capped at 40% of bill
- **$70 bill → fee ~$24.9 (35.6%)** — meaningful vs small early cash.
- **$5,000,000 bill → fee ~$58.9 (0.0012%)** — effectively nothing late game.

### Re-validated economy after moving electricity out of continuous burn (mini-sim, real engine)
- **Building STILL pays off from v1:** marginal Δ(true net/sec incl. amortized bill+tax) POSITIVE at
  every tier (laptop +0.001, gpuRig +0.005, serverRack +0.043). At gen 4: true net +33.2/s,
  marginal serverRack +0.80, gpuCluster +2.35, runway ∞. Moving elec out *improved* marginal payoff.
- v1 runway ~3.95 months (sane early pressure).

### Quality gates
- `node --check` clean on config/game/ui/i18n/main per commit.
- Headless: **0 console errors** across bills accrual, online pay, offline settle+fee, shutoff floor,
  migration, normal boot.
- **Migration v16→v17 confirmed:** old save (no bill fields) loads → v17, cash preserved, fields
  backfilled, period anchors rebased (no retroactive bill), veteran (playtime>120s) grandfathered
  with accountant already hired + teach marked seen. 0 crash.
- Screenshots read at 360: Bills view, "while you were away" report (shows the fee line), first-bill
  teach popup — all render clean, no overflow.

### Honest notes
- Offline bills accrue over the CAPPED+RATED offline window (same window as offline earnings) so the
  away report nets sensibly; a player can't dodge bills, but a very long absence is capped like
  earnings (fair, matches existing offline model).
- The Bills view is a section on the Lab tab (not a new bottom-nav tab) — cleaner at 360 than adding
  a 5th nav slot; matches DESIGN-bills-meters §5 "встроить если чище".
- The new metrics (gov loyalty / industry / morale) from DESIGN-bills-meters §4 are NOT part of this
  build — that's a separate larger feature. This build covers electricity/taxes/accountant only.
- dist zip rebuild intentionally deferred (per prompt) — live tree on :8080 is current.

---

## NIGHT — AGI-RACE TELEGRAPH HUD + LATE-GAME RACE AGENCY (audit §B.2 + §E)

Fixed the two late-game audit holes: the invisible AGI-race clock (fairness)
and the empty endgame waiting (the slog). Two logical commits.

### 1. AGI-race GAP telegraph HUD (audit §B.2 — "Beaten = a clock you can't see")
- Reworked `raceStatus()` (game.js) from a market-share badge into a true AGI-GAP
  telegraph: it now compares YOUR `agiProgress()` to the LEADING rival's `agi`
  (`gap = you − leader`) and returns `{state:'lead'|'amber'|'red', you, lead, gap, id}`.
  - green/`lead`  = you lead by ≥ `RACE.GAP_SAFE` (5%)
  - amber/`amber` = a rival is within ±5% (closing in)
  - red/`threat`  = a rival is AHEAD (gap < 0) → you are LOSING the race
- Topbar `raceBadge` (ui.js) now renders the gap with a colorblind-safe STATE GLYPH
  (✓ / ▲ / ⚠) prefix + green/amber/red gradient. Visible from `RACE.GAP_HUD_FROM_GEN`
  (gen ≥ 1 — i.e. once v1 ships), so it's testable mid-game, not just at the actual
  endgame. The player SEES the race tightening BEFORE committing to a multi-day final
  train — the audit's exact fix.
- New i18n: `race_gap_lead` / `race_gap_close` / `race_gap_behind` (RU+EN). New
  `#raceBadge.amber` style. New config: `RACE.GAP_SAFE`, `RACE.GAP_HUD_FROM_GEN`.

### 2. Late-game race agency decisions (audit §E — "empty waiting")
Four new race-category decisions hooked to the existing decision engine + live rival
`agi` data (`rival_effect`) + the R3 relationship meters, weighted UP in the endgame
via `weight_mods` (act ≥ 3/4, or when you're behind/closing). All telegraphed in the
news feed:
- **SPRINT** (`dec_race_sprint`): spend cash+compute to crash-accelerate YOUR current
  training. New `train_boost` effect verb pulls the active run's `endsAt` forward by a
  fraction of time-remaining (capped at 95%; no-op if not training). The real lever to
  close the gap. Three options (crash / measured / steady).
- **SABOTAGE / counter-intel** (`dec_race_sabotage`): slow the LEADING rival's AGI
  (`rival_effect:{leader:{agi:-10}}`) at a cash + industry/gov cost + `vec.sec` risk +
  a scheduled `dec_race_sabotage_leak` blowback (40% chance) that bites trust/gov.
- **ALLIANCE / open-source gambit** (`dec_race_alliance`): slow ALL rivals
  (`rival_effect:{all:{agi:-6}}`) but surrender your edge (share −4, approval/industry up),
  or a private pact with the leader.
- **DEFEND** (`dec_race_defend`): harden / litigate / absorb when a rival presses its
  advantage. Counter-nudges the leader on harden; absorb lets them gain.
- New `decisionMetric` gates: `meter.raceGap`, `meter.rivalLeadAgi`, `meter.training`.

### Quality gates
- `node --check` clean on config/game/ui/i18n per commit.
- Headless smoke (real engine, navigator/localStorage stubbed): **0 console errors**.
  - raceStatus returns correct lead/amber/red + gap across forced rival states.
  - All options of all 5 new decisions resolve with no errors.
  - `train_boost` SPRINT verified: 3600s run → 2340s (−35% of remaining).
  - alliance coalition slows the whole rival field.
- **i18n parity:** 42 new keys × 2 locales, all present & non-empty (EN+RU script check).
- **Migration:** no new PERSISTED state added (only config constants + transient vars that
  default via the existing `state.vars[k]||0` path) → old saves load unchanged. Sparse/legacy
  state (missing rivals/training/vars) re-seeds rivals safely; raceStatus doesn't crash.
- **No overflow at 360/390/414:** measured `scrollWidth == clientWidth` (over=no) at all three
  widths with the race HUD live. Screenshots read at 360 for lead (green "You lead by N%"),
  amber ("{rival} closing +N%"), red ("{rival} ahead by N%") — badge ellipsizes gracefully,
  no horizontal overflow.

### Honest notes
- **Wired vs stubbed:** everything is WIRED, nothing stubbed. The HUD reads live `state.rivals`
  agi; the four decisions go through the real `applyEffect`/`resolveDecision` pipeline; the new
  `train_boost` verb mutates the live training timer; the sabotage leak uses the existing
  `state.scheduled` callback path.
- The race decisions are gated `act:[2/3/4]` + modelGen + (for sabotage/alliance/defend) a
  `rivalLeadAgi` threshold, so they surface in the actual endgame; their `weight_mods` make
  them more frequent when act ≥ 3/4 or you're behind — the "fill the slog with active race".
- SPRINT's `train_boost` is intentionally capped at 95% of remaining time (never instant-finish)
  so it's a meaningful lever, not a skip button.
- dist zip rebuilt this session (22-file flat bundle, current tree).

---

## R7 — P3 RETENTION: run-objective alt-goals + daily loop (audit §E)

**Run objectives (replayability → Hall of Fame).** 6 optional challenge badges, tracked
PASSIVELY from existing signals (no new currency):
- `flawless` — reach AGI with `incidentsThisRun === 0`
- `monopoly` — `marketShare >= 60` (latches mid-run via trackRunGoals)
- `bootstrap` — win taking NO funding round (`!tookAnyFunding()`)
- `no_ipo` — win without an IPO (`!funding.ipo`)
- `safe_leader` — win with `align >= 5 && trust >= 85` (pristine safe win)
- `speedrun` — reach AGI in `< 21` in-game days

`runGoalState(id)` → `done|progress|blocked` for a colorblind HUD (✓ / ▲ / ⚠). At the
finale, `awardRunGoals()` latches met goals into BOTH `state.runGoalsMet` (this run) and
`records[diff].badges` (persist forever). Badges render on the shareable ending card
(`#goBadges`) and as a count in the Hall of Fame (Stats panel + game-over modal). Panel
lives in the Achievements tab.

**Daily loop (monthly retention).** Real-calendar-day goal layered on the existing login
reward. One rotating goal/day picked by `realDayIndex % GOALS.length`: tap N (40) / ship a
model / earn $X (stage-scaled = `baseCps × 10s × 30`). Progress = current counter − a
baseline snapshotted at the day-roll (zero extra tick tracking). Clearing it grants ONE
boost token. Forgiving streak (1 missed day doesn't reset). Day boundary uses real `Date`
(local-time `realDayIndex`). Teach-on-first popup when the Achievements tab first opens
(once, non-nagging). Panel shows streak ("🔥 N days") + goal + progress bar + claim button.

**Latent bug fixed:** a duplicate `function dayIndex` (real-day) silently shadowed the
in-game `dayIndex` for the whole IIFE, so electricity/tax bills keyed off REAL days and
basically never settled by period. Renamed the daily one to `realDayIndex()`; in-game
`dayIndex` is canonical for bills again. Migration re-anchors pre-v19 `lastElec/TaxDay`
(which were stored as huge real-day indices) to the in-game day so no surprise bill fires.
Verified: bills now settle by in-game period (powerOwed drops after ~7 in-game days).

**Checks:** `node --check` clean on all js; headless **0 console errors** (Yandex SDK
aside); **i18n parity 26 new keys × RU/EN → 1468 each, no diff either way**; **migration
safe** (v18→v19, all new fields default, old saves load clean, bills re-anchor); **no
overflow 360/390/414** EN+RU — screenshots read at 360 (Daily streak + stage-scaled
"Earn $433.8K" goal; 6 alt-goals w/ glyphs, Monopoly "Achieved"). RU at 360 wraps clean.

### Honest notes
- **Fully WIRED, nothing stubbed.** Goals read live state; `awardRunGoals` fires from the
  real `triggerFinale`; `trackRunGoals` runs in the tick next to `trackRecords`; badges
  persist through `recordFor().badges` and survive new-game (records are kept).
- Daily streak/goal state is REAL-CALENDAR, so it's carried through an in-game new-game
  (added to the `keep` set in `newGame()`), with a counter-reset guard so a fresh run's
  zeroed taps/modelGen can't make today's progress go negative.
- `?qa_ach` is a dev-only screenshot hook (seeds mid-game + opens the tab; `?lang=ru`
  forces RU); no gameplay effect, mirrors the existing `?newstest` pattern.
- Reward scaling: the login cash already scaled via `windfallCash` (baseCps × seconds,
  capped by bestRunEarned frac) — modest early, never trivializing late. The daily-goal
  reward is a flat 1 boost token (retention nudge, not a power spike).
