'use strict';

/* ══════════════════════════════════════════════════════════════════
   AUDIO  (Web Audio API — no external files)
   ══════════════════════════════════════════════════════════════════ */
let _audioCtx = null;
function audioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function tone(freq, dur, type = 'sine', vol = 0.28, delayMs = 0) {
  try {
    const ctx  = audioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    const t = ctx.currentTime + delayMs / 1000;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur + 0.01);
  } catch (_) {}
}

/** Two-note chirp — correct partial answer */
function playChirp() {
  tone(740, 0.09, 'sine', 0.22);
  tone(1050, 0.09, 'sine', 0.18, 90);
}

/** Ascending 4-note fanfare — correct total */
function playSuccess() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'sine', 0.22, i * 85));
}

/** Short descending blip — wrong answer */
function playWrong() {
  tone(320, 0.18, 'sawtooth', 0.12);
  tone(240, 0.14, 'sawtooth', 0.09, 90);
}

/* ── Challenge data ─────────────────────────────────────────────── */
// Progressively harder for ages 8–10.
// Ladder method: each digit of the multiplicand × the multiplier,
// placed at its correct position (trailing zeros = place value).
const CHALLENGES = [
  { multiplicand: 13,  multiplier: 2, intro: "Let's start climbing! 🌿"           },
  { multiplicand: 24,  multiplier: 4, intro: "Up we go! 🍃"                        },
  { multiplicand: 36,  multiplier: 5, intro: "Going higher! 🌱"                    },
  { multiplicand: 123, multiplier: 3, intro: "Three digits — you've got this! 🌟"  },
  { multiplicand: 245, multiplier: 4, intro: "More than halfway up! ⭐"             },
  { multiplicand: 347, multiplier: 6, intro: "Nearly at the top! 🌈"               },
  { multiplicand: 489, multiplier: 7, intro: "Last branch — the nest is close! 🪺" },
];

/* ── Bird positions (desktop) ───────────────────────────────────── */
// left/top as % of tree-wrap (300×720 SVG coordinate space).
// left = centre-x of bird; CSS applies translateX(-50%) to centre it.
// top  = top edge of bird (bird bottom ≈ branch y).
// flip = mirror for left-side branches.
const BIRD_POSITIONS = [
  { left: 70.0, top: 89.0, flip: false },  // 0 — ground
  { left: 72.0, top: 82.5, flip: false },  // 1 — branch 1 (right)
  { left: 25.0, top: 71.2, flip: true  },  // 2 — branch 2 (left)
  { left: 72.0, top: 60.0, flip: false },  // 3 — branch 3 (right)
  { left: 25.0, top: 48.8, flip: true  },  // 4 — branch 4 (left)
  { left: 72.0, top: 37.5, flip: false },  // 5 — branch 5 (right)
  { left: 25.0, top: 26.2, flip: true  },  // 6 — branch 6 (left)
  { left: 72.0, top: 15.0, flip: false },  // 7 — branch 7 (right)
  { left: 50.0, top:  7.5, flip: false },  // 8 — nest
];

/* ── Bird positions (mobile — cropped viewBox "90 0 120 720") ───── */
// On mobile the SVG uses preserveAspectRatio="xMidYMid slice" with
// viewBox "90 0 120 720". Visible x range ≈ 90–210 in SVG coords.
// Positions are % of the narrow tree-panel width.
const BIRD_POSITIONS_MOBILE = [
  { left: 50.0, top: 90.0, flip: false },  // 0 — ground (centred on trunk)
  { left: 75.0, top: 82.5, flip: false },  // 1 — branch 1 right trunk origin
  { left: 25.0, top: 71.2, flip: true  },  // 2 — branch 2 left trunk origin
  { left: 75.0, top: 60.0, flip: false },  // 3 — branch 3
  { left: 25.0, top: 48.8, flip: true  },  // 4 — branch 4
  { left: 75.0, top: 37.5, flip: false },  // 5 — branch 5
  { left: 25.0, top: 26.2, flip: true  },  // 6 — branch 6
  { left: 75.0, top: 15.0, flip: false },  // 7 — branch 7
  { left: 50.0, top:  7.5, flip: false },  // 8 — nest
];

