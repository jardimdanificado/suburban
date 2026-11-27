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
  function addLimb(hx, hy, hz, upperLen, lowerLen, rTop, rMid, rBot, thighPitch, kneePitch, sideRoll = 0, pawScale = 1.15) {
    const kx = hx + Math.sin(sideRoll) * upperLen * 0.55;
    const ky = hy - Math.cos(thighPitch) * upperLen;
    const kz = hz + Math.sin(thighPitch) * upperLen;
    const totalPitch = thighPitch + kneePitch;
    const fx = kx + Math.sin(sideRoll) * lowerLen * 0.55;
    const fy = ky - Math.cos(totalPitch) * lowerLen;
    const fz = kz + Math.sin(totalPitch) * lowerLen;

    addLoft([
      { x: hx, y: hy, z: hz, rx: rTop, ry: rTop * 1.15, pitch: Math.PI * 0.5 },
      { x: kx, y: ky, z: kz, rx: rMid, ry: rMid * 1.1, pitch: Math.PI * 0.5 },
      { x: fx, y: fy, z: fz, rx: rBot, ry: rBot * 1.1, pitch: Math.PI * 0.5 },
      { x: fx, y: fy - 0.02, z: fz + rBot * 0.28, rx: rBot * pawScale, ry: rBot * (pawScale + 0.12), pitch: Math.PI * 0.5 },
    ], 6);
  }

  function addChain(points, sides = 6) {
    addLoft(points, sides, true, true);
  }

  function toOBJ(name, airborneLift = 0) {
    let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const v of vertices) {
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2];
      if (v[2] > maxZ) maxZ = v[2];
    }
    const shiftY = (Number.isFinite(minY) ? -minY : 0) + Math.max(0, airborneLift);
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

