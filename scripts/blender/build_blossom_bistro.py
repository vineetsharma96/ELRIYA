"""Original Blossom Bistro kit. Run only through the real Blender MCP client.
Runtime (x,y,z) is converted to Blender (x,-z,y); GLB export restores Y-up.
Creates independent source scenes and preserves the user's active scene.
"""
import bpy, bmesh, math, os, json, hashlib
import numpy as np
from mathutils import Vector

ROOT = '__ELYRIA_WORKSPACE__'
FILTER = '__ELYRIA_ASSET_FILTER__'
original_scene = bpy.context.window.scene
REPORTS = []
with open(os.path.join(ROOT,'public','assets','architecture','blossom_bistro_contract.json')) as f:
    CONTRACT=json.load(f)
# This authored kit supports one measured layout. Reject contract drift rather
# than silently generate geometry that disagrees with runtime anchor/collision data.
expected={'tableA':[-2.2,.55,2],'returnTray':[2,.9,4.8],'cupStart':[-2.2,.55,2]}
assert CONTRACT['schemaVersion']==1, 'Unsupported Bistro contract schema'
for key,position in expected.items():
    assert CONTRACT['anchors'][key]['position']==position, 'Layout revision requires builder update: '+key
assert CONTRACT['doorway']['width']==1.8 and CONTRACT['doorway']['height']==2.4
assert CONTRACT['wallBounds']['min']==[-4,0,0] and CONTRACT['wallBounds']['max']==[4,6.8,7]
PALETTE = [(0.91,0.86,0.72),(0.73,0.41,0.43),(0.49,0.29,0.17),(0.14,0.36,0.34),
           (0.77,0.59,0.28),(0.57,0.74,0.61),(0.88,0.72,0.41),(0.66,0.32,0.24)]
for directory in ['architecture','interiors','props','textures']:
    os.makedirs(os.path.join(ROOT,'public','assets',directory), exist_ok=True)
os.makedirs(os.path.join(ROOT,'assets','source'), exist_ok=True)

