'use strict';

/* ── Challenge data ─────────────────────────────────────────────── */
// Each level: multiplicand × multiplier, increasing difficulty for ages 8–10.
// Uses ladder method: decompose multiplicand by place value → partial products → sum.
const CHALLENGES = [
  { multiplicand: 13,  multiplier: 2, intro: "Let's start climbing! 🌿"         },
  { multiplicand: 24,  multiplier: 4, intro: "Up we go! 🍃"                      },
  { multiplicand: 36,  multiplier: 5, intro: "Going higher! 🌱"                  },
  { multiplicand: 123, multiplier: 3, intro: "Three digits — you've got this! 🌟" },
  { multiplicand: 245, multiplier: 4, intro: "More than halfway up! ⭐"           },
  { multiplicand: 347, multiplier: 6, intro: "Nearly at the top! 🌈"             },
  { multiplicand: 489, multiplier: 7, intro: "Last branch — the nest is close! 🪺" },
];

/* ── Bird positions ─────────────────────────────────────────────── */
// Percentages of tree-wrap dimensions (300 × 720 SVG coordinate space).
// left  = center-x as % of width  (transform: translateX(-50%) centres it)
// top   = top edge of bird as % of height
// flip  = face left (on left-side branches)
const BIRD_POSITIONS = [
  { left: 70.0, top: 89.0, flip: false },  // 0 — ground (start)
  { left: 72.0, top: 82.5, flip: false },  // 1 — branch 1 (right, y≈640)
  { left: 26.0, top: 71.2, flip: true  },  // 2 — branch 2 (left,  y≈560)
  { left: 72.0, top: 60.0, flip: false },  // 3 — branch 3 (right, y≈480)
  { left: 26.0, top: 48.8, flip: true  },  // 4 — branch 4 (left,  y≈400)
  { left: 72.0, top: 37.5, flip: false },  // 5 — branch 5 (right, y≈320)
  { left: 26.0, top: 26.2, flip: true  },  // 6 — branch 6 (left,  y≈240)
  { left: 72.0, top: 15.0, flip: false },  // 7 — branch 7 (right, y≈160)
  { left: 50.0, top:  7.5, flip: false },  // 8 — nest
];

/* ── State ──────────────────────────────────────────────────────── */
let currentLevel   = 0;  // index into CHALLENGES (0-6)
let birdPos        = 0;  // index into BIRD_POSITIONS (0 = ground)
let partialsLocked = false;

/* ── DOM refs ───────────────────────────────────────────────────── */
const startScreen    = document.getElementById('start-screen');
const gameScreen     = document.getElementById('game-screen');
const winScreen      = document.getElementById('win-screen');
const birdWrapper    = document.getElementById('bird-wrapper');
const birdImg        = document.getElementById('bird-img');
const challengeCard  = document.getElementById('challenge-card');
const challengeContent = document.getElementById('challenge-content');
const feedbackMsg    = document.getElementById('feedback-msg');
const levelLabel     = document.getElementById('level-label');
const progressDots   = document.getElementById('progress-dots');
const confettiContainer = document.getElementById('confetti-container');

/* ── Boot ───────────────────────────────────────────────────────── */
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', resetGame);

/* ── Helpers ────────────────────────────────────────────────────── */

/** Decompose a number into place-value parts, largest first.
 *  e.g. 347 → [{placeValue:300,product:1800},{placeValue:40,product:240},{placeValue:7,product:42}]
 */
function getPartials(multiplicand, multiplier) {
  const s = String(multiplicand);
  return s.split('').map((ch, i) => {
    const d = Number(ch);
    const place = d * Math.pow(10, s.length - 1 - i);
    return { placeValue: place, product: place * multiplier };
  }).filter(p => p.placeValue > 0);
}

function showFeedback(msg, type) {
  feedbackMsg.textContent = msg;
  feedbackMsg.className   = 'feedback-msg ' + type;
}

