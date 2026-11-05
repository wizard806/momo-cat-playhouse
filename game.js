import * as THREE from './vendor/three.module.js';
import * as CANNON from './vendor/cannon-es.js';

const $ = id => document.getElementById(id);
const mobile = matchMedia('(pointer:coarse)').matches;
const STORE = 'orange-playhouse-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { /* A fresh game also works without storage. */ }
const progress = {
  knocked: Array.isArray(saved.knocked) ? saved.knocked.filter(x => typeof x === 'string') : [],
  treats: Array.isArray(saved.treats) ? saved.treats.filter(x => typeof x === 'string') : [],
  basket: saved.basket === true, bell: saved.bell === true, friend: saved.friend === true
};
let soundOn = saved.sound !== false, running = false, started = false, wonShown = false;
let yaw = 0, pitch = 0, held = null, target = null, totalTime = 0;
let swatTime = 0, jumpTime = 0, toastTimer = 0, grabCooldown = 0, lastStepSound = 0;
const move = { x: 0, y: 0 }, keys = new Set(), dynamic = [], interactables = [], treats = [], wallBlocks = [];
const tmp = new THREE.Vector3(), forward = new THREE.Vector3();
const counts = () => [progress.knocked.length >= 3, progress.treats.length >= 4, progress.basket, progress.bell, progress.friend];
const completed = () => counts().filter(Boolean).length;
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ ...progress, sound: soundOn })); }
  catch { $('saveNote').textContent = '当前浏览器无法保存进度，本次仍可正常游玩'; }
}
function toast(text) {
  $('toast').textContent = text; $('toast').classList.add('show'); toastTimer = 3.1;
}
function updateQuests() {
  const done = counts();
  const labels = ['拍落三个小物件', '找到四条小鱼饼干', '把毛线球送进篮子', '拍拍厨房的小铃铛', '跟奶奶打个招呼'];
  $('questList').innerHTML = labels.map((label, i) => `<div class="quest-row ${done[i] ? 'done' : ''}"><i>${done[i] ? '✓' : '·'}</i><span>${label}</span><small>${i === 0 ? Math.min(progress.knocked.length, 3) + '/3' : i === 1 ? Math.min(progress.treats.length, 4) + '/4' : done[i] ? '完成' : '✦'}</small></div>`).join('');
  $('stars').textContent = completed();
}
function reward(text, previous) {
  save(); updateQuests(); toast(text); tone(660, .13, 'sine', .08); setTimeout(() => tone(880, .17, 'sine', .06), 130);
  if (completed() === 5 && previous < 5 && !wonShown) {
    wonShown = true;
    setTimeout(() => { if (running) { pauseGame('winMenu'); confetti(); } }, 1500);
  }
}
let audio;
function tone(freq, length = .08, wave = 'sine', volume = .035) {
  if (!soundOn || !audio || audio.state !== 'running') return;
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = wave; o.frequency.setValueAtTime(freq, audio.currentTime);
  o.frequency.exponentialRampToValueAtTime(freq * .65, audio.currentTime + length);
  g.gain.setValueAtTime(volume, audio.currentTime); g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + length);
  o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + length);
}
function meow() { tone(750, .22, 'triangle', .04); setTimeout(() => tone(940, .18, 'sine', .045), 80); }
function resumeAudio() {
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch { /* Sound is optional. */ }
}

const renderer = new THREE.WebGLRenderer({ canvas: $('world'), antialias: !mobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.24;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#bcd7d2'); scene.fog = new THREE.Fog('#dbdfcc', 24, 55);
const camera = new THREE.PerspectiveCamera(73, innerWidth / innerHeight, .045, 65);
camera.rotation.order = 'YXZ'; scene.add(camera);
scene.add(new THREE.HemisphereLight('#fff2d9', '#b3bca1', 2.0));
const sun = new THREE.DirectionalLight('#fff1d2', 3.2); sun.position.set(3, 11, 5); sun.castShadow = true;
sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: .1, far: 30 });
sun.shadow.bias = -.0004; sun.shadow.normalBias = .035; scene.add(sun);
const fill = new THREE.DirectionalLight('#d0e8e3', 1.0); fill.position.set(-6, 5, -5); scene.add(fill);
const materials = new Map();
function mat(color, roughness = .8, extra = {}) {
  const key = color + roughness + JSON.stringify(extra);
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, ...extra }));
  return materials.get(key);
}
const geometries = { box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(1, 14, 10), cylinder: new THREE.CylinderGeometry(1, 1, 1, 16) };
function mesh(geo, color, pos = [0, 0, 0], scale = [1, 1, 1], parent = scene) {
  const m = new THREE.Mesh(typeof geo === 'string' ? geometries[geo] : geo, mat(color));
  m.position.set(...pos); m.scale.set(...scale); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function box(color, x, y, z, w, h, d, parent = scene) { return mesh('box', color, [x, y, z], [w, h, d], parent); }
function sphere(color, x, y, z, rx, ry = rx, rz = rx, parent = scene) { return mesh('sphere', color, [x, y, z], [rx, ry, rz], parent); }
function cyl(color, x, y, z, r, h, parent = scene) { return mesh('cylinder', color, [x, y, z], [r, h, r], parent); }
function group(x = 0, y = 0, z = 0, parent = scene) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -14, 0), allowSleep: true });
world.broadphase = new CANNON.SAPBroadphase(world); world.solver.iterations = 7;
const floorMaterial = new CANNON.Material('room'), objectMaterial = new CANNON.Material('toys'), catMaterial = new CANNON.Material('cat');
world.addContactMaterial(new CANNON.ContactMaterial(floorMaterial, objectMaterial, { friction: .45, restitution: .32 }));
world.addContactMaterial(new CANNON.ContactMaterial(objectMaterial, objectMaterial, { friction: .25, restitution: .35 }));
world.addContactMaterial(new CANNON.ContactMaterial(catMaterial, floorMaterial, { friction: 0, restitution: 0 }));
world.addContactMaterial(new CANNON.ContactMaterial(catMaterial, objectMaterial, { friction: .1, restitution: .15 }));
function solid(x, y, z, w, h, d, grannyBlock = true) {
  const b = new CANNON.Body({ mass: 0, material: floorMaterial, position: new CANNON.Vec3(x, y, z), shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)) }); world.addBody(b);
  if (grannyBlock && h > .3) wallBlocks.push({ x, z, w: w / 2, d: d / 2 }); return b;
}
function furniture(color, x, y, z, w, h, d, block = true) { box(color, x, y, z, w, h, d); return solid(x, y, z, w, h, d, block); }
function textSign(text, x, y, z, w, h, color = '#716448', bg = '#fff6db', angle = 0) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 192; const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 192); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 50px sans-serif'; ctx.fillText(text, 256, 96);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture })); m.position.set(x, y, z); m.rotation.y = angle; scene.add(m); return m;
}
function shadow(x, z, sx, sz, opacity = .12) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: '#6d6451', transparent: true, opacity, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, .012, z); m.scale.set(sx, sz, 1); scene.add(m);
}

