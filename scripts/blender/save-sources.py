"""Save each original asset scene as an editable standalone Blender library."""
import bpy
import os
import json

root = '__ELYRIA_WORKSPACE__/assets/source'
os.makedirs(root, exist_ok=True)
saved = []
for scene in bpy.data.scenes:
    if scene.name.startswith('ELYRIA_'):
        name = scene.name.removeprefix('ELYRIA_')
        path = os.path.join(root, name + '.blend')
        bpy.data.libraries.write(path, {scene}, fake_user=True, compress=True)
        saved.append(name)
print('ELYRIA_SOURCES=' + json.dumps(saved))
