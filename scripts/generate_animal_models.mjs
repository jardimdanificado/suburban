import fs from 'node:fs';
import path from 'node:path';
import { ANIMAL_SPECIES, ANIMAL_CLIPS } from '../js/animal_catalog.js';

function createMesh() {
  const vertices = [];
  const faces = [];

  // Loft a sequence of elliptical cross-section rings along an arbitrary 3D spine.
  // Each section: { x, y, z, rx, ry, sides?, pitch?, yaw? }
  function addLoft(sections, sides = 8, capStart = true, capEnd = true) {
    const rings = [];
    for (const s of sections) {
      const n = s.sides || sides;
      const cp = Math.cos(s.pitch || 0), sp = Math.sin(s.pitch || 0);
      const cy = Math.cos(s.yaw || 0), sy = Math.sin(s.yaw || 0);
      const ring = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.PI / n;
        let lx = Math.cos(a) * s.rx;
        let ly = Math.sin(a) * s.ry;
        let lz = 0;
        if (s.pitch) {
          const y1 = ly * cp - lz * sp, z1 = ly * sp + lz * cp;
          ly = y1; lz = z1;
        }
        if (s.yaw) {
          const x1 = lx * cy + lz * sy, z1 = -lx * sy + lz * cy;
          lx = x1; lz = z1;
        }
        vertices.push([s.x + lx, s.y + ly, s.z + lz]);
        ring.push(vertices.length);
      }
      rings.push(ring);
    }
    for (let r = 0; r < rings.length - 1; r++) {
      const a = rings[r], b = rings[r + 1], n = a.length;
      for (let i = 0; i < n; i++) {
        const ni = (i + 1) % n;
        faces.push([a[i], a[ni], b[ni]]);
        faces.push([a[i], b[ni], b[i]]);
      }
    }
    if (capStart && rings.length) {
      const r = rings[0];
      const c = [
        r.reduce((s, idx) => s + vertices[idx - 1][0], 0) / r.length,
        r.reduce((s, idx) => s + vertices[idx - 1][1], 0) / r.length,
        r.reduce((s, idx) => s + vertices[idx - 1][2], 0) / r.length,
      ];
      vertices.push(c);
      const ci = vertices.length;
      for (let i = 0; i < r.length; i++) faces.push([ci, r[(i + 1) % r.length], r[i]]);
    }
    if (capEnd && rings.length) {
      const r = rings[rings.length - 1];
      const c = [
        r.reduce((s, idx) => s + vertices[idx - 1][0], 0) / r.length,
        r.reduce((s, idx) => s + vertices[idx - 1][1], 0) / r.length,
        r.reduce((s, idx) => s + vertices[idx - 1][2], 0) / r.length,
      ];
      vertices.push(c);
      const ci = vertices.length;
      for (let i = 0; i < r.length; i++) faces.push([ci, r[i], r[(i + 1) % r.length]]);
    }
  }

  // Two-segment articulated limb (hip -> knee -> ankle/hoof) with tapered 6-sided cross-section.
  function addLimb(hx, hy, hz, upperLen, lowerLen, rTop, rMid, rBot, thighPitch, kneePitch, sideRoll = 0) {
    const kx = hx + Math.sin(sideRoll) * upperLen * 0.5;
    const ky = hy - Math.cos(thighPitch) * upperLen;
    const kz = hz + Math.sin(thighPitch) * upperLen;
    const totalPitch = thighPitch + kneePitch;
    const fx = kx + Math.sin(sideRoll) * lowerLen * 0.5;
    const fy = ky - Math.cos(totalPitch) * lowerLen;
    const fz = kz + Math.sin(totalPitch) * lowerLen;

    addLoft([
      { x: hx, y: hy, z: hz, rx: rTop, ry: rTop * 1.15, pitch: Math.PI * 0.5 },
      { x: kx, y: ky, z: kz, rx: rMid, ry: rMid * 1.1, pitch: Math.PI * 0.5 },
      { x: fx, y: fy, z: fz, rx: rBot, ry: rBot * 1.1, pitch: Math.PI * 0.5 },
      { x: fx, y: fy - 0.02, z: fz + rBot * 0.25, rx: rBot * 1.15, ry: rBot * 1.25, pitch: Math.PI * 0.5 },
    ], 6);
  }

  function addChain(points, sides = 6) {
    addLoft(points, sides, true, true);
  }

  function toOBJ(name) {
    let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const v of vertices) {
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2];
      if (v[2] > maxZ) maxZ = v[2];
    }
    const shiftY = Number.isFinite(minY) ? -minY : 0;
    const spanY = Math.max(0.1, maxY - minY);
    const spanZ = Math.max(0.1, maxZ - minZ);
    const lines = [`o ${name}`];
    for (const [x, y, z] of vertices) {
      lines.push(`v ${x.toFixed(5)} ${(y + shiftY).toFixed(5)} ${z.toFixed(5)}`);
      const u = Math.max(0, Math.min(1, (z - minZ) / spanZ));
      const vCoord = Math.max(0, Math.min(1, (y - minY) / spanY));
      lines.push(`vt ${u.toFixed(4)} ${vCoord.toFixed(4)}`);
    }
    for (const [a, b, c] of faces) {
      lines.push(`f ${a}/${a} ${b}/${b} ${c}/${c}`);
    }
    return lines.join('\n') + '\n';
  }

  return { addLoft, addLimb, addChain, toOBJ };
}

