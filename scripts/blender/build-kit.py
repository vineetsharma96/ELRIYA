"""ELYRIA original M1 kit. Execute through mcp-client.mjs, inside Blender MCP.

Units: metres. Blender +Z up, -Y forward -> glTF +Y up, +Z forward.
Each asset has its own scene and a ground-centred pivot. Original scenes persist.
No external models, images, fonts, add-ons or network assets are required.
"""
import bpy
import math
import random
import json
import os
from mathutils import Vector

ROOT = '__ELYRIA_WORKSPACE__'
ONLY = '__ELYRIA_ASSET_FILTER__'
rng = random.Random(71024)
original_scene = bpy.context.window.scene


def material(name, color, roughness=0.75, emission=0):
    mat = bpy.data.materials.get('ELYRIA_' + name) or bpy.data.materials.new('ELYRIA_' + name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    return mat


M = {
    'cream': material('porcelain', (0.93, 0.86, 0.69)),
    'white': material('rice', (1.0, 0.96, 0.83)),
    'sage': material('sage', (0.29, 0.55, 0.45)),
    'teal': material('deep_teal', (0.085, 0.25, 0.25)),
    'pink': material('petal', (0.95, 0.43, 0.51)),
    'lightpink': material('blossom', (1.0, 0.68, 0.68)),
    'darkpink': material('blossom_shadow', (0.71, 0.25, 0.39)),
    'terra': material('terracotta', (0.68, 0.30, 0.24)),
    'wood': material('honeywood', (0.46, 0.25, 0.12)),
    'mint': material('mint', (0.45, 0.77, 0.69)),
    'leaf': material('garden', (0.24, 0.45, 0.20)),
    'lime': material('sunlit_leaf', (0.49, 0.68, 0.27)),
    'glass': material('window_blue', (0.22, 0.45, 0.48), 0.27),
    'glow': material('warm_window', (1.0, 0.66, 0.28), 0.5, 0.18),
    'skin': material('skin', (1.0, 0.70, 0.50)),
    'hair': material('auburn', (0.28, 0.10, 0.06)),
    'lilac': material('lilac', (0.54, 0.42, 0.67)),
    'orange': material('tangerine', (0.96, 0.37, 0.09)),
    'black': material('ink', (0.028, 0.045, 0.047)),
    'road': material('paving', (0.52, 0.59, 0.55)),
}


def use(obj, name, mat):
    obj.name = name
    obj.data.materials.clear()
    obj.data.materials.append(M[mat])
    return obj


def apply_transform(obj):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def cube(name, loc, size, mat, bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.scale = size
    apply_transform(obj)
    if bevel:
        mod = obj.modifiers.new('soft_edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3 if bevel > 0.14 else 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        norm = obj.modifiers.new('weighted_normals', 'WEIGHTED_NORMAL')
        norm.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=norm.name)
    return use(obj, name, mat)


def sphere(name, loc, scale, mat, segments=16, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    apply_transform(obj)
    for face in obj.data.polygons:
        face.use_smooth = True
    return use(obj, name, mat)


def ico(name, loc, scale, mat, level=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=level, radius=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    apply_transform(obj)
    for face in obj.data.polygons:
        face.use_smooth = True
    return use(obj, name, mat)


def cylinder(name, loc, radius, depth, mat, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    mod = obj.modifiers.new('rim', 'BEVEL')
    mod.width = min(0.055, radius * 0.2)
    mod.segments = 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return use(obj, name, mat)


def rod(name, start, end, radius, mat, vertices=10):
    a, b = Vector(start), Vector(end)
    obj = cylinder(name, (a+b)*0.5, radius, (b-a).length, mat, vertices)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj


def text(name, content, loc, size, mat):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = content
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.size = size
    curve.extrude = 0.012
    curve.bevel_depth = 0.004
    curve.bevel_resolution = 1
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (math.pi/2, 0, 0)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return use(bpy.context.object, name, mat)


def roof(name, cx, cy, z, width, depth, height, mat='terra'):
    # A broad gable with soft eaves, useful on cafe and storybook apartments.
    verts = [(cx-width/2, cy-depth/2, z), (cx+width/2, cy-depth/2, z),
             (cx, cy-depth/2, z+height), (cx-width/2, cy+depth/2, z),
             (cx+width/2, cy+depth/2, z), (cx, cy+depth/2, z+height)]
    faces = [(0,2,1), (3,4,5), (0,3,5,2), (2,5,4,1), (0,1,4,3)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bevel = obj.modifiers.new('rounded_eaves', 'BEVEL')
    bevel.width = 0.10
    bevel.segments = 3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return use(obj, name, mat)


def window(x, y, z, w, h, warm=False, frame='sage'):
    cube('window_reveal', (x,y,z), (w+0.18,0.20,h+0.18), frame, 0.10)
    cube('window_pane', (x,y-0.12,z), (w,0.05,h), 'glow' if warm else 'glass', 0.06)
    cube('window_mullion', (x,y-0.17,z), (0.06,0.07,h), frame, 0.02)
    cube('window_transom', (x,y-0.17,z+0.12), (w,0.07,0.06), frame, 0.02)
    cube('window_sill', (x,y-0.19,z-h/2), (w+0.32,0.30,0.13), 'cream', 0.06)


def planter(x, y, z, width=0.8):
    cube('planter', (x,y,z+0.2), (width,0.55,0.4), 'terra', 0.10)
    for off in (-0.24,0,0.24):
        ico('garden_shrub', (x+off*width,y,z+0.48), (width*0.31,0.3,0.35), 'leaf', 1)


def character(citizen=False):
    cloth = 'sage' if citizen else 'lilac'
    for side in (-1,1):
        x=side*0.135
        cube('boot', (x,-0.055,0.095), (0.23,0.32,0.19), 'wood',0.065)
        sphere('trouser', (x,0,0.31), (0.10,0.10,0.24), cloth)
    sphere('coat', (0,0,0.67), (0.31,0.21,0.36), 'cream')
    cube('coat_panel', (0,-0.202,0.62), (0.40,0.045,0.25), cloth,0.035)
    for side in (-1,1):
        arm=sphere('sleeve', (side*0.32,0,0.66), (0.11,0.12,0.25), cloth)
        arm.rotation_euler.y = side*-0.18
        sphere('hand', (side*0.365,-0.005,0.47), (0.09,0.09,0.105), 'skin')
    sphere('head', (0,-0.025,1.22), (0.385,0.325,0.385), 'skin',24,12)
    sphere('hair_cap', (0,0.045,1.35), (0.407,0.32,0.29), 'hair',20,10)
    for side in (-1,1):
        sphere('ear', (side*0.365,-0.005,1.20), (0.075,0.06,0.09), 'skin')
        sphere('hair_sidelock', (side*0.33,-0.13,1.27), (0.09,0.15,0.23), 'hair')
        sphere('eye', (side*0.135,-0.333,1.215), (0.037,0.024,0.053), 'black',12,8)
        sphere('eye_glint', (side*0.135-0.008,-0.354,1.235), (0.011,0.008,0.014), 'white',8,6)
        sphere('blush', (side*0.232,-0.31,1.13), (0.059,0.014,0.027), 'pink',12,6)
    sphere('nose', (0,-0.35,1.145), (0.026,0.024,0.023), 'skin',12,6)
    sphere('smile', (0,-0.330,1.064), (0.04,0.012,0.017), 'hair',12,6)
    for x,z in [(-0.24,1.45),(-0.10,1.47),(0.05,1.45),(0.20,1.42)]:
        bang=sphere('fringe', (x,-0.26,z), (0.105,0.08,0.16), 'hair')
        bang.rotation_euler.y=-0.22
    sphere('beret', (0.03,0.01,1.61), (0.43,0.34,0.14), cloth,20,8)
    cylinder('hat_button', (0.08,0,1.765),0.042,0.045,'cream',12)
    cube('collar', (0,-0.12,0.925), (0.37,0.25,0.085), cloth,0.04)
    if not citizen:
        cube('backpack', (0,0.26,0.70), (0.40,0.22,0.40), 'orange',0.085)
        cube('backpack_pocket', (0,0.384,0.65), (0.27,0.05,0.16), 'cream',0.035)
        for side in (-1,1):
            rod('backpack_strap', (side*0.21,-0.08,0.85),(side*0.20,-0.11,0.55),0.023,'orange',8)


def companion():
    sphere('cloud_body',(0,0.1,0.32),(0.28,0.38,0.26),'cream')
    sphere('cloud_head',(0,-0.21,0.55),(0.30,0.26,0.29),'white',20,10)
    for side in (-1,1):
        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.11,radius2=0.018,depth=0.28,location=(side*0.18,-0.17,0.83))
        use(bpy.context.object,'cloud_ear','cream')
        sphere('ear_inner',(side*0.18,-0.236,0.82),(0.055,0.012,0.09),'pink',12,6)
        sphere('cloud_eye',(side*0.105,-0.444,0.56),(0.03,0.02,0.043),'black',12,6)
        for y in (-0.10,0.30):
            sphere('cloud_paw',(side*0.18,y,0.12),(0.09,0.115,0.10),'lilac')
        sphere('cheek',(side*0.18,-0.418,0.48),(0.045,0.012,0.024),'pink',12,6)
    sphere('cloud_nose',(0,-0.463,0.49),(0.023,0.016,0.019),'pink',12,6)
    for i in range(5):
        sphere('plume_tail',(0.07+i*0.038,0.41+i*0.10,0.32+i*0.064),(0.13-i*0.012,0.145-i*0.012,0.13-i*0.008),'lilac')
    sphere('collar_bell',(0,-0.18,0.27),(0.045,0.04,0.045),'glow',12,6)


def cafe():
    cube('stone_step',(0,0,0.15),(9.3,7.0,0.30),'cream',0.2)
    cube('bakery_body',(0,0,2.23),(8.8,6.4,4.25),'cream',0.27)
    cube('foundation_trim',(0,0,0.60),(8.95,6.5,0.35),'sage',0.10)
    for x in (-4.1,4.1):
        cube('corner_pillar',(x,-3.21,2.22),(0.36,0.17,3.4),'sage',0.1)
    for x in (-2.6,2.6):
        window(x,-3.25,2.04,2.22,2.15,True)
        # The display shelf and baked goods read as warm inhabited storefronts.
        cube('display_shelf',(x,-3.52,1.48),(2.15,0.25,0.07),'wood',0.03)
        for ox in (-0.58,0,0.58):
            sphere('bread',(x+ox,-3.60,1.66),(0.19,0.12,0.11),'cream',12,6)
    cube('door_frame',(0,-3.27,1.65),(1.5,0.25,2.95),'sage',0.15)
    cube('door_glass',(0,-3.425,1.82),(1.20,0.05,2.48),'glass',0.12)
    cube('door_lower',(0,-3.47,0.8),(1.22,0.05,0.58),'teal',0.05)
    cylinder('door_handle',(0.44,-3.54,1.65),0.035,0.34,'glow',10)
    cube('sign_board',(0,-3.32,3.78),(5.5,0.30,0.86),'teal',0.22)
    text('NEKO_sign','N E K O  C A F E',(0,-3.50,3.79),0.42,'cream')
    for i in range(14):
        x=-4.23+i*0.65
        strip=cube('striped_awning',(x,-3.65,3.05),(0.65,1.04,0.16),'pink' if i%2 else 'white',0.05)
        strip.rotation_euler.x=0.16
        sphere('awning_scallop',(x,-4.16,2.96),(0.327,0.075,0.17),'pink' if i%2 else 'white',12,6)
    cube('roof_cornice',(0,0,4.37),(9.45,7.04,0.30),'sage',0.12)
    roof('storybook_roof',0,0,4.48,9.70,7.2,1.72,'terra')
    rod('roof_ridge',(0,-3.65,6.20),(0,3.65,6.20),0.14,'pink')
    for x in (-3,-1.5,1.5,3):
        # Ribs read as terracotta sheet seams without texture downloads.
        z=6.2-abs(x)/4.85*1.72
        rod('roof_seam',(x,-3.62,z),(x,3.62,z),0.028,'pink',8)
    cube('chimney',(-2.3,1.5,5.94),(0.67,0.68,1.9),'cream',0.08)
    cube('chimney_cap',(-2.3,1.5,6.92),(0.87,0.83,0.2),'sage',0.08)
    for x in (-3.55,3.55): planter(x,-3.9,0.30,1.02)
    # Hanging round cat-mark.
    rod('sign_bracket',(4.22,-3.0,4.27),(4.22,-4.18,4.27),0.07,'teal')
    sign=cylinder('hanging_sign',(4.22,-4.08,3.69),0.44,0.15,'cream',24)
    sign.rotation_euler.x=math.pi/2
    for x in (4.09,4.35): sphere('cat_mark_eye',(x,-4.17,3.71),(0.028,0.02,0.04),'teal',10,6)
    sphere('cat_mark_nose',(4.22,-4.18,3.6),(0.035,0.02,0.025),'pink',10,6)


def apartment():
    cube('plinth',(0,0,0.2),(7.8,6.7,0.4),'cream',0.24)
    cube('home_body',(0,0,5.45),(7.2,6.0,10.7),'cream',0.4)
    for floor in range(3):
        z=2.0+floor*3.05
        cube('floor_band',(0,0,z+1.35),(7.5,6.25,0.25),'sage',0.12)
        for x in (-2.2,0,2.2):
            window(x,-3.02,z,1.42,1.74, floor==0)
            if floor>0:
                cube('balcony_floor',(x,-3.46,z-1.0),(1.98,1.00,0.20),'cream',0.08)
                rod('balcony_rail',(x-0.87,-3.90,z-0.29),(x+0.87,-3.90,z-0.29),0.045,'sage')
                for xx in (-0.83,-0.4,0,0.4,0.83): rod('baluster',(x+xx,-3.90,z-0.91),(x+xx,-3.90,z-0.30),0.025,'sage',8)
        for side in (-1,1):
            for yy in (-1.7,0.2,2):
                cube('side_window',(side*3.62,yy,z),(0.08,1.22,1.72),'glass',0.12)
    cube('roof_lip',(0,0,10.91),(7.75,6.50,0.5),'sage',0.2)
    roof('apartment_roof',0,0,11.12,7.7,6.6,1.3,'pink')
    cube('roof_garden',(0,1.3,11.4),(3.6,2,0.6),'sage',0.18)
    for x in (-1.2,0,1.2): ico('roof_shrub',(x,1.3,11.95),(0.8,0.7,0.7),'leaf')


def tower():
    cube('tower_plinth',(0,0,0.24),(7.2,6.6,0.48),'cream',0.24)
    cube('tower_main',(0,0,9.6),(6.3,5.7,19.0),'mint',0.75)
    for level in range(7):
        z=2.1+level*2.5
        cube('tower_glass_band',(0,0,z),(6.38,5.78,1.2),'glass',0.6)
        cube('tower_cream_band',(0,0,z+0.79),(6.66,6.05,0.36),'cream',0.16)
    for x in (-2.45,2.45):
        cube('tower_vertical_fin',(x,-2.85,9.8),(0.30,0.32,18.7),'cream',0.15)
    cube('tower_crown',(0,0,19.7),(6.1,5.6,1.2),'cream',0.5)
    sphere('observatory',(0,0,20.4),(2.3,2.0,1.7),'mint',24,12)
    cylinder('antenna',(0,0,22.2),0.12,1.6,'cream',12)
    sphere('beacon',(0,0,23.07),(0.22,0.22,0.26),'glow')
    for x,y in [(-2,-1.5),(2,-1.5),(-2,1.5),(2,1.5)]: ico('crown_garden',(x,y,20.34),(0.9,0.7,0.56),'leaf')


def tree():
    cylinder('blossom_trunk',(0,0,1.45),0.19,2.9,'wood',10)
    for i in range(6):
        angle=i*math.tau/6
        endpoint=(math.cos(angle)*1.08,math.sin(angle)*1.08,3.00+(i%2)*0.5)
        rod('branch',(0,0,1.5+i*0.13),endpoint,0.085,'wood',8)
    for i in range(14):
        angle=i*2.39996
        radius=0.75+(i%3)*0.39
        x,y=math.cos(angle)*radius,math.sin(angle)*radius
        z=3.55+(i%4)*0.28
        ico('blossom_cluster',(x,y,z),(1.13,0.98,0.85),['lightpink','pink','lightpink','darkpink'][i%4],2)
    ico('blossom_crown',(0,0,4.42),(1.38,1.2,0.88),'lightpink',2)


def flowers():
    for i in range(11):
        angle=i*2.39996
        radius=0.18+0.57*(i/11)
        x,y=math.cos(angle)*radius,math.sin(angle)*radius
        z=0.24+(i%3)*0.085
        rod('stem',(x,y,0.02),(x,y,z),0.013,'leaf',6)
        sphere('leaf',(x+0.07,y,0.1),(0.11,0.042,0.026),'leaf',8,4)
        sphere('flower_center',(x,y,z+0.027),(0.053,0.053,0.045),'glow',8,5)
        for j in range(5):
            a=j*math.tau/5
            sphere('petal',(x+math.cos(a)*0.068,y+math.sin(a)*0.068,z),(0.06,0.065,0.028),'pink' if i%2 else 'white',8,4)


def shuttle():
    cube('shuttle_hull',(0,0,0.78),(1.94,3.42,1.04),'mint',0.4)
    cube('shuttle_cabin',(0,-0.05,1.51),(1.80,2.90,0.98),'cream',0.40)
    cube('windshield',(0,-1.46,1.56),(1.43,0.10,0.65),'glass',0.22)
    cube('rear_window',(0,1.38,1.55),(1.42,0.1,0.61),'glass',0.18)
    for side in (-1,1):
        for y in (-0.67,0.58):
            cube('side_window',(side*0.903,y,1.56),(0.08,1.03,0.58),'glass',0.15)
        for y in (-1.01,1.02):
            wheel=cylinder('wheel',(side*0.97,y,0.43),0.36,0.18,'teal',16)
            wheel.rotation_euler.y=math.pi/2
            hub=cylinder('hub',(side*1.077,y,0.43),0.20,0.03,'cream',12)
            hub.rotation_euler.y=math.pi/2
        sphere('headlight',(side*0.61,-1.696,0.97),(0.18,0.055,0.115),'glow')
        sphere('taillight',(side*0.61,1.696,0.97),(0.11,0.035,0.08),'pink')
    cube('front_smile',(0,-1.736,0.69),(0.60,0.04,0.075),'teal',0.03)
    cube('roof_sign',(0,0,2.071),(0.83,0.55,0.20),'teal',0.09)
    sphere('lidar',(0,0.75,2.05),(0.11,0.11,0.09),'glow')
    text('shuttle_route','01',(0,-0.286,2.075),0.14,'cream')


def lamp():
    cylinder('lamp_base',(0,0,0.11),0.24,0.22,'teal',16)
    cylinder('lamp_pole',(0,0,1.58),0.072,3.0,'teal',12)
    rod('lamp_arm',(0,0,3.1),(0.55,0,3.48),0.066,'teal')
    rod('lamp_end',(0.55,0,3.48),(0.7,0,3.24),0.065,'teal')
    sphere('lamp_globe',(0.70,0,3.14),(0.26,0.26,0.27),'glow',16,8)
    sphere('lamp_cap',(0.7,0,3.33),(0.31,0.31,0.12),'sage',16,6)
    cube('banner',(0.03,0,2.52),(0.40,0.035,0.51),'pink',0.045)


def bench():
    for x in (-0.72,0.72):
        for y in (-0.22,0.22): cube('bench_leg',(x,y,0.23),(0.11,0.11,0.46),'teal',0.035)
        rod('back_support',(x,0.23,0.39),(x,0.33,0.96),0.04,'teal')
    for y in (-0.20,-0.065,0.07,0.205): cube('seat_slat',(0,y,0.49),(1.92,0.105,0.09),'wood',0.03)
    for z in (0.73,0.92): cube('back_slat',(0,0.31,z),(1.92,0.08,0.13),'wood',0.035)
    for x in (-0.88,0.88): rod('armrest',(x,-0.18,0.72),(x,0.27,0.72),0.045,'teal')


def road():
    cube('tile',(0,0,0.06),(4,4,0.12),'road',0.055)
    for y in (-1.92,1.92): cube('kerb',(0,y,0.15),(4,0.16,0.3),'cream',0.05)
    cube('lane_dash',(0,0,0.125),(1.35,0.075,0.005),'cream',0)


def petal():
    obj=sphere('petal',(0,0,0.014),(0.064,0.10,0.012),'lightpink',10,4)
    obj.rotation_euler.y=0.14


BUILDERS = {
    'protagonist': ('characters', lambda: character(False)),
    'citizen': ('characters', lambda: character(True)),
    'companion': ('characters', companion),
    'cafe': ('architecture', cafe),
    'apartment': ('architecture', apartment),
    'tower': ('architecture', tower),
    'blossom-tree': ('vegetation', tree),
    'flower-patch': ('vegetation', flowers),
    'shuttle': ('vehicles', shuttle),
    'street-lamp': ('street', lamp),
    'bench': ('street', bench),
    'road-tile': ('street', road),
    'petal': ('vegetation', petal),
}


def export_asset(name, directory, builder):
    scene_name='ELYRIA_' + name
    old=bpy.data.scenes.get(scene_name)
    if old:
        # Only regenerated asset-owned datablocks are replaced. Preserve other scenes.
        for obj in list(old.objects):
            if obj.users_scene == (old,): bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.scenes.remove(old)
    scene=bpy.data.scenes.new(scene_name)
    bpy.context.window.scene=scene
    scene.unit_settings.system='METRIC'
    scene.unit_settings.scale_length=1
    builder()
    objects=[obj for obj in scene.objects if obj.type=='MESH']
    # Apply rotation and location, generate compact UVs on surfaces without them.
    for obj in objects:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        if not obj.data.uv_layers:
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=0.025)
            bpy.ops.object.mode_set(mode='OBJECT')
    # Joining to one mesh with shared slots makes one primitive/draw per material.
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    mesh=bpy.context.object
    mesh.name=name
    scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    mesh['asset_id']=name
    mesh['pipeline']='Blender MCP'
    mesh['milestone']='M1'
    mesh['collision']='runtime analytic bounds'
    mesh['author']='ELYRIA original'
    mesh.data.calc_loop_triangles()
    triangles=len(mesh.data.loop_triangles)
    vertices=len(mesh.data.vertices)
    bbox=[tuple(mesh.matrix_world@Vector(corner)) for corner in mesh.bound_box]
    minimum=[min(p[i] for p in bbox) for i in range(3)]
    maximum=[max(p[i] for p in bbox) for i in range(3)]
    path=f'{ROOT}/public/assets/{directory}/{name}.glb'
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,use_active_scene=True,
                              export_yup=True,export_apply=True,export_extras=True,
                              export_animations=False,export_cameras=False,export_lights=False)
    source_root = f'{ROOT}/assets/source'
    os.makedirs(source_root, exist_ok=True)
    bpy.data.libraries.write(f'{source_root}/{name}.blend', {scene}, fake_user=True, compress=True)
    return {'name':name,'path':f'/assets/{directory}/{name}.glb','triangles':triangles,
            'vertices':vertices,'materials':len(set(m.name for m in mesh.data.materials)),
            'bounds_blender':{'min':minimum,'max':maximum},'animations':[],
            'origin':'ground-centre','units':'metres','source':'Blender MCP'}


results=[]
try:
    selected = list(BUILDERS) if ONLY.startswith('__') else ONLY.split(',')
    for name in selected:
        directory,builder=BUILDERS[name]
        results.append(export_asset(name,directory,builder))
    print('ELYRIA_ASSETS=' + json.dumps(results))
finally:
    if original_scene.name in bpy.data.scenes: bpy.context.window.scene=original_scene
