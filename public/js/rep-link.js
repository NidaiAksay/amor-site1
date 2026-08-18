// AMOR — one-click "copy my link" for reps on their account dashboard.
// The link itself (/events?rep=CODE) already works with zero JS — the
// events list route reads ?rep= and prefills the claim form's rep code
// field server-side (see events.js). This script only makes the input show
// an absolute URL and adds a copy button; without it the input still shows
// a correct, working relative link a rep can select and copy by hand.
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('repShareCopy');
    var input = document.getElementById('repShareLink');
    if (!btn || !input) return;

    var relativePath = input.getAttribute('value') || input.value;
    input.value = window.location.origin + relativePath;

    btn.addEventListener('click', function () {
      var text = input.value;
      var showCopied = function () {
        var original = btn.textContent;
        btn.textContent = 'Copied!';
        window.setTimeout(function () {
          btn.textContent = original;
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showCopied, function () {
          fallbackCopy(input, showCopied);
        });
      } else {
        fallbackCopy(input, showCopied);
      }
    });
  });

  function fallbackCopy(input, done) {
    input.removeAttribute('readonly');
    input.select();
    try {
      document.execCommand('copy');
      done();
    } catch (e) {
      /* selection is still visible for the rep to copy by hand */
    }
    input.setAttribute('readonly', 'readonly');
  }
})();