function frameParams(clip, frame) {
  if (clip === 'walk') {
    const t = (frame / 8) * Math.PI * 2;
    const fl = Math.sin(t) * 0.48;
    const fr = Math.sin(t + Math.PI) * 0.48;
    const bl = Math.sin(t + Math.PI * 0.85) * 0.45;
    const br = Math.sin(t - Math.PI * 0.15) * 0.45;
    const knee = ph => Math.max(0, Math.cos(ph)) * 0.52;
    return {
      fl, fr, bl, br,
      kfl: -knee(t), kfr: -knee(t + Math.PI), kbl: knee(t + Math.PI * 0.85) * 0.8, kbr: knee(t - Math.PI * 0.15) * 0.8,
      bob: Math.abs(Math.sin(t)) * 0.035,
      roll: Math.sin(t) * 0.04,
      headPitch: 0.06 * Math.cos(t * 2),
      headYaw: Math.sin(t) * 0.05,
      tailYaw: Math.sin(t) * 0.32,
      sleep: false,
    };
  }
  if (clip === 'eat') {
    const t = (frame / 6) * Math.PI * 2;
    const munch = Math.sin(t) * 0.14;
    return {
      fl: 0.1, fr: -0.06, bl: -0.06, br: 0.08,
      kfl: -0.08, kfr: 0, kbl: 0, kbr: 0,
      bob: -0.02, roll: 0,
      headPitch: 0.85 + munch,
      headYaw: Math.sin(t * 0.5) * 0.12,
      tailYaw: Math.sin(t) * 0.25,
      sleep: false,
    };
  }
  if (clip === 'sleep') {
    return {
      fl: 1.35, fr: 1.35, bl: -1.3, br: -1.3,
      kfl: -1.6, kfr: -1.6, kbl: 1.5, kbr: 1.5,
      bob: -0.25, roll: 0.05,
      headPitch: 0.45, headYaw: 0.28, tailYaw: 0.3,
      sleep: true,
    };
  }
  const t = (frame / 4) * Math.PI * 2;
  return {
    fl: 0, fr: 0, bl: 0, br: 0,
    kfl: 0, kfr: 0, kbl: 0, kbr: 0,
    bob: Math.sin(t) * 0.015,
    roll: 0,
    headPitch: 0.04 * Math.sin(t),
    headYaw: Math.sin(t) * 0.16,
    tailYaw: Math.sin(t) * 0.22,
    sleep: false,
  };
}

