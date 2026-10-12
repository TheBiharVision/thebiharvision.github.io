document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const cfg = window.SITE_CONFIG;
  const status = document.getElementById('form-status');

  function setError(field, message) {
    const wrap = field.closest('.form-field');
    wrap.classList.add('has-error');
    let err = wrap.querySelector('.form-error');
    if (!err) {
      err = document.createElement('div');
      err.className = 'form-error';
      err.id = field.id + '-error';
      wrap.appendChild(err);
    }
    err.textContent = message;
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', err.id);
  }

  function clearError(field) {
    const wrap = field.closest('.form-field');
    wrap.classList.remove('has-error');
    const err = wrap.querySelector('.form-error');
    if (err) err.remove();
    field.removeAttribute('aria-invalid');
  }

  function validate() {
    let valid = true;
    const name = form.elements['name'];
    const email = form.elements['email'];
    const subject = form.elements['subject'];
    const message = form.elements['message'];
    const honeypot = form.elements['company']; // spam trap

    [name, email, subject, message].forEach(clearError);

    if (!name.value.trim()) { setError(name, 'Please enter your name.'); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { setError(email, 'Please enter a valid email address.'); valid = false; }
    if (!subject.value.trim()) { setError(subject, 'Please enter a subject.'); valid = false; }
    if (message.value.trim().length < 10) { setError(message, 'Message must be at least 10 characters.'); valid = false; }
    if (honeypot && honeypot.value) valid = false; // silently fail bots

    return valid;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate()) {
      status.textContent = 'Please correct the highlighted fields.';
      status.setAttribute('role', 'alert');
      return;
    }

    const data = {
      name: form.elements['name'].value,
      email: form.elements['email'].value,
      subject: form.elements['subject'].value,
      message: form.elements['message'].value
    };

    if (cfg.contactForm.provider === 'formspree' && cfg.contactForm.endpoint) {
      try {
        const res = await fetch(cfg.contactForm.endpoint, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          status.textContent = 'Thank you — your message has been sent.';
          status.setAttribute('role', 'status');
          form.reset();
        } else {
          throw new Error('Submission failed');
        }
      } catch {
        status.textContent = 'Something went wrong. Please email us directly at ' + cfg.email + '.';
        status.setAttribute('role', 'alert');
      }
    } else {
      // Documented mailto fallback (no backend configured yet)
      const body = encodeURIComponent(`${data.message}\n\n— ${data.name} (${data.email})`);
      window.location.href = `mailto:${cfg.email}?subject=${encodeURIComponent(data.subject)}&body=${body}`;
      status.textContent = 'Your email app should now open with your message pre-filled to send to us.';
      status.setAttribute('role', 'status');
    }
  });
});
