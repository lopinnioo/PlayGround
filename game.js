// ASHEN VIGIL — one-boss souls-like. Three.js, no assets, all procedural.
import * as THREE from 'three';

// ============ DOM ============
const $ = id => document.getElementById(id);
const canvas = $('game'), hud = $('hud'), titleScreen = $('title-screen');
const hpFill = $('hp-fill'), hpGhost = $('hp-ghost'), stFill = $('st-fill'), flasksEl = $('flasks');
const bossPlate = $('boss-plate'), bossFill = $('boss-fill'), bossGhost = $('boss-ghost');
const interactPrompt = $('interact-prompt'), interactText = $('interact-text');
const centerMsg = $('center-msg'), subMsg = $('sub-msg'), deathScreen = $('death-screen');
const victoryScreen = $('victory-screen'), victoryStats = $('victory-stats');
const vignette = $('vignette'), damageFlash = $('damage-flash'), lockHint = $('lock-hint');
const telegraphEl = $('boss-telegraph'), muteBadge = $('mute-badge');
const inventoryEl = $('inventory'), weaponListEl = $('weapon-list'), slotWeaponEl = $('slot-weapon'), invStatsEl = $('inv-stats'), weaponLabelEl = $('weapon-label');
const dropScreenEl = $('drop-screen'), dropListEl = $('drop-list'), spoilsSlotEl = $('spoils-slot');

// ============ TUNING (merciful) ============
const TUNE = {
  playerHP: 520, playerST: 100, flasks: 3, flaskHeal: 230,
  lightDmg: [62, 66, 92], heavyDmg: 135, lightST: [16, 16, 20], heavyST: 28,
  rollST: 20, sprintDrain: 14, stRegen: 34, rollTime: 0.52, iframes: [0.04, 0.40],
  bossHP: 780, bossDmg: { slash: 30, slash2: 32, slam: 46, ring: 26, thrust: 36, jump: 44, bash: 18 },
  bossSpeed: 3.1, bossRun: 5.2, bossTurn: 2.4, recovery: 1.35,
};

// ============ AUDIO (procedural, no files) ============
let AC = null, muted = false, musicNodes = [];
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0) {
  if (muted) return; const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), ac.currentTime + dur);
  g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
}
function noise(dur, vol = 0.2, lp = 1200) {
  if (muted) return; const ac = audio(); if (!ac) return;
  const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ac.createBufferSource(); s.buffer = b;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  const g = ac.createGain(); g.gain.value = vol;
  s.connect(f).connect(g).connect(ac.destination); s.start();
}
const sfx = {
  swing() { noise(0.18, 0.12, 3000); },
  heavySwing() { noise(0.3, 0.18, 1800); },
  hitFlesh() { noise(0.12, 0.3, 700); tone(140, 0.15, 'triangle', 0.25, -60); },
  hitMetal() { tone(620, 0.25, 'square', 0.08, -300); noise(0.1, 0.2, 5000); },
  roll() { noise(0.22, 0.1, 900); },
  drink() { tone(300, 0.12, 'sine', 0.15, 150); setTimeout(() => tone(420, 0.15, 'sine', 0.15, 120), 130); setTimeout(() => tone(520, 0.2, 'sine', 0.12, 80), 280); },
  roar() { tone(70, 1.2, 'sawtooth', 0.3, 40); tone(105, 1.0, 'sawtooth', 0.2, -30); noise(0.9, 0.15, 500); },
  slam() { tone(55, 0.5, 'sine', 0.4, -20); noise(0.35, 0.3, 400); },
  death() { tone(220, 1.5, 'sawtooth', 0.15, -160); tone(110, 2.0, 'triangle', 0.2, -60); },
  victory() { [330, 415, 494, 659].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'triangle', 0.18), i * 160)); },
  bonfire() { noise(0.4, 0.06, 2500); tone(180, 0.3, 'sine', 0.1, 60); },
  stagger() { tone(200, 0.4, 'square', 0.12, -120); noise(0.25, 0.2, 1000); },
  equip() { tone(700, 0.1, 'square', 0.06, -200); noise(0.08, 0.08, 4000); },
  step() { noise(0.08, 0.05, 600); },
  bossStep() { tone(58, 0.18, 'sine', 0.12, -15); noise(0.12, 0.07, 300); },
};
function startMusic() {
  if (muted || !audio() || musicNodes.length) return;
  const ac = audio();
  const g = ac.createGain(); g.gain.value = 0.035; g.connect(ac.destination);
  [55, 82.5, 110, 138.6].forEach((f, i) => {
    const o = ac.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03;
    const lg = ac.createGain(); lg.gain.value = f * 0.01; lfo.connect(lg).connect(o.frequency);
    o.connect(g); o.start(); lfo.start(); musicNodes.push(o, lfo);
  });
}
window.addEventListener('keydown', e => { if (e.code === 'KeyM') { muted = !muted; muteBadge.classList.toggle('hidden', !muted); if (!muted) musicNodes = []; } });

// ============ RENDERER / SCENE ============
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070d);
scene.fog = new THREE.FogExp2(0x0a0a12, 0.016);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

scene.add(new THREE.HemisphereLight(0x5a6a9a, 0x2a1e12, 0.85));
const moon = new THREE.DirectionalLight(0x8fa3ff, 1.0);
moon.position.set(-18, 30, 10); moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -30; moon.shadow.camera.right = 30; moon.shadow.camera.top = 30; moon.shadow.camera.bottom = -30;
scene.add(moon);
const warm = new THREE.PointLight(0xff8c3a, 28, 32, 1.8); warm.position.set(0, 3, 24); scene.add(warm);
const fill = new THREE.DirectionalLight(0xffe0b3, 0.35); fill.position.set(10, 12, 24); scene.add(fill);

// stars
{
  const g = new THREE.BufferGeometry(), n = 400, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const t = Math.random() * Math.PI * 2, ph = Math.random() * 0.9 + 0.15, r = 120; p[i*3] = Math.cos(t) * Math.cos(ph) * r; p[i*3+1] = Math.sin(ph) * r; p[i*3+2] = Math.sin(t) * Math.cos(ph) * r; }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaabbff, size: 0.5, sizeAttenuation: false, transparent: true, opacity: 0.7 })));
  const m = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 16), new THREE.MeshBasicMaterial({ color: 0xdfe6ff }));
  m.position.set(-60, 55, -80); scene.add(m);
}

// ============ ARENA ============
const ARENA_R = 16;
function stoneTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#3d3a38'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${20+Math.random()*40|0},${18+Math.random()*36|0},${16+Math.random()*30|0},0.5)`; x.fillRect(Math.random()*256, Math.random()*256, 2+Math.random()*4, 2+Math.random()*4); }
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i*64, 0); x.lineTo(i*64, 256); x.stroke(); x.beginPath(); x.moveTo(0, i*64); x.lineTo(256, i*64); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8); return t;
}
{
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA_R + 2, 48), new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const out = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: 0x141216, roughness: 1 }));
  out.rotation.x = -Math.PI / 2; out.position.y = -0.05; scene.add(out);
  // corridor to bonfire
  const corr = new THREE.Mesh(new THREE.PlaneGeometry(8, 16), new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.9 }));
  corr.rotation.x = -Math.PI / 2; corr.position.set(0, 0.001, ARENA_R + 7); corr.receiveShadow = true; scene.add(corr);
  // outer wall ring
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c2a30, roughness: 0.95 });
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    if (Math.abs(a - Math.PI / 2) < 0.28) continue; // gate gap (south)
    const w = new THREE.Mesh(new THREE.BoxGeometry(4.6, 5, 1), wallMat);
    w.position.set(Math.cos(a) * (ARENA_R + 1.6), 2.5, Math.sin(a) * (ARENA_R + 1.6));
    w.lookAt(0, 2.5, 0); w.castShadow = w.receiveShadow = true; scene.add(w);
  }
  // pillars
  const pilMat = new THREE.MeshStandardMaterial({ color: 0x4a4750, roughness: 0.85 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + 0.39;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 9, 8), pilMat);
    p.position.set(Math.cos(a) * (ARENA_R - 1.5), 4.5, Math.sin(a) * (ARENA_R - 1.5));
    p.castShadow = p.receiveShadow = true; scene.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 2.2), pilMat);
    cap.position.set(p.position.x, 9.2, p.position.z); cap.castShadow = true; scene.add(cap);
  }
  // braziers (torches)
  window._flames = [];
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x1c1a1e, roughness: 0.6, metalness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const bx = Math.cos(a) * (ARENA_R - 0.5), bz = Math.sin(a) * (ARENA_R - 0.5);
    if (Math.abs(a - Math.PI / 2) < 0.4) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.4, 6), bowlMat);
    pole.position.set(bx, 1.2, bz); pole.castShadow = true; scene.add(pole);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.25, 0.35, 8), bowlMat);
    bowl.position.set(bx, 2.5, bz); scene.add(bowl);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 7), new THREE.MeshBasicMaterial({ color: 0xff9c2e }));
    fl.position.set(bx, 3.0, bz); scene.add(fl); window._flames.push(fl);
    const li = new THREE.PointLight(0xff8c3a, 12, 13, 1.8); li.position.set(bx, 3.2, bz); scene.add(li);
  }
}
// fog gate
const fogGate = new THREE.Mesh(new THREE.PlaneGeometry(6, 5),
  new THREE.MeshBasicMaterial({ color: 0xd8cfc0, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
fogGate.position.set(0, 2.5, ARENA_R - 3.4); scene.add(fogGate);
// bonfire
const bonfirePos = new THREE.Vector3(0, 0, 26);
{
  const stone = new THREE.MeshStandardMaterial({ color: 0x55505a, roughness: 1 });
  for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), stone); const a = i / 7 * 6.28; s.position.set(bonfirePos.x + Math.cos(a) * 0.8, 0.2, bonfirePos.z + Math.sin(a) * 0.8); s.castShadow = true; scene.add(s); }
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 1 });
  for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 6), woodMat); l.rotation.z = Math.PI / 2.3; l.rotation.y = i * 0.8; l.position.set(bonfirePos.x, 0.35, bonfirePos.z); l.castShadow = true; scene.add(l); }
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.03), new THREE.MeshStandardMaterial({ color: 0x8a8f9a, metalness: 0.9, roughness: 0.3 }));
  sword.position.set(bonfirePos.x, 0.7, bonfirePos.z); sword.rotation.z = 0.35; scene.add(sword);
  const bf = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 8), new THREE.MeshBasicMaterial({ color: 0xffa63e })); bf.position.set(bonfirePos.x, 0.9, bonfirePos.z); scene.add(bf); window._flames.push(bf);
}

}

