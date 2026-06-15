/* Ads abstraction -> window.GAME_ADS. Wraps Yandex rewarded / interstitial /
   sticky banner on top of GAME_SDK. Every call degrades gracefully: with no
   SDK, rewarded callbacks fire a clean "unavailable" path and the game never
   breaks. Frequency caps are enforced locally. */
(function () {
  'use strict';

  var lastInterstitial = 0; // ms timestamp

  function now() { return (window.GAME_TIME && window.GAME_TIME.now) ? window.GAME_TIME.now() : +new Date(); }

  function sdk() { return window.GAME_SDK && window.GAME_SDK.getSDK ? window.GAME_SDK.getSDK() : null; }

  // Rewarded video. opts: { onReward, onUnavailable }
  function showRewarded(opts) {
    opts = opts || {};
    var s = sdk();
    if (!s || !s.adv || !s.adv.showRewardedVideo) {
      if (opts.onUnavailable) opts.onUnavailable();
      return;
    }
    var rewarded = false;
    try {
      s.adv.showRewardedVideo({
        callbacks: {
          onRewarded: function () { rewarded = true; if (opts.onReward) opts.onReward(); },
          onClose: function () { if (!rewarded && opts.onUnavailable) opts.onUnavailable(); },
          onError: function () { if (opts.onUnavailable) opts.onUnavailable(); }
        }
      });
    } catch (e) { if (opts.onUnavailable) opts.onUnavailable(); }
  }

  // Interstitial (fullscreen), respecting cooldown
  function showInterstitial(opts) {
    opts = opts || {};
    var cd = (window.GAME_CONFIG.ADS.INTERSTITIAL_COOLDOWN || 120) * 1000;
    if (now() - lastInterstitial < cd) { if (opts.onClose) opts.onClose(); return; }
    var s = sdk();
    if (!s || !s.adv || !s.adv.showFullscreenAdv) { if (opts.onClose) opts.onClose(); return; }
    lastInterstitial = now();
    try {
      s.adv.showFullscreenAdv({
        callbacks: {
          onClose: function () { if (opts.onClose) opts.onClose(); },
          onError: function () { if (opts.onClose) opts.onClose(); }
        }
      });
    } catch (e) { if (opts.onClose) opts.onClose(); }
  }

  // Sticky banner
  function showSticky() {
    var s = sdk();
    try { if (s && s.adv && s.adv.showBannerAdv) s.adv.showBannerAdv(); } catch (e) {}
  }
  function hideSticky() {
    var s = sdk();
    try { if (s && s.adv && s.adv.hideBannerAdv) s.adv.hideBannerAdv(); } catch (e) {}
  }

  function available() {
    var s = sdk();
    return !!(s && s.adv && s.adv.showRewardedVideo);
  }

  window.GAME_ADS = {
    showRewarded: showRewarded,
    showInterstitial: showInterstitial,
    showSticky: showSticky,
    hideSticky: hideSticky,
    available: available
  };
})();
