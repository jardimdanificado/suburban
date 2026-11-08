/** Touch buttons keep their own held state so keyboard and multiple fingers can coexist. */
export class FreeCameraTouchControls {
  constructor(root) {
    this.pointers = new Map();
    this.slow = false;
    this.coarsePointer = window.matchMedia('(any-pointer: coarse)');
    this.element = document.createElement('div');
    this.element.className = 'free-camera-controls';
    this.element.hidden = true;
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', 'Controles da câmera livre');
    const movement = document.createElement('div');
    movement.className = 'free-camera-movement';
    const height = document.createElement('div');
    height.className = 'free-camera-height';
    for (const [code, label, title, group] of [
      ['KeyW', '↑', 'Avançar', movement],
      ['KeyA', '←', 'Mover à esquerda', movement],
      ['KeyS', '↓', 'Recuar', movement],
      ['KeyD', '→', 'Mover à direita', movement],
      ['KeyE', 'E · Subir', 'Subir', height],
      ['KeyQ', 'Q · Descer', 'Descer', height],
      ['CapsLock', 'Devagar', 'Alternar velocidade lenta', height],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.code = code;
      button.setAttribute('aria-label', title);
      if (code === 'CapsLock') {
        this.slowButton = button;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => this.toggleSlow());
        group.append(button);
        continue;
      }
      button.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.pointers.set(event.pointerId, code);
        button.classList.add('held');
      });
      const release = event => {
        this.pointers.delete(event.pointerId);
        if (!this.has(code)) button.classList.remove('held');
      };
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release);
      group.append(button);
    }
    this.element.append(movement, height);
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click', 'dblclick', 'contextmenu']) {
      this.element.addEventListener(type, event => event.stopPropagation());
    }
    root.append(this.element);
  }

  toggleSlow() {
    this.slow = !this.slow;
    this.slowButton.classList.toggle('active', this.slow);
    this.slowButton.setAttribute('aria-pressed', String(this.slow));
  }

  has(code) { return [...this.pointers.values()].includes(code); }

  clear() {
    this.pointers.clear();
    for (const button of this.element.querySelectorAll('.held')) button.classList.remove('held');
  }

  update(active) {
    const visible = active && (this.coarsePointer.matches || navigator.maxTouchPoints > 0);
    if (this.element.hidden === !visible) return;
    if (!visible) this.clear();
    this.element.hidden = !visible;
  }
}
