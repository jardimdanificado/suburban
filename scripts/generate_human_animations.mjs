import fs from 'node:fs';
import path from 'node:path';
import { parseCitizenOBJ } from '../js/city_citizen_models.js';
import { CITIZEN_BODY_FACE_COUNT } from '../js/city_garment_faces.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const MIRROR = 123;
const FOOT = [0, ...range(35, 43)];
const SHIN = range(54, 61);
const KNEE = range(44, 47);
const THIGH = range(1, 8);
const HAND = range(82, 93);
const FOREARM = range(66, 73);
const ELBOW = range(94, 97);
const UPPERARM = range(74, 81);
const SHOULDER = range(98, 104);
const HEAD_NECK = [...range(11, 34), 121];
const PELVIS = [...range(48, 53), ...range(62, 65)];
const CHEST = [9, 10, ...range(105, 120), 122];

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const mean = pts => mul(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / (pts.length || 1));

// Rotate point p around pivot using Euler XYZ (pitch X, yaw Y, roll Z)
function rotateEuler(p, pivot, [rx = 0, ry = 0, rz = 0], weight = 1) {
  if (!weight || (!rx && !ry && !rz)) return p;
  const ax = rx * weight, ay = ry * weight, az = rz * weight;
  let [x, y, z] = sub(p, pivot);
  if (ax) {
    const c = Math.cos(ax), s = Math.sin(ax);
    [y, z] = [y * c - z * s, y * s + z * c];
  }
  if (ay) {
    const c = Math.cos(ay), s = Math.sin(ay);
    [x, z] = [x * c + z * s, -x * s + z * c];
  }
  if (az) {
    const c = Math.cos(az), s = Math.sin(az);
    [x, y] = [x * c - y * s, x * s + y * c];
  }
  return add([x, y, z], pivot);
}

function loadBindPose() {
  const text = fs.readFileSync(path.join('data', 'model', 'idle', '0.obj'), 'utf8');
  const data = parseCitizenOBJ(text);
  if (data.triangles !== CITIZEN_BODY_FACE_COUNT) throw Error('Unexpected idle/0.obj triangle count');
  const verts = new Map();
  const faceVertKeys = [];
  for (let f = 0; f < CITIZEN_BODY_FACE_COUNT; f++) {
    const fk = [];
    for (let c = 0; c < 3; c++) {
      const i = f * 9 + c * 3;
      const p = [data.positions[i], data.positions[i + 1], data.positions[i + 2]];
      const k = p.join(',');
      if (!verts.has(k)) verts.set(k, p);
      fk.push(k);
    }
    faceVertKeys.push(fk);
  }
  const vertsOf = (ids, off = 0) => {
    const s = new Set();
    for (const id of ids) for (const k of faceVertKeys[id + off]) s.add(k);
    return s;
  };
  const intersect = (a, b) => [...a].filter(x => b.has(x));
  const centerOf = keys => mean(keys.map(k => verts.get(k)));

  const side = off => {
    const footV = vertsOf(FOOT, off), shinV = vertsOf(SHIN, off), kneeV = vertsOf(KNEE, off), thighV = vertsOf(THIGH, off);
    const handV = vertsOf(HAND, off), forearmV = vertsOf(FOREARM, off), elbowV = vertsOf(ELBOW, off), upperArmV = vertsOf(UPPERARM, off), shoulderV = vertsOf(SHOULDER, off);
    const pelvisV = vertsOf(PELVIS, off), chestV = vertsOf(CHEST, off);
    const hipRing = new Set(intersect(thighV, pelvisV));
    const upperKneeRing = new Set(intersect(thighV, kneeV));
    const lowerKneeRing = new Set(intersect(shinV, kneeV));
    const ankleRing = new Set(intersect(shinV, footV));
    const shoulderRing = new Set(intersect(upperArmV, shoulderV));
    const upperElbowRing = new Set(intersect(upperArmV, elbowV));
    const lowerElbowRing = new Set(intersect(forearmV, elbowV));
    const wristRing = new Set(intersect(forearmV, handV));
    return {
      footV, shinV, kneeV, thighV, handV, forearmV, elbowV, upperArmV, shoulderV,
      hipRing, upperKneeRing, lowerKneeRing, ankleRing,
      shoulderRing, upperElbowRing, lowerElbowRing, wristRing,
      hipCenter: centerOf([...hipRing]),
      kneeCenter: mul(add(centerOf([...upperKneeRing]), centerOf([...lowerKneeRing])), 0.5),
      ankleCenter: centerOf([...ankleRing]),
      shoulderCenter: centerOf([...shoulderRing]),
      elbowCenter: mul(add(centerOf([...upperElbowRing]), centerOf([...lowerElbowRing])), 0.5),
      wristCenter: centerOf([...wristRing]),
      pelvisV, chestV,
    };
  };

  const L = side(0), R = side(MIRROR);
  const allPelvisV = new Set([...L.pelvisV, ...R.pelvisV]);
  const allChestV = new Set([...L.chestV, ...R.chestV, ...L.shoulderV, ...R.shoulderV]);
  const allHeadV = new Set([...vertsOf(HEAD_NECK, 0), ...vertsOf(HEAD_NECK, MIRROR)]);
  const waistRing = new Set(intersect(allPelvisV, allChestV));
  const neckRing = new Set(intersect(allHeadV, allChestV));

  return {
    verts,
    faceVertKeys,
    L,
    R,
    allPelvisV,
    allChestV,
    allHeadV,
    waistRing,
    neckRing,
    pelvisCenter: mul(add(L.hipCenter, R.hipCenter), 0.5),
    waistCenter: centerOf([...waistRing]),
    neckCenter: centerOf([...neckRing]),
  };
}