function frameParams(clip, frame, spec) {
  const plan = spec.bodyPlan;
  const knee = ph => Math.max(0, Math.cos(ph)) * 0.52;

  if (clip === 'walk') {
    const t = (frame / 8) * Math.PI * 2;

    if (plan === 'rabbit') {
      // Hopping / bounding gait: front pair and hind pair move synchronously with airborne arc
      const c = Math.cos(t), s = Math.sin(t);
      const lift = Math.max(0, s) * 0.16;
      const bodyPitch = -0.26 * Math.cos(t - 0.35);
      const fl = 0.55 + s * 0.42;
      const bl = -0.35 - s * 0.72;
      return {
        fl, fr: fl, bl, br: bl,
        kfl: -0.45 + c * 0.25, kfr: -0.45 + c * 0.25,
        kbl: 0.55 - s * 0.35, kbr: 0.55 - s * 0.35,
        bob: -0.03 * Math.max(0, -s), roll: 0,
        bodyPitch, spineYaw: 0, airborneLift: lift,
        headPitch: -bodyPitch * 0.5 + 0.08 * c, headYaw: 0,
        tailYaw: 0, tailPitch: 0.1 * s, earPitch: -0.18 * Math.max(0, s),
        sleep: false,
      };
    }

    if (plan === 'maned_wolf') {
      // Authentic pacing gait: same-side legs swing together
      const left = Math.sin(t) * 0.52, right = Math.sin(t + Math.PI) * 0.52;
      return {
        fl: left, fr: right, bl: Math.sin(t - 0.15) * 0.48, br: Math.sin(t + Math.PI - 0.15) * 0.48,
        kfl: -knee(t) * 1.1, kfr: -knee(t + Math.PI) * 1.1,
        kbl: knee(t - 0.15) * 0.9, kbr: knee(t + Math.PI - 0.15) * 0.9,
        bob: Math.abs(Math.sin(t)) * 0.035, roll: Math.sin(t) * 0.075,
        bodyPitch: 0, spineYaw: Math.sin(t) * 0.04, airborneLift: 0,
        headPitch: -0.08 + 0.04 * Math.cos(t * 2), headYaw: Math.sin(t) * 0.05,
        tailYaw: Math.sin(t) * 0.28, tailPitch: -0.1,
        sleep: false,
      };
    }

    if (plan === 'jaguar') {
      // Sleek feline prowl: low crouched shoulders, sinuous S-wave spine, undulating tail
      const fl = Math.sin(t) * 0.56, fr = Math.sin(t + Math.PI) * 0.56;
      const bl = Math.sin(t + Math.PI * 0.85) * 0.54, br = Math.sin(t - Math.PI * 0.15) * 0.54;
      return {
        fl, fr, bl, br,
        kfl: -knee(t) * 1.05, kfr: -knee(t + Math.PI) * 1.05,
        kbl: knee(t + Math.PI * 0.85) * 0.9, kbr: knee(t - Math.PI * 0.15) * 0.9,
        bob: -0.03 + Math.abs(Math.sin(t)) * 0.025, roll: Math.sin(t) * 0.04,
        bodyPitch: 0.04, spineYaw: Math.sin(t) * 0.1, airborneLift: 0,
        headPitch: 0.16, headYaw: -Math.sin(t) * 0.06,
        tailYaw: Math.sin(t - 0.9) * 0.48, tailPitch: -0.12,
        sleep: false,
      };
    }

    if (plan === 'deer') {
      // Springy high-knee prancing trot
      const fl = Math.sin(t) * 0.58, fr = Math.sin(t + Math.PI) * 0.58;
      const bl = Math.sin(t + Math.PI * 0.9) * 0.54, br = Math.sin(t - Math.PI * 0.1) * 0.54;
      return {
        fl, fr, bl, br,
        kfl: -knee(t) * 1.45, kfr: -knee(t + Math.PI) * 1.45,
        kbl: knee(t + Math.PI * 0.9) * 1.1, kbr: knee(t - Math.PI * 0.1) * 1.1,
        bob: Math.abs(Math.sin(t)) * 0.055, roll: Math.sin(t) * 0.03,
        bodyPitch: -0.04 * Math.cos(t * 2), spineYaw: 0,
        airborneLift: Math.max(0, Math.abs(Math.sin(t)) - 0.65) * 0.12,
        headPitch: -0.14 + 0.05 * Math.cos(t * 2), headYaw: Math.sin(t) * 0.04,
        tailYaw: Math.sin(t) * 0.25, tailPitch: 0.35,
        sleep: false,
      };
    }

    if (plan === 'equine') {
      // Crisp high-stepping horse trot
      const fl = Math.sin(t) * 0.52, fr = Math.sin(t + Math.PI) * 0.52;
      const bl = Math.sin(t + Math.PI * 0.95) * 0.48, br = Math.sin(t - Math.PI * 0.05) * 0.48;
      return {
        fl, fr, bl, br,
        kfl: -knee(t) * 1.4, kfr: -knee(t + Math.PI) * 1.4,
        kbl: knee(t + Math.PI * 0.95) * 0.95, kbr: knee(t - Math.PI * 0.05) * 0.95,
        bob: Math.abs(Math.sin(t)) * 0.045, roll: Math.sin(t) * 0.03,
        bodyPitch: 0, spineYaw: 0, airborneLift: 0,
        headPitch: -0.06 + 0.08 * Math.cos(t * 2), headYaw: Math.sin(t) * 0.03,
        tailYaw: Math.sin(t) * 0.24, tailPitch: 0.25 + 0.1 * Math.sin(t * 2),
        sleep: false,
      };
    }

    if (plan === 'bovine' || plan === 'ox' || plan === 'tapir') {
      // Heavy lumbering walk with shoulder roll and low head sway
      const fl = Math.sin(t) * 0.38, fr = Math.sin(t + Math.PI) * 0.38;
      const bl = Math.sin(t + Math.PI * 0.8) * 0.36, br = Math.sin(t - Math.PI * 0.2) * 0.36;
      return {
        fl, fr, bl, br,
        kfl: -knee(t) * 0.75, kfr: -knee(t + Math.PI) * 0.75,
        kbl: knee(t + Math.PI * 0.8) * 0.65, kbr: knee(t - Math.PI * 0.2) * 0.65,
        bob: Math.abs(Math.sin(t)) * 0.025, roll: Math.sin(t) * 0.065,
        bodyPitch: 0, spineYaw: Math.sin(t) * 0.03, airborneLift: 0,
        headPitch: 0.16 + 0.05 * Math.cos(t * 2), headYaw: Math.sin(t) * 0.09,
        tailYaw: Math.sin(t * 1.5) * 0.42, tailPitch: 0,
        sleep: false,
      };
    }

    if (plan === 'pig' || plan === 'boar' || plan === 'capybara') {
      // Short-legged brisk waddle
      const fl = Math.sin(t) * 0.42, fr = Math.sin(t + Math.PI) * 0.42;
      const bl = Math.sin(t + Math.PI * 0.85) * 0.4, br = Math.sin(t - Math.PI * 0.15) * 0.4;
      const snoutBob = plan === 'capybara' ? -0.04 : 0.2 + 0.1 * Math.sin(t * 2);
      return {
        fl, fr, bl, br,
        kfl: -knee(t) * 0.8, kfr: -knee(t + Math.PI) * 0.8,
        kbl: knee(t + Math.PI * 0.85) * 0.7, kbr: knee(t - Math.PI * 0.15) * 0.7,
        bob: Math.abs(Math.sin(t)) * 0.025, roll: Math.sin(t) * 0.065,
        bodyPitch: 0, spineYaw: Math.sin(t) * 0.04, airborneLift: 0,
        headPitch: snoutBob, headYaw: Math.sin(t) * 0.07,
        tailYaw: Math.sin(t * 2) * 0.35, tailPitch: plan === 'pig' ? 0.3 : 0,
        sleep: false,
      };
    }

    if (plan === 'armadillo') {
      // Rapid low scurrying patter
      const fl = Math.sin(t * 2) * 0.34, fr = Math.sin(t * 2 + Math.PI) * 0.34;
      const bl = Math.sin(t * 2 + Math.PI) * 0.34, br = Math.sin(t * 2) * 0.34;
      return {
        fl, fr, bl, br,
        kfl: -knee(t * 2) * 0.5, kfr: -knee(t * 2 + Math.PI) * 0.5,
        kbl: knee(t * 2 + Math.PI) * 0.4, kbr: knee(t * 2) * 0.4,
        bob: Math.abs(Math.sin(t * 2)) * 0.015, roll: Math.sin(t * 2) * 0.045,
        bodyPitch: 0.03, spineYaw: Math.sin(t * 2) * 0.04, airborneLift: 0,
        headPitch: 0.25 + 0.06 * Math.sin(t * 2), headYaw: Math.sin(t) * 0.12,
        tailYaw: Math.sin(t * 2) * 0.22, tailPitch: -0.05,
        sleep: false,
      };
    }

    if (plan === 'anteater') {
      // Rolling knuckle-walk with sweeping snout and banner tail
      const fl = Math.sin(t) * 0.42, fr = Math.sin(t + Math.PI) * 0.42;
      const bl = Math.sin(t + Math.PI * 0.85) * 0.38, br = Math.sin(t - Math.PI * 0.15) * 0.38;
      return {
        fl, fr, bl, br,
        kfl: -0.15 - knee(t) * 0.4, kfr: -0.15 - knee(t + Math.PI) * 0.4,
        kbl: knee(t + Math.PI * 0.85) * 0.6, kbr: knee(t - Math.PI * 0.15) * 0.6,
        bob: Math.abs(Math.sin(t)) * 0.025, roll: Math.sin(t) * 0.075,
        bodyPitch: 0.04, spineYaw: Math.sin(t) * 0.05, airborneLift: 0,
        headPitch: 0.36 + 0.08 * Math.cos(t * 2), headYaw: Math.sin(t) * 0.18,
        tailYaw: Math.sin(t) * 0.26, tailPitch: 0.32,
        sleep: false,
      };
    }

    if (plan === 'coati') {
      // Bouncy scurry with sniffing snout and upright tail
      const fl = Math.sin(t) * 0.5, fr = Math.sin(t + Math.PI) * 0.5;
      const bl = Math.sin(t + Math.PI * 0.85) * 0.48, br = Math.sin(t - Math.PI * 0.15) * 0.48;
      return {
        fl, fr, bl, br,
        kfl: -knee(t) * 0.9, kfr: -knee(t + Math.PI) * 0.9,
        kbl: knee(t + Math.PI * 0.85) * 0.8, kbr: knee(t - Math.PI * 0.15) * 0.8,
        bob: Math.abs(Math.sin(t)) * 0.045, roll: Math.sin(t) * 0.04,
        bodyPitch: 0, spineYaw: Math.sin(t) * 0.06, airborneLift: 0,
        headPitch: 0.08 + 0.14 * Math.sin(t * 2), headYaw: Math.sin(t) * 0.12,
        tailYaw: Math.sin(t) * 0.22, tailPitch: 1.15,
        sleep: false,
      };
    }

    if (plan === 'caiman' || plan === 'iguana') {
      // Sprawling reptilian S-curve undulation
      const amp = plan === 'iguana' ? 0.18 : 0.13;
      const legAmp = plan === 'iguana' ? 0.58 : 0.46;
      return {
        fl: Math.sin(t) * legAmp, fr: Math.sin(t + Math.PI) * legAmp,
        bl: Math.sin(t + Math.PI) * legAmp, br: Math.sin(t) * legAmp,
        kfl: -knee(t) * 0.45, kfr: -knee(t + Math.PI) * 0.45,
        kbl: knee(t + Math.PI) * 0.4, kbr: knee(t) * 0.4,
        bob: Math.abs(Math.sin(t)) * 0.012, roll: Math.sin(t) * 0.06,
        bodyPitch: 0, spineYaw: Math.sin(t) * amp, airborneLift: 0,
        headPitch: 0.02, headYaw: -Math.sin(t) * amp * 0.85,
        tailYaw: Math.sin(t - 1.1) * 0.58, tailPitch: 0,
        sleep: false,
      };
    }

    if (plan === 'monkey') {
      // Semi-upright primate bounding gallop with arched S-tail
      const s = Math.sin(t), c = Math.cos(t);
      const lift = Math.max(0, s) * 0.065;
      return {
        fl: 0.32 + Math.sin(t) * 0.58, fr: 0.32 + Math.sin(t + 0.55) * 0.58,
        bl: -0.22 + Math.sin(t + Math.PI) * 0.55, br: -0.22 + Math.sin(t + Math.PI + 0.45) * 0.55,
        kfl: -0.45 - Math.max(0, c) * 0.4, kfr: -0.45 - Math.max(0, Math.cos(t + 0.55)) * 0.4,
        kbl: 0.45 + Math.max(0, -c) * 0.4, kbr: 0.45 + Math.max(0, -Math.cos(t + 0.45)) * 0.4,
        bob: Math.abs(s) * 0.04, roll: Math.sin(t) * 0.05,
        bodyPitch: -0.3 + s * 0.14, spineYaw: Math.sin(t) * 0.05, airborneLift: lift,
        headPitch: 0.22 - s * 0.08, headYaw: Math.sin(t) * 0.1,
        tailYaw: Math.sin(t) * 0.32, tailPitch: 0.9,
        sleep: false,
      };
    }

    if (plan === 'sloth') {
      // Ultra-slow, wide-reaching arm crawl
      return {
        fl: 0.25 + Math.sin(t) * 0.72, fr: 0.25 + Math.sin(t + Math.PI) * 0.72,
        bl: -0.15 + Math.sin(t + Math.PI) * 0.42, br: -0.15 + Math.sin(t) * 0.42,
        kfl: -0.35, kfr: -0.35, kbl: 0.35, kbr: 0.35,
        bob: -0.04 + Math.abs(Math.sin(t)) * 0.015, roll: Math.sin(t) * 0.09,
        bodyPitch: -0.08, spineYaw: Math.sin(t) * 0.08, airborneLift: 0,
        headPitch: 0.1, headYaw: Math.sin(t) * 0.24,
        tailYaw: 0, tailPitch: 0,
        sleep: false,
      };
    }

    // Birds & fallback
    const fl = Math.sin(t) * 0.48;
    const fr = Math.sin(t + Math.PI) * 0.48;
    const bl = Math.sin(t + Math.PI * 0.85) * 0.45;
    const br = Math.sin(t - Math.PI * 0.15) * 0.45;
    return {
      fl, fr, bl, br,
      kfl: -knee(t), kfr: -knee(t + Math.PI), kbl: knee(t + Math.PI * 0.85) * 0.8, kbr: knee(t - Math.PI * 0.15) * 0.8,
      bob: Math.abs(Math.sin(t)) * 0.035,
      roll: Math.sin(t) * 0.04,
      bodyPitch: 0, spineYaw: 0, airborneLift: 0,
      headPitch: 0.06 * Math.cos(t * 2),
      headYaw: Math.sin(t) * 0.05,
      tailYaw: Math.sin(t) * 0.32,
      wingFlap: Math.sin(t) * 1.05,
      sleep: false,
    };
  }

  if (clip === 'eat') {
    const t = (frame / 6) * Math.PI * 2;
    const munch = Math.sin(t) * 0.14;
    if (plan === 'monkey') {
      // Sit upright on haunches and bring hands to mouth
      return {
        fl: 0.95 + Math.sin(t) * 0.18, fr: 0.95 - Math.sin(t) * 0.12,
        bl: -1.15, br: -1.15,
        kfl: -1.25 - Math.sin(t) * 0.2, kfr: -1.25 + Math.sin(t) * 0.15,
        kbl: 1.45, kbr: 1.45,
        bob: -0.06, roll: 0, bodyPitch: -0.68, spineYaw: 0, airborneLift: 0,
        headPitch: 0.48 + munch, headYaw: Math.sin(t * 0.5) * 0.14,
        tailYaw: Math.sin(t) * 0.25, tailPitch: 0.5,
        sleep: false,
      };
    }
    if (plan === 'rabbit') {
      return {
        fl: 0.35, fr: 0.35, bl: 0.55, br: 0.55,
        kfl: -0.5, kfr: -0.5, kbl: 0.4, kbr: 0.4,
        bob: -0.04, roll: 0, bodyPitch: 0.15, spineYaw: 0, airborneLift: 0,
        headPitch: 0.52 + munch, headYaw: Math.sin(t * 0.5) * 0.15,
        tailYaw: 0, tailPitch: 0,
        sleep: false,
      };
    }
    if (plan === 'anteater') {
      return {
        fl: 0.22, fr: -0.1, bl: -0.08, br: 0.1,
        kfl: -0.15, kfr: 0, kbl: 0, kbr: 0,
        bob: -0.03, roll: 0, bodyPitch: 0.12, spineYaw: 0, airborneLift: 0,
        headPitch: 0.85 + Math.sin(t) * 0.18, headYaw: Math.sin(t * 0.5) * 0.22,
        tailYaw: Math.sin(t) * 0.18, tailPitch: 0.25,
        sleep: false,
      };
    }
    return {
      fl: 0.1, fr: -0.06, bl: -0.06, br: 0.08,
      kfl: -0.08, kfr: 0, kbl: 0, kbr: 0,
      bob: -0.02, roll: 0, bodyPitch: 0.04, spineYaw: 0, airborneLift: 0,
      headPitch: 0.85 + munch,
      headYaw: Math.sin(t * 0.5) * 0.14,
      tailYaw: Math.sin(t) * 0.25,
      tailPitch: plan === 'coati' ? 0.95 : 0,
      sleep: false,
    };
  }

  if (clip === 'sleep') {
    if (plan === 'armadillo') {
      return {
        fl: 1.4, fr: 1.4, bl: -1.4, br: -1.4,
        kfl: -2.2, kfr: -2.2, kbl: 2.2, kbr: 2.2,
        bob: -0.16, roll: 0, bodyPitch: 0.28, spineYaw: 0, airborneLift: 0,
        headPitch: 0.95, headYaw: 0.2, tailYaw: 0.55, tailPitch: -0.2,
        sleep: true,
      };
    }
    if (plan === 'jaguar' || plan === 'maned_wolf' || plan === 'monkey' || plan === 'sloth') {
      return {
        fl: 1.25, fr: 1.15, bl: -1.25, br: -1.15,
        kfl: -1.8, kfr: -1.7, kbl: 1.9, kbr: 1.8,
        bob: -0.22, roll: 0.08, bodyPitch: 0.05, spineYaw: 0.22, airborneLift: 0,
        headPitch: 0.42, headYaw: 0.52, tailYaw: 0.85, tailPitch: -0.1,
        sleep: true,
      };
    }
    return {
      fl: 1.4, fr: 1.4, bl: -1.35, br: -1.35,
      kfl: -2.2, kfr: -2.2, kbl: 2.1, kbr: 2.1,
      bob: -0.25, roll: 0.05, bodyPitch: 0, spineYaw: 0, airborneLift: 0,
      headPitch: 0.45, headYaw: 0.28, tailYaw: 0.3, tailPitch: 0,
      earPitch: plan === 'rabbit' ? -0.85 : 0,
      sleep: true,
    };
  }

  const t = (frame / 4) * Math.PI * 2;
  return {
    fl: 0, fr: 0, bl: 0, br: 0,
    kfl: 0, kfr: 0, kbl: 0, kbr: 0,
    bob: Math.sin(t) * 0.015,
    roll: 0,
    bodyPitch: plan === 'monkey' ? -0.24 : 0,
    spineYaw: 0, airborneLift: 0,
    headPitch: (plan === 'monkey' ? 0.16 : 0) + 0.04 * Math.sin(t),
    headYaw: Math.sin(t) * (plan === 'coati' || plan === 'monkey' ? 0.28 : 0.16),
    tailYaw: Math.sin(t) * 0.22,
    tailPitch: plan === 'coati' ? 1.1 : plan === 'monkey' ? 0.85 : 0,
    sleep: false,
  };
}