// ============ WEAPONS (equippable, with rarity tiers) ============
const WEAPONS = {
  rustysword: { id: 'rustysword', name: 'Rusty Sword', icon: 'sword', rarity: 'common', dmg: 0.7, spd: 1.1, st: 0.9, reach: 0.9, wt: 'Light', desc: 'Pitted iron. Better than a stick.' },
  woodensword: { id: 'woodensword', name: 'Training Sword', icon: 'sword', rarity: 'common', dmg: 0.6, spd: 1.25, st: 0.7, reach: 0.95, wt: 'Light', desc: 'Worn from countless drills.' },
  longsword: { id: 'longsword', name: "Knight's Longsword", icon: 'sword', rarity: 'rare', dmg: 1.0, spd: 1.0, st: 1.0, reach: 1.0, wt: 'Standard', desc: 'A balanced blade, knightly and true.' },
  broadsword: { id: 'broadsword', name: 'Broadsword', icon: 'sword', rarity: 'rare', dmg: 1.15, spd: 0.92, st: 1.15, reach: 1.05, wt: 'Heavy', desc: 'Wide blade for crushing blows.' },
  claymore: { id: 'claymore', name: 'Claymore', icon: 'sword', rarity: 'legendary', dmg: 1.45, spd: 0.85, st: 1.35, reach: 1.15, wt: 'Heavy', desc: 'Slow, wide arcs. Hits like a siege.' },
  greatsword: { id: 'greatsword', name: 'Colossal Greatsword', icon: 'sword', rarity: 'legendary', dmg: 1.85, spd: 0.68, st: 1.7, reach: 1.25, wt: 'Super-heavy', desc: 'A mountain of iron. Few can lift it.' },
  ashenGreat: { id: 'ashenGreat', name: "Ser Duncan's Greatsword", icon: 'sword', rarity: 'legendary', dmg: 2.15, spd: 0.72, st: 1.55, reach: 1.3, wt: 'Heavy', desc: 'Still warm with embers of the vigil.' },
  moonblade: { id: 'moonblade', name: 'Moonlight Blade', icon: 'sword', rarity: 'legendary', dmg: 1.6, spd: 1.05, st: 1.2, reach: 1.2, wt: 'Standard', desc: 'Pale steel that sings in darkness.' },
};
const WEAPON_ORDER = ['rustysword', 'woodensword', 'longsword', 'broadsword', 'claymore', 'greatsword', 'ashenGreat', 'moonblade'];

function buildWeaponMesh(id) {
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c1cc, metalness: 0.95, roughness: 0.28, emissive: 0x000000 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 1.0, roughness: 0.3 });
  const grp = new THREE.Group();
  let len = 1.15, wid = 0.09, thick = 0.025, gripLen = 0.3, guardW = 0.3, wide = false, ember = false;
  if (id === 'rustysword' || id === 'woodensword') { len = 1.0; wid = 0.07; gripLen = 0.25; guardW = 0.2; }
  else if (id === 'longsword') { len = 1.15; wid = 0.09; gripLen = 0.3; guardW = 0.3; }
  else if (id === 'broadsword') { len = 1.25; wid = 0.12; thick = 0.03; gripLen = 0.35; guardW = 0.38; }
  else if (id === 'claymore') { len = 1.45; wid = 0.10; gripLen = 0.42; guardW = 0.42; }
  else if (id === 'greatsword') { len = 1.75; wid = 0.15; thick = 0.05; gripLen = 0.55; guardW = 0.5; wide = true; }
  else if (id === 'ashenGreat') { len = 1.7; wid = 0.14; thick = 0.045; gripLen = 0.5; guardW = 0.52; wide = true; ember = true; }
  else if (id === 'moonblade') { len = 1.3; wid = 0.08; thick = 0.02; gripLen = 0.32; guardW = 0.28; }
  const bladeM = ember
    ? new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.9, roughness: 0.4, emissive: 0xff4400, emissiveIntensity: 0.3 })
    : steel;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(wid, len, thick), bladeM);
  blade.position.y = -0.14 - len / 2; blade.castShadow = true; grp.add(blade);
  const tipLen = wide ? 0.10 : 0.16;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(Math.max(0.03, wid / 1.4), tipLen, 4), bladeM);
  tip.position.y = -0.14 - len - tipLen / 2; tip.rotation.x = Math.PI; tip.rotation.y = Math.PI / 4; grp.add(tip);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(guardW, 0.06, 0.08), gold); guard.position.y = -0.14; guard.castShadow = true; grp.add(guard);
  if (id === 'claymore' || id === 'greatsword' || id === 'ashenGreat' || id === 'broadsword') {
    [-1, 1].forEach(s => { const q = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.06), gold); q.position.set(s * (guardW / 2 + 0.05), -0.12, 0); q.rotation.z = s * -0.5; q.castShadow = true; grp.add(q); });
  }
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, gripLen, 8), leather); grip.position.y = -0.14 + gripLen / 2 + 0.03; grp.add(grip);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(wide ? 0.075 : 0.06, 8, 8), gold);
  pom.position.y = -0.14 + gripLen + 0.09; grp.add(pom);
  grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const glow = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.06, len, thick + 0.04), new THREE.MeshBasicMaterial({ color: 0xffb52e, transparent: true, opacity: 0 }));
  glow.position.y = blade.position.y; grp.add(glow);
  const trail = new THREE.Mesh(new THREE.PlaneGeometry(wid * 3, len + 0.2), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  trail.position.y = blade.position.y; grp.add(trail);
  return { group: grp, glow, trail };
}

// ============ KNIGHT BUILDER (procedural, jointed, layered plate armor) ============
  if (item._img) return item._img;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const rc = RARITY[item.rarity].color;
  x.shadowColor = rc; x.shadowBlur = 16;
  x.fillStyle = '#cfd6e4'; x.strokeStyle = rc; x.lineWidth = 5; x.lineJoin = 'round';
  if (item.icon === 'sword') {
    x.save(); x.translate(64, 64); x.rotate(-Math.PI / 4);
    x.beginPath(); x.moveTo(-7, -52); x.lineTo(0, -66); x.lineTo(7, -52); x.closePath(); x.fill();
    x.fillRect(-7, -52, 14, 84);
    x.fillRect(-22, 32, 44, 8); x.fillRect(-4, 40, 8, 22);
    x.restore();
  } else if (item.icon === 'shield') {
    x.beginPath(); x.moveTo(64, 20); x.lineTo(100, 32); x.lineTo(100, 66); x.quadraticCurveTo(100, 96, 64, 112); x.quadraticCurveTo(28, 96, 28, 66); x.lineTo(28, 32); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(64, 30); x.lineTo(64, 100); x.moveTo(40, 44); x.lineTo(88, 44); x.stroke();
  } else if (item.icon === 'helm') {
    x.beginPath(); x.arc(64, 56, 34, Math.PI, 0); x.fill();
    x.fillRect(30, 56, 68, 32);
    x.fillStyle = '#111'; x.shadowBlur = 0; x.fillRect(38, 64, 52, 10);
  } else if (item.icon === 'ring') {
    x.lineWidth = 12; x.beginPath(); x.arc(64, 72, 30, 0, Math.PI * 2); x.stroke();
    x.fillStyle = rc; x.beginPath(); x.moveTo(64, 16); x.lineTo(78, 34); x.lineTo(64, 50); x.lineTo(50, 34); x.closePath(); x.fill();
  } else if (item.icon === 'gem') {
    x.beginPath(); x.moveTo(64, 20); x.lineTo(98, 56); x.lineTo(64, 108); x.lineTo(30, 56); x.closePath(); x.fill(); x.stroke();
    x.lineWidth = 2.5; x.beginPath(); x.moveTo(30, 56); x.lineTo(98, 56); x.moveTo(64, 20); x.lineTo(50, 56); x.lineTo(64, 108); x.moveTo(78, 56); x.lineTo(64, 20); x.stroke();
  } else if (item.icon === 'boot') {
    x.beginPath(); x.moveTo(44, 22); x.lineTo(66, 22); x.lineTo(66, 64); x.lineTo(94, 80); x.lineTo(94, 98); x.lineTo(44, 98); x.closePath(); x.fill(); x.stroke();
  } else if (item.icon === 'flask') {
    x.beginPath(); x.arc(64, 76, 26, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillRect(56, 32, 16, 16); x.strokeRect(56, 32, 16, 16);
    x.fillStyle = '#ff9c4a'; x.shadowBlur = 0; x.beginPath(); x.arc(64, 82, 15, 0, Math.PI * 2); x.fill();
  } else if (item.icon === 'crown') {
    x.beginPath(); x.moveTo(30, 90); x.lineTo(30, 48); x.lineTo(48, 66); x.lineTo(64, 34); x.lineTo(80, 66); x.lineTo(98, 48); x.lineTo(98, 90); x.closePath(); x.fill(); x.stroke();
  } else if (item.icon === 'heart') {
    x.beginPath(); x.moveTo(64, 102); x.bezierCurveTo(18, 66, 34, 24, 64, 48); x.bezierCurveTo(94, 24, 110, 66, 64, 102); x.fill(); x.stroke();
  } else { // charm
    x.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 - Math.PI / 2, a2 = a + Math.PI / 8;
      x.lineTo(64 + Math.cos(a) * 36, 64 + Math.sin(a) * 36);
      x.lineTo(64 + Math.cos(a2) * 15, 64 + Math.sin(a2) * 15);
    }
    x.closePath(); x.fill(); x.stroke();
}
item._img = c.toDataURL();
return item._img;
}

// ============ WEAPONS (equippable, with rarity tiers) ============
const WEAPONS = {
  // Common
  rustysword: { id: 'rustysword', name: 'Rusty Sword', icon: 'sword', rarity: 'common', dmg: 0.7, spd: 1.1, st: 0.9, reach: 0.9, wt: 'Light', desc: 'Pitted iron. Better than a stick.' },
  woodensword: { id: 'woodensword', name: 'Training Sword', icon: 'sword', rarity: 'common', dmg: 0.6, spd: 1.25, st: 0.7, reach: 0.95, wt: 'Light', desc: 'Worn from countless drills.' },
  // Rare
  longsword: { id: 'longsword', name: "Knight's Longsword", icon: 'sword', rarity: 'rare', dmg: 1.0, spd: 1.0, st: 1.0, reach: 1.0, wt: 'Standard', desc: 'A balanced blade, knightly and true.' },
  broadsword: { id: 'broadsword', name: 'Broadsword', icon: 'sword', rarity: 'rare', dmg: 1.15, spd: 0.92, st: 1.15, reach: 1.05, wt: 'Heavy', desc: 'Wide blade for crushing blows.' },
  // Legendary
  claymore: { id: 'claymore', name: 'Claymore', icon: 'sword', rarity: 'legendary', dmg: 1.45, spd: 0.85, st: 1.35, reach: 1.15, wt: 'Heavy', desc: 'Slow, wide arcs. Hits like a siege.' },
  greatsword: { id: 'greatsword', name: 'Colossal Greatsword', icon: 'sword', rarity: 'legendary', dmg: 1.85, spd: 0.68, st: 1.7, reach: 1.25, wt: 'Super-heavy', desc: 'A mountain of iron. Few can lift it.' },
  ashenGreat: { id: 'ashenGreat', name: "Ser Duncan's Greatsword", icon: 'sword', rarity: 'legendary', dmg: 2.15, spd: 0.72, st: 1.55, reach: 1.3, wt: 'Heavy', desc: 'Still warm with embers of the vigil.' },
  moonblade: { id: 'moonblade', name: 'Moonlight Blade', icon: 'sword', rarity: 'legendary', dmg: 1.6, spd: 1.05, st: 1.2, reach: 1.2, wt: 'Standard', desc: 'Pale steel that sings in darkness.' },
};
const WEAPON_ORDER = ['rustysword', 'woodensword', 'longsword', 'broadsword', 'claymore', 'greatsword', 'ashenGreat', 'moonblade'];
function buildWeaponMesh(id) {
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c1cc, metalness: 0.95, roughness: 0.28, emissive: 0x000000 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 1.0, roughness: 0.3 });
  const grp = new THREE.Group();
  let len = 1.15, wid = 0.09, thick = 0.025, gripLen = 0.3, guardW = 0.3, wide = false, ember = false;
  if (id === 'dagger') { len = 0.55; wid = 0.06; gripLen = 0.16; guardW = 0.14; }
  else if (id === 'claymore') { len = 1.45; wid = 0.10; gripLen = 0.42; guardW = 0.42; }
  else if (id === 'greatsword') { len = 1.75; wid = 0.15; thick = 0.05; gripLen = 0.55; guardW = 0.5; wide = true; }
  else if (id === 'ashenGreat') { len = 1.7; wid = 0.14; thick = 0.045; gripLen = 0.5; guardW = 0.52; wide = true; ember = true; }
  const bladeM = ember
    ? new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.9, roughness: 0.4, emissive: 0xff4400, emissiveIntensity: 0.3 })
    : steel;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(wid, len, thick), bladeM);
  blade.position.y = -0.14 - len / 2; blade.castShadow = true; grp.add(blade);
  const tipLen = wide ? 0.10 : 0.16;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(Math.max(0.03, wid / 1.4), tipLen, 4), bladeM);
  tip.position.y = -0.14 - len - tipLen / 2; tip.rotation.x = Math.PI; tip.rotation.y = Math.PI / 4; grp.add(tip);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(guardW, 0.06, 0.08), gold); guard.position.y = -0.14; guard.castShadow = true; grp.add(guard);
  if (id === 'claymore' || id === 'greatsword' || id === 'ashenGreat') {
    [-1, 1].forEach(s => { const q = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.06), gold); q.position.set(s * (guardW / 2 + 0.05), -0.12, 0); q.rotation.z = s * -0.5; q.castShadow = true; grp.add(q); });
  }
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, gripLen, 8), leather); grip.position.y = -0.14 + gripLen / 2 + 0.03; grp.add(grip);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(wide ? 0.075 : 0.06, 8, 8), gold);
  pom.position.y = -0.14 + gripLen + 0.09; grp.add(pom);
  grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const glow = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.06, len, thick + 0.04), new THREE.MeshBasicMaterial({ color: 0xffb52e, transparent: true, opacity: 0 }));
  glow.position.y = blade.position.y; grp.add(glow);
  const trail = new THREE.Mesh(new THREE.PlaneGeometry(wid * 3, len + 0.2), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  trail.position.y = blade.position.y; grp.add(trail);
  return { group: grp, glow, trail };
}
function equipWeapon(id) {
  if (!WEAPONS[id] || !P.owned.includes(id) || P.weapon === id) return;
  P.weapon = id;
  const sw = playerK.parts.sword;
  while (sw.children.length) sw.remove(sw.children[0]);
  const w = buildWeaponMesh(id); sw.add(w.group);
  playerK.parts.swordGlow = w.glow; playerK.parts.trail = w.trail;
  sfx.equip(); updateWeaponLabel(); renderWeaponList();
}

