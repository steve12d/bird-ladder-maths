'use strict';

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

/* ── Bird positions ─────────────────────────────────────────────── */
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

/* ── State ──────────────────────────────────────────────────────── */
let currentLevel = 0;
let birdPos      = 0;
let ch           = null;   // current challenge
let partials     = [];     // current partial row data

/* ── DOM refs ───────────────────────────────────────────────────── */
const startScreen       = document.getElementById('start-screen');
const gameScreen        = document.getElementById('game-screen');
const winScreen         = document.getElementById('win-screen');
const birdWrapper       = document.getElementById('bird-wrapper');
const birdSvg           = document.getElementById('bird-svg');
const challengeCard     = document.getElementById('challenge-card');
const challengeContent  = document.getElementById('challenge-content');
const feedbackMsg       = document.getElementById('feedback-msg');
const levelLabel        = document.getElementById('level-label');
const progressDots      = document.getElementById('progress-dots');
const confettiContainer = document.getElementById('confetti-container');

/* ── Boot ───────────────────────────────────────────────────────── */
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', resetGame);

/* ═══════════════════════════════════════════════════════════════════
   LADDER METHOD HELPERS
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Decompose a multiplicand into its place-value rows (largest first).
 * Each row: student types  digit × multiplier  (times-table fact).
 * The trailing zeros (equal to the digit's position) are pre-shown.
 *
 * e.g. 554 × 6 →
 *   { digit:5, timesTable:30, trailingZeros:"00", answer:3000 }
 *   { digit:5, timesTable:30, trailingZeros:"0",  answer:300  }
 *   { digit:4, timesTable:24, trailingZeros:"",   answer:24   }
 */