function buildQuadruped(spec, p) {
  const m = createMesh();
  const configs = {
    bovine: { rx: 0.27, ry: 0.26, bl: 1.16, lh: 0.52, lr: 0.065, nr: 0.14, nl: 0.34, hr: 0.17, hl: 0.36, sr: 0.1, sl: 0.18, horns: 'short', tail: 0.54 },
    ox: { rx: 0.31, ry: 0.29, bl: 1.24, lh: 0.54, lr: 0.072, nr: 0.16, nl: 0.36, hr: 0.19, hl: 0.38, sr: 0.11, sl: 0.2, horns: 'long', hump: true, dewlap: true, tail: 0.56 },
    equine: { rx: 0.22, ry: 0.24, bl: 1.22, lh: 0.74, lr: 0.052, nr: 0.12, nl: 0.5, hr: 0.14, hl: 0.42, sr: 0.08, sl: 0.24, mane: true, tail: 0.68 },
    pig: { rx: 0.25, ry: 0.21, bl: 0.82, lh: 0.24, lr: 0.052, nr: 0.16, nl: 0.16, hr: 0.16, hl: 0.26, sr: 0.095, sl: 0.14, ears: 'floppy', tail: 0.18 },
    sheep: { rx: 0.3, ry: 0.27, bl: 0.84, lh: 0.34, lr: 0.044, nr: 0.13, nl: 0.24, hr: 0.13, hl: 0.26, sr: 0.075, sl: 0.13, wool: true, tail: 0.18 },
    goat: { rx: 0.18, ry: 0.2, bl: 0.8, lh: 0.42, lr: 0.04, nr: 0.1, nl: 0.32, hr: 0.12, hl: 0.26, sr: 0.068, sl: 0.14, horns: 'back', beard: true, tail: 0.18 },
    capybara: { rx: 0.25, ry: 0.22, bl: 0.82, lh: 0.23, lr: 0.052, nr: 0.15, nl: 0.14, hr: 0.16, hl: 0.34, sr: 0.12, sl: 0.16, boxyHead: true, tail: 0.04 },
    tapir: { rx: 0.25, ry: 0.23, bl: 0.98, lh: 0.38, lr: 0.06, nr: 0.14, nl: 0.28, hr: 0.14, hl: 0.32, sr: 0.065, sl: 0.26, proboscis: true, mane: true, tail: 0.09 },
    deer: { rx: 0.17, ry: 0.19, bl: 0.9, lh: 0.6, lr: 0.038, nr: 0.085, nl: 0.44, hr: 0.11, hl: 0.28, sr: 0.055, sl: 0.15, antlers: true, tail: 0.18 },
    boar: { rx: 0.23, ry: 0.22, bl: 0.84, lh: 0.28, lr: 0.052, nr: 0.15, nl: 0.18, hr: 0.16, hl: 0.28, sr: 0.09, sl: 0.16, tusks: true, hump: true, tail: 0.22 },
    armadillo: { rx: 0.21, ry: 0.16, bl: 0.54, lh: 0.12, lr: 0.032, nr: 0.08, nl: 0.12, hr: 0.08, hl: 0.16, sr: 0.042, sl: 0.12, shell: true, tail: 0.3 },
    anteater: { rx: 0.2, ry: 0.2, bl: 0.9, lh: 0.34, lr: 0.058, nr: 0.1, nl: 0.28, hr: 0.08, hl: 0.26, sr: 0.035, sl: 0.36, hump: true, bushyTail: true, tail: 0.74 },
    jaguar: { rx: 0.21, ry: 0.2, bl: 1.08, lh: 0.46, lr: 0.056, nr: 0.12, nl: 0.24, hr: 0.15, hl: 0.26, sr: 0.085, sl: 0.13, ears: 'cat', slimWaist: true, tail: 0.74 },
    maned_wolf: { rx: 0.16, ry: 0.18, bl: 0.86, lh: 0.7, lr: 0.036, nr: 0.095, nl: 0.36, hr: 0.11, hl: 0.26, sr: 0.052, sl: 0.22, ears: 'tall', mane: true, slimWaist: true, tail: 0.46 },
    rabbit: { rx: 0.14, ry: 0.13, bl: 0.42, lh: 0.13, lr: 0.03, nr: 0.08, nl: 0.12, hr: 0.095, hl: 0.16, sr: 0.05, sl: 0.08, ears: 'rabbit', bigHind: true, tail: 0.08 },
    coati: { rx: 0.14, ry: 0.13, bl: 0.64, lh: 0.22, lr: 0.034, nr: 0.085, nl: 0.18, hr: 0.095, hl: 0.22, sr: 0.038, sl: 0.2, ears: 'cat', tail: 0.62 },
    iguana: { rx: 0.14, ry: 0.1, bl: 0.74, lh: 0.15, lr: 0.03, nr: 0.08, nl: 0.16, hr: 0.095, hl: 0.2, sr: 0.055, sl: 0.12, crest: true, dewlap: true, sprawling: true, tail: 0.82 },
  };
  const c = configs[spec.bodyPlan] || configs.bovine;
  const bodyY = (p.sleep ? c.ry * 0.95 : c.lh + c.ry * 0.85) + p.bob;
  const bp = p.bodyPitch || 0;
  const spineYaw = p.spineYaw || 0;

  // Spine rings with species-specific silhouette (narrow waist, carapace, heavy rump, S-wave, pitch)
  const zVals = [-0.5, -0.28, 0, 0.28, 0.48];
  const rxScales = c.shell ? [0.7, 1.05, 1.18, 1.02, 0.68] :
    c.slimWaist ? [0.64, 0.88, 0.86, 1.06, 0.68] :
    c.boxyHead ? [0.76, 1.05, 1.06, 0.96, 0.68] :
    [0.62, 0.96, c.wool ? 1.15 : 1.04, 0.96, 0.65];
  const ryScales = c.shell ? [0.68, 1.02, 1.14, 0.98, 0.66] :
    c.slimWaist ? [0.72, 0.92, 0.88, 1.04, 0.72] :
    [0.68, 0.96, c.wool ? 1.12 : 1.02, c.hump ? 1.08 : 0.98, 0.72];

  const torsoRings = zVals.map((zt, idx) => {
    const z = c.bl * zt;
    const xOff = Math.sin(spineYaw * (1.2 - idx * 0.5)) * c.bl * 0.14;
    const yOff = (idx === 3 && c.hump ? 0.08 : idx === 1 ? 0.02 : idx === 2 ? -0.01 : -0.015) - Math.sin(bp) * z;
    return {
      x: xOff,
      y: bodyY + yOff,
      z: z * Math.cos(bp),
      rx: c.rx * rxScales[idx],
      ry: c.ry * ryScales[idx],
      yaw: spineYaw * (0.6 - idx * 0.25),
    };
  });
  m.addLoft(torsoRings, 8);

  const lx = c.rx * 0.62;
  const fz = c.bl * 0.32 * Math.cos(bp), bz = -c.bl * 0.32 * Math.cos(bp);
  const fHipY = bodyY - c.ry * 0.55 - Math.sin(bp) * c.bl * 0.32;
  const bHipY = bodyY - c.ry * 0.55 + Math.sin(bp) * c.bl * 0.32;
  const uLen = c.lh * 0.52, lLen = c.lh * 0.48;
  const roll = c.sprawling ? 0.52 : 0;
  const hindScale = c.bigHind ? 1.38 : 1.0;

  m.addLimb(-lx, fHipY, fz, uLen, lLen, c.lr * 1.25, c.lr * 0.95, c.lr * 0.78, p.fl, p.kfl, -roll);
  m.addLimb(lx, fHipY, fz, uLen, lLen, c.lr * 1.25, c.lr * 0.95, c.lr * 0.78, p.fr, p.kfr, roll);
  m.addLimb(-lx, bHipY, bz, uLen * hindScale, lLen * hindScale, c.lr * 1.35 * (c.bigHind ? 1.25 : 1), c.lr * 0.95, c.lr * 0.78, p.bl, p.kbl, -roll);
  m.addLimb(lx, bHipY, bz, uLen * hindScale, lLen * hindScale, c.lr * 1.35 * (c.bigHind ? 1.25 : 1), c.lr * 0.95, c.lr * 0.78, p.br, p.kbr, roll);

  const pitch = p.headPitch * 0.88 + bp * 0.5, yaw = p.headYaw;
  const ny0 = torsoRings[4].y + c.ry * 0.35, nz0 = torsoRings[4].z - 0.04;
  const nx0 = torsoRings[4].x;
  const ny1 = ny0 + Math.cos(pitch) * c.nl * 0.55, nz1 = nz0 + Math.sin(pitch) * c.nl * 0.55 + Math.cos(pitch) * c.nl * 0.35;
  const hx = nx0 + Math.sin(yaw) * c.nl * 0.45;
  const hy = ny0 + Math.cos(pitch) * c.nl * 0.85 - Math.sin(pitch) * c.nl * 0.15;
  const hz = nz0 + Math.sin(pitch) * c.nl * 0.85 + Math.cos(pitch) * c.nl * 0.52;

  m.addLoft([
    { x: nx0, y: ny0, z: nz0, rx: c.nr * 1.1, ry: c.nr * 1.25, pitch: -0.4 + pitch * 0.4 },
    { x: nx0 + (hx - nx0) * 0.5, y: ny1, z: nz1, rx: c.nr * 0.88, ry: c.nr * 0.98, pitch: -0.3 + pitch * 0.6, yaw: yaw * 0.5 },
    { x: hx, y: hy, z: hz, rx: c.hr * 0.82, ry: c.hr * 0.85, pitch: pitch * 0.5, yaw },
  ], 8);

  if (c.mane) {
    m.addChain([
      { x: nx0, y: ny0 + c.nr * 0.95, z: nz0 - 0.04, rx: 0.035, ry: 0.06 },
      { x: nx0 + (hx - nx0) * 0.5, y: ny1 + c.nr * 0.85, z: nz1 - 0.04, rx: 0.032, ry: 0.06 },
      { x: hx, y: hy + c.hr * 0.72, z: hz - 0.05, rx: 0.025, ry: 0.045 },
    ], 6);
  }
  if (c.dewlap) {
    m.addChain([
      { x: nx0, y: ny0 - c.nr * 0.85, z: nz0 + 0.06, rx: 0.035, ry: 0.075 },
      { x: hx, y: hy - c.hr * 0.75, z: hz + 0.02, rx: 0.025, ry: 0.055 },
    ], 5);
  }
  if (c.crest) {
    for (let i = 0; i < 4; i++) {
      const f = i / 3;
      const cx = torsoRings[1 + Math.min(2, i)].x;
      const cy = torsoRings[1 + Math.min(2, i)].y + c.ry * 0.95;
      const cz = -c.bl * 0.2 + f * c.bl * 0.6;
      m.addChain([
        { x: cx, y: cy, z: cz, rx: 0.014, ry: 0.024 },
        { x: cx, y: cy + 0.06, z: cz - 0.02, rx: 0.005, ry: 0.008 },
      ], 4);
    }
  }

  const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
  const mz = hz + cosY * (c.hl * 0.55), mx = hx + sinY * (c.hl * 0.55), my = hy - c.hr * 0.15 - Math.sin(pitch) * c.hl * 0.25;
  const snoutDrop = c.proboscis || spec.bodyPlan === 'anteater' ? 0.65 : 0.4;
  const sz = mz + cosY * c.sl, sx = mx + sinY * c.sl, sy = my - Math.sin(pitch) * c.sl * snoutDrop - (c.proboscis ? 0.04 : 0);
  m.addLoft([
    { x: hx - sinY * c.hl * 0.25, y: hy + 0.02, z: hz - cosY * c.hl * 0.25, rx: c.hr * 0.85, ry: c.hr * 0.82, yaw },
    { x: hx + sinY * c.hl * 0.2, y: hy, z: hz + cosY * c.hl * 0.2, rx: c.hr, ry: c.hr * 0.95, yaw },
    { x: mx, y: my, z: mz, rx: c.sr * (c.boxyHead ? 1.25 : 1.15), ry: c.sr * (c.boxyHead ? 1.15 : 1.0), yaw },
    { x: sx, y: sy, z: sz, rx: c.sr * (c.boxyHead ? 0.95 : 0.72), ry: c.sr * (c.boxyHead ? 0.88 : 0.65), yaw },
  ], 8);

  if (c.beard) {
    m.addChain([
      { x: mx, y: my - c.sr * 0.8, z: mz, rx: 0.024, ry: 0.024 },
      { x: mx, y: my - c.sr * 0.8 - 0.08, z: mz + 0.01, rx: 0.008, ry: 0.008 },
    ], 5);
  }
  if (c.tusks) {
    for (const s of [-1, 1]) {
      m.addChain([
        { x: mx + s * c.sr * 0.75, y: my - 0.02, z: mz + 0.04, rx: 0.015, ry: 0.015 },
        { x: mx + s * c.sr * 1.15, y: my + 0.05, z: mz + 0.08, rx: 0.005, ry: 0.005 },
      ], 4);
    }
  }

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
    const eh = c.ears === 'rabbit' ? 0.24 : c.ears === 'tall' ? 0.16 : 0.09;
    const ep = p.earPitch || 0;
    for (const s of [-1, 1]) {
      m.addChain([
        { x: hx + s * c.hr * 0.65, y: hy + c.hr * 0.6, z: hz - 0.03, rx: 0.032, ry: 0.022 },
        { x: hx + s * c.hr * 0.85, y: hy + c.hr * 0.65 + eh * Math.cos(ep), z: hz - 0.06 + eh * Math.sin(ep), rx: 0.014, ry: 0.012 },
      ], 6);
    }
  }

  const ty0 = torsoRings[0].y + c.ry * 0.32, tz0 = torsoRings[0].z, tx0 = torsoRings[0].x;
  const tx1 = tx0 + Math.sin(p.tailYaw) * c.tail * 0.45;
  const tp = p.tailPitch || 0;
  const tw = c.bushyTail ? 0.13 : 0.038;
  m.addChain([
    { x: tx0, y: ty0, z: tz0, rx: tw, ry: tw },
    { x: tx0 + (tx1 - tx0) * 0.5, y: ty0 + c.tail * (Math.sin(tp) * 0.55 - 0.22 * Math.cos(tp)), z: tz0 - c.tail * 0.35 * Math.cos(tp * 0.5), rx: tw * (c.bushyTail ? 1.45 : 0.75), ry: tw * (c.bushyTail ? 1.45 : 0.75) },
    { x: tx1, y: ty0 + c.tail * (Math.sin(tp) * 0.95 - 0.45 * Math.cos(tp)), z: tz0 - c.tail * 0.62 * Math.cos(tp * 0.65), rx: tw * (c.bushyTail ? 0.7 : 0.4), ry: tw * (c.bushyTail ? 0.7 : 0.4) },
  ], 6);
  return m;
}