function poseVertices(bind, pose) {
  const {
    pelvisOffset = [0, 0, 0],
    pelvisRot = [0, 0, 0],
    spineRot = [0, 0, 0],
    headRot = [0, 0, 0],
    armL = [0, 0, 0],
    armR = [0, 0, 0],
    elbowL = [0, 0, 0],
    elbowR = [0, 0, 0],
    wristL = [0, 0, 0],
    wristR = [0, 0, 0],
    legL = [0, 0, 0],
    legR = [0, 0, 0],
    kneeL = [0, 0, 0],
    kneeR = [0, 0, 0],
    ankleL = [0, 0, 0],
    ankleR = [0, 0, 0],
    ground = true,
  } = pose;

  const out = new Map();
  for (const [k, p0] of bind.verts) {
    let p = p0;

    // 1. Distal limb rotations in local rest space before parent rotations
    for (const [S, armRot, elRot, wrRot, legRot, knRot, anRot] of [
      [bind.L, armL, elbowL, wristL, legL, kneeL, ankleL],
      [bind.R, armR, elbowR, wristR, legR, kneeR, ankleR],
    ]) {
      const inArm = S.upperArmV.has(k) || S.elbowV.has(k) || S.forearmV.has(k) || S.handV.has(k);
      const inLeg = S.thighV.has(k) || S.kneeV.has(k) || S.shinV.has(k) || S.footV.has(k);
      if (inArm) {
        if (S.handV.has(k) && !S.wristRing.has(k)) {
          p = rotateEuler(p, S.wristCenter, wrRot, 1);
        }
        if (S.forearmV.has(k) || S.handV.has(k)) {
          p = rotateEuler(p, S.elbowCenter, elRot, 1);
        } else if (S.elbowV.has(k) && !S.upperElbowRing.has(k)) {
          p = rotateEuler(p, S.elbowCenter, elRot, 0.5);
        }
        const armW = S.shoulderRing.has(k) ? 0.65 : 1;
        p = rotateEuler(p, S.shoulderCenter, armRot, armW);
      } else if (S.shoulderV.has(k) && !bind.allPelvisV.has(k) && !bind.neckRing.has(k)) {
        // Soft shoulder follow for non-torso shoulder vertices
        const chestOnly = bind.L.chestV.has(k) || bind.R.chestV.has(k);
        if (!chestOnly) p = rotateEuler(p, S.shoulderCenter, armRot, 0.35);
      }

      if (inLeg) {
        if (S.footV.has(k) && !S.ankleRing.has(k)) {
          p = rotateEuler(p, S.ankleCenter, anRot, 1);
        }
        if (S.shinV.has(k) || S.footV.has(k)) {
          p = rotateEuler(p, S.kneeCenter, knRot, 1);
        } else if (S.kneeV.has(k) && !S.upperKneeRing.has(k)) {
          p = rotateEuler(p, S.kneeCenter, knRot, 0.5);
        }
        const legW = S.hipRing.has(k) ? 0.25 : 1;
        p = rotateEuler(p, S.hipCenter, legRot, legW);
      }
    }

    // 2. Head & neck rotation
    if (bind.allHeadV.has(k)) {
      const headW = bind.neckRing.has(k) ? 0.45 : 1;
      p = rotateEuler(p, bind.neckCenter, headRot, headW);
    }

    // 3. Spine / torso rotation (upper body + arms + head)
    const isUpper = bind.allChestV.has(k) || bind.allHeadV.has(k) ||
      bind.L.upperArmV.has(k) || bind.L.elbowV.has(k) || bind.L.forearmV.has(k) || bind.L.handV.has(k) ||
      bind.R.upperArmV.has(k) || bind.R.elbowV.has(k) || bind.R.forearmV.has(k) || bind.R.handV.has(k);
    if (isUpper) {
      const spineW = bind.waistRing.has(k) ? 0.5 : 1;
      p = rotateEuler(p, bind.waistCenter, spineRot, spineW);
    }

    // 4. Pelvis (root) rotation & translation
    p = rotateEuler(p, bind.pelvisCenter, pelvisRot, 1);
    p = add(p, pelvisOffset);
    out.set(k, p);
  }

  if (ground) {
    let minY = Infinity;
    for (const p of out.values()) if (p[1] < minY) minY = p[1];
    const dy = -minY;
    for (const [k, p] of out) out.set(k, [p[0], p[1] + dy, p[2]]);
  }
  return out;
}

