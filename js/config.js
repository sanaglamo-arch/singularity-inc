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
  // RP gained on release = floor( K * sqrt(totalEarnedThisRun / SCALE) ).
  // Each RP grants +BONUS to the PERMANENT global multiplier, FOREVER (baseline passive,
  // shown loudly at the release screen). The shop below is structural choice ON TOP.
  var PRESTIGE = {
    K: 1.4,               // RP gain rate (tuned so the first release lands ~35-45 min)
    SCALE: 1e6,
    BONUS: 0.05,          // +5% per RP to global mult, permanent
    MIN_TO_PRESTIGE: 1,   // engine floor: need >=1 RP to be allowed at all
    FIRST_RP: 5,          // the guided first-release CTA waits until the gain is this juicy
    // prestige (RP-bought) permanent upgrades. NO flat starting-cash items — starting
    // boosts are SCALING (% of your best run) or STRUCTURAL (keep generator levels).
    upgrades: [
      { id: 'p_mult1',   type: 'globalMult',  value: 2,    cost: 5 },
      { id: 'p_tap',     type: 'tapMult',     value: 10,   cost: 10 },
      { id: 'p_align',   type: 'alignBoost',  value: 2,    cost: 20 }, // alignment suppression x2
      { id: 'p_offline', type: 'offlineCap',  value: 4,    cost: 25 }, // +4h offline cap
      { id: 'p_seed',    type: 'startCashPct', value: 0.03, cost: 40 }, // start each run with 3% of best run
      { id: 'p_mult2',   type: 'globalMult',  value: 3,    cost: 50 },
      { id: 'p_keepgen', type: 'keepGens',    value: 0.06, cost: 120 }, // keep 6% of every generator level
      { id: 'p_offline2',type: 'offlineCap',  value: 12,   cost: 200 }, // +12h offline cap
      { id: 'p_mult3',   type: 'globalMult',  value: 5,    cost: 500 },
      { id: 'p_seed2',   type: 'startCashPct', value: 0.10, cost: 1500 }, // start with 10% of best run
      { id: 'p_mult4',   type: 'globalMult',  value: 10,   cost: 5000 }  // late-game global x10
    ]
  };

  // ---- Progressive-unlock schedule (player journey) --------------------
  // Sticky, monotonic gates on lifetime metrics. Stage 1 (Garage) shows ONLY the
  // tap->buy loop; depth reveals as the player grows. See BALANCE.md.
  var UNLOCKS = {
    BUYMODES_EARNED: 250,    // reveal x10/x100/Max bulk buying
    UPGRADES_EARNED: 500,    // reveal the Upgrades tab (first upgrade costs 500)
    INSIGHT_EARNED: 1500,    // the first delightful Insight-Flash surprise can appear
    BREAKTHROUGH_EARNED: 2.5e4, // reveal the Breakthrough ability
    MANAGERS_EARNED: 6e4,    // reveal Managers (manual buying is getting tedious)
    WORLD_RP: 70             // Stage 6 "Industry" (News/Trust/Market/Rivals) opens a bit
                             // after the first release; also opens at prestiges>=2
  };

  // ---- Risk / Alignment (signature mechanic) ---------------------------
  var RISK = {
    MAX: 100,
    // risk gained/sec = GAIN * capabilityFactor, capabilityFactor = log10(cps+10)/CAP_DIV
    GAIN: 0.55,
    CAP_DIV: 3,
    // each Alignment unit suppresses risk/sec by SUPPRESS (x alignBoost). R13: lowered
    // 0.20->0.12 so alignment is an ONGOING investment that scales with capability
    // (you keep funding it as you grow) instead of a trivial 5-and-done toggle.
    SUPPRESS: 0.12,
    alignBaseCost: 200,
    alignGrowth: 1.16,        // cost(n) = alignBaseCost * growth^owned (gentler so ongoing funding stays affordable)
    // incident
    INCIDENT_THRESHOLD: 100,
    INCIDENT_PENALTY: 0.20,   // output multiplied by this during incident
    INCIDENT_DURATION: 90,    // seconds (auto-resolves)
    INCIDENT_RESET_RISK: 35,  // a vector is reset to this after its crisis fires
    WARN_AT: 75,              // UI warns above this
    // ---- Multi-vector risk (replaces the single spam-defeatable bar) ----
    VECTORS: ['cap', 'data', 'reg', 'sec'],
    DATA_GENS: ['dataCenter', 'neuroArray', 'quantumNode', 'orbital', 'dysonSwarm', 'matrioshka'],
    CAP_GAIN: 0.5,            // capability: from output growth (log cps)
    DATA_GAIN: 0.0011,       // privacy/data: per data-heavy generator owned, /sec
    REG_BASE: 0.015,         // regulatory: small base drift /sec
    REG_DECAY: 0.05,         // regulatory decays toward 0 when below spikes
    REG_PRESTIGE_SPIKE: 11,  // hype: each model release bumps regulatory
    SEC_GAIN: 0.09,          // security: accrues over time /sec
    SUPPRESS_SHARE: 0.5,     // alignment suppression applied to data/reg/sec (cap gets full)
    // Reactive Audit: preemptive, costs cash, on cooldown — NOT an instant crisis-clear
    AUDIT_CUT: 35,           // reduces the highest vector by this
    AUDIT_FRAC: 0.18,        // cost = this fraction of current cash
    AUDIT_CD: 120,           // cooldown (seconds)
    // Crisis cadence — a global cooldown spaces crises out (anti-nag). Gentle early,
    // more pressure later: cooldown = clamp(BASE - prestiges*3 - singularities*10).
    CRISIS_CD_BASE: 165, CRISIS_CD_MIN: 95,
    // Escalation: an ignored crisis hits harder + longer than a handled one.
    ESCALATE_DUR_MULT: 1.6, ESCALATE_TRUST: 10
  };

  // ---- Tap -------------------------------------------------------------
  var TAP = { base: 2 };

  // ---- Offline ---------------------------------------------------------
  var OFFLINE = {
    BASE_CAP_HOURS: 8,
    AD_CAP_HOURS: 24,        // when watching rewarded ad
    RATE: 0.5                // offline earns 50% of current cps
  };

  // Anti-printer: every "X seconds of production" windfall (insight Eureka, event
  // grant, ad cash, news cashGift) is (a) computed from BASE cps — transient buffs
  // like Breakthrough/Frenzy/Hype no longer inflate it — and (b) capped at this
  // fraction of your best proven run, so windfalls can never self-compound into a
  // printer. (News cashGift uses its own tighter CARDS.CASHGIFT_CAP_FRAC.)
  var WINDFALL = { CAP_FRAC: 0.08 };

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
    UNLOCK_RP: 1200,           // unlocks at this lifetime RP ...
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

  // ---- Narrative campaign: Acts (monotonic, derived from lifetime progress) ----
  var ACTS = [
    { id: 'garage' },       // 0: start
    { id: 'startup' },      // 1: first generator owned
    { id: 'frontier' },     // 2: first model release (prestige)
    { id: 'race' },         // 3: rivals revealed (prestiges>=2 or totalRP>=120)
    { id: 'singularity' }   // 4: first Singularity reached (stays here; race+endings loop)
  ];

  // ---- Rival labs — the Race to AGI (revealed at Act 3) -----------------
  var RIVALS = [
    { id: 'helion',  speed: 0.0150 },  // reckless front-runner
    { id: 'cerebra', speed: 0.0110 },  // steady
    { id: 'omninet', speed: 0.0085 }   // cautious
  ];
  var RACE = {
    REVEAL_ACT: 3,
    PLAYER_TARGET_RP: 700,  // your AGI% = 100 * rp / TARGET (100% ~ when you can Ascend)
    HEAT: 0.6,              // as the leader nears AGI, everyone speeds up (climax tension)
    SLOW_OPENSOURCE: 14,    // open-sourcing knocks the leading rival back this much AGI%
    RECKLESS_RIVAL_BONUS: 0.4 // racing recklessly (low alignment) lets rivals gain faster too
  };

  // ---- Endings (resolve at the AGI climax; each = badge + small meta-perk) ----
  var ENDINGS = {
    PERK_PER: 0.04,         // +4% permanent global output per UNIQUE ending unlocked
    list: ['aligned', 'foom', 'nationalized', 'beaten', 'quiet'],
    // thresholds evaluated at ascension (avgVec = mean of risk vectors)
    QUIET_TRUST: 85, QUIET_AVGVEC: 18,
    NATIONALIZED_TRUST: 30, NATIONALIZED_AVGVEC: 65, NATIONALIZED_ESC: 3,
    FOOM_ALIGN: 3, FOOM_CAP: 55
  };

  // ---- Trust / Reputation ----------------------------------------------
  // Trust matters every second: output x scales 0.90 (trust 0) -> 1.00 (50) -> 1.10 (100).
  // High Trust unlocks premium contracts; low Trust adds regulatory pressure.
  var TRUST = { START: 60, MAX: 100, MIN: 0, OUTPUT_LO: 0.90, OUTPUT_HI: 1.10, LOW_REG_PRESSURE: 0.04 };

  // ---- Unified card system: crises + news decisions + opportunities -----
  // effect keys: cashFrac (-fraction of cash), trust (+/-), vec {id:delta},
  // penaltySec (output crisis penalty), allMult (one-time permanent x), cashGift (x seconds of cps)
  var CARDS = {
    CRISIS_EXPIRE: 28,        // seconds to decide before a crisis escalates
    NEWS_MIN: 100, NEWS_MAX: 180, // seconds between news/opportunity spawns
    NEWS_LIFE: 45,            // seconds an actionable news item stays
    // Anti-printer cap: any single cash windfall (cashGift) is capped at this
    // fraction of your best proven run, so World cards stay a bonus — never a
    // self-compounding money printer. cashGift values below are "seconds of cps".
    CASHGIFT_CAP_FRAC: 0.04,
    crises: [
      { id: 'c_cap', vector: 'cap', choices: [
        { id: 'pull',   effect: { cashFrac: -0.18 } },
        { id: 'spin',   effect: { trust: -10, vec: { reg: 18 } } },
        { id: 'ignore', effect: { penaltySec: 90 } } ] },
      { id: 'c_data', vector: 'data', choices: [
        { id: 'disclose', effect: { cashFrac: -0.15, trust: 6 } },
        { id: 'coverup',  effect: { trust: -16, vec: { reg: 22 } } },
        { id: 'ignore',   effect: { penaltySec: 90 } } ] },
      { id: 'c_reg', vector: 'reg', choices: [
        { id: 'comply', effect: { cashFrac: -0.12, trust: 8 } },
        { id: 'lobby',  effect: { cashFrac: -0.3, trust: -6 } },
        { id: 'ignore', effect: { penaltySec: 90, trust: -4 } } ] },
      { id: 'c_sec', vector: 'sec', choices: [
        { id: 'patch',  effect: { cashFrac: -0.14 } },
        { id: 'ransom', effect: { cashFrac: -0.28, trust: -5 } },
        { id: 'ignore', effect: { penaltySec: 90, vec: { sec: 20 } } } ] },
      { id: 'c_cap2', vector: 'cap', choices: [
        { id: 'sandbox', effect: { cashFrac: -0.16 } },
        { id: 'ship',    effect: { trust: -12, vec: { reg: 16 } } },
        { id: 'ignore',  effect: { penaltySec: 90 } } ] },
      { id: 'c_reg2', vector: 'reg', choices: [
        { id: 'settle',  effect: { cashFrac: -0.2, trust: 6 } },
        { id: 'appeal',  effect: { cashFrac: -0.1, vec: { reg: 14 } } },
        { id: 'ignore',  effect: { penaltySec: 90, trust: -5 } } ] },
      { id: 'c_data2', vector: 'data', choices: [
        { id: 'optout',  effect: { cashFrac: -0.13, trust: 5 } },
        { id: 'sell',    effect: { cashGift: 120, trust: -14, vec: { reg: 18 } } },
        { id: 'ignore',  effect: { penaltySec: 90 } } ] }
    ],
    // news decisions (two-choice) + opportunities (single act). gated behind progress.
    news: [
      { id: 'n_oss', kind: 'decision', choices: [
        { id: 'match',  effect: { cashFrac: -0.2, trust: 4 } },
        { id: 'ignore', effect: { penaltySec: 45 } } ] },
      { id: 'n_poach', kind: 'decision', choices: [
        { id: 'counter', effect: { cashFrac: -0.15 } },
        { id: 'letgo',   effect: { vec: { sec: 12 } } } ] },
      { id: 'n_round', kind: 'opportunity', choices: [
        { id: 'raise', effect: { cashGift: 240, trust: -3 } } ] },
      { id: 'n_chip', kind: 'opportunity', choices: [
        { id: 'buy', effect: { allMult: 1.05 } } ] },
      { id: 'n_grant', kind: 'opportunity', req: { trust: 70 }, choices: [
        { id: 'accept', effect: { cashGift: 300, trust: 3 } } ] },
      { id: 'n_defense', kind: 'opportunity', req: { trust: 85 }, choices: [
        { id: 'sign', effect: { cashGift: 420, vec: { reg: 12 } } } ] },
      { id: 'n_viral', kind: 'decision', choices: [
        { id: 'lean',  effect: { trust: -6, cashGift: 180, vec: { reg: 10 } } },
        { id: 'damp',  effect: { trust: 5 } } ] },
      { id: 'n_whistle', kind: 'decision', choices: [
        { id: 'address', effect: { cashFrac: -0.12, trust: 8 } },
        { id: 'silence', effect: { trust: -15, vec: { sec: 14 } } } ] },
      { id: 'n_audit', kind: 'opportunity', choices: [
        { id: 'invite', effect: { trust: 7, cashFrac: -0.08 } } ] }
    ]
  };

  // ---- Market / investing minigame -------------------------------------
  // R13 anti-printer rework: a BOUNDED RANDOM WALK (REVERT 0) — no mean-reversion
  // edge, so buy-low/sell-high is a coin-flip that loses to the fee on average. A
  // mean-reverting market is provably exploitable (a patient trader compounds the
  // reversion edge into a money printer — the old tuning printed 25,000× in 4h of
  // perfect play). With zero drift + a real 4% fee, even a perfect 4h bot nets only
  // a few× a bankroll on the bounded price band — a flavor skill/luck bonus that can
  // never rival (let alone fund) the exponential generator economy. See BALANCE.md.
  var MARKET = {
    VOL: 0.045,              // per-update volatility (visible ±25% swings)
    REVERT: 0,               // ZERO drift: driftless random walk -> no systematic edge
    BAND: 0.25,              // soft price band: anchor*(1±BAND) keeps prices sane
    TICK: 5,                 // seconds between price updates
    FEE: 0.04,               // 4% per side (8% round-trip) -> churn loses to fees
    assets: [
      { id: 'CMP', start: 100, vol: 1.0 },  // Compute Futures
      { id: 'NVX', start: 240, vol: 1.3 },  // Chip Co (spiky)
      { id: 'DTA', start: 60,  vol: 1.1 },  // Data Corp
      { id: 'ALN', start: 150, vol: 0.45 }  // Safety ETF (calm)
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

  // ====================================================================
  // GDD v3 — CONTINUOUS NO-RESET META (model generations, real-time processes)
  // ====================================================================

  // ---- Core resources / economy (continuous growth) -------------------
  // Generators now PRODUCE COMPUTE (the bottleneck). Money comes from your
  // deployed product (current model generation) × market share. See GAME-DESIGN.md §2-§4.
  var CORE = {
    // generator output (baseOut in GENERATORS) is COMPUTE/sec, not money.
    COMPUTE_PER_OUT: 1,
    TAP_COMPUTE: 2,            // compute per tap (overclock combo still multiplies)
    // product revenue: money/sec = REV_BASE * genRevenueMult * (1 + marketShare/100) * computeFactor
    REV_BASE: 0.15,           // tuned in P9
    REV_COMPUTE_FACTOR: 0.10, // (legacy) gentle log scaling
    REV_PER_COMPUTE: 0.5,     // money/sec per compute/sec of infra (product serves users ∝ compute)
    // valuation = annual revenue run-rate × multiple (clean; no double-count)
    SECONDS_YEAR: 31536000,
    VAL_REV_MULT: 20,         // ARR multiple (≈ real frontier-lab multiples)
    START_MONEY: 0
  };

  // ---- Model generations (replaces prestige). Forward-only ladder. ----
  // Each: trainSec (base real-time to train, shortened by researchers/boosts),
  // computeReq (compute STOCK spent to start training), revMult (PERMANENT product
  // revenue ×), share (market-share % granted on completion), id (i18n key).
  // ~month-long arc when paced with the real-time timers (balanced in P9).
  var MODELGEN = [
    { id: 'g_v1',     trainSec: 60,      computeReq: 50,        revMult: 2.2,  share: 1 },
    { id: 'g_v2',     trainSec: 180,     computeReq: 400,       revMult: 2.4,  share: 2 },
    { id: 'g_v3',     trainSec: 600,     computeReq: 4e3,       revMult: 3.0,  share: 4 },  // the "ChatGPT moment"
    { id: 'g_v4',     trainSec: 1800,    computeReq: 4e4,       revMult: 3.5,  share: 6 },
    { id: 'g_v5',     trainSec: 7200,    computeReq: 4e5,       revMult: 4.0,  share: 8 },
    { id: 'g_v6',     trainSec: 21600,   computeReq: 4e6,       revMult: 5.0,  share: 10 },
    { id: 'g_front1', trainSec: 64800,   computeReq: 5e7,       revMult: 6.0,  share: 12 }, // 18h
    { id: 'g_front2', trainSec: 129600,  computeReq: 6e8,       revMult: 7.0,  share: 14 }, // 36h
    { id: 'g_front3', trainSec: 259200,  computeReq: 8e9,       revMult: 9.0,  share: 16 }, // 3d
    { id: 'g_proto',  trainSec: 432000,  computeReq: 1e11,      revMult: 12.0, share: 18 }, // 5d proto-AGI
    { id: 'g_agi',    trainSec: 604800,  computeReq: 2e12,      revMult: 16.0, share: 22 }  // 7d — AGI (win)
  ];

  // ---- Timed processes (the month-long engine) ------------------------
  var PROCESS = {
    // training progress/sec = 1 (real time) * researcherSpeed * boostSpeed
    RESEARCHER_SPEED_PER: 0.02,  // each researcher = +2% training/build/research speed
    RESEARCHER_SPEED_CAP: 3.0,   // ≤ +300% from researchers (soft cap)
    OFFLINE_PROCESS: true,       // timers advance offline (capped by offline cap)
  };

  // ---- Researchers / talent -------------------------------------------
  var TALENT = {
    baseCost: 5e3,            // money cost of researcher #1
    growth: 1.15,             // cost(n) = baseCost * growth^hired
    UNLOCK_GEN: 2             // hiring opens once you ship v2
  };

  // ---- Finance: funding rounds (replaces twitchy market) --------------
  // Each round: one-time cash = fraction of current valuation; gated by valuation
  // milestone; raises a permanent revenue/credibility multiplier. Seed→A→B→C→IPO.
  // valReq = realistic valuation milestones (seed $15M → IPO $200B). The moneyRate
  // curve gets compressed in P9 so these gate progressively across the month.
  var FUNDING = [
    { id: 'seed', valReq: 1.5e7, cashFrac: 0.20, mult: 1.10 },
    { id: 'a',    valReq: 2e8,   cashFrac: 0.18, mult: 1.15 },
    { id: 'b',    valReq: 3e9,   cashFrac: 0.16, mult: 1.20 },
    { id: 'c',    valReq: 4e10,  cashFrac: 0.14, mult: 1.25 },
    { id: 'ipo',  valReq: 2e11,  cashFrac: 0.12, mult: 1.40 }
  ];

  // ---- Misc ------------------------------------------------------------
  var SETTINGS = {
    SAVE_KEY: 'singularity_inc_save_v1',
    SAVE_VERSION: 4,          // GDD v3 meta rewrite (no-reset generations)
    AUTOSAVE_INTERVAL: 5,     // seconds
    TICK_MAX_DELTA: 0.25      // clamp huge frame deltas (tab switch handled by offline)
  };

  window.GAME_CONFIG = {
    GENERATORS: GENERATORS,
    MILESTONES: MILESTONES,
    UPGRADES: UPGRADES,
    MANAGERS: MANAGERS,
    PRESTIGE: PRESTIGE,
    CORE: CORE,
    MODELGEN: MODELGEN,
    PROCESS: PROCESS,
    TALENT: TALENT,
    FUNDING: FUNDING,
    UNLOCKS: UNLOCKS,
    RISK: RISK,
    TAP: TAP,
    OFFLINE: OFFLINE,
    ADS: ADS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    WINDFALL: WINDFALL,
    AUTOPILOT: AUTOPILOT,
    ACTS: ACTS,
    RIVALS: RIVALS,
    RACE: RACE,
    ENDINGS: ENDINGS,
    TRUST: TRUST,
    CARDS: CARDS,
    MARKET: MARKET,
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
