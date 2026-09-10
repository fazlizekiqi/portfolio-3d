"""
Blender 5.1 Script — 22 Game Room, Fitness & Recreation 3D Props
════════════════════════════════════════════════════════════════════
Objects ONLY — NO cameras, NO lights added.
Each asset lives in its own named collection.
Run via: Blender Scripting editor → Run Script

WARNING: clears the entire scene first.
"""

import bpy
import math

# ══════════════════════════════════════════════════════════════════════
#  CLEAR SCENE
# ══════════════════════════════════════════════════════════════════════
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for col in list(bpy.data.collections):
    bpy.data.collections.remove(col)

# ══════════════════════════════════════════════════════════════════════
#  MATERIAL CACHE  (Principled BSDF, PBR)
# ══════════════════════════════════════════════════════════════════════
_MAT_CACHE = {}

def mat(name, rgb, rough=0.5, metal=0.0):
    """Return a cached Principled BSDF material."""
    if name in _MAT_CACHE:
        return _MAT_CACHE[name]
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out  = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
    bsdf.inputs['Roughness'].default_value  = rough
    bsdf.inputs['Metallic'].default_value   = metal
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    _MAT_CACHE[name] = m
    return m

# ══════════════════════════════════════════════════════════════════════
#  COLLECTION / OBJECT HELPERS
# ══════════════════════════════════════════════════════════════════════
def make_col(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c

def _link(obj, col):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    col.objects.link(obj)

def _assign_mat(obj, m):
    if m is None:
        return
    if obj.data.materials:
        obj.data.materials[0] = m
    else:
        obj.data.materials.append(m)

def cube(name, loc, sc, col, m=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.name = name; o.scale = sc
    _assign_mat(o, m); _link(o, col)
    return o

def cyl(name, loc, sc, col, m=None, v=16, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name; o.scale = sc
    _assign_mat(o, m); _link(o, col)
    return o

def sph(name, loc, sc, col, m=None, sub=3):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, location=loc)
    o = bpy.context.active_object
    o.name = name; o.scale = sc
    _assign_mat(o, m); _link(o, col)
    return o

def tor(name, loc, sc, col, m=None, maj=1.0, mn=0.15, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        location=loc,
        major_radius=maj,
        minor_radius=mn,
        rotation=rot,
    )
    o = bpy.context.active_object
    o.name = name; o.scale = sc
    _assign_mat(o, m); _link(o, col)
    return o

# ══════════════════════════════════════════════════════════════════════
#  COLOUR PALETTE
# ══════════════════════════════════════════════════════════════════════
BLK  = (0.05, 0.05, 0.05)   # near-black
MBLK = (0.08, 0.08, 0.08)   # matte black
RBLU = (0.05, 0.27, 0.80)   # royal blue
ORG  = (0.95, 0.40, 0.03)   # vivid orange
BSKT = (0.85, 0.38, 0.07)   # basketball orange
WOOD = (0.25, 0.15, 0.06)   # dark walnut
OAK  = (0.72, 0.52, 0.27)   # light oak
WBRN = (0.45, 0.25, 0.10)   # warm brown leather
CBLT = (0.06, 0.22, 0.85)   # cobalt blue
DBLU = (0.04, 0.18, 0.70)   # deep blue
TEAL = (0.05, 0.60, 0.65)   # teal
GRN  = (0.10, 0.50, 0.10)   # green
DGRN = (0.07, 0.35, 0.10)   # dark green
GOLD = (0.90, 0.72, 0.05)   # yellow-gold
WHT  = (0.95, 0.95, 0.95)   # white
LGRY = (0.60, 0.60, 0.60)   # light grey
DGRY = (0.20, 0.20, 0.20)   # dark grey
RED  = (0.80, 0.08, 0.08)   # red
CORK = (0.72, 0.55, 0.32)   # cork
MBLU = (0.20, 0.45, 0.80)   # medium blue
GLASS= (0.70, 0.85, 0.95)   # glass tint
SOIL = (0.22, 0.14, 0.06)   # soil brown

P = math.pi

# ══════════════════════════════════════════════════════════════════════
#  GRID LAYOUT  — 5 columns, 6 units apart
# ══════════════════════════════════════════════════════════════════════
def pos(idx, cols=5, step=6.0):
    return (idx % cols * step, idx // cols * step, 0.0)


# ══════════════════════════════════════════════════════════════════════
#  01 — ARCADE BASKETBALL MACHINE
# ══════════════════════════════════════════════════════════════════════
def make_basketball_machine(base):
    c = make_col("01_Basketball_Machine")
    ox, oy = base[0], base[1]

    m_blue  = mat("bm_blue",  RBLU, rough=0.25, metal=0.0)
    m_black = mat("bm_black", MBLK, rough=0.55, metal=0.4)
    m_org   = mat("bm_org",   ORG,  rough=0.35, metal=0.0)
    m_ball  = mat("bm_ball",  BSKT, rough=0.65, metal=0.0)
    m_white = mat("bm_white", WHT,  rough=0.80, metal=0.0)
    m_steel = mat("bm_steel", LGRY, rough=0.30, metal=0.85)

    # ── Body
    cube("BM_Body",        (ox,        oy,       1.20), (0.55, 0.45, 1.20), c, m_blue)
    cube("BM_Backboard",   (ox,        oy-0.05,  2.55), (0.50, 0.08, 0.35), c, m_blue)
    # ── Net enclosure (tall rear cage)
    cyl( "BM_NetEnc",      (ox,        oy,       2.30), (0.42, 0.42, 0.55), c, m_black, v=8)
    # ── Ball-return ramp
    cube("BM_Ramp",        (ox,        oy+0.42,  0.38), (0.50, 0.12, 0.14), c, m_black)
    # ── Hoop (torus standing vertically — rotate 90° around X)
    tor( "BM_Hoop",        (ox,        oy-0.05,  2.30), (1.0,  1.0,  1.0),  c, m_org,
         maj=0.22, mn=0.025, rot=(P/2, 0, 0))
    # ── Scoreboard
    cube("BM_Scoreboard",  (ox,        oy-0.05,  2.88), (0.38, 0.06, 0.12), c, m_black)
    cube("BM_Score_Screen",(ox,        oy-0.10,  2.88), (0.28, 0.02, 0.08), c, mat("bm_led",(0.0,1.0,0.3), rough=0.1))
    # ── Corner frame posts
    for dx in (-0.50, 0.50):
        for dy in (-0.40, 0.40):
            cyl(f"BM_Post{dx}{dy}", (ox+dx*0.98, oy+dy*0.90, 1.20),
                (0.04, 0.04, 1.25), c, m_black)
    # ── Basketballs in return tray
    sph("BM_Ball1", (ox-0.20, oy+0.52, 0.54), (0.13, 0.13, 0.13), c, m_ball)
    sph("BM_Ball2", (ox+0.20, oy+0.52, 0.54), (0.13, 0.13, 0.13), c, m_ball)
    # ── Electronic panel detail
    cube("BM_Panel", (ox+0.56, oy, 1.40), (0.01, 0.20, 0.30), c, m_steel)


# ══════════════════════════════════════════════════════════════════════
#  02 — STANDING DART BOARD
# ══════════════════════════════════════════════════════════════════════
def make_dart_board(base):
    c = make_col("02_Dart_Board")
    ox, oy = base[0], base[1]

    m_cork  = mat("db_cork",  CORK, rough=0.90, metal=0.0)
    m_wood  = mat("db_wood",  WOOD, rough=0.65, metal=0.0)
    m_black = mat("db_black", MBLK, rough=0.55, metal=0.0)
    m_red   = mat("db_red",   RED,  rough=0.50, metal=0.0)
    m_green = mat("db_green", GRN,  rough=0.50, metal=0.0)
    m_steel = mat("db_steel", LGRY, rough=0.30, metal=0.90)
    m_white = mat("db_white", WHT,  rough=0.70, metal=0.0)

    # ── Board disc (face-on, rotation = 90° around X)
    cyl("DB_Board",      (ox, oy, 1.40), (0.40, 0.40, 0.04), c, m_cork, v=32,
        rot=(P/2, 0, 0))
    # ── Scoring sections (thin discs, same orientation)
    for r, m_seg in zip([0.30, 0.20, 0.10], [m_red, m_green, m_black]):
        tor(f"DB_Ring{r}", (ox, oy, 1.40), (1.0, 1.0, 1.0), c, m_seg,
            maj=r, mn=0.025, rot=(P/2, 0, 0))
    # ── Bull's eye
    cyl("DB_Bull",       (ox, oy-0.04, 1.40), (0.06, 0.06, 0.01), c, m_red, v=16,
        rot=(P/2, 0, 0))
    # ── Outer black metal ring
    tor("DB_OuterRing",  (ox, oy, 1.40), (1.0, 1.0, 1.0), c, m_black,
        maj=0.41, mn=0.018, rot=(P/2, 0, 0))
    # ── Vertical stand post
    cyl("DB_Post",       (ox, oy, 0.70), (0.04, 0.04, 0.70), c, m_wood)
    # ── Horizontal base bar
    cube("DB_Base",      (ox, oy, 0.05), (0.38, 0.18, 0.05), c, m_wood)
    # ── Three darts (steel shafts sticking into board)
    dart_data = [(0.10, 0.08, m_red), (-0.08, 0.12, m_green), (0.02, -0.10, m_steel)]
    for i, (bx, bz, dm) in enumerate(dart_data):
        cyl(f"DB_Dart{i}", (ox+bx, oy-0.10, 1.40+bz), (0.008, 0.008, 0.14), c, dm,
            rot=(P/2, 0, 0))
        # Dart tip cone (approximate with small cylinder)
        cyl(f"DB_Tip{i}", (ox+bx, oy-0.23, 1.40+bz), (0.004, 0.004, 0.03), c, m_steel,
            rot=(P/2, 0, 0))


# ══════════════════════════════════════════════════════════════════════
#  03 — INDOOR EXERCISE BIKE
# ══════════════════════════════════════════════════════════════════════
def make_exercise_bike(base):
    c = make_col("03_Exercise_Bike")
    ox, oy = base[0], base[1]

    m_black = mat("eb_black", MBLK, rough=0.55, metal=0.55)
    m_gold  = mat("eb_gold",  GOLD, rough=0.30, metal=0.85)
    m_gray  = mat("eb_gray",  DGRY, rough=0.40, metal=0.35)
    m_white = mat("eb_white", WHT,  rough=0.70, metal=0.0)
    m_rubb  = mat("eb_rubb",  BLK,  rough=0.85, metal=0.0)

    # ── Flywheel
    cyl("EB_Flywheel_body", (ox-0.38, oy, 0.42), (0.36, 0.05, 0.36), c, m_black, v=40)
    cyl("EB_Flywheel_rim",  (ox-0.38, oy, 0.42), (0.38, 0.04, 0.38), c, m_gold,  v=40)
    cyl("EB_Flywheel_hub",  (ox-0.38, oy, 0.42), (0.06, 0.07, 0.06), c, m_gray,  v=16)
    # ── Base feet
    cube("EB_BaseFront", (ox-0.38, oy, 0.05), (0.38, 0.06, 0.05), c, m_black)
    cube("EB_BaseRear",  (ox+0.30, oy, 0.05), (0.28, 0.06, 0.05), c, m_black)
    # ── Main frame triangle tubes
    cyl("EB_FrameTop",   (ox-0.05, oy, 0.72), (0.04, 0.04, 0.55), c, m_black,
        rot=(0.0, 0.45, 0.0))
    cyl("EB_FrameBot",   (ox-0.05, oy, 0.28), (0.04, 0.04, 0.55), c, m_black,
        rot=(0.0, -0.22, 0.0))
    # ── Seat post + seat
    cyl("EB_SeatPost",   (ox+0.22, oy, 0.55), (0.04, 0.04, 0.38), c, m_black)
    cube("EB_Seat",      (ox+0.22, oy, 0.97), (0.20, 0.14, 0.04), c, m_rubb)
    # ── Handlebar post + bar
    cyl("EB_HbarPost",   (ox-0.18, oy, 0.80), (0.04, 0.04, 0.38), c, m_black)
    cyl("EB_Hbar",       (ox-0.18, oy, 1.18), (0.30, 0.04, 0.04), c, m_gray,
        rot=(0, P/2, 0))
    # ── Pedal crank + pedals
    cyl("EB_Crank",      (ox-0.38, oy, 0.42), (0.22, 0.025, 0.025), c, m_black,
        rot=(0, P/2, 0))
    cube("EB_PedalL",    (ox-0.60, oy+0.18, 0.42), (0.09, 0.04, 0.025), c, m_rubb)
    cube("EB_PedalR",    (ox-0.16, oy-0.18, 0.42), (0.09, 0.04, 0.025), c, m_rubb)
    # ── Display console
    cube("EB_Console",   (ox-0.18, oy, 1.32), (0.18, 0.05, 0.11), c, m_black)
    cube("EB_Screen",    (ox-0.18, oy+0.06, 1.32), (0.12, 0.02, 0.07), c, m_white)


# ══════════════════════════════════════════════════════════════════════
#  04 — MODERN LOUNGE SOFA
# ══════════════════════════════════════════════════════════════════════
def make_sofa(base):
    c = make_col("04_Lounge_Sofa")
    ox, oy = base[0], base[1]

    m_leath = mat("sofa_leath", WBRN, rough=0.50, metal=0.0)
    m_dark  = mat("sofa_dark",  WOOD, rough=0.55, metal=0.0)

    # ── Platform base
    cube("Sofa_Base",  (ox, oy, 0.22), (1.25, 0.55, 0.22), c, m_leath)
    # ── Three seat cushions
    for i, dx in enumerate((-0.80, 0.0, 0.80)):
        cube(f"Sofa_Seat{i}",  (ox+dx, oy-0.02, 0.52), (0.36, 0.50, 0.12), c, m_leath)
    # ── Back cushions
    for i, dx in enumerate((-0.80, 0.0, 0.80)):
        cube(f"Sofa_Back{i}",  (ox+dx, oy-0.40, 0.80), (0.36, 0.12, 0.32), c, m_leath)
    # ── Sofa back top rail
    cube("Sofa_TopRail", (ox, oy-0.44, 1.18), (1.25, 0.06, 0.06), c, m_dark)
    # ── Arm rests
    cube("Sofa_ArmL",   (ox-1.28, oy, 0.72), (0.15, 0.55, 0.50), c, m_leath)
    cube("Sofa_ArmR",   (ox+1.28, oy, 0.72), (0.15, 0.55, 0.50), c, m_leath)
    # ── Legs (4 small cylinders)
    for dx in (-0.95, 0.95):
        for dy in (-0.40, 0.40):
            cyl(f"Sofa_Leg{dx}{dy}", (ox+dx, oy+dy, 0.06), (0.04, 0.04, 0.06), c, m_dark)


# ══════════════════════════════════════════════════════════════════════
#  05 — COFFEE TABLE
# ══════════════════════════════════════════════════════════════════════
def make_coffee_table(base):
    c = make_col("05_Coffee_Table")
    ox, oy = base[0], base[1]

    m_oak   = mat("ct_oak",   OAK,  rough=0.40, metal=0.0)
    m_black = mat("ct_black", MBLK, rough=0.50, metal=0.35)
    m_white = mat("ct_white", WHT,  rough=0.70, metal=0.0)
    m_beige = mat("ct_beige", (0.85, 0.75, 0.60), rough=0.55)

    # ── Tabletop
    cube("CT_Top",    (ox, oy, 0.40), (0.92, 0.52, 0.04), c, m_oak)
    # ── Four tapered legs
    for dx in (-0.78, 0.78):
        for dy in (-0.40, 0.40):
            cyl(f"CT_Leg{dx}{dy}", (ox+dx, oy+dy, 0.20), (0.030, 0.030, 0.20), c, m_black)
    # ── Coffee mug 1
    cyl("CT_Mug1",    (ox-0.30, oy-0.12, 0.49), (0.07, 0.07, 0.10), c, m_white, v=16)
    tor("CT_Handle1", (ox-0.22, oy-0.12, 0.49), (1.0, 1.0, 1.0),    c, m_white,
        maj=0.04, mn=0.008, rot=(P/2, 0, 0))
    # ── Coffee mug 2
    cyl("CT_Mug2",    (ox+0.22, oy+0.10, 0.49), (0.07, 0.07, 0.10), c, m_beige, v=16)
    tor("CT_Handle2", (ox+0.30, oy+0.10, 0.49), (1.0, 1.0, 1.0),    c, m_beige,
        maj=0.04, mn=0.008, rot=(P/2, 0, 0))
    # ── Remote control
    cube("CT_Remote", (ox+0.46, oy-0.08, 0.46), (0.13, 0.05, 0.018), c, m_black)
    # ── Smartphone
    cube("CT_Phone",  (ox-0.08, oy+0.28, 0.46), (0.08, 0.04, 0.014), c, m_black)
    cube("CT_PhScrn", (ox-0.08, oy+0.29, 0.46), (0.065, 0.03, 0.005),
         c, mat("ct_scrn",(0.2,0.6,1.0), rough=0.05))


# ══════════════════════════════════════════════════════════════════════
#  06 — BEAN BAG CHAIR
# ══════════════════════════════════════════════════════════════════════
def make_bean_bag(base):
    c = make_col("06_Bean_Bag")
    ox, oy = base[0], base[1]

    m_blue = mat("bb_blue", CBLT, rough=0.80, metal=0.0)

    sph("BB_Body",  (ox, oy, 0.50), (0.58, 0.58, 0.44), c, m_blue, sub=4)
    # Slight top-surface sag
    sph("BB_Sag",   (ox, oy, 0.82), (0.28, 0.28, 0.12), c, m_blue, sub=3)
    # Seam stripe
    tor("BB_Seam",  (ox, oy, 0.46), (1.0, 1.0, 1.0), c,
        mat("bb_seam",(0.04,0.16,0.70), rough=0.85),
        maj=0.52, mn=0.018, rot=(0, 0, 0))


# ══════════════════════════════════════════════════════════════════════
#  07 — VENDING MACHINE
# ══════════════════════════════════════════════════════════════════════
def make_vending_machine(base):
    c = make_col("07_Vending_Machine")
    ox, oy = base[0], base[1]

    m_black = mat("vm_black",  MBLK, rough=0.50, metal=0.45)
    m_glass = mat("vm_glass",  GLASS,rough=0.05, metal=0.0)
    m_teal  = mat("vm_teal",   TEAL, rough=0.30, metal=0.0)
    m_red   = mat("vm_red",    RED,  rough=0.50, metal=0.0)
    m_org   = mat("vm_org",    ORG,  rough=0.50, metal=0.0)
    m_white = mat("vm_white",  WHT,  rough=0.70, metal=0.0)
    m_yel   = mat("vm_yel",    GOLD, rough=0.40, metal=0.0)

    # ── Cabinet
    cube("VM_Body",   (ox,       oy,       1.00),  (0.58, 0.38, 1.00), c, m_black)
    cube("VM_Top",    (ox,       oy,       2.06),  (0.58, 0.38, 0.06), c, m_black)
    # ── Glass window (front)
    cube("VM_Glass",  (ox,       oy+0.35,  0.95),  (0.42, 0.02, 0.72), c, m_glass)
    # ── Dispensing slot
    cube("VM_Slot",   (ox,       oy+0.40,  0.15),  (0.26, 0.03, 0.07), c, m_black)
    cube("VM_SlotF",  (ox,       oy+0.38,  0.15),  (0.22, 0.02, 0.05), c, m_teal)
    # ── Payment panel
    cube("VM_Pay",    (ox+0.32,  oy+0.35,  0.95),  (0.11, 0.025, 0.28), c, m_teal)
    cube("VM_Screen", (ox+0.32,  oy+0.36,  1.05),  (0.08, 0.01,  0.10), c, m_white)
    # ── Product rows (3 rows × 3 cols)
    prod_mats = [m_red, m_org, m_teal, m_white, m_yel, m_red, m_org, m_teal, m_white]
    for row in range(3):
        for col2 in range(3):
            cube(f"VM_Prod{row}{col2}",
                 (ox - 0.22 + col2 * 0.22, oy + 0.29, 0.42 + row * 0.38),
                 (0.09, 0.04, 0.16), c, prod_mats[row * 3 + col2])


# ══════════════════════════════════════════════════════════════════════
#  08 — INDOOR POTTED PLANT
# ══════════════════════════════════════════════════════════════════════
def make_potted_plant(base):
    c = make_col("08_Potted_Plant")
    ox, oy = base[0], base[1]

    m_black = mat("pp_black", MBLK, rough=0.80, metal=0.0)
    m_green = mat("pp_green", GRN,  rough=0.80, metal=0.0)
    m_dgrn  = mat("pp_dgrn",  DGRN, rough=0.80, metal=0.0)
    m_soil  = mat("pp_soil",  SOIL, rough=0.90, metal=0.0)

    # ── Square planter
    cube("PP_Pot",    (ox, oy, 0.20), (0.30, 0.30, 0.22), c, m_black)
    cube("PP_Soil",   (ox, oy, 0.43), (0.28, 0.28, 0.02), c, m_soil)
    # ── Central stem cluster
    cyl("PP_Stem",    (ox, oy, 0.75), (0.05, 0.05, 0.35), c, m_dgrn)
    # ── Radiating long leaves
    leaf_angles = [i * (2 * P / 9) for i in range(9)]
    for i, ang in enumerate(leaf_angles):
        lx = ox + 0.38 * math.cos(ang)
        ly = oy + 0.38 * math.sin(ang)
        lz = 0.88 + i * 0.06
        bpy.ops.mesh.primitive_cube_add(location=(lx, ly, lz))
        leaf = bpy.context.active_object
        leaf.name = f"PP_Leaf{i}"
        leaf.scale = (0.28, 0.055, 0.018)
        leaf.rotation_euler = (math.radians(-18), 0.0, ang)
        _assign_mat(leaf, m_green if i % 2 == 0 else m_dgrn)
        _link(leaf, c)
    # ── Second tier of shorter leaves
    for i in range(6):
        ang = i * (2 * P / 6) + P / 6
        lx = ox + 0.22 * math.cos(ang)
        ly = oy + 0.22 * math.sin(ang)
        bpy.ops.mesh.primitive_cube_add(location=(lx, ly, 1.28))
        leaf = bpy.context.active_object
        leaf.name = f"PP_Leaf2_{i}"
        leaf.scale = (0.20, 0.04, 0.015)
        leaf.rotation_euler = (math.radians(-8), 0.0, ang)
        _assign_mat(leaf, m_green)
        _link(leaf, c)


# ══════════════════════════════════════════════════════════════════════
#  09 — WOODEN STORAGE SHELF
# ══════════════════════════════════════════════════════════════════════
def make_storage_shelf(base):
    c = make_col("09_Storage_Shelf")
    ox, oy = base[0], base[1]

    m_wood  = mat("sh_wood",  OAK,  rough=0.50, metal=0.0)
    m_blue  = mat("sh_blue",  MBLU, rough=0.60, metal=0.0)
    m_green = mat("sh_green", GRN,  rough=0.60, metal=0.0)
    m_black = mat("sh_black", MBLK, rough=0.60, metal=0.0)
    m_white = mat("sh_white", WHT,  rough=0.70, metal=0.0)
    m_red   = mat("sh_red",   RED,  rough=0.60, metal=0.0)

    # ── Side panels
    cube("SH_SideL", (ox-0.58, oy, 1.25), (0.03, 0.20, 1.25), c, m_wood)
    cube("SH_SideR", (ox+0.58, oy, 1.25), (0.03, 0.20, 1.25), c, m_wood)
    # ── Back panel
    cube("SH_Back",  (ox, oy-0.20, 1.25), (0.58, 0.02, 1.25), c, m_wood)
    # ── 5 shelves (index 0..5 = floor + 4 levels)
    for i in range(6):
        cube(f"SH_Shelf{i}", (ox, oy, i * 0.46 + 0.04), (0.56, 0.19, 0.025), c, m_wood)
    # ── Books (2 per shelf, shelves 1-4)
    book_colors = [m_blue, m_green, m_black, m_red, m_white, m_blue, m_green, m_black]
    for i, bm in enumerate(book_colors):
        shelf = (i // 2) + 1
        slot  = i % 2
        bx    = ox - 0.22 + slot * 0.44
        bz    = shelf * 0.46 + 0.20
        cube(f"SH_Book{i}", (bx, oy - 0.02, bz), (0.055, 0.16, 0.17), c, bm)
    # ── Decorative items
    cube("SH_Box1",   (ox + 0.32, oy, 1.38), (0.11, 0.13, 0.11), c, m_black)
    cube("SH_Box2",   (ox - 0.32, oy, 0.90), (0.13, 0.13, 0.10), c, m_white)
    cyl( "SH_Vase",   (ox + 0.10, oy, 1.85), (0.06, 0.06, 0.10), c, m_blue, v=16)


# ══════════════════════════════════════════════════════════════════════
#  10 — TABLE TENNIS TABLE
# ══════════════════════════════════════════════════════════════════════
def make_table_tennis(base):
    c = make_col("10_Table_Tennis")
    ox, oy = base[0], base[1]

    m_green = mat("tt_green", DGRN, rough=0.55, metal=0.0)
    m_white = mat("tt_white", WHT,  rough=0.70, metal=0.0)
    m_black = mat("tt_black", MBLK, rough=0.50, metal=0.55)
    m_red   = mat("tt_red",   RED,  rough=0.55, metal=0.0)

    # ── Playing surface
    cube("TT_Surface",   (ox, oy, 0.80),   (1.40, 0.78, 0.04),   c, m_green)
    # ── White boundary lines
    cube("TT_LineL",     (ox-1.35, oy, 0.845), (0.018, 0.76, 0.005), c, m_white)
    cube("TT_LineR",     (ox+1.35, oy, 0.845), (0.018, 0.76, 0.005), c, m_white)
    cube("TT_LineFront", (ox, oy-0.76, 0.845), (1.36, 0.018, 0.005), c, m_white)
    cube("TT_LineBack",  (ox, oy+0.76, 0.845), (1.36, 0.018, 0.005), c, m_white)
    cube("TT_LineCenter",(ox, oy, 0.845),       (1.36, 0.010, 0.005), c, m_white)
    # ── Net poles
    cube("TT_NetPoleL",  (ox-1.38, oy, 0.91), (0.025, 0.025, 0.07), c, m_black)
    cube("TT_NetPoleR",  (ox+1.38, oy, 0.91), (0.025, 0.025, 0.07), c, m_black)
    # ── Net
    cube("TT_Net",       (ox, oy, 0.92),      (1.38, 0.008, 0.06), c, m_black)
    # ── Legs (4)
    for dx in (-1.15, 1.15):
        for dy in (-0.58, 0.58):
            cyl(f"TT_Leg{dx}{dy}", (ox+dx, oy+dy, 0.40), (0.032, 0.032, 0.40), c, m_black)
    # ── Red paddle
    cyl( "TT_PaddleR",   (ox+0.90, oy+0.20, 0.858), (0.10, 0.10, 0.012), c, m_red,  v=20)
    cube("TT_PaddleRH",  (ox+0.90, oy+0.02, 0.858), (0.038, 0.14, 0.012), c, m_black)
    # ── Black paddle
    cyl( "TT_PaddleB",   (ox-0.90, oy+0.20, 0.858), (0.10, 0.10, 0.012), c, m_black, v=20)
    cube("TT_PaddleBH",  (ox-0.90, oy+0.02, 0.858), (0.038, 0.14, 0.012), c, m_black)
    # ── Ball
    sph( "TT_Ball",      (ox, oy+0.55, 0.87),       (0.040, 0.040, 0.040), c, m_white)


# ══════════════════════════════════════════════════════════════════════
#  11 — FOOSBALL TABLE
# ══════════════════════════════════════════════════════════════════════
def make_foosball(base):
    c = make_col("11_Foosball_Table")
    ox, oy = base[0], base[1]

    m_black = mat("fs_black",  MBLK, rough=0.50, metal=0.45)
    m_field = mat("fs_field",  (0.05, 0.55, 0.12), rough=0.55)
    m_white = mat("fs_white",  WHT,  rough=0.50, metal=0.0)
    m_green = mat("fs_plgrn",  GRN,  rough=0.50, metal=0.0)
    m_gray  = mat("fs_gray",   LGRY, rough=0.35, metal=0.80)

    # ── Table body
    cube("FS_Body",    (ox, oy, 0.55), (1.35, 0.90, 0.55), c, m_black)
    # ── Playing field
    cube("FS_Field",   (ox, oy, 1.10), (1.18, 0.76, 0.02), c, m_field)
    # ── Field markings
    cube("FS_MidLine", (ox, oy, 1.13), (1.15, 0.010, 0.004), c, m_white)
    cube("FS_Circle",  (ox, oy, 1.13), (0.18, 0.18, 0.004), c,
         mat("fs_circle",(0.9,0.9,0.9),rough=0.5))
    # ── Goals
    cube("FS_GoalL",   (ox-1.15, oy, 1.10), (0.05, 0.26, 0.10), c, m_black)
    cube("FS_GoalR",   (ox+1.15, oy, 1.10), (0.05, 0.26, 0.10), c, m_black)
    # ── 8 player rods (passing through table)
    rod_x_offsets = [-0.90, -0.62, -0.30, 0.0, 0.0, 0.30, 0.62, 0.90]
    players_per_rod = [1, 2, 5, 3, 3, 5, 2, 1]
    for i in range(8):
        rx = ox + (i - 3.5) * 0.30
        cyl(f"FS_Rod{i}", (rx, oy, 1.10), (0.018, 0.018, 0.56), c, m_gray,
            rot=(P/2, 0, 0))
        n_pl = players_per_rod[i]
        for j in range(n_pl):
            py = oy + (j - (n_pl - 1) / 2) * (0.60 / max(n_pl, 2))
            pmat = m_white if i < 4 else m_green
            cyl(f"FS_Pl{i}_{j}", (rx, py, 1.21), (0.045, 0.045, 0.12), c, pmat)
    # ── Handles (both ends of each rod)
    for i in range(8):
        rx = ox + (i - 3.5) * 0.30
        for side, sy in ((-1, oy - 1.05), (1, oy + 1.05)):
            cyl(f"FS_Handle{i}_{side}", (rx, sy, 1.10), (0.032, 0.032, 0.14),
                c, m_black, rot=(P/2, 0, 0))
    # ── Legs
    for dx in (-1.25, 1.25):
        for dy in (-0.72, 0.72):
            cyl(f"FS_Leg{dx}{dy}", (ox+dx, oy+dy, 0.14), (0.040, 0.040, 0.14), c, m_black)


# ══════════════════════════════════════════════════════════════════════
#  12 — WATER COOLER
# ══════════════════════════════════════════════════════════════════════
def make_water_cooler(base):
    c = make_col("12_Water_Cooler")
    ox, oy = base[0], base[1]

    m_white = mat("wc_white", WHT,  rough=0.40, metal=0.0)
    m_blue  = mat("wc_blue",  (0.55, 0.80, 0.95), rough=0.08, metal=0.0)
    m_gray  = mat("wc_gray",  LGRY, rough=0.45, metal=0.30)
    m_red   = mat("wc_red",   RED,  rough=0.35, metal=0.0)
    m_black = mat("wc_black", MBLK, rough=0.55, metal=0.40)

    # ── Cabinet body
    cube("WC_Cabinet",    (ox, oy, 0.62), (0.26, 0.26, 0.62), c, m_white)
    cube("WC_Cabinet_Lo", (ox, oy, 0.16), (0.28, 0.28, 0.16), c, m_white)
    # ── Door/front panel
    cube("WC_Door",       (ox, oy+0.27, 0.50), (0.22, 0.015, 0.46), c, m_gray)
    # ── Bottle seat / neck
    cyl("WC_Neck",        (ox, oy, 1.28), (0.11, 0.11, 0.06), c, m_white, v=20)
    # ── Inverted water bottle
    cyl("WC_Bottle",      (ox, oy, 1.58), (0.19, 0.19, 0.34), c, m_blue, v=28)
    cyl("WC_BottleCap",   (ox, oy, 1.94), (0.08, 0.08, 0.06), c, m_blue)
    # ── Taps
    cyl("WC_TapHot",  (ox-0.12, oy+0.29, 0.78), (0.024, 0.024, 0.040),
        c, m_red,   rot=(P/2, 0, 0))
    cyl("WC_TapCold", (ox+0.12, oy+0.29, 0.78), (0.024, 0.024, 0.040),
        c, m_blue,  rot=(P/2, 0, 0))
    # ── Drip tray
    cube("WC_Tray",   (ox, oy+0.28, 0.58), (0.24, 0.022, 0.030), c, m_gray)


# ══════════════════════════════════════════════════════════════════════
#  13 — SMALL UTILITY SIDE TABLE
# ══════════════════════════════════════════════════════════════════════
def make_side_table(base):
    c = make_col("13_Side_Table")
    ox, oy = base[0], base[1]

    m_wood  = mat("st_wood",  WBRN, rough=0.50, metal=0.0)
    m_white = mat("st_white", WHT,  rough=0.80, metal=0.0)
    m_gray  = mat("st_gray",  LGRY, rough=0.60, metal=0.0)

    # ── Top surface
    cube("ST_Top",    (ox, oy, 0.76), (0.42, 0.36, 0.03), c, m_wood)
    # ── Lower shelf
    cube("ST_Shelf",  (ox, oy, 0.40), (0.38, 0.32, 0.025), c, m_wood)
    # ── 4 legs
    for dx in (-0.34, 0.34):
        for dy in (-0.28, 0.28):
            cyl(f"ST_Leg{dx}{dy}", (ox+dx, oy+dy, 0.38), (0.026, 0.026, 0.38), c, m_wood)
    # ── Stacked towels (3 folded cubes)
    for i in range(3):
        cube(f"ST_Towel{i}", (ox-0.08, oy, 0.82 + i * 0.052),
             (0.26, 0.30, 0.026), c, m_white)
    # ── Small wicker basket
    cyl("ST_Basket",  (ox+0.22, oy, 0.48), (0.10, 0.10, 0.07), c, m_gray, v=16)
    cube("ST_BsktL",  (ox+0.12, oy, 0.52), (0.02, 0.10, 0.06), c, m_gray)
    cube("ST_BsktR",  (ox+0.32, oy, 0.52), (0.02, 0.10, 0.06), c, m_gray)


# ══════════════════════════════════════════════════════════════════════
#  14 — OLYMPIC BENCH PRESS STATION
# ══════════════════════════════════════════════════════════════════════
def make_bench_press(base):
    c = make_col("14_Bench_Press")
    ox, oy = base[0], base[1]

    m_black  = mat("bp_black",  MBLK, rough=0.50, metal=0.65)
    m_pad    = mat("bp_pad",    (0.10, 0.10, 0.10), rough=0.75)
    m_steel  = mat("bp_steel",  LGRY, rough=0.28, metal=0.92)
    m_yellow = mat("bp_yellow", GOLD, rough=0.40, metal=0.0)

    # ── Bench pad
    cube("BP_Bench",    (ox, oy, 0.56), (0.88, 0.25, 0.08), c, m_pad)
    # ── Bench legs
    for dx in (-0.78, 0.78):
        cube(f"BP_BLeg{dx}", (ox+dx, oy, 0.28), (0.06, 0.22, 0.28), c, m_black)
    # ── Rack uprights
    cyl("BP_UpL", (ox-0.58, oy-0.12, 1.12), (0.040, 0.040, 0.86), c, m_black)
    cyl("BP_UpR", (ox+0.58, oy-0.12, 1.12), (0.040, 0.040, 0.86), c, m_black)
    # ── Cross bar at rack top
    cyl("BP_Cross", (ox, oy-0.12, 1.95), (0.62, 0.030, 0.030), c, m_black,
        rot=(0, P/2, 0))
    # ── Safety catches (J-hooks)
    for dx in (-0.58, 0.58):
        cube(f"BP_Safety{dx}", (ox+dx, oy-0.12, 0.80), (0.08, 0.12, 0.038), c, m_black)
    # ── Olympic barbell
    cyl("BP_Bar", (ox, oy-0.12, 1.42), (1.45, 0.024, 0.024), c, m_steel,
        rot=(0, P/2, 0))
    cyl("BP_BarL_collar", (ox-1.10, oy-0.12, 1.42), (0.050, 0.040, 0.040), c, m_black,
        rot=(0, P/2, 0))
    cyl("BP_BarR_collar", (ox+1.10, oy-0.12, 1.42), (0.050, 0.040, 0.040), c, m_black,
        rot=(0, P/2, 0))
    # ── Weight plates (2 per side) — oriented in YZ plane, rot around Y
    for side, sx in ((-1, -0.88), (1, 0.88)):
        for k in range(2):
            off = ox + sx + side * k * 0.095
            cyl(f"BP_Plate{side}_{k}", (off, oy-0.12, 1.42),
                (0.29, 0.028, 0.29), c, m_black, rot=(0, P/2, 0))
            tor(f"BP_Ring{side}_{k}",  (off, oy-0.12, 1.42),
                (1.0, 1.0, 1.0), c, m_yellow, maj=0.23, mn=0.014, rot=(0, P/2, 0))


# ══════════════════════════════════════════════════════════════════════
#  15 — DUMBBELL RACK
# ══════════════════════════════════════════════════════════════════════
def make_dumbbell_rack(base):
    c = make_col("15_Dumbbell_Rack")
    ox, oy = base[0], base[1]

    m_black = mat("dr_black",  MBLK, rough=0.50, metal=0.65)
    m_metal = mat("dr_metal",  DGRY, rough=0.35, metal=0.85)
    m_rubb  = mat("dr_rubb",   (0.12, 0.12, 0.12), rough=0.85, metal=0.0)

    # ── Two-tier rack frame
    cube("DR_Frame",  (ox, oy, 0.48), (0.95, 0.30, 0.48), c, m_black)
    cube("DR_Shelf1", (ox, oy+0.06, 0.26), (0.90, 0.24, 0.030), c, m_black)
    cube("DR_Shelf2", (ox, oy+0.06, 0.62), (0.90, 0.24, 0.030), c, m_black)
    # ── Frame corner posts
    for dx in (-0.92, 0.92):
        for dy in (-0.27, 0.27):
            cyl(f"DR_Post{dx}{dy}", (ox+dx, oy+dy, 0.48), (0.028, 0.028, 0.48), c, m_black)

    # ── 3 pairs × 2 tiers = 6 dumbbells
    sizes = [(0.085, 0.105), (0.100, 0.125), (0.115, 0.148)]
    for tier in range(2):
        for pair in range(3):
            dx = ox - 0.58 + pair * 0.58
            dz = 0.32 + tier * 0.37
            hand_r, head_r = sizes[pair]
            # Handle shaft
            cyl(f"DR_H{tier}{pair}",   (dx, oy, dz), (hand_r, hand_r, 0.10),
                c, m_metal, rot=(0, P/2, 0))
            # Hex head plates (both ends)
            for sign in (-1, 1):
                hx = dx + sign * (hand_r + 0.038)
                cyl(f"DR_HD{tier}{pair}{sign}", (hx, oy, dz),
                    (head_r, head_r, 0.038), c, m_rubb, v=6, rot=(0, P/2, 0))


# ══════════════════════════════════════════════════════════════════════
#  16 — STABILITY EXERCISE BALL
# ══════════════════════════════════════════════════════════════════════
def make_exercise_ball(base):
    c = make_col("16_Exercise_Ball")
    ox, oy = base[0], base[1]

    m_blue = mat("exb_blue", DBLU, rough=0.50, metal=0.0)
    sph("ExBall", (ox, oy, 0.47), (0.47, 0.47, 0.47), c, m_blue, sub=4)
    # Valve nub
    cyl("ExBall_Valve", (ox, oy+0.48, 0.47), (0.018, 0.018, 0.025), c, m_blue,
        rot=(P/2, 0, 0))


# ══════════════════════════════════════════════════════════════════════
#  17 — KETTLEBELLS  (one orange, one blue)
# ══════════════════════════════════════════════════════════════════════
def make_kettlebells(base):
    c = make_col("17_Kettlebells")
    ox, oy = base[0], base[1]

    for i, (col_mat, dx) in enumerate(
        [(mat("kb_org",  ORG,  rough=0.50, metal=0.20), -0.55),
         (mat("kb_cblt", CBLT, rough=0.50, metal=0.20),  0.55)]
    ):
        # Bell body
        sph(f"KB_Body{i}",   (ox+dx, oy, 0.22), (0.20, 0.20, 0.20), c, col_mat, sub=3)
        # Flat bottom facet
        cyl(f"KB_Flat{i}",   (ox+dx, oy, 0.07), (0.14, 0.14, 0.07), c, col_mat)
        # Handle (torus rotated 90° around X so it stands upright)
        tor(f"KB_Handle{i}", (ox+dx, oy, 0.50), (1.0, 1.0, 1.0), c, col_mat,
            maj=0.12, mn=0.024, rot=(P/2, 0, 0))


# ══════════════════════════════════════════════════════════════════════
#  18 — YOGA MAT
# ══════════════════════════════════════════════════════════════════════
def make_yoga_mat(base):
    c = make_col("18_Yoga_Mat")
    ox, oy = base[0], base[1]

    m_blue = mat("ym_blue", MBLU, rough=0.90, metal=0.0)

    # ── Flat mat
    cube("YM_Mat",  (ox, oy, 0.016), (0.94, 0.36, 0.016), c, m_blue)
    # ── Rolled end edge (one short end)
    cyl("YM_RollL", (ox - 0.94, oy, 0.030), (0.048, 0.36, 0.048), c, m_blue,
        rot=(P/2, 0, 0))
    # ── Slight curl at far edge
    cyl("YM_RollR", (ox + 0.94, oy, 0.022), (0.028, 0.36, 0.028), c, m_blue,
        rot=(P/2, 0, 0))


# ══════════════════════════════════════════════════════════════════════
#  19 — FOAM ROLLER
# ══════════════════════════════════════════════════════════════════════
def make_foam_roller(base):
    c = make_col("19_Foam_Roller")
    ox, oy = base[0], base[1]

    m_blue = mat("fr_blue", MBLU, rough=0.72, metal=0.0)

    # ── Main cylinder lying on its side (along X)
    cyl("FR_Body", (ox, oy, 0.09), (0.09, 0.09, 0.36), c, m_blue,
        rot=(0, P/2, 0))
    # ── End caps
    for sign in (-1, 1):
        cyl(f"FR_Cap{sign}", (ox + sign * 0.37, oy, 0.09),
            (0.09, 0.09, 0.008), c, m_blue)
    # ── Surface ridges (decorative rings)
    for k in range(4):
        rx = ox - 0.26 + k * 0.175
        tor(f"FR_Ridge{k}", (rx, oy, 0.09), (1.0, 1.0, 1.0),
            c, mat("fr_ridge",(0.15,0.38,0.72), rough=0.65),
            maj=0.09, mn=0.008, rot=(0, P/2, 0))


# ══════════════════════════════════════════════════════════════════════
#  20 — SPORTS WATER BOTTLE
# ══════════════════════════════════════════════════════════════════════
def make_water_bottle(base):
    c = make_col("20_Water_Bottle")
    ox, oy = base[0], base[1]

    m_blue = mat("wb_blue",  CBLT, rough=0.30, metal=0.0)
    m_dark = mat("wb_dark",  DGRY, rough=0.40, metal=0.35)
    m_gray = mat("wb_gray",  LGRY, rough=0.45, metal=0.50)

    # ── Main body
    cyl("WB_Body",  (ox, oy, 0.21),  (0.072, 0.072, 0.21),   c, m_blue, v=24)
    # ── Slightly narrowed shoulder
    cyl("WB_Shoulder",(ox, oy, 0.435),(0.062, 0.062, 0.025),  c, m_blue, v=24)
    # ── Neck
    cyl("WB_Neck",  (ox, oy, 0.468), (0.042, 0.042, 0.038),  c, m_blue, v=16)
    # ── Flip-top cap body
    cyl("WB_Cap",   (ox, oy, 0.516), (0.048, 0.048, 0.038),  c, m_dark, v=16)
    # ── Nozzle
    cyl("WB_Nozzle",(ox, oy, 0.556), (0.020, 0.020, 0.042),  c, m_dark, v=12)
    # ── Cap hinge
    cube("WB_Hinge",(ox+0.05, oy, 0.528),(0.010, 0.038, 0.010), c, m_gray)
    # ── Carry loop on cap
    tor("WB_Loop",  (ox, oy, 0.575), (1.0, 1.0, 1.0), c, m_dark,
        maj=0.028, mn=0.006, rot=(P/2, 0, 0))


# ══════════════════════════════════════════════════════════════════════
#  21 — TREADMILL
# ══════════════════════════════════════════════════════════════════════
def make_treadmill(base):
    c = make_col("21_Treadmill")
    ox, oy = base[0], base[1]

    m_black = mat("tm_black", MBLK, rough=0.55, metal=0.55)
    m_belt  = mat("tm_belt",  DGRY, rough=0.85, metal=0.0)
    m_teal  = mat("tm_teal",  TEAL, rough=0.25, metal=0.0)
    m_gray  = mat("tm_gray",  LGRY, rough=0.40, metal=0.60)

    # ── Motor housing (front)
    cube("TM_Motor",   (ox-0.68, oy, 0.26),  (0.30, 0.48, 0.26), c, m_black)
    # ── Running deck frame
    cube("TM_Deck",    (ox+0.18, oy, 0.18),  (0.88, 0.48, 0.04), c, m_black)
    # ── Running belt surface
    cube("TM_Belt",    (ox+0.18, oy, 0.224), (0.84, 0.42, 0.014), c, m_belt)
    # ── Rear roller end caps
    cyl("TM_RollerF",  (ox-0.56, oy, 0.18),  (0.055, 0.055, 0.25), c, m_gray,
        rot=(P/2, 0, 0))
    cyl("TM_RollerR",  (ox+1.02, oy, 0.18),  (0.055, 0.055, 0.25), c, m_gray,
        rot=(P/2, 0, 0))
    # ── Incline leg supports
    cyl("TM_LegFL",    (ox-0.62, oy-0.40, 0.10), (0.032, 0.032, 0.10), c, m_black)
    cyl("TM_LegFR",    (ox-0.62, oy+0.40, 0.10), (0.032, 0.032, 0.10), c, m_black)
    cyl("TM_LegRL",    (ox+1.00, oy-0.35, 0.08), (0.032, 0.032, 0.08), c, m_black)
    cyl("TM_LegRR",    (ox+1.00, oy+0.35, 0.08), (0.032, 0.032, 0.08), c, m_black)
    # ── Upright handle posts
    cyl("TM_PostL",    (ox-0.62, oy-0.42, 0.90), (0.036, 0.036, 0.90), c, m_black)
    cyl("TM_PostR",    (ox-0.62, oy+0.42, 0.90), (0.036, 0.036, 0.90), c, m_black)
    # ── Cross handle bar
    cyl("TM_HandleBar",(ox-0.62, oy, 1.58),  (0.50, 0.025, 0.025), c, m_black,
        rot=(0, 0, P/2))
    # ── Angled hand grip bars
    for sign, sy in ((-1, -0.38), (1, 0.38)):
        cyl(f"TM_Grip{sign}", (ox-0.62, oy+sign*0.30, 1.32),
            (0.028, 0.028, 0.32), c, m_black, rot=(0.35, 0, 0))
    # ── Side rails (non-slip strips)
    cube("TM_RailL",   (ox+0.18, oy-0.46, 0.24), (0.88, 0.020, 0.014), c, m_gray)
    cube("TM_RailR",   (ox+0.18, oy+0.46, 0.24), (0.88, 0.020, 0.014), c, m_gray)
    # ── Display console
    cube("TM_Console", (ox-0.62, oy, 1.74), (0.30, 0.075, 0.16), c, m_black)
    cube("TM_Screen",  (ox-0.62, oy+0.05, 1.74), (0.24, 0.020, 0.10), c, m_teal)
    # ── Console button rows
    for i in range(3):
        cube(f"TM_Btn{i}", (ox-0.72+i*0.10, oy+0.08, 1.66),
             (0.030, 0.010, 0.018), c, m_gray)


# ══════════════════════════════════════════════════════════════════════
#  22 — METAL STORAGE RACK
# ══════════════════════════════════════════════════════════════════════
def make_metal_rack(base):
    c = make_col("22_Metal_Rack")
    ox, oy = base[0], base[1]

    m_black = mat("mr_black", MBLK, rough=0.50, metal=0.70)
    m_white = mat("mr_white", WHT,  rough=0.80, metal=0.0)
    m_lblue = mat("mr_lblue", MBLU, rough=0.70, metal=0.0)
    m_gray  = mat("mr_gray",  LGRY, rough=0.55, metal=0.35)

    # ── 4 vertical corner posts
    for dx in (-0.58, 0.58):
        for dy in (-0.23, 0.23):
            cyl(f"MR_Post{dx}{dy}", (ox+dx, oy+dy, 1.0), (0.026, 0.026, 1.0), c, m_black)
    # ── 5 horizontal shelf boards
    for i in range(5):
        cube(f"MR_Shelf{i}", (ox, oy, i * 0.46 + 0.05), (0.58, 0.24, 0.022), c, m_black)
    # ── Diagonal braces (front & back)
    cube("MR_BraceF", (ox, oy-0.22, 0.52), (0.56, 0.014, 0.48), c, m_black)
    cube("MR_BraceB", (ox, oy+0.22, 0.52), (0.56, 0.014, 0.48), c, m_black)

    # ── Shelf 0: folded towels
    towel_mats = [m_white, m_lblue, m_white]
    for i, tm in enumerate(towel_mats):
        cube(f"MR_Towel{i}", (ox - 0.32 + i * 0.32, oy, 0.14),
             (0.13, 0.19, 0.048), c, tm)

    # ── Shelf 1: storage bins
    for i, bx_off in enumerate((-0.28, 0.28)):
        cube(f"MR_Bin{i}", (ox + bx_off, oy, 0.60), (0.20, 0.19, 0.10), c, m_gray)

    # ── Shelf 2: sports balls
    sph("MR_Ball1", (ox - 0.30, oy, 1.13), (0.085, 0.085, 0.085), c, m_white)
    sph("MR_Ball2", (ox + 0.10, oy, 1.13), (0.085, 0.085, 0.085), c, m_lblue)
    sph("MR_Ball3", (ox + 0.40, oy, 1.13), (0.07,  0.07,  0.07),  c, m_gray)

    # ── Shelf 3: small containers
    cyl("MR_Cont1", (ox - 0.22, oy, 1.58), (0.072, 0.072, 0.10), c, m_gray)
    cyl("MR_Cont2", (ox + 0.22, oy, 1.58), (0.072, 0.072, 0.10), c, m_black)
    cube("MR_Box",  (ox + 0.45, oy, 1.56), (0.10, 0.18, 0.10), c, m_gray)

    # ── Shelf 4 top: flat items
    cube("MR_FlatItem", (ox, oy, 1.89), (0.40, 0.20, 0.030), c, m_white)


# ══════════════════════════════════════════════════════════════════════
#  BUILD ALL  22 ASSETS
# ══════════════════════════════════════════════════════════════════════
ASSET_BUILDERS = [
    make_basketball_machine,   #  01
    make_dart_board,           #  02
    make_exercise_bike,        #  03
    make_sofa,                 #  04
    make_coffee_table,         #  05
    make_bean_bag,             #  06
    make_vending_machine,      #  07
    make_potted_plant,         #  08
    make_storage_shelf,        #  09
    make_table_tennis,         #  10
    make_foosball,             #  11
    make_water_cooler,         #  12
    make_side_table,           #  13
    make_bench_press,          #  14
    make_dumbbell_rack,        #  15
    make_exercise_ball,        #  16
    make_kettlebells,          #  17
    make_yoga_mat,             #  18
    make_foam_roller,          #  19
    make_water_bottle,         #  20
    make_treadmill,            #  21
    make_metal_rack,           #  22
]

for idx, builder in enumerate(ASSET_BUILDERS):
    builder(pos(idx))

# ── Deselect everything cleanly
bpy.ops.object.select_all(action='DESELECT')

print(f"\n✅  {len(ASSET_BUILDERS)} assets generated successfully.")
print("    Each asset is in its own named collection.")
print("    No cameras or lights were added.\n")

