#!/usr/bin/env python3
"""Convert a Mixamo FBX animation into normalized 125-vertex citizen OBJ frames.

Usage:
  blender --background --python scripts/mixamo_to_obj.py -- <input.fbx> <output_dir> [frame_count=4]
"""
import json
import math
import os
import subprocess
import sys
import bpy
from mathutils import Matrix, Vector


def parse_obj_raw(path):
    verts = []
    faces = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('v '):
                parts = line.split()
                verts.append([float(parts[1]), float(parts[2]), float(parts[3])])
            elif line.startswith('f '):
                parts = line.split()[1:]
                idx = [int(p.split('/')[0]) - 1 for p in parts]
                for i in range(1, len(idx) - 1):
                    faces.append([idx[0], idx[i], idx[i + 1]])
    return verts, faces


def load_canonical_idle(repo_root):
    # acenar/0.obj has the canonical 125-vertex, 246-triangle topology;
    # use the game's own parseCitizenOBJ via node so padding stripping matches 100%.
    ac_path = os.path.join(repo_root, 'data/animals/humano/acenar/0.obj')
    ac_verts, ac_faces = parse_obj_raw(ac_path)
    js = (
        "import fs from 'node:fs';"
        "import { parseCitizenOBJ } from './js/city_citizen_models.js';"
        "const d = parseCitizenOBJ(fs.readFileSync('data/animals/humano/idle/0.obj','utf8'));"
        "console.log(JSON.stringify(Array.from(d.positions)));"
    )
    out = subprocess.check_output(['node', '--input-type=module', '-e', js], cwd=repo_root, text=True)
    idle_pos = json.loads(out)
    base_verts = [list(v) for v in ac_verts]
    for t in range(len(ac_faces)):
        for k in range(3):
            vi = ac_faces[t][k]
            p = t * 9 + k * 3
            base_verts[vi] = [idle_pos[p], idle_pos[p + 1], idle_pos[p + 2]]
    return base_verts, ac_faces


def find_bone(armature, names):
    for name in names:
        for b in armature.pose.bones:
            if b.name == name or b.name.endswith(':' + name) or b.name.lower().endswith(name.lower()):
                return b
    return None


def bone_delta(pose_bone, armature):
    if pose_bone is None:
        return Matrix.Identity(4)
    rest = pose_bone.bone.matrix_local
    pose = pose_bone.matrix
    return armature.matrix_world @ pose @ rest.inverted() @ armature.matrix_world.inverted()


def classify_vertex(v, idx):
    x, y, z = v
    r_sh = {110, 111, 114}
    r_elbow = {102, 103, 106, 108, 112, 115}
    r_fore = {104, 105, 107, 109, 116, 117, 118, 119, 120}
    l_sh = {53, 54, 57}
    l_elbow = {45, 46, 49, 51, 55, 58}
    l_fore = {47, 48, 50, 52, 59, 60, 61, 62, 63}
    if y > 1.85:
        return 'Head'
    if idx in r_sh:
        return 'RightShoulder'
    if idx in r_elbow:
        return 'RightArm'
    if idx in r_fore:
        return 'RightForeArm'
    if idx in l_sh:
        return 'LeftShoulder'
    if idx in l_elbow:
        return 'LeftArm'
    if idx in l_fore:
        return 'LeftForeArm'
    if y > 1.35:
        return 'Spine2'
    if y > 1.05:
        return 'Hips'
    if x >= 0:
        if y > 0.55:
            return 'RightUpLeg'
        if y > 0.16:
            return 'RightLeg'
        return 'RightFoot'
    else:
        if y > 0.55:
            return 'LeftUpLeg'
        if y > 0.16:
            return 'LeftLeg'
        return 'LeftFoot'


def normalize_to_idle(verts, target_height=2.196):
    ys = [v[1] for v in verts]
    xs = [v[0] for v in verts]
    zs = [v[2] for v in verts]
    min_y = min(ys)
    cx = (min(xs) + max(xs)) * 0.5
    cz = (min(zs) + max(zs)) * 0.5
    return [[v[0] - cx, v[1] - min_y, v[2] - cz] for v in verts]


def write_obj(path, verts, faces, comment='Mixamo frame'):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(f'# {comment}\n')
        for v in verts:
            f.write(f'v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n')
        for tri in faces:
            f.write(f'f {tri[0] + 1} {tri[1] + 1} {tri[2] + 1}\n')