function buildQuadruped(spec, p) {
  const m = createMesh();
  const configs = {
    bovine: { rx: 0.27, ry: 0.26, bl: 1.16, lh: 0.52, lr: 0.065, nr: 0.14, nl: 0.34, hr: 0.17, hl: 0.36, sr: 0.1, sl: 0.18, horns: 'short', tail: 0.54 },
    ox: { rx: 0.31, ry: 0.29, bl: 1.24, lh: 0.54, lr: 0.072, nr: 0.16, nl: 0.36, hr: 0.19, hl: 0.38, sr: 0.11, sl: 0.2, horns: 'long', hump: true, tail: 0.56 },
    equine: { rx: 0.23, ry: 0.24, bl: 1.2, lh: 0.72, lr: 0.055, nr: 0.12, nl: 0.48, hr: 0.14, hl: 0.4, sr: 0.085, sl: 0.22, mane: true, tail: 0.64 },
    pig: { rx: 0.24, ry: 0.2, bl: 0.82, lh: 0.24, lr: 0.052, nr: 0.15, nl: 0.18, hr: 0.16, hl: 0.26, sr: 0.09, sl: 0.14, ears: 'floppy', tail: 0.2 },
    sheep: { rx: 0.28, ry: 0.25, bl: 0.84, lh: 0.34, lr: 0.048, nr: 0.13, nl: 0.24, hr: 0.13, hl: 0.26, sr: 0.075, sl: 0.13, wool: true, tail: 0.18 },
    goat: { rx: 0.19, ry: 0.2, bl: 0.8, lh: 0.4, lr: 0.042, nr: 0.1, nl: 0.32, hr: 0.12, hl: 0.26, sr: 0.07, sl: 0.14, horns: 'back', tail: 0.18 },
    capybara: { rx: 0.23, ry: 0.2, bl: 0.8, lh: 0.24, lr: 0.05, nr: 0.14, nl: 0.16, hr: 0.15, hl: 0.32, sr: 0.11, sl: 0.14, tail: 0.06 },
    tapir: { rx: 0.25, ry: 0.23, bl: 0.98, lh: 0.38, lr: 0.06, nr: 0.14, nl: 0.28, hr: 0.14, hl: 0.32, sr: 0.07, sl: 0.22, mane: true, tail: 0.1 },
    deer: { rx: 0.18, ry: 0.19, bl: 0.9, lh: 0.58, lr: 0.04, nr: 0.09, nl: 0.42, hr: 0.11, hl: 0.28, sr: 0.06, sl: 0.15, antlers: true, tail: 0.18 },
    boar: { rx: 0.23, ry: 0.21, bl: 0.84, lh: 0.28, lr: 0.052, nr: 0.15, nl: 0.2, hr: 0.16, hl: 0.28, sr: 0.09, sl: 0.15, tusks: true, tail: 0.22 },
    armadillo: { rx: 0.18, ry: 0.14, bl: 0.52, lh: 0.13, lr: 0.035, nr: 0.08, nl: 0.12, hr: 0.08, hl: 0.16, sr: 0.05, sl: 0.1, shell: true, tail: 0.28 },
    anteater: { rx: 0.2, ry: 0.19, bl: 0.88, lh: 0.34, lr: 0.055, nr: 0.11, nl: 0.28, hr: 0.09, hl: 0.26, sr: 0.045, sl: 0.3, bushyTail: true, tail: 0.68 },
    jaguar: { rx: 0.21, ry: 0.2, bl: 1.04, lh: 0.46, lr: 0.055, nr: 0.12, nl: 0.24, hr: 0.14, hl: 0.26, sr: 0.085, sl: 0.14, ears: 'cat', tail: 0.68 },
    maned_wolf: { rx: 0.17, ry: 0.18, bl: 0.86, lh: 0.64, lr: 0.04, nr: 0.1, nl: 0.34, hr: 0.11, hl: 0.26, sr: 0.06, sl: 0.2, ears: 'tall', mane: true, tail: 0.44 },
    rabbit: { rx: 0.13, ry: 0.12, bl: 0.4, lh: 0.14, lr: 0.032, nr: 0.075, nl: 0.12, hr: 0.09, hl: 0.16, sr: 0.05, sl: 0.08, ears: 'rabbit', tail: 0.09 },
  };
  const c = configs[spec.bodyPlan] || configs.bovine;
  const bodyY = (p.sleep ? c.ry * 0.95 : c.lh + c.ry * 0.85) + p.bob;

  m.addLoft([
    { x: 0, y: bodyY - 0.02, z: -c.bl * 0.5, rx: c.rx * 0.62, ry: c.ry * 0.68 },
    { x: 0, y: bodyY + 0.02, z: -c.bl * 0.28, rx: c.rx * 0.96, ry: c.ry * 0.96 },
    { x: 0, y: bodyY - 0.01, z: 0, rx: c.rx * (c.wool ? 1.15 : 1.04), ry: c.ry * (c.wool ? 1.12 : 1.02) },
    { x: 0, y: bodyY + (c.hump ? 0.08 : 0.02), z: c.bl * 0.28, rx: c.rx * 0.95, ry: c.ry * 0.98 },
    { x: 0, y: bodyY - 0.01, z: c.bl * 0.48, rx: c.rx * 0.65, ry: c.ry * 0.72 },
  ], 8);

  const lx = c.rx * 0.62, fz = c.bl * 0.32, bz = -c.bl * 0.32;
  const hipY = bodyY - c.ry * 0.55;
  const uLen = c.lh * 0.52, lLen = c.lh * 0.48;
  m.addLimb(-lx, hipY, fz, uLen, lLen, c.lr * 1.25, c.lr * 0.95, c.lr * 0.78, p.fl, p.kfl);
  m.addLimb(lx, hipY, fz, uLen, lLen, c.lr * 1.25, c.lr * 0.95, c.lr * 0.78, p.fr, p.kfr);
  m.addLimb(-lx, hipY, bz, uLen, lLen, c.lr * 1.35, c.lr * 0.95, c.lr * 0.78, p.bl, p.kbl);
  m.addLimb(lx, hipY, bz, uLen, lLen, c.lr * 1.35, c.lr * 0.95, c.lr * 0.78, p.br, p.kbr);

  const pitch = p.headPitch * 0.88, yaw = p.headYaw;
  const ny0 = bodyY + c.ry * 0.35, nz0 = c.bl * 0.42;
  const ny1 = ny0 + Math.cos(pitch) * c.nl * 0.55, nz1 = nz0 + Math.sin(pitch) * c.nl * 0.55 + Math.cos(pitch) * c.nl * 0.35;
  const hx = Math.sin(yaw) * c.nl * 0.45;
  const hy = ny0 + Math.cos(pitch) * c.nl * 0.85 - Math.sin(pitch) * c.nl * 0.15;
  const hz = nz0 + Math.sin(pitch) * c.nl * 0.85 + Math.cos(pitch) * c.nl * 0.52;

  m.addLoft([
    { x: 0, y: ny0, z: nz0, rx: c.nr * 1.1, ry: c.nr * 1.25, pitch: -0.4 + pitch * 0.4 },
    { x: hx * 0.5, y: ny1, z: nz1, rx: c.nr * 0.88, ry: c.nr * 0.98, pitch: -0.3 + pitch * 0.6, yaw: yaw * 0.5 },
    { x: hx, y: hy, z: hz, rx: c.hr * 0.82, ry: c.hr * 0.85, pitch: pitch * 0.5, yaw },
  ], 8);

  const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
  const mz = hz + cosY * (c.hl * 0.55), mx = hx + sinY * (c.hl * 0.55), my = hy - c.hr * 0.15 - Math.sin(pitch) * c.hl * 0.25;
  const sz = mz + cosY * c.sl, sx = mx + sinY * c.sl, sy = my - Math.sin(pitch) * c.sl * 0.4;
  m.addLoft([
    { x: hx - sinY * c.hl * 0.25, y: hy + 0.02, z: hz - cosY * c.hl * 0.25, rx: c.hr * 0.85, ry: c.hr * 0.82, yaw },
    { x: hx + sinY * c.hl * 0.2, y: hy, z: hz + cosY * c.hl * 0.2, rx: c.hr, ry: c.hr * 0.95, yaw },
    { x: mx, y: my, z: mz, rx: c.sr * 1.15, ry: c.sr, yaw },
    { x: sx, y: sy, z: sz, rx: c.sr * 0.72, ry: c.sr * 0.65, yaw },
  ], 8);

  if (c.horns === 'short' || c.horns === 'long') {
    const hLen = c.horns === 'long' ? 0.34 : 0.18;
    for (const s of [-1, 1]) {
      m.addChain([
        { x: hx + s * c.hr * 0.7, y: hy + c.hr * 0.55, z: hz, rx: 0.036, ry: 0.036 },
        { x: hx + s * (c.hr * 0.95 + hLen * 0.5), y: hy + c.hr * 0.75 + hLen * 0.35, z: hz + 0.03, rx: 0.024, ry: 0.024 },
        { x: hx + s * (c.hr + hLen), y: hy + c.hr * 0.9 + hLen * 0.7, z: hz + 0.06, rx: 0.008, ry: 0.008 },
      ], 6);
    }
  } else if (c.horns === 'back') {
    for (const s of [-1, 1]) {
      m.addChain([
        { x: hx + s * c.hr * 0.5, y: hy + c.hr * 0.65, z: hz - 0.02, rx: 0.028, ry: 0.028 },
        { x: hx + s * c.hr * 0.75, y: hy + c.hr * 1.25, z: hz - 0.16, rx: 0.01, ry: 0.01 },
      ], 6);
    }
  }
  if (c.antlers) {
    for (const s of [-1, 1]) {
      m.addChain([
        { x: hx + s * c.hr * 0.5, y: hy + c.hr * 0.7, z: hz, rx: 0.022, ry: 0.022 },
        { x: hx + s * c.hr * 1.1, y: hy + c.hr * 1.6, z: hz - 0.05, rx: 0.016, ry: 0.016 },
        { x: hx + s * c.hr * 1.4, y: hy + c.hr * 2.2, z: hz + 0.04, rx: 0.007, ry: 0.007 },
      ], 5);
    }
  }
  if (c.ears === 'rabbit' || c.ears === 'tall' || c.ears === 'cat') {
    const eh = c.ears === 'rabbit' ? 0.22 : c.ears === 'tall' ? 0.15 : 0.09;
    for (const s of [-1, 1]) {
      m.addChain([
        { x: hx + s * c.hr * 0.65, y: hy + c.hr * 0.6, z: hz - 0.03, rx: 0.032, ry: 0.022 },
        { x: hx + s * c.hr * 0.85, y: hy + c.hr * 0.65 + eh, z: hz - 0.06, rx: 0.014, ry: 0.012 },
      ], 6);
    }
  }

  const ty0 = bodyY + c.ry * 0.35, tz0 = -c.bl * 0.48;
  const tx1 = Math.sin(p.tailYaw) * c.tail * 0.45;
  const tw = c.bushyTail ? 0.12 : 0.038;
  m.addChain([
    { x: 0, y: ty0, z: tz0, rx: tw, ry: tw },
    { x: tx1 * 0.5, y: ty0 - c.tail * 0.35, z: tz0 - c.tail * 0.35, rx: tw * (c.bushyTail ? 1.4 : 0.75), ry: tw * (c.bushyTail ? 1.4 : 0.75) },
    { x: tx1, y: ty0 - c.tail * 0.75, z: tz0 - c.tail * 0.6, rx: tw * (c.bushyTail ? 0.7 : 0.4), ry: tw * (c.bushyTail ? 0.7 : 0.4) },
  ], 6);
  return m;
}

