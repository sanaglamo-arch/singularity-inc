/*
 * Singularity Inc. — cohesive premium SVG icon set.
 *
 * Art direction: "neon-cosmos × adult, Detroit-toned".
 *   - Shared 24×24 grid, consistent 1.6 stroke, round joins/caps.
 *   - Every icon is themed through `currentColor` so the existing
 *     wrappers ([data-cls], .ms1/2/3, #tabbar .ti, etc.) keep driving color.
 *   - A restrained accent is added per icon: a `currentColor` linear gradient
 *     (opacity ramp, NOT a hue shift) plus a subtle soft-light fill, giving
 *     depth without fighting the theme color. Gradient/filter ids are unique
 *     per icon to avoid <defs> collisions when many render on one page.
 *   - No width/height on the <svg> — CSS controls render size, exactly like
 *     the previous set. No external refs, no url(file), self-contained.
 *
 * Public API is preserved: window.GAME_ICONS = { key: '<svg…>' }.
 * ui.js does `ic(key) => (window.GAME_ICONS||{})[key] || ''`.
 */

(function () {

  // Shared <defs>: a per-icon currentColor opacity-ramp gradient ("sheen")
  // + a soft fill gradient. Cheap, inline, unique id via the icon key.
  function defs(id) {
    return (
      '<defs>' +
        '<linearGradient id="' + id + 's" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0" stop-color="currentColor" stop-opacity="1"/>' +
          '<stop offset="1" stop-color="currentColor" stop-opacity="0.62"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + id + 'f" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0" stop-color="currentColor" stop-opacity="0.34"/>' +
          '<stop offset="1" stop-color="currentColor" stop-opacity="0.06"/>' +
        '</linearGradient>' +
      '</defs>'
    );
  }

  // Build an svg from inner markup. `id` seeds the gradient ids.
  // Stroke uses the sheen gradient; fills use the soft fill gradient.
  function svg(id, inner, extra) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="url(#' + id + 's)" ' +
        'stroke-width="' + (extra && extra.sw ? extra.sw : '1.6') + '" ' +
        'stroke-linecap="round" stroke-linejoin="round">' +
        defs(id) + inner +
      '</svg>'
    );
  }

  // shorthand: soft accent fill reference
  function FF(id) { return 'url(#' + id + 'f)'; }
  // shorthand: solid currentColor dots/accents
  var DOT = 'fill="currentColor" stroke="none"';

  var G = {};

  // ── Generators ────────────────────────────────────────────────────────────

  G.gen_laptop = svg('glp',
    '<rect x="3" y="4" width="18" height="12" rx="2" fill="' + FF('glp') + '"/>' +
    '<rect x="6" y="7" width="12" height="6" rx="1" stroke-opacity="0.5"/>' +
    '<line x1="2" y1="20" x2="22" y2="20"/><line x1="9.5" y1="20" x2="14.5" y2="20" stroke-opacity="0.45"/>' +
    '<circle cx="12" cy="16" r="0.6" ' + DOT + '/>');

  G.gen_gpuRig = svg('grg',
    '<rect x="2.5" y="3.5" width="19" height="5" rx="1.2" fill="' + FF('grg') + '"/>' +
    '<rect x="2.5" y="9.75" width="19" height="5" rx="1.2"/>' +
    '<rect x="2.5" y="16" width="19" height="4.5" rx="1.2"/>' +
    '<line x1="6" y1="3.5" x2="6" y2="8.5" stroke-opacity="0.55"/><line x1="10" y1="3.5" x2="10" y2="8.5" stroke-opacity="0.55"/><line x1="14" y1="3.5" x2="14" y2="8.5" stroke-opacity="0.55"/>' +
    '<line x1="6" y1="9.75" x2="6" y2="14.75" stroke-opacity="0.55"/><line x1="10" y1="9.75" x2="10" y2="14.75" stroke-opacity="0.55"/><line x1="14" y1="9.75" x2="14" y2="14.75" stroke-opacity="0.55"/>' +
    '<circle cx="18" cy="18.25" r="1.1" ' + DOT + '/>');

  G.gen_serverRack = svg('gsr',
    '<rect x="3.5" y="2.5" width="17" height="19" rx="2" fill="' + FF('gsr') + '"/>' +
    '<line x1="3.5" y1="7.5" x2="20.5" y2="7.5"/><line x1="3.5" y1="12" x2="20.5" y2="12"/><line x1="3.5" y1="16.5" x2="20.5" y2="16.5"/>' +
    '<line x1="6.5" y1="5" x2="12" y2="5" stroke-opacity="0.55"/><line x1="6.5" y1="9.75" x2="12" y2="9.75" stroke-opacity="0.55"/><line x1="6.5" y1="14.25" x2="12" y2="14.25" stroke-opacity="0.55"/>' +
    '<circle cx="17.5" cy="5" r="1" ' + DOT + '/><circle cx="17.5" cy="9.75" r="1" ' + DOT + '/><circle cx="17.5" cy="14.25" r="1" ' + DOT + '/>');

  G.gen_gpuCluster = svg('ggc',
    '<rect x="2" y="9" width="6" height="6" rx="1.4"/>' +
    '<rect x="9" y="2" width="6" height="6" rx="1.4"/>' +
    '<rect x="16" y="9" width="6" height="6" rx="1.4"/>' +
    '<rect x="9" y="16" width="6" height="6" rx="1.4"/>' +
    '<line x1="8" y1="12" x2="9.4" y2="9.4" stroke-opacity="0.6"/><line x1="14.6" y1="9.4" x2="16" y2="12" stroke-opacity="0.6"/>' +
    '<line x1="16" y1="12" x2="14.6" y2="14.6" stroke-opacity="0.6"/><line x1="9.4" y1="14.6" x2="8" y2="12" stroke-opacity="0.6"/>' +
    '<circle cx="12" cy="12" r="2.4" fill="' + FF('ggc') + '"/>');

  G.gen_dataCenter = svg('gdc',
    '<rect x="2" y="10" width="8" height="11.5" rx="0.8" fill="' + FF('gdc') + '"/>' +
    '<rect x="10.2" y="6" width="8" height="15.5" rx="0.8"/>' +
    '<rect x="18.4" y="13" width="3.6" height="8.5" rx="0.8"/>' +
    '<line x1="1" y1="21.5" x2="23" y2="21.5"/>' +
    '<line x1="4" y1="13.5" x2="8" y2="13.5" stroke-opacity="0.55"/><line x1="4" y1="16.5" x2="8" y2="16.5" stroke-opacity="0.55"/>' +
    '<line x1="12.2" y1="9.5" x2="16.2" y2="9.5" stroke-opacity="0.55"/><line x1="12.2" y1="12.5" x2="16.2" y2="12.5" stroke-opacity="0.55"/><line x1="12.2" y1="15.5" x2="16.2" y2="15.5" stroke-opacity="0.55"/>');

  G.gen_superComp = svg('gsc',
    '<rect x="4" y="2" width="16" height="20" rx="2" fill="' + FF('gsc') + '"/>' +
    '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>' +
    '<circle cx="7" cy="4.5" r="0.95" ' + DOT + '/><circle cx="10" cy="4.5" r="0.95" ' + DOT + '/>' +
    '<circle cx="7" cy="9.5" r="0.95" ' + DOT + '/><circle cx="10" cy="9.5" r="0.95" ' + DOT + '/>' +
    '<circle cx="7" cy="14.5" r="0.95" ' + DOT + '/><circle cx="10" cy="14.5" r="0.95" ' + DOT + '/>' +
    '<line x1="14.5" y1="4.5" x2="17.5" y2="4.5" stroke-opacity="0.55"/><line x1="14.5" y1="9.5" x2="17.5" y2="9.5" stroke-opacity="0.55"/><line x1="14.5" y1="14.5" x2="17.5" y2="14.5" stroke-opacity="0.55"/>');

  G.gen_neuroArray = svg('gna',
    '<circle cx="12" cy="12" r="2.4" fill="' + FF('gna') + '"/>' +
    '<line x1="12" y1="9.6" x2="12" y2="4.5" stroke-opacity="0.6"/>' +
    '<line x1="10.3" y1="10.6" x2="6.1" y2="8.1" stroke-opacity="0.6"/><line x1="13.7" y1="10.6" x2="17.9" y2="8.1" stroke-opacity="0.6"/>' +
    '<line x1="10.3" y1="13.4" x2="6.1" y2="15.9" stroke-opacity="0.6"/><line x1="13.7" y1="13.4" x2="17.9" y2="15.9" stroke-opacity="0.6"/>' +
    '<line x1="12" y1="14.4" x2="12" y2="19.5" stroke-opacity="0.6"/>' +
    '<circle cx="5" cy="7" r="1.6"/><circle cx="19" cy="7" r="1.6"/><circle cx="5" cy="17" r="1.6"/><circle cx="19" cy="17" r="1.6"/>' +
    '<circle cx="12" cy="3" r="1.6"/><circle cx="12" cy="21" r="1.6"/>');

  G.gen_quantumNode = svg('gqn',
    '<ellipse cx="12" cy="12" rx="9" ry="3.8"/>' +
    '<ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)" stroke-opacity="0.7"/>' +
    '<ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)" stroke-opacity="0.7"/>' +
    '<circle cx="12" cy="12" r="2.6" fill="' + FF('gqn') + '"/>' +
    '<circle cx="12" cy="12" r="1.1" ' + DOT + '/>');

  G.gen_orbital = svg('gor',
    '<ellipse cx="12" cy="12" rx="10" ry="3.8" transform="rotate(-30 12 12)" stroke-opacity="0.7"/>' +
    '<circle cx="12" cy="12" r="4" fill="' + FF('gor') + '"/>' +
    '<circle cx="19.6" cy="8" r="1.5" ' + DOT + '/>');

  G.gen_agiCore = svg('gag',
    '<circle cx="12" cy="12" r="6" fill="' + FF('gag') + '"/>' +
    '<circle cx="12" cy="12" r="3"/>' +
    '<line x1="12" y1="2" x2="12" y2="6" stroke-opacity="0.7"/><line x1="12" y1="18" x2="12" y2="22" stroke-opacity="0.7"/>' +
    '<line x1="2" y1="12" x2="6" y2="12" stroke-opacity="0.7"/><line x1="18" y1="12" x2="22" y2="12" stroke-opacity="0.7"/>' +
    '<line x1="4.93" y1="4.93" x2="7.76" y2="7.76" stroke-opacity="0.5"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" stroke-opacity="0.5"/>' +
    '<line x1="19.07" y1="4.93" x2="16.24" y2="7.76" stroke-opacity="0.5"/><line x1="7.76" y1="16.24" x2="4.93" y2="19.07" stroke-opacity="0.5"/>' +
    '<circle cx="12" cy="12" r="1" ' + DOT + '/>');

  G.gen_dysonSwarm = svg('gds',
    '<circle cx="12" cy="12" r="7" fill="' + FF('gds') + '"/>' +
    '<circle cx="12" cy="12" r="3.2" ' + DOT + '/>' +
    '<rect x="4.5" y="3.5" width="3" height="2" rx="0.6" transform="rotate(-30 6 4.5)" stroke-opacity="0.75"/>' +
    '<rect x="16" y="3.5" width="3" height="2" rx="0.6" transform="rotate(30 17.5 4.5)" stroke-opacity="0.75"/>' +
    '<rect x="19" y="11" width="3" height="2" rx="0.6" stroke-opacity="0.75"/>' +
    '<rect x="16" y="17.5" width="3" height="2" rx="0.6" transform="rotate(-30 17.5 18.5)" stroke-opacity="0.75"/>' +
    '<rect x="4.5" y="17.5" width="3" height="2" rx="0.6" transform="rotate(30 6 18.5)" stroke-opacity="0.75"/>' +
    '<rect x="2" y="11" width="3" height="2" rx="0.6" stroke-opacity="0.75"/>');

  G.gen_matrioshka = svg('gmt',
    '<circle cx="12" cy="12" r="9" fill="' + FF('gmt') + '"/>' +
    '<circle cx="12" cy="12" r="5.6" stroke-opacity="0.8"/>' +
    '<circle cx="12" cy="12" r="2.2" ' + DOT + '/>' +
    '<line x1="12" y1="3" x2="12" y2="1.5" stroke-opacity="0.7"/><line x1="12" y1="21" x2="12" y2="22.5" stroke-opacity="0.7"/>' +
    '<line x1="3" y1="12" x2="1.5" y2="12" stroke-opacity="0.7"/><line x1="21" y1="12" x2="22.5" y2="12" stroke-opacity="0.7"/>');

  // ── Navigation tabs ──────────────────────────────────────────────────────

  G.nav_company = svg('nco',
    '<rect x="2.5" y="7" width="19" height="14.5" rx="1.6" fill="' + FF('nco') + '"/>' +
    '<path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/>' +
    '<line x1="12" y1="12" x2="12" y2="17" stroke-opacity="0.7"/><line x1="9.5" y1="14.5" x2="14.5" y2="14.5" stroke-opacity="0.7"/>');

  G.nav_upgrades = svg('nup',
    '<path d="M5 15 L12 8 L19 15" fill="' + FF('nup') + '"/>' +
    '<line x1="12" y1="8" x2="12" y2="22"/>' +
    '<line x1="5" y1="4" x2="19" y2="4" stroke-opacity="0.7"/>');

  G.nav_research = svg('nrs',
    '<circle cx="11" cy="10" r="5.2" fill="' + FF('nrs') + '"/>' +
    '<line x1="14.7" y1="13.7" x2="21" y2="20.5"/>' +
    '<line x1="11" y1="5.2" x2="11" y2="7.2" stroke-opacity="0.7"/><line x1="11" y1="12.8" x2="11" y2="14.8" stroke-opacity="0.7"/>' +
    '<line x1="6.2" y1="10" x2="8.2" y2="10" stroke-opacity="0.7"/><line x1="13.8" y1="10" x2="15.8" y2="10" stroke-opacity="0.7"/>');

  G.nav_alignment = svg('nal',
    '<path d="M12 2 L20 6 L20 12 C20 16.4 16.5 20.3 12 22 C7.5 20.3 4 16.4 4 12 L4 6 Z" fill="' + FF('nal') + '"/>' +
    '<polyline points="9 12 11 14 15 10"/>');

  G.nav_stats = svg('nst',
    '<line x1="2" y1="20.5" x2="22" y2="20.5"/>' +
    '<rect x="4" y="12" width="4" height="8" rx="0.8" fill="' + FF('nst') + '"/>' +
    '<rect x="10" y="7" width="4" height="13" rx="0.8" fill="' + FF('nst') + '"/>' +
    '<rect x="16" y="3" width="4" height="17" rx="0.8" fill="' + FF('nst') + '"/>');

  G.nav_achievements = svg('nac',
    '<path d="M6 3 H18 V11 A6 6 0 0 1 6 11 Z" fill="' + FF('nac') + '"/>' +
    '<path d="M6 7 H2 A2 2 0 0 0 4 11" stroke-opacity="0.75"/>' +
    '<path d="M18 7 H22 A2 2 0 0 1 20 11" stroke-opacity="0.75"/>' +
    '<path d="M8 21 L12 17 L16 21"/><rect x="8" y="17" width="8" height="2" rx="0.6"/>');

  G.nav_settings = svg('nse',
    '<circle cx="12" cy="12" r="3.2" fill="' + FF('nse') + '"/>' +
    '<path d="M19.4 13.6a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.84 2.84l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 8.4 19.34a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.84-2.84l.06-.06a1.7 1.7 0 0 0 .34-1.88 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.66 8.4a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.84-2.84l.06.06a1.7 1.7 0 0 0 1.88.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.84 2.84l-.06.06a1.7 1.7 0 0 0-.34 1.88V9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03z" stroke-opacity="0.85"/>');

  // ── UI accents ────────────────────────────────────────────────────────────

  G.ic_brain = svg('ibr',
    '<path d="M12 5 C12 5 9 3 6.5 4.5 C4 6 3 8.5 4 11 C2.5 12 2 13.5 2.5 15 C3 16.5 4.5 17.5 6 17.5 C6 19.5 7.5 21 9.5 21 C10.5 21 11.5 20.5 12 19.5" fill="' + FF('ibr') + '"/>' +
    '<path d="M12 5 C12 5 15 3 17.5 4.5 C20 6 21 8.5 20 11 C21.5 12 22 13.5 21.5 15 C21 16.5 19.5 17.5 18 17.5 C18 19.5 16.5 21 14.5 21 C13.5 21 12.5 20.5 12 19.5" fill="' + FF('ibr') + '"/>' +
    '<line x1="12" y1="5" x2="12" y2="19.5" stroke-opacity="0.75"/>' +
    '<line x1="8" y1="10" x2="12" y2="12" stroke-opacity="0.6"/><line x1="16" y1="10" x2="12" y2="12" stroke-opacity="0.6"/>' +
    '<line x1="9" y1="14" x2="12" y2="15.5" stroke-opacity="0.6"/><line x1="15" y1="14" x2="12" y2="15.5" stroke-opacity="0.6"/>');

  G.ic_manager = svg('imn',
    '<rect x="7" y="3" width="10" height="9" rx="3.4" fill="' + FF('imn') + '"/>' +
    '<circle cx="9.5" cy="7" r="0.55" ' + DOT + '/><circle cx="14.5" cy="7" r="0.55" ' + DOT + '/>' +
    '<path d="M5 12 H3 A1 1 0 0 0 2 13 V15 A1 1 0 0 0 3 16 H5" stroke-opacity="0.7"/>' +
    '<path d="M19 12 H21 A1 1 0 0 1 22 13 V15 A1 1 0 0 1 21 16 H19" stroke-opacity="0.7"/>' +
    '<path d="M7 12 V14 A5 5 0 0 0 17 14 V12"/>' +
    '<rect x="9" y="17" width="6" height="5" rx="1.2"/>' +
    '<line x1="9" y1="17" x2="7" y2="22" stroke-opacity="0.7"/><line x1="15" y1="17" x2="17" y2="22" stroke-opacity="0.7"/>');

  // ── Team roles (one distinct icon per staffer: lawyer / security / marketer / economist) ──
  // Scales of justice → legality.
  G.ic_lawyer = svg('ilw',
    '<line x1="12" y1="4" x2="12" y2="20"/>' +
    '<circle cx="12" cy="4" r="1.1" fill="' + FF('ilw') + '"/>' +
    '<line x1="5" y1="7" x2="19" y2="7"/>' +
    '<path d="M5 7 L2.6 12 a2.6 2 0 0 0 4.8 0 Z" fill="' + FF('ilw') + '" stroke-opacity="0.9"/>' +
    '<path d="M19 7 L16.6 12 a2.6 2 0 0 0 4.8 0 Z" fill="' + FF('ilw') + '" stroke-opacity="0.9"/>' +
    '<line x1="8" y1="20" x2="16" y2="20"/>');
  // Shield + check → safety.
  G.ic_security = svg('isc',
    '<path d="M12 2 L20 5 V11 C20 16 16.5 19.6 12 22 C7.5 19.6 4 16 4 11 V5 Z" fill="' + FF('isc') + '"/>' +
    '<path d="M8.4 12 L11 14.6 L16 9" stroke-width="1.8"/>');
  // Megaphone → public approval / marketing.
  G.ic_marketer = svg('imk',
    '<path d="M3 10 H6 L14 5 V19 L6 14 H3 Z" fill="' + FF('imk') + '"/>' +
    '<path d="M6 14 V18 a1.3 1.3 0 0 0 2.4 0.7 L7.2 15.5" stroke-opacity="0.85"/>' +
    '<path d="M17.5 9 a4.4 4.4 0 0 1 0 6" stroke-opacity="0.85"/>');
  // Rising chart → economist / tax & money flow.
  G.ic_economist = svg('iec',
    '<line x1="3" y1="21" x2="21" y2="21"/>' +
    '<rect x="5" y="14" width="3" height="5" rx="0.6" fill="' + FF('iec') + '"/>' +
    '<rect x="10.5" y="10" width="3" height="9" rx="0.6" fill="' + FF('iec') + '"/>' +
    '<rect x="16" y="6" width="3" height="13" rx="0.6" fill="' + FF('iec') + '"/>' +
    '<path d="M5 9 L11 11 L19 3.5" stroke-opacity="0.85"/>' +
    '<path d="M16 3.5 H19 V6.5" stroke-opacity="0.85"/>');

  G.ic_upgrade = svg('iup',
    '<polygon points="12 2 13.9 8 20 8.9 15.6 13.2 16.9 19.4 12 16.5 7.1 19.4 8.4 13.2 4 8.9 10.1 8" fill="' + FF('iup') + '"/>');

  G.ic_rp = svg('irp',
    '<polygon points="12 2 20 7 20 17 12 22 4 17 4 7" fill="' + FF('irp') + '"/>' +
    '<line x1="12" y1="2" x2="12" y2="9" stroke-opacity="0.7"/><line x1="12" y1="15" x2="12" y2="22" stroke-opacity="0.7"/>' +
    '<circle cx="12" cy="12" r="3"/>' +
    '<circle cx="12" cy="12" r="0.9" ' + DOT + '/>');

  G.ic_risk = svg('irk',
    '<path d="M10.29 3.86 L1.82 18 a2 2 0 0 0 1.71 3 h16.94 a2 2 0 0 0 1.71-3 L13.71 3.86 a2 2 0 0 0-3.42 0 z" fill="' + FF('irk') + '"/>' +
    '<line x1="12" y1="9" x2="12" y2="13.5"/>' +
    '<circle cx="12" cy="17" r="0.85" ' + DOT + '/>');

  G.ic_cash = svg('ics',
    '<circle cx="12" cy="12" r="9" fill="' + FF('ics') + '"/>' +
    '<line x1="12" y1="6" x2="12" y2="18" stroke-opacity="0.85"/>' +
    '<path d="M15 9 A3 3 0 0 0 9 9 A3 3 0 0 0 12 12 A3 3 0 0 1 12 18 A3 3 0 0 1 9 15"/>');

  G.ic_insight = svg('iin',
    '<circle cx="12" cy="12" r="3.6" fill="' + FF('iin') + '"/>' +
    '<circle cx="12" cy="12" r="1.4" ' + DOT + '/>' +
    '<line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>' +
    '<line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>' +
    '<line x1="4.22" y1="4.22" x2="6.34" y2="6.34" stroke-opacity="0.65"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78" stroke-opacity="0.65"/>' +
    '<line x1="19.78" y1="4.22" x2="17.66" y2="6.34" stroke-opacity="0.65"/><line x1="6.34" y1="17.66" x2="4.22" y2="19.78" stroke-opacity="0.65"/>');

  // FTUE coachmark arrows — bolder stroke so they read as pointers.
  G.ic_arrow_down = svg('iad',
    '<line x1="12" y1="3" x2="12" y2="20"/><polyline points="6 13 12 20 18 13"/>',
    { sw: '2.4' });

  G.ic_arrow_up = svg('iau',
    '<line x1="12" y1="21" x2="12" y2="4"/><polyline points="6 11 12 4 18 11"/>',
    { sw: '2.4' });

  G.ic_breakthrough = svg('ibt',
    '<polygon points="13 2 4 14 11.2 14 10 22 20 9.6 12.6 9.6" fill="' + FF('ibt') + '"/>');

  G.ic_close = svg('icl',
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    { sw: '2' });

  G.ic_bolt = svg('ibz',
    '<polygon points="13 2 4 14 11.2 14 10 22 20 9.6 12.6 9.6" fill="' + FF('ibz') + '"/>');

  window.GAME_ICONS = G;

})();
