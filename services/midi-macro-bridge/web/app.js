// MIDI Macro Bridge — Phase 6e client-side behaviour.
// No dependencies; plain vanilla JS only.

// ── Form-dirty tracking ───────────────────────────────────────────────────────
// APPLY button pulses with warm-accent when any form field has changed.

document.addEventListener('input', (e) => {
  if (e.target.closest('#mmb-config-form')) {
    const btn = document.getElementById('mmb-apply-btn');
    if (btn) btn.classList.add('mmb-apply-dirty');
  }
});

// Remove dirty state after a successful apply (htmx swap into the result div).
document.addEventListener('htmx:afterSwap', (e) => {
  if (e.detail.target && e.detail.target.id === 'mmb-config-result') {
    const btn = document.getElementById('mmb-apply-btn');
    if (btn) btn.classList.remove('mmb-apply-dirty');
  }
});

// ── Backend segmented-control toggle ─────────────────────────────────────────
// Show the keystrokes-only block only when the keystrokes radio is selected.

function syncKeysBlock() {
  const checked = document.querySelector('input[name="backend"]:checked');
  const keysBlock = document.querySelector('.mmb-keys-only');
  if (checked && keysBlock) {
    keysBlock.style.display = (checked.value === 'keystrokes') ? 'block' : 'none';
  }
}

document.addEventListener('change', (e) => {
  if (e.target.name === 'backend') {
    syncKeysBlock();
  }
});

// Re-sync after htmx swaps in the config form (e.g. on page load).
document.addEventListener('htmx:afterSwap', () => {
  syncKeysBlock();
});
