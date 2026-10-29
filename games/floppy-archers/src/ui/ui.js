import { icon } from './icons.js';
import { SUITS } from '../dummy/dummyView.js';

const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** What each colour costs in coins. */
export const SUIT_PRICES = { red: 0, yellow: 60, green: 120, blue: 200, purple: 300, pink: 450 };

/** DOM layer: menus, HUD and modals drawn over the 3D canvas. */
export class UI {
  constructor(root, audio) {
    this.root = root;
    this.audio = audio;
    this.screens = root.querySelector('#screens');
    this.hudEl = root.querySelector('#hud');
    this.modalEl = root.querySelector('#modal');
    this.loadingEl = root.querySelector('#loading');
    this.hudApi = null;
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

  title({ wave, kills, coins, onPlay, onDuel, onSettings, onWardrobe }) {
    this.clearScreens();
    const el = h(`
      <div class="screen title-screen">
        <div class="logo">
          <h1><span class="l1">FLOPPY</span><span class="l2">ARCHERS</span></h1>
          <p class="tagline">Pull back. Let go. Watch them flop.</p>
        </div>
        <div class="title-stats">
          <span class="chip">${icon('skull')}<b>${kills}</b></span>
          <span class="chip coin">${icon('coin')}<b>${coins}</b></span>
        </div>
        <div class="title-actions">
          <button class="btn primary big" data-act="play">${icon('play')}<span>${wave > 1 ? `Wave ${wave}` : 'Play'}</span></button>
          <button class="btn" data-act="duel">${icon('dummy')}<span>2 Players</span></button>
          <div class="row">
            <button class="btn ghost" data-act="wardrobe">${icon('shirt')}<span>Colours</span></button>
            <button class="btn ghost" data-act="settings">${icon('gear')}<span>Settings</span></button>
          </div>
        </div>
      </div>`);
    this.screens.appendChild(this.bind(el, { play: onPlay, duel: onDuel, settings: onSettings, wardrobe: onWardrobe }));
  }

  /** Health and stamina for one archer, with the jump button under them. */
  vitalsPanel(i, label) {
    return `<div class="vitals v${i}">
      ${label ? `<span class="vitals-name">${esc(label)}</span>` : ''}
      <div class="vbar hp"><i></i><b></b></div>
      <div class="vbar st"><i></i><b></b></div>
      <button class="btn jump-btn" data-jump="${i}"><span>JUMP</span><small>5 stamina</small></button>
    </div>`;
  }

  /** The in-fight HUD. Returns a small API the fight updates every frame. */
  archeryHud({ mode, wave, kills = 0, total = 0, beaten = 0, round = 1, wins = [0, 0], onJump }) {
    this.hudEl.innerHTML = '';
    const duel = mode === 'duel';
    const dots = (n) => [0, 1].map((k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('');
    const el = h(`
      <div class="hud">
        <div class="hud-top">
          <button class="icon-btn pause-btn" data-act="pause" aria-label="Pause">${icon('pause')}</button>
          ${duel ? `<div class="stat wins"><span class="dots">${dots(wins[0])}</span></div>` : `<div class="stat" data-stat="kills">${icon('skull')}<b>${kills}</b></div>`}
          <div class="hud-title">${duel ? `Round ${round}` : `Wave ${wave}`}</div>
          ${duel ? `<div class="stat wins"><span class="dots">${dots(wins[1])}</span></div>` : `<div class="stat score" data-stat="score"><span>SCORE</span><b>${beaten}/${total}</b></div>`}
        </div>
        <div class="hud-hint hidden"></div>
        <div class="hud-bottom">
          ${this.vitalsPanel(0, duel ? 'Player 1' : '')}
          ${duel ? this.vitalsPanel(1, 'Player 2') : ''}
        </div>
      </div>`);
    this.hudEl.appendChild(this.bind(el, { pause: () => this.onPause?.() }));
    // Jump answers the moment it's touched, not on the click that follows.
    el.querySelectorAll('.jump-btn').forEach((b) =>
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.audio.unlock();
        onJump(Number(b.dataset.jump));
      }),
    );
    const hint = el.querySelector('.hud-hint');
    const panels = [...el.querySelectorAll('.vitals')].map((p) => ({
      hp: p.querySelector('.hp i'),
      hpText: p.querySelector('.hp b'),
      st: p.querySelector('.st i'),
      stText: p.querySelector('.st b'),
      jump: p.querySelector('.jump-btn'),
    }));
    this.hintEl = hint;
    this.hudApi = {
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
      vitals(list) {
        list.forEach((v, i) => {
          const p = panels[i];
          if (!v || !p) return;
          p.hp.style.width = `${(100 * v.hp) / v.maxHp}%`;
          p.hpText.textContent = Math.ceil(v.hp);
          p.st.style.width = `${(100 * v.stamina) / v.maxStamina}%`;
          p.stText.textContent = Math.floor(v.stamina);
          p.jump.classList.toggle('low', v.stamina < 5);
        });
      },
    };
    return this.hudApi;
  }

  hint(text) {
    if (!this.hintEl) return;
    this.hintEl.textContent = text;
    this.hintEl.classList.remove('hidden');
  }

  clearHint() {
    this.hintEl?.classList.add('hidden');
  }

  clearHud() {
    this.hudEl.innerHTML = '';
    this.hudApi = null;
    this.hintEl = null;
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
      `<h2>Paused</h2>
      <div class="col">
        <button class="btn primary" data-act="resume">${icon('play')}<span>Resume</span></button>
        <button class="btn" data-act="restart">${icon('retry')}<span>Restart</span></button>
        <button class="btn" data-act="home">${icon('home')}<span>Main menu</span></button>
      </div>
      ${this.toggles(save)}`,
      { resume: onResume, restart: onRestart, home: onHome, toggle: (k, b) => this.flip(save, k, b) },
    );
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
      <p class="small">Floppy Archers v1.0</p>
      <button class="btn primary" data-act="close">Done</button>`,
      { close: onClose, toggle: (k, b) => this.flip(save, k, b) },
    );
  }

  /** Colours for the archer, bought with coins. */
  wardrobe({ save, onPick, onClose }) {
    const d = save.data;
    const items = Object.entries(SUITS)
      .map(([id, s]) => {
        const owned = d.owned.includes(id);
        const sel = d.suit === id;
        return `<button class="suit ${owned ? '' : 'locked'} ${sel ? 'sel' : ''}" data-act="pick" data-arg="${id}">
          <span class="swatch" style="--c:${s.body};--t:${s.trim}"></span>
          <span class="suit-name">${esc(s.label)}</span>
          ${owned ? '' : `<span class="suit-need">${icon('coin')} ${SUIT_PRICES[id]}</span>`}
        </button>`;
      })
      .join('');
    this.modal(
      `<h2>Colours</h2>
      <p class="small">Spend coins on a new colour. You have ${icon('coin')} ${d.coins}.</p>
      <div class="suits">${items}</div>
      <button class="btn primary" data-act="close">Done</button>`,
      {
        pick: (id) => {
          if (!onPick(id)) this.toast('Not enough coins yet — win more waves!');
          else this.wardrobe({ save, onPick, onClose });
        },
        close: onClose,
      },
    );
  }

  /** End of a wave, won or lost. */
  waveResult({ passed, wave, kills, heads, coins, beaten, total, ads, canRevive, canDouble, onRevive, onDouble, onRetry, onNext, onHome }) {
    const adTag = ads ? '<span class="ad-tag">AD</span>' : '';
    const el = this.modal(
      `<div class="result ${passed ? 'pass' : 'fail'}">
        <div class="stamp">${passed ? 'Wave clear' : 'Knocked out'}</div>
        <h2>Wave ${wave}</h2>
        <p class="result-sub">${passed ? `All ${total} archers down` : `${beaten} of ${total} archers down`}</p>
        <ul class="stats">
          <li><span>Archers down</span><b>${kills}</b></li>
          <li><span>Headshots</span><b>${heads}</b></li>
          <li><span>Coins</span><b class="coins-won">${icon('coin')} ${coins}</b></li>
        </ul>
        <div class="col">
          ${passed ? `<button class="btn primary big" data-act="next"><span>Next wave</span>${icon('next')}</button>` : ''}
          ${canDouble ? `<button class="btn double-btn" data-act="double">${icon('coin')}<span>Double coins</span>${adTag}</button>` : ''}
          ${canRevive ? `<button class="btn primary big revive-btn" data-act="revive">${icon('heart')}<span>Revive</span>${adTag}<i class="countdown">5</i></button>` : ''}
          ${passed ? '' : `<button class="btn ${canRevive ? '' : 'primary big'}" data-act="retry">${icon('retry')}<span>Try again</span></button>`}
          <div class="row"><button class="btn small" data-act="home" aria-label="Main menu">${icon('home')}</button></div>
        </div>
      </div>`,
      {
        revive: onRevive,
        retry: onRetry,
        next: onNext,
        home: onHome,
        double: async (_, b) => {
          if (!(await onDouble())) return;
          b.remove();
          const won = el.querySelector('.coins-won');
          if (won) won.innerHTML = `${icon('coin')} ${coins * 2}`;
          this.audio.coin(4);
        },
      },
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
    if (passed) this.audio.win?.();
  }

  /** Pick one of three upgrades. */
  perks({ choices, have, onPick }) {
    const cards = choices
      .map(
        (p) => `<button class="perk" data-act="pick" data-arg="${p.id}">
          <span class="perk-icon">${icon(p.icon)}</span>
          <b>${esc(p.name)}</b>
          <span>${esc(p.text)}</span>
          <span class="perk-level">${Array.from({ length: p.max }, (_, i) => `<i class="${i < (have[p.id] ?? 0) ? 'on' : ''}"></i>`).join('')}</span>
        </button>`,
      )
      .join('');
    this.modal(
      `<div class="result perks-pick">
        <div class="stamp">Upgrade</div>
        <h2>Pick one</h2>
        <div class="perk-row">${cards}</div>
      </div>`,
      { pick: (id) => onPick(id) },
    );
    this.audio.ding?.(3);
  }

  duelResult({ winner, wins, over, onNext, onHome }) {
    this.modal(
      `<div class="result pass">
        <div class="stamp">${over ? 'Match over' : 'Round over'}</div>
        <h2>Player ${winner + 1} wins${over ? ' the match!' : ' the round!'}</h2>
        <p class="result-sub duel-score">${wins[0]} – ${wins[1]}</p>
        <div class="col">
          <button class="btn primary big" data-act="next">${icon(over ? 'retry' : 'next')}<span>${over ? 'Rematch' : 'Next round'}</span></button>
          <div class="row"><button class="btn small" data-act="home" aria-label="Main menu">${icon('home')}</button></div>
        </div>
      </div>`,
      { next: onNext, home: onHome },
    );
    this.audio.win?.();
  }

  /** First time: what to do and how. */
  intro({ name, icon: ic, goal, how, onGo }) {
    this.modal(
      `<div class="result intro">
        <div class="stamp">How to play</div>
        <div class="intro-face">${icon(ic)}</div>
        <h2>${esc(name)}</h2>
        <p class="result-sub">${esc(goal)}</p>
        <ul class="how">${how.map(([i, text]) => `<li>${icon(i)}<span>${esc(text)}</span></li>`).join('')}</ul>
        <button class="btn primary big" data-act="go">${icon('play')}<span>Let's go!</span></button>
      </div>`,
      { go: onGo },
    );
    this.audio.ding?.(3);
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
