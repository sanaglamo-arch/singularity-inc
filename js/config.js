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
    { id: 'agiCore',     icon: '🌟', baseCost: 7.5e10,    growth: 1.120, baseOut: 1.6e6 },
    { id: 'dysonSwarm',  icon: '🛸', baseCost: 1.1e12,    growth: 1.125, baseOut: 9.5e6 },
    { id: 'matrioshka',  icon: '🌀', baseCost: 1.7e13,    growth: 1.130, baseOut: 5.8e7 }
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
    { id: 'u_all4',   target: 'all', mult: 5,  cost: 5.0e13,  unlock: { gen: 'agiCore', count: 25 } },
    { id: 'u_agi1',   target: 'agiCore', mult: 3, cost: 9.0e12, unlock: { gen: 'agiCore', count: 10 } },
    { id: 'u_dyson1', target: 'dysonSwarm', mult: 3, cost: 1.4e14, unlock: { gen: 'dysonSwarm', count: 10 } },
    { id: 'u_matr1',  target: 'matrioshka', mult: 3, cost: 2.2e15, unlock: { gen: 'matrioshka', count: 10 } },
    { id: 'u_all5',   target: 'all', mult: 10, cost: 1.0e16, unlock: { gen: 'matrioshka', count: 25 } }
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
      { id: 'p_start',  type: 'startCash',  value: 1e6,  cost: 40 }, // start each run with cash
      { id: 'p_mult4',  type: 'globalMult', value: 10,   cost: 5000 }, // late-game global x10
      { id: 'p_offline2', type: 'offlineCap', value: 12, cost: 200 },  // +12h offline cap
      { id: 'p_start2', type: 'startCash',  value: 1e9,  cost: 1500 }  // bigger war chest
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
    { id: 'a_prestige5',  cond: { type: 'prestiges', n: 5 }, perk: { type: 'global', value: 1.05 } },
    { id: 'a_rp100',      cond: { type: 'totalRP', n: 100 } },
    { id: 'a_agi',        cond: { type: 'gen', gen: 'agiCore', n: 1 }, perk: { type: 'global', value: 1.05 } },
    { id: 'a_align50',    cond: { type: 'align', n: 50 } },
    { id: 'a_incident',   cond: { type: 'incidents', n: 1 } },
    { id: 'a_safe',       cond: { type: 'cleanRun', n: 1 } }, // prestige with 0 incidents this run
    { id: 'a_event',      cond: { type: 'events', n: 1 } },
    { id: 'a_matrioshka', cond: { type: 'gen', gen: 'matrioshka', n: 1 } },
    { id: 'a_cash1qa',    cond: { type: 'totalCash', n: 1e15 } },
    { id: 'a_insight',    cond: { type: 'insights', n: 1 } },
    { id: 'a_breakthrough', cond: { type: 'breakthroughs', n: 1 } },
    { id: 'a_overclock',  cond: { type: 'maxheat', n: 1 } },
    { id: 'a_tech',       cond: { type: 'tech', n: 1 } },
    { id: 'a_artifact',   cond: { type: 'artifacts', n: 1 } },
    { id: 'a_singularity', cond: { type: 'singularities', n: 1 }, perk: { type: 'global', value: 1.10 } },
    { id: 'a_cores10',    cond: { type: 'cores', n: 10 }, perk: { type: 'tap', value: 2 } },
    { id: 'a_synergy',    cond: { type: 'synergy', n: 1 }, perk: { type: 'global', value: 1.05 } },
    { id: 'a_techadept',  cond: { type: 'tech', n: 6 } },
    { id: 'a_sing3',      cond: { type: 'singularities', n: 3 }, perk: { type: 'global', value: 1.15 } },
    { id: 'a_cores50',    cond: { type: 'cores', n: 50 } }
  ];

  // ---- Tap combo / Overclock heat -------------------------------------
  // Rapid tapping builds heat (0..1) that decays; tap value scales up to
  // x(1+maxBonus) at full heat. Rewards active bursts; makes TRAIN feel alive.
  var COMBO = { gainPerTap: 0.085, decayPerSec: 0.40, maxBonus: 4 };

  // ---- Insight Flash (Cookie-Clicker "golden cookie") ------------------
  // A glowing collectible drifts across the screen; tap in time for a buff.
  var INSIGHT = {
    MIN_GAP: 45, MAX_GAP: 95,   // seconds between spawns
    FIRST_DELAY: 40,            // earliest after run start
    LIFETIME: 13,              // seconds on screen before it escapes
    rewards: [
      { id: 'frenzy',      mult: 7,      duration: 30 }, // x7 global output 30s
      { id: 'clickFrenzy', tapMult: 100, duration: 15 }, // x100 tap value 15s
      { id: 'lucky',       cashSeconds: 900 }            // instant 15 min of income
    ]
  };

  // ---- Breakthrough ability (active, chainable) -----------------------
  var BREAKTHROUGH = {
    mult: 10, duration: 20, cooldown: 180,
    chainWindow: 8,            // re-fire within Ns of the last one ending => bonus
    chainMult: 15, chainDuration: 25
  };

  // ---- Generator classes (for tech/artifact category multipliers) ------
  var GEN_CLASS = {
    low:  ['laptop', 'gpuRig', 'serverRack'],
    mid:  ['gpuCluster', 'dataCenter', 'superComp', 'neuroArray'],
    high: ['quantumNode', 'orbital', 'agiCore', 'dysonSwarm', 'matrioshka']
  };

  // ---- Tech Tree (RP-gated; persists across model-release, resets on Singularity)
  // cat: tap | gen_low | gen_mid | gen_high | all | offline | risk
  // req: {} | {tech:id} | {gen:id, count:n}
  var TECH = [
    { id: 't_tap1',  cat: 'tap',      mult: 3,   cost: 12,   req: {} },
    { id: 't_low1',  cat: 'gen_low',  mult: 2,   cost: 18,   req: {} },
    { id: 't_off1',  cat: 'offline',  mult: 2,   cost: 25,   req: {} },
    { id: 't_risk1', cat: 'risk',     mult: 0.7, cost: 30,   req: {} },
    { id: 't_all1',  cat: 'all',      mult: 1.5, cost: 60,   req: { tech: 't_low1' } },
    { id: 't_mid1',  cat: 'gen_mid',  mult: 2,   cost: 90,   req: { gen: 'dataCenter', count: 25 } },
    { id: 't_tap2',  cat: 'tap',      mult: 5,   cost: 120,  req: { tech: 't_tap1' } },
    { id: 't_off2',  cat: 'offline',  mult: 3,   cost: 160,  req: { tech: 't_off1' } },
    { id: 't_all2',  cat: 'all',      mult: 2,   cost: 350,  req: { tech: 't_all1' } },
    { id: 't_high1', cat: 'gen_high', mult: 3,   cost: 600,  req: { gen: 'quantumNode', count: 10 } },
    { id: 't_risk2', cat: 'risk',     mult: 0.5, cost: 450,  req: { tech: 't_risk1' } },
    { id: 't_all3',  cat: 'all',      mult: 3,   cost: 2000, req: { tech: 't_all2' } }
  ];

  // ---- Prestige Artifacts (granted on model-release; equip up to SLOTS) -
  // tags drive synergy: each tag shared by >=2 equipped artifacts => +SYNERGY all
  var ARTIFACT_SLOTS = 3;
  var ARTIFACT_SYNERGY = 0.20; // +20% all per tag that has a matched pair equipped
  var ARTIFACTS = [
    { id: 'ar_chip',    tags: ['hw'],            effect: { type: 'allMult',     value: 1.10 } },
    { id: 'ar_cooler',  tags: ['hw', 'safety'],  effect: { type: 'riskMult',    value: 0.80 } },
    { id: 'ar_gpu',     tags: ['hw'],            effect: { type: 'genHighMult', value: 1.25 } },
    { id: 'ar_oracle',  tags: ['ai'],            effect: { type: 'tapMult',     value: 3 } },
    { id: 'ar_dataset', tags: ['ai'],            effect: { type: 'allMult',     value: 1.15 } },
    { id: 'ar_charter', tags: ['ai', 'safety'],  effect: { type: 'riskMult',    value: 0.70 } },
    { id: 'ar_vault',   tags: ['money'],         effect: { type: 'offlineMult', value: 2 } },
    { id: 'ar_fund',    tags: ['money'],         effect: { type: 'allMult',     value: 1.12 } },
    { id: 'ar_dice',    tags: ['gamble'],        effect: { type: 'gamble' } } // rolls 0.6..3.0 all, per run
  ];

  // ---- Second prestige: The Singularity (meta-currency: Singularity Cores) --
  var SINGULARITY = {
    UNLOCK_RP: 500,            // unlocks at this lifetime RP ...
    UNLOCK_GEN: 'agiCore',     // ... or once an AGI Core exists
    SCALE: 100,                // cores = floor( sqrt(rp / SCALE) * coreGainMult )
    CORE_BONUS: 0.10,          // each Core = +10% global (passive)
    meta: [                    // permanent forever (Cores), never reset
      { id: 'sm_global1', type: 'globalMult',  value: 3,    cost: 1 },
      { id: 'sm_rp',      type: 'rpGain',      value: 2,    cost: 2 },
      { id: 'sm_tap',     type: 'tapMult',     value: 10,   cost: 2 },
      { id: 'sm_risk',    type: 'riskMult',    value: 0.5,  cost: 2 },
      { id: 'sm_offline', type: 'offlineCap',  value: 24,   cost: 3 },
      { id: 'sm_global2', type: 'globalMult',  value: 5,    cost: 5 },
      { id: 'sm_core',    type: 'coreGain',    value: 2,    cost: 6 },
      { id: 'sm_global3', type: 'globalMult',  value: 10,   cost: 12 }
    ]
  };

  // ---- Random timed events --------------------------------------------
  var EVENTS = {
    MIN_GAP: 150,        // min seconds between events
    MAX_GAP: 300,        // max seconds between events
    FIRST_DELAY: 75,     // no event before this much playtime (seconds)
    list: [
      { id: 'grant',      kind: 'instant', cashSeconds: 600 },  // +10 min of production
      { id: 'hype',       kind: 'timed',   duration: 60, outputMult: 2 },
      { id: 'shortage',   kind: 'timed',   duration: 45, outputMult: 0.5 },
      { id: 'leak',       kind: 'instant', riskAdd: 25 },
      { id: 'opensource', kind: 'instant', riskAdd: -30 }
    ]
  };

  // ---- Autopilot (smart auto-buy; decoupled from managers) -------------
  var AUTOPILOT = {
    UNLOCK_PRESTIGES: 1,    // unlocks after the first model release
    DEFAULT_RESERVE: 0.5,   // keep 50% of cash by default
    FILL_RANGE: 15          // 'fill to milestone' only acts within N of the next breakpoint
  };

  // ---- Cosmetics (earned, no pay-to-win) -------------------------------
  // unlock: {} always | {prestiges:n} | {singularities:n} | {ach:n owned}
  var COSMETICS = {
    orbs: [
      { id: 'orb_default', unlock: {} },
      { id: 'orb_cyan',    unlock: { prestiges: 1 } },
      { id: 'orb_gold',    unlock: { ach: 12 } },
      { id: 'orb_crimson', unlock: { singularities: 1 } }
    ],
    themes: [
      { id: 'theme_default', unlock: {} },
      { id: 'theme_void',    unlock: { prestiges: 3 } },
      { id: 'theme_aurora',  unlock: { singularities: 1 } }
    ]
  };

  // ---- Misc ------------------------------------------------------------
  var SETTINGS = {
    SAVE_KEY: 'singularity_inc_save_v1',
    SAVE_VERSION: 2,
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
    AUTOPILOT: AUTOPILOT,
    COSMETICS: COSMETICS,
    EVENTS: EVENTS,
    COMBO: COMBO,
    INSIGHT: INSIGHT,
    BREAKTHROUGH: BREAKTHROUGH,
    GEN_CLASS: GEN_CLASS,
    TECH: TECH,
    ARTIFACTS: ARTIFACTS,
    ARTIFACT_SLOTS: ARTIFACT_SLOTS,
    ARTIFACT_SYNERGY: ARTIFACT_SYNERGY,
    SINGULARITY: SINGULARITY,
    SETTINGS: SETTINGS
  };
})();
