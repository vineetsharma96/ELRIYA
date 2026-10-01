"""Derive lower detail GLBs from original Blender asset sources, through MCP."""
import bpy
import os
import json

root = '__ELYRIA_WORKSPACE__'
original_scene = bpy.context.window.scene
assets = [('cafe', 'architecture'), ('apartment', 'architecture'), ('tower', 'architecture'),
          ('blossom-tree', 'vegetation'), ('flower-patch', 'vegetation')]
reports = []
try:
    for name, directory in assets:
        source = os.path.join(root, 'assets', 'source', name + '.blend')
        with bpy.data.libraries.load(source, link=False) as (available, loaded):
            loaded.scenes = [available.scenes[0]]
        scene = loaded.scenes[0]
        bpy.context.window.scene = scene
        bpy.ops.object.select_all(action='DESELECT')
        mesh = next(obj for obj in scene.objects if obj.type == 'MESH')
        mesh.select_set(True)
        bpy.context.view_layer.objects.active = mesh
        modifier = mesh.modifiers.new('M1_distance_lod', 'DECIMATE')
        modifier.ratio = 0.35
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        mesh.data.calc_loop_triangles()
        mesh.name = name + '-lod1'
        path = os.path.join(root, 'public', 'assets', directory, name + '-lod1.glb')
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, use_active_scene=True,
                                  export_yup=True, export_apply=True, export_extras=True,
                                  export_animations=False, export_cameras=False, export_lights=False)
        reports.append({'name': name + '-lod1', 'path': '/assets/' + directory + '/' + name + '-lod1.glb',
                        'triangles': len(mesh.data.loop_triangles), 'source': 'Blender MCP', 'parent': name})
        bpy.context.window.scene = original_scene
        for obj in list(scene.objects):
            if obj.users_scene == (scene,): bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.scenes.remove(scene)
    print('ELYRIA_ASSETS=' + json.dumps(reports))
finally:
    bpy.context.window.scene = original_scene