function getBirdPos(posIdx) {
  return window.innerWidth <= 600 ? BIRD_POSITIONS_MOBILE[posIdx] : BIRD_POSITIONS[posIdx];
}

/* ── State ──────────────────────────────────────────────────────── */
let currentLevel    = 0;
let birdPos         = 0;
let ch              = null;   // current challenge
let partials        = [];     // current partial row data
let partialsCorrect = [];     // boolean array tracking correct partial rows

/* ── Numpad state ───────────────────────────────────────────────── */
let activeInputEl      = null;
let numpadTouchHandled = false;  // prevent ghost click after touchend

/* ── Idle effects state ─────────────────────────────────────────── */
let idleTimer = null;

/* ── DOM refs ───────────────────────────────────────────────────── */
const startScreen       = document.getElementById('start-screen');
const gameScreen        = document.getElementById('game-screen');
const winScreen         = document.getElementById('win-screen');
const birdWrapper       = document.getElementById('bird-wrapper');
const birdSvg           = document.getElementById('bird-svg');
const challengeCard     = document.getElementById('challenge-card');
const challengeContent  = document.getElementById('challenge-content');
const feedbackMsg       = document.getElementById('feedback-msg');
const progressDots      = document.getElementById('progress-dots');
const confettiContainer = document.getElementById('confetti-container');

/* ── Tree zoom modal ─────────────────────────────────────────────── */
const treeModal        = document.getElementById('tree-modal');
const treeModalSvg     = document.getElementById('tree-modal-svg');
const treeModalClose   = document.getElementById('tree-modal-close');
const treeZoomBtn      = document.getElementById('tree-zoom-btn');

function openTreeModal() {
  if (!treeModalSvg) return;
  treeModalSvg.innerHTML = '';
  treeModalSvg.style.position = 'relative';
  const treeSvg = document.getElementById('tree-svg');
  if (treeSvg) {
    const clone = treeSvg.cloneNode(true);
    clone.style.cssText = 'width:100%;height:100%;display:block;';
    clone.removeAttribute('preserveAspectRatio'); // show full tree in modal
    clone.setAttribute('viewBox', '0 0 300 720');
    treeModalSvg.appendChild(clone);
  }
  const birdWrap = document.getElementById('bird-wrapper');
  if (birdWrap) {
    const birdClone = birdWrap.cloneNode(true);
    birdClone.id = 'modal-bird';
    birdClone.style.transition = 'none';
    birdClone.style.animation = 'none';
    const svg = birdClone.querySelector('svg');
    if (svg) { svg.style.animation = 'none'; }
    treeModalSvg.appendChild(birdClone);
  }
  treeModal.classList.add('open');
}

function closeTreeModal() {
  treeModal.classList.remove('open');
}

if (treeZoomBtn) {
  treeZoomBtn.addEventListener('click', openTreeModal);
  treeZoomBtn.addEventListener('touchend', e => { e.preventDefault(); openTreeModal(); });
}
if (treeModalClose) treeModalClose.addEventListener('click', closeTreeModal);
if (treeModal)      treeModal.addEventListener('click', e => { if (e.target === treeModal) closeTreeModal(); });

/* ── Boot ───────────────────────────────────────────────────────── */
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', resetGame);

/* ── Numpad wiring ──────────────────────────────────────────────── */
document.querySelectorAll('.nk').forEach(btn => {
  const key = btn.dataset.key;

  btn.addEventListener('mousedown', e => {
    e.preventDefault();   // prevent focus loss on desktop
  });

  btn.addEventListener('touchend', e => {
    e.preventDefault();   // prevent ghost click
    numpadTouchHandled = true;
    handleNumpadKey(key);
    // reset flag after a short delay so click can still fire on non-touch
    setTimeout(() => { numpadTouchHandled = false; }, 300);
  });

  btn.addEventListener('click', () => {
    if (!numpadTouchHandled) {
      handleNumpadKey(key);
    }
  });
});