function buildBird(spec, p, clip) {
  const m = createMesh();
  const configs = {
    chicken: { rx: 0.14, ry: 0.13, bl: 0.34, lh: 0.18, nh: 0.14, hr: 0.07, bkL: 0.09 },
    duck: { rx: 0.14, ry: 0.11, bl: 0.4, lh: 0.14, nh: 0.16, hr: 0.07, bkL: 0.12 },
    heron: { rx: 0.12, ry: 0.12, bl: 0.42, lh: 0.48, nh: 0.38, hr: 0.06, bkL: 0.22 },
    toucan: { rx: 0.12, ry: 0.12, bl: 0.34, lh: 0.16, nh: 0.14, hr: 0.08, bkL: 0.24 },
    macaw: { rx: 0.12, ry: 0.12, bl: 0.38, lh: 0.16, nh: 0.14, hr: 0.08, bkL: 0.11, longTail: true },
    rhea: { rx: 0.22, ry: 0.2, bl: 0.66, lh: 0.68, nh: 0.48, hr: 0.085, bkL: 0.14 },
    songbird: { rx: 0.09, ry: 0.09, bl: 0.22, lh: 0.1, nh: 0.08, hr: 0.055, bkL: 0.07 },
    hummingbird: { rx: 0.065, ry: 0.065, bl: 0.16, lh: 0.05, nh: 0.06, hr: 0.042, bkL: 0.14, longTail: true },
    parrot: { rx: 0.11, ry: 0.11, bl: 0.3, lh: 0.12, nh: 0.1, hr: 0.075, bkL: 0.09, longTail: true },
    owl: { rx: 0.14, ry: 0.15, bl: 0.28, lh: 0.14, nh: 0.06, hr: 0.11, bkL: 0.06 },
    raptor: { rx: 0.15, ry: 0.14, bl: 0.42, lh: 0.22, nh: 0.14, hr: 0.08, bkL: 0.11, longTail: true },
    woodpecker: { rx: 0.1, ry: 0.1, bl: 0.28, lh: 0.12, nh: 0.12, hr: 0.065, bkL: 0.14 },
    kingfisher: { rx: 0.11, ry: 0.1, bl: 0.28, lh: 0.1, nh: 0.1, hr: 0.075, bkL: 0.16 },
    spoonbill: { rx: 0.13, ry: 0.12, bl: 0.42, lh: 0.46, nh: 0.36, hr: 0.06, bkL: 0.24 },
    swallow: { rx: 0.08, ry: 0.075, bl: 0.22, lh: 0.07, nh: 0.06, hr: 0.05, bkL: 0.05, longTail: true },
  };
  const c = configs[spec.bodyPlan] || configs.chicken;
  const bodyY = (p.sleep ? c.ry * 0.95 : c.lh + c.ry * 0.85) + p.bob;

  m.addLoft([
    { x: 0, y: bodyY + 0.02, z: -c.bl * 0.5, rx: c.rx * 0.45, ry: c.ry * 0.45 },
    { x: 0, y: bodyY, z: 0, rx: c.rx * 1.15, ry: c.ry * 1.05 },
    { x: 0, y: bodyY + 0.03, z: c.bl * 0.46, rx: c.rx * 0.65, ry: c.ry * 0.7 },
  ], 8);

  const flapping = clip === 'walk' && spec.canFly;
  const lx = c.rx * 0.48, hipY = bodyY - c.ry * 0.65;
  const legPitchL = flapping ? 0.85 : p.fl, legPitchR = flapping ? 0.85 : p.fr;
  const kneePitchL = flapping ? -0.45 : p.kfl, kneePitchR = flapping ? -0.45 : p.kfr;
  m.addLimb(-lx, hipY, 0, c.lh * 0.5, c.lh * 0.5, 0.028, 0.022, 0.02, legPitchL, kneePitchL);
  m.addLimb(lx, hipY, 0, c.lh * 0.5, c.lh * 0.5, 0.028, 0.022, 0.02, legPitchR, kneePitchR);

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

  // Sculpted wings: wide and flapping in walk/flight for flying birds, folded otherwise
  const span = flapping ? c.rx * 3.8 : c.rx * 0.55;
  const flap = flapping ? (p.wingFlap || 0) : -0.35;
  for (const s of [-1, 1]) {
    const wx0 = s * c.rx * 0.85, wy0 = bodyY + c.ry * 0.25;
    const wx1 = wx0 + s * Math.cos(flap * 0.6) * span * 0.5, wy1 = wy0 + Math.sin(flap) * span * 0.55;
    const wx2 = wx0 + s * Math.cos(flap * 0.85) * span, wy2 = wy0 + Math.sin(flap * 1.15) * span * 0.95;
    m.addChain([
      { x: wx0, y: wy0, z: c.bl * 0.12, rx: 0.025, ry: c.bl * 0.34, yaw: s * 0.2 },
      { x: wx1, y: wy1, z: c.bl * 0.02, rx: 0.02, ry: c.bl * 0.28, yaw: s * 0.3 },
      { x: wx2, y: wy2, z: -c.bl * 0.15, rx: 0.01, ry: c.bl * 0.14, yaw: s * 0.35 },
    ], 5);
  }
  return m;
}