// A small original house, made entirely from primitives.
furniture('#dac5a0', 0, -.15, 0, 16, .3, 12, false);
for (let i = -7; i <= 7; i++) { box(i % 2 ? '#e7d3b0' : '#e3cdaa', i, .003, 0, .98, .012, 11.9).receiveShadow = true; }
furniture('#c5d8bb', -8.1, 2, 0, .2, 4, 12);
furniture('#eadfc8', 8.1, 2, 0, .2, 4, 12);
furniture('#eadfc8', 0, 2, -6.1, 16, 4, .2);
furniture('#eed9bc', 0, 2, 6.1, 16, 4, .2);
for (let z of [-5.96, 5.96]) box('#fff1d9', 0, .12, z, 16, .24, .07);
for (let x of [-7.96, 7.96]) box('#fff1d9', x, .12, 0, .07, .24, 12);
box('#f6e9ce', -7.95, 3.8, 0, .12, .22, 12); box('#fff0d0', 0, 3.8, -5.95, 16, .22, .12);
// Garden windows and striped curtains.
for (let x of [-4.6, 3.8]) {
  box('#b4dacf', x, 2.3, -5.96, 3.4, 2.2, .04);
  box('#9cbfa0', x, 1.43, -5.91, 3.3, .4, .04);
  for (let i = 0; i < 5; i++) sphere('#95b49a', x - 1.5 + i * .7, 1.65, -5.86, .48, .5, .035);
  for (let a of [-1.74, 0, 1.74]) box('#fff2d9', x + a, 2.3, -5.81, .08, 2.35, .13);
  box('#fff2d9', x, 2.3, -5.8, 3.5, .08, .13);
  box('#fff2d9', x, 3.48, -5.8, 3.7, .09, .18); furniture('#fff0d5', x, 1.15, -5.7, 3.8, .13, .5, false);
  for (let side of [-1, 1]) for (let i = 0; i < 4; i++) cyl(i % 2 ? '#e7b67b' : '#f8d6a5', x + side * (1.65 + i * .09), 2.45, -5.62, .09, 2.1);
}
// Kitchen, with low counters cats can jump onto.
furniture('#84a99a', -6.8, .58, -3.9, 2.1, 1.16, 3.5);
furniture('#fff0d6', -6.8, 1.2, -3.9, 2.3, .13, 3.65, false);
for (let z of [-5, -3.9, -2.8]) { box('#a7c6b2', -5.73, .61, z, .03, .9, .95); box('#c6a45e', -5.68, .88, z, .09, .035, .25); }
box('#586964', -6.7, 1.276, -4.6, 1.1, .02, .9);
for (let z of [-4.85, -4.35]) for (let x of [-6.95, -6.45]) cyl('#344d49', x, 1.295, z, .17, .035);
cyl('#d88655', -6.9, 1.48, -4.8, .23, .35); cyl('#e9b28d', -6.9, 1.67, -4.8, .25, .05);
const handle = new THREE.Mesh(new THREE.TorusGeometry(.11, .025, 6, 16), mat('#664a35')); handle.position.set(-6.9, 1.77, -4.8); handle.rotation.x = Math.PI / 2; scene.add(handle);
furniture('#f7e8c6', -7.0, 1.2, -.9, 1.55, 2.4, 1.3); box('#dfd4b9', -6.2, 1.45, -.9, .03, 1.2, 1.23); box('#bfab85', -6.15, 1.5, -.4, .09, .5, .045);
textSign('小猫厨房', -7.95, 2.9, -3.8, 1.7, .58, '#4d7965', '#d6e3c7', Math.PI / 2);
// Living room sofa, soft rug, low table, cushions.
box('#e3b27f', 1.3, .025, 1.9, 5.2, .035, 4.6);
for (let i = 0; i < 11; i++) box('#edc595', -1.1 + i * .48, .047, 1.9, .04, .01, 4.35);
furniture('#9dbba5', 1.3, .48, 4.7, 4.5, .8, 1.35);
furniture('#8cae96', 1.3, 1.05, 5.25, 4.5, 1.3, .32);
for (let x of [-.83, 3.43]) furniture('#8faf98', x, .83, 4.7, .3, .7, 1.5);
for (let x of [.2, 1.4, 2.6]) box('#bbceb3', x, .9, 4.65, 1.15, .14, 1.12);
const pillow = box('#f3d298', .35, 1.14, 4.95, .8, .55, .23); pillow.rotation.z = .18;
box('#e5c69a', 2.6, 1.15, 4.98, .7, .55, .23).rotation.z = -.15;
furniture('#c4996c', .8, .62, 1.5, 2.5, .14, 1.45);
for (let x of [-.22, 1.82]) for (let z of [.97, 2.03]) furniture('#b1875b', x, .29, z, .12, .58, .12);
shadow(.8, 1.5, 1.8, 1.1, .1);
// A dining table and stool in the kitchen area.
furniture('#d9b87f', -3.6, .99, -2.9, 2.65, .16, 1.6);
for (let x of [-4.6, -2.6]) for (let z of [-3.43, -2.37]) furniture('#b18f60', x, .45, z, .12, .9, .12);
furniture('#a9bba0', -3.5, .45, -1.5, .9, .14, .7);
for (let x of [-3.85, -3.15]) furniture('#b18f60', x, .2, -1.5, .09, .4, .62);
// Reading corner, books and framed cat illustration.
furniture('#c9ac80', 6.9, 1.1, 2.2, 1.3, 2.2, .8);
for (let y of [.2, .9, 1.6, 2.2]) box('#ecd0a0', 6.9, y, 2.2, 1.4, .07, .9);
for (let i = 0; i < 7; i++) { const b = box(['#a8bfa7','#e3ae7b','#c9a8a0','#e9cf95'][i % 4], 6.4 + i * .14, .57, 2.2, .11, .6, .48); b.rotation.z = i % 3 === 0 ? .08 : 0; }
box('#c49b68', 7.94, 2.35, .15, .06, 1.3, 1.5); box('#f7ead2', 7.9, 2.35, .15, .02, 1.12, 1.32);
sphere('#deaa68', 7.86, 2.25, .15, .025, .35, .36);
for (let z of [-.12, .42]) { const ear = mesh(new THREE.ConeGeometry(.17, .33, 3), '#deaa68', [7.86, 2.59, z], [.15, 1, 1]); ear.rotation.x = -.2; }
for (let z of [0, .3]) sphere('#76523b', 7.82, 2.3, z, .025, .03, .03);
// Plant, lamp, clock and cat bed.
cyl('#b67f59', -6.8, .35, 4.7, .43, .7);
for (let i = 0; i < 7; i++) { const a = i * 2.4; const leaf = sphere('#7d9d73', -6.8 + Math.cos(a) * .32, 1 + i * .06, 4.7 + Math.sin(a) * .32, .15, .53, .14); leaf.rotation.z = Math.cos(a) * .7; leaf.rotation.x = Math.sin(a) * .7; }
cyl('#b0935d', 4.5, .9, 5, .045, 1.8); cyl('#b0935d', 4.5, .06, 5, .28, .1);
mesh(new THREE.ConeGeometry(.48, .6, 16, 1, true), '#f3d59c', [4.5, 1.95, 5]);
const clock = cyl('#bc9b71', .2, 2.8, -5.88, .44, .09); clock.rotation.x = Math.PI / 2;
const face = cyl('#fff0d1', .2, 2.8, -5.82, .39, .01); face.rotation.x = Math.PI / 2;
box('#6f6850', .2, 2.92, -5.79, .025, .25, .02); box('#6f6850', .31, 2.8, -5.79, .23, .025, .02);
cyl('#c9976d', -4.7, .11, 3.8, .8, .2); cyl('#efd9ac', -4.7, .23, 3.8, .67, .15);
textSign('橘子的小窝', -4.7, .03, 2.8, 1.3, .4).rotation.x = -Math.PI / 2;
// Low climbing platforms.
furniture('#ccb084', 4.7, .24, -4.7, 1.15, .48, 1.1);
furniture('#d9c297', 5.7, .55, -4.7, 1.0, 1.1, 1.05);
textSign('☀', 0, 2.25, -5.95, 1.2, .7, '#c79441', '#f1e2bb');