function shakeEl(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

function spawnStars(el) {
  const rect = el.getBoundingClientRect();
  const cx   = rect.left + rect.width  / 2;
  const cy   = rect.top  + rect.height / 2;
  const emojis = ['⭐', '🌟', '✨', '💫', '⭐', '🌟'];
  emojis.forEach((e, i) => {
    const angle = (i / emojis.length) * Math.PI * 2 - Math.PI / 2;
    const dist  = 70 + Math.random() * 40;
    const star  = document.createElement('div');
    star.className = 'burst-star';
    star.textContent = e;
    star.style.left = cx + 'px';
    star.style.top  = cy + 'px';
    star.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    star.style.setProperty('--dy', `${Math.sin(angle) * dist - 30}px`);
    star.style.animationDelay = (i * 0.06) + 's';
    document.body.appendChild(star);
    setTimeout(() => star.remove(), 1000);
  });
}

/* ── Bird movement ──────────────────────────────────────────────── */
function placeBird(posIdx, animate) {
  const pos = BIRD_POSITIONS[posIdx];

  if (animate) {
    // After the CSS transition ends, play the landing bounce
    const onTransEnd = () => {
      birdImg.classList.add('landing');
      birdImg.addEventListener('animationend', () => birdImg.classList.remove('landing'), { once: true });
    };
    birdWrapper.addEventListener('transitionend', onTransEnd, { once: true });
  }

  birdWrapper.style.left = pos.left + '%';
  birdWrapper.style.top  = pos.top  + '%';

  // Handle horizontal flip
  if (pos.flip) {
    birdImg.classList.add('flip');
    birdImg.classList.remove('landing'); // reset so flip+landing class combo works next time
  } else {
    birdImg.classList.remove('flip');
  }
}

function revealBranchStar(branchNum) {
  const el = document.getElementById('star-' + branchNum);
  if (el) el.setAttribute('opacity', '1');
}

/* ── Progress dots ──────────────────────────────────────────────── */
function renderProgress() {
  progressDots.innerHTML = '';
  for (let i = 0; i < CHALLENGES.length; i++) {
    const dot = document.createElement('div');
    dot.className = 'progress-dot' +
      (i < currentLevel  ? ' done'    : '') +
      (i === currentLevel ? ' current' : '');
    dot.setAttribute('aria-label', 'Branch ' + (i + 1) +
      (i < currentLevel ? ' done' : i === currentLevel ? ' current' : ''));
    dot.textContent = i < currentLevel ? '✓' : String(i + 1);
    progressDots.appendChild(dot);
  }
  levelLabel.textContent = `Branch ${currentLevel + 1} of ${CHALLENGES.length}`;
}

/* ── Challenge rendering ────────────────────────────────────────── */
function renderChallenge() {
  partialsLocked = false;
  const ch       = CHALLENGES[currentLevel];
  const partials = getPartials(ch.multiplicand, ch.multiplier);

  renderProgress();
  showFeedback(ch.intro, 'hint');

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

  partials.forEach((p, i) => {
    html += `
      <div class="ladder-row" id="row-${i}">
        <span class="partial-label">${p.placeValue}</span>
        <span class="op-sign">×</span>
        <span class="mult-val">${ch.multiplier}</span>
        <span class="eq-sign">=</span>
        <input
          type="number"
          inputmode="numeric"
          min="0"
          class="ladder-input"
          placeholder="?"
          autocomplete="off"
          id="partial-${i}"
          data-answer="${p.product}"
          aria-label="${p.placeValue} times ${ch.multiplier}">
        <span class="row-status" id="status-${i}"></span>
      </div>
    `;
  });

  html += `
    </div>
    <div class="ladder-sum-line"></div>
    <div class="total-row" id="total-row">
      <span class="total-label">Total</span>
      <span class="eq-sign">=</span>
      <input
        type="number"
        inputmode="numeric"
        min="0"
        class="ladder-input total-input"
        placeholder="?"
        autocomplete="off"
        id="total-input"
        data-answer="${ch.multiplicand * ch.multiplier}"
        disabled
        aria-label="Total">
      <span class="row-status" id="total-status"></span>
    </div>
    <div class="check-row">
      <button class="btn-check" id="check-btn" type="button">Check ✓</button>
    </div>
  `;

  challengeContent.innerHTML = html;

  // Bind check button
  document.getElementById('check-btn').addEventListener('click', handleCheck);

  // Enter key on any input triggers check
  challengeContent.querySelectorAll('.ladder-input').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') handleCheck(); });
    // Prevent scroll-to-change on number inputs
    inp.addEventListener('wheel', e => e.preventDefault(), { passive: false });
  });

  // Focus first partial input
  document.getElementById('partial-0')?.focus();
}

