// =====================================================================
//  story.js  —  window.GAME_STORY
//  Branching STORY-DECISION system for "Singularity Inc." v2.
//
//  Cinematic dilemmas (2–3 choices) that change resources/meters AND set
//  story flags that branch the plot and the ending. Fully self-contained and
//  decoupled: it READS window.GAME.state and APPLIES effects through small,
//  clamped helpers — it never reaches into game internals. The UI drives it via
//  GAME_STORY.findPending(state) (in the update loop) and GAME_STORY.applyChoice().
//  The win screen branches via GAME_STORY.endingVariant(flags).
//
//  State it owns (added to game.js freshState, persisted by the save merge):
//    state.storyFlags      — accumulating named tallies (counts/bools)
//    state.seenDecisions   — fire-once map  { decisionId -> 1 }
//    state.pendingDecision — id of the decision awaiting a choice, or null
// =====================================================================
(function () {
  'use strict';

  // ---- meter helpers (clamped 0..100 — never hard-break the game) ----
  function clamp100(v) { return v < 0 ? 0 : (v > 100 ? 100 : v); }

  // Apply one effect bag to a state. Recognised keys:
  //   cash (delta, can be negative — clamped at 0)
  //   safety / approval / legality  (delta, clamped 0..100)
  //   flag: 'name' or ['a','b']  (increment the named tally/tallies)
  // Returns the same effect bag (for chaining / logging).
  function applyEffects(state, eff) {
    if (!eff) return eff;
    if (typeof eff.cash === 'number') state.cash = Math.max(0, state.cash + eff.cash);
    if (typeof eff.safety === 'number') state.safety = clamp100(state.safety + eff.safety);
    if (typeof eff.approval === 'number') state.approval = clamp100(state.approval + eff.approval);
    if (typeof eff.legality === 'number') state.legality = clamp100(state.legality + eff.legality);
    if (eff.flag) {
      state.storyFlags = state.storyFlags || {};
      var flags = (typeof eff.flag === 'string') ? [eff.flag] : eff.flag;
      for (var i = 0; i < flags.length; i++) {
        var f = flags[i];
        state.storyFlags[f] = (state.storyFlags[f] || 0) + 1;
      }
    }
    return eff;
  }

  function flag(flags, name) { return (flags && flags[name]) || 0; }

  // =====================================================================
  //  THE DECISIONS
  //  Each: id, icon (icons.js key), title/body i18n keys, and 2–3 choices.
  //  `when(state)` is the trigger predicate (fire-once, evaluated in update()).
  //  Choices: { id, label, hint, effects, beat? }  — `beat` is an optional
  //  single consequence cutscene beat { scene, title, body } reusing GAME_CUTSCENE.
  //
  //  Magnitudes are tuned to MATTER but never hard-break winnability (sim-gated).
  //  Cash deltas scale with progress where it matters; meter deltas are bounded.
  // =====================================================================
  var DECISIONS = [
    // 0) THE FIRST BUYER  (~v1) — the very first moral fork, right after the
    //    first model goes live. Surfaces the Detroit pillar in the opening
    //    minutes (before the v2 data dilemma). Cash deltas are intentionally
    //    SMALL (sim-safe, never a skip past the v2 grind); the weight is in the
    //    meters + the path flag it plants. No setup cutscene → modal opens directly.
    {
      id: 'firstbuyer',
      icon: 'ic_cash',
      title: 'dec_first_title', body: 'dec_first_body',
      when: function (s) { return s.version >= 1; },
      choices: [
        { id: 'take',   label: 'dec_first_a_label', hint: 'dec_first_a_hint',
          effects: { cash: +500, legality: -10, approval: -8, flag: 'ruthless' } },
        { id: 'refuse', label: 'dec_first_b_label', hint: 'dec_first_b_hint',
          effects: { approval: +10, flag: 'principled' } },
        { id: 'limits', label: 'dec_first_c_label', hint: 'dec_first_c_hint',
          effects: { cash: +200, safety: +8, approval: +2, flag: 'careful' } }
      ]
    },

    // 1) DATA FOR THE NEXT MODEL  (~v2)
    {
      id: 'data',
      icon: 'ic_brain',
      title: 'dec_data_title', body: 'dec_data_body',
      when: function (s) { return s.version >= 2; },
      choices: [
        { id: 'license',  label: 'dec_data_a_label',  hint: 'dec_data_a_hint',
          effects: { cash: -2500, legality: +10, flag: 'principled' } },
        { id: 'scrape',   label: 'dec_data_b_label',  hint: 'dec_data_b_hint',
          effects: { legality: -14, approval: -4, flag: 'ruthless' },
          beat: { scene: 'garage', title: 'dec_data_b_beat_title', body: 'dec_data_b_beat_body' } },
        { id: 'synthetic',label: 'dec_data_c_label',  hint: 'dec_data_c_hint',
          effects: { cash: -800, safety: +8, flag: 'careful' } }
      ]
    },

    // 2) THE WHISTLEBLOWER  (~v3)
    {
      id: 'whistleblower',
      icon: 'ic_risk',
      title: 'dec_whistle_title', body: 'dec_whistle_body',
      when: function (s) { return s.version >= 3; },
      choices: [
        { id: 'pay',    label: 'dec_whistle_a_label', hint: 'dec_whistle_a_hint',
          effects: { cash: -6000, legality: -4, flag: 'coverup' } },
        { id: 'fire',   label: 'dec_whistle_b_label', hint: 'dec_whistle_b_hint',
          effects: { approval: -16, flag: 'ruthless' } },
        { id: 'listen', label: 'dec_whistle_c_label', hint: 'dec_whistle_c_hint',
          effects: { safety: +12, approval: +6, cash: -1500, flag: 'responsible' },
          beat: { scene: 'office', title: 'dec_whistle_c_beat_title', body: 'dec_whistle_c_beat_body' } }
      ]
    },

    // 3) INVESTOR PRESSURE  (after the board convenes OR a cash threshold)
    {
      id: 'investor',
      icon: 'ic_cash',
      title: 'dec_invest_title', body: 'dec_invest_body',
      when: function (s) { return s.boardActive || s.cash >= 50000; },
      choices: [
        { id: 'ship',     label: 'dec_invest_a_label', hint: 'dec_invest_a_hint',
          effects: { cash: +18000, safety: -16, flag: 'hype' } },
        { id: 'refuse',   label: 'dec_invest_b_label', hint: 'dec_invest_b_hint',
          effects: { cash: -4000, approval: +6, flag: 'principled' } },
        { id: 'negotiate',label: 'dec_invest_c_label', hint: 'dec_invest_c_hint',
          effects: { cash: +4000, safety: -4 } }
      ]
    },

    // 4) OPEN OR CLOSED  (~v4)
    {
      id: 'openclosed',
      icon: 'ic_insight',
      title: 'dec_open_title', body: 'dec_open_body',
      when: function (s) { return s.version >= 4; },
      choices: [
        { id: 'open',   label: 'dec_open_a_label', hint: 'dec_open_a_hint',
          effects: { approval: +18, cash: -5000, flag: 'open' },
          beat: { scene: 'office', title: 'dec_open_a_beat_title', body: 'dec_open_a_beat_body' } },
        { id: 'closed', label: 'dec_open_b_label', hint: 'dec_open_b_hint',
          effects: { cash: +9000, approval: -8, flag: 'closed' } }
      ]
    },

    // 5a) TALENT POACHING  (~v3)  — a rival raids your lead researcher.
    {
      id: 'poaching',
      icon: 'ic_manager',
      title: 'dec_poach_title', body: 'dec_poach_body',
      when: function (s) { return s.version >= 3; },
      choices: [
        { id: 'counter', label: 'dec_poach_a_label', hint: 'dec_poach_a_hint',
          effects: { cash: -7000, approval: +4, flag: 'principled' } },
        { id: 'letgo',   label: 'dec_poach_b_label', hint: 'dec_poach_b_hint',
          effects: { approval: -10, safety: -6, flag: 'careful' } },
        { id: 'sabotage',label: 'dec_poach_c_label', hint: 'dec_poach_c_hint',
          effects: { legality: -12, cash: -1500, flag: 'ruthless' },
          beat: { scene: 'rivals', title: 'dec_poach_c_beat_title', body: 'dec_poach_c_beat_body' } }
      ]
    },

    // 5b) MODEL WEIGHTS LEAK  (~v5)  — your weights are loose on the web.
    {
      id: 'leak',
      icon: 'ic_risk',
      title: 'dec_leak_title', body: 'dec_leak_body',
      when: function (s) { return s.version >= 5; },
      choices: [
        { id: 'sue',     label: 'dec_leak_a_label', hint: 'dec_leak_a_hint',
          effects: { cash: -9000, legality: +12, flag: 'principled' } },
        { id: 'openwash',label: 'dec_leak_b_label', hint: 'dec_leak_b_hint',
          effects: { approval: +14, cash: -6000, flag: ['hype', 'open'] },
          beat: { scene: 'model', title: 'dec_leak_b_beat_title', body: 'dec_leak_b_beat_body' } },
        { id: 'hush',    label: 'dec_leak_c_label', hint: 'dec_leak_c_hint',
          effects: { legality: -14, approval: -6, flag: 'coverup' } }
      ]
    },

    // 5c) COMPUTE CRISIS  (~v6)  — chips are scarce; the race waits for no one.
    {
      id: 'compute',
      icon: 'ic_bolt',
      title: 'dec_compute_title', body: 'dec_compute_body',
      when: function (s) { return s.version >= 6; },
      choices: [
        { id: 'scalp',   label: 'dec_compute_a_label', hint: 'dec_compute_a_hint',
          effects: { cash: -14000, safety: +4, flag: 'careful' } },
        { id: 'shady',   label: 'dec_compute_b_label', hint: 'dec_compute_b_hint',
          effects: { cash: -2000, safety: -12, legality: -8, flag: 'ruthless' },
          beat: { scene: 'rivals', title: 'dec_compute_b_beat_title', body: 'dec_compute_b_beat_body' } },
        { id: 'wait',    label: 'dec_compute_c_label', hint: 'dec_compute_c_hint',
          effects: { approval: +4, safety: +6, flag: 'principled' } }
      ]
    },

    // 5d) ETHICS SCANDAL  (~v7)  — a harmful output goes viral; the public turns.
    {
      id: 'scandal',
      icon: 'ic_risk',
      title: 'dec_scandal_title', body: 'dec_scandal_body',
      when: function (s) { return s.version >= 7; },
      choices: [
        { id: 'fix',     label: 'dec_scandal_a_label', hint: 'dec_scandal_a_hint',
          effects: { cash: -4000, approval: +12, safety: +10, flag: 'responsible' },
          beat: { scene: 'stakes', title: 'dec_scandal_a_beat_title', body: 'dec_scandal_a_beat_body' } },
        { id: 'spin',    label: 'dec_scandal_b_label', hint: 'dec_scandal_b_hint',
          effects: { approval: -14, flag: ['hype', 'ruthless'] } },
        { id: 'blame',   label: 'dec_scandal_c_label', hint: 'dec_scandal_c_hint',
          effects: { legality: -12, approval: -4, flag: 'coverup' } }
      ]
    },

    // 6a) GOVERNMENT DEAL  (~v6)  — the 6th idea, slotted before the pivot
    {
      id: 'govdeal',
      icon: 'ic_risk',
      title: 'dec_gov_title', body: 'dec_gov_body',
      when: function (s) { return s.version >= 6; },
      choices: [
        { id: 'accept', label: 'dec_gov_a_label', hint: 'dec_gov_a_hint',
          effects: { cash: +30000, legality: +12, approval: -10, flag: 'closed' } },
        { id: 'public', label: 'dec_gov_b_label', hint: 'dec_gov_b_hint',
          effects: { approval: +14, legality: -8, flag: 'principled' } },
        { id: 'decline',label: 'dec_gov_c_label', hint: 'dec_gov_c_hint',
          effects: { safety: +6, flag: 'careful' } }
      ]
    },

    // 6b) THE RED TEAM'S VERDICT  (~v4) — the core alignment dilemma: a danger your
    //    OWN safety team found vs the launch date. Internal conscience (where the
    //    'investor' fork is external greed). Small sim-safe cash deltas; the weight is
    //    in safety + the path flag. No setup cutscene → modal opens directly.
    {
      id: 'redteam',
      icon: 'ic_security',
      title: 'dec_redteam_title', body: 'dec_redteam_body',
      when: function (s) { return s.version >= 4; },
      choices: [
        { id: 'ship',  label: 'dec_redteam_a_label', hint: 'dec_redteam_a_hint',
          effects: { cash: +1200, safety: -12, legality: -6, flag: 'ruthless' } },
        { id: 'hold',  label: 'dec_redteam_b_label', hint: 'dec_redteam_b_hint',
          effects: { cash: -1500, safety: +14, approval: +4, flag: 'principled' } },
        { id: 'scope', label: 'dec_redteam_c_label', hint: 'dec_redteam_c_hint',
          effects: { cash: -400, safety: +8, flag: 'careful' } }
      ]
    },

    // 6) THE MODEL ASKS FOR AUTONOMY  (near v8, pre-Singularity) — PIVOTAL.
    //    The primary driver of the ending variant.
    {
      id: 'autonomy',
      icon: 'ic_brain',
      title: 'dec_auto_title', body: 'dec_auto_body',
      when: function (s) { return s.version >= 8; },
      choices: [
        { id: 'free',    label: 'dec_auto_a_label', hint: 'dec_auto_a_hint',
          effects: { approval: +10, safety: -10, flag: 'liberator' },
          beat: { scene: 'singularity', title: 'dec_auto_a_beat_title', body: 'dec_auto_a_beat_body' } },
        { id: 'contain', label: 'dec_auto_b_label', hint: 'dec_auto_b_hint',
          effects: { safety: +12, approval: -8, flag: 'controller' },
          beat: { scene: 'singularity', title: 'dec_auto_b_beat_title', body: 'dec_auto_b_beat_body' } },
        { id: 'merge',   label: 'dec_auto_c_label', hint: 'dec_auto_c_hint',
          effects: { safety: +4, approval: +4, flag: 'symbiont' },
          beat: { scene: 'singularity', title: 'dec_auto_c_beat_title', body: 'dec_auto_c_beat_body' } }
      ]
    }
  ];

  var DECISION_BY_ID = {};
  DECISIONS.forEach(function (d) { DECISION_BY_ID[d.id] = d; });

  // ---- find the first UNSEEN decision whose trigger is satisfied ----
  // Returns the decision def or null. The caller decides whether it's busy.
  function findPending(state) {
    if (!state) return null;
    state.seenDecisions = state.seenDecisions || {};
    for (var i = 0; i < DECISIONS.length; i++) {
      var d = DECISIONS[i];
      if (state.seenDecisions[d.id]) continue;
      var ok = false;
      try { ok = !!d.when(state); } catch (e) { ok = false; }
      if (ok) return d;
    }
    return null;
  }

  // Mark a decision as seen + pending (called right before the modal opens).
  function markSeen(state, id) {
    state.seenDecisions = state.seenDecisions || {};
    state.seenDecisions[id] = 1;
    state.pendingDecision = id;
  }

  // Apply the chosen option's effects, clear the pending lock. Returns the
  // chosen choice def (so the UI can fire a consequence beat / confirmation).
  function applyChoice(state, decisionId, choiceId) {
    var d = DECISION_BY_ID[decisionId];
    if (!d) { state.pendingDecision = null; return null; }
    var choice = null;
    for (var i = 0; i < d.choices.length; i++) if (d.choices[i].id === choiceId) { choice = d.choices[i]; break; }
    if (!choice) { state.pendingDecision = null; return null; }
    applyEffects(state, choice.effects);
    state.pendingDecision = null;
    return choice;
  }

  // =====================================================================
  //  ENDING VARIANT SELECTOR
  //  The autonomy choice (#6) is PRIMARY; accumulated path flags modulate.
  //  Returns one of:
  //    'symbiosis' | 'aligned' | 'rogue' | 'moloch' | 'caged' | 'default'
  //  Each maps to go_win_<variant>_{title,flavor,punch} i18n keys.
  // =====================================================================
  function endingVariant(flags, state) {
    flags = flags || {};
    var ethical = flag(flags, 'careful') + flag(flags, 'responsible') + flag(flags, 'principled');
    var dark    = flag(flags, 'ruthless') + flag(flags, 'coverup') + flag(flags, 'hype');
    var approval = state ? state.approval : 50;

    // PRIMARY: the autonomy pivot.
    if (flag(flags, 'symbiont')) return 'symbiosis';

    if (flag(flags, 'liberator')) {
      // freedom granted: rogue if the path was dark, else still benevolent-aligned
      return (dark > ethical) ? 'rogue' : 'aligned';
    }

    if (flag(flags, 'controller')) {
      // contained: a caged-but-resentful god if the public hated you / dark path,
      // a corporate moloch if you optimised for profit-over-safety + closed,
      // otherwise an aligned, safely-contained dream.
      if (approval < 35 || dark > ethical) {
        if (flag(flags, 'closed') || flag(flags, 'hype')) return 'moloch';
        return 'caged';
      }
      return 'aligned';
    }

    // No autonomy pivot recorded (e.g. raced to AGI before v8 dilemma):
    // fall back to the broad moral tilt.
    if (dark > ethical && (flag(flags, 'closed') || flag(flags, 'hype'))) return 'moloch';
    if (ethical > dark) return 'aligned';
    return 'default';
  }

  // Expose the public, decoupled API.
  // Your evolving narrative IDENTITY, derived from the choices made so far (the Detroit
  // pillar: decisions shape who you are). Returns a path key for 'path_<key>' i18n, or
  // null before any decision is made. Shown subtly in the World tab.
  function currentPath(flags) {
    flags = flags || {};
    if (!Object.keys(flags).length) return null;
    var f = function (k) { return flag(flags, k); };
    var dark = f('ruthless') + f('coverup');
    var light = f('careful') + f('responsible') + f('principled');
    if (f('coverup') >= 2 && f('coverup') >= f('principled')) return 'shadow';
    if (dark >= 2 && dark > light) return 'ruthless';
    if (light >= 2 && light > dark) return 'idealist';
    if (f('hype') >= 2) return 'hype';
    if (f('open') >= 1 && f('open') >= f('closed')) return 'open';
    return 'pragmatist';
  }

  window.GAME_STORY = {
    DECISIONS: DECISIONS,
    findPending: findPending,
    markSeen: markSeen,
    applyChoice: applyChoice,
    applyEffects: applyEffects,
    endingVariant: endingVariant,
    currentPath: currentPath,
    decisionById: function (id) { return DECISION_BY_ID[id] || null; }
  };
})();
