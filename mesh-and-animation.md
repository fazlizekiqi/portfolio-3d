# Blender 5.0 — Export Guide for Mesh + Walking Animation

---

## The Problem

| File | Has Mesh | Has Armature/Bones | Has Animations |
|------|----------|--------------------|----------------|
| `only-mesh-i-think.glb` | ✅ | ❌ | ❌ |
| `walking.glb` | ❌ | ✅ (`mixamorig:` bones) | ✅ |

The mesh has **no skeleton**, so animations cannot drive it.  
You need to **bind the mesh to the armature** in Blender, then export them as two separate GLBs.

---

## Part 1 — Fix the Mesh Export (`only-mesh-i-think.glb`)

This file must be re-exported **with the armature attached**.

### Steps in Blender 5.0:

1. **Open your Blender file** that contains the character mesh and the armature.

2. **Verify the mesh has an Armature modifier:**
    - Select the mesh object
    - Go to **Properties → Modifier Properties** (wrench icon)
    - You should see an **Armature modifier** pointing to your armature object
    - If it's missing: Add it via **Add Modifier → Armature**, then set the **Object** field to your armature

3. **Verify vertex groups exist:**
    - With the mesh selected, go to **Properties → Object Data Properties** (green triangle icon)
    - Scroll down to **Vertex Groups** — you should see groups named like `mixamorig:LeftArm`, `mixamorig:Hips`, etc.
    - If empty, you need to **parent the mesh to the armature with automatic weights**: select mesh → shift-select armature → `Ctrl+P` → **With Automatic Weights**

4. **Select both objects for export:**
    - Click the **Armature** in the outliner
    - Then `Shift+Click` the **Mesh** object
    - *(Both must be selected)*

5. **Export as GLB:**
    - Go to **File → Export → glTF 2.0 (.glb/.gltf)**
    - Set filename: `only-mesh-i-think.glb`
    - In the export panel on the right, use these settings:

   **Format:** `glTF Binary (.glb)`

   **Include section:**
    - ✅ Selected Objects
    - ✅ Custom Properties

   **Transform section:**
    - ✅ +Y Up  *(leave default)*

   **Geometry section:**
    - ✅ Apply Modifiers
    - ✅ UVs
    - ✅ Normals
    - ✅ Vertex Colors *(if any)*
    - ✅ Attributes

   **Armature section:**
    - ✅ Export Deform Bones Only → **UNCHECKED** (export all bones)
    - ✅ Rest & Pose Bones
    - Bone Influences: leave at default

   **Animation section:**
    - ❌ **Uncheck "Animation"** — we do NOT want animations in this file
    - This keeps the file as mesh + armature/skeleton only

6. Click **Export glTF 2.0**

---

## Part 2 — Export the Walking Animation (`walking.glb`)

This file must export **only the armature + animation**, no mesh.

### Steps in Blender 5.0:

1. **Select only the Armature object** in the outliner (deselect the mesh)

2. **Make sure the walking action is active:**
    - Open the **Action Editor** (switch an editor to Action Editor, or use the NLA Editor)
    - Confirm the correct walking action is loaded on the armature

3. **Export as GLB:**
    - Go to **File → Export → glTF 2.0 (.glb/.gltf)**
    - Set filename: `walking.glb`

   **Include section:**
    - ✅ Selected Objects *(only armature is selected)*

   **Geometry section:**
    - Everything can be off — no mesh is selected

   **Armature section:**
    - ✅ Export Deform Bones Only → **UNCHECKED**

   **Animation section:**
    - ✅ **Animation** — ENABLED
    - ✅ Use Current Action (or NLA tracks if using NLA)
    - Animation name should be: `mixamo.com`
    - ✅ Export Extras

4. Click **Export glTF 2.0**

---

## Critical Rule — Bone Names Must Match

The mesh's **vertex groups** and the animation's **bone tracks** must use the **exact same bone names**.

Your `walking.glb` already uses:
```
mixamorig:Hips
mixamorig:Spine
mixamorig:LeftArm
mixamorig:RightLeg
... etc
```

Your mesh's vertex groups in Blender **must also be named** `mixamorig:Hips`, `mixamorig:Spine`, etc.  
If they don't match, the animation will not move the mesh.

---

## Quick Verification (after export)

After re-exporting, drag-drop each GLB into https://gltf-viewer.donmccurdy.com/ to verify:

| File | Should show |
|------|-------------|
| `only-mesh-i-think.glb` | Mesh visible + skeleton visible in skeleton view, **no animation** listed |
| `walking.glb` | No mesh, animation listed in the dropdown, skeleton moves when played |

Once both files are correct, the Three.js code will load the mesh from one file and inject the walking animation clip into the same `AnimationMixer` — bones drive the mesh because they share the same names.
