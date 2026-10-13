import { icon } from './icons.js';
import { SUITS } from '../dummy/dummyView.js';

const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function stars(n, max = 3, cls = '') {
  let out = '';
  for (let i = 0; i < max; i++) out += `<span class="star ${i < n ? 'on' : ''} ${cls}">${icon('star')}</span>`;
  return out;
}

export const SUIT_UNLOCKS = { classic: 0, orange: 6, blue: 15, mint: 27, red: 40, white: 55 };

/** DOM layer: menus, HUD and modals drawn over the 3D canvas. */
export class UI {
  constructor(root, audio) {
    this.root = root;
    this.audio = audio;
    this.screens = root.querySelector('#screens');
    this.hudEl = root.querySelector('#hud');
    this.modalEl = root.querySelector('#modal');
    this.loadingEl = root.querySelector('#loading');
    // Taps on UI must never reach the game canvas underneath.
    for (const el of [this.screens, this.hudEl, this.modalEl]) {
      el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button, .panel')) e.stopPropagation();
      });
    }
  }

  loading(progress, text) {
    this.loadingEl.classList.remove('gone');
    this.loadingEl.querySelector('.bar i').style.width = `${Math.round(progress * 100)}%`;
    if (text) this.loadingEl.querySelector('.load-text').textContent = text;
  }

  hideLoading() {
    this.loadingEl.classList.add('gone');
  }

  error(message) {
    this.loadingEl.classList.remove('gone');
    this.loadingEl.querySelector('.load-text').textContent = message;
    this.loadingEl.classList.add('error');
  }

  clearScreens() {
    this.screens.innerHTML = '';
  }

  bind(el, handlers) {
    el.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audio.unlock();
        this.audio.click();
        handlers[b.dataset.act]?.(b.dataset.arg, b);
      });
    });
    return el;
  }

  title({ level = 1, canReplay = false, onPlay, onReplay, onSettings, onWardrobe }) {
    this.clearScreens();
    const el = h(`
      <div class="screen title-screen">
        <div class="logo">
          <div class="logo-stripe"></div>
          <h1><span class="l1">FLOP</span><span class="l2">DUMMIES</span></h1>
          <p class="tagline">Professional crash testing. Unprofessional results.</p>
        </div>
        <div class="title-actions">
          <button class="btn primary big" data-act="play">${icon('play')}<span>Play</span></button>
          ${level > 1 ? `<span class="resume-note">Continue from level ${level}</span>` : ''}
          <div class="row">
            ${canReplay ? `<button class="btn ghost" data-act="replay">${icon('grid')}<span>Replay</span></button>` : ''}
            <button class="btn ghost" data-act="wardrobe">${icon('shirt')}<span>Wardrobe</span></button>
            <button class="btn ghost" data-act="settings">${icon('gear')}<span>Settings</span></button>
          </div>
        </div>
      </div>`);
    this.screens.appendChild(this.bind(el, { play: onPlay, replay: onReplay, settings: onSettings, wardrobe: onWardrobe }));
  }

  /** Every level the player has passed, grouped by department, ready to play again. */
  replay({ groups, onPick, onBack }) {
    this.clearScreens();
    const sections = groups
      .map(({ dept, entries }) => {
        const tiles = entries
          .map(
            ({ n, level, rec }) => `
          <button class="tile" data-act="pick" data-arg="${n}">
            <span class="tile-num">${n}</span>
            <span class="tile-name">${esc(level.name)}</span>
            <span class="tile-stars">${stars(rec.stars)}</span>
          </button>`,
          )
          .join('');
        return `<section class="replay-group"><h3>${esc(dept.name)}</h3><div class="tile-grid">${tiles}</div></section>`;
      })
      .join('');
    const el = h(`
      <div class="screen menu-screen">
        <header class="menu-head">
          <button class="icon-btn" data-act="back" aria-label="Back">${icon('back')}</button>
          <h2>Replay</h2>
        </header>
        ${sections}
      </div>`);
    this.screens.appendChild(this.bind(el, { pick: (n) => onPick(Number(n)), back: onBack }));
  }

  /** In-level heads-up display. Returns a small API the level drives. */
  hud({ title, stats = [], onPause }) {
    this.hudEl.innerHTML = '';
    const el = h(`
      <div class="hud">
        <div class="hud-top">
          <button class="icon-btn pause-btn" data-act="pause" aria-label="Pause">${icon('pause')}</button>
          <div class="hud-title">${esc(title)}</div>
          <div class="hud-stats">
            ${stats.map((s) => `<div class="stat" data-stat="${s.id}">${icon(s.icon)}<b>${esc(s.value)}</b></div>`).join('')}
          </div>
        </div>
        <div class="hud-meter hidden"><span class="meter-label"></span><div class="meter"><i></i></div></div>
        <div class="hud-hint hidden"></div>
        <div class="hud-actions"></div>
      </div>`);
    this.hudEl.appendChild(this.bind(el, { pause: () => this.onPause?.() }));
    const hint = el.querySelector('.hud-hint');
    const meter = el.querySelector('.hud-meter');
    const actions = el.querySelector('.hud-actions');
    return {
      set(id, value) {
        const b = el.querySelector(`[data-stat="${id}"] b`);
        if (b) b.textContent = value;
      },
      bump(id) {
        const s = el.querySelector(`[data-stat="${id}"]`);
        if (!s) return;
        s.classList.remove('bump');
        void s.offsetWidth;
        s.classList.add('bump');
      },
      hint(text) {
        hint.textContent = text;
        hint.classList.remove('hidden');
      },
      clearHint() {
        hint.classList.add('hidden');
      },
      meter(label, value, hot = false) {
        meter.classList.remove('hidden');
        meter.querySelector('.meter-label').textContent = label;
        meter.querySelector('i').style.width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
        meter.classList.toggle('hot', hot);
      },
      hideMeter() {
        meter.classList.add('hidden');
      },
      button(label, onPress, cls = '') {
        const b = h(`<button class="btn action ${cls}">${esc(label)}</button>`);
        b.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          onPress();
        });
        actions.appendChild(b);
        return b;
      },
      clearButtons() {
        actions.innerHTML = '';
      },
      el,
    };
  }

  clearHud() {
    this.hudEl.innerHTML = '';
  }

  modal(html, handlers) {
    this.closeModal();
    const el = h(`<div class="modal-back"><div class="panel">${html}</div></div>`);
    this.modalEl.appendChild(this.bind(el, handlers));
    requestAnimationFrame(() => el.classList.add('in'));
    return el;
  }

  closeModal() {
    this.modalEl.innerHTML = '';
  }

  get modalOpen() {
    return this.modalEl.children.length > 0;
  }

  pause({ save, onResume, onRestart, onHome }) {
    const el = this.modal(
      `<h2>Paused</h2>
      <div class="col">
        <button class="btn primary" data-act="resume">${icon('play')}<span>Resume</span></button>
        <button class="btn" data-act="restart">${icon('retry')}<span>Restart</span></button>
        <button class="btn" data-act="home">${icon('home')}<span>Main menu</span></button>
      </div>
      ${this.toggles(save)}`,
      { resume: onResume, restart: onRestart, home: onHome, toggle: (k, b) => this.flip(save, k, b) },
    );
    return el;
  }

  toggles(save) {
    return `<div class="toggles">
      <button class="toggle ${save.data.sfx ? 'on' : ''}" data-act="toggle" data-arg="sfx">${icon('sound')}<span>Sound</span></button>
      <button class="toggle ${save.data.music ? 'on' : ''}" data-act="toggle" data-arg="music">${icon('music')}<span>Music</span></button>
    </div>`;
  }

  flip(save, key, btn) {
    save.set(key, !save.data[key]);
    btn.classList.toggle('on', save.data[key]);
    this.onSettingsChanged?.();
  }

  settings({ save, onClose }) {
    this.modal(
      `<h2>Settings</h2>
      ${this.toggles(save)}
      <p class="small">Flop Dummies v1.0 — every dummy was harmed in the making of this game.</p>
      <button class="btn primary" data-act="close">Done</button>`,
      { close: onClose, toggle: (k, b) => this.flip(save, k, b) },
    );
  }

  wardrobe({ save, totalStars, onPick, onClose }) {
    const items = Object.entries(SUITS)
      .map(([id, s]) => {
        const need = SUIT_UNLOCKS[id];
        const open = totalStars >= need;
        const sel = save.data.suit === id;
        return `<button class="suit ${open ? '' : 'locked'} ${sel ? 'sel' : ''}" data-act="${open ? 'pick' : 'nope'}" data-arg="${id}">
          <span class="swatch" style="--c:${s.body};--t:${s.trim}"></span>
          <span class="suit-name">${esc(s.label)}</span>
          ${open ? '' : `<span class="suit-need">${icon('star')} ${need}</span>`}
        </button>`;
      })
      .join('');
    this.modal(
      `<h2>Wardrobe</h2>
      <p class="small">Earn stars to unlock new test suits. You have ${icon('star')} ${totalStars}.</p>
      <div class="suits">${items}</div>
      <button class="btn primary" data-act="close">Done</button>`,
      {
        pick: (id) => {
          onPick(id);
          this.wardrobe({ save, totalStars, onPick, onClose });
        },
        nope: () => this.toast('Collect more stars to unlock this suit'),
        close: onClose,
      },
    );
  }

  results({ passed, stars: n, score, total, isBest, title, subtitle, reason, stats = [], canRevive, reviveIsPaid, canSkip, ads, onRevive, onRetry, onNext, onSkip, onHome }) {
    const adTag = '<span class="ad-tag">AD</span>';
    const el = this.modal(
      `<div class="result ${passed ? 'pass' : 'fail'}">
        <div class="stamp">${passed ? 'Test passed' : 'Test failed'}</div>
        <h2>${esc(title)}</h2>
        <p class="result-sub">${esc(subtitle)}</p>
        ${passed ? `<div class="big-stars">${stars(0, 3, 'pop')}</div>` : `<p class="reason">${esc(reason ?? 'Try again!')}</p>`}
        <div class="score-line ${!passed && !score ? 'hidden' : ''}"><span class="score-val" data-score="${Math.round(score)}">0</span>${isBest ? '<span class="new-best">New best!</span>' : ''}</div>
        ${passed ? `<p class="total">Total score <b>${Math.round(total).toLocaleString()}</b></p>` : ''}
        ${stats.length ? `<ul class="stats">${stats.map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul>` : ''}
        <div class="col">
          ${passed ? `<button class="btn primary big next-btn" data-act="next"><span>Next level</span>${icon('next')}</button>` : ''}
          ${canRevive ? `<button class="btn primary big revive-btn" data-act="revive">${icon('play')}<span>Revive</span>${reviveIsPaid ? adTag : ''}<i class="countdown">5</i></button>` : ''}
          ${passed ? '' : `<button class="btn ${canRevive ? '' : 'primary big'}" data-act="retry">${icon('retry')}<span>Try again</span></button>`}
          <div class="row">
            <button class="btn small" data-act="home" aria-label="Main menu">${icon('home')}</button>
            ${passed ? `<button class="btn small" data-act="retry">${icon('retry')}<span>Replay</span></button>` : ''}
            ${canSkip ? `<button class="btn small" data-act="skip"><span>Skip level</span>${ads ? adTag : icon('next')}</button>` : ''}
          </div>
        </div>
      </div>`,
      { revive: onRevive, retry: onRetry, next: onNext, skip: onSkip, home: onHome },
    );
    // Revive is a limited-time offer: five seconds, then it's gone.
    const revive = el.querySelector('.revive-btn');
    if (revive) {
      let left = 5;
      const count = revive.querySelector('.countdown');
      const timer = setInterval(() => {
        left--;
        if (!revive.isConnected || this.modalEl.classList.contains('ad-hold')) return left <= 0 && clearInterval(timer);
        if (left > 0) count.textContent = left;
        else {
          clearInterval(timer);
          revive.classList.add('gone');
          setTimeout(() => revive.remove(), 300);
        }
      }, 1000);
    }
    // Count the score up, then drop the stars in one by one.
    const val = el.querySelector('.score-val');
    const target = Number(val.dataset.score);
    const start = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - start) / 900);
      val.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString();
      if (k < 1 && el.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    if (passed) {
      el.querySelectorAll('.big-stars .star').forEach((s, i) => {
        if (i >= n) return;
        setTimeout(() => {
          s.classList.add('on');
          this.audio.star(i);
        }, 450 + i * 330);
      });
    }
  }

  toast(text, ms = 1800) {
    const t = h(`<div class="toast">${esc(text)}</div>`);
    this.root.appendChild(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  }

  banner(text, sub = '') {
    const b = h(`<div class="banner"><b>${esc(text)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`);
    this.hudEl.appendChild(b);
    setTimeout(() => b.classList.add('out'), 1500);
    setTimeout(() => b.remove(), 2000);
  }
}
