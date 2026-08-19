// AMOR — live countdown for [data-countdown="YYYY-MM-DD"] elements. Always
// grounded in a real event date already server-rendered as plain text (see
// home.js) — this only makes it tick down live once JS is available; with
// JS off/blocked, visitors just see the formatted date, which is honest and
// complete on its own. Deliberately does NOT fabricate ticket-count scarcity
// ("3 left!") since the site has no real inventory feed from Fatsoma to back
// that claim — a real countdown to a real date is the honest version of the
// same urgency cue.
(function () {
  'use strict';

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function render(el) {
    var target = new Date(el.getAttribute('data-countdown') + 'T00:00:00');
    if (isNaN(target.getTime())) return;
    var diff = target.getTime() - Date.now();
    if (diff <= 0) {
      el.textContent = "It's tonight";
      return;
    }
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) {
      el.textContent = days + 'd ' + pad(hours) + 'h ' + pad(mins) + 'm';
    } else {
      el.textContent = pad(hours) + 'h ' + pad(mins) + 'm';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var els = document.querySelectorAll('[data-countdown]');
    if (!els.length) return;
    function tick() {
      els.forEach(render);
    }
    tick();
    window.setInterval(tick, 30000);
  });
})();