function addObject(id, name, type, pos, size, color) {
  const g = group(...pos); let shape;
  if (type === 'ball') {
    sphere(color, 0, 0, 0, size, size, size, g);
    for (let i = 0; i < 3; i++) { const band = new THREE.Mesh(new THREE.TorusGeometry(size * .97, .014, 4, 18), mat('#edc7a5')); band.rotation.set(i * 1.1, i * .9, .4); g.add(band); }
    shape = new CANNON.Sphere(size);
  } else if (type === 'plant') {
    cyl(color, 0, -.03, 0, size * .75, size * 1.1, g);
    cyl('#6c7651', 0, size * .55, 0, size * .62, .025, g);
    for (let i = 0; i < 4; i++) { const a = i * 2; const leaf = sphere('#8baf7a', Math.cos(a) * size * .4, size * .95, Math.sin(a) * size * .4, size * .4, size * .75, size * .35, g); leaf.rotation.z = Math.cos(a) * .6; }
    shape = new CANNON.Box(new CANNON.Vec3(size * .75, size * 1.05, size * .75));
  } else if (type === 'book') {
    box(color, 0, 0, 0, size * 1.8, size * .35, size * 1.3, g); box('#fff0d5', 0, .005, 0, size * 1.65, size * .22, size * 1.24, g);
    shape = new CANNON.Box(new CANNON.Vec3(size * .9, size * .175, size * .65));
  } else {
    cyl(color, 0, 0, 0, size * .7, size * 1.4, g); cyl('#ebe1c7', 0, size * .71, 0, size * .6, .015, g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(size * .4, size * .12, 6, 12), mat(color)); ring.position.set(size * .78, 0, 0); g.add(ring);
    shape = new CANNON.Cylinder(size * .7, size * .7, size * 1.4, 12);
  }
  const b = new CANNON.Body({ mass: type === 'ball' ? .3 : .6, material: objectMaterial, shape, position: new CANNON.Vec3(...pos), angularDamping: .35, linearDamping: .17 });
  b.sleepSpeedLimit = .15; b.sleepTimeLimit = 1.4; world.addBody(b);
  const obj = { id, name, type, mesh: g, body: b, initial: new THREE.Vector3(...pos), hit: false, size };
  g.traverse(m => { if (m.isMesh) m.userData.item = obj; }); dynamic.push(obj); interactables.push(g);
  let collisionWait = 0;
  b.addEventListener('collide', e => { const impact = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (impact > 2 && totalTime > collisionWait) { collisionWait = totalTime + .2; if (running) tone(type === 'ball' ? 180 : 320, .055, 'triangle', Math.min(.025, impact * .002)); } });
  return obj;
}
addObject('tea1', '奶油色杯子', 'cup', [.1, .86, 1.55], .2, '#eee1ba');
addObject('tea2', '薄荷色杯子', 'cup', [1.5, .86, 1.5], .2, '#88ad9c');
addObject('book1', '故事书', 'book', [.8, .79, 1.3], .3, '#b38371');
addObject('plant1', '小花盆', 'plant', [-3, 1.39, -3], .22, '#d29a69');
addObject('tea3', '早餐杯', 'cup', [-4.3, 1.28, -2.9], .2, '#e7bc73');
addObject('book2', '绿色小书', 'book', [-3.7, 1.17, -3.1], .32, '#a3b79d');
addObject('plant2', '窗边小花盆', 'plant', [3.8, 1.52, -5.55], .24, '#c0875f');
addObject('tea4', '蓝色杯子', 'cup', [-6.3, 1.48, -3.0], .2, '#90b6b4');
addObject('book3', '奶奶的小笔记', 'book', [6.85, 1.72, 2.15], .28, '#deba77');
addObject('tea5', '架子上的杯子', 'cup', [6.55, 1.13, 2.1], .2, '#d9a68c');
const yarn = addObject('yarn', '橘色毛线球', 'ball', [3.7, .27, .1], .24, '#d88c68');
// A shallow, real basket collider; the rim is visual so a child can easily score.
const basket = group(6.3, 0, -2.5);
cyl('#c29965', 0, .14, 0, .64, .28, basket);
cyl('#e4c590', 0, .30, 0, .69, .09, basket);
cyl('#a8865c', 0, .35, 0, .57, .02, basket);
for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; box('#d9b47d', Math.cos(a) * .63, .2, Math.sin(a) * .63, .035, .26, .035, basket); }
solid(6.3, .12, -2.5, 1.2, .24, 1.2, false);
const basketTarget = { type: 'basket', name: '毛线球的小篮子' }; basket.traverse(m => { if (m.isMesh) m.userData.item = basketTarget; }); interactables.push(basket);
textSign('毛线球的家', 6.3, .65, -2.93, 1.2, .27, '#87663c', '#fff0c8');
const bell = group(-6.7, 1.28, -2.65);
cyl('#b18d4c', 0, .035, 0, .19, .07, bell); sphere('#e1b858', 0, .1, 0, .16, .1, .16, bell); cyl('#e9d490', 0, .22, 0, .025, .1, bell);
const bellTarget = { type: 'bell', name: '厨房小铃铛' }; bell.traverse(m => { if (m.isMesh) m.userData.item = bellTarget; }); interactables.push(bell);
function addTreat(id, x, y, z) {
  if (progress.treats.includes(id)) return;
  const g = group(x, y, z); sphere('#f5c15b', 0, 0, 0, .14, .065, .065, g);
  const tail = mesh(new THREE.ConeGeometry(.085, .14, 3), '#efb44b', [-.17, 0, 0], [1, 1, 1], g); tail.rotation.z = -Math.PI / 2;
  sphere('#7c622f', .07, .025, .055, .014, .014, .014, g);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(.23, .012, 4, 20), new THREE.MeshBasicMaterial({ color: '#f9d385' })); halo.rotation.x = Math.PI / 2; halo.position.y = -.08; g.add(halo);
  treats.push({ id, mesh: g, y });
}
addTreat('fish1', -4.8, .36, 3.8); addTreat('fish2', 1.4, 1.22, 4.6); addTreat('fish3', 5.7, 1.37, -4.7); addTreat('fish4', -3.7, 1.34, -2.8);

