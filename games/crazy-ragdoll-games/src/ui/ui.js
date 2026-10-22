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

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const CHEERS = ['BRILLIANT!', 'NAILED IT!', 'SUPERB!', 'WOOHOO!', 'SMASHING!'];
const GROANS = ['SPLAT!', 'OUCH!', 'WHOOPS!', 'BONK!'];

/** Title letters, each tipped at its own angle like stickers slapped on. */
function stickerWord(word, cls) {
  return `<span class="word ${cls}">${[...word].map((c, i) => `<i style="--r:${((i * 37) % 11) - 5}deg">${c}</i>`).join('')}</span>`;
}

export const SUIT_UNLOCKS = { red: 0, yellow: 6, green: 15, blue: 27, purple: 40, pink: 55 };

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
          <h1>${stickerWord('CRAZY', 'w1')}${stickerWord('RAGDOLL', 'w2')}${stickerWord('GAMES', 'w3')}</h1>
          <p class="tagline">Fifteen ways to fling a ragdoll. Zero ways to be careful.</p>
        </div>
        <div class="title-actions">
          <button class="btn go huge" data-act="play">${icon('play')}<span>${level > 1 ? `Level ${level}` : 'Play'}</span></button>
          <div class="dock">
            ${canReplay ? `<button class="dock-btn" data-act="replay"><span class="disc blue">${icon('grid')}</span><small>Replay</small></button>` : ''}
            <button class="dock-btn" data-act="wardrobe"><span class="disc pink">${icon('shirt')}</span><small>Colours</small></button>
            <button class="dock-btn" data-act="settings"><span class="disc sun">${icon('gear')}</span><small>Settings</small></button>
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
        return `<section class="replay-group"><h3><span>${esc(dept.name)}</span></h3><div class="tile-grid">${tiles}</div></section>`;
      })
      .join('');
    const el = h(`
      <div class="screen menu-screen">
        <header class="menu-head">
          <button class="disc-btn" data-act="back" aria-label="Back">${icon('back')}</button>
          <h2>Play it again</h2>
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
          <button class="disc-btn pause-btn" data-act="pause" aria-label="Pause">${icon('pause')}</button>
          <div class="hud-title">${esc(title)}</div>
          <div class="hud-stats">
            ${stats.map((s) => `<div class="stat" data-stat="${s.id}"><span class="stat-icon">${icon(s.icon)}</span><b>${esc(s.value)}</b></div>`).join('')}
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
    return this.modal(
      `<div class="ribbon sky">Time out</div>
      <div class="dock big">
        <button class="dock-btn" data-act="resume"><span class="disc grass">${icon('play')}</span><small>Resume</small></button>
        <button class="dock-btn" data-act="restart"><span class="disc sun">${icon('retry')}</span><small>Restart</small></button>
        <button class="dock-btn" data-act="home"><span class="disc tomato">${icon('home')}</span><small>Menu</small></button>
      </div>
      ${this.toggles(save)}`,
      { resume: onResume, restart: onRestart, home: onHome, toggle: (k, b) => this.flip(save, k, b) },
    );
  }

  toggles(save) {
    return `<div class="toggles">
      <button class="toggle ${save.data.sfx ? 'on' : ''}" data-act="toggle" data-arg="sfx">${icon('sound')}<span>Sound</span><i class="knob"></i></button>
      <button class="toggle ${save.data.music ? 'on' : ''}" data-act="toggle" data-arg="music">${icon('music')}<span>Music</span><i class="knob"></i></button>
    </div>`;
  }

  flip(save, key, btn) {
    save.set(key, !save.data[key]);
    btn.classList.toggle('on', save.data[key]);
    this.onSettingsChanged?.();
  }

  settings({ save, onClose }) {
    this.modal(
      `<div class="ribbon sun">Settings</div>
      ${this.toggles(save)}
      <p class="small">Crazy Ragdoll Games v1.0 · no ragdolls were careful in the making of this game.</p>
      <button class="btn go" data-act="close">Done</button>`,
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
          <span class="swatch" style="--c:${s.body};--t:${s.trim}">${icon('dummy')}</span>
          <span class="suit-name">${esc(s.label)}</span>
          ${open ? '' : `<span class="suit-need">${icon('star')} ${need}</span>`}
        </button>`;
      })
      .join('');
    this.modal(
      `<div class="ribbon pink">Colours</div>
      <p class="small">Stars unlock new colours. You have <b class="star-count">${icon('star')} ${totalStars}</b></p>
      <div class="suits">${items}</div>
      <button class="btn go" data-act="close">Done</button>`,
      {
        pick: (id) => {
          onPick(id);
          this.wardrobe({ save, totalStars, onPick, onClose });
        },
        nope: () => this.toast('Collect more stars to unlock this colour'),
        close: onClose,
      },
    );
  }

  results({ passed, stars: n, score, total, isBest, title, subtitle, reason, stats = [], unlock, upNext, canRevive, reviveIsPaid, canSkip, canContinue, ads, onRevive, onRetry, onNext, onSkip, onHome }) {
    const adTag = '<span class="ad-tag">AD</span>';
    const el = this.modal(
      `<div class="result ${passed ? 'win' : 'lose'}">
        <div class="ribbon ${passed ? 'grass' : 'tomato'}">${passed ? pick(CHEERS) : pick(GROANS)}</div>
        <p class="level-tag"><b>${esc(title)}</b> · ${esc(subtitle)}</p>
        ${passed ? `<div class="big-stars">${stars(0, 3, 'pop')}</div>` : `<div class="splat">${icon('skull')}</div><p class="reason">${esc(reason ?? 'Have another go!')}</p>`}
        <div class="score-tag ${!passed && !score ? 'hidden' : ''}"><small>Score</small><span class="score-val" data-score="${Math.round(score)}">0</span>${isBest ? '<em class="new-best">Best ever!</em>' : ''}</div>
        ${stats.length ? `<div class="chips">${stats.map(([k, v]) => `<span class="chip"><small>${esc(k)}</small><b>${esc(v)}</b></span>`).join('')}</div>` : ''}
        ${passed ? `<p class="total">Total score <b>${Math.round(total).toLocaleString()}</b></p>` : ''}
        ${passed && unlock ? `<div class="unlock"><span class="swatch mini" style="--c:${unlock.color}">${icon('dummy')}</span><span><b>${unlock.need - unlock.have}</b> more ${icon('star')} unlocks <b>${esc(unlock.label)}</b></span><i><em style="width:${Math.round((100 * unlock.have) / unlock.need)}%"></em></i></div>` : ''}
        ${passed && upNext ? `<p class="up-next">Next up: <b>${esc(upNext)}</b></p>` : ''}
        <div class="actions">
          ${passed ? `<button class="btn go big next-btn" data-act="next"><span>Next</span>${icon('next')}</button>` : ''}
          ${canRevive ? `<button class="btn sun big revive-btn" data-act="revive">${icon('heart')}<span>Keep going</span>${reviveIsPaid ? adTag : ''}<i class="countdown">5</i></button>` : ''}
          ${passed ? '' : `<button class="btn ${canRevive ? 'sky' : 'go big'}" data-act="retry">${icon('retry')}<span>Try again</span></button>`}
          <div class="dock">
            <button class="dock-btn" data-act="home" aria-label="Main menu"><span class="disc tomato">${icon('home')}</span></button>
            ${passed ? `<button class="dock-btn" data-act="retry" aria-label="Replay"><span class="disc sky">${icon('retry')}</span></button>` : ''}
            ${canSkip ? `<button class="btn ghost" data-act="skip"><span>Skip level</span>${ads ? adTag : icon('next')}</button>` : ''}
            ${canContinue ? `<button class="btn ghost" data-act="next"><span>Carry on</span>${icon('next')}</button>` : ''}
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

  /** First time a game comes up: what it is and how to play it, in three numbered steps. */
  intro({ name, icon: ic, goal, how, onGo }) {
    this.modal(
      `<div class="result intro">
        <div class="ribbon sky">New game!</div>
        <div class="badge">${icon(ic)}</div>
        <h2>${esc(name)}</h2>
        <p class="goal">${esc(goal)}</p>
        <ol class="steps">${how.map(([i, text]) => `<li><span class="step-icon">${icon(i)}</span><span>${esc(text)}</span></li>`).join('')}</ol>
        <button class="btn go big" data-act="go">${icon('play')}<span>Let's go!</span></button>
      </div>`,
      { go: onGo },
    );
    this.audio.ding?.(3);
  }

  /**
   * Between levels a boss turns up. The card shows a little picture of the
   * fight and what to do, then Fight (rewarded ad) or skip it for free.
   */
  bossOffer({ name, mk, kind, preview, how, ads, onFight, onSkip }) {
    this.modal(
      `<div class="result boss-offer">
        <div class="ribbon tomato">Boss battle!</div>
        <div class="boss-preview">${preview}</div>
        <h2>${esc(name)}</h2>
        <p class="level-tag"><b>${esc(kind)}</b> · Mk ${mk}</p>
        <p class="goal">${esc(how)}</p>
        <div class="actions">
          <button class="btn tomato big boss-btn" data-act="fight">${icon('bolt')}<span>Fight!</span>${ads ? '<span class="ad-tag">AD</span>' : ''}</button>
          <button class="btn ghost" data-act="skip"><span>Not now</span>${icon('next')}</button>
        </div>
      </div>`,
      { fight: onFight, skip: onSkip },
    );
    this.audio.boom?.();
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
