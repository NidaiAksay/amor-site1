// AMOR — 3D ticket popup. Pure progressive enhancement: every
// [data-ticket-trigger] element is a real <a href="...the Fatsoma link...">
// already. If this script fails to load or errors out, clicking it just
// navigates to Fatsoma directly like a normal link — nothing here is load
// bearing for actually buying a ticket.
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var backdrop = document.getElementById('ticketModalBackdrop');
    var closeBtn = document.getElementById('ticketModalClose');
    if (!backdrop || !closeBtn) return;

    var titleEl = document.getElementById('ticketTitle');
    var dateEl = document.getElementById('ticketDate');
    var venueEl = document.getElementById('ticketVenue');
    var priceEl = document.getElementById('ticketPrice');
    var continueEl = document.getElementById('ticketContinue');
    var lastFocused = null;
    var currentSlug = '';

    // Fires on the real "Continue to Fatsoma" click, i.e. actual purchase
    // intent — not just opening the modal. sendBeacon fires-and-forgets
    // even as the tab navigates away, which a normal fetch() can drop.
    function trackTicketClick() {
      if (!navigator.sendBeacon) return;
      try {
        var payload = JSON.stringify({
          kind: 'ticket_click',
          path: location.pathname,
          event_slug: currentSlug,
        });
        navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
      } catch (e) { /* analytics is never allowed to block a real purchase */ }
    }

    function openModal(trigger) {
      titleEl.textContent = trigger.getAttribute('data-title') || 'AMOR event';
      dateEl.textContent = trigger.getAttribute('data-date') || '—';
      venueEl.textContent = trigger.getAttribute('data-venue') || '—';
      priceEl.textContent = trigger.getAttribute('data-price') || '—';
      continueEl.href = trigger.getAttribute('data-url') || trigger.href;
      currentSlug = trigger.getAttribute('data-slug') || '';
      lastFocused = document.activeElement;
      backdrop.classList.add('open');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      window.setTimeout(function () { closeBtn.focus(); }, 60);
    }

    function closeModal() {
      backdrop.classList.remove('open');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    document.addEventListener('click', function (e) {
      var trigger = e.target.closest && e.target.closest('[data-ticket-trigger]');
      if (!trigger) return;
      // Let modifier-clicks / middle-clicks behave normally (new tab etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      openModal(trigger);
    });

    continueEl.addEventListener('click', trackTicketClick);
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
    });
  });
})();
