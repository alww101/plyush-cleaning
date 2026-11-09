"""Rebuild Plyush original furniture in Blender 4.2+ (bpy).
Run with Blender --background --python build_models.py or Python with bpy installed.
Output GLB and posters are generated beside ../public/models; editable .blend files here.
Kenney furniture pack is retained separately as CC0 reference, not embedded in GLB.
"""
import sys, math, os
from pathlib import Path
ROOT=Path(__file__).resolve().parent
# Optional task-local bpy, not required when run inside Blender.
local=ROOT.parents[2]/'work/assets/python'
if local.exists(): sys.path.insert(0,str(local))
import bpy
from mathutils import Vector
OUT=ROOT.parent/'public/models'
OUT.mkdir(parents=True,exist_ok=True)

def material(name,color,roughness=.84):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=roughness
    if 'Sheen Weight' in bs.inputs:bs.inputs['Sheen Weight'].default_value=.18
    return m

def rounded(name,loc,scale,mat,r=.12):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.name=name;o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b=o.modifiers.new('Soft upholstered corners','BEVEL');b.width=r;b.segments=5
    b.affect='EDGES';b.harden_normals=True
    bpy.ops.object.modifier_apply(modifier=b.name)
    for f in o.data.polygons:f.use_smooth=True
    n=o.modifiers.new('Weighted upholstery normals','WEIGHTED_NORMAL');n.keep_sharp=True;n.weight=40
    bpy.ops.object.modifier_apply(modifier=n.name)
    o.data.materials.append(mat)
    return o

def sphere(name,loc,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o

def pipe(name,points,mat,r=.009,closed=True):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1
    c.bevel_depth=r;c.bevel_resolution=2
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*co,1)
    s.use_cyclic_u=closed
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);c.materials.append(mat)
    return o

def round_rect(cx,cy,z,w,d,r=.12):
    p=[]
    for x,y,start in [(cx+w/2-r,cy+d/2-r,0),(cx-w/2+r,cy+d/2-r,90),(cx-w/2+r,cy-d/2+r,180),(cx+w/2-r,cy-d/2+r,270)]:
        for i in range(9):
            a=math.radians(start+i*90/8);p.append((x+math.cos(a)*r,y+math.sin(a)*r,z))
    return p

def leg(name,x,y,h=.3):
    bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.072,radius2=.05,depth=h,location=(x,y,h/2))
    o=bpy.context.object;o.name=name;o.data.materials.append(wood)
    b=o.modifiers.new('Rounded feet','BEVEL');b.width=.018;b.segments=3
    bpy.ops.object.modifier_apply(modifier=b.name)
    for p in o.data.polygons:p.use_smooth=True

def sofa():
    for x in [-1.16,1.16]:
        for y in [-.45,.43]:leg('Oak foot',x,y)
    rounded('Upholstered base',(0,0,.43),(2.95,1.32,.45),purple,.15)
    rounded('Continuous back',(0,.48,1.04),(2.9,.38,1.13),purple,.17)
    for x in [-1.37,1.37]:rounded('Round armrest',(x,-.05,.87),(.38,1.33,.78),purple,.18)
    for x in [-.65,.65]:
        rounded('Seat cushion',(x,-.16,.72),(1.25,.98,.25),lightpurple,.115)
        pipe('Seat piping',round_rect(x,-.16,.765,1.18,.91,.15),seam)
        back=rounded('Back cushion',(x,.345,1.16),(1.25,.26,.76),lightpurple,.13);back.rotation_euler[0]=-.08
        for dx in [-.21,.21]:sphere('Quiet tuft',(x+dx,.191,1.17),(.035,.012,.034),purple)
    pillow=rounded('Accent pillow',(-.98,-.1,1.02),(.38,.22,.4),cream,.11);pillow.rotation_euler=(.05,-.15,-.17)

def sofa_three():
    """Three-seat companion to sofa(): same upholstery language, one extra cushion."""
    for x in [-1.62,1.62]:
        for y in [-.45,.43]:leg('Oak foot',x,y)
    rounded('Upholstered base',(0,0,.43),(4.05,1.32,.45),purple,.15)
    rounded('Continuous back',(0,.48,1.04),(4.0,.38,1.13),purple,.17)
    for x in [-1.93,1.93]:rounded('Round armrest',(x,-.05,.87),(.38,1.33,.78),purple,.18)
    for x in [-1.28,0,1.28]:
        rounded('Seat cushion',(x,-.16,.72),(1.12,.98,.25),lightpurple,.115)
        pipe('Seat piping',round_rect(x,-.16,.765,1.05,.91,.15),seam)
        back=rounded('Back cushion',(x,.345,1.16),(1.12,.26,.76),lightpurple,.13);back.rotation_euler[0]=-.08
        for dx in [-.19,.19]:sphere('Quiet tuft',(x+dx,.191,1.17),(.032,.012,.032),purple)
    pillow=rounded('Accent pillow',(-1.58,-.1,1.02),(.38,.22,.4),cream,.11);pillow.rotation_euler=(.05,-.15,-.17)