// ============ KNIGHT BUILDER (procedural, jointed, layered plate armor) ============
  const g = new THREE.Group();
  const mat = (c, e = 0x000000, m = 0.7, r = 0.45) => new THREE.MeshStandardMaterial({ color: c, emissive: e, metalness: m, roughness: r });
  const armorM = mat(armor, 0, 0.85, 0.38);
  const darkM = mat(0x1c1e24, 0, 0.55, 0.65);
  const trimM = mat(trim, 0, 1.0, 0.28);
  const clothM = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.95, metalness: 0 });
  const leatherM = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.9, metalness: 0 });
  const visorM = new THREE.MeshStandardMaterial({ color: 0x050505, emissive, emissiveIntensity: 1.4 });
  const parts = {};
  const M = (geo, m, x, y, z, parent) => { const ms = new THREE.Mesh(geo, m); ms.position.set(x, y, z); ms.castShadow = true; if (parent) parent.add(ms); return ms; };

  const body = new THREE.Group(); body.position.y = ROLL_H; g.add(body); parts.body = body;

  // ---- hips / faulds / mail ----
  const hips = new THREE.Group(); hips.position.y = 0.12; body.add(hips); parts.hips = hips;
  parts._hipsY = 0.12;
  M(new THREE.SphereGeometry(0.26, 12, 10), armorM, 0, 0.02, 0, hips).scale.set(1.15, 0.8, 0.9);
  M(new THREE.BoxGeometry(0.5, 0.12, 0.34), trimM, 0, 0.10, 0, hips);
  M(new THREE.CylinderGeometry(0.30, 0.36, 0.14, 12), armorM, 0, -0.10, 0, hips);
  M(new THREE.CylinderGeometry(0.36, 0.42, 0.14, 12), armorM, 0, -0.22, 0, hips);
  M(new THREE.CylinderGeometry(0.40, 0.46, 0.34, 14, 1, true), darkM, 0, -0.30, 0, hips);
  [-0.18, 0, 0.18].forEach(x => { const t = M(new THREE.BoxGeometry(0.16, 0.30, 0.045), armorM, x, -0.30, 0.26, hips); t.rotation.x = 0.08; });
  M(new THREE.BoxGeometry(0.15, 0.10, 0.04), leatherM, 0, -0.30, -0.27, hips);

  // ---- legs: cuisse, poleyn, greave, sabaton ----
  function leg(side) {
    const hip = new THREE.Group(); hip.position.set(0.21 * side, -0.02, 0); hips.add(hip);
    M(new THREE.SphereGeometry(0.15, 10, 8), darkM, 0, 0, 0, hip);
    M(new THREE.CapsuleGeometry(0.135, 0.26, 4, 10), armorM, 0, -0.23, 0, hip);
    M(new THREE.BoxGeometry(0.14, 0.30, 0.05), armorM, 0, -0.22, 0.13, hip);
    const knee = new THREE.Group(); knee.position.y = -0.47; hip.add(knee);
    M(new THREE.SphereGeometry(0.115, 10, 8), trimM, 0, 0, 0.03, knee);
    M(new THREE.BoxGeometry(0.05, 0.10, 0.10), armorM, 0.10 * side, 0, 0.05, knee);
    M(new THREE.CylinderGeometry(0.10, 0.085, 0.26, 10), armorM, 0, -0.21, 0, knee);
    M(new THREE.BoxGeometry(0.19, 0.10, 0.36), armorM, 0, -0.40, 0.06, knee);
    M(new THREE.BoxGeometry(0.05, 0.06, 0.10), trimM, 0, -0.42, -0.12, knee);
    return { hip, knee };
  }
  const gL = leg(-1), gR = leg(1);
  parts.legL = gL.hip; parts.kneeL = gL.knee; parts.legR = gR.hip; parts.kneeR = gR.knee;

  // ---- torso: breastplate, collar, tabard, straps ----
  const torso = new THREE.Group(); torso.position.y = 0.10; hips.add(torso); parts.torso = torso;
  const chest = M(new THREE.CylinderGeometry(0.30, 0.24, 0.52, 14), armorM, 0, 0.36, 0, torso);
  parts.chest = chest; parts._chestY = 0.36;
  M(new THREE.BoxGeometry(0.05, 0.44, 0.03), trimM, 0, 0.36, 0.27, torso);
  M(new THREE.TorusGeometry(0.20, 0.06, 8, 16), trimM, 0, 0.64, 0, torso).rotation.x = Math.PI / 2;
  M(new THREE.BoxGeometry(0.32, 0.46, 0.05), clothM, 0, 0.20, 0.30, torso);
  M(new THREE.BoxGeometry(0.34, 0.06, 0.055), trimM, 0, -0.02, 0.30, torso);
  M(new THREE.BoxGeometry(0.10, 0.40, 0.03), leatherM, -0.16, 0.36, 0.27, torso).rotation.z = 0.25;
  M(new THREE.BoxGeometry(0.10, 0.40, 0.03), leatherM, 0.16, 0.36, 0.27, torso).rotation.z = -0.25;
  const capeMat = new THREE.MeshStandardMaterial({ color: cloth, roughness: 1, side: THREE.DoubleSide });
  const cape1 = M(new THREE.PlaneGeometry(0.8, 0.62, 1, 2), capeMat, 0, 0.38, -0.34, torso);
  cape1.rotation.x = 0.14; parts.cape = cape1;
  const cape2 = M(new THREE.PlaneGeometry(0.8, 0.72, 1, 2), capeMat, 0, -0.62, 0, cape1);
  cape2.rotation.x = 0.10; parts.cape2 = cape2;
  [cape1, cape2].forEach(c => { // taper: narrow at the shoulders, flaring at the hem
    const pos = c.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const k = (y + 0.31) / 0.62;
      pos.setX(i, pos.getX(i) * (1.3 - 0.5 * k));
      pos.setZ(i, Math.sin(y * 4) * 0.04);
    }
    c.geometry.computeVertexNormals();
  });

  // ---- head: gorget, full helm, visor slit, bevor ----
  const headG = new THREE.Group(); headG.position.y = 0.72; torso.add(headG); parts.head = headG;
  M(new THREE.TorusGeometry(0.14, 0.035, 8, 12), darkM, 0, 0.02, 0, headG).rotation.x = Math.PI / 2;
  M(new THREE.TorusGeometry(0.16, 0.035, 8, 12), trimM, 0, -0.04, 0, headG).rotation.x = Math.PI / 2;
  M(new THREE.CylinderGeometry(0.20, 0.22, 0.18, 12), armorM, 0, 0.05, 0, headG);
  M(new THREE.SphereGeometry(0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), armorM, 0, 0.10, 0, headG);
  const visor = M(new THREE.BoxGeometry(0.34, 0.10, 0.06), visorM, 0, 0.16, 0.19, headG); parts.visor = visor;
  M(new THREE.CylinderGeometry(0.19, 0.21, 0.10, 12, 1, false, -Math.PI * 0.32, Math.PI * 0.64), armorM, 0, 0.02, 0.05, headG);
  M(new THREE.BoxGeometry(0.05, 0.24, 0.42), new THREE.MeshStandardMaterial({ color: plume, roughness: 1 }), 0, 0.38, -0.04, headG);

  // ---- arms: deltoid socket, layered pauldrons, rerebrace, couter, vambrace ----
  function arm(side) {
    const sh = new THREE.Group(); sh.position.set(0.46 * side, 0.56, 0); torso.add(sh);
    M(new THREE.SphereGeometry(0.14, 10, 8), armorM, 0, 0, 0, sh);
    [[0.24, 0.04], [0.21, -0.03], [0.18, -0.10]].forEach(([r, y], i) => {
      const plate = M(new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), i === 1 ? trimM : armorM, 0.02 * side, y, 0, sh);
      plate.scale.set(1, 0.85, 1);
    });
    M(new THREE.CapsuleGeometry(0.105, 0.24, 4, 10), armorM, 0, -0.25, 0, sh);
    const el = new THREE.Group(); el.position.y = -0.45; sh.add(el);
    M(new THREE.SphereGeometry(0.10, 10, 8), trimM, 0, 0, 0, el);
    M(new THREE.BoxGeometry(0.04, 0.10, 0.06), trimM, 0.10 * side, 0, 0.02, el);
    M(new THREE.CylinderGeometry(0.098, 0.085, 0.24, 10), armorM, 0, -0.20, 0, el);
    const hand = new THREE.Group(); hand.position.y = -0.40; el.add(hand);
    M(new THREE.BoxGeometry(0.13, 0.15, 0.15), darkM, 0, -0.04, 0, hand);
    M(new THREE.BoxGeometry(0.05, 0.09, 0.05), darkM, 0.08 * side, -0.02, 0.03, hand);
    return { sh, el, hand };
  }
  parts.armR = arm(1); parts.armL = arm(-1);

  // sword (mesh swapped by the inventory system)
  const swordG = new THREE.Group(); parts.armR.hand.add(swordG); parts.sword = swordG;
  const wpn0 = buildWeaponMesh('longsword'); swordG.add(wpn0.group);
  parts.swordGlow = wpn0.glow; parts.trail = wpn0.trail;

  // shield strapped to the left forearm
  const shield = new THREE.Group(); shield.position.set(-0.10, -0.18, 0.10); parts.armL.el.add(shield); parts.shield = shield;
  const shM = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.07, 16), mat(0x3d4450, 0, 0.8, 0.4));
  shM.rotation.x = Math.PI / 2; shM.castShadow = true; shield.add(shM);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 20), trimM); shield.add(rim);
  const shBoss = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), trimM); shBoss.position.z = 0.05; shield.add(shBoss);
  M(new THREE.BoxGeometry(0.06, 0.24, 0.04), leatherM, 0, -0.05, -0.06, shield);

  g.scale.setScalar(scale);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, parts };
}

