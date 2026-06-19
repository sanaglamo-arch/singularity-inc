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
    base: 0.063,             // $ per COLD click at level 0 (engaged avg ≈ $0.10 with разгон)
    upgrade: {
      baseCost: 10,          // first click upgrade
      costMult: 2.0,         // ×2 cost curve
      gain: 2.0,             // each upgrade ×2 the click value
      maxLevel: 30
    },
    accel: 0.04,             // a click during training adds this fraction of a "tick" of progress
    // --- overclock / разгон combo ---
    comboBonus: 0.7,         // heat=1 → ×1.7 click value
    comboWindow: 0.6,        // clicks < 600ms apart build heat
    comboStep: 0.085,        // heat added per fast click (≈12 fast clicks to redline)
    comboDecay: 0.65         // heat lost per second when you stop clicking
  };

  // ---- hardware tiers (buy with money). idle => rent/s; committed => power ----
  //  {cost, power, rent (/s), kw, m2}
  var HARDWARE = [
    { id: 'laptop',     cost: 50,        power: 1,       rent: 0,      kw: 0.04,    m2: 0.05  },
    { id: 'miniserver', cost: 40,        power: 3,       rent: 0.10,   kw: 0.04,    m2: 0.05  },
    { id: 'workstation',cost: 300,       power: 12,      rent: 0.6,    kw: 0.2,     m2: 0.3   },
    { id: 'gpuserver',  cost: 2000,      power: 70,      rent: 3.5,    kw: 1.0,     m2: 0.55  },
    { id: 'rack1u',     cost: 9000,      power: 300,     rent: 14,     kw: 0.7,     m2: 0.6   },
    { id: 'rack42u',    cost: 55000,     power: 2200,    rent: 90,     kw: 9,       m2: 2.2   },
    { id: 'airack',     cost: 380000,    power: 18000,   rent: 600,    kw: 13,      m2: 2.7   },
    { id: 'modulardc',  cost: 4.2e6,     power: 240000,  rent: 6500,   kw: 300,     m2: 25    },
    { id: 'hyperscale', cost: 1.1e8,     power: 9e6,     rent: 140000, kw: 120000,  m2: 50000 }
  ];
  var HWBYID = {};
  HARDWARE.forEach(function (h) { HWBYID[h.id] = h; });

  // ---- premises: give m² capacity (cap on hardware), upkeep, legality/safety ----
  //  {cost, m2, upkeep (/s), legality 0..1, safety 0..1}
  var PREMISES = [
    { id: 'garage',    cost: 0,        m2: 4,       upkeep: 0,     legality: 0.85, safety: 0.80 },
    { id: 'basement',  cost: 1200,     m2: 30,      upkeep: 0.05,  legality: 0.60, safety: 0.55 },
    { id: 'office',    cost: 18000,    m2: 200,     upkeep: 0.8,   legality: 0.85, safety: 0.82 },
    { id: 'bizpark',   cost: 250000,   m2: 1800,    upkeep: 9,     legality: 0.98, safety: 0.95 },
    { id: 'megacampus',cost: 6.0e6,    m2: 80000,   upkeep: 180,   legality: 0.99, safety: 0.98 }
  ];
  var PREMBYID = {};
  PREMISES.forEach(function (p) { PREMBYID[p.id] = p; });

  // ---- release / training ----
  //  power thresholds to RELEASE each version. v1 is the first; the final is AGI.
  var VERSIONS = [
    { v: 1,  powerReq: 6,        demandBase: 40,    label: 'v1' },
    { v: 2,  powerReq: 40,       demandBase: 40,    label: 'v2' },
    { v: 3,  powerReq: 220,      demandBase: 40,    label: 'v3' },
    { v: 4,  powerReq: 1200,     demandBase: 40,    label: 'v4' },
    { v: 5,  powerReq: 7000,     demandBase: 40,    label: 'v5' },
    { v: 6,  powerReq: 45000,    demandBase: 40,    label: 'v6' },
    { v: 7,  powerReq: 300000,   demandBase: 40,    label: 'v7' },
    { v: 8,  powerReq: 2.2e6,    demandBase: 40,    label: 'v8' },
    { v: 9,  powerReq: 1.5e7,    demandBase: 40,    label: 'AGI' }   // final => WIN
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
    usersInertia: 0.06,      // users += (target - users) × 0.06 per tick(=1s)
    usage: 1.0,              // tokens consumed per user
    priceMin: 0.5,
    priceMax: 40,
    priceDefault: 6
  };

  // ---- bills / costs ----
  var BILLS = {
    elecRateKwh: 0.15,       // $/kWh
    // electricity per sec = ΣkW × 0.15 / 3600
    overduePenalty: 0.30,    // -30% output while a bill is overdue
    payDeadlineDays: 1,      // 1 in-game day to pay the weekly bill
    bankruptGraceDays: 6,    // a bill overdue this many in-game days => board pulls the plug (bankrupt)
    taxRate: 0.18            // 18% of revenue earned in the month
  };

  // ---- employees (salaries accrue into bills) ----
  var STAFF = [
    { id: 'lawyer',    salary: 0.4, effect: 'legality' },   // ↓ state risk
    { id: 'security',  salary: 0.4, effect: 'safety'   },   // ↓ safety risk
    { id: 'marketer',  salary: 0.4, effect: 'approval' },   // ↑ approval
    { id: 'economist', salary: 0.4, effect: 'tax'      }    // ↓ tax
  ];
  var STAFFBYID = {};
  STAFF.forEach(function (s) { STAFFBYID[s.id] = s; });
  var STAFF_CFG = {
    hireCostMult: 90,        // first hire costs salary*this; grows
    hireCostGrowth: 1.35,
    perStaffEffect: 0.015,   // each staffer nudges its meter by 1.5 pts/effect (capped)
    maxEffect: 25,           // a meter buff caps at 25 pts from staff
    taxReductionPer: 0.005,  // economist: -0.5% tax each
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
    fire: {
      warnBelow: 60,         // telegraph a hazard warning when safety% < this
      armBelow: 45,          // below this, a fire can actually ignite
      // per-day ignition chance = base * ((armBelow - safety) / armBelow), capped
      chancePerDayMax: 0.18,
      warnCooldownDays: 6,   // don't nag more often than this
      recoverCooldownDays: 5 // can't be hit again immediately after a fire
    },
    // LAWSUIT — caused by low legality. fine scales with your scale (cash on hand).
    lawsuit: {
      warnBelow: 60,
      armBelow: 45,
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
  var RIVALS = [
    { id: 'openmind',  power0: 4,   growth: 1.9,  price: 5.5, approval: 0.8, agiAt: 1.5e7 },
    { id: 'deepcore',  power0: 2,   growth: 2.1,  price: 7.0, approval: 0.7, agiAt: 1.5e7 },
    { id: 'nebula',    power0: 1,   growth: 2.0,  price: 6.0, approval: 0.75, agiAt: 1.5e7 }
  ];
  var RIVAL_CFG = {
    // power(days) = power0 × growth^(days / doublingDays)
    doublingDays: 6
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
    TRAIN: TRAIN, ECON: ECON, BILLS: BILLS, EVENTS: EVENTS,
    STAFF: STAFF, STAFFBYID: STAFFBYID, STAFF_CFG: STAFF_CFG,
    RISK: RISK, RIVALS: RIVALS, RIVAL_CFG: RIVAL_CFG,
    START: START, ADS: ADS, SETTINGS: SETTINGS
  };
})();