def sofa_corner():
    """Three-seat L-shaped corner sofa: three cushions on the long side plus right return."""
    for x,y in [(-1.62,-.45),(-1.62,.43),(1.62,.43),(1.62,-1.45)]:leg('Oak foot',x,y)
    rounded('Long corner base',(0,0,.43),(4.05,1.32,.45),purple,.15)
    rounded('Corner return',(1.28,-.96,.43),(1.49,1.42,.45),purple,.15)
    rounded('Long corner back',(0,.48,1.04),(4.0,.38,1.13),purple,.17)
    rounded('Corner side armrest',(1.93,-.56,.87),(.38,2.35,.78),purple,.18)
    rounded('Round armrest',(-1.93,-.05,.87),(.38,1.33,.78),purple,.18)
    for x in [-1.28,0,1.28]:
        if x<1:
            rounded('Corner seat cushion',(x,-.16,.72),(1.12,.98,.25),lightpurple,.115)
            pipe('Corner seat piping',round_rect(x,-.16,.765,1.05,.91,.15),seam)
        back=rounded('Corner back cushion',(x,.345,1.16),(1.12,.26,.76),lightpurple,.13);back.rotation_euler[0]=-.08
    rounded('Continuous chaise cushion',(1.28,-.64,.72),(1.12,1.94,.25),lightpurple,.115)
    pipe('Chaise cushion piping',round_rect(1.28,-.64,.765,1.05,1.87,.15),seam)
    pillow=rounded('Corner accent pillow',(-1.58,-.1,1.02),(.38,.22,.4),cream,.11);pillow.rotation_euler=(.05,-.15,-.17)

def armchair():
    for x in [-.52,.52]:
        for y in [-.42,.42]:leg('Oak foot',x,y)
    rounded('Chair base',(0,0,.43),(1.49,1.31,.41),blue,.14)
    rounded('Chair back',(0,.46,1.08),(1.45,.36,1.2),blue,.17)
    for x in [-.62,.62]:rounded('Cushioned arm',(x,-.03,.83),(.34,1.3,.65),blue,.16)
    rounded('Chair seat',(0,-.16,.7),(.99,.99,.24),lightblue,.11)
    pipe('Chair piping',round_rect(0,-.16,.745,.92,.92,.13),blueSeam)
    rounded('Chair back cushion',(0,.27,1.19),(1.0,.24,.73),lightblue,.13)
    for x in [-.22,.22]:sphere('Chair tuft',(x,.137,1.21),(.035,.012,.035),blue)

def recliner():
    """A matching armchair with a visible footrest and side release lever."""
    armchair()
    rounded('Recliner footrest',(0,-.92,.38),(1.02,.62,.23),blue,.12)
    rounded('Recliner cushion',(0,-.68,.54),(.94,.46,.18),lightblue,.1)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.035,depth=.25,location=(.68,-.2,.78),rotation=(0,math.pi/2,0))
    lever=bpy.context.object;lever.name='Recliner release lever';lever.data.materials.append(wood)

def mattress(width=1.78):
    rounded('Structural mattress core',(0,0,.255),(width,2.5,.51),sand,.15)
    rounded('Pillow top',(0,0,.54),(width,2.5,.18),cream,.085)
    pipe('Upper piping',round_rect(0,0,.602,width-.03,2.47,.17),piping,.014)
    pipe('Lower piping',round_rect(0,0,.09,width,2.5,.17),piping,.013)
    pipe('Middle side seam',round_rect(0,0,.4,width,2.5,.17),piping,.009)
    quilt_x=width*.33
    for x in [-quilt_x,0,quilt_x]:
        for y in [-.93,-.465,0,.465,.93]:
            sphere('Quilted pillow top',(x,y,.615),(min(.28,width*.14),.22,.028),cream)
    for x in [-.29,.29]:
        for y in [-.6975,-.2325,.2325,.6975]:
            sphere('Mattress tuft button',(x,y,.627),(.027,.027,.008),sand)
    # Quilting seam network on the real top surface; two parallel small side handles.
    for x in [-width*.17,width*.17]:pipe('Long quilt seam',[(x,-1.05,.633),(x,1.05,.633)],piping,.004,False)
    for y in [-.7,-.235,.235,.7]:pipe('Cross quilt seam',[(-width*.39,y,.633),(width*.39,y,.633)],piping,.004,False)
    for x in [-width/2+.08,width/2-.08]:
        for y in [-.6,.6]:rounded('Carry handle',(x,y,.28),(.028,.26,.085),cream,.02)

