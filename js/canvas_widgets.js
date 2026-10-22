/** Widgets that also work with the framework's original, smaller UI interface. */
export function clipCanvasRegion(ui, x, y, w, h, draw) {
  const start = ui.regions.length;
  ui.ctx.save(); ui.ctx.beginPath(); ui.ctx.rect(x, y, w, h); ui.ctx.clip();
  try { return draw(); } finally {
    ui.ctx.restore();
    const clipped = ui.regions.splice(start).flatMap(r => {
      const left = Math.max(x, r.x), top = Math.max(y, r.y);
      const right = Math.min(x + w, r.x + r.w), bottom = Math.min(y + h, r.y + r.h);
      return right > left && bottom > top ? [{ ...r, x: left, y: top, w: right - left, h: bottom - top }] : [];
    });
    ui.regions.push(...clipped);
  }
}

export function canvasBox(ui, x, y, w, h) {
  const ctx = ui.ctx;
  ctx.save(); ctx.fillStyle = '#000000'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.restore();
}

export function canvasBar(ui, x, y, w, h, value, max, label = '', color = '#58d854') {
  canvasBox(ui, x, y, w, h);
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0)), ctx = ui.ctx;
  ctx.save(); ctx.fillStyle = color; ctx.fillRect(x + 3, y + 3, (w - 6) * pct, h - 6); ctx.restore();
  ui.text(label, x + 6, y + Math.floor((h - 8) / 2));
  const amount = `${Math.round(value)}/${Math.round(max)}`;
  ui.text(amount, x + w - amount.length * 8 - 6, y + Math.floor((h - 8) / 2), '#f8b800');
}