function handleNumpadKey(key) {
  if (!activeInputEl) return;
  const row = activeInputEl.dataset.row !== undefined ? parseInt(activeInputEl.dataset.row) : null;
  const dig = activeInputEl.dataset.dig !== undefined ? parseInt(activeInputEl.dataset.dig)
              : activeInputEl.dataset.totaldig !== undefined ? parseInt(activeInputEl.dataset.totaldig) : 0;
  const isTotal = activeInputEl.dataset.totaldig !== undefined;

  if (key === 'backspace') {
    if (activeInputEl.value) {
      activeInputEl.value = '';
    } else if (isTotal) {
      // RTL: numpad backspace retreats rightward (toward ones)
      const sigCount = parseInt(activeInputEl.dataset.sigcount);
      if (dig < sigCount - 1) {
        const next = document.getElementById(`total-${dig + 1}`);
        if (next && !next.disabled) { next.focus(); setActiveInput(next); }
      }
    } else if (dig > 0) {
      const prev = document.getElementById(`partial-${row}-${dig - 1}`);
      if (prev && !prev.disabled) { prev.value = ''; prev.focus(); setActiveInput(prev); }
    }
  } else if (key === 'enter') {
    handleCheck();
  } else {
    if (!activeInputEl.value) {
      activeInputEl.value = key;
      advanceFromBox(activeInputEl);
    }
  }
}

/** Set the active input element for numpad, update ring highlight. */
function setActiveInput(el) {
  if (activeInputEl && activeInputEl !== el) {
    activeInputEl.classList.remove('nk-active');
  }
  activeInputEl = el;
  if (el) {
    el.classList.add('nk-active');
  }
}

/* ═══════════════════════════════════════════════════════════════════
   BIRD IDLE EFFECTS  (resting animation + musical notes)
   ═══════════════════════════════════════════════════════════════════ */

function spawnMusicalNote() {
  const rect = birdWrapper.getBoundingClientRect();
  if (!rect.width) return;
  const note = document.createElement('span');
  note.className   = 'musical-note';
  note.textContent = Math.random() > 0.5 ? '♪' : '♫';
  // Scatter horizontally around the bird's head area
  note.style.left  = (rect.left + rect.width  * (0.2 + Math.random() * 0.6)) + 'px';
  note.style.top   = (rect.top  + rect.height * (0.1 + Math.random() * 0.35)) + 'px';
  note.style.animationDelay = (Math.random() * 0.2) + 's';
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 1800);
}

function scheduleIdleEffect() {
  stopIdleEffects();
  const delay = 3200 + Math.random() * 2400;   // 3.2 – 5.6 s
  idleTimer = setTimeout(() => {
    spawnMusicalNote();
    scheduleIdleEffect();   // reschedule
  }, delay);
}

function stopIdleEffects() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
}

function startIdleAnimation() {
  birdSvg.classList.add('idle');
  scheduleIdleEffect();
}

function stopIdleAnimation() {
  birdSvg.classList.remove('idle');
  stopIdleEffects();
}

/* ═══════════════════════════════════════════════════════════════════
   LADDER METHOD HELPERS
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Decompose a multiplicand into its place-value rows (largest first).
 *
 * New (correct) model:
 *   - placeValue: the full place-value number shown in the label (e.g. 300)
 *   - answer: what the student types — the full partial product (e.g. 1800 for 300×6)
 *   - position: 0=ones, 1=tens, 2=hundreds (number of trailing zeros in the answer)
 *
 * e.g. 554 × 6 →
 *   { digit:5, position:2, placeValue:500, answer:3000 }
 *   { digit:5, position:1, placeValue:50,  answer:300  }
 *   { digit:4, position:0, placeValue:4,   answer:24   }
 */
function getPartials(multiplicand, multiplier) {
  const s = String(multiplicand);
  return s.split('').map((digitCh, i) => {
    const digit     = Number(digitCh);
    const position  = s.length - 1 - i;          // 0=ones, 1=tens, 2=hundreds
    const placeValue = digit * Math.pow(10, position);
    const answer    = placeValue * multiplier;
    return { digit, position, placeValue, answer };
  }).filter(p => p.digit > 0);   // skip digits that are zero
}

/* ── Shared helpers ─────────────────────────────────────────────── */
function showFeedback(msg, type) {
  feedbackMsg.textContent = msg;
  feedbackMsg.className   = 'feedback-msg ' + type;
}