def chair(with_back=True):
    for x in [-.39,.39]:
        for y in [-.35,.35]:leg('Chair oak leg',x,y,.75)
    rounded('Wood seat support',(0,0,.71),(.95,.9,.13),wood,.055)
    rounded('Chair upholstered seat',(0,-.02,.82),(1.03,.97,.22),rose,.11)
    pipe('Chair seat piping',round_rect(0,-.02,.85,.97,.91,.12),roseSeam)
    if with_back:
        for x in [-.37,.37]:rounded('Oak back support',(x,.37,1.16),(.08,.08,.87),wood,.025)
        back=rounded('Chair upholstered back',(0,.4,1.36),(1.04,.19,.76),rose,.12);back.rotation_euler[0]=-.08
        for x in [-.21,.21]:sphere('Chair upholstered tuft',(x,.296,1.39),(.025,.012,.025),roseSeam)

def mattress_single(): mattress(1.35)
def mattress_double(): mattress(1.78)
def chair_seat(): chair(False)
def chair_back(): chair(True)

def other():
    # Optional neutral pouf for Other, not a claim to represent submitted furniture.
    rounded('Ottoman body',(0,0,.36),(1.2,1.1,.72),sand,.24)
    rounded('Ottoman cushion',(0,0,.73),(1.22,1.12,.22),cream,.1)
    pipe('Ottoman piping',round_rect(0,0,.78,1.17,1.07,.19),piping,.012)

def reset():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for data in bpy.data.meshes:
        if not data.users:bpy.data.meshes.remove(data)

def setup_render(name):
    s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True
    s.render.resolution_x=1000;s.render.resolution_y=780;s.render.resolution_percentage=100
    s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.film_transparent=True
    s.view_settings.view_transform='AgX'
    s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.82,.86,1,1)
    s.world.node_tree.nodes['Background'].inputs[1].default_value=.4
    bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Poster shadow receiver';floor.is_shadow_catcher=True
    floor.data.materials.append(material('Floor',(0.92,.93,.96)))
    bpy.ops.object.camera_add(location=(4,-6,4.8 if name.startswith('mattress') else 3.45))
    camera=bpy.context.object;camera.name='Poster camera';target=Vector((0,0,.85 if name in ['armchair','chair','chair_back'] else .7 if name=='sofa' else .25 if name.startswith('mattress') else .45))
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=5.8 if name=='sofa_corner' else 4.9 if name=='sofa_three' else 4.2 if name=='sofa' else 3.7 if name.startswith('mattress') else 3.35 if name in ['armchair','recliner','chair','chair_back'] else 2.75
    s.camera=camera
    for loc,energy,size in [((-3,-4,6),650,5),((4,0,4),400,4),((0,4,5),500,3)]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=energy;o.data.shape='DISK';o.data.size=size
        o.rotation_euler=(Vector((0,0,.5))-o.location).to_track_quat('-Z','Y').to_euler()

reset()
bpy.context.preferences.filepaths.save_version=0
purple=material('Lavender boucle',(.49,.39,.68))
lightpurple=material('Soft lavender cushions',(.64,.54,.81))
seam=material('Lavender stitching',(.71,.64,.85))
blue=material('Mist blue fabric',(.35,.56,.62))
lightblue=material('Pale blue cushions',(.52,.72,.76))
blueSeam=material('Blue stitching',(.66,.8,.82))
cream=material('Ivory cotton',(.92,.9,.82))
sand=material('Warm greige mattress border',(.67,.64,.57))
piping=material('Ivory piping',(.82,.8,.72))
wood=material('Natural pale oak',(.48,.31,.19),.65)
rose=material('Muted blush upholstery',(.72,.45,.47))
roseSeam=material('Blush stitching',(.57,.29,.32))
for name,builder in [('sofa',sofa),('sofa_three',sofa_three),('sofa_corner',sofa_corner),('armchair',armchair),('recliner',recliner),('mattress',mattress),('mattress_single',mattress_single),('mattress_double',mattress_double),('chair',chair),('chair_seat',chair_seat),('chair_back',chair_back),('other',other)]:
    if os.environ.get('PLYUSH_MODEL') and os.environ['PLYUSH_MODEL']!=name:continue
    reset();builder()
    # Convert curves and keep UVs generated by primitives. These are fully self-contained assets.
    bpy.ops.object.select_all(action='SELECT')
    for o in list(bpy.context.selected_objects):
        if o.type=='CURVE':
            bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True)
    setup_render(name)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/(name+'.blend')))
    bpy.context.scene.render.filepath=str(OUT/(name+'-poster.png'))
    bpy.ops.render.render(write_still=True)
    try:
        from PIL import Image
        Image.open(OUT/(name+'-poster.png')).save(OUT/(name+'-poster.webp'),'WEBP',quality=86,method=6)
    except ImportError:
        print('Optional Pillow is absent; PNG poster created, WebP conversion skipped.')
    print('FINISHED',name,flush=True)