function writeOBJ(filePath, name, bind, posed) {
  const uniqueVerts = [];
  const vertIndex = new Map();
  for (const k of bind.verts.keys()) {
    uniqueVerts.push(posed.get(k));
    vertIndex.set(k, uniqueVerts.length);
  }
  const lines = [`o ${name}`];
  for (const [x, y, z] of uniqueVerts) {
    lines.push(`v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`);
  }
  for (const fk of bind.faceVertKeys) {
    const a = vertIndex.get(fk[0]), b = vertIndex.get(fk[1]), c = vertIndex.get(fk[2]);
    lines.push(`f ${a} ${b} ${c}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

// Note: in idle/0.obj, +X is right side (or left), -Z is back, +Z is front, +Y is up.
// Positive X rotation pitches forward/up depending on limb:
// For hanging arms: -rx swings arm forward (+Z), +rx swings arm backward (-Z);
// for left arm (x < 0): -rz raises arm outward (-X), +rz tucks inward;
// for right arm (x > 0): +rz raises arm outward (+X), -rz tucks inward.
function rotateFromTo(p, pivot, fromDir, toDir, weight = 1) {
  const fl = Math.hypot(...fromDir) || 1, tl = Math.hypot(...toDir) || 1;
  const a = [fromDir[0] / fl, fromDir[1] / fl, fromDir[2] / fl];
  const b = [toDir[0] / tl, toDir[1] / tl, toDir[2] / tl];
  const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const angle = Math.acos(d) * weight;
  if (angle < 1e-6) return p;
  let ax = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  let al = Math.hypot(...ax);
  if (al < 1e-6) ax = [1, 0, 0], al = 1;
  const k = [ax[0] / al, ax[1] / al, ax[2] / al];
  const v = sub(p, pivot), cos = Math.cos(angle), sin = Math.sin(angle);
  const kdotv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const kcrossv = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return add(pivot, [
    v[0] * cos + kcrossv[0] * sin + k[0] * kdotv * (1 - cos),
    v[1] * cos + kcrossv[1] * sin + k[1] * kdotv * (1 - cos),
    v[2] * cos + kcrossv[2] * sin + k[2] * kdotv * (1 - cos),
  ]);
}

function buildCarryFromRun(frame) {
  const data = parseCitizenOBJ(fs.readFileSync(path.join('data', 'model', 'run', `${frame}.obj`), 'utf8'));
  const runVerts = new Map();
  const runFaceKeys = [];
  for (let f = 0; f < CITIZEN_BODY_FACE_COUNT; f++) {
    const fk = [];
    for (let c = 0; c < 3; c++) {
      const i = f * 9 + c * 3;
      const p = [data.positions[i], data.positions[i + 1], data.positions[i + 2]];
      const k = p.join(',');
      if (!runVerts.has(k)) runVerts.set(k, p);
      fk.push(k);
    }
    runFaceKeys.push(fk);
  }
  const vertsOf = (ids, off = 0) => {
    const s = new Set();
    for (const id of ids) for (const k of runFaceKeys[id + off]) s.add(k);
    return s;
  };
  const intersect = (a, b) => [...a].filter(x => b.has(x));
  const centerOf = (keys) => mean([...keys].map(k => runVerts.get(k)));

  for (const [off, sideSign] of [[0, -1], [MIRROR, 1]]) {
    const upper = vertsOf(UPPERARM, off), shoulderV = vertsOf(SHOULDER, off);
    const elbow = vertsOf(ELBOW, off), forearm = vertsOf(FOREARM, off), hand = vertsOf(HAND, off);
    const shoulderRing = new Set(intersect(upper, shoulderV));
    const upperElbowRing = new Set(intersect(upper, elbow));
    const lowerElbowRing = new Set(intersect(forearm, elbow));
    const wristRing = new Set(intersect(forearm, hand));

    const shC = centerOf(shoulderRing);
    const elC = mul(add(centerOf(upperElbowRing), centerOf(lowerElbowRing)), 0.5);
    const wrC = centerOf(wristRing);

    const curUpperDir = sub(elC, shC);
    const targetUpperDir = [-sideSign * 0.08, -0.85, 0.52];
    const armKeys = new Set([...upper, ...elbow, ...forearm, ...hand]);

    for (const rk of armKeys) {
      if (shoulderRing.has(rk)) continue;
      runVerts.set(rk, rotateFromTo(runVerts.get(rk), shC, curUpperDir, targetUpperDir, 1));
    }

    const newElC = mul(add(centerOf(upperElbowRing), centerOf(lowerElbowRing)), 0.5);
    const newWrC = centerOf(wristRing);
    const curForearmDir = sub(newWrC, newElC);
    const targetForearmDir = [sideSign * -0.22, 0.22, 0.95];

    for (const rk of new Set([...elbow, ...forearm, ...hand])) {
      if (upperElbowRing.has(rk)) continue;
      const w = forearm.has(rk) || hand.has(rk) ? 1 : 0.5;
      runVerts.set(rk, rotateFromTo(runVerts.get(rk), newElC, curForearmDir, targetForearmDir, w));
    }
  }
  return { verts: runVerts, faceVertKeys: runFaceKeys };
}

const CLIPS = {
  acenar: [0, 1, 2, 3].map(f => {
    const s = Math.sin((f / 4) * Math.PI * 2);
    return {
      spineRot: [0, 0, -0.05 + s * 0.04],
      headRot: [0.04, -0.1, s * 0.08],
      armL: [0.1, 0, -0.12],
      elbowL: [-0.25, 0, 0],
      armR: [-0.35, 0, 2.35 + s * 0.28],
      elbowR: [-0.35, 0, -0.35 + s * 0.35],
      wristR: [0, 0, s * 0.2],
    };
  }),
  comemorar: [0, 1, 2, 3].map(f => {
    const t = (f / 4) * Math.PI * 2;
    const bounce = Math.abs(Math.sin(t));
    return {
      pelvisOffset: [0, bounce * 0.14, 0],
      spineRot: [-0.08, 0, Math.sin(t) * 0.05],
      headRot: [-0.15 - bounce * 0.08, 0, 0],
      armL: [-0.45, 0, -2.45 - bounce * 0.35],
      armR: [-0.45, 0, 2.45 + bounce * 0.35],
      elbowL: [-0.4, 0, 0.3],
      elbowR: [-0.4, 0, -0.3],
      legL: [-bounce * 0.22, 0, -0.08],
      legR: [-bounce * 0.22, 0, 0.08],
      kneeL: [bounce * 0.42, 0, 0],
      kneeR: [bounce * 0.42, 0, 0],
    };
  }),
  conversar: [0, 1, 2, 3].map(f => {
    const t = (f / 4) * Math.PI * 2;
    const s = Math.sin(t), c = Math.cos(t);
    return {
      spineRot: [0.04, s * 0.1, c * 0.03],
      headRot: [0.06 * c, s * 0.16, c * 0.06],
      armL: [-0.42 - s * 0.22, 0.2, -0.18 - Math.max(0, s) * 0.18],
      elbowL: [-1.05 - c * 0.25, 0, 0],
      armR: [-0.42 + s * 0.22, -0.2, 0.18 + Math.max(0, -s) * 0.18],
      elbowR: [-1.05 + c * 0.25, 0, 0],
    };
  }),
  varrer: [0, 1, 2, 3].map(f => {
    const s = Math.sin((f / 4) * Math.PI * 2);
    return {
      spineRot: [0.28, s * 0.24, 0],
      headRot: [0.18, s * 0.12, 0],
      armL: [-0.75 + s * 0.18, 0.25 + s * 0.18, -0.1],
      elbowL: [-0.7, 0, 0],
      armR: [-0.55 - s * 0.18, -0.2 + s * 0.18, 0.1],
      elbowR: [-0.95, 0, 0],
      legL: [-0.12, 0, -0.06],
      legR: [0.08, 0, 0.06],
      kneeL: [0.18, 0, 0],
      kneeR: [0.1, 0, 0],
    };
  }),
  cavar: [0, 1, 2, 3].map(f => {
    const t = (f / 4) * Math.PI * 2;
    const thrust = Math.sin(t);
    return {
      spineRot: [0.35 + thrust * 0.2, thrust * 0.08, 0],
      headRot: [0.2 + thrust * 0.1, 0, 0],
      armL: [-0.85 - thrust * 0.35, 0.18, -0.08],
      elbowL: [-0.6 + thrust * 0.25, 0, 0],
      armR: [-0.75 - thrust * 0.35, -0.18, 0.08],
      elbowR: [-0.75 + thrust * 0.25, 0, 0],
      legL: [-0.28 - thrust * 0.12, 0, -0.08],
      legR: [0.18, 0, 0.08],
      kneeL: [0.45 + thrust * 0.15, 0, 0],
      kneeR: [0.2, 0, 0],
    };
  }),
  nadar: [0, 1, 2, 3].map(f => {
    const t = (f / 4) * Math.PI * 2;
    const s = Math.sin(t), c = Math.cos(t);
    // Horizontal prone crawl stroke
    return {
      pelvisOffset: [0, -0.78, 0],
      pelvisRot: [1.45, 0, s * 0.16],
      spineRot: [-0.08, s * 0.14, 0],
      headRot: [-0.85, s * 0.12, 0],
      armL: [-1.45 - s * 1.15, 0, -0.35 - Math.max(0, s) * 0.3],
      elbowL: [-0.35 - Math.max(0, -s) * 0.55, 0, 0],
      armR: [-1.45 + s * 1.15, 0, 0.35 + Math.max(0, -s) * 0.3],
      elbowR: [-0.35 - Math.max(0, s) * 0.55, 0, 0],
      legL: [s * 0.32, 0, -0.05],
      legR: [-s * 0.32, 0, 0.05],
      kneeL: [0.18 + Math.max(0, c) * 0.25, 0, 0],
      kneeR: [0.18 + Math.max(0, -c) * 0.25, 0, 0],
      ankleL: [0.35, 0, 0],
      ankleR: [0.35, 0, 0],
    };
  }),
  dancar: [0, 1, 2, 3].map(f => {
    const t = (f / 4) * Math.PI * 2;
    const s = Math.sin(t), bounce = Math.abs(Math.cos(t));
    return {
      pelvisOffset: [s * 0.06, -bounce * 0.06, 0],
      pelvisRot: [0, s * 0.15, s * 0.08],
      spineRot: [0.05 * bounce, -s * 0.18, -s * 0.1],
      headRot: [0.08 * bounce, s * 0.15, s * 0.1],
      armL: [-0.65 + s * 0.4, 0.2, -0.55 - bounce * 0.25],
      elbowL: [-1.25 + s * 0.25, 0, 0],
      armR: [-0.65 - s * 0.4, -0.2, 0.55 + bounce * 0.25],
      elbowR: [-1.25 - s * 0.25, 0, 0],
      legL: [-bounce * 0.18 - Math.max(0, s) * 0.15, 0, -0.1],
      legR: [-bounce * 0.18 - Math.max(0, -s) * 0.15, 0, 0.1],
      kneeL: [bounce * 0.35 + Math.max(0, s) * 0.25, 0, 0],
      kneeR: [bounce * 0.35 + Math.max(0, -s) * 0.25, 0, 0],
    };
  }),
  caminhar: [0, 1, 2, 3, 4].map(f => {
    const t = (f / 5) * Math.PI * 2;
    const s = Math.sin(t), c = Math.cos(t);
    return {
      pelvisRot: [0, s * 0.06, 0],
      spineRot: [0.05, -s * 0.08, 0],
      headRot: [-0.02, s * 0.03, 0],
      armL: [s * 0.32, 0, -0.08],
      elbowL: [-0.25 - Math.max(0, -s) * 0.15, 0, 0],
      armR: [-s * 0.32, 0, 0.08],
      elbowR: [-0.25 - Math.max(0, s) * 0.15, 0, 0],
      legL: [-s * 0.44, 0, 0],
      legR: [s * 0.44, 0, 0],
      kneeL: [Math.max(0, -c) * 0.45, 0, 0],
      kneeR: [Math.max(0, c) * 0.45, 0, 0],
    };
  }),
};

const bind = loadBindPose();
let count = 0;
for (const [clip, frames] of Object.entries(CLIPS)) {
  for (let i = 0; i < frames.length; i++) {
    const posed = poseVertices(bind, frames[i]);
    writeOBJ(path.join('data', 'model', clip, `${i}.obj`), `${clip}_${i}`, bind, posed);
    count++;
  }
}
for (let i = 0; i < 5; i++) {
  const { verts, faceVertKeys } = buildCarryFromRun(i);
  writeOBJ(path.join('data', 'model', 'carregar', `${i}.obj`), `carregar_${i}`, { verts, faceVertKeys }, verts);
  count++;
}
console.log(`Generated ${count} human animation OBJ frames across ${Object.keys(CLIPS).length + 1} clips.`);