function getPartials(multiplicand, multiplier) {
  const s = String(multiplicand);
  return s.split('').map((ch, i) => {
    const digit         = Number(ch);
    const position      = s.length - 1 - i;      // 0=ones, 1=tens, 2=hundreds
    const trailingZeros = '0'.repeat(position);
    const timesTable    = digit * multiplier;     // what the student fills in
    const answer        = timesTable * Math.pow(10, position);
    return { digit, position, timesTable, trailingZeros, answer };
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
  const pos = BIRD_POSITIONS[posIdx];
  if (animate) {
    birdWrapper.addEventListener('transitionend', () => {
      birdSvg.classList.add('landing');
      birdSvg.addEventListener('animationend',
        () => birdSvg.classList.remove('landing'), { once: true });
    }, { once: true });
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
  levelLabel.textContent = `Branch ${currentLevel + 1} of ${CHALLENGES.length}`;
}

/* ═══════════════════════════════════════════════════════════════════
   CHALLENGE RENDERING
   The ladder looks like this for 554 × 6:
   ┌──────────────────────────────────────────────────┐
   │      554  ×  6  =  ?                             │
   │  ─────────────────────────── Ladder Method       │
   │  5  ×  6  = [  30  ] 0 0     ← 500×6            │
   │  5  ×  6  = [  30  ] 0       ← 50×6             │
   │  4  ×  6  = [  24  ]         ← 4×6              │
   │             ──────────────                       │
   │    Total  = [      ]                             │
   └──────────────────────────────────────────────────┘
   Students type the times-table answer (digit × multiplier).
   The trailing zeros are pre-populated in grey.
   ═══════════════════════════════════════════════════════════════════ */
function renderChallenge() {
  ch       = CHALLENGES[currentLevel];
  partials = getPartials(ch.multiplicand, ch.multiplier);
  const total    = ch.multiplicand * ch.multiplier;
  const maxTZ    = Math.max(...partials.map(p => p.trailingZeros.length));

  renderProgress();
  showFeedback(ch.intro, 'hint');

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

    <div class="ladder" id="ladder" style="--max-tz:${maxTZ}">
  `;

  // ── Ladder rows ─────────────────────────────────────────────
  // Each row: label (digit × mult =) | input | trailing zeros
  // The value column (input + zeros) is always the same total width,
  // which creates right-aligned numbers just like column multiplication.
  partials.forEach((p, i) => {
    // Pad trailing zeros area so all rows have identical right-side width.
    // Use invisible zero chars (same font/weight as trailing-zeros) for exact width.
    const paddingZeros = maxTZ - p.trailingZeros.length;
    const spacer = paddingZeros > 0
      ? `<span class="tz-spacer" aria-hidden="true">${'0'.repeat(paddingZeros)}</span>`
      : '';

    html += `
      <div class="ladder-row" id="row-${i}">
        <div class="row-label">
          <span class="lbl-digit">${p.digit}</span>
          <span class="lbl-sep">×</span>
          <span class="lbl-mult">${ch.multiplier}</span>
          <span class="lbl-eq">=</span>
        </div>
        <div class="row-value">
          <input
            type="number" inputmode="numeric" min="0"
            class="ladder-input" placeholder="?"
            autocomplete="off"
            id="partial-${i}"
            data-times-table="${p.timesTable}"
            data-digit="${p.digit}"
            aria-label="${p.digit} times ${ch.multiplier}">
          <span class="trailing-zeros">${p.trailingZeros}</span>
          ${spacer}
        </div>
        <span class="row-status" id="status-${i}"></span>
      </div>
    `;
  });

  html += `
    </div>

    <div class="ladder-sum-line"></div>

    <div class="total-row">
      <div class="row-label total-lbl">
        <span class="total-word">Total</span>
        <span class="lbl-eq">=</span>
      </div>
      <div class="row-value">
        <input
          type="number" inputmode="numeric" min="0"
          class="ladder-input total-input" placeholder="?"
          autocomplete="off"
          id="total-input"
          data-answer="${total}"
          disabled
          aria-label="Total">
      </div>
      <span class="row-status" id="total-status"></span>
    </div>

    <div class="check-row">
      <button class="btn-check" id="check-btn" type="button">Check ✓</button>
    </div>
  `;

  challengeContent.innerHTML = html;

  // ── Bind events ─────────────────────────────────────────────
  document.getElementById('check-btn').addEventListener('click', handleCheck);

  // Per-row Enter key: validate that row, auto-advance focus
  partials.forEach((p, i) => {
    const inp = document.getElementById(`partial-${i}`);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); validatePartialRow(i); }
    });
    inp.addEventListener('wheel', e => e.preventDefault(), { passive: false });
  });

  // Total Enter key
  const totalInp = document.getElementById('total-input');
  totalInp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); handleCheck(); }
  });
  totalInp.addEventListener('wheel', e => e.preventDefault(), { passive: false });

  // Focus first input
  document.getElementById('partial-0')?.focus();
}

/* ═══════════════════════════════════════════════════════════════════
   VALIDATION
   ═══════════════════════════════════════════════════════════════════ */

/** Validate a single partial row (called on Enter key in that row). */
function validatePartialRow(i) {
  const p      = partials[i];
  const inp    = document.getElementById(`partial-${i}`);
  const status = document.getElementById(`status-${i}`);
  if (!inp || inp.disabled || inp.value === '') return false;

  const val = parseInt(inp.value, 10);
  if (val === p.timesTable) {
    inp.classList.add('correct');
    inp.classList.remove('wrong');
    inp.disabled = true;
    status.textContent = '✓';
    status.style.color = 'var(--correct)';
    checkIfAllPartialsCorrect();
    // Auto-focus next partial, or total if all done
    const next = document.getElementById(`partial-${i + 1}`);
    if (next && !next.disabled) next.focus();
    return true;
  } else {
    inp.classList.add('wrong');
    inp.classList.remove('correct');
    status.textContent = '✗';
    status.style.color = 'var(--wrong)';
    shakeEl(inp);
    showFeedback(`Try again — what is ${p.digit} × ${ch.multiplier}?`, 'error');
    return false;
  }
}

/** Validate ALL partial rows at once (called from Check button). */
function checkPartials() {
  let allCorrect = true;
  let anyFilled  = false;

  partials.forEach((p, i) => {
    const inp    = document.getElementById(`partial-${i}`);
    const status = document.getElementById(`status-${i}`);
    if (inp.disabled) return;   // already locked in as correct
    if (inp.value === '') { allCorrect = false; return; }
    anyFilled = true;

    const val = parseInt(inp.value, 10);
    if (val === p.timesTable) {
      inp.classList.add('correct'); inp.classList.remove('wrong');
      inp.disabled = true;
      status.textContent = '✓'; status.style.color = 'var(--correct)';
    } else {
      inp.classList.add('wrong'); inp.classList.remove('correct');
      status.textContent = '✗'; status.style.color = 'var(--wrong)';
      shakeEl(inp);
      allCorrect = false;
    }
  });

  if (!anyFilled && !partials.every((_, i) => document.getElementById(`partial-${i}`).disabled)) {
    showFeedback('Fill in the rows first!', 'error');
    return;
  }

  checkIfAllPartialsCorrect();
  if (!allCorrect) {
    showFeedback('Some rows are wrong — try those again! 🔍', 'error');
  }
}

function checkIfAllPartialsCorrect() {
  const allLocked = partials.every((_, i) => {
    const inp = document.getElementById(`partial-${i}`);
    return inp && inp.disabled && inp.classList.contains('correct');
  });
  if (!allLocked) return;

  showFeedback('All rows correct! Now add them all up. ➕', 'partial');
  const totalInp  = document.getElementById('total-input');
  totalInp.disabled = false;
  totalInp.focus();
  document.getElementById('check-btn').textContent = 'Check Total ✓';
}

function checkTotal() {
  const totalInp  = document.getElementById('total-input');
  const totalStat = document.getElementById('total-status');
  if (totalInp.value === '') { showFeedback('Enter the total first!', 'error'); return; }

  const answer = parseInt(totalInp.dataset.answer, 10);
  const val    = parseInt(totalInp.value, 10);

  if (val === answer) {
    totalInp.classList.add('correct'); totalInp.classList.remove('wrong');
    totalStat.textContent = '✓'; totalStat.style.color = 'var(--correct)';
    document.getElementById('check-btn').disabled = true;
    showFeedback('🎉 Brilliant! The bird hops up!', 'success');
    spawnStars(totalInp);
    // Flash card green
    challengeCard.style.transition = 'box-shadow 0.3s';
    challengeCard.style.boxShadow  = '0 0 0 4px var(--correct), var(--card-shadow)';
    setTimeout(() => { challengeCard.style.boxShadow = ''; }, 700);
    setTimeout(advanceLevel, 1300);
  } else {
    totalInp.classList.add('wrong'); totalInp.classList.remove('correct');
    totalStat.textContent = '✗'; totalStat.style.color = 'var(--wrong)';
    showFeedback('Not quite — check your addition!', 'error');
    shakeEl(totalInp);
  }
}

/** Route the Check button to the right validation step. */
function handleCheck() {
  const totalInp = document.getElementById('total-input');
  if (!totalInp.disabled) {
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