function buildReptile(p) {
  const m = createMesh();
  const bodyY = (p.sleep ? 0.13 : 0.18) + p.bob * 0.4;
  const sy = p.spineYaw || 0;
  m.addLoft([
    { x: Math.sin(sy) * 0.08, y: bodyY, z: -0.48, rx: 0.14, ry: 0.09, yaw: sy },
    { x: -Math.sin(sy) * 0.04, y: bodyY + 0.02, z: 0, rx: 0.24, ry: 0.12, yaw: -sy * 0.3 },
    { x: Math.sin(sy) * 0.05, y: bodyY + 0.02, z: 0.45, rx: 0.17, ry: 0.11, yaw: sy * 0.5 },
    { x: Math.sin(p.headYaw) * 0.06, y: bodyY + 0.01, z: 0.72, rx: 0.13, ry: 0.08, yaw: p.headYaw },
    { x: Math.sin(p.headYaw) * 0.14, y: bodyY, z: 1.05, rx: 0.075, ry: 0.05, yaw: p.headYaw },
  ], 8);
  // Dorsal armored scutes
  for (let i = 0; i < 4; i++) {
    const z = -0.3 + i * 0.22;
    m.addChain([
      { x: 0, y: bodyY + 0.11, z, rx: 0.025, ry: 0.02 },
      { x: 0, y: bodyY + 0.15, z: z - 0.02, rx: 0.008, ry: 0.008 },
    ], 4);
  }
  const lx = 0.22;
  m.addLimb(-lx, bodyY, 0.28, 0.11, 0.1, 0.05, 0.04, 0.035, p.fl, p.kfl, -0.42);
  m.addLimb(lx, bodyY, 0.28, 0.11, 0.1, 0.05, 0.04, 0.035, p.fr, p.kfr, 0.42);
  m.addLimb(-lx, bodyY, -0.28, 0.11, 0.1, 0.05, 0.04, 0.035, p.bl, p.kbl, -0.42);
  m.addLimb(lx, bodyY, -0.28, 0.11, 0.1, 0.05, 0.04, 0.035, p.br, p.kbr, 0.42);
  m.addChain([
    { x: Math.sin(sy) * 0.08, y: bodyY, z: -0.46, rx: 0.13, ry: 0.08 },
    { x: Math.sin(p.tailYaw) * 0.22, y: bodyY - 0.02, z: -0.85, rx: 0.08, ry: 0.055 },
    { x: Math.sin(p.tailYaw) * 0.48, y: bodyY - 0.04, z: -1.25, rx: 0.025, ry: 0.025 },
  ], 6);
  return m;
}