const playerK = buildKnight({ scale: 0.95, armor: 0x4e5a6e, trim: 0xd8cfc0, cloth: 0x2a4a7c, plume: 0x3a6ad8, emissive: 0x66aaff });
scene.add(playerK.group);
const bossK = buildKnight({ scale: 1.55, armor: 0x3a3d46, trim: 0x8a6d2e, cloth: 0x5e130c, plume: 0xff2e2e, emissive: 0xff3311 });
scene.add(bossK.group);

// ============ WEAPON PICKUPS IN THE WORLD ============
// ============ DROP SYSTEM ============
function rollDrops() {
  const out = [];
  for (let i = 0; i < 3; i++) {
    const pick = DROP_POOL[Math.random() * DROP_POOL.length | 0];
    out.push({ ...pick });
  }
  return out;
}

// ============ PARTICLES / VFX ============
const sparks = [];
function spawnSparks(pos, n = 10, color = 0xffc861, speed = 5) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.05 + Math.random() * 0.05, 5, 5), new THREE.MeshBasicMaterial({ color }));
    m.position.copy(pos);
    m.userData.v = new THREE.Vector3((Math.random()-0.5)*speed, Math.random()*speed*0.9, (Math.random()-0.5)*speed);
    m.userData.life = 0.5 + Math.random() * 0.3;
    scene.add(m); sparks.push(m);
  }
}
function spawnDust(pos) { spawnSparks(pos, 8, 0x8a8078, 2.5); }
const rings = [];
function spawnRing(pos, color = 0xffb52e, maxR = 6) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y = 0.12;
  m.userData = { r: 1, maxR }; scene.add(m); rings.push(m);
}

// ============ GAME STATE ============
const G = {
  mode: 'title', // title | play | dead | victory
  inArena: false, bossActive: false, bossDead: false,
  locked: false, ng: 0, souls: 0, fightTime: 0, hitstop: 0, paused: false, ashenDrop: false,
  camYaw: 0, camPitch: 0.32, camDist: 6.5,
  shake: 0,
};
const P = {
  pos: new THREE.Vector3(0, 0, 26), yaw: Math.PI, hp: TUNE.playerHP, maxHP: TUNE.playerHP,
  st: TUNE.playerST, stDelay: 0, flasks: TUNE.flasks,
  state: 'idle', t: 0, combo: 0, comboQueued: false, heavyHeld: false,
  rollDir: new THREE.Vector3(), iframes: false, hurtT: 0, drinkHeal: 0,
  owned: ['longsword'], weapon: 'longsword',
  items: [], spoils: [], equippedSpoils: null, stMax: TUNE.playerST,
  mods: { dmg: 1, hp: 1, st: 1, spd: 1, flask: 1 },
};
const B = {
  pos: new THREE.Vector3(0, 0, -8), yaw: 0, hp: TUNE.bossHP, maxHP: TUNE.bossHP,
  state: 'dormant', t: 0, aiT: 0, decideCd: 0, attackKind: '', hasHit: false,
  poise: 100, blocking: false, phase2: false, introT: 0,
};
function resetBoss(scaleHp = 1) {
  B.maxHP = (TUNE.bossHP + G.ng * 150) * scaleHp;
  B.hp = B.maxHP; B.pos.set(0, 0, -8); B.yaw = 0;
  B.state = 'dormant'; B.t = 0; B.poise = 100; B.phase2 = false; B.blocking = false;
  telegraphEl.classList.add('hidden'); bossK.parts.swordGlow.material.opacity = 0;
  bossK.group.position.copy(B.pos); bossK.group.rotation.y = Math.PI;
  bossPlate.classList.add('hidden'); G.bossActive = false;
}
function resetPlayer() {
  P.pos.set(0, 0, G.inArena ? 8 : 26); P.yaw = Math.PI;
  G.camYaw = 0; // camera behind player (south), player faces the arena (north)
  P.hp = P.maxHP; P.st = TUNE.playerST; P.flasks = TUNE.flasks;
  P.state = 'idle'; P.t = 0; P.iframes = false; P.drinkHeal = 0;
}
resetBoss(); resetPlayer();

// ============ INPUT ============
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','Tab'].includes(e.code)) e.preventDefault();
  if (!dropScreenEl.classList.contains('hidden')) {
    if (['KeyE','Enter','Space'].includes(e.code)) { e.preventDefault(); claimDrops(); }
    return;
  }
  if (e.code === 'Tab' || e.code === 'KeyI') { e.preventDefault(); toggleInventory(); return; }
  if (e.code === 'Escape') { if (!inventoryEl.classList.contains('hidden')) closeInventory(); return; }
  if (/^Digit[1-8]$/.test(e.code)) { const id = WEAPON_ORDER[+e.code.slice(5) - 1]; if (P.owned.includes(id)) equipWeapon(id); return; }
  if (G.mode !== 'play') return;
  if (e.code === 'KeyQ') { G.locked = !G.locked; lockHint.classList.toggle('hidden', !G.locked); if (G.locked) sfx.bonfire(); }
  if (e.code === 'KeyR') tryDrink();
  if (e.code === 'KeyE') tryInteract();
  if (e.code === 'KeyF') tryHeavy();
  if (e.code === 'Space') tryRoll();
});
addEventListener('keyup', e => keys[e.code] = false);
let dragging = false, lx = 0, ly = 0;
canvas.addEventListener('mousedown', e => {
  audio(); dragging = true; lx = e.clientX; ly = e.clientY;
  if (G.mode === 'play' && canvas.requestPointerLock && document.pointerLockElement !== canvas) {
    try { canvas.requestPointerLock(); } catch {}
  }
  if (G.mode !== 'play') return;
  if (e.button === 0) tryAttack();
  if (e.button === 2) tryHeavy();
});
addEventListener('mouseup', () => dragging = false);
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (document.pointerLockElement === canvas) {
    G.camYaw -= e.movementX * 0.0026; G.camPitch += e.movementY * 0.0022;
  } else if (dragging && G.mode === 'play') {
    G.camYaw -= (e.clientX - lx) * 0.005; G.camPitch += (e.clientY - ly) * 0.004; lx = e.clientX; ly = e.clientY;
  }
  G.camPitch = Math.max(-0.15, Math.min(1.1, G.camPitch));
});
addEventListener('wheel', e => { G.camDist = Math.max(3.5, Math.min(11, G.camDist + e.deltaY * 0.004)); }, { passive: true });

function staminaOk(c) { return P.st >= c; }
function spendSt(c) { P.st = Math.max(0, P.st - c); P.stDelay = 0.7; }
function tryAttack() {
  if (!['idle', 'run', 'attack'].includes(P.state)) return;
  if (P.state === 'attack') { P.comboQueued = true; return; }
  const c = TUNE.lightST[0];
  if (!staminaOk(c)) return;
  spendSt(c); P.state = 'attack'; P.t = 0; P.combo = 0; P.hasHit = false; sfx.swing();
}
function tryHeavy() {
  if (!['idle', 'run'].includes(P.state)) return;
  if (!staminaOk(TUNE.heavyST)) return;
  spendSt(TUNE.heavyST); P.state = 'heavy'; P.t = 0; P.hasHit = false; sfx.heavySwing();
}
function tryRoll() {
  if (!['idle', 'run', 'attack', 'heavy'].includes(P.state)) return;
  if (!staminaOk(TUNE.rollST)) return;
  spendSt(TUNE.rollST);
  const mv = moveVec();
  P.rollDir.copy(mv.lengthSq() > 0.01 ? mv : forwardOf(P.yaw));
  P.state = 'roll'; P.t = 0; sfx.roll(); spawnDust(P.pos);
}
function tryDrink() {
  if (!['idle', 'run'].includes(P.state) || P.flasks <= 0 || P.hp >= P.maxHP - 5) return;
  P.flasks--; P.state = 'drink'; P.t = 0; P.drinkHeal = Math.round(TUNE.flaskHeal * P.mods.flask); sfx.drink(); updateFlasks();
}
function tryInteract() {
  for (const pk of pickupMeshes) {
    if (!pk.taken && near(pk.grp.position, P.pos, 1.9)) { takePickup(pk); return; }
  }
  if (near(bonfirePos, P.pos, 3.2) && !G.inArena) { restAtBonfire(); return; }
  if (!G.inArena && near(new THREE.Vector3(0, 0, ARENA_R - 3.4), P.pos, 3.0)) { enterArena(); return; }
  if (G.inArena && G.bossDead) { /* nothing */ }
}

