// Animates the homepage hero stats (Events run / Tickets sold / Active
// reps) counting up from 0 to their real value once they scroll into view.
// Pure progressive enhancement: the server already renders the correct
// final number in the markup (see views/home.js), so this only ever
// replaces a correct number with an animated path to the same correct
// number — nothing here can show a wrong or made-up figure.
(function () {
  function animateCount(el) {
    var target = parseInt(el.getAttribute('data-count-to'), 10);
    if (isNaN(target) || target <= 0) return;
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 1400;
    var start = null;

    el.textContent = '0' + suffix;

    function step(timestamp) {
      if (start === null) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic — fast start, slow finish
      var value = Math.round(eased * target);
      el.textContent = value + suffix;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    }
    window.requestAnimationFrame(step);
  }

  function init() {
    var els = document.querySelectorAll('[data-count-to]');
    if (!els.length) return;

    if (!('IntersectionObserver' in window)) {
      els.forEach(animateCount);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    els.forEach(function (el) { observer.observe(el); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