// An original friendly granny, with a simple visible state machine.
const granny = group(4.5, 0, -1), limbs = {};
const dress = mesh(new THREE.CylinderGeometry(.23, .42, .85, 12), '#ac9ab6', [0, .9, 0], [1, 1, 1], granny);
for (let side of [-1, 1]) {
  const leg = group(side * .14, .48, 0, granny); cyl('#806b75', 0, -.2, 0, .085, .42, leg); sphere('#715b59', 0, -.39, .07, .12, .07, .18, leg); limbs['leg' + side] = leg;
  const arm = group(side * .3, 1.27, 0, granny); cyl('#ad9cb7', 0, -.16, 0, .085, .34, arm); sphere('#efd0ad', 0, -.37, .02, .08, .1, .08, arm); limbs['arm' + side] = arm;
}
sphere('#f2d5b8', 0, 1.6, .03, .26, .3, .24, granny);
sphere('#dedccf', 0, 1.78, -.07, .27, .18, .24, granny); sphere('#e4e1d7', 0, 1.96, -.1, .13, .13, .13, granny);
sphere('#ebc5a5', 0, 1.59, .27, .055, .07, .065, granny);
for (let x of [-.11, .11]) {
  sphere('#675c53', x, 1.64, .237, .022, .027, .01, granny);
  const glasses = new THREE.Mesh(new THREE.TorusGeometry(.09, .011, 5, 16), mat('#796c63')); glasses.position.set(x, 1.64, .257); granny.add(glasses);
  sphere('#e6af94', x * 1.4, 1.54, .2, .055, .025, .02, granny);
}
box('#796c63', 0, 1.65, .269, .05, .012, .012, granny);
sphere('#bf997c', 0, 1.49, .237, .055, .012, .01, granny);
const grannyTarget = { type: 'granny', name: '温柔的奶奶' }; granny.traverse(m => { if (m.isMesh) m.userData.item = grannyTarget; }); interactables.push(granny);
const patrol = [[4.5,-1],[3.9,2.5],[-1.7,2.4],[-1.6,-4.1],[1.9,-4.2],[4.5,-1]];
let patrolIndex = 0, mood = 0, grannyWait = 0, grannyCooldown = 0, noisePoint = new THREE.Vector3(), investigating = false;
function makeNoise(point, strength = 18) { mood = Math.min(100, mood + strength); noisePoint.copy(point); investigating = true; grannyWait = .65; }
function grannyUpdate(dt) {
  mood = Math.max(0, mood - dt * 3.4); grannyCooldown = Math.max(0, grannyCooldown - dt); grannyWait = Math.max(0, grannyWait - dt);
  const dist = Math.hypot(player.position.x - granny.position.x, player.position.z - granny.position.z);
  const chasing = mood > 32 && dist < 6 && grannyCooldown === 0;
  let goal = chasing ? [player.position.x, player.position.z] : investigating ? [noisePoint.x, noisePoint.z] : patrol[patrolIndex];
  const dx = goal[0] - granny.position.x, dz = goal[1] - granny.position.z, len = Math.hypot(dx, dz);
  let walking = false;
  if (len > .5 && grannyWait <= 0) {
    const speed = chasing ? 1.35 : .65, sx = dx / len * speed * dt, sz = dz / len * speed * dt;
    const blocked = (x, z) => wallBlocks.some(b => Math.abs(x - b.x) < b.w + .34 && Math.abs(z - b.z) < b.d + .34);
    let nx = granny.position.x + sx, nz = granny.position.z + sz;
    if (!blocked(nx, nz)) { granny.position.set(nx, 0, nz); walking = true; }
    else if (!blocked(nx, granny.position.z)) { granny.position.x = nx; walking = true; }
    else if (!blocked(granny.position.x, nz)) { granny.position.z = nz; walking = true; }
    else { investigating = false; patrolIndex = (patrolIndex + 1) % patrol.length; }
    granny.rotation.y = Math.atan2(dx, dz);
  } else if (len < .6) { if (investigating) investigating = false; else if (!chasing) { patrolIndex = (patrolIndex + 1) % patrol.length; grannyWait = 2.5; } }
  const swing = walking ? Math.sin(totalTime * (chasing ? 9 : 5)) * .28 : 0;
  for (let s of [-1, 1]) { limbs['leg' + s].rotation.x = swing * s; limbs['arm' + s].rotation.x = -swing * s; }
  if (chasing && dist < 1.1 && grannyCooldown === 0) {
    toast('奶奶：抓到小捣蛋啦！挠挠下巴 ♡'); mood = 0; investigating = false; grannyCooldown = 10; grannyWait = 3; meow();
  }
  $('moodFill').style.width = mood + '%';
  $('grannyMood').textContent = grannyCooldown > 7 ? '奶奶：真是小淘气' : chasing ? '奶奶来找你啦' : mood > 12 ? '奶奶听到了动静' : grannyWait > 0 ? '奶奶在歇脚' : '奶奶在散步';
  $('grannyHint').textContent = chasing ? '快躲开，或者让她摸摸头' : '轻轻地，别让她听到呀';
}

