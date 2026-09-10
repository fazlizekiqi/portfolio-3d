import fs from 'fs';
import * as THREE from 'three';

const file = process.argv[2];
const qx = parseFloat(process.argv[3]);   // runtime world X
const qz = parseFloat(process.argv[4]);   // runtime world Z

const buf = fs.readFileSync(file);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));

const nodes = json.nodes || [];
const meshes = json.meshes || [];
const accessors = json.accessors || [];

function localMatrix(node) {
  const m = new THREE.Matrix4();
  if (node.matrix) return m.fromArray(node.matrix);
  const t = node.translation || [0, 0, 0];
  const r = node.rotation || [0, 0, 0, 1];
  const s = node.scale || [1, 1, 1];
  return m.compose(
    new THREE.Vector3(t[0], t[1], t[2]),
    new THREE.Quaternion(r[0], r[1], r[2], r[3]),
    new THREE.Vector3(s[0], s[1], s[2]),
  );
}

const results = [];
const overall = new THREE.Box3().makeEmpty();

function walk(nodeIndex, parentMatrix) {
  const node = nodes[nodeIndex];
  const world = new THREE.Matrix4().multiplyMatrices(parentMatrix, localMatrix(node));
  if (node.mesh !== undefined) {
    const mesh = meshes[node.mesh];
    const box = new THREE.Box3().makeEmpty();
    for (const prim of mesh.primitives || []) {
      const acc = accessors[prim.attributes.POSITION];
      if (!acc || !acc.min || !acc.max) continue;
      box.union(new THREE.Box3(new THREE.Vector3(...acc.min), new THREE.Vector3(...acc.max)).applyMatrix4(world));
    }
    if (!box.isEmpty()) { results.push({ name: node.name || ('node#' + nodeIndex), mesh: mesh.name, box }); overall.union(box); }
  }
  for (const c of node.children || []) walk(c, world);
}

const scene = json.scenes[json.scene || 0];
for (const n of scene.nodes) walk(n, new THREE.Matrix4());

// Runtime re-centres model: worldX = rawX - center.x  ->  rawX = worldX + center.x
const center = overall.getCenter(new THREE.Vector3());
const rx = qx + center.x;
const rz = qz + center.z;

console.log('model X/Z centre offset:', center.x.toFixed(2), center.z.toFixed(2));
console.log('query in raw model coords:', rx.toFixed(2), rz.toFixed(2));

const hits = results.filter(r => rx >= r.box.min.x && rx <= r.box.max.x && rz >= r.box.min.z && rz <= r.box.max.z);
const area = b => (b.max.x - b.min.x) * (b.max.z - b.min.z);
hits.sort((a, b) => area(a.box) - area(b.box));   // most specific (smallest footprint) first

console.log('\nobjects whose footprint covers that point (' + hits.length + '), smallest first:');
for (const h of hits) {
  const w = (h.box.max.x - h.box.min.x).toFixed(1), d = (h.box.max.z - h.box.min.z).toFixed(1);
  const top = (h.box.max.y - overall.max.y).toFixed(2), bot = (h.box.min.y - overall.max.y).toFixed(2);
  console.log(`  • ${h.name}  [mesh ${h.mesh}]  footprint ${w}x${d}  topY(rel)=${top} botY(rel)=${bot}`);
}