function buildBird(spec, p) {
  const m = createMesh();
  const configs = {
    chicken: { rx: 0.14, ry: 0.13, bl: 0.34, lh: 0.18, nh: 0.14, hr: 0.07, bkL: 0.09 },
    duck: { rx: 0.14, ry: 0.11, bl: 0.4, lh: 0.14, nh: 0.16, hr: 0.07, bkL: 0.12 },
    heron: { rx: 0.12, ry: 0.12, bl: 0.42, lh: 0.48, nh: 0.38, hr: 0.06, bkL: 0.22 },
    toucan: { rx: 0.12, ry: 0.12, bl: 0.34, lh: 0.16, nh: 0.14, hr: 0.08, bkL: 0.24 },
    macaw: { rx: 0.12, ry: 0.12, bl: 0.38, lh: 0.16, nh: 0.14, hr: 0.08, bkL: 0.11, longTail: true },
    rhea: { rx: 0.22, ry: 0.2, bl: 0.66, lh: 0.68, nh: 0.48, hr: 0.085, bkL: 0.14 },
  };
  const c = configs[spec.bodyPlan] || configs.chicken;
  const bodyY = (p.sleep ? c.ry * 0.95 : c.lh + c.ry * 0.85) + p.bob;

  m.addLoft([
    { x: 0, y: bodyY + 0.02, z: -c.bl * 0.5, rx: c.rx * 0.45, ry: c.ry * 0.45 },
    { x: 0, y: bodyY, z: 0, rx: c.rx * 1.15, ry: c.ry * 1.05 },
    { x: 0, y: bodyY + 0.03, z: c.bl * 0.46, rx: c.rx * 0.65, ry: c.ry * 0.7 },
  ], 8);

  const lx = c.rx * 0.48, hipY = bodyY - c.ry * 0.65;
  m.addLimb(-lx, hipY, 0, c.lh * 0.5, c.lh * 0.5, 0.028, 0.022, 0.02, p.fl, p.kfl);
  m.addLimb(lx, hipY, 0, c.lh * 0.5, c.lh * 0.5, 0.028, 0.022, 0.02, p.fr, p.kfr);

  const pitch = p.headPitch * 0.85, yaw = p.headYaw;
  const ny = bodyY + c.ry * 0.55, nz = c.bl * 0.36;
  const hy = ny + Math.cos(pitch) * c.nh, hz = nz + Math.sin(pitch) * c.nh + 0.04;
  const hx = Math.sin(yaw) * c.nh * 0.35;
  m.addLoft([
    { x: 0, y: ny, z: nz, rx: c.hr * 0.8, ry: c.hr * 0.8 },
    { x: hx, y: hy, z: hz, rx: c.hr, ry: c.hr },
  ], 7);
  m.addChain([
    { x: hx, y: hy - 0.01, z: hz + c.hr * 0.7, rx: c.hr * 0.55, ry: c.hr * 0.45 },
    { x: hx + Math.sin(yaw) * c.bkL, y: hy - 0.03 - Math.sin(pitch) * c.bkL * 0.4, z: hz + c.hr * 0.7 + Math.cos(yaw) * c.bkL, rx: 0.012, ry: 0.012 },
  ], 6);

  const tl = c.longTail ? 0.48 : 0.2;
  m.addChain([
    { x: 0, y: bodyY + 0.03, z: -c.bl * 0.48, rx: c.rx * 0.45, ry: 0.04 },
    { x: Math.sin(p.tailYaw) * tl * 0.3, y: bodyY + 0.08, z: -c.bl * 0.48 - tl, rx: c.rx * 0.15, ry: 0.02 },
  ], 6);
  return m;
}