def make_atlas(name, mode):
    size=1024
    pixels=np.ones((size,size,4), dtype=np.float32)
    for index,color in enumerate(PALETTE):
        x=(index%4)*256; y=(index//4)*512
        yy,xx=np.mgrid[0:512,0:256]
        if mode=='color':
            shade=np.ones((512,256),dtype=np.float32)
            if index==1: # roof tile grooves baked into the rose swatch
                shade[(yy%64)<3]=.79
                shade[((xx+(yy//64%2)*32)%64)<2]=.90
            if index==2: # cedar grain, no geometry inflation
                shade=.95+.05*np.sin(xx*.18+np.sin(yy*.015))
            pixels[y:y+512,x:x+256,:3]=np.array(color)*shade[:,:,None]
        elif mode=='roughness':
            rough=.38 if index in [4,6] else .76
            pixels[y:y+512,x:x+256,:3]=rough
        else:
            pixels[y:y+512,x:x+256,:3]=np.array(color)*(.7 if index==6 else 0)
    image=bpy.data.images.new(name,width=size,height=size,alpha=True)
    image.colorspace_settings.name='sRGB' if mode!='roughness' else 'Non-Color'
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw=os.path.join(ROOT,'public','assets','textures',name+'.png')
    image.file_format='PNG'; image.save(); image.pack()
    return image

color=make_atlas('blossom_bistro_atlas','color')
rough=make_atlas('blossom_bistro_roughness','roughness')
emission=make_atlas('blossom_bistro_emissive','emission')
material=bpy.data.materials.new('Bistro_shared_atlas')
material.use_nodes=True
nodes=material.node_tree.nodes; links=material.node_tree.links
bsdf=nodes.get('Principled BSDF')
for image,socket in [(color,'Base Color'),(rough,'Roughness'),(emission,'Emission Color')]:
    tex=nodes.new('ShaderNodeTexImage'); tex.image=image
    links.new(tex.outputs['Color'],bsdf.inputs[socket])
bsdf.inputs['Emission Strength'].default_value=.18
bsdf.inputs['Roughness'].default_value=.76
material.diffuse_color=(.8,.7,.55,1)


def xyz(p): return (p[0],-p[2],p[1])
def new_scene(name):
    scene=bpy.data.scenes.new('ELYRIA_'+name)
    bpy.context.window.scene=scene
    scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1
    return scene

def paint(obj,slot):
    # Per-face box projection into a padded palette tile. Atlas is shared.
    obj.data.materials.clear(); obj.data.materials.append(material)
    uv=obj.data.uv_layers.new(name='UVMap') if not obj.data.uv_layers else obj.data.uv_layers[0]
    coords=[v.co for v in obj.data.vertices]
    lows=[min(p[i] for p in coords) for i in range(3)]
    spans=[max(p[i] for p in coords)-lows[i] for i in range(3)]
    for polygon in obj.data.polygons:
        dominant=max(range(3),key=lambda i:abs(polygon.normal[i]))
        axes=[i for i in range(3) if i!=dominant]
        for loop_id in polygon.loop_indices:
            point=obj.data.vertices[obj.data.loops[loop_id].vertex_index].co
            a=(point[axes[0]]-lows[axes[0]])/max(spans[axes[0]],.001)
            b=(point[axes[1]]-lows[axes[1]])/max(spans[axes[1]],.001)
            uv.data[loop_id].uv=((slot%4+.02+.96*a)/4,(slot//4+.02+.96*b)/2)
    return obj

def box(name,center,size,slot,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(center))
    obj=bpy.context.object; obj.name=name
    obj.scale=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=obj.modifiers.new('soft_corners','BEVEL'); mod.width=bevel; mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return paint(obj,slot)

def sphere(name,center,radii,slot,segments=12,rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=xyz(center))
    obj=bpy.context.object; obj.name=name; obj.scale=(radii[0],radii[2],radii[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in obj.data.polygons: p.use_smooth=True
    return paint(obj,slot)

def mesh(name,vertices,faces,slot):
    data=bpy.data.meshes.new(name); data.from_pydata([xyz(p) for p in vertices],[],faces); data.update()
    if name=='ceramic_cup':
        bm=bmesh.new(); bm.from_mesh(data)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.000001)
        bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=0.000001)
        bm.to_mesh(data); bm.free(); data.update()
    obj=bpy.data.objects.new(name,data); bpy.context.scene.collection.objects.link(obj)
    return paint(obj,slot)

def roof(lod):
    segments=[24,12,6][lod]
    profile=[]
    for i in range(segments+1):
        x=-4.6+9.2*i/segments; a=abs(x)
        h=6.8-2.2*(a/3.9) if a<=3.9 else 4.6+.28*((a-3.9)/.7)**2
        profile.append((x,h))
    # A single thick curved roof skin: thickness lowers the underside, not ridge.
    n=len(profile); vertices=[]
    for height_delta,z in [(0,-.6),(0,7.6),(-.12,-.6),(-.12,7.6)]:
        vertices.extend((x,h+height_delta,z) for x,h in profile)
    faces=[]
    for i in range(n-1):
        faces.extend([(i,i+1,n+i+1,n+i),(2*n+i,3*n+i,3*n+i+1,2*n+i+1),
                      (i,2*n+i,2*n+i+1,i+1),(n+i,n+i+1,3*n+i+1,3*n+i)])
    faces.extend([(0,n,3*n,2*n),(n-1,2*n-1,4*n-1,3*n-1)])
    mesh('curled_rose_roof',vertices,faces,1)
    # Closed front/rear gable follows the actual roof underside.
    for z in [.10,6.90]:
        verts=[(x,h-.12,z) for x,h in profile if abs(x)<=4]
        verts.extend([(verts[-1][0],4.55,z),(verts[0][0],4.55,z)])
        mesh('gable',verts,[tuple(range(len(verts)))],0)
    if lod<2:
        box('cedar_ridge',(0,6.73,3.5),(.18,.12,8.1),2)
        for x in [-4.45,4.45]: box('eave_tip',(x,4.76,3.5),(.12,.12,8.2),2)

def exterior(lod):
    # Front doorway remains open at every LOD. Wall extents match the contract.
    box('front_left',(-2.45,2.3,.1),(3.1,4.6,.2),0)
    box('front_right',(2.45,2.3,.1),(3.1,4.6,.2),0)
    box('door_header',(0,3.5,.1),(1.8,2.2,.2),0)
    box('wall_left',(-3.9,2.3,3.6),(.2,4.6,6.8),0)
    box('wall_right',(3.9,2.3,3.6),(.2,4.6,6.8),0)
    box('wall_rear',(0,2.3,6.9),(7.6,4.6,.2),0)
    roof(lod)
    box('porch',(0,-.07,-.25),(8,.14,.5),2)
    for x in [-.97,.97]: box('door_jamb',(x,1.2,-.06),(.14,2.4,.12),2)
    box('door_lintel',(0,2.45,-.08),(2.08,.14,.16),2)
    for x in [-2.35,2.35]:
        box('front_glazing',(x,1.75,-.025),(1.7,1.5,.05),6)
        box('window_sill',(x,.99,-.08),(1.9,.12,.18),2)
        if lod<2:
            for dx in [-.85,0,.85]: box('window_mullion',(x+dx,1.75,-.07),(.06,1.6,.10),3)
            for y in [1,1.75,2.5]: box('window_rail',(x,y,-.07),(1.8,.06,.10),3)
    if lod<2:
        box('veranda_eave',(0,3.27,-.22),(9.2,.16,.76),1)
        for x in [-3.65,3.65]: box('veranda_post',(x,1.55,-.3),(.14,3.1,.14),2)
        # Split static noren: lower edge is above avatar head clearance.
        for x in [-.46,.46]: box('noren_panel',(x,2.24,-.13),(.82,.30,.02),3)
        box('signboard',(0,2.93,-.15),(1.6,.27,.06),2)
        for x in [-2.8,2.8]:
            box('lantern_frame',(x,2.95,-.2),(.22,.38,.22),3,.025 if lod==0 else 0)
            box('lantern_glow',(x,2.96,-.325),(.15,.25,.02),6)
        sphere('clerestory',(0,4.94,-.025),(.55,.55,.055),6,16 if lod==0 else 8,8 if lod==0 else 4)
    if lod==0:
        for x in [-4.02,4.02]:
            for z in [1.3,3.6,5.9]:
                box('side_window',(x,1.8,z),(.03,1.3,1.15),6)
                for dz in [-.57,0,.57]: box('side_lattice',(x*1.003,1.8,z+dz),(.06,1.4,.055),3)
        sphere('sleeping_cat',(0,6.89,1.0),(.24,.12,.16),0)
        sphere('cat_head',(.20,6.94,.99),(.10,.10,.10),0)
        for x in [.16,.24]:
            mesh('cat_ear',[(x-.035,7.0,.94),(x+.035,7.0,.94),(x,7.09,.94),(x,7.0,1.01)],[(0,1,2),(0,3,1),(0,2,3),(1,3,2)],0)
        for x in [-3.5,3.5]:
            box('planter',(x,.2,-.27),(.6,.4,.45),7,.035)
            for dx in [-.18,0,.18]: sphere('planter_leaf',(x+dx,.48,-.27),(.14,.18,.13),5,8,4)

def interior():
    box('cedar_floor',(0,-.05,3.5),(7.6,.10,6.6),2)
    # Four-seat arrangement with two tables and two cushions each.
    for x in [-2.2,2.2]:
        box('table_top',(x,.51,2),(1.2,.08,.8),2,.035)
        for dx in [-.42,.42]:
            for dz in [-.24,.24]: box('table_leg',(x+dx,.245,2+dz),(.075,.49,.075),2)
        for z in [1.08,2.92]:
            box('mint_cushion',(x,.11,z),(.62,.22,.60),5,.075)
        box('tatami_mat',(x,.01,2),(2.25,.02,3.3),0)
    box('rear_counter',(0,.525,5.8),(6.8,1.05,.6),2,.035)
    box('return_counter',(2.45,.43,5),(1.9,.86,1),2,.025)
    box('return_tray',(2,.88,4.8),(.6,.04,.4),4,.012)
    for x in [1.7,2.3]: box('tray_edge',(x,.925,4.8),(.025,.05,.4),2)
    for z in [4.6,5]: box('tray_edge',(2,.925,z),(.6,.05,.025),2)
    box('tea_machine',(-1.7,1.27,5.8),(.75,.44,.42),4,.06)
    sphere('tea_tank',(-1.7,1.59,5.8),(.16,.25,.16),4,16,8)
    for x in [-1.93,-1.47]: sphere('infuser_dial',(x,1.35,5.56),(.065,.065,.03),3)
    for x in [-3.65,3.65]:
        box('interior_trim',(x,2.2,3.5),(.1,4.4,6.6),2)
    for z in [1,3.5,6]: box('rafter',(0,4.48,z),(7.6,.14,.14),2)
    # A lantern is geometry/emissive only; runtime must supply actual lighting.
    for x in [-1.6,1.6]:
        box('lantern',(x,3.15,3.7),(.32,.48,.32),6,.045)
        box('lantern_cap',(x,3.43,3.7),(.39,.08,.39),3)
        box('lantern_cord',(x,3.92,3.7),(.018,.9,.018),2)
    box('cup_return_marker',(2,.895,4.8),(.24,.006,.15),3)

def cup():
    # Lathed open ceramic shell, real rim and inner cavity; base at Y=0.
    profile=[(.0,.0),(.050,.0),(.058,.012),(.070,.145),(.070,.16),(.059,.16),(.053,.03),(.0,.03)]
    n=18; vertices=[]; faces=[]
    for r,y in profile:
        vertices.extend((r*math.cos(2*math.pi*i/n),y,r*math.sin(2*math.pi*i/n)) for i in range(n))
    for row in range(len(profile)-1):
        for i in range(n):
            j=(i+1)%n
            faces.append((row*n+i,row*n+j,(row+1)*n+j,(row+1)*n+i))
    obj=mesh('ceramic_cup',vertices,faces,7)
    for p in obj.data.polygons:p.use_smooth=True
    # Celadon lip torus, axis vertical in Blender.
    bpy.ops.mesh.primitive_torus_add(major_radius=.0645,minor_radius=.0055,major_segments=18,minor_segments=4,location=xyz((0,.157,0)))
    paint(bpy.context.object,5)
    # Handle torus lies in runtime XY plane, attached to the right side.
    bpy.ops.mesh.primitive_torus_add(major_radius=.035,minor_radius=.008,major_segments=12,minor_segments=4,location=xyz((.072,.087,0)),rotation=(math.pi/2,0,0))
    paint(bpy.context.object,7)

def export(name,category,ceiling,build):
    scene=new_scene(name); build()
    bpy.ops.object.select_all(action='DESELECT')
    objects=[obj for obj in scene.objects if obj.type=='MESH']
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join(); obj=bpy.context.object; obj.name=name
    scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    # Joining can leave repeated identical slots; remove unused copies.
    while len(obj.data.materials)>1:
        for p in obj.data.polygons:p.material_index=0
        obj.data.materials.pop(index=1)
    obj.data.calc_loop_triangles(); triangles=len(obj.data.loop_triangles)
    if triangles>ceiling: raise RuntimeError(name+' exceeds triangle ceiling: '+str(triangles))
    path=os.path.join(ROOT,'public','assets',category,name+'.glb')
    source=os.path.join(ROOT,'assets','source',name+'.blend')
    bpy.data.libraries.write(source,{scene},fake_user=True,compress=True)
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,use_active_scene=True,
        export_yup=True,export_apply=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
    runtime_points=[(v.co.x+obj.location.x,v.co.z+obj.location.z,-v.co.y-obj.location.y) for v in obj.data.vertices]
    bounds={'min':[min(p[i] for p in runtime_points) for i in range(3)],'max':[max(p[i] for p in runtime_points) for i in range(3)]}
    with open(path,'rb') as f: digest=hashlib.sha256(f.read()).hexdigest()
    REPORTS.append({'name':name,'path':'/assets/'+category+'/'+name+'.glb','source':'Blender MCP',
        'triangles':triangles,'triangleCeiling':ceiling,'bytes':os.path.getsize(path),'sha256':digest,
        'materialSlots':len(obj.data.materials),'bounds':bounds,'sourceFile':'assets/source/'+name+'.blend'})

try:
    tasks=[('blossom_bistro_exterior_lod'+str(lod),'architecture',[8000,3500,1200][lod],lambda lod=lod:exterior(lod)) for lod in range(3)]
    tasks.extend([('blossom_bistro_interior','interiors',10000,interior),('blossom_tea_cup','props',800,cup)])
    for name,category,ceiling,build in tasks:
        if FILTER=='__ELYRIA_ASSET_FILTER__' or name in FILTER.split(','): export(name,category,ceiling,build)
    with open(os.path.join(ROOT,'scripts','blender','reports','bistro-build.json'),'w') as f:json.dump(REPORTS,f,indent=2)
    print('ELYRIA_ASSETS='+json.dumps(REPORTS))
finally:
    bpy.context.window.scene=original_scene
