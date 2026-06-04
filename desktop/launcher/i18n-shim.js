/* ==========================================================================
   Standalone i18n shim for the Light Again desktop build.

   In the portfolio, window.__siteT is created by main.js (102 KB of portfolio
   logic we don't want here). Light Again only needs that one helper for its UI
   labels (help / pause / menu / mode-select). This re-creates it from the same
   SITE_I18N dictionary (js/i18n.js), mirroring main.js's siteT() exactly:
       current language → French fallback → raw key.

   Every OTHER portfolio global Light Again touches (rain / music / visualizer /
   particles kill-switch, __trapFocus) is already called behind
   `typeof window.__x === 'function'` guards, so leaving them undefined is safe.
   ========================================================================== */
(function () {
  'use strict';

  var LANG_KEY = 'portfolio_lang';

  function lang() {
    try { return localStorage.getItem(LANG_KEY) || 'fr'; }
    catch (e) { return 'fr'; }
  }

  window.__siteT = function (key) {
    var I = window.SITE_I18N || {};
    var l = lang();
    return (I[l] && I[l][key]) || (I.fr && I.fr[key]) || key;
  };
})();