function shakeEl(el) {
  el.classList.remove('shake');
  void el.offsetWidth;   // force reflow
  el.classList.add('shake');
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

function spawnStars(el) {
  const rect   = el.getBoundingClientRect();
  const cx     = rect.left + rect.width  / 2;
  const cy     = rect.top  + rect.height / 2;
  const emojis = ['⭐', '🌟', '✨', '💫', '⭐', '🌟'];
  emojis.forEach((e, i) => {
    const angle = (i / emojis.length) * Math.PI * 2 - Math.PI / 2;
    const dist  = 65 + Math.random() * 35;
    const star  = document.createElement('div');
    star.className = 'burst-star';
    star.textContent = e;
    star.style.left = cx + 'px';
    star.style.top  = cy + 'px';
    star.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    star.style.setProperty('--dy', `${Math.sin(angle) * dist - 30}px`);
    star.style.animationDelay = (i * 0.07) + 's';
    document.body.appendChild(star);
    setTimeout(() => star.remove(), 1000);
  });
}

/* ═══════════════════════════════════════════════════════════════════
   BIRD MOVEMENT
   ═══════════════════════════════════════════════════════════════════ */
function placeBird(posIdx, animate) {
  const pos = getBirdPos(posIdx);

  // Stop idle before any movement
  stopIdleAnimation();

  if (animate) {
    birdWrapper.addEventListener('transitionend', () => {
      birdSvg.classList.add('landing');
      birdSvg.addEventListener('animationend', () => {
        birdSvg.classList.remove('landing');
        startIdleAnimation();    // resume idle once landed
      }, { once: true });
    }, { once: true });
  } else {
    // Immediate placement — start idle shortly after
    setTimeout(startIdleAnimation, 400);
  }

  birdWrapper.style.left = pos.left + '%';
  birdWrapper.style.top  = pos.top  + '%';
  birdSvg.classList.toggle('flip', pos.flip);
}

function revealBranchStar(branchNum) {
  const el = document.getElementById('star-' + branchNum);
  if (el) {
    el.setAttribute('opacity', '1');
    el.style.transition = 'opacity 0.4s';
  }
}

/* ═══════════════════════════════════════════════════════════════════
   PROGRESS DOTS
   ═══════════════════════════════════════════════════════════════════ */
function renderProgress() {
  progressDots.innerHTML = '';
  for (let i = 0; i < CHALLENGES.length; i++) {
    const dot = document.createElement('div');
    dot.className = 'progress-dot' +
      (i < currentLevel   ? ' done'    : '') +
      (i === currentLevel ? ' current' : '');
    dot.textContent = i < currentLevel ? '✓' : String(i + 1);
    progressDots.appendChild(dot);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   DIGIT BOX ADVANCE HELPER
   ═══════════════════════════════════════════════════════════════════ */
function advanceFromBox(inp) {
  const row = inp.dataset.row !== undefined ? parseInt(inp.dataset.row) : null;
  const dig = inp.dataset.dig !== undefined ? parseInt(inp.dataset.dig) : parseInt(inp.dataset.totaldig);
  const isTotal = inp.dataset.totaldig !== undefined;
  const sigCount = parseInt(inp.dataset.sigcount);

  if (isTotal) {
    // Total row is filled RIGHT→LEFT (ones first).
    // After filling dig=N, move to dig=N-1 (leftward).
    inp.classList.remove('total-start');   // clear start indicator once used
    if (dig > 0) {
      const prev = document.getElementById(`total-${dig - 1}`);
      if (prev && !prev.disabled) { prev.focus(); setActiveInput(prev); }
    } else {
      // Reached the leftmost box — auto-validate
      setTimeout(() => checkTotal(), 80);
    }
  } else {
    // Partial rows: left-to-right
    if (dig < sigCount - 1) {
      const next = document.getElementById(`partial-${row}-${dig + 1}`);
      if (next && !next.disabled) { next.focus(); setActiveInput(next); }
    } else if (row !== null && !partialsCorrect[row]) {
      setTimeout(() => validatePartialRow(row), 80);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   CHALLENGE RENDERING
   ═══════════════════════════════════════════════════════════════════ */
function renderChallenge() {
  ch              = CHALLENGES[currentLevel];
  partials        = getPartials(ch.multiplicand, ch.multiplier);
  partialsCorrect = new Array(partials.length).fill(false);
  const total     = ch.multiplicand * ch.multiplier;

  renderProgress();
  showFeedback(ch.intro, 'hint');

  // Compute column width for right-alignment
  const maxCols = Math.max(
    ...partials.map(p => String(p.answer).length),
    String(total).length
  );

  // ── Problem header ──────────────────────────────────────────
  let html = `
    <div class="problem-display">
      <span class="problem-number">${ch.multiplicand}</span>
      <span class="problem-op">×</span>
      <span class="problem-number">${ch.multiplier}</span>
      <span class="problem-eq">=</span>
      <span class="problem-question">?</span>
    </div>
    <div class="method-label">Fill in the ladder ↓</div>

    <div class="ladder" id="ladder">
  `;

  // ── Ladder rows ─────────────────────────────────────────────
  partials.forEach((p, i) => {
    const ansStr   = String(p.answer);
    const sigDigits = ansStr.length - p.position;  // digits student types
    const numSpacers = maxCols - ansStr.length;

    html += `
      <div class="ladder-row" id="row-${i}">
        <div class="row-label">
          <span class="lbl-place">${p.placeValue}</span>
          <span class="lbl-sep">×</span>
          <span class="lbl-mult">${ch.multiplier}</span>
          <span class="lbl-eq">=</span>
        </div>
        <div class="digit-area" id="grid-${i}">
    `;

    // Left spacers (for column alignment)
    for (let s = 0; s < numSpacers; s++) {
      html += `<span class="digit-spacer"></span>`;
    }

    // Significant digit input boxes
    for (let d = 0; d < sigDigits; d++) {
      html += `<input
        type="text"
        inputmode="numeric"
        maxlength="1"
        class="digit-box"
        id="partial-${i}-${d}"
        data-row="${i}"
        data-dig="${d}"
        data-sigcount="${sigDigits}"
        autocomplete="off"
        aria-label="${p.placeValue} times ${ch.multiplier} digit ${d+1}">`;
    }

    // Trailing zero boxes (non-interactive)
    for (let z = 0; z < p.position; z++) {
      html += `<div class="digit-box digit-zero">0</div>`;
    }

    html += `
        </div><!-- /.digit-area -->
        <span class="row-status" id="status-${i}"></span>
      </div>
    `;
  });

  // ── Total row ────────────────────────────────────────────────
  const totalStr   = String(total);
  const totalDigits = totalStr.length;

  html += `
    </div>

    <div class="ladder-sum-line"></div>

    <div class="total-row">
      <div class="row-label total-lbl">
        <span class="total-word">Total</span>
        <span class="lbl-eq">=</span>
      </div>
      <div class="digit-area" id="grid-total">
  `;

  for (let d = 0; d < totalDigits; d++) {
    html += `<input
      type="text"
      inputmode="numeric"
      maxlength="1"
      class="digit-box"
      id="total-${d}"
      data-totaldig="${d}"
      data-sigcount="${totalDigits}"
      data-answer="${totalStr[d]}"
      disabled
      autocomplete="off"
      aria-label="Total digit ${d+1}">`;
  }

  html += `
      </div><!-- /.digit-area -->
      <span class="row-status" id="total-status"></span>
    </div>

    <div class="check-row">
      <button class="btn-check" id="check-btn" type="button">Check ✓</button>
    </div>
  `;

  challengeContent.innerHTML = html;

  // ── Numpad: suppress native keyboard on small screens ───────
  const isMobile = window.innerWidth <= 900;

  // ── Bind events to partial boxes ────────────────────────────
  partials.forEach((p, i) => {
    const ansStr   = String(p.answer);
    const sigDigits = ansStr.length - p.position;
    for (let d = 0; d < sigDigits; d++) {
      const inp = document.getElementById(`partial-${i}-${d}`);
      if (!inp) continue;

      if (isMobile) {
        inp.setAttribute('inputmode', 'none');
        inp.readOnly = true;
      }

      inp.addEventListener('input', () => {
        // Strip non-digits, keep last char only
        inp.value = inp.value.replace(/\D/g, '').slice(-1);
        if (inp.value) advanceFromBox(inp);
      });

      inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace') {
          e.preventDefault();
          if (inp.value) {
            inp.value = '';
          } else if (d > 0) {
            const prev = document.getElementById(`partial-${i}-${d-1}`);
            if (prev && !prev.disabled) { prev.value = ''; prev.focus(); setActiveInput(prev); }
          }
        } else if (e.key === 'ArrowLeft' && d > 0) {
          const prev = document.getElementById(`partial-${i}-${d-1}`);
          if (prev) { prev.focus(); setActiveInput(prev); }
        } else if (e.key === 'ArrowRight' && d < sigDigits - 1) {
          const next = document.getElementById(`partial-${i}-${d+1}`);
          if (next && !next.disabled) { next.focus(); setActiveInput(next); }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          validatePartialRow(i);
        }
      });

      inp.addEventListener('focus', () => setActiveInput(inp));
      inp.addEventListener('click', () => setActiveInput(inp));
    }
  });

  // ── Bind events to total boxes ───────────────────────────────
  for (let d = 0; d < totalDigits; d++) {
    const inp = document.getElementById(`total-${d}`);
    if (!inp) continue;

    if (isMobile) {
      inp.setAttribute('inputmode', 'none');
      inp.readOnly = true;
    }

    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(-1);
      if (inp.value) advanceFromBox(inp);
    });

    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (inp.value) {
          inp.value = '';
        } else if (d < totalDigits - 1) {
          // RTL: backspace retreats rightward (toward ones column)
          const next = document.getElementById(`total-${d + 1}`);
          if (next && !next.disabled) { next.focus(); setActiveInput(next); }
        }
      } else if (e.key === 'ArrowLeft' && d > 0) {
        const prev = document.getElementById(`total-${d-1}`);
        if (prev) { prev.focus(); setActiveInput(prev); }
      } else if (e.key === 'ArrowRight' && d < totalDigits - 1) {
        const next = document.getElementById(`total-${d+1}`);
        if (next && !next.disabled) { next.focus(); setActiveInput(next); }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleCheck();
      }
    });

    inp.addEventListener('focus', () => setActiveInput(inp));
    inp.addEventListener('click', () => setActiveInput(inp));
  }

  document.getElementById('check-btn').addEventListener('click', handleCheck);

  // Focus first input (also sets it as active for numpad)
  const firstInp = document.getElementById('partial-0-0');
  if (firstInp) {
    firstInp.focus();
    setActiveInput(firstInp);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   VALIDATION
   ═══════════════════════════════════════════════════════════════════ */

/** Validate a single partial row (called on Enter key or via check button). */
function validatePartialRow(i) {
  const p = partials[i];
  if (partialsCorrect[i]) return false;
  const ansStr   = String(p.answer);
  const sigDigits = ansStr.length - p.position;
  const expectedSig = ansStr.slice(0, sigDigits);

  let typed = '';
  for (let d = 0; d < sigDigits; d++) {
    const box = document.getElementById(`partial-${i}-${d}`);
    typed += box ? (box.value || '') : '';
  }

  if (typed.length < sigDigits) { showFeedback('Fill all boxes in this row!', 'error'); return false; }

  if (typed === expectedSig) {
    playChirp();
    partialsCorrect[i] = true;
    const status = document.getElementById(`status-${i}`);
    for (let d = 0; d < sigDigits; d++) {
      const box = document.getElementById(`partial-${i}-${d}`);
      if (box) {
        box.readOnly = true;
        box.classList.add('digit-correct');
        box.classList.remove('digit-wrong', 'nk-active');
      }
    }
    document.querySelectorAll(`#grid-${i} .digit-zero`).forEach(z => z.classList.add('digit-correct'));
    status.textContent = '✓'; status.style.color = 'var(--correct)';
    checkIfAllPartialsCorrect();

    // Auto-advance to next uncorrected partial
    const next = partialsCorrect.findIndex((c, idx) => idx > i && !c);
    if (next !== -1) {
      const nb = document.getElementById(`partial-${next}-0`);
      if (nb) { nb.focus(); setActiveInput(nb); }
    }
    return true;
  } else {
    playWrong();
    const status = document.getElementById(`status-${i}`);
    status.textContent = '✗'; status.style.color = 'var(--wrong)';
    const grid = document.getElementById(`grid-${i}`);
    if (grid) shakeEl(grid);
    for (let d = 0; d < sigDigits; d++) {
      const box = document.getElementById(`partial-${i}-${d}`);
      if (box) {
        box.classList.add('digit-wrong');
        box.classList.remove('digit-correct');
        box.value = '';
      }
    }
    showFeedback(`Try again — what is ${p.placeValue} × ${ch.multiplier}?`, 'error');
    const fb = document.getElementById(`partial-${i}-0`);
    if (fb) { fb.focus(); setActiveInput(fb); }
    return false;
  }
}

/** Validate ALL partial rows at once (called from Check button). */
function checkPartials() {
  let allCorrect = true;
  let anyFilled  = false;

  partials.forEach((p, i) => {
    if (partialsCorrect[i]) return;   // already locked in as correct
    const ansStr   = String(p.answer);
    const sigDigits = ansStr.length - p.position;
    const expectedSig = ansStr.slice(0, sigDigits);

    let typed = '';
    for (let d = 0; d < sigDigits; d++) {
      const box = document.getElementById(`partial-${i}-${d}`);
      typed += box ? (box.value || '') : '';
    }
    if (!typed) { allCorrect = false; return; }
    anyFilled = true;

    if (typed === expectedSig) {
      partialsCorrect[i] = true;
      const status = document.getElementById(`status-${i}`);
      for (let d = 0; d < sigDigits; d++) {
        const box = document.getElementById(`partial-${i}-${d}`);
        if (box) {
          box.readOnly = true;
          box.classList.add('digit-correct');
          box.classList.remove('digit-wrong', 'nk-active');
        }
      }
      document.querySelectorAll(`#grid-${i} .digit-zero`).forEach(z => z.classList.add('digit-correct'));
      status.textContent = '✓'; status.style.color = 'var(--correct)';
    } else {
      const status = document.getElementById(`status-${i}`);
      status.textContent = '✗'; status.style.color = 'var(--wrong)';
      const grid = document.getElementById(`grid-${i}`);
      if (grid) shakeEl(grid);
      allCorrect = false;
    }
  });

  const allAlreadyCorrect = partialsCorrect.every(Boolean);
  if (!anyFilled && !allAlreadyCorrect) {
    showFeedback('Fill in the rows first!', 'error');
    return;
  }

  checkIfAllPartialsCorrect();
  if (!allCorrect) {
    showFeedback('Some rows are wrong — try those again! 🔍', 'error');
  }
}

function checkIfAllPartialsCorrect() {
  if (!partialsCorrect.every(Boolean)) return;

  showFeedback('➕ Add them up! Start from the ones column →', 'partial');

  const total       = ch.multiplicand * ch.multiplier;
  const totalStr    = String(total);
  const totalDigits = totalStr.length;

  // Enable all total boxes
  for (let d = 0; d < totalDigits; d++) {
    const box = document.getElementById(`total-${d}`);
    if (box) {
      box.disabled = false;
      if (window.innerWidth <= 900) {
        box.setAttribute('inputmode', 'none');
        box.readOnly = true;
      }
    }
  }

  // Focus RIGHTMOST (ones) box — RTL entry, pulse to draw attention
  const last = document.getElementById(`total-${totalDigits - 1}`);
  if (last) {
    last.classList.add('total-start');
    last.focus();
    setActiveInput(last);
  }

  document.getElementById('check-btn').textContent = 'Check Total ✓';
}

function checkTotal() {
  const total     = ch.multiplicand * ch.multiplier;
  const totalStr  = String(total);
  const totalDigits = totalStr.length;
  const totalStat = document.getElementById('total-status');

  let typed = '';
  for (let d = 0; d < totalDigits; d++) {
    const box = document.getElementById(`total-${d}`);
    typed += box ? (box.value || '') : '';
  }

  if (typed.length < totalDigits) { showFeedback('Enter the total first!', 'error'); return; }

  if (typed === totalStr) {
    playSuccess();
    for (let d = 0; d < totalDigits; d++) {
      const box = document.getElementById(`total-${d}`);
      if (box) {
        box.readOnly = true;
        box.classList.add('digit-correct');
        box.classList.remove('digit-wrong', 'nk-active');
      }
    }
    totalStat.textContent = '✓'; totalStat.style.color = 'var(--correct)';
    document.getElementById('check-btn').disabled = true;
    showFeedback('🎉 Brilliant! The bird hops up!', 'success');
    const gridTotal = document.getElementById('grid-total');
    if (gridTotal) spawnStars(gridTotal);
    // Flash card green
    challengeCard.style.transition = 'box-shadow 0.3s';
    challengeCard.style.boxShadow  = '0 0 0 4px var(--correct), var(--card-shadow)';
    setTimeout(() => { challengeCard.style.boxShadow = ''; }, 700);
    setTimeout(advanceLevel, 1300);
  } else {
    playWrong();
    totalStat.textContent = '✗'; totalStat.style.color = 'var(--wrong)';
    showFeedback('Not quite — check your addition!', 'error');
    const gridTotal = document.getElementById('grid-total');
    if (gridTotal) shakeEl(gridTotal);
    for (let d = 0; d < totalDigits; d++) {
      const box = document.getElementById(`total-${d}`);
      if (box) {
        box.classList.add('digit-wrong');
        box.classList.remove('digit-correct');
        box.value = '';
      }
    }
  }
}

/** Route the Check button to the right validation step. */
function handleCheck() {
  if (partialsCorrect.every(Boolean)) {
    checkTotal();
  } else {
    checkPartials();
  }
}

/* ═══════════════════════════════════════════════════════════════════
   LEVEL ADVANCEMENT
   ═══════════════════════════════════════════════════════════════════ */
function advanceLevel() {
  revealBranchStar(birdPos);
  birdPos++;
  placeBird(birdPos, true);
  currentLevel++;
  if (currentLevel >= CHALLENGES.length) {
    setTimeout(showWin, 900);
  } else {
    setTimeout(renderChallenge, 750);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   GAME LIFECYCLE
   ═══════════════════════════════════════════════════════════════════ */
function startGame() {
  startScreen.classList.remove('active');
  gameScreen.classList.add('active');
  currentLevel = 0;
  birdPos      = 0;
  for (let i = 1; i <= 7; i++) {
    const el = document.getElementById('star-' + i);
    if (el) el.setAttribute('opacity', '0');
  }

  // Mobile SVG crop: viewBox focuses on trunk/branch origins
  if (window.innerWidth <= 600) {
    const treeSvg = document.getElementById('tree-svg');
    treeSvg.setAttribute('viewBox', '90 0 120 720');
    treeSvg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  }

  placeBird(0, false);
  renderProgress();
  renderChallenge();
}

function resetGame() {
  winScreen.classList.remove('active');
  gameScreen.classList.add('active');
  confettiContainer.innerHTML = '';
  startGame();
}

function showWin() {
  gameScreen.classList.remove('active');
  winScreen.classList.add('active');
  launchConfetti();
}

/* ═══════════════════════════════════════════════════════════════════
   CONFETTI
   ═══════════════════════════════════════════════════════════════════ */
function launchConfetti() {
  confettiContainer.innerHTML = '';
  const colors = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c77dff','#ff9800','#00bcd4'];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left              = Math.random() * 100 + '%';
    p.style.top               = '-12px';
    p.style.width             = (Math.random() * 8 + 5) + 'px';
    p.style.height            = (Math.random() * 8 + 5) + 'px';
    p.style.background        = colors[i % colors.length];
    p.style.borderRadius      = Math.random() > 0.5 ? '50%' : '2px';
    p.style.animationDelay    = (Math.random() * 2.5) + 's';
    p.style.animationDuration = (Math.random() * 2.5 + 2) + 's';
    confettiContainer.appendChild(p);
  }
}