// ============ HELPERS ============
function near(a, b, d) { const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz < d * d; }
function dist2D(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function forwardOf(yaw) { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }
function moveVec() {
  let x = 0, z = 0;
  if (keys.KeyW) z -= 1; if (keys.KeyS) z += 1; if (keys.KeyA) x -= 1; if (keys.KeyD) x += 1;
  if (keys.ArrowLeft) G.camYaw += 0.05; if (keys.ArrowRight) G.camYaw -= 0.05;
  if (keys.ArrowUp) G.camPitch = Math.min(1.1, G.camPitch + 0.03); if (keys.ArrowDown) G.camPitch = Math.max(-0.15, G.camPitch - 0.03);
  const v = new THREE.Vector3(x, 0, z);
  if (v.lengthSq() < 0.01) return v;
  v.normalize();
  const c = Math.cos(G.camYaw), s = Math.sin(G.camYaw);
  return new THREE.Vector3(v.x * c - v.z * s, 0, v.x * -s - v.z * c * -1).set(v.x * c + v.z * s, 0, -v.x * s + v.z * c);
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function inArc(from, facingYaw, to, range, arc) {
  if (dist2D(from, to) > range) return false;
  const want = Math.atan2(to.x - from.x, to.z - from.z);
  return Math.abs(angDiff(want, facingYaw)) < arc;
}

// ============ DAMAGE ============
function damagePlayer(dmg, fromPos, label = '') {
  if (P.state === 'dead' || P.iframes || G.mode !== 'play') return;
  if (P.state === 'roll' && P.t > TUNE.iframes[0] && P.t < TUNE.iframes[1]) { showSub('DODGED!'); return; }
  P.hp = Math.max(0, P.hp - dmg);
  P.hurtT = 0.35; damageFlash.style.opacity = 0.9; setTimeout(() => damageFlash.style.opacity = 0, 140);
  G.shake = Math.min(0.6, G.shake + 0.3);
  spawnSparks(new THREE.Vector3(P.pos.x, 1.4, P.pos.z), 8, 0xff5040, 4);
  sfx.hitFlesh();
  if (P.hp <= 0) { playerDie(); }
  else if (P.state !== 'drink') { if (P.state === 'attack' || P.state === 'heavy') {} else { P.state = 'hurt'; P.t = 0; } }
}
function damageBoss(dmg, poiseDmg = 32) {
  if (!G.bossActive || B.state === 'dead' || G.mode !== 'play') return;
  dmg *= P.mods.dmg;
  if (B.blocking && inArc(B.pos, B.yaw, P.pos, 4, 1.1)) {
    dmg *= 0.3; sfx.hitMetal(); spawnSparks(new THREE.Vector3(B.pos.x, 1.6, B.pos.z), 10, 0x9adcff, 5);
    showSub('BLOCKED');
    const prevBlock = B.hp; B.hp = Math.max(0, B.hp - dmg);
    G.hitstop = 0.03;
  } else {
    const prev = B.hp;
    B.hp = Math.max(0, B.hp - dmg);
    sfx.hitFlesh(); G.shake = Math.min(0.5, G.shake + 0.18);
    G.hitstop = 0.055;
    spawnSparks(new THREE.Vector3(B.pos.x, 1.8, B.pos.z), 12, 0xffc861, 6);
  }
  B.poise -= poiseDmg;
  if (B.poise <= 0 && B.state !== 'stagger' && B.hp > 0) {
    B.state = 'stagger'; B.t = 0; B.blocking = false; sfx.stagger(); showSub('THE KNIGHT STAGGERS — STRIKE NOW!');
    G.hitstop = 0.10;
  }
  if (!B.phase2 && B.hp < B.maxHP * 0.5 && B.hp > 0) {
    B.phase2 = true; showCenter('SER DUNCAN KNEELS…', 'embers rise — yet his swings stay merciful'); sfx.roar();
    spawnRing(B.pos, 0xff5030, 8);
  }
  if (B.hp <= 0) bossDie();
}

// ============ FLOW ============
function showCenter(t, sub = '') { centerMsg.textContent = t; centerMsg.classList.remove('hidden'); subMsg.textContent = sub; subMsg.classList.toggle('hidden', !sub); clearTimeout(showCenter._t); showCenter._t = setTimeout(() => { centerMsg.classList.add('hidden'); subMsg.classList.add('hidden'); }, 2600); }
function showSub(t) { subMsg.textContent = t; subMsg.classList.remove('hidden'); clearTimeout(showSub._t); showSub._t = setTimeout(() => subMsg.classList.add('hidden'), 1400); }
function updateFlasks() { let s = ''; for (let i = 0; i < TUNE.flasks; i++) s += `<span class="${i < P.flasks ? '' : 'empty'}">▮</span>`; flasksEl.innerHTML = `ESTUS ${s} <span style="color:#8a7a5a;font-size:12px">(press R)</span>`; }
function restAtBonfire() {
  P.hp = P.maxHP; P.flasks = TUNE.flasks; P.st = TUNE.playerST; updateFlasks();
  if (!G.bossDead && G.bossActive) { resetBoss(); showSub('Rested. The knight resumes his vigil.'); }
  else showCenter('RESTED AT THE BONFIRE', 'flasks refilled · wounds mended');
  sfx.bonfire(); spawnSparks(bonfirePos, 16, 0xffa63e, 3);
}
function enterArena() {
  G.inArena = true; fogGate.material.opacity = 0.12;
  showCenter('THE ASHEN VIGIL', 'Ser Duncan rises…');
  setTimeout(() => {
    if (G.mode !== 'play') return;
    G.bossActive = true; B.state = 'intro'; B.t = 0;
    bossPlate.classList.remove('hidden'); sfx.roar();
    showCenter('SER DUNCAN, THE ASHEN KNIGHT', 'a merciful duel — learn, roll, punish');
  }, 1800);
}
function playerDie() {
  P.state = 'dead'; P.t = 0; G.mode = 'dead'; sfx.death();
  G.souls = 0; soulsNum.textContent = '0';
  setTimeout(() => deathScreen.classList.remove('hidden'), 900);
  setTimeout(() => {
    deathScreen.classList.add('hidden');
    G.inArena = false; fogGate.material.opacity = 0.55;
    resetBoss(); resetPlayer(); updateFlasks();
    G.locked = false; lockHint.classList.add('hidden');
    G.mode = 'play';
    showCenter('YOU WAKE AT THE BONFIRE', 'the fog awaits again — he believes in you');
  }, 3400);
}
function bossDie() {
  B.state = 'dead'; B.t = 0; G.bossDead = true; G.bossActive = false;
  sfx.victory(); spawnSparks(new THREE.Vector3(B.pos.x, 1.5, B.pos.z), 40, 0xffd76e, 7); spawnRing(B.pos, 0xffd76e, 10);
  if (!P.owned.includes('ashenGreat')) { P.owned.push('ashenGreat'); G.ashenDrop = true; }
  G.drops = rollDrops();
  setTimeout(showDropScreen, 1500);
}
function showDropScreen() {
  if (G.mode !== 'play') return;
  const list = $('drop-list'); list.innerHTML = '';
  for (const d of G.drops) {
    const rc = RARITY[d.rarity];
    const card = document.createElement('div');
    card.className = 'drop-card rarity-' + d.rarity;
    const typeTag = d.type === 'weapon' ? 'WEAPON' : 'SPOILS';
    card.innerHTML = '<img src="' + drawItemIcon(d) + '"><div class="dname">' + d.name + '</div>' +
      '<div class="drar" style="color:' + rc.color + '">' + rc.label + ' <span style="font-size:8px;color:#8a7a5a">' + typeTag + '</span></div><div class="ddesc">' + d.desc + '</div>';
    list.appendChild(card);
  }
  dropScreenEl.classList.remove('hidden');
  G.paused = true;
  if (document.pointerLockElement) document.exitPointerLock();
}
function claimDrops() {
  for (const d of G.drops) {
    if (d.type === 'weapon') {
      if (!P.owned.includes(d.id)) P.owned.push(d.id);
    } else {
      if (!P.spoils.includes(d.id)) P.spoils.push(d.id);
    }
  }
  G.drops = [];
  dropScreenEl.classList.add('hidden');
  G.paused = false;
  renderWeaponList();
  showVictory();
}
function showVictory() {
  G.mode = 'victory';
  const mins = Math.floor(G.fightTime / 60), secs = Math.floor(G.fightTime % 60);
  victoryStats.innerHTML = `Time <b>${mins}:${String(secs).padStart(2, '0')}</b> · NG+<b>${G.ng}</b><br>Estus left <b>${P.flasks}</b> · HP <b>${Math.ceil(P.hp)}/${P.maxHP}</b>` +
    (G.ashenDrop ? '<br><span style="color:#ff9c4a">Obtained: Ser Duncan\'s Greatsword</span>' : '');
  victoryScreen.classList.remove('hidden');
}
$('btn-claim').onclick = () => claimDrops();
$('btn-again').onclick = () => {  victoryScreen.classList.add('hidden');
  G.ng++; G.bossDead = false; G.inArena = false; G.fightTime = 0;
  fogGate.material.opacity = 0.55; resetBoss(); resetPlayer(); updateFlasks();
  G.mode = 'play';
  showCenter('NEW VIGIL — NG+' + G.ng, 'he strikes 25% harder. Honour him.');
};
$('btn-begin').onclick = () => {
  audio(); startMusic();
  titleScreen.style.display = 'none'; hud.classList.remove('hidden');
  G.mode = 'play'; updateFlasks();
  showCenter('FIND THE BONFIRE', 'rest (E), then step through the fog (E)');
};

// ============ BOSS AI ============
function bossDecide() {
  const d = dist2D(B.pos, P.pos);
  const opts = [];
  if (d < 3.6) opts.push('slash', 'slash', 'bash');
  else if (d < 7) opts.push('approach_slash', 'thrust', 'slam', 'approach_slash');
  else opts.push('run_thrust', 'run_slash', B.phase2 ? 'jump' : 'run_thrust');
  if (B.phase2 && Math.random() < 0.25) opts.push('slam', 'jump');
  // occasional guard (not too oppressive)
  if (Math.random() < 0.12 && d < 5) { B.state = 'block'; B.t = 0; B.blocking = true; return; }
  const pick = opts[Math.random() * opts.length | 0];
  B.attackKind = pick; B.state = 'chase'; B.t = 0; B.hasHit = false;
}
function bossStartSwing(kind) {
  B.attackKind = kind; B.state = 'windup'; B.t = 0; B.hasHit = false;
  sfx.swing();
  telegraphEl.classList.remove('hidden');
  bossK.parts.swordGlow.material.opacity = 0.85;
}
const BOSS_ATK = {
  slash: { wind: 0.65, swing: 0.3, recover: 1.0, range: 3.6, arc: 1.2, dmg: 'slash' },
  slash2: { wind: 0.4, swing: 0.28, recover: 1.1, range: 3.6, arc: 1.2, dmg: 'slash2' },
  slam: { wind: 0.85, swing: 0.25, recover: 1.3, range: 3.8, arc: 2.6, dmg: 'slam' },
  thrust: { wind: 0.55, swing: 0.3, recover: 1.1, range: 4.6, arc: 0.5, dmg: 'thrust' },
  jump: { wind: 0.7, swing: 0.35, recover: 1.4, range: 4.5, arc: 2.8, dmg: 'jump' },
  bash: { wind: 0.5, swing: 0.25, recover: 0.9, range: 2.8, arc: 1.4, dmg: 'bash' },
};
function bossDoHit(kind) {
  const a = BOSS_ATK[kind]; if (!a) return;
  const mult = 1 + G.ng * 0.25;
  if (inArc(B.pos, B.yaw, P.pos, a.range, a.arc)) damagePlayer(Math.round(TUNE.bossDmg[a.dmg] * mult), B.pos, kind);
  if (kind === 'slam' || kind === 'jump') {
    sfx.slam(); G.shake = 0.55; spawnRing(B.pos, 0xffb52e, kind === 'jump' ? 7 : 6);
    spawnDust(B.pos);
    // delayed ring check — roll through it
    setTimeout(() => {
      if (G.mode !== 'play' || P.state === 'dead') return;
      const d = dist2D(B.pos, P.pos);
      if (d < 6 && d > 1.5) damagePlayer(Math.round(TUNE.bossDmg.ring * mult), B.pos, 'ring');
    }, 320);
  }
}

// ============ UPDATE: PLAYER ============
function updatePlayer(dt) {
  P.t += dt; P.hurtT = Math.max(0, P.hurtT - dt);
  P.iframes = P.state === 'roll' && P.t > TUNE.iframes[0] && P.t < TUNE.iframes[1];
  // stamina regen
  P.stDelay -= dt;
  const sprinting = keys.ShiftLeft && moveVec().lengthSq() > 0.1 && ['idle', 'run'].includes(P.state);
  if (P.stDelay <= 0 && !sprinting) P.st = Math.min(TUNE.playerST, P.st + TUNE.stRegen * dt);
  if (sprinting) { P.st = Math.max(0, P.st - TUNE.sprintDrain * dt); if (P.st <= 0) P.stDelay = 0.5; }

  const mv = moveVec();
  const wpn = WEAPONS[P.weapon];
  const speed = (sprinting ? 1.42 : 1) * 4.6 * (1.15 - 0.15 * wpn.spd) * P.mods.spd;

  switch (P.state) {
    case 'idle': case 'run': {
      if (mv.lengthSq() > 0.01) {
        const want = Math.atan2(mv.x, mv.z);
        P.yaw += angDiff(want, P.yaw) * Math.min(1, 12 * dt);
        const sp = G.locked && G.bossActive ? speed * 0.85 : speed;
        P.pos.x += mv.x * sp * dt; P.pos.z += mv.z * sp * dt;
        P.state = 'run';
      } else P.state = 'idle';
      if (G.locked && G.bossActive) { const w = Math.atan2(B.pos.x - P.pos.x, B.pos.z - P.pos.z); P.yaw += angDiff(w, P.yaw) * Math.min(1, 8 * dt); }
      break;
    }
    case 'attack': {
      const dur = 0.55 * wpn.spd, hitA = 0.18 * wpn.spd, hitB = 0.34 * wpn.spd;
      const want = G.locked && G.bossActive ? Math.atan2(B.pos.x - P.pos.x, B.pos.z - P.pos.z) : P.yaw;
      P.yaw += angDiff(want, P.yaw) * Math.min(1, 6 * dt);
      P.pos.addScaledVector(forwardOf(P.yaw), 2.2 * wpn.spd * dt);
      if (!P.hasHit && P.t >= hitA && P.t <= hitB) {
        if (inArc(P.pos, P.yaw, B.pos, 3.1 * wpn.reach, 1.0)) { P.hasHit = true; damageBoss(TUNE.lightDmg[P.combo] * wpn.dmg, Math.round(30 * wpn.dmg)); }
      }
      if (P.t > 0.3 * wpn.spd && P.comboQueued && P.combo < 2) {
        const c = TUNE.lightST[P.combo + 1] * wpn.st;
        if (staminaOk(c)) { spendSt(c); P.combo++; P.t = 0; P.hasHit = false; P.comboQueued = false; sfx.swing(); }
        else P.comboQueued = false;
      }
      if (P.t >= dur) P.state = 'idle';
      break;
    }
    case 'heavy': {
      const dur = 0.95 * wpn.spd;
      P.yaw += (G.locked && G.bossActive ? angDiff(Math.atan2(B.pos.x - P.pos.x, B.pos.z - P.pos.z), P.yaw) : 0) * Math.min(1, 4 * dt);
      if (P.t > 0.3 * wpn.spd) P.pos.addScaledVector(forwardOf(P.yaw), 2.6 * wpn.spd * dt);
      if (!P.hasHit && P.t >= 0.42 * wpn.spd && P.t <= 0.62 * wpn.spd) {
        if (inArc(P.pos, P.yaw, B.pos, 3.3 * wpn.reach, 0.9)) { P.hasHit = true; damageBoss(TUNE.heavyDmg * wpn.dmg, Math.round(42 * wpn.dmg)); }
      }
      if (P.t >= dur) P.state = 'idle';
      break;
    }
    case 'roll': {
      const dur = TUNE.rollTime;
      P.pos.addScaledVector(P.rollDir, 8.6 * dt * (1 - P.t / dur * 0.4));
      P.yaw = Math.atan2(P.rollDir.x, P.rollDir.z);
      if (Math.random() < 0.4) spawnDust(P.pos);
      if (P.t < dur && P.t + dt >= dur) { spawnDust(P.pos); G.shake = Math.max(G.shake, 0.12); noise(0.1, 0.07, 500); } // landing thump
      if (P.t >= dur) P.state = 'idle';
      break;
    }
    case 'drink': {
      if (P.drinkHeal > 0) { const h = Math.min(P.drinkHeal, 260 * dt); P.hp = Math.min(P.maxHP, P.hp + h); P.drinkHeal -= h; }
      if (Math.random() < 0.3) spawnSparks(new THREE.Vector3(P.pos.x, 1.2, P.pos.z), 1, 0x7dff9a, 1.5);
      if (P.t >= 1.1) P.state = 'idle';
      break;
    }
    case 'hurt': if (P.t >= 0.38) P.state = 'idle'; break;
    case 'dead': break;
  }
  // clamp to world
  const maxR = G.inArena ? ARENA_R - 0.8 : 34;
  const d = Math.hypot(P.pos.x, P.pos.z);
  if (G.inArena && d > maxR) { P.pos.x *= maxR / d; P.pos.z *= maxR / d; }
  else if (!G.inArena) { P.pos.x = Math.max(-8, Math.min(8, P.pos.x)); P.pos.z = Math.max(10, Math.min(30, P.pos.z)); }
  P.pos.y = 0;
}

// ============ UPDATE: BOSS ============
function updateBoss(dt) {
  B.t += dt;
  const toP = Math.atan2(P.pos.x - B.pos.x, P.pos.z - B.pos.z);
  const d = dist2D(B.pos, P.pos);
  const turn = (B.phase2 ? 3.0 : TUNE.bossTurn);
  switch (B.state) {
    case 'dormant': {
      // kneel; rise handled by intro
      B.yaw += angDiff(0, B.yaw) * Math.min(1, dt);
      break;
    }
    case 'intro': {
      if (B.t > 1.6) { B.state = 'idle'; B.decideCd = 0.6; G.fightTime = 0; }
      break;
    }
    case 'idle': {
      B.yaw += angDiff(toP, B.yaw) * Math.min(1, turn * 0.7 * dt);
      B.decideCd -= dt;
      if (B.decideCd <= 0 && P.state !== 'dead') bossDecide();
      break;
    }
    case 'chase': {
      B.yaw += angDiff(toP, B.yaw) * Math.min(1, turn * dt);
      const want = BOSS_ATK[B.attackKind === 'approach_slash' ? 'slash' : B.attackKind === 'run_thrust' || B.attackKind === 'run_slash' ? 'thrust' : B.attackKind] ? 0 : 0;
      const spd = d > 7 ? TUNE.bossRun : TUNE.bossSpeed * (B.phase2 ? 1.2 : 1);
      B.pos.x += Math.sin(B.yaw) * spd * dt; B.pos.z += Math.cos(B.yaw) * spd * dt;
      const reach = { slash: 3.0, approach_slash: 3.0, thrust: 4.2, slam: 4.6, run_thrust: 4.2, run_slash: 3.2, jump: 5.2, bash: 2.4 }[B.attackKind] || 3;
      if (d <= reach) {
        const map = { approach_slash: 'slash', run_thrust: 'thrust', run_slash: 'slash' };
        bossStartSwing(map[B.attackKind] || B.attackKind);
      } else if (B.t > 4) { B.state = 'idle'; B.decideCd = 0.4; } // gave up chase
      break;
    }
    case 'windup': {
      B.yaw += angDiff(toP, B.yaw) * Math.min(1, (B.attackKind === 'thrust' ? 3.2 : 1.4) * dt);
      const a = BOSS_ATK[B.attackKind];
      // lunge for thrust / jump
      if (B.attackKind === 'thrust' && B.t > a.wind * 0.5) B.pos.addScaledVector(forwardOf(B.yaw), 3.5 * dt);
      if (B.attackKind === 'jump' && B.t > a.wind * 0.4) B.pos.addScaledVector(forwardOf(B.yaw), 6.5 * dt);
      if (B.t >= a.wind) { B.state = 'swing'; B.t = 0; telegraphEl.classList.add('hidden'); bossK.parts.swordGlow.material.opacity = 0; bossDoHit(B.attackKind); if (B.attackKind !== 'slam' && B.attackKind !== 'jump') sfx.slam(); }
      break;
    }
    case 'swing': {
      const a = BOSS_ATK[B.attackKind];
      if (B.attackKind === 'thrust') B.pos.addScaledVector(forwardOf(B.yaw), 4 * dt);
      if (B.t >= a.swing) {
        // combo: slash -> slash2 (merciful: only 40%)
        if (B.attackKind === 'slash' && Math.random() < 0.4 && d < 4.5 && P.state !== 'dead') bossStartSwing('slash2');
        else { B.state = 'recover'; B.t = 0; }
      }
      break;
    }
    case 'recover': {
      B.yaw += angDiff(toP, B.yaw) * Math.min(1, 1.0 * dt);
      const rec = (BOSS_ATK[B.attackKind]?.recover || 1) * (B.phase2 ? 0.85 : 1) * (TUNE.recovery / 1.35);
      if (B.t >= rec) { B.state = 'idle'; B.decideCd = 0.5 + Math.random() * 0.5; }
      break;
    }
    case 'block': {
      B.yaw += angDiff(toP, B.yaw) * Math.min(1, 3 * dt);
      if (B.t > 1.1) { B.blocking = false; B.state = 'idle'; B.decideCd = 0.4; }
      break;
    }
    case 'stagger': {
      if (B.t > 2.0) { B.state = 'idle'; B.poise = 100; B.decideCd = 0.8; }
      break;
    }
    case 'dead': break;
  }
  // stay in arena
  const dd = Math.hypot(B.pos.x, B.pos.z);
  if (dd > ARENA_R - 1) { B.pos.x *= (ARENA_R - 1) / dd; B.pos.z *= (ARENA_R - 1) / dd; }
  B.pos.y = 0;
  if (G.bossActive && P.state !== 'dead') G.fightTime += dt;
}

// ============ POSE / ANIMATION ============
// Every joint is set to an absolute, clamped angle each frame, so limbs can
// never drift apart or hyperextend. Elbows/knees bend one way only, like bone.
const clampJ = (v, a, b) => v < a ? a : v > b ? b : v;
const sstep = k => k * k * (3 - 2 * k);
function poseKnight(K, o, dt) {
  const p = K.parts;
  if (K._bOff === undefined) { K._bOff = Math.random() * 6; K._phase = Math.random() * 6; K._stride = 1; }
  const time = performance.now() * 0.001;
  // locomotion phase in radians: ~2 steps/s walk, ~3/s sprint
  K._phase += dt * (o.moving ? (o.sprint ? 9 : 6.5) : 1.1);
  const sw = o.moving ? Math.sin(K._phase) : 0;
  const strideAmp = o.sprint ? 0.62 : 0.45;

  K.group.position.copy(o.pos);
  K.group.rotation.set(0, o.yaw, 0);
  K.group.position.y = o.pos.y || 0;
  const body = p.body;
  body.rotation.set(0, 0, 0);
  body.position.y = ROLL_H;

  // ---- shared shape vars ----
  let hipsDip = 0, torsoX = 0.07, torsoY = 0, headX = 0, headY = 0;
  let legLx = sw * strideAmp, legRx = -sw * strideAmp, kneeL = 0, kneeR = 0;
  let shRx = -0.55 + sw * 0.16, shRz = -0.14, elR = -0.55;
  let shLx = -0.45 - sw * 0.16, shLz = 0.20, elL = -0.85;
  let trailT = 0, leanZ = 0;

  // footsteps: soft thud on each footfall while advancing
  const sgn = sw > 0 ? 1 : -1;
  if (o.moving && sgn !== K._stride && G.mode === 'play') {
    if (o.bossStep) sfx.bossStep();
    else if (o.sprint) { sfx.step(); if (Math.random() < 0.4) spawnDust(o.pos); }
  }
  K._stride = sgn;
  kneeL = 0.16 + Math.max(0, Math.sin(K._phase - 0.7)) * (o.sprint ? 0.85 : 0.55);
  kneeR = 0.16 + Math.max(0, Math.sin(K._phase + Math.PI - 0.7)) * (o.sprint ? 0.85 : 0.55);

  // breathing + idle weight sway (alive even when still)
  const breath = Math.sin(time * 1.7 + K._bOff);
  p.chest.position.y = p._chestY + breath * 0.008;
  if (!o.moving) {
    torsoY = Math.sin(time * 0.45 + K._bOff) * 0.05;
    headY = Math.sin(time * 0.32 + K._bOff) * 0.10;
    leanZ = Math.sin(time * 0.5 + K._bOff) * 0.015;
  } else {
    torsoY = sw * 0.05;
    leanZ = (o.strafe || 0) * 0.06;
    if (o.sprint) torsoX += 0.10;
  }
  // cape follows motion with lag
  p.cape.rotation.x = 0.14 + (o.moving ? (o.sprint ? 0.85 : 0.45) : 0.04) + Math.sin(time * 2.1 + K._bOff) * 0.05;
  p.cape2.rotation.x = 0.10 + (o.moving ? (o.sprint ? 0.55 : 0.30) : 0.02) + Math.sin(time * 1.7 + K._bOff + 0.8) * 0.08;

  const S = o.state;
  if (S === 'roll') {
    // TRUE SOMERSAULT: full 2π forward rotation about the waist, tucked tight.
    const k = clampJ(o.t / TUNE.rollTime, 0, 1);
    body.rotation.x = k * Math.PI * 2;
    body.position.y = ROLL_H + Math.sin(k * Math.PI) * 0.30; // spring over the top
    p.hips.rotation.x = 0.45; torsoX = 1.0; headX = 0.55;
    legLx = -1.35; kneeL = 2.05; legRx = -1.15; kneeR = 2.2; // knees to chest
    shRx = -1.15; shRz = -0.5; elR = -2.25;                  // arms folded over shins
    shLx = -1.05; shLz = 0.55; elL = -2.3;
  } else if (S === 'attack') {
    // full-body cuts: coil the hips, then unwind — the sword just comes along
    const k = clampJ(o.t / 0.55, 0, 1), c = o.combo || 0;
    if (c === 2) { // overhead chop: rise, then bury it
      const w = sstep(clampJ(k / 0.38, 0, 1)), s = sstep(clampJ((k - 0.38) / 0.62, 0, 1));
      shRx = -0.55 - w * 2.1 + s * 2.35; elR = -0.55 - w * 0.1 + s * 0.25;
      shRz = -0.14; torsoY = -w * 0.35 + s * 0.75; torsoX = 0.10 - w * 0.25 + s * 0.55;
      hipsDip = s * 0.10; headX = s * 0.15;
      shLx = -0.45 + s * 0.35; elL = -0.85 - s * 0.1; // off arm braces
      trailT = Math.sin(s * Math.PI) * 0.65;
    } else { // horizontal cuts, alternating sides
      const dir = c === 0 ? 1 : -1;
      const w = sstep(clampJ(k / 0.34, 0, 1)), s = sstep(clampJ((k - 0.34) / 0.66, 0, 1));
      torsoY = -dir * w * 0.55 + dir * s * 1.15;
      shRx = -0.55 - w * 0.9 + s * 0.75; elR = -0.55 - w * 0.25 + s * 0.55;
      shRz = -0.14 - dir * w * 0.55 + dir * s * 1.25;
      torsoX = 0.10 + s * 0.12; hipsDip = s * 0.05; headY = dir * s * 0.3;
      shLx = -0.45 - dir * s * 0.3; elL = -0.85;
      trailT = Math.sin(s * Math.PI) * 0.55;
    }
  } else if (S === 'heavy') {
    const k = clampJ(o.t / 0.95, 0, 1);
    const w = sstep(clampJ(k / 0.42, 0, 1)), s = sstep(clampJ((k - 0.42) / 0.58, 0, 1));
    shRx = -0.55 - w * 2.35 + s * 2.6; elR = -0.5 + s * 0.3;
    torsoY = -w * 0.5 + s * 0.9; torsoX = 0.10 - w * 0.3 + s * 0.65;
    hipsDip = w * 0.04 + s * 0.14; headX = -w * 0.15 + s * 0.2;
    shLx = -0.45 + s * 0.3; elL = -0.85;
    trailT = Math.sin(s * Math.PI) * 0.75;
  } else if (S === 'drink') {
    const k = Math.sin(clampJ(o.t / 1.1, 0, 1) * Math.PI);
    headX = -0.5 * k; torsoX = 0.07 - 0.12 * k; // tip the head back
    shRx = -0.55 - 0.35 * k; elR = -0.55 - 1.7 * k; // gauntlet to the lips
    shLx = -0.45 + 0.15 * k; elL = -0.85 - 0.2 * k;
    hipsDip = 0.03 * k;
  } else if (S === 'hurt') {
    torsoX = -0.32; headX = -0.28; // rocked back, chin up
    shRx = -0.95; elR = -1.2; shLx = -0.75; elL = -1.4; // guard flinch
    hipsDip = 0.05; kneeL = 0.35; kneeR = 0.35;
  } else if (S === 'dead') {
    // sink to one knee and plant the sword — no tipping plank
    const k = sstep(clampJ(o.t / 1.2, 0, 1));
    hipsDip = 0.50 * k;
    legLx = -0.5 * k; kneeL = 0.16 + 1.75 * k;
    legRx = -1.1 * k; kneeR = 0.16 + 2.05 * k;
    torsoX = 0.10 + 0.62 * k; headX = 0.15 + 0.42 * k;
    shRx = -0.55 - 0.35 * k; elR = -0.55 + 0.40 * k; // sword tip finds the dirt
    shLx = -0.45 + 0.60 * k; elL = -0.85 + 0.45 * k; // shield arm slumps
  } else if (S === 'dormant') {
    // kneeling vigil, sword planted, head bowed — breathing, alive
    hipsDip = 0.48; legLx = -0.5; kneeL = 1.95; legRx = -1.1; kneeR = 2.2;
    torsoX = 0.72 + breath * 0.02; headX = 0.55;
    shRx = -0.9; elR = -0.15; shLx = -0.8; elL = -1.5;
  } else if (S === 'intro') {
    // rise from the kneel and lift the blade
    const k = sstep(clampJ(o.t / 1.6, 0, 1)), inv = 1 - k;
    hipsDip = 0.48 * inv;
    legLx = -0.5 * inv; kneeL = 0.16 + 1.79 * inv;
    legRx = -1.1 * inv; kneeR = 0.16 + 2.04 * inv;
    torsoX = 0.07 + 0.65 * inv; headX = 0.55 * inv - 0.12 * Math.sin(k * Math.PI);
    shRx = -0.55 - 0.35 * inv - Math.sin(k * Math.PI) * 0.9;
    elR = -0.55 + 0.40 * inv; shLx = -0.45 - 0.35 * inv; elL = -0.85 - 0.65 * inv;
    K.group.position.y += Math.sin(k * Math.PI) * 0.12;
  } else if (S === 'windup') {
    const a = BOSS_ATK[o.kind], k = sstep(clampJ(o.t / ((a && a.wind) || 0.6), 0, 1));
    if (o.kind === 'slam' || o.kind === 'jump') {
      shRx = -0.55 - k * 2.35; elR = -0.55 + k * 0.4; // blade to the sky
      torsoX = 0.10 - k * 0.32; torsoY = -k * 0.3; hipsDip = k * 0.10; // coil down
      shLx = -0.45 - k * 0.4; elL = -0.85 - k * 0.3; headX = -k * 0.25;
    } else if (o.kind === 'thrust') {
      shRx = -0.55 - k * 0.95; elR = -0.55 + k * 0.50; // arm levels, elbow locks
      torsoY = -k * 0.6; torsoX = 0.10 + k * 0.08; hipsDip = k * 0.05;
      shLx = -0.45 + k * 0.2; headY = -k * 0.2;
    } else if (o.kind === 'bash') {
      shLx = -0.45 - k * 0.3; elL = -0.85 + k * 0.35; // shield cocks back
      torsoY = -k * 0.4; shRx = -0.55 + k * 0.25;
    } else { // slash / slash2
      const dir = o.kind === 'slash2' ? -1 : 1;
      torsoY = -dir * k * 0.6; shRx = -0.55 - k * 1.0; elR = -0.55 - k * 0.2;
      shRz = -0.14 - dir * k * 0.6; hipsDip = k * 0.07;
      shLx = -0.45 + k * 0.15;
    }
  } else if (S === 'swing') {
    const a = BOSS_ATK[o.kind], dur = (a && a.swing) || 0.3;
    const s = sstep(clampJ(o.t / dur, 0, 1));
    if (o.kind === 'slam' || o.kind === 'jump') {
      shRx = -2.9 + s * 2.7; elR = -0.15; torsoX = -0.22 + s * 0.85; hipsDip = 0.10 + s * 0.10;
      headX = s * 0.3; shLx = -0.85 + s * 0.5;
      trailT = Math.sin(s * Math.PI) * 0.6;
      if (o.kind === 'jump') K.group.position.y += Math.sin(s * Math.PI) * 0.9;
    } else if (o.kind === 'thrust') {
      torsoY = -0.6 + s * 1.1; shRx = -1.5 + s * 0.3; elR = -0.05;
      torsoX = 0.18 + s * 0.1; hipsDip = 0.05 + s * 0.06; headY = -0.2 + s * 0.35;
      trailT = Math.sin(s * Math.PI) * 0.6;
    } else if (o.kind === 'bash') {
      shLx = -0.75 - s * 0.55; elL = -0.5 - s * 0.1; torsoY = -0.4 + s * 0.8; hipsDip = s * 0.08;
    } else {
      const dir = o.kind === 'slash2' ? -1 : 1;
      torsoY = -dir * 0.6 + dir * s * 1.3;
      shRx = -1.55 + s * 0.85; elR = -0.75 + s * 0.5;
      shRz = -0.14 - dir * 0.6 + dir * s * 1.35;
      torsoX = 0.10 + s * 0.15; hipsDip = 0.07 + s * 0.04; headY = dir * s * 0.3;
      trailT = Math.sin(s * Math.PI) * 0.6;
    }
  } else if (S === 'recover') {
    torsoX = 0.16; headX = 0.08; // the merciful breather: guard sags, chest heaves
    shRx = -0.30; elR = -0.45; shLx = -0.30; elL = -0.70;
    p.chest.position.y = p._chestY + Math.sin(time * 5.2) * 0.014;
  } else if (S === 'block') {
    shLx = -1.0; elL = -1.95; // forearm vertical, shield wall in front
    shRx = -0.3; elR = -0.7; torsoY = 0.15; torsoX = 0.12;
    hipsDip = 0.07; kneeL = 0.4; kneeR = 0.4; headX = 0.12;
  } else if (S === 'stagger') {
    torsoX = -0.48 + Math.sin(o.t * 13) * 0.06; headX = -0.42; // reeling
    shRx = -1.0; elR = -1.0; shRz = -0.45; shLx = -0.9; elL = -1.2; shLz = 0.5;
    hipsDip = 0.09; kneeL = 0.4; kneeR = 0.4;
  }

  // ---- write joints (clamped: shoulders/elbows/knees can't break) ----
  p.hips.position.y = p._hipsY - hipsDip;
  p.hips.rotation.set(0, -torsoY * 0.4, leanZ * 0.5);
  const T = p.torso;
  T.rotation.set(clampJ(torsoX, -0.6, 1.2), clampJ(torsoY, -1.2, 1.2), leanZ);
  p.head.rotation.set(clampJ(headX, -0.6, 0.7), clampJ(headY, -0.7, 0.7), 0);
  p.legL.rotation.x = clampJ(legLx, -1.6, 1.2);
  p.legR.rotation.x = clampJ(legRx, -1.6, 1.2);
  p.kneeL.rotation.x = clampJ(kneeL, 0, 2.3);
  p.kneeR.rotation.x = clampJ(kneeR, 0, 2.3);
  const AR = p.armR, AL = p.armL;
  AR.sh.rotation.set(clampJ(shRx, -3.0, 0.9), 0, clampJ(shRz, -1.4, 1.4));
  AR.el.rotation.x = clampJ(elR, -2.4, -0.05);
  AL.sh.rotation.set(clampJ(shLx, -3.0, 0.9), 0, clampJ(shLz, -1.4, 1.4));
  AL.el.rotation.x = clampJ(elL, -2.4, -0.05);
  // sword trail follows swing energy
  K._trail = (K._trail || 0) + (trailT - (K._trail || 0)) * Math.min(1, 16 * dt);
  p.trail.material.opacity = K._trail;
  p.trail.rotation.y = Math.sin(time * 30) * 0.06 * K._trail;
  p.visor.material.emissiveIntensity = o.enrage ? 2.2 + Math.sin(time * 10) * 0.8 : 1.2;
}

// ============ CAMERA ============
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  let look;
  if (G.locked && G.bossActive) {
    const mid = new THREE.Vector3().addVectors(P.pos, B.pos).multiplyScalar(0.5);
    const d = dist2D(P.pos, B.pos);
    const back = new THREE.Vector3(P.pos.x - B.pos.x, 0, P.pos.z - B.pos.z).normalize();
    const want = new THREE.Vector3(P.pos.x + back.x * 3.2, 2.4, P.pos.z + back.z * 3.2);
    camTarget.lerp(want, Math.min(1, 6 * dt));
    look = new THREE.Vector3(mid.x, 1.6, mid.z);
  } else {
    const cx = Math.sin(G.camYaw) * Math.cos(G.camPitch), cz = Math.cos(G.camYaw) * Math.cos(G.camPitch);
    const want = new THREE.Vector3(P.pos.x + cx * G.camDist, 1.6 + Math.sin(G.camPitch) * G.camDist, P.pos.z + cz * G.camDist);
    // keep camera out of walls
    const dd = Math.hypot(want.x, want.z);
    if (G.inArena && dd > ARENA_R + 1) { want.x *= (ARENA_R + 1) / dd; want.z *= (ARENA_R + 1) / dd; }
    want.y = Math.max(1.0, want.y);
    camTarget.lerp(want, Math.min(1, 10 * dt));
    look = new THREE.Vector3(P.pos.x, 1.7, P.pos.z);
  }
  camera.position.copy(camTarget);
  if (G.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * G.shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * G.shake * 0.5;
    G.shake = Math.max(0, G.shake - dt * 1.8);
  }
  camera.lookAt(look);
  // FOV punch on dodge-roll / sprint: speed you can feel
  const targetFov = 55 + (P.state === 'roll' ? 8 : 0) + ((keys.ShiftLeft && P.state === 'run') ? 3 : 0);
  if (Math.abs(camera.fov - targetFov) > 0.02) { camera.fov += (targetFov - camera.fov) * Math.min(1, 8 * dt); camera.updateProjectionMatrix(); }
  // boss HP bar face check not needed
}

// ============ HUD ============
let hpShown = 1, bossShown = 1;
function updateHUD() {
  const hpk = P.hp / P.maxHP;
  hpFill.style.width = (hpk * 100) + '%';
  hpShown += (hpk - hpShown) * 0.06; hpGhost.style.width = (Math.max(hpk, hpShown) * 100) + '%';
  stFill.style.width = (P.st / P.stMax * 100) + '%';
  stFill.style.background = P.st < 22 ? '#c0392b' : '';
  const bk = B.hp / B.maxHP;
  bossFill.style.width = (bk * 100) + '%';
  bossShown += (bk - bossShown) * 0.04; bossGhost.style.width = (Math.max(bk, bossShown) * 100) + '%';
  vignette.classList.toggle('lowhp', hpk < 0.3);
  // equipped spoils display
  if (spoilsSlotEl) {
    if (P.equippedSpoils) {
      const s = SPOILS.find(x => x.id === P.equippedSpoils);
      spoilsSlotEl.textContent = s ? s.name + ' (' + s.rarity.toUpperCase() + ')' : '—';
    } else {
      spoilsSlotEl.textContent = '—';
    }
  }
  // interact prompt
  if (G.mode === 'play') {
    if (!G.inArena && near(bonfirePos, P.pos, 3.2)) { interactPrompt.classList.remove('hidden'); interactText.textContent = 'to rest at the bonfire'; }
    else if (!G.inArena && near(new THREE.Vector3(0, 0, ARENA_R - 3.4), P.pos, 3.0)) { interactPrompt.classList.remove('hidden'); interactText.textContent = 'to face Ser Duncan'; }
    else interactPrompt.classList.add('hidden');
  } else interactPrompt.classList.add('hidden');
}

// ============ INVENTORY / EQUIPMENT ============
function updateWeaponLabel() {
  const w = WEAPONS[P.weapon];
  weaponLabelEl.textContent = '» ' + w.name + ' · ' + w.wt;
}
function renderWeaponList() {
  if (inventoryEl.classList.contains('hidden')) return;
  const w = WEAPONS[P.weapon];
  invStatsEl.innerHTML = 'VIGOR <b>' + Math.ceil(P.hp) + '/' + P.maxHP + '</b> · ENDURANCE <b>' + Math.ceil(P.st) + '/' + P.stMax + '</b> · FLASKS <b>' + P.flasks + '/' + TUNE.flasks + '</b>';
  slotWeaponEl.textContent = w.name + ' (' + w.wt + ')';
  // Spoils slot
  const es = P.equippedSpoils ? SPOILS.find(x => x.id === P.equippedSpoils) : null;
  if (spoilsSlotEl) {
    if (es) {
      spoilsSlotEl.innerHTML = '<span class="rarity-' + es.rarity + '">' + es.name + '</span> <span class="unequip-hint" onclick="unequipSpoils()">(unequip)</span>';
    } else {
      spoilsSlotEl.innerHTML = '<span class="none">— empty — <span class="hint">(click a spoil to equip)</span></span>';
    }
  }
  // Weapons
  weaponListEl.innerHTML = '';
  WEAPON_ORDER.forEach((id, i) => {
    const wd = WEAPONS[id];
    const owned = P.owned.includes(id);
    const row = document.createElement('div');
    row.className = 'wrow' + (id === P.weapon ? ' equipped' : '') + (owned ? '' : ' locked');
    const bar = (label, v, max) => '<span class="wstat"><i>' + label + '</i><b style="width:' + Math.round(v / max * 100) + '%"></b></span>';
    const bars = owned
      ? bar('DMG', wd.dmg, 2.3) + bar('SPD', wd.spd, 1.35) + bar('WT', wd.st, 1.8)
      : '<span class="wstat"><i>DMG</i><b style="width:0%"></b></span><span class="wstat"><i>SPD</i><b style="width:0%"></b></span><span class="wstat"><i>WT</i><b style="width:0%"></b></span>';
    row.innerHTML = '<span class="wkey">' + (i + 1) + '</span><span class="wname rarity-' + wd.rarity + '">' + (owned ? wd.name : '???') + '</span>' +
      '<span class="wbars">' + bars + '</span>' +
      '<span class="wstate">' + (id === P.weapon ? 'EQUIPPED' : owned ? 'EQUIP' : 'NOT FOUND') + '</span>';
    if (owned) row.onclick = () => equipWeapon(id);
    weaponListEl.appendChild(row);
  });
  // Spoils list
  const spoilsHtml = P.spoils.length
    ? P.spoils.map(sid => {
      const s = SPOILS.find(x => x.id === sid);
      const eq = s && P.equippedSpoils === sid;
      return '<div class="spoil rarity-' + s.rarity + (eq ? ' equipped' : '') + '" onclick="equipSpoils(\'' + sid + '\')">' + s.name + (eq ? ' <span class="eq-tag">EQUIPPED</span>' : '') + '</div>';
    }).join('')
    : '<div class="spoil none">None yet — defeat Ser Duncan</div>';
  $('spoils-list').innerHTML = spoilsHtml;
}
function toggleInventory() {
  if (inventoryEl.classList.contains('hidden')) {
    inventoryEl.classList.remove('hidden');
    G.paused = true;
    if (document.pointerLockElement) document.exitPointerLock();
    renderWeaponList();
  } else closeInventory();
}
function closeInventory() {
  inventoryEl.classList.add('hidden');
  G.paused = false;
}
function equipSpoils(id) {
  const s = SPOILS.find(x => x.id === id);
  if (!s || !P.spoils.includes(id)) return;
  if (P.equippedSpoils) {
    const old = SPOILS.find(x => x.id === P.equippedSpoils);
    if (old) old.unapply(P);
  }
  P.equippedSpoils = id;
  s.apply(P);
  sfx.equip();
  renderWeaponList();
}
function unequipSpoils() {
  if (!P.equippedSpoils) return;
  const old = SPOILS.find(x => x.id === P.equippedSpoils);
  if (old) old.unapply(P);
  P.equippedSpoils = null;
  sfx.equip();
  renderWeaponList();
}

// ============ MAIN LOOP ============
const clock = new THREE.Clock();
camTarget.set(0, 4, 32);
let first = true;
function loop() {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, clock.getDelta());
  if (G.hitstop > 0) { G.hitstop -= dt; dt *= 0.07; } // hit-stop: impacts land with weight
  const t = clock.elapsedTime;
  // flames flicker
  for (const f of window._flames) { f.scale.y = 1 + Math.sin(t * 13 + f.position.x) * 0.18; f.rotation.y += dt * 3; }
  fogGate.material.opacity = (G.inArena ? 0.1 : 0.5) + Math.sin(t * 1.7) * 0.06;
  warm.intensity = 26 + Math.sin(t * 9) * 4;
  // embers
  if (Math.random() < 0.25) spawnSparks(new THREE.Vector3((Math.random()-0.5)*20, 0.5, (Math.random()-0.5)*20 + 6), 1, Math.random() < 0.5 ? 0xff8c3a : 0x555566, 1.2);
  // particles
  for (let i = sparks.length - 1; i >= 0; i--) {
    const m = sparks[i]; m.userData.life -= dt;
    m.userData.v.y -= 9 * dt; m.position.addScaledVector(m.userData.v, dt);
    if (m.position.y < 0.03) { m.position.y = 0.03; m.userData.v.y *= -0.3; }
    m.material.transparent = true; m.material.opacity = Math.max(0, m.userData.life * 2);
    if (m.userData.life <= 0) { scene.remove(m); sparks.splice(i, 1); }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const m = rings[i]; m.userData.r += dt * 14;
    const k = m.userData.r / m.userData.maxR;
    m.scale.setScalar(m.userData.r); m.material.opacity = 0.9 * (1 - k);
    if (k >= 1) { scene.remove(m); rings.splice(i, 1); }
  }
  if (G.mode === 'play' && !G.paused) { updatePlayer(dt); if (G.bossActive || B.state === 'dormant') updateBoss(dt); }
  // poses
  const pMoving = ['run'].includes(P.state) || (['idle'].includes(P.state) && moveVec().lengthSq() > 0.01);
  poseKnight(playerK, { moving: pMoving, sprint: !!keys.ShiftLeft, state: P.state, t: P.t, combo: P.combo, pos: P.pos, yaw: P.yaw }, dt);
  const bMoving = ['chase'].includes(B.state);
  poseKnight(bossK, { moving: bMoving, sprint: false, bossStep: true, state: B.state, t: B.t, kind: B.attackKind, pos: B.pos, yaw: B.yaw, enrage: B.phase2 }, dt);
  updateCamera(dt); updateHUD();
  renderer.render(scene, camera);
  if (first) { first = false; $('loading').style.display = 'none'; }
}
updateFlasks();
updateWeaponLabel();
loop();

// expose for automated checks
window.__game = { G, P, B, TUNE, WEAPONS, SPOILS, RARITY, DROP_POOL, enterArena, restAtBonfire, damageBoss, damagePlayer, equipWeapon, toggleInventory, equipSpoils, unequipSpoils, rollDrops, claimDrops, showDropScreen };