function buildPrimate(spec, p) {
  const m = createMesh();
  const isSloth = spec.bodyPlan === 'sloth';
  const lh = isSloth ? 0.24 : 0.34, bodyY = (p.sleep ? 0.16 : lh + 0.16) + p.bob;
  const bp = p.bodyPitch || 0;
  const sy = p.spineYaw || 0;

  const rRear = { x: Math.sin(sy) * 0.03, y: bodyY + Math.sin(bp) * 0.26, z: -0.24 * Math.cos(bp), rx: 0.12, ry: 0.13 };
  const rMid = { x: 0, y: bodyY + 0.02, z: 0, rx: isSloth ? 0.17 : 0.14, ry: isSloth ? 0.16 : 0.14 };
  const rChest = { x: -Math.sin(sy) * 0.03, y: bodyY + 0.05 - Math.sin(bp) * 0.26, z: 0.24 * Math.cos(bp), rx: 0.13, ry: 0.14 };
  m.addLoft([rRear, rMid, rChest], 8);

  const lx = 0.14;
  const armLen = isSloth ? lh * 1.3 : lh * 1.08;
  const armRoll = isSloth ? 0.35 : 0.06;
  m.addLimb(-lx, rChest.y - 0.06, rChest.z - 0.04, armLen * 0.5, armLen * 0.5, 0.042, 0.034, 0.028, p.fl, p.kfl, -armRoll);
  m.addLimb(lx, rChest.y - 0.06, rChest.z - 0.04, armLen * 0.5, armLen * 0.5, 0.042, 0.034, 0.028, p.fr, p.kfr, armRoll);
  m.addLimb(-lx, rRear.y - 0.04, rRear.z + 0.04, lh * 0.5, lh * 0.5, 0.048, 0.036, 0.03, p.bl, p.kbl, -armRoll * 0.5);
  m.addLimb(lx, rRear.y - 0.04, rRear.z + 0.04, lh * 0.5, lh * 0.5, 0.048, 0.036, 0.03, p.br, p.kbr, armRoll * 0.5);

  const headR = spec.id === 'mico_leao' ? 0.13 : 0.105;
  const hx = Math.sin(p.headYaw) * 0.06, hy = rChest.y + 0.14, hz = rChest.z + 0.1;
  m.addLoft([
    { x: rChest.x, y: rChest.y + 0.06, z: rChest.z, rx: 0.075, ry: 0.075 },
    { x: hx, y: hy, z: hz, rx: headR, ry: headR },
  ], 8);

  if (!isSloth) {
    // Round monkey ears / tuft
    for (const s of [-1, 1]) {
      m.addChain([
        { x: hx + s * headR * 0.85, y: hy + 0.02, z: hz - 0.02, rx: 0.025, ry: 0.028 },
        { x: hx + s * (headR + 0.035), y: hy + 0.04, z: hz - 0.03, rx: 0.012, ry: 0.015 },
      ], 5);
    }
    const tp = p.tailPitch || 0.8;
    m.addChain([
      { x: rRear.x, y: rRear.y + 0.04, z: rRear.z, rx: 0.032, ry: 0.032 },
      { x: Math.sin(p.tailYaw) * 0.12, y: rRear.y + 0.24 * Math.sin(tp), z: rRear.z - 0.22, rx: 0.024, ry: 0.024 },
      { x: Math.sin(p.tailYaw) * 0.22, y: rRear.y + 0.36 * Math.sin(tp) + 0.06, z: rRear.z - 0.34, rx: 0.016, ry: 0.016 },
    ], 6);
  }
  return m;
}

