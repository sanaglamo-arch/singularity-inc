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
- [x] P1 generations ladder — DONE (no-reset; prestige reset disabled forward-only; money flipped to product revenue) + no reset
- [x] P2 timed processes — training + datacenter-BUILD (Lab) + RESEARCH (Team) timers, all PARALLEL in tick (3 at once), researchers/research/boost shorten them, offline-safe, SAVE_VERSION 6.
- [x] P3 resources (state+migration+engine+HUD done) (money/compute/researchers + valuation/share)
- [x] P4 rivals + market-share race — state.rivalShare + growth in tick, standings panel (you vs rivals sorted, #1 highlight), agiProgress re-homed to modelGen, SAVE_VERSION 5. (Lab crowding -> address in P6/P10)
- [x] P5 finance — valuation fixed (ARR×multiple); funding rounds Seed→A→B→C→IPO UI live (realistic valReqs; moneyRate compression pending P9)
- [x] P6 re-home: World->RACE, Research->TEAM(hiring+R&D); market+singularity-tab retired; safety/comms still on (riskUnlocked@gen3, worldcards@gen1). next-goal nudge rewritten for new systems.
- [x] P7 retention: offline summary + next-goal nudge + earned-boost economy (tokens from daily/achievements/idle; activate to ×2 all timers) + daily login reward & forgiving streak. SAVE_VERSION 7.
- [x] P8 endgame: AGI finale (win) + endings by play style (Aligned/Reckless=foom/Nationalized) + Beaten (rival hits AGI first) → cinematic+badge+Race finale banner; optional NON-forced Founder's Legacy (+25%/replay, keeps endings). SAVE_VERSION 8.
- [x] P9 balance — sim-tuned month arc (engaged ~19d to AGI, casual/offline ~month+), 0% dead time, no walls, funding gated by generation; BALANCE.md updated. (late-game $ exponential — documented)
- [~] P10 polish: overflow audit CLEAN (no h-scroll/real overflow at 360/390, fresh/mid/late on Lab/Team/Race); fixed valuation clip + standings copy; Stage-1 garage cleanliness (share/val/build gated to post-v1). Upgrades/finale/Race renders CLEAN; Trust now drives revenue; 🦄 Unicorn §9 moment added. DONE: safety tradeoff VERIFIED bites (ignore align=72% downtime; fund=smooth), acts re-homed to modelGen. DONE: desktop pass CLEAN (1280 Lab row-split + Race fit 1040px); upgrade copy refreshed (compute framing, fixed Series-A/C/F/IPO funding-name clash). DONE: §9 decacorn $10B milestone + AGI-race rank line on Race tab. TODO: world news-card coherence audit (cashGift/trust effects), insight/breakthrough framing (compute not output/cash), late-game next-goal coverage.

## Save migration: SAVE_VERSION 3 -> 4 (this rewrite). Derive new fields from old; never crash/rob.

## Render-harness notes (this env)
- Background `python3 -m http.server` dies between separate Bash calls. Start it
  with the Bash tool's run_in_background:true and a fresh port; verify with curl
  before shooting. (A server on 8077 was started this session.)
- Headless-Chrome localStorage seeding across separate processes is FLAKY (seed
  page often doesn't persist to the index load). Prefer a DIRECT-STATE inspection
  harness: load index in an iframe, mutate w.GAME.state.* in JS, then read DOM.
- location.hash tab-switch is ASYNC (hashchange) — in a harness, click the nav
  button to switch tabs synchronously, don't rely on hash+immediate update().

## CRITICAL FIX (this session): bind() aborted on $('prestigeBtn') null-deref (removed in P6) -> ALL listeners after it (train/funding/boost/build/research/hire/autopilot/alignment) were DEAD. Guarded. Lesson: verify NEW buttons via real DOM click, not just direct engine calls. Audited: all new buttons fire.
