// AMOR — motion layer. Pure progressive enhancement: every element this
// script touches is already fully visible/usable from server-rendered HTML
// and CSS alone. If GSAP fails to load (CDN hiccup, blocker, offline), or a
// visitor has prefers-reduced-motion on, the site works exactly the same —
// it just skips the choreography.
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  var isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  document.addEventListener('DOMContentLoaded', function () {
    pageEnter();
    initPageTransitions();
    if (hasGsap && !reduceMotion) {
      heroEntrance();
      if (window.ScrollTrigger) {
        window.gsap.registerPlugin(window.ScrollTrigger);
        scrollReveals();
        statCounters();
        parallaxCovers();
      }
    }
    if (!isTouch) magneticButtons();
  });

  // ---------------------------------------------------------------- entrance
  function pageEnter() {
    var main = document.querySelector('[data-page-main]');
    if (!main) return;
    main.classList.add('page-enter');
    // rAF so the class change actually triggers the CSS transition instead
    // of being coalesced with the initial paint.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        main.classList.add('page-enter-active');
      });
    });
  }

  // ------------------------------------------------------- link transitions
  function initPageTransitions() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('a[href]');
      if (!link) return;
      if (link.target === '_blank' || link.hasAttribute('download')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      var url;
      try {
        url = new URL(link.href, window.location.href);
      } catch (err) {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return; // in-page anchor

      e.preventDefault();
      var main = document.querySelector('[data-page-main]');
      if (main) main.classList.add('page-leave');
      var delay = reduceMotion ? 0 : 220;
      window.setTimeout(function () {
        window.location.href = link.href;
      }, delay);
    });
  }

  // -------------------------------------------------------- hero entrance
  function heroEntrance() {
    var headline = document.querySelector('.hero .display');
    if (!headline) return;
    var lines = splitLines(headline);
    var tl = window.gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from(lines, { yPercent: 130, opacity: 0, duration: 0.9, stagger: 0.09 })
      .from('.hero .eyebrow', { opacity: 0, y: 10, duration: 0.5 }, '-=0.6')
      .from('.hero .lede', { opacity: 0, y: 14, duration: 0.6 }, '-=0.55')
      .from('.hero-actions .btn', { opacity: 0, y: 14, duration: 0.5, stagger: 0.08 }, '-=0.4');
  }

  function splitLines(el) {
    // Wrap each <br>-separated line in its own span so GSAP can stagger
    // them individually, without pulling in a text-splitting library.
    var html = el.innerHTML;
    var parts = html.split(/<br\s*\/?>/i);
    el.innerHTML = parts
      .map(function (part) {
        return '<span class="line-mask"><span class="line-inner">' + part + '</span></span>';
      })
      .join('');
    return el.querySelectorAll('.line-inner');
  }

  // --------------------------------------------------------- scroll reveals
  function scrollReveals() {
    var selector = [
      '.event-card', '.plan', '.rep-card', '.stat-box', '.card',
      'section .h2', 'section .h3',
    ].join(', ');
    var groups = {};
    document.querySelectorAll(selector).forEach(function (el) {
      if (el.closest('.hero')) return; // hero handles its own entrance
      var section = el.closest('section') || document.body;
      var key = Array.prototype.indexOf.call(document.querySelectorAll('section'), section);
      groups[key] = groups[key] || [];
      groups[key].push(el);
    });
    Object.keys(groups).forEach(function (key) {
      var els = groups[key];
      window.gsap.set(els, { opacity: 0, y: 28 });
      window.ScrollTrigger.batch(els, {
        start: 'top 88%',
        once: true,
        onEnter: function (batch) {
          window.gsap.to(batch, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power2.out' });
        },
      });
    });
  }

  // ---------------------------------------------------------- stat counters
  function statCounters() {
    document.querySelectorAll('.hero-stat b, .stat-box b').forEach(function (el) {
      var text = el.textContent.trim();
      var match = text.match(/^([£]?)(\d[\d,]*)(\+?)(.*)$/);
      if (!match) return;
      var prefix = match[1];
      var target = parseInt(match[2].replace(/,/g, ''), 10);
      var suffix = match[3];
      var rest = match[4]; // e.g. ".00" from money — left untouched, counters only target whole numbers
      if (rest || isNaN(target)) return;
      var proxy = { val: 0 };
      window.ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        once: true,
        onEnter: function () {
          window.gsap.to(proxy, {
            val: target,
            duration: 1.1,
            ease: 'power2.out',
            onUpdate: function () {
              el.textContent = prefix + Math.round(proxy.val).toLocaleString('en-GB') + suffix;
            },
          });
        },
      });
    });
  }

  // ------------------------------------------------------------- parallax
  function parallaxCovers() {
    document.querySelectorAll('.cover .mark').forEach(function (mark) {
      window.gsap.to(mark, {
        yPercent: 18,
        ease: 'none',
        scrollTrigger: {
          trigger: mark.closest('.cover'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });
    });
  }

  // -------------------------------------------------------- magnetic buttons
  function magneticButtons() {
    document.querySelectorAll('.btn').forEach(function (btn) {
      var strength = 0.35;
      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        var x = (e.clientX - rect.left - rect.width / 2) * strength;
        var y = (e.clientY - rect.top - rect.height / 2) * strength;
        btn.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px)';
      });
      btn.addEventListener('mouseleave', function () {
        btn.style.transform = '';
      });
    });
  }
})();
