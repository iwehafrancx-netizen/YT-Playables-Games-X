import { icon } from './icons.js';
import { ARROWS, ARROW_ORDER, STATS, SUITS, SHOP_SUITS } from '../game/catalog.js';

const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

/** A small arrow picture in the arrow's colours. */
function arrowIcon(id) {
  const a = ARROWS[id];
  return `<svg viewBox="0 0 48 24" aria-hidden="true"><path d="M4 12h34" stroke="${a.color}" stroke-width="4" stroke-linecap="round"/><path d="M46 12l-10-6v12z" fill="${a.head}" stroke="#1b1d24" stroke-width="1.5"/><path d="M4 12 1 6h7l3 6-3 6H1z" fill="${id === 'basic' ? '#f4f1e8' : a.color}" stroke="#1b1d24" stroke-width="1.2"/></svg>`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** DOM layer: menus, HUD and cards drawn over the game canvas. */
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

  title({ level, boss, skulls, onPlay, onDuel, onShop, onSettings }) {
    this.clearScreens();
    const el = h(`
      <div class="screen title-screen">
        <div class="logo">
          <h1><span class="l1">FLOPPY</span><span class="l2">ARCHERS</span></h1>
          <p class="tagline">Pull back. Let go. Watch them flop.</p>
        </div>
        <div class="title-actions">
          <button class="btn primary big" data-act="play">${icon('play')}<span>${level > 1 ? `Level ${level}` : 'Play'}</span>${boss ? '<span class="boss-tag">BOSS</span>' : ''}</button>
          <button class="btn shop-btn" data-act="shop">${icon('skull')}<span>Shop</span><b class="skull-count">${skulls}</b></button>
          <div class="row">
            <button class="btn ghost" data-act="duel">${icon('dummy')}<span>2 Players</span></button>
            <button class="btn ghost" data-act="settings">${icon('gear')}<span>Settings</span></button>
          </div>
        </div>
      </div>`);
    this.screens.appendChild(this.bind(el, { play: onPlay, duel: onDuel, shop: onShop, settings: onSettings }));
  }

  /** Health and stamina bars for one archer. */
  vitalsPanel(i, label) {
    return `<div class="vitals v${i}">
      ${label ? `<span class="vitals-name">${esc(label)}</span>` : ''}
      <div class="vbar hp"><i></i><b></b></div>
      <div class="vbar st"><i></i><b></b></div>
    </div>`;
  }

  jumpButton(i) {
    return `<button class="jump-btn j${i}" data-jump="${i}"><span>JUMP</span><small>5 stamina</small></button>`;
  }

  /** The in-fight HUD. Returns a small API the fight updates every frame. */
  archeryHud({ mode, title, skulls = 0, total = 0, beaten = 0, arrow, round = 1, wins = [0, 0], onJump }) {
    this.hudEl.innerHTML = '';
    const duel = mode === 'duel';
    const dots = (n) => [0, 1].map((k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('');
    const a = arrow && ARROWS[arrow];
    const el = h(`
      <div class="hud ${duel ? 'duel' : 'solo'}">
        <div class="hud-top">
          <button class="icon-btn pause-btn" data-act="pause" aria-label="Pause">${icon('pause')}</button>
          ${this.vitalsPanel(0, duel ? 'P1' : '')}
          <div class="hud-title">${duel ? `Round ${round}` : esc(title)}</div>
          ${
            duel
              ? `<div class="hud-stats"><div class="stat wins"><span class="dots">${dots(wins[0])}</span><b>–</b><span class="dots">${dots(wins[1])}</span></div></div>${this.vitalsPanel(1, 'P2')}`
              : `<div class="hud-stats">
                  <div class="stat" data-stat="kills">${icon('skull')}<b>${skulls}</b></div>
                  <div class="stat score" data-stat="score"><span>SCORE</span><b>${beaten}/${total}</b></div>
                </div>`
          }
        </div>
        <div class="hud-hint hidden"></div>
        <div class="hud-bottom">
          ${this.jumpButton(0)}
          ${a && arrow !== 'basic' ? `<div class="arrow-chip" style="--c:${a.color}">${arrowIcon(arrow)}<span>${esc(a.name)}</span></div>` : ''}
          ${duel ? this.jumpButton(1) : ''}
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
    const panels = [...el.querySelectorAll('.vitals')].map((p, i) => ({
      hp: p.querySelector('.hp i'),
      hpText: p.querySelector('.hp b'),
      st: p.querySelector('.st i'),
      stText: p.querySelector('.st b'),
      jump: el.querySelector(`.jump-btn.j${i}`),
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
          p.jump?.classList.toggle('low', v.stamina < 5);
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

  /** End of a level, won or lost. */
  levelResult({ passed, level, boss, bonus, kills, heads, skulls, beaten, total, ads, canRevive, canDouble, onRevive, onDouble, onRetry, onNext, onShop, onHome }) {
    const adTag = ads ? '<span class="ad-tag">AD</span>' : '';
    const name = bonus ? 'Golden Archer' : boss ? `Boss level ${level}` : `Level ${level}`;
    const el = this.modal(
      `<div class="result ${passed ? 'pass' : 'fail'}">
        <div class="stamp">${passed ? (bonus ? 'Boss beaten' : 'Level clear') : 'Knocked out'}</div>
        <h2>${esc(name)}</h2>
        <p class="result-sub">${passed ? `All ${total} ${total === 1 ? 'archer' : 'archers'} down` : `${beaten} of ${total} archers down`}</p>
        <ul class="stats">
          <li><span>Archers down</span><b>${kills}</b></li>
          <li><span>Headshots</span><b>${heads}</b></li>
          <li><span>Skulls</span><b class="skulls-won">${icon('skull')} ${skulls}</b></li>
        </ul>
        <div class="col">
          ${passed ? `<button class="btn primary big" data-act="next"><span>Next level</span>${icon('next')}</button>` : ''}
          ${canDouble ? `<button class="btn double-btn" data-act="double">${icon('skull')}<span>Double skulls</span>${adTag}</button>` : ''}
          ${canRevive ? `<button class="btn primary big revive-btn" data-act="revive">${icon('heart')}<span>Revive</span>${adTag}<i class="countdown">5</i></button>` : ''}
          ${passed ? '' : `<button class="btn ${canRevive ? '' : 'primary big'}" data-act="retry">${icon('retry')}<span>Try again</span></button>`}
          <div class="row">
            <button class="btn small" data-act="home" aria-label="Main menu">${icon('home')}</button>
            <button class="btn small shop-btn" data-act="shop">${icon('skull')}<span>Shop</span></button>
          </div>
        </div>
      </div>`,
      {
        revive: onRevive,
        retry: onRetry,
        next: onNext,
        shop: onShop,
        home: onHome,
        double: async (_, b) => {
          if (!(await onDouble())) return;
          b.remove();
          const won = el.querySelector('.skulls-won');
          if (won) won.innerHTML = `${icon('skull')} ${skulls * 2}`;
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
        if (!revive.isConnected) return clearInterval(timer);
        if (this.modalEl.classList.contains('ad-hold')) return;
        left--;
        if (left > 0) count.textContent = left;
        else {
          clearInterval(timer);
          revive.classList.add('gone');
          setTimeout(() => revive.remove(), 300);
        }
      }, 1000);
    }
  }

  /** The Golden Archer, offered between levels for a rewarded ad. */
  bossOffer({ reward, onFight, onSkip }) {
    this.modal(
      `<div class="result boss-offer">
        <div class="stamp gold">Bonus boss</div>
        <div class="offer-crown">${icon('crown')}</div>
        <h2>The Golden Archer</h2>
        <p class="result-sub">Knock him out for <b>${icon('skull')} ${reward}</b> skulls. Lose and you just carry on.</p>
        <div class="col">
          <button class="btn primary big" data-act="fight">${icon('play')}<span>Fight him</span><span class="ad-tag">AD</span></button>
          <button class="btn" data-act="skip"><span>No thanks</span>${icon('next')}</button>
        </div>
      </div>`,
      { fight: onFight, skip: onSkip },
    );
    this.audio.ding?.(5);
  }

  /** Skull shop: arrows (buy, upgrade, equip or try for an ad), body upgrades and colours. */
  shop({ save, ads, tab = 'arrows', handlers, onClose }) {
    const d = save.data;
    const dots = (n, max) => Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
    const cost = (p) => `<span class="cost ${d.skulls < p ? 'short' : ''}">${icon('skull')} ${p}</span>`;
    let body = '';
    if (tab === 'arrows') {
      body = ARROW_ORDER.map((id) => {
        const a = ARROWS[id];
        const lv = d.arrows[id] ?? 0;
        const next = a.price[lv];
        const equipped = d.equip === id && lv > 0;
        const actions = [];
        if (lv === 0) {
          actions.push(`<button class="btn small primary" data-act="arrow" data-arg="${id}">Buy ${cost(next)}</button>`);
          if (ads) actions.push(`<button class="btn small" data-act="try" data-arg="${id}">Try 1 level<span class="ad-tag">AD</span></button>`);
        } else {
          if (next !== undefined) actions.push(`<button class="btn small primary" data-act="arrow" data-arg="${id}">Upgrade ${cost(next)}</button>`);
          actions.push(equipped ? '<span class="equipped">Equipped</span>' : `<button class="btn small" data-act="equip" data-arg="${id}">Equip</button>`);
        }
        return `<div class="shop-item ${lv ? '' : 'locked'} ${equipped ? 'sel' : ''}" style="--c:${a.color}">
          <span class="shop-icon">${arrowIcon(id)}</span>
          <div class="shop-text"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span><span class="lv">${dots(lv, a.price.length)}</span></div>
          <div class="shop-acts">${actions.join('')}</div>
        </div>`;
      }).join('');
    } else if (tab === 'upgrades') {
      body = Object.entries(STATS).map(([id, st]) => {
        const lv = d.stats[id] ?? 0;
        const next = st.price[lv];
        return `<div class="shop-item">
          <span class="shop-icon stat">${icon(st.icon)}</span>
          <div class="shop-text"><b>${esc(st.name)}</b><span>${esc(st.desc)}</span><span class="lv">${dots(lv, st.price.length)}</span></div>
          <div class="shop-acts">${next !== undefined ? `<button class="btn small primary" data-act="stat" data-arg="${id}">Upgrade ${cost(next)}</button>` : '<span class="equipped">Maxed</span>'}</div>
        </div>`;
      }).join('');
    } else {
      body = `<div class="suits">${SHOP_SUITS.map((id) => {
        const s = SUITS[id];
        const owned = d.owned.includes(id);
        return `<button class="suit ${owned ? '' : 'locked'} ${d.suit === id ? 'sel' : ''}" data-act="suit" data-arg="${id}">
          <span class="swatch" style="--c:${s.body};--t:${s.trim}"></span>
          <span class="suit-name">${esc(s.label)}</span>
          ${owned ? '' : `<span class="suit-need">${icon('skull')} ${s.price}</span>`}
        </button>`;
      }).join('')}</div>`;
    }
    const tabs = [
      ['arrows', 'Arrows'],
      ['upgrades', 'Upgrades'],
      ['colours', 'Colours'],
    ];
    this.modal(
      `<div class="shop">
        <div class="shop-head">
          <h2>Shop</h2>
          <span class="chip">${icon('skull')}<b>${d.skulls}</b></span>
        </div>
        <div class="tabs">${tabs.map(([id, label]) => `<button class="tab ${tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}">${label}</button>`).join('')}</div>
        <div class="shop-list">${body}</div>
        <button class="btn primary" data-act="close">Done</button>
      </div>`,
      {
        ...handlers,
        tab: (id) => this.shop({ save, ads, tab: id, handlers, onClose }),
        close: onClose,
      },
    );
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
