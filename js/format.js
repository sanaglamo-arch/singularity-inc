/* Number formatting -> window.GAME_FMT.
   1.00, K, M, B, T, then Qa, Qi, Sx, Sp, Oc, No, Dc, ... ; scientific ~1e33+. */
(function () {
  'use strict';

  // Short-scale suffixes. After Dc (1e33) we switch to scientific notation.
  var SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    if (!isFinite(n)) return '∞';
    var neg = n < 0;
    n = Math.abs(n);
    if (n < 1000) {
      // small numbers: show up to 2 decimals but trim
      var s = (n < 10 && n % 1 !== 0) ? n.toFixed(2) : (n < 100 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toString());
      return (neg ? '-' : '') + s;
    }
    var tier = Math.floor(Math.log10(n) / 3);
    if (tier < SUFFIXES.length) {
      var scaled = n / Math.pow(10, tier * 3);
      var str = scaled >= 100 ? scaled.toFixed(1) : scaled.toFixed(2);
      return (neg ? '-' : '') + str + SUFFIXES[tier];
    }
    // scientific
    var exp = Math.floor(Math.log10(n));
    var mant = n / Math.pow(10, exp);
    return (neg ? '-' : '') + mant.toFixed(2) + 'e' + exp;
  }

  // format with explicit "/sec" handled by caller via i18n; here just numbers.
  function fmtInt(n) {
    if (n < 1000) return Math.floor(n).toString();
    return fmt(n);
  }

  // time in seconds -> "1h 23m" / "45s"
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + s + 's';
    return s + 's';
  }

  window.GAME_FMT = { fmt: fmt, fmtInt: fmtInt, fmtTime: fmtTime, SUFFIXES: SUFFIXES };
})();