def main():
    argv = sys.argv
    if '--' not in argv:
        raise SystemExit('Missing -- arguments')
    args = argv[argv.index('--') + 1:]
    if len(args) < 2:
        raise SystemExit('Usage: mixamo_to_obj.py <input.fbx> <output_dir> [frame_count]')

    fbx_path = os.path.abspath(args[0])
    out_dir = os.path.abspath(args[1])
    frame_count = int(args[2]) if len(args) > 2 else 4
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=fbx_path)

    armature = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not armature and not meshes:
        raise RuntimeError(f'No armature or mesh found in {fbx_path}')

    frame_start, frame_end = 1, 30
    if armature and armature.animation_data and armature.animation_data.action:
        r = armature.animation_data.action.frame_range
        frame_start, frame_end = int(round(r[0])), int(round(r[1]))
    span = max(1, frame_end - frame_start)
    sample_frames = [
        int(round(frame_start + span * (i / frame_count)))
        for i in range(frame_count)
    ]

    base_verts, faces = load_canonical_idle(repo_root)
    exact_mesh = next((m for m in meshes if len(m.data.vertices) == len(base_verts)), None)
    padded_mesh = next((m for m in meshes if len(m.data.vertices) >= len(base_verts) and len(m.data.polygons) >= len(faces)), None)

    scene = bpy.context.scene
    depsgraph = bpy.context.evaluated_depsgraph_get()

    # Build canonical 125-vertex index -> FBX mesh vertex index map by matching REST-pose 3D positions
    canon_to_fbx = None
    if padded_mesh is not None:
        if armature:
            armature.data.pose_position = 'REST'
            bpy.context.view_layer.update()
        eval_rest = padded_mesh.evaluated_get(depsgraph).to_mesh()
        rest_world = [
            [(padded_mesh.matrix_world @ v.co).x * 100.0,
             (padded_mesh.matrix_world @ v.co).z * 100.0,
             -(padded_mesh.matrix_world @ v.co).y * 100.0]
            for v in eval_rest.vertices
        ]
        padded_mesh.evaluated_get(depsgraph).to_mesh_clear()
        if armature:
            armature.data.pose_position = 'POSE'
            bpy.context.view_layer.update()
        mapping = []
        max_err = 0.0
        for bv in base_verts:
            best_i = -1
            best_d2 = 1e9
            for fi, rv in enumerate(rest_world):
                dx = rv[0] - bv[0]
                dy = rv[1] - bv[1]
                dz = rv[2] - bv[2]
                d2 = dx * dx + dy * dy + dz * dz
                if d2 < best_d2:
                    best_d2 = d2
                    best_i = fi
            max_err = max(max_err, math.sqrt(best_d2))
            mapping.append(best_i)
        print(f'Matched {len(mapping)} canonical vertices to FBX REST pose (max error: {max_err:.6f})')
        if max_err < 0.05:
            canon_to_fbx = mapping

    # Check armature scale relative to canonical 2.20m height
    arm_height = 1.0
    if armature:
        b_hips = find_bone(armature, ['Hips'])
        b_head = find_bone(armature, ['HeadTop_End', 'Head'])
        if b_hips and b_head:
            h_vec = (armature.matrix_world @ b_head.bone.head_local) - (armature.matrix_world @ b_hips.bone.head_local)
            arm_height = max(0.1, abs(h_vec.z) if abs(h_vec.z) > abs(h_vec.y) else abs(h_vec.y))
    scale_to_idle = 2.196 / (arm_height * 2.0) if arm_height > 0 else 1.0

    # Map canonical OBJ Y-up coordinates into Blender Z-up for armature delta application
    bone_names = {
        'Hips': ['Hips'],
        'Spine2': ['Spine2', 'Spine1', 'Spine'],
        'Head': ['Head', 'Neck'],
        'LeftShoulder': ['LeftShoulder', 'LeftArm'],
        'LeftArm': ['LeftArm'],
        'LeftForeArm': ['LeftForeArm'],
        'RightShoulder': ['RightShoulder', 'RightArm'],
        'RightArm': ['RightArm'],
        'RightForeArm': ['RightForeArm'],
        'LeftUpLeg': ['LeftUpLeg'],
        'LeftLeg': ['LeftLeg'],
        'LeftFoot': ['LeftFoot'],
        'RightUpLeg': ['RightUpLeg'],
        'RightLeg': ['RightLeg'],
        'RightFoot': ['RightFoot'],
    }
    bone_map = {k: find_bone(armature, v) for k, v in bone_names.items()} if armature else {}
    groups = [classify_vertex(v, i) for i, v in enumerate(base_verts)]

    # Measure armature rest center in world space
    hips_rest = (armature.matrix_world @ bone_map['Hips'].bone.head_local) if (armature and bone_map.get('Hips')) else Vector((0, 0, 0))
    # Convert OBJ (X, Y-up, Z-fwd) -> Blender (X, -Z, Y) scaled to armature size
    inv_scale = 1.0 / max(1e-5, scale_to_idle)

    for idx, fnum in enumerate(sample_frames):
        scene.frame_set(fnum)
        depsgraph.update()

        if canon_to_fbx is not None:
            eval_obj = padded_mesh.evaluated_get(depsgraph)
            eval_mesh = eval_obj.to_mesh()
            # Convert Blender Z-up (x, y, z) -> OBJ Y-up (x, z, -y)
            raw_verts = []
            for vi in canon_to_fbx:
                wv = eval_obj.matrix_world @ eval_mesh.vertices[vi].co
                raw_verts.append([wv.x * 100.0, wv.z * 100.0, -wv.y * 100.0])
            eval_obj.to_mesh_clear()
            verts = normalize_to_idle(raw_verts)
        else:
            deltas = {k: bone_delta(b, armature) for k, b in bone_map.items()}
            raw_verts = []
            for i, v in enumerate(base_verts):
                # Map canonical vertex around Hips in Blender world space
                bl_v = Vector((
                    hips_rest.x + v[0] * inv_scale,
                    hips_rest.y - v[2] * inv_scale,
                    hips_rest.z + (v[1] - 1.05) * inv_scale,
                ))
                d = deltas.get(groups[i], Matrix.Identity(4))
                tv = d @ bl_v
                # Back to OBJ Y-up scaled to canonical height
                raw_verts.append([
                    (tv.x - hips_rest.x) * scale_to_idle,
                    (tv.z - hips_rest.z) * scale_to_idle + 1.05,
                    -(tv.y - hips_rest.y) * scale_to_idle,
                ])
            verts = normalize_to_idle(raw_verts)

        out_path = os.path.join(out_dir, f'{idx}.obj')
        write_obj(out_path, verts, faces, f'{os.path.basename(out_dir)} frame {idx} (fbx frame {fnum})')
        print(f'Wrote {out_path}')


if __name__ == '__main__':
    main()
