"""Render independent Bistro review scenes through Blender MCP; no export edits."""
import bpy, os, math
from mathutils import Vector
ROOT='__ELYRIA_WORKSPACE__'
original=bpy.context.window.scene
out=os.path.join(ROOT,'artifacts','bistro'); os.makedirs(out,exist_ok=True)

def xyz(p):return Vector((p[0],-p[2],p[1]))
def load(scene,name):
    source=os.path.join(ROOT,'assets','source',name+'.blend')
    with bpy.data.libraries.load(source,link=False) as (available,loaded):loaded.objects=[n for n in available.objects if n.startswith(name)]
    for obj in loaded.objects:
        if obj:scene.collection.objects.link(obj)

def review(name,assets,position,target,ortho=None):
    scene=bpy.data.scenes.new('ELYRIA_review_'+name); bpy.context.window.scene=scene
    for asset in assets:load(scene,asset)
    scene.render.engine='CYCLES'; scene.cycles.samples=16; scene.cycles.use_denoising=True
    scene.render.resolution_x=960; scene.render.resolution_y=720; scene.render.resolution_percentage=100
    world=bpy.data.worlds.new('Bistro_review_world'); world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.57,.66,.62,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.65; scene.world=world
    camera=bpy.data.cameras.new('review_camera'); obj=bpy.data.objects.new('review_camera',camera); scene.collection.objects.link(obj)
    obj.location=xyz(position); obj.rotation_euler=(xyz(target)-obj.location).to_track_quat('-Z','Y').to_euler(); scene.camera=obj
    camera.lens=17 if name=='interior' else 48
    camera.clip_start=.03
    if ortho:camera.type='ORTHO'; camera.ortho_scale=ortho
    light=bpy.data.lights.new('softbox','AREA'); light.energy=1500 if name!='cup' else 25; light.shape='DISK'; light.size=8 if name!='cup' else .5
    lamp=bpy.data.objects.new('softbox',light);scene.collection.objects.link(lamp)
    lamp.location=xyz((-5,10,-4) if name!='cup' else (-.2,.5,-.3));lamp.rotation_euler=(xyz(target)-lamp.location).to_track_quat('-Z','Y').to_euler()
    if name=='interior':
        light2=bpy.data.lights.new('interior_fill','AREA');light2.energy=180;light2.size=3
        fill=bpy.data.objects.new('interior_fill',light2);scene.collection.objects.link(fill);fill.location=xyz((0,3.8,3.4))
        fill.rotation_euler=(xyz((0,0,3.4))-fill.location).to_track_quat('-Z','Y').to_euler()
    scene.view_settings.view_transform='AgX'
    scene.render.filepath=os.path.join(out,name+'.png');bpy.ops.render.render(write_still=True)
try:
    review('exterior',['blossom_bistro_exterior_lod0'],(-11,8,-13),(0,2.8,2.5),15)
    review('interior',['blossom_bistro_exterior_lod0','blossom_bistro_interior'],(0,2.45,.48),(0,.9,3.8))
    review('cup',['blossom_tea_cup'],(.30,.25,-.38),(0,.075,0),.32)
    print('BISTRO_REVIEW_IMAGES='+out)
finally:bpy.context.window.scene=original
