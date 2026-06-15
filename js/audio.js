/* Procedural sound via WebAudio -> window.GAME_AUDIO. Off by default.
   No external audio files (Yandex: zero external requests). */
(function () {
  'use strict';
  var ctx = null;
  var enabled = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function blip(freq, dur, type, gain) {
    if (!enabled) return;
    var c = ensure();
    if (!c) return;
    try {
      if (c.state === 'suspended') c.resume();
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(c.destination);
      var t = c.currentTime;
      g.gain.exponentialRampToValueAtTime(gain || 0.06, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
      o.start(t); o.stop(t + (dur || 0.12) + 0.02);
    } catch (e) {}
  }

  window.GAME_AUDIO = {
    setEnabled: function (b) { enabled = !!b; if (enabled) ensure(); },
    isEnabled: function () { return enabled; },
    tap: function () { blip(380 + Math.random() * 40, 0.08, 'triangle', 0.05); },
    buy: function () { blip(520, 0.10, 'sine', 0.06); setTimeout(function () { blip(700, 0.10, 'sine', 0.05); }, 60); },
    prestige: function () { blip(440, 0.18, 'sawtooth', 0.05); setTimeout(function () { blip(660, 0.22, 'sawtooth', 0.05); }, 120); },
    achievement: function () { blip(660, 0.12, 'sine', 0.06); setTimeout(function () { blip(880, 0.16, 'sine', 0.06); }, 90); },
    incident: function () { blip(160, 0.4, 'sawtooth', 0.07); }
  };
})();