function buildReptile(p) {
  const m = createMesh();
  const bodyY = (p.sleep ? 0.14 : 0.19) + p.bob * 0.4;
  m.addLoft([
    { x: 0, y: bodyY, z: -0.48, rx: 0.14, ry: 0.09 },
    { x: 0, y: bodyY + 0.02, z: 0, rx: 0.24, ry: 0.12 },
    { x: 0, y: bodyY + 0.02, z: 0.45, rx: 0.17, ry: 0.11 },
    { x: 0, y: bodyY + 0.01, z: 0.72, rx: 0.13, ry: 0.08 },
    { x: 0, y: bodyY, z: 1.05, rx: 0.075, ry: 0.05 },
  ], 8);
  const lx = 0.22;
  m.addLimb(-lx, bodyY, 0.28, 0.1, 0.1, 0.05, 0.04, 0.035, p.fl, p.kfl, -0.35);
  m.addLimb(lx, bodyY, 0.28, 0.1, 0.1, 0.05, 0.04, 0.035, p.fr, p.kfr, 0.35);
  m.addLimb(-lx, bodyY, -0.28, 0.1, 0.1, 0.05, 0.04, 0.035, p.bl, p.kbl, -0.35);
  m.addLimb(lx, bodyY, -0.28, 0.1, 0.1, 0.05, 0.04, 0.035, p.br, p.kbr, 0.35);
  m.addChain([
    { x: 0, y: bodyY, z: -0.46, rx: 0.13, ry: 0.08 },
    { x: Math.sin(p.tailYaw) * 0.2, y: bodyY - 0.02, z: -0.85, rx: 0.08, ry: 0.055 },
    { x: Math.sin(p.tailYaw) * 0.42, y: bodyY - 0.04, z: -1.25, rx: 0.025, ry: 0.025 },
  ], 6);
  return m;
}

