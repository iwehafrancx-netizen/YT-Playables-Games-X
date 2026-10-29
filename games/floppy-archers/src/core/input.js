/**
 * Pointer + keyboard input. Every finger (or the mouse) is tracked on its own,
 * so two players can drag on the same screen; the active handler gets each
 * pointer's events with its `id` and where that pointer started.
 */
export class Input {
  constructor(el) {
    this.el = el;
    this.handler = null;
    this.pointers = new Map();
    this.keys = new Set();

    el.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => {
      for (const [id, p] of [...this.pointers]) {
        this.pointers.delete(id);
        this.handler?.onPointerUp?.(p.pos, p.start);
      }
      this.keys.clear();
    });
  }

  point(e) {
    const r = this.el.getBoundingClientRect();
    return {
      id: e.pointerId,
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
      px: e.clientX - r.left,
      py: e.clientY - r.top,
      w: r.width,
      h: r.height,
    };
  }

  onDown(e) {
    e.preventDefault?.();
    const start = this.point(e);
    this.pointers.set(e.pointerId, { start, pos: start });
    this.handler?.onPointerDown?.(start);
  }

  onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    p.pos = this.point(e);
    this.handler?.onPointerMove?.(p.pos, p.start);
  }

  onUp(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    this.handler?.onPointerUp?.(this.point(e), p.start);
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
}
