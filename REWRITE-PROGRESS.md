# GDD v3 rewrite — progress trail (read with GAME-DESIGN.md + git log)

Transforming from prestige-RESET meta → continuous NO-RESET AI-lab tycoon.

## Target model (my interpretation of GAME-DESIGN.md)
- Resources: 💵 Money, 🖥 Compute (stock + rate), 👥 Researchers. Derived: Valuation, Market Share.
- Generators (laptop→…→megacluster) PRODUCE COMPUTE/sec (+ tap = compute burst). Compute is the bottleneck.
- Products: your deployed model generation earns MONEY/sec = baseRevenue × genMult × (1+marketShare). Money buys generators/researchers; funding rounds inject money.
- Model generations v1→…→AGI: advancing = TIMED training process (spend computeReq + real time trainSec; researchers/boosts shorten). Advancing = PERMANENT genMult + marketShare jump + unlock. NO reset, keep all infra.
- Rivals: 3–4 labs grow market share/AGI on own timelines; goal = become #1 then reach AGI first.
- Finance: rounds Seed→A→B→C→IPO gated by valuation milestones.
- Safety (risk+crises), Comms (news+trust), Hiring — all feed continuous growth, unlock in order.
- Retention: earned boosts (~80%), daily login/goal, events, offline summary, next-goal nudge, forgiving streak.
- Endgame: AGI race finale + endings (Aligned/Reckless/Nationalized/Beaten); optional Founder's Legacy replay (non-forced).

## Phase status
- [ ] P1 generations ladder + no reset
- [ ] P2 real-time timed processes (training/build/research) — parallel
- [ ] P3 resources (money/compute/researchers + valuation/share)
- [ ] P4 market share + rivals central
- [ ] P5 finance rounds + valuation
- [ ] P6 systems re-homed on continuous growth
- [ ] P7 retention engine
- [ ] P8 endgame + endings + legacy
- [ ] P9 balance the month curve (sim + BALANCE.md)
- [ ] P10 polish (layout/clarity/feel/perf)

## Save migration: SAVE_VERSION 3 -> 4 (this rewrite). Derive new fields from old; never crash/rob.