function buildFish(spec, p, clip) {
  const m = createMesh();
  const deep = spec.id === 'tilapia' || spec.id === 'pacu';
  const bodyRy = deep ? 0.24 : 0.16;
  const bodyRx = deep ? 0.11 : 0.10;
  const swim = clip === 'walk' ? 0.16 : clip === 'sleep' ? 0.02 : 0.06;
  const phase = p.tailYaw || 0;
  const bob = (p.bodyBob || 0) * 0.4;
  const pitch = (p.headPitch || 0) * 0.25;

  // Fuselage body from snout (+Z) to peduncle (-Z)
  m.addLoft([
    { x: Math.sin(phase) * swim * 0.15, y: 0.26 + bob - pitch * 0.1, z: 0.46, rx: 0.032, ry: 0.038 },
    { x: Math.sin(phase) * swim * 0.05, y: 0.27 + bob, z: 0.34, rx: bodyRx * 0.72, ry: bodyRy * 0.74 },
    { x: 0, y: 0.28 + bob, z: 0.14, rx: bodyRx, ry: bodyRy },
    { x: Math.sin(phase) * swim * 0.35, y: 0.27 + bob, z: -0.08, rx: bodyRx * 0.88, ry: bodyRy * 0.88 },
    { x: Math.sin(phase) * swim * 0.85, y: 0.26 + bob, z: -0.28, rx: bodyRx * 0.45, ry: bodyRy * 0.48 },
    { x: Math.sin(phase) * swim * 1.35, y: 0.26 + bob, z: -0.42, rx: 0.022, ry: 0.055 },
  ], 8);

  // Forked caudal tail fin
  const tx = Math.sin(phase) * swim * 1.35;
  const tailTipX = Math.sin(phase + 0.5) * swim * 2.15;
  m.addLoft([
    { x: tx, y: 0.26 + bob, z: -0.40, rx: 0.018, ry: 0.05 },
    { x: tailTipX, y: 0.36 + bob, z: -0.58, rx: 0.010, ry: 0.085, yaw: phase * 0.5 },
  ], 6);
  m.addLoft([
    { x: tx, y: 0.26 + bob, z: -0.40, rx: 0.018, ry: 0.05 },
    { x: tailTipX, y: 0.16 + bob, z: -0.58, rx: 0.010, ry: 0.080, yaw: phase * 0.5 },
  ], 6);

  // Dorsal fin
  m.addLoft([
    { x: 0, y: 0.28 + bodyRy * 0.85 + bob, z: 0.12, rx: 0.012, ry: 0.035 },
    { x: Math.sin(phase) * swim * 0.3, y: 0.28 + bodyRy + 0.11 + bob, z: -0.04, rx: 0.008, ry: 0.055 },
    { x: Math.sin(phase) * swim * 0.65, y: 0.28 + bodyRy * 0.72 + bob, z: -0.20, rx: 0.008, ry: 0.028 },
  ], 4);

  // Pectoral fins
  for (const side of [-1, 1]) {
    m.addLoft([
      { x: side * bodyRx * 0.85, y: 0.21 + bob, z: 0.18, rx: 0.012, ry: 0.022 },
      { x: side * (bodyRx + 0.12), y: 0.17 + bob, z: 0.05 + Math.sin(phase) * 0.03 * side, rx: 0.008, ry: 0.042 },
    ], 4);
  }

  return m;
}

