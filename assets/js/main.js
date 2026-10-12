/* Global init: FAQ accordion, back-to-top, episode-archive hooks live in page-specific inline scripts. */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const answer = document.getElementById(btn.getAttribute('aria-controls'));
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      answer.hidden = expanded;
    });
  });
});
