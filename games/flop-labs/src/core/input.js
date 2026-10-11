/**
 * Unified pointer + keyboard input. The active handler (the current level)
 * receives normalised events; UI elements stop propagation themselves.
 */
export class Input {
  constructor(el) {
    this.el = el;
    this.handler = null;
    this.down = false;
    this.pointerId = null;
    this.start = { x: 0, y: 0 };
    this.pos = { x: 0, y: 0 };
    this.keys = new Set();

    el.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => {
      if (this.down) this.onUp({ pointerId: this.pointerId, clientX: this.pos.px, clientY: this.pos.py });
      this.keys.clear();
    });
  }

  point(e) {
    const r = this.el.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
      px: e.clientX - r.left,
      py: e.clientY - r.top,
      w: r.width,
      h: r.height,
    };
  }

  onDown(e) {
    if (this.down) return;
    e.preventDefault?.();
    this.down = true;
    this.pointerId = e.pointerId;
    this.start = this.point(e);
    this.pos = this.start;
    this.handler?.onPointerDown?.(this.start);
  }

  onMove(e) {
    if (!this.down || e.pointerId !== this.pointerId) return;
    this.pos = this.point(e);
    this.handler?.onPointerMove?.(this.pos, this.start);
  }

  onUp(e) {
    if (!this.down || (e.pointerId !== undefined && e.pointerId !== this.pointerId)) return;
    this.down = false;
    if (e.clientX !== undefined) this.pos = this.point(e);
    this.handler?.onPointerUp?.(this.pos, this.start);
  }

  onKey(e, isDown) {
    const k = e.code;
    if (isDown) {
      if (this.keys.has(k)) return;
      this.keys.add(k);
    } else {
      this.keys.delete(k);
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    const fn = isDown ? this.handler?.onKeyDown : this.handler?.onKeyUp;
    if (fn?.call(this.handler, k) === true) e.preventDefault();
  }

  held(code) {
    return this.keys.has(code);
  }
}
