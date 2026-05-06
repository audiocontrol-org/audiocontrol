// MIDI Macro Bridge — client-side behaviour.
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

// ── Phase 6f: Event-stream polish ────────────────────────────────────────────
// Ring-buffer trim, pause-on-hover auto-scroll, and fade-in on append.
//
// htmx-sse's swap order is:
//   1. fire `htmx:sseBeforeMessage` on the sse-swap element
//   2. perform the DOM swap (the new <div class="event-line"> is appended)
//   3. fire `htmx:sseMessage` on the sse-swap element
// We listen for `htmx:sseMessage` because by that point the new line is
// already in the DOM and we can prune + animate + scroll in one pass.

const STREAM_ID = 'mmb-event-stream';
const MAX_LINES = 200;
const FADE_CLASS = 'mmb-event-line-enter';
const PAUSE_CLASS = 'mmb-stream-paused';

let isPaused = false;

function autoScrollToBottom(stream) {
  // smooth scroll if not already at the bottom; cheap when we're already there
  stream.scrollTo({ top: stream.scrollHeight, behavior: 'smooth' });
}

function pruneAndAnimate(stream) {
  // Ring-buffer trim: drop oldest until we're at MAX_LINES.
  while (stream.children.length > MAX_LINES) {
    stream.removeChild(stream.firstElementChild);
  }

  // Fade-in animation for the latest line, unless reduced-motion is set.
  const latest = stream.lastElementChild;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (latest && !reduceMotion) {
    // Initial state — invisible and shifted; the CSS transition lerps to rest.
    latest.classList.add(FADE_CLASS);
    // Two RAFs: one to commit the initial state, one to remove the class so
    // the transition fires. Single RAF can race with the swap's settle path.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        latest.classList.remove(FADE_CLASS);
      });
    });
  }

  if (!isPaused) {
    autoScrollToBottom(stream);
  }
}

function setupEventStream() {
  const stream = document.getElementById(STREAM_ID);
  if (!stream) return;

  // Pause-on-hover: incoming events still get appended + trimmed, but we don't
  // scroll. The visual indicator is driven entirely by CSS via PAUSE_CLASS on
  // the stream element (the parent .mmb-events panel uses :has() to react).
  stream.addEventListener('mouseenter', () => {
    isPaused = true;
    stream.classList.add(PAUSE_CLASS);
  });
  stream.addEventListener('mouseleave', () => {
    isPaused = false;
    stream.classList.remove(PAUSE_CLASS);
    // Catch back up — if events accumulated while hovering, jump to the end.
    autoScrollToBottom(stream);
  });

  // htmx-sse fires htmx:sseMessage on the sse-swap element after the swap.
  // The event is bubbling, so we can listen on document.body and filter.
  document.body.addEventListener('htmx:sseMessage', (e) => {
    const target = e.target;
    if (!target || target.id !== STREAM_ID) return;
    pruneAndAnimate(stream);
  });

  // Initial scroll: if the historical buffer was rendered server-side or via
  // the first batch of SSE on connect, snap to bottom once the page settles.
  // Use rAF so we yield to any in-flight htmx swaps first.
  requestAnimationFrame(() => {
    autoScrollToBottom(stream);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupEventStream);
} else {
  setupEventStream();
}


// ── Phase 8a: elapsed-time displays ──────────────────────────────────────────
// Tick every second against absolute epoch-ms timestamps embedded by the
// server in `data-timestamp` attributes on status indicator spans.
// When the SSE "status-updated" event arrives and htmx swaps in new spans,
// the `htmx:afterSwap` listener re-ticks so freshly-arrived timestamps are
// immediately formatted rather than waiting up to 1s for the next interval.

function formatElapsed(ms) {
  if (ms < 0) return "—";        // future timestamp (clock skew)
  if (ms < 1000) return "0s";
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function tickElapsedTimers() {
  const now = Date.now();
  document.querySelectorAll('[data-timestamp]').forEach(el => {
    const ts = parseInt(el.dataset.timestamp, 10);
    if (Number.isFinite(ts) && ts > 0) {
      el.textContent = formatElapsed(now - ts);
    }
  });
}

setInterval(tickElapsedTimers, 1000);
// Run once on DOMContentLoaded so the initial render reflects current time.
document.addEventListener('DOMContentLoaded', tickElapsedTimers);
// Also run after each htmx swap so freshly-arriving timestamps render correctly.
document.addEventListener('htmx:afterSwap', tickElapsedTimers);