function buildAnimalMesh(spec, clip, frame) {
  const p = frameParams(clip, frame, spec);
  if (spec.bodyPlan === 'fish') return { mesh: buildFish(spec, p, clip), airborneLift: 0 };
  if (['chicken', 'duck', 'heron', 'toucan', 'macaw', 'rhea', 'songbird', 'hummingbird', 'parrot', 'owl', 'raptor', 'woodpecker', 'kingfisher', 'spoonbill', 'swallow'].includes(spec.bodyPlan)) {
    return { mesh: buildBird(spec, p, clip), airborneLift: 0 };
  }
  if (spec.bodyPlan === 'caiman') return { mesh: buildReptile(p), airborneLift: 0 };
  if (spec.bodyPlan === 'sloth' || spec.bodyPlan === 'monkey') return { mesh: buildPrimate(spec, p), airborneLift: p.airborneLift || 0 };
  return { mesh: buildQuadruped(spec, p), airborneLift: p.airborneLift || 0 };
}

let generated = 0;
for (const [id, spec] of Object.entries(ANIMAL_SPECIES)) {
  for (const [clip, frames] of Object.entries(ANIMAL_CLIPS)) {
    const dir = path.join('data', 'animals', id, clip);
    fs.mkdirSync(dir, { recursive: true });
    for (const frame of frames) {
      const { mesh, airborneLift } = buildAnimalMesh(spec, clip, frame);
      fs.writeFileSync(path.join(dir, `${frame}.obj`), mesh.toOBJ(`${id}_${clip}_${frame}`, airborneLift), 'utf8');
      generated++;
    }
  }
}
console.log(`Generated ${generated} sculpted low-poly animal OBJ frames across ${Object.keys(ANIMAL_SPECIES).length} species.`);
