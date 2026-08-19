'use strict';

// Single source of truth for AMOR's contact email — referenced by the FAQ
// page, the /contact page, the footer, and the mailto: fallback link, so
// it only ever needs to change in one place.
const CONTACT_EMAIL = 'amoreventsbath@gmail.com';

module.exports = { CONTACT_EMAIL };
