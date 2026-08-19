// AMOR admin — bulk-select checkboxes. Pure progressive enhancement: each
// bulk-select group's submit button starts disabled and its form's hidden
// "ids" field starts empty, so with JS disabled nothing bulk-related is
// submittable — the per-row action buttons next to it remain the reliable
// fallback either way. Checkboxes live in the table markup (not nested
// inside the bulk <form>, since HTML forbids nested forms and each row
// already has its own individual-action form); they're associated with
// their bulk form purely by a shared data-bulk-group value.
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var groups = {};
    document.querySelectorAll('[data-bulk-group]').forEach(function (el) {
      var group = el.getAttribute('data-bulk-group');
      groups[group] = groups[group] || { checkboxes: [], selectAll: null, submitBtn: null };
      if (el.hasAttribute('data-bulk-id')) groups[group].checkboxes.push(el);
      else if (el.hasAttribute('data-select-all')) groups[group].selectAll = el;
      else if (el.hasAttribute('data-bulk-submit')) groups[group].submitBtn = el;
    });

    Object.keys(groups).forEach(function (group) {
      var g = groups[group];
      if (!g.submitBtn) return;
      var form = g.submitBtn.form;
      var idsInput = form && form.querySelector('input[name="ids"]');
      if (!idsInput) return;
      // Whatever verb the button already says (e.g. "Approve selected",
      // "Verify selected") is kept as-is — this just appends the count
      // rather than assuming every bulk action is an "approve".
      var baseLabel = g.submitBtn.textContent.trim();

      function sync() {
        var ids = g.checkboxes.filter(function (cb) { return cb.checked; })
          .map(function (cb) { return cb.getAttribute('data-bulk-id'); });
        idsInput.value = ids.join(',');
        g.submitBtn.disabled = ids.length === 0;
        g.submitBtn.textContent = ids.length ? baseLabel + ' (' + ids.length + ')' : baseLabel;
      }

      g.checkboxes.forEach(function (cb) { cb.addEventListener('change', sync); });
      if (g.selectAll) {
        g.selectAll.addEventListener('change', function () {
          g.checkboxes.forEach(function (cb) { cb.checked = g.selectAll.checked; });
          sync();
        });
      }
    });
  });
})();