function buildPrimate(spec, p) {
  const m = createMesh();
  const isSloth = spec.bodyPlan === 'sloth';
  const lh = isSloth ? 0.26 : 0.32, bodyY = (p.sleep ? 0.16 : lh + 0.16) + p.bob;
  m.addLoft([
    { x: 0, y: bodyY, z: -0.26, rx: 0.12, ry: 0.13 },
    { x: 0, y: bodyY + 0.02, z: 0, rx: 0.15, ry: 0.15 },
    { x: 0, y: bodyY + 0.05, z: 0.26, rx: 0.13, ry: 0.14 },
  ], 8);
  const lx = 0.14;
  m.addLimb(-lx, bodyY - 0.06, 0.18, lh * 0.5, lh * 0.5, 0.045, 0.035, 0.03, p.fl, p.kfl);
  m.addLimb(lx, bodyY - 0.06, 0.18, lh * 0.5, lh * 0.5, 0.045, 0.035, 0.03, p.fr, p.kfr);
  m.addLimb(-lx, bodyY - 0.06, -0.18, lh * 0.5, lh * 0.5, 0.045, 0.035, 0.03, p.bl, p.kbl);
  m.addLimb(lx, bodyY - 0.06, -0.18, lh * 0.5, lh * 0.5, 0.045, 0.035, 0.03, p.br, p.kbr);
  m.addLoft([
    { x: 0, y: bodyY + 0.08, z: 0.26, rx: 0.08, ry: 0.08 },
    { x: Math.sin(p.headYaw) * 0.05, y: bodyY + 0.18, z: 0.34, rx: 0.11, ry: 0.11 },
  ], 8);
  if (!isSloth) {
    m.addChain([
      { x: 0, y: bodyY + 0.04, z: -0.25, rx: 0.032, ry: 0.032 },
      { x: Math.sin(p.tailYaw) * 0.12, y: bodyY + 0.22, z: -0.48, rx: 0.024, ry: 0.024 },
      { x: Math.sin(p.tailYaw) * 0.22, y: bodyY + 0.34, z: -0.62, rx: 0.016, ry: 0.016 },
    ], 6);
  }
  return m;
}

function buildAnimalMesh(spec, clip, frame) {
  const p = frameParams(clip, frame);
  if (['chicken', 'duck', 'heron', 'toucan', 'macaw', 'rhea'].includes(spec.bodyPlan)) return buildBird(spec, p);
  if (spec.bodyPlan === 'caiman') return buildReptile(p);
  if (spec.bodyPlan === 'sloth' || spec.bodyPlan === 'monkey') return buildPrimate(spec, p);
  return buildQuadruped(spec, p);
}

let generated = 0;
for (const [id, spec] of Object.entries(ANIMAL_SPECIES)) {
  for (const [clip, frames] of Object.entries(ANIMAL_CLIPS)) {
    const dir = path.join('data', 'animals', id, clip);
    fs.mkdirSync(dir, { recursive: true });
    for (const frame of frames) {
      const mesh = buildAnimalMesh(spec, clip, frame);
      fs.writeFileSync(path.join(dir, `${frame}.obj`), mesh.toOBJ(`${id}_${clip}_${frame}`), 'utf8');
      generated++;
    }
  }
}
console.log(`Generated ${generated} sculpted low-poly animal OBJ frames across ${Object.keys(ANIMAL_SPECIES).length} species.`);