/* ── Check logic ────────────────────────────────────────────────── */
function handleCheck() {
  const totalInput = document.getElementById('total-input');

  if (!totalInput.disabled) {
    checkTotal(totalInput);
  } else {
    checkPartials();
  }
}

function checkPartials() {
  const ch       = CHALLENGES[currentLevel];
  const partials = getPartials(ch.multiplicand, ch.multiplier);
  let allCorrect = true;
  let anyFilled  = false;

  partials.forEach((p, i) => {
    const inp      = document.getElementById(`partial-${i}`);
    const statusEl = document.getElementById(`status-${i}`);
    if (inp.value === '') { allCorrect = false; return; }
    anyFilled = true;
    const val = parseInt(inp.value, 10);

    if (val === p.product) {
      inp.classList.add('correct');
      inp.classList.remove('wrong');
      statusEl.textContent = '✓';
      statusEl.style.color = 'var(--correct)';
      inp.disabled = true;
    } else {
      inp.classList.add('wrong');
      inp.classList.remove('correct');
      statusEl.textContent = '✗';
      statusEl.style.color = 'var(--wrong)';
      shakeEl(inp);
      allCorrect = false;
    }
  });

  if (!anyFilled) {
    showFeedback('Fill in the rows first!', 'error');
    return;
  }

  if (allCorrect) {
    partialsLocked = true;
    showFeedback('All rows correct! Now add them up and enter the total. ➕', 'partial');
    const totalInput = document.getElementById('total-input');
    totalInput.disabled = false;
    totalInput.focus();
    document.getElementById('check-btn').textContent = 'Check Total ✓';
  } else {
    showFeedback('Some rows are wrong — try those again! 🔍', 'error');
  }
}

function checkTotal(totalInput) {
  if (totalInput.value === '') {
    showFeedback('Enter the total first!', 'error');
    return;
  }
  const answer = parseInt(totalInput.dataset.answer, 10);
  const val    = parseInt(totalInput.value, 10);

  if (val === answer) {
    totalInput.classList.add('correct');
    totalInput.classList.remove('wrong');
    document.getElementById('total-status').textContent = '✓';
    document.getElementById('total-status').style.color = 'var(--correct)';
    document.getElementById('check-btn').disabled = true;

    showFeedback('🎉 Brilliant! The bird hops up!', 'success');
    spawnStars(totalInput);

    // Flash card green briefly
    challengeCard.style.transition = 'box-shadow 0.3s';
    challengeCard.style.boxShadow  = '0 0 0 4px var(--correct), var(--card-shadow)';
    setTimeout(() => { challengeCard.style.boxShadow = 'var(--card-shadow)'; }, 700);

    setTimeout(advanceLevel, 1300);
  } else {
    totalInput.classList.add('wrong');
    totalInput.classList.remove('correct');
    document.getElementById('total-status').textContent = '✗';
    document.getElementById('total-status').style.color = 'var(--wrong)';
    showFeedback('Not quite — try adding all the rows again!', 'error');
    shakeEl(totalInput);
  }
}

/* ── Level advancement ──────────────────────────────────────────── */
function advanceLevel() {
  revealBranchStar(birdPos); // star on the branch just left
  birdPos++;
  placeBird(birdPos, true);
  currentLevel++;

  if (currentLevel >= CHALLENGES.length) {
    setTimeout(showWin, 900);
  } else {
    setTimeout(renderChallenge, 750);
  }
}

/* ── Game lifecycle ─────────────────────────────────────────────── */
function startGame() {
  startScreen.classList.remove('active');
  gameScreen.classList.add('active');
  currentLevel = 0;
  birdPos      = 0;
  // Clear any previous branch stars
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

/* ── Confetti ───────────────────────────────────────────────────── */
function launchConfetti() {
  confettiContainer.innerHTML = '';
  const colors = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c77dff','#ff9800','#00bcd4'];
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left             = Math.random() * 100 + '%';
    piece.style.top              = '-12px';
    piece.style.width            = (Math.random() * 8 + 6) + 'px';
    piece.style.height           = (Math.random() * 8 + 6) + 'px';
    piece.style.background       = colors[i % colors.length];
    piece.style.borderRadius     = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.animationDelay   = (Math.random() * 2.5) + 's';
    piece.style.animationDuration = (Math.random() * 2.5 + 2) + 's';
    confettiContainer.appendChild(piece);
  }
}