// Cat body: a low, frictionless sphere that collides with real furniture.
const player = new CANNON.Body({ mass: 5, material: catMaterial, shape: new CANNON.Sphere(.25), position: new CANNON.Vec3(0, .3, 3.1), fixedRotation: true, linearDamping: .2 });
player.allowSleep = false;
player.updateMassProperties(); world.addBody(player);
let groundedAt = -99;
player.addEventListener('collide', e => { const n = e.contact.ni; const up = e.contact.bi === player ? -n.y : n.y; if (up > .5) groundedAt = totalTime; });
// Paws live in camera space, so they are always your own little feet.
const paws = group(0, 0, 0, camera);
const pawGroups = [];
for (let side of [-1, 1]) {
  const p = group(side * (camera.aspect < .75 ? .13 : .30), -.29, -.66, paws); p.rotation.z = side * -.14; p.scale.setScalar(camera.aspect < .75 ? .8 : 1);
  sphere('#d99449', 0, -.17, .05, .105, .25, .105, p);
  sphere('#fff0d8', 0, .02, -.04, .115, .13, .12, p);
  for (let x of [-.06, 0, .06]) sphere('#fff3df', x, .1, -.09, .036, .05, .04, p);
  for (let y of [-.12, -.22]) { const stripe = sphere('#bb7538', 0, y, -.04, .106, .025, .07, p); stripe.rotation.z = side * .12; }
  p.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; m.renderOrder = 20; m.material = m.material.clone(); m.material.depthTest = false; m.material.depthWrite = false; } });
  pawGroups.push(p);
}

