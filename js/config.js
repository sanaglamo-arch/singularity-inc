/* Singularity Inc. v2 — economy data (GROUND-UP rewrite).
   No old mechanics. window.GAME_CONFIG. Numbers are Normal difficulty (phase 1). */
(function () {
  'use strict';

  // ---- time ----
  var DAY_SEC = 60;          // 1 in-game day = 60 real seconds
  var WEEK_DAYS = 7;         // electricity bill every 7 in-game days
  var MONTH_DAYS = 30;       // tax every 30 in-game days

  // ---- bootstrap clicking ----
  //  COLD click = base. ENGAGED rapid clicking builds "heat" (разгон / overclock 0..1):
  //  effective value = base * gain^level * (1 + heat*COMBO_BONUS). Tuned so a real fast
  //  tapper averages ~$0.10/click at lvl 0 → ~100 rapid clicks ≈ $10 (owner's scenario).
  var TAP = {
    base: 0.10,               // cold click value — raised from 0.063 to ease early grind (sim-gated; completability preserved)
    upgrade: {
      baseCost: 6,           // first click upgrade — cheaper hook (sim-gated)
      costMult: 2.0,         // ×2 cost curve
      gain: 2.0,             // each upgrade ×2 the click value
      maxLevel: 30
    },
    accel: 0.04,             // a click during training adds this fraction of a "tick" of progress
    // --- overclock / разгон combo ---
    comboBonus: 1.0,         // heat=1 → ×2 click value — rewards engaged fast-clicking during the early grind (does NOT touch base, so completability is unaffected)
    comboWindow: 0.6,        // clicks < 600ms apart build heat
    comboStep: 0.11,         // heat added per fast click (≈9 fast clicks to redline — reach the bonus sooner)
    comboDecay: 0.65         // heat lost per second when you stop clicking
  };

  // ---- hardware tiers (buy with money). idle => rent/s; committed => power ----
  //  {cost, power, rent (/s), kw, m2}
  //  A full ~26-tier real-world AI-compute ladder. The first two (laptop, miniserver) are
  //  owner-tuned onboarding and FROZEN. From there it climbs ~×2 per tier (power & cost) all
  //  the way to a hyperscale flagship — power-per-$ improves as you climb (older tiers obsolete),
  //  rent stays ≈0.2% of cost/sec, and m² grows so the 5 premises stay meaningful caps per era.
  var HARDWARE = [
    { id: 'laptop',      cost: 50,        power: 1,        rent: 0,        kw: 0.04,    m2: 0.05  },
    { id: 'miniserver',  cost: 40,        power: 3,        rent: 0.10,     kw: 0.04,    m2: 0.05  },
    { id: 'nas',         cost: 120,       power: 6,        rent: 0.22,     kw: 0.06,    m2: 0.08  },
    { id: 'desktop',     cost: 260,       power: 13,       rent: 0.5,      kw: 0.12,    m2: 0.15  },
    { id: 'towerserver', cost: 550,       power: 28,       rent: 1.1,      kw: 0.25,    m2: 0.25  },
    { id: 'gpurig',      cost: 1200,      power: 60,       rent: 2.4,      kw: 0.5,     m2: 0.4   },
    { id: 'wallcab',     cost: 2600,      power: 130,      rent: 5,        kw: 1.0,     m2: 0.6   },
    { id: 'wscluster',   cost: 5500,      power: 280,      rent: 11,       kw: 1.9,     m2: 0.9   },
    { id: 'rack1u',      cost: 11000,     power: 560,      rent: 22,       kw: 3.2,     m2: 1.0   },
    { id: 'rack2u',      cost: 22000,     power: 1150,     rent: 44,       kw: 5.5,     m2: 1.4   },
    { id: 'blade',       cost: 45000,     power: 2400,     rent: 90,       kw: 9,       m2: 1.8   },
    { id: 'rack24u',     cost: 90000,     power: 4900,     rent: 180,      kw: 15,      m2: 2.4   },
    { id: 'rack42u',     cost: 180000,    power: 9800,     rent: 360,      kw: 26,      m2: 3.2   },
    { id: 'bladechassis',cost: 360000,    power: 20000,    rent: 700,      kw: 42,      m2: 4.5   },
    { id: 'gpurack',     cost: 720000,    power: 41000,    rent: 1400,     kw: 70,      m2: 6     },
    { id: 'airack48',    cost: 1.4e6,     power: 84000,    rent: 2700,     kw: 115,     m2: 8     },
    { id: 'dgxpod',      cost: 2.8e6,     power: 170000,   rent: 5400,     kw: 190,     m2: 12    },
    { id: 'superpod',    cost: 5.6e6,     power: 350000,   rent: 10500,    kw: 320,     m2: 18    },
    { id: 'container',   cost: 1.1e7,     power: 720000,   rent: 21000,    kw: 520,     m2: 30    },
    { id: 'rackrow',     cost: 2.2e7,     power: 1.45e6,   rent: 42000,    kw: 850,     m2: 60    },
    { id: 'serverhall',  cost: 4.4e7,     power: 2.9e6,    rent: 82000,    kw: 1400,    m2: 140   },
    { id: 'smalldc',     cost: 8.6e7,     power: 5.9e6,    rent: 160000,   kw: 2300,    m2: 340   },
    { id: 'modulardc',   cost: 1.7e8,     power: 1.2e7,    rent: 310000,   kw: 3800,    m2: 900   },
    { id: 'regionaldc',  cost: 3.4e8,     power: 2.4e7,    rent: 600000,   kw: 6200,    m2: 2500  },
    { id: 'hyperscale',  cost: 6.6e8,     power: 4.8e7,    rent: 1.15e6,   kw: 10000,   m2: 7000  },
    { id: 'flagship',    cost: 1.3e9,     power: 9.6e7,    rent: 2.2e6,    kw: 16000,   m2: 20000 }
  ];
  var HWBYID = {};
  HARDWARE.forEach(function (h) { HWBYID[h.id] = h; });

  // ---- premises: give m² capacity (cap on hardware), upkeep, legality/safety ----
  //  {cost, m2, upkeep (/s), legality 0..1, safety 0..1}
  var PREMISES = [
    { id: 'garage',    cost: 0,        m2: 5,       upkeep: 0,     legality: 0.85, safety: 0.80 },
    { id: 'basement',  cost: 1200,     m2: 30,      upkeep: 0.05,  legality: 0.60, safety: 0.55 },
    { id: 'office',    cost: 18000,    m2: 200,     upkeep: 0.8,   legality: 0.85, safety: 0.82 },
    { id: 'bizpark',   cost: 250000,   m2: 1800,    upkeep: 9,     legality: 0.98, safety: 0.95 },
    { id: 'megacampus',cost: 6.0e6,    m2: 80000,   upkeep: 180,   legality: 0.99, safety: 0.98 }
  ];
  var PREMBYID = {};
  PREMISES.forEach(function (p) { PREMBYID[p.id] = p; });

  // ---- release / training ----
  //  power thresholds to RELEASE each version. v1 is the first; the final is AGI.
  //  Re-paced for the long ~26-tier ladder: each mid/late version is a real climb of several
  //  hardware tiers (a journey, not a sprint). v1 is still reachable in the first minutes of
  //  onboarding; a competent player reaches Singularity in ~130–170 in-game days (sim-gated).
  var VERSIONS = [
    { v: 1,  powerReq: 6,        demandBase: 40,    label: 'v1' },
    { v: 2,  powerReq: 60,       demandBase: 40,    label: 'v2' },
    { v: 3,  powerReq: 450,      demandBase: 40,    label: 'v3' },
    { v: 4,  powerReq: 3200,     demandBase: 40,    label: 'v4' },
    { v: 5,  powerReq: 24000,    demandBase: 40,    label: 'v5' },
    { v: 6,  powerReq: 170000,   demandBase: 40,    label: 'v6' },
    { v: 7,  powerReq: 1.1e6,    demandBase: 40,    label: 'v7' },
    { v: 8,  powerReq: 6.5e6,    demandBase: 40,    label: 'v8' },
    { v: 9,  powerReq: 3.4e7,    demandBase: 40,    label: 'Singularity' }   // final => WIN (displayed name; internal const stays AGI_VERSION)
  ];
  var AGI_VERSION = 9;

  var TRAIN = {
    baseDuration: 22,        // seconds at v1
    durationGrowth: 1.18,    // each version takes a bit longer
    clickAccel: 0.6          // each click shaves this many seconds
  };

  // ---- demand / pricing formulas (implemented in game.js; constants here) ----
  var ECON = {
    demandGrowth: 1.6,       // demand = demandBase × 1.6^version
    priceExp: 1.3,           // V = power / price^1.3 × (0.5 + 0.5*approval)
    usersInertia: 0.18,      // users += (target - users) × this per tick(=1s). Snappier than the
                             //   old 0.06 so the count doesn't crawl/linger when it should move.
    usage: 0.00036,          // revenue per user-token. Users are scaled ×userScale below, so this is
                             //   divided by the same factor to keep total revenue (≈users×price×usage) stable.
    userScale: 1000,         // users are reported as real headcounts: a model serves THOUSANDS, not 0.7.
                             //   Keeps the displayed user count a meaningful whole number.
    reachMin: 0.4,           // market REACH (max users) floor. Reach scales 0.4→1.0 with public approval,
                             //   so approval is the lever on a model's maximum audience.
    priceMin: 0.5,
    priceMax: 40,
    priceDefault: 6
  };

  // ---- price re-tune nudge ----
  // The sweet spot DRIFTS (rivals grow, you ship a bigger model). Rather than make the
  // player babysit the slider, nudge them occasionally when their set price has drifted
  // well off the current sweet spot. Gentle + throttled (owner's vision: "перетюниваешь
  // редко по подсказке «ривал обошёл — проверь цену»").
  var PRICE_NUDGE = {
    lowRatio: 0.7,        // price below 70% of sweet → leaving money on the table
    highRatio: 1.6,       // price above 160% of sweet → gouging / losing share
    graceDays: 2,         // don't nag within this many days of the player changing price
    cooldownDays: 6       // min in-game days between nudges (vision: re-tune RARELY)
  };

  // ---- bills / costs ----
  var BILLS = {
    elecRateKwh: 0.15,       // $/kWh
    // electricity per sec = ΣkW × 0.15 / 3600
    overduePenalty: 0.30,    // -30% output while a bill is overdue
    minBill: 1.0,            // weekly electricity bills below this are waived (no $0 plate early on)
    payDeadlineDays: 1,      // 1 in-game day to pay the weekly bill
    bankruptGraceDays: 6,    // a bill overdue this many in-game days => board pulls the plug (bankrupt)
    taxRate: 0.18            // 18% of revenue earned in the month
  };

  // ---- staff (buy once at lvl 1, then upgrade with one-time cash; NO salaries) ----
  //  salary kept only as a legacy no-op field; effect maps a staffer to its meter/tax lever.
  var STAFF = [
    { id: 'lawyer',    salary: 0, effect: 'legality' },   // ↓ state risk
    { id: 'security',  salary: 0, effect: 'safety'   },   // ↓ safety risk
    { id: 'marketer',  salary: 0, effect: 'approval' },   // ↑ approval
    { id: 'economist', salary: 0, effect: 'tax'      }    // ↓ tax
  ];
  var STAFFBYID = {};
  STAFF.forEach(function (s) { STAFFBYID[s.id] = s; });
  var STAFF_CFG = {
    // --- NEW buy-once + level-up design ---
    maxLevel: 10,            // each staffer levels 1..10 (0 = not hired)
    effectBase: 4,          // meter bonus at level 1
    effectMax: 25,          // meter bonus at level 10 (also the cap)
    taxPerLevel: 0.01,      // economist: -1% tax per level
    taxMax: 0.10,           // -10% at level 10
    hireBase: 1500,         // cost to reach level 1
    hireGrowth: 1.8,        // cost to reach level L = round(hireBase * hireGrowth^(L-1))
    // --- legacy fields kept for any stray references (unused by new code) ---
    hireCostMult: 90,
    hireCostGrowth: 1.35,
    perStaffEffect: 0.015,
    maxEffect: 25,
    taxReductionPer: 0.005,
    taxReductionMax: 0.10
  };

  // ---- 3 risk meters (0..100). HIGH = good (safety/approval/legality health). floor=0 => bad ending ----
  var RISK = {
    start: 75,
    floorLose: 0,
    // approval reacts to price gouging
    gougeStartRatio: 1.6,    // price/sweetSpot above this starts hurting approval
    approvalDrain: 0.15,     // pts/sec when gouging hard
    approvalRecover: 0.05,   // pts/sec when fair
    // safety & legality drift toward the (staff-buffed) premise class value
    driftRate: 0.08          // pts/sec toward target
  };

  // ---- events as CONSEQUENCES (telegraphed set-pieces, never pure RNG) ----
  //  chances are evaluated per in-game day, scaled by how unsafe / illegal the premises are.
  var EVENTS = {
    // FIRE — caused by low physical safety. risk grows as safety drops below this floor.
    // Thresholds are set so the cheapest premises actually carry the risk the owner's
    // vision intends ("пожар = купил помещение с безопасностью 60% вместо 90%"): the
    // basement (safety 55%) sits in the armed band, while legit premises (office 82%+)
    // are safe. warnBelow > armBelow so a hazard is ALWAYS telegraphed before it can ignite.
    fire: {
      warnBelow: 68,         // telegraph a hazard warning when safety% < this
      armBelow: 62,          // below this, a fire can actually ignite (basement 55% is armed)
      // per-day ignition chance = base * ((armBelow - safety) / armBelow), capped
      chancePerDayMax: 0.18,
      warnCooldownDays: 6,   // don't nag more often than this
      recoverCooldownDays: 5 // can't be hit again immediately after a fire
    },
    // LAWSUIT — caused by low legality. fine scales with your scale (cash on hand).
    // Same reachability: basement legality 60% is armed; office+ (85%+) is safe.
    lawsuit: {
      warnBelow: 70,
      armBelow: 66,
      chancePerDayMax: 0.16,
      finePctCash: 0.18,     // fine = 18% of current cash (liquidity hit), min floor below
      fineMin: 40,
      legalityHit: 8,        // legality drops by this many points on a suit
      warnCooldownDays: 6
    },
    // BOARD OF DIRECTORS — convenes once the company is a real business (first model + scale).
    // If liquidity stays critical it warns, then the existing bankruptcy path forces shutdown.
    board: {
      conveneCash: 5000,     // board convenes the first time cash crosses this (you "raised")
      warnGraceDays: 3       // once overdue, board warns this many days before the plug (cfg below)
    }
  };

  // ---- rivals (scripted power/price curves vs real time) ----
  // each: power(t) and price are functions of elapsed game-days. V computed like player.
  //  Re-paced for the long ~26-tier ladder. Two coupled changes vs the old short campaign:
  //   • doublingDays 6 -> 8 — rivals still grow exponentially (a real race) but no longer
  //     out-double the player so fast that the player's market share (hence revenue) collapses
  //     to zero by mid-game; share now degrades GRACEFULLY (≈0.73 at day 150), so a competent
  //     player stays solvent and can keep funding the climb to Singularity.
  //   • agiAt 1.5e7 -> 5.0e7 — the fastest rival (openmind) now tops out this threshold around
  //     day ~184 instead of ~128, opening a genuine 130–170-day window for the player to reach
  //     Singularity (4e7 power) first. The race stays close: lose the tempo and a rival wins.
  var RIVALS = [
    { id: 'openmind',  power0: 4,   growth: 1.9,  price: 5.5, approval: 0.8, agiAt: 5.0e7 },
    { id: 'deepcore',  power0: 2,   growth: 2.1,  price: 7.0, approval: 0.7, agiAt: 5.0e7 },
    { id: 'nebula',    power0: 1,   growth: 2.0,  price: 6.0, approval: 0.75, agiAt: 5.0e7 }
  ];
  var RIVAL_CFG = {
    // power(days) = power0 × growth^(days / doublingDays)
    doublingDays: 8
  };

  // ---- starting state ----
  var START = {
    cash: 50,
    premise: 'garage'
  };

  // minimal ads stub (infra ads.js reads this; SDK-gated, no-op on plain web)
  var ADS = { INTERSTITIAL_COOLDOWN: 120 };

  var SETTINGS = {
    SAVE_KEY: 'singularity_inc_save_v2',
    SAVE_VERSION: 1,
    AUTOSAVE_INTERVAL: 5,
    TICK_MAX_DELTA: 0.25
  };

  window.GAME_CONFIG = {
    DAY_SEC: DAY_SEC, WEEK_DAYS: WEEK_DAYS, MONTH_DAYS: MONTH_DAYS,
    TAP: TAP,
    HARDWARE: HARDWARE, HWBYID: HWBYID,
    PREMISES: PREMISES, PREMBYID: PREMBYID,
    VERSIONS: VERSIONS, AGI_VERSION: AGI_VERSION,
    TRAIN: TRAIN, ECON: ECON, BILLS: BILLS, EVENTS: EVENTS, PRICE_NUDGE: PRICE_NUDGE,
    STAFF: STAFF, STAFFBYID: STAFFBYID, STAFF_CFG: STAFF_CFG,
    RISK: RISK, RIVALS: RIVALS, RIVAL_CFG: RIVAL_CFG,
    START: START, ADS: ADS, SETTINGS: SETTINGS
  };
})();
