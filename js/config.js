/* Singularity Inc. — central config: ALL tunable economy numbers live here.
   Exposed as window.GAME_CONFIG. No logic, just data. */
(function () {
  'use strict';

  // ---- Generators (hardware tiers) -------------------------------------
  // cost(n) = baseCost * growth^(owned).  out = baseOut per unit / sec.
  // Numbers mirror a proven AdCap-style curve, retuned for this theme.
  var GENERATORS = [
    { id: 'laptop',      icon: '💻', baseCost: 15,        growth: 1.070, baseOut: 0.10 },
    { id: 'gpuRig',      icon: '🎛️', baseCost: 110,       growth: 1.075, baseOut: 1.0 },
    { id: 'serverRack',  icon: '🗄️', baseCost: 1200,      growth: 1.080, baseOut: 8.0 },
    { id: 'gpuCluster',  icon: '⚡',      baseCost: 13000,     growth: 1.085, baseOut: 47 },
    { id: 'dataCenter',  icon: '🏢', baseCost: 140000,    growth: 1.090, baseOut: 260 },
    { id: 'superComp',   icon: '🖥️', baseCost: 1.6e6,     growth: 1.095, baseOut: 1400 },
    { id: 'neuroArray',  icon: '🧠', baseCost: 2.0e7,     growth: 1.100, baseOut: 7800 },
    { id: 'quantumNode', icon: '⚛️', baseCost: 3.3e8,     growth: 1.105, baseOut: 44000 },
    { id: 'orbital',     icon: '🛰️', baseCost: 5.1e9,     growth: 1.110, baseOut: 2.6e5 },
    { id: 'agiCore',     icon: '🌟', baseCost: 7.5e10,    growth: 1.120, baseOut: 1.6e6 }
  ];

  // Owned-count milestones that each multiply that generator's output x2.
  var MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500];

  // ---- Global upgrades (one-time multiplier purchases) ------------------
  // target 'all' = global mult; or a generator id = that generator only.
  // mult is multiplicative. unlock = {gen, count} requires owned>=count.
  var UPGRADES = [
    { id: 'u_tap1',   target: 'tap', mult: 2,  cost: 500,     unlock: null },
    { id: 'u_tap2',   target: 'tap', mult: 3,  cost: 50000,   unlock: { gen: 'laptop', count: 25 } },
    { id: 'u_lap1',   target: 'laptop',     mult: 2, cost: 1000,    unlock: { gen: 'laptop', count: 10 } },
    { id: 'u_rig1',   target: 'gpuRig',     mult: 2, cost: 9000,    unlock: { gen: 'gpuRig', count: 10 } },
    { id: 'u_rack1',  target: 'serverRack', mult: 2, cost: 90000,   unlock: { gen: 'serverRack', count: 10 } },
    { id: 'u_clus1',  target: 'gpuCluster', mult: 2, cost: 1.0e6,   unlock: { gen: 'gpuCluster', count: 10 } },
    { id: 'u_dc1',    target: 'dataCenter', mult: 2, cost: 1.1e7,   unlock: { gen: 'dataCenter', count: 10 } },
    { id: 'u_all1',   target: 'all', mult: 2,  cost: 2.5e6,   unlock: { gen: 'serverRack', count: 25 } },
    { id: 'u_all2',   target: 'all', mult: 2,  cost: 5.0e8,   unlock: { gen: 'dataCenter', count: 50 } },
    { id: 'u_super1', target: 'superComp', mult: 3, cost: 2.0e8, unlock: { gen: 'superComp', count: 10 } },
    { id: 'u_neuro1', target: 'neuroArray', mult: 3, cost: 2.5e9, unlock: { gen: 'neuroArray', count: 10 } },
    { id: 'u_all3',   target: 'all', mult: 3,  cost: 1.0e11,  unlock: { gen: 'quantumNode', count: 25 } },
    { id: 'u_quant1', target: 'quantumNode', mult: 3, cost: 4.0e10, unlock: { gen: 'quantumNode', count: 10 } },
    { id: 'u_orb1',   target: 'orbital', mult: 3, cost: 6.0e11, unlock: { gen: 'orbital', count: 10 } },
    { id: 'u_all4',   target: 'all', mult: 5,  cost: 5.0e13,  unlock: { gen: 'agiCore', count: 25 } }
  ];

  // ---- Managers (automation: auto-buy a generator) ---------------------
  // Buying a manager auto-purchases that generator whenever affordable and
  // grants +50% to its output. cost in cash.
  var MANAGERS = GENERATORS.map(function (g, i) {
    return { id: 'm_' + g.id, gen: g.id, mult: 1.5, cost: g.baseCost * (i < 2 ? 40 : 60) };
  });

  // ---- Prestige --------------------------------------------------------
  // RP gained on prestige = floor( PRESTIGE_K * sqrt(totalEarnedThisRun / PRESTIGE_SCALE) )
  // Each RP grants +PRESTIGE_BONUS global multiplier (additive on a base of 1).
  var PRESTIGE = {
    K: 1,
    SCALE: 1e6,
    BONUS: 0.05,          // +5% per RP to global mult
    MIN_TO_PRESTIGE: 1,   // need at least 1 RP to be allowed
    // prestige (RP-bought) permanent upgrades
    upgrades: [
      { id: 'p_mult1',  type: 'globalMult', value: 2,    cost: 5 },
      { id: 'p_mult2',  type: 'globalMult', value: 3,    cost: 50 },
      { id: 'p_mult3',  type: 'globalMult', value: 5,    cost: 500 },
      { id: 'p_tap',    type: 'tapMult',    value: 10,   cost: 10 },
      { id: 'p_offline',type: 'offlineCap', value: 4,    cost: 25 }, // +4h offline cap
      { id: 'p_align',  type: 'alignBoost', value: 2,    cost: 20 }, // alignment suppression x2
      { id: 'p_start',  type: 'startCash',  value: 1e6,  cost: 40 }  // start each run with cash
    ]
  };

  // ---- Risk / Alignment (signature mechanic) ---------------------------
  var RISK = {
    MAX: 100,
    // risk gained/sec = GAIN * capabilityFactor, capabilityFactor = log10(cps+10)/CAP_DIV
    GAIN: 0.55,
    CAP_DIV: 3,
    // each Alignment unit suppresses risk/sec by SUPPRESS (x alignBoost)
    SUPPRESS: 0.20,
    alignBaseCost: 200,
    alignGrowth: 1.18,        // cost(n) = alignBaseCost * growth^owned
    // incident
    INCIDENT_THRESHOLD: 100,
    INCIDENT_PENALTY: 0.20,   // output multiplied by this during incident
    INCIDENT_DURATION: 90,    // seconds (auto-resolves)
    INCIDENT_RESET_RISK: 35,  // risk after an incident resolves
    CONTAIN_COST_FRAC: 0.35,  // pay this fraction of current cash to contain instantly
    WARN_AT: 75               // UI warns above this
  };

  // ---- Tap -------------------------------------------------------------
  var TAP = { base: 2 };

  // ---- Offline ---------------------------------------------------------
  var OFFLINE = {
    BASE_CAP_HOURS: 8,
    AD_CAP_HOURS: 24,        // when watching rewarded ad
    RATE: 0.5                // offline earns 50% of current cps
  };

  // ---- Ad boosts -------------------------------------------------------
  var ADS = {
    BOOST_MULT: 2,           // 2x earnings
    BOOST_DURATION: 2 * 3600,// 2 hours
    CASH_BURST_SECONDS: 600, // instant cash = 10 min of production
    INTERSTITIAL_COOLDOWN: 120 // min seconds between interstitials
  };

  // ---- Achievements ----------------------------------------------------
  // check: function(state) -> bool. Defined in game.js via ids; metadata here.
  var ACHIEVEMENTS = [
    { id: 'a_firstTap',   cond: { type: 'taps', n: 1 } },
    { id: 'a_tap100',     cond: { type: 'taps', n: 100 } },
    { id: 'a_firstGen',   cond: { type: 'anyGen', n: 1 } },
    { id: 'a_lap50',      cond: { type: 'gen', gen: 'laptop', n: 50 } },
    { id: 'a_cash1m',     cond: { type: 'totalCash', n: 1e6 } },
    { id: 'a_cash1b',     cond: { type: 'totalCash', n: 1e9 } },
    { id: 'a_cash1t',     cond: { type: 'totalCash', n: 1e12 } },
    { id: 'a_prestige1',  cond: { type: 'prestiges', n: 1 } },
    { id: 'a_prestige5',  cond: { type: 'prestiges', n: 5 } },
    { id: 'a_rp100',      cond: { type: 'totalRP', n: 100 } },
    { id: 'a_agi',        cond: { type: 'gen', gen: 'agiCore', n: 1 } },
    { id: 'a_align50',    cond: { type: 'align', n: 50 } },
    { id: 'a_incident',   cond: { type: 'incidents', n: 1 } },
    { id: 'a_safe',       cond: { type: 'cleanRun', n: 1 } } // prestige with 0 incidents this run
  ];

  // ---- Misc ------------------------------------------------------------
  var SETTINGS = {
    SAVE_KEY: 'singularity_inc_save_v1',
    SAVE_VERSION: 1,
    AUTOSAVE_INTERVAL: 5,     // seconds
    TICK_MAX_DELTA: 0.25      // clamp huge frame deltas (tab switch handled by offline)
  };

  window.GAME_CONFIG = {
    GENERATORS: GENERATORS,
    MILESTONES: MILESTONES,
    UPGRADES: UPGRADES,
    MANAGERS: MANAGERS,
    PRESTIGE: PRESTIGE,
    RISK: RISK,
    TAP: TAP,
    OFFLINE: OFFLINE,
    ADS: ADS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    SETTINGS: SETTINGS
  };
})();