const raycaster = new THREE.Raycaster();
function updateTarget() {
  raycaster.setFromCamera({ x: 0, y: 0 }, camera); raycaster.far = 2.65;
  const hits = raycaster.intersectObjects(interactables, true);
  target = null;
  for (const h of hits) {
    const item = h.object.userData.item;
    if (item && item !== held) { target = item; break; }
  }
  // A small touch-friendly aiming margin for the two tiny interaction targets.
  if (!target) {
    camera.getWorldDirection(forward);
    for (const [item, point] of [[bellTarget, bell.position.clone().add(new THREE.Vector3(0, .1, 0))], [grannyTarget, granny.position.clone().add(new THREE.Vector3(0, 1.1, 0))]]) {
      tmp.copy(point).sub(camera.position);
      if (tmp.length() < 2.5 && tmp.normalize().dot(forward) > .965) { target = item; break; }
    }
  }
  const hint = $('targetHint');
  if (held) { hint.style.display = 'block'; hint.textContent = target?.type === 'basket' && held === yarn ? '抓取键 · 把毛线球放回家' : `拿着${held.name} · 再点抓取抛出`; }
  else if (target) { hint.style.display = 'block'; hint.textContent = target.type === 'granny' ? '抓取键 · 喵一声打招呼' : target.type === 'basket' ? '把毛线球带到这里来' : target.type === 'bell' ? '拍拍它，叮铃铃' : target.name + ' · 可以抓，也可以拍'; }
  else hint.style.display = 'none';
  $('grabBtn').querySelector('b').textContent = held ? target?.type === 'basket' && held === yarn ? '放进去' : '抛出' : target?.type === 'granny' ? '喵一声' : '抓取';
}
function grab() {
  if (!running || grabCooldown > 0) return; grabCooldown = .22;
  if (held) {
    const obj = held; held = null; obj.body.type = CANNON.Body.DYNAMIC; obj.body.collisionFilterMask = -1; obj.body.wakeUp();
    if (obj === yarn && target?.type === 'basket') {
      obj.body.position.set(6.3, .65, -2.5); obj.body.velocity.set(0, 0, 0); finishBasket();
    } else {
      camera.getWorldDirection(forward); obj.body.velocity.set(forward.x * 4.6 + player.velocity.x, forward.y * 4.6 + 1.3, forward.z * 4.6 + player.velocity.z); obj.body.angularVelocity.set(1.5, 1.1, .7);
      obj.hit = true; makeNoise(obj.mesh.position, 13); tone(260, .08, 'triangle');
    }
  } else if (target?.body) {
    held = target; held.body.type = CANNON.Body.KINEMATIC; held.body.collisionFilterMask = 0; held.body.velocity.setZero(); held.body.angularVelocity.setZero(); held.body.wakeUp();
    tone(420, .06); toast(`抓住${held.name}啦，再点一次就能抛出`);
  } else if (target?.type === 'granny') {
    meow(); mood = 0; grannyWait = 3;
    if (!progress.friend) { const before = completed(); progress.friend = true; reward('✦ 奶奶：橘子真乖，摸摸头！', before); }
    else toast('奶奶：最喜欢我们家的小橘子啦 ♡');
  } else if (target?.type === 'bell') ringBell();
  else { meow(); toast('对准一个小物件，再点抓取'); }
}
function ringBell() {
  tone(1200, .6, 'sine', .065); makeNoise(bell.position, 10);
  if (!progress.bell) { const before = completed(); progress.bell = true; reward('✦ 叮铃铃！厨房的午后铃声', before); } else toast('叮铃铃～奶奶，开饭了吗？');
}
function swat() {
  if (!running || swatTime > .15) return;
  swatTime = .38; tone(170, .06, 'triangle', .02);
  if (target?.body && target !== held) {
    camera.getWorldDirection(forward); target.body.wakeUp(); target.body.applyImpulse(new CANNON.Vec3(forward.x * 2.7, Math.max(.7, forward.y * 2.7 + 1), forward.z * 2.7));
    target.hit = true; makeNoise(target.mesh.position, 19);
  } else if (target?.type === 'bell') ringBell();
  else if (target?.type === 'granny') { meow(); toast('奶奶：小爪爪，轻一点哦 ♡'); mood = Math.min(100, mood + 12); }
  else if (!target) {
    const nearby = dynamic.filter(o => o !== held && o.mesh.position.distanceTo(camera.position) < 1.65).sort((a, b) => a.mesh.position.distanceToSquared(camera.position) - b.mesh.position.distanceToSquared(camera.position))[0];
    if (nearby) { camera.getWorldDirection(forward); nearby.body.wakeUp(); nearby.body.applyImpulse(new CANNON.Vec3(forward.x * 2.2, 1.2, forward.z * 2.2)); nearby.hit = true; makeNoise(nearby.mesh.position, 15); }
  }
}
function jump() {
  if (!running) return;
  if (totalTime - groundedAt < .12) { player.velocity.y = 6.2; groundedAt = -99; jumpTime = .45; tone(300, .1, 'sine', .02); }
}
function finishBasket() {
  if (progress.basket) return;
  const before = completed(); progress.basket = true; reward('✦ 毛线球回到小篮子，收拾好啦！', before);
}
function confetti() {
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('span'); s.textContent = ['✦','✿','♡'][i % 3]; s.style.cssText = `position:fixed;left:${10 + Math.random() * 80}%;top:20%;color:${['#edb250','#a7bfa3','#d59e87'][i % 3]};font-size:24px;z-index:8;pointer-events:none`; document.body.append(s);
    s.animate([{ transform: 'translateY(-30px) rotate(0deg)', opacity: 1 }, { transform: `translate(${(Math.random() - .5) * 150}px,${innerHeight * .65}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }], { duration: 1800 + Math.random() * 1200, easing: 'ease-out' }).onfinish = () => s.remove();
  }
}
function releaseControls() { keys.clear(); move.x = 0; move.y = 0; stickPointer = null; lookPointer = null; $('stickKnob').style.transform = ''; }
function pauseGame(panel = 'pauseMenu') { running = false; releaseControls(); $(panel).classList.remove('hidden'); }
function resumeGame() { $('pauseMenu').classList.add('hidden'); $('winMenu').classList.add('hidden'); $('resetConfirm').classList.add('hidden'); running = true; resumeAudio(); }
$('startBtn').onclick = () => { started = true; running = true; $('menu').classList.add('hidden'); $('hud').classList.remove('hidden'); camera.fov = 73; camera.updateProjectionMatrix(); resumeAudio(); meow(); toast('喵～先去小窝找一条小鱼饼干吧！'); save(); };
$('pauseBtn').onclick = () => pauseGame(); $('resumeBtn').onclick = resumeGame; $('keepPlayingBtn').onclick = resumeGame;
$('soundBtn').textContent = soundOn ? '声音：开启' : '声音：关闭';
$('soundBtn').onclick = () => { soundOn = !soundOn; $('soundBtn').textContent = soundOn ? '声音：开启' : '声音：关闭'; resumeAudio(); save(); };
$('helpBtn').onclick = () => $('helpText').classList.toggle('hidden');
$('questToggle').onclick = () => { $('questPanel').classList.toggle('collapsed'); $('questToggle').textContent = $('questPanel').classList.contains('collapsed') ? '⌄' : '⌃'; };
$('resetBtn').onclick = () => $('resetConfirm').classList.remove('hidden');
$('cancelResetBtn').onclick = () => $('resetConfirm').classList.add('hidden');
function newDay() { try { localStorage.removeItem(STORE); } catch {} location.reload(); }
$('confirmResetBtn').onclick = newDay; $('newDayBtn').onclick = newDay;
for (let [id, action] of [['grabBtn', grab], ['swatBtn', swat], ['jumpBtn', jump]]) {
  $(id).addEventListener('pointerdown', e => { e.preventDefault(); action(); });
}
addEventListener('keydown', e => {
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape' && started) { if (running) pauseGame(); else if (!$('pauseMenu').classList.contains('hidden')) resumeGame(); }
  if (!running || e.repeat) return;
  keys.add(e.code); if (e.code === 'Space') jump(); if (e.code === 'KeyE') grab(); if (e.code === 'KeyF') swat();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { if (running) pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && running) pauseGame(); });
let stickPointer = null, lookPointer = null, lastLook = { x: 0, y: 0 };
const stick = $('stickZone');
function moveStick(e) {
  const r = stick.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2), y = (e.clientY - r.top - r.height / 2);
  const radius = r.width * .32, len = Math.hypot(x, y); if (len > radius) { x *= radius / len; y *= radius / len; }
  move.x = x / radius; move.y = -y / radius; $('stickKnob').style.transform = `translate(${x}px,${y}px)`;
}
stick.addEventListener('pointerdown', e => { if (!running) return; e.preventDefault(); stickPointer = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === stickPointer) moveStick(e); });
function endStick(e) { if (e.pointerId === stickPointer) { stickPointer = null; move.x = 0; move.y = 0; $('stickKnob').style.transform = ''; } }
stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick); stick.addEventListener('lostpointercapture', endStick);
$('world').addEventListener('pointerdown', e => { if (!running) return; e.preventDefault(); lookPointer = e.pointerId; lastLook = { x: e.clientX, y: e.clientY }; $('world').setPointerCapture(e.pointerId); });
$('world').addEventListener('pointermove', e => { if (e.pointerId !== lookPointer || !running) return;
  const dx = e.clientX - lastLook.x, dy = e.clientY - lastLook.y;
  yaw -= dx * .004; pitch = THREE.MathUtils.clamp(pitch - dy * .0035, -1.1, 1.15); lastLook = { x: e.clientX, y: e.clientY };
});
function endLook(e) { if (e.pointerId === lookPointer) lookPointer = null; }
$('world').addEventListener('pointerup', endLook); $('world').addEventListener('pointercancel', endLook); $('world').addEventListener('lostpointercapture', endLook);
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); pawGroups.forEach((p, i) => { p.position.x = (i ? 1 : -1) * (camera.aspect < .75 ? .13 : .30); p.scale.setScalar(camera.aspect < .75 ? .8 : 1); }); releaseControls(); });

const clockTime = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clockTime.getDelta(), .045);
  if (running) {
    totalTime += dt; swatTime = Math.max(0, swatTime - dt); jumpTime = Math.max(0, jumpTime - dt); grabCooldown = Math.max(0, grabCooldown - dt);
    const mx = move.x + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const mz = move.y + (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const length = Math.max(1, Math.hypot(mx, mz)), speed = 2.8;
    const vx = (mx * Math.cos(yaw) - mz * Math.sin(yaw)) / length * speed;
    const vz = (-mx * Math.sin(yaw) - mz * Math.cos(yaw)) / length * speed;
    player.velocity.x = THREE.MathUtils.lerp(player.velocity.x, vx, Math.min(1, dt * 13)); player.velocity.z = THREE.MathUtils.lerp(player.velocity.z, vz, Math.min(1, dt * 13));
    world.step(1 / 60, dt, 3);
    for (const contact of world.contacts) {
      if (contact.bi === player && -contact.ni.y > .5 || contact.bj === player && contact.ni.y > .5) { groundedAt = totalTime; break; }
    }
    if (player.position.y < -.5 || Math.abs(player.position.x) > 8 || Math.abs(player.position.z) > 6) { player.position.set(0, .32, 3.1); player.velocity.setZero(); }
    const moving = Math.hypot(player.velocity.x, player.velocity.z);
    camera.position.set(player.position.x, player.position.y + .43 + (moving > .3 ? Math.sin(totalTime * 11) * .015 : 0), player.position.z);
    camera.rotation.set(pitch, yaw, 0);
    for (let i = 0; i < 2; i++) {
      const paw = pawGroups[i], swipe = i === 1 && swatTime > 0 ? Math.sin((.38 - swatTime) / .38 * Math.PI) : 0;
      paw.position.y = -.29 + Math.sin(totalTime * 10 + i * Math.PI) * Math.min(.02, moving * .008) + swipe * .18 + jumpTime * .07;
      paw.position.z = -.66 - swipe * .29; paw.rotation.x = -swipe * .7;
    }
    if (held) {
      camera.getWorldDirection(forward); tmp.copy(camera.position).addScaledVector(forward, .95); tmp.y -= .10;
      held.body.position.set(THREE.MathUtils.clamp(tmp.x, -7.6, 7.6), Math.max(.3, tmp.y), THREE.MathUtils.clamp(tmp.z, -5.6, 5.6)); held.body.velocity.setZero(); held.body.quaternion.setFromEuler(0, yaw, 0); held.body.aabbNeedsUpdate = true;
    }
    for (const o of dynamic) {
      o.mesh.position.copy(o.body.position); o.mesh.quaternion.copy(o.body.quaternion);
      if (o.body.position.y < -.5) { o.body.position.set(o.initial.x, o.initial.y + .1, o.initial.z); o.body.velocity.setZero(); o.body.angularVelocity.setZero(); o.body.wakeUp(); }
      if (o.hit && o !== held && o.type !== 'ball' && !progress.knocked.includes(o.id) && o.mesh.position.distanceTo(o.initial) > .55) {
        const before = completed(); progress.knocked.push(o.id); if (progress.knocked.length === 3) reward('✦ 三个小物件落地，捣蛋高手！', before); else { save(); updateQuests(); if (progress.knocked.length < 3) toast(`拍落一个啦！再拍 ${3 - progress.knocked.length} 个`); }
      }
    }
    if (!progress.basket && held !== yarn && Math.hypot(yarn.body.position.x - 6.3, yarn.body.position.z + 2.5) < .6 && yarn.body.position.y < 1 && yarn.body.position.y > .2) finishBasket();
    for (let i = treats.length - 1; i >= 0; i--) {
      const t = treats[i]; t.mesh.rotation.y += dt * 1.1; t.mesh.position.y = t.y + Math.sin(totalTime * 2.4 + i) * .045;
      if (t.mesh.position.distanceTo(camera.position) < .75) {
        const before = completed(); progress.treats.push(t.id); scene.remove(t.mesh); treats.splice(i, 1); reward(progress.treats.length === 4 ? '✦ 四条小鱼饼干，全都找到啦！' : `小鱼饼干 +1 · ${progress.treats.length}/4`, before);
      }
    }
    grannyUpdate(dt); updateTarget();
    if (moving > .8 && totalTime - groundedAt < .2 && totalTime - lastStepSound > .33) { lastStepSound = totalTime; tone(100 + Math.random() * 25, .035, 'sine', .009); }
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }
  } else if (!started) {
    const t = performance.now() * .00012; camera.position.set(5.5 + Math.sin(t) * .22, 2.7, 5.6); camera.lookAt(-.8, .9, -.9); paws.visible = false;
  }
  if (started) paws.visible = true;
  renderer.render(scene, camera);
  $('world').dataset.state = JSON.stringify({ running, player: [player.position.x, player.position.y, player.position.z].map(n => Math.round(n * 100) / 100), view: [yaw, pitch], held: held?.id || null, target: target?.name || null, renderCalls: renderer.info.render.calls });
}
updateQuests();
if (completed() > 0) $('saveNote').textContent = `已经实现 ${completed()} 个小心愿 · 继续上一次的小猫日`;
$('loading').classList.add('hidden'); window.catReady = true;
animate();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
