/** Mobile free camera controls drawn through the game's window UI. */
export class FreeCameraTouchControls {
  constructor() {
    this.pointers = new Map();
    this.buttons = [];
    this.slow = false;
    this.coarsePointer = window.matchMedia('(any-pointer: coarse)');
    this.element = document.createElement('div');
    this.element.hidden = true;
  }

  toggleSlow() { this.slow = !this.slow; }
  has(code) { return [...this.pointers.values()].includes(code); }
  pointerDown(x, y, pointerId, desktop) {
    const topWindow = desktop.manager.at(x, y);
    if (topWindow?.id !== 'free-camera-touch-controls') return false;
    const menu = desktop.menuOpen && desktop.menuBounds;
    if (menu && x >= menu.x && x < menu.x + menu.w && y >= menu.y && y < menu.y + menu.h) return false;
    const button = this.buttons.find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
    if (!button) return false;
    if (button.slow) this.toggleSlow();
    else this.pointers.set(pointerId, button.code);
    return true;
  }
  pointerUp(pointerId) { this.pointers.delete(pointerId); }
  clear() { this.pointers.clear(); }

  update(active, desktop) {
    const visible = active && (this.coarsePointer.matches || navigator.maxTouchPoints > 0);
    const id = 'free-camera-touch-controls';
    let window = desktop.manager.find(id);
    if (!visible) {
      this.clear();
      if (window) desktop.close(id);
      this.element.hidden = true;
      return;
    }
    if (!window) {
      const state = {
        tab: 'free-camera-controls', element: this.element, inputs: [], zones: [],
        drawFloating: (ui, bounds) => {
          const left = bounds.x + 12, right = bounds.x + bounds.w - 92, top = bounds.y + 36;
          this.buttons = [];
          const drawButton = (x, y, w, h, label, code, slow = false) => {
            this.buttons.push({x,y,w,h,code,slow});
            ui.button(x, y, w, h, label, () => {}, {selected: slow ? this.slow : this.has(code)});
          };
          const move = (x, y, code, label) => drawButton(x, y, 42, 30, label, code);
          move(left + 44, top, 'KeyW', '↑');
          move(left, top + 34, 'KeyA', '←');
          move(left + 44, top + 34, 'KeyS', '↓');
          move(left + 88, top + 34, 'KeyD', '→');
          drawButton(right, top, 78, 30, 'SUBIR', 'KeyE');
          drawButton(right, top + 34, 78, 30, 'DESCER', 'KeyQ');
          drawButton(right, top + 68, 78, 30, 'DEVAGAR', 'CapsLock', true);
        },
      };
      window = desktop.manager.open({id, title: 'Controles da câmera', width: 300, height: 160, minWidth: 290, minHeight: 150, state});
      window.kind = 'module';
      desktop.element.append(this.element);
    }
    this.element.hidden = false;
  }
}
