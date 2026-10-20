// SOULS BOSS DEMO — one-boss souls-like. Three.js, no assets, all procedural.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ============ DOM ============
const $ = id => document.getElementById(id);
const canvas = $('game'), hud = $('hud'), titleScreen = $('title-screen');
const hpFill = $('hp-fill'), hpGhost = $('hp-ghost'), stFill = $('st-fill'), flasksEl = $('flasks');
const bossPlate = $('boss-plate'), bossFill = $('boss-fill'), bossGhost = $('boss-ghost'), bossNameEl = $('boss-name');
const interactPrompt = $('interact-prompt'), interactText = $('interact-text');
const centerMsg = $('center-msg'), subMsg = $('sub-msg'), deathScreen = $('death-screen');
const victoryScreen = $('victory-screen'), victoryStats = $('victory-stats');
const vignette = $('vignette'), damageFlash = $('damage-flash'), lockHint = $('lock-hint');
const telegraphEl = $('boss-telegraph'), muteBadge = $('mute-badge');
const inventoryEl = $('inventory'), weaponListEl = $('weapon-list'), slotWeaponEl = $('slot-weapon'), invStatsEl = $('inv-stats'), weaponLabelEl = $('weapon-label');
const dropScreenEl = $('drop-screen'), dropListEl = $('drop-list'), spoilsSlotEl = $('spoils-slot');

// ============ TUNING (vicious) ============
const TUNE = {
  playerHP: 380, playerST: 143, flasks: 2, flaskHeal: 200,
  lightDmg: [62, 66, 92], heavyDmg: 135, lightST: [18, 18, 22], heavyST: 32,
  rollST: 24, sprintDrain: 18, stRegen: 46, rollTime: 0.46, iframes: [0.06, 0.30],
  bossHP: 1450, bossDmg: { slash: 42, slash2: 46, slam: 64, ring: 38, thrust: 50, jump: 60, bash: 26, pillar: 48 },
  bossSpeed: 3.7, bossRun: 6.3, bossTurn: 3.2, recovery: 1.12,
};

// ============ AUDIO (procedural, no files) ============
let AC = null, muted = false, musicNodes = [], musicGain = null;
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
  cast() { tone(520, 0.35, 'sawtooth', 0.09, 220); tone(390, 0.4, 'triangle', 0.1, 300); noise(0.28, 0.06, 2600); },
  pillarWarn() { tone(110, 0.55, 'triangle', 0.12, 45); noise(0.3, 0.06, 700); },
  pillar() { tone(46, 0.7, 'sine', 0.35, -12); noise(0.5, 0.24, 900); },
};
function startMusic() {
  if (muted || !audio() || musicNodes.length) return;
  const ac = audio();
  const g = ac.createGain(); g.gain.value = 0.03; g.connect(ac.destination);
  musicGain = g;
  [55, 82.5, 110, 138.6].forEach((f, i) => {
    const o = ac.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03;
    const lg = ac.createGain(); lg.gain.value = f * 0.01; lfo.connect(lg).connect(o.frequency);
    o.connect(g); o.start(); lfo.start(); musicNodes.push(o, lfo);
  });
}
function stopAmbientMusic(fade = 0.8) {
  if (!musicGain) return;
  const ac = audio(); if (!ac) return;
  const g = musicGain, nodes = musicNodes;
  musicGain = null; musicNodes = [];
  const t = ac.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + fade);
  setTimeout(() => {
    nodes.forEach(n => { try { n.stop(); } catch {} });
    try { g.disconnect(); } catch {}
  }, (fade + 0.1) * 1000);
}

// ============ BOSS MUSIC (procedural, intense) ============
let bossMusic = null;
const BOSS_CHORDS = [
  { root: 73.42, notes: [146.83, 174.61, 220.00] },
  { root: 58.27, notes: [116.54, 146.83, 174.61] },
  { root: 65.41, notes: [130.81, 164.81, 196.00] },
  { root: 55.00, notes: [110.00, 138.59, 164.81] },
];
function bmTone(m, freq, at, dur, type, vol, cutoff) {
  const ac = m.ac;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let out = o;
  if (cutoff) {
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, at); f.Q.value = 1.1;
    o.connect(f); out = f;
  }
  out.connect(g); g.connect(m.master);
  o.start(at); o.stop(at + dur + 0.03);
}
function bmNoise(m, at, dur, vol, freq, type) {
  const ac = m.ac;
  const s = ac.createBufferSource(); s.buffer = m.nb;
  const f = ac.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  s.connect(f).connect(g).connect(m.master);
  s.start(at); s.stop(at + dur + 0.03);
}
function bmKick(m, at) {
  const ac = m.ac, o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(132, at);
  o.frequency.exponentialRampToValueAtTime(38, at + 0.2);
  g.gain.setValueAtTime(0.5, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
  o.connect(g).connect(m.master);
  o.start(at); o.stop(at + 0.26);
  bmNoise(m, at, 0.07, 0.07, 340, 'lowpass');
}
const BOSS_LEAD = [
  587.33, 0, 587.33, 698.46, 659.25, 587.33, 523.25, 0,
  466.16, 0, 466.16, 587.33, 523.25, 466.16, 440.00, 0,
  523.25, 0, 523.25, 659.25, 587.33, 523.25, 466.16, 0,
  440.00, 554.37, 659.25, 880.00, 783.99, 659.25, 554.37, 440.00,
];
function playBossStep(m, step, at, stepDur) {
  const s = step % 16, bar = Math.floor(step / 16) % 4;
  const ch = BOSS_CHORDS[bar];
  if (s === 0) {
    ch.notes.forEach((n, i) => bmTone(m, n * 2, at, stepDur * 15.5, 'sawtooth', 0.03, 1700 + i * 300));
    if (m.phase2) bmTone(m, ch.notes[0] * 2.828, at, stepDur * 15.5, 'sawtooth', 0.02, 2600);
  }
  if (s % 2 === 0) {
    bmTone(m, ch.root, at, stepDur * 1.7, 'sawtooth', 0.1, 600);
    bmTone(m, ch.root / 2, at, stepDur * 1.9, 'square', 0.04, 260);
  }
  const arp = [0, 1, 2, 1, 2, 0, 1, 2, 0, 2, 1, 0, 2, 1, 0, 2];
  bmTone(m, ch.notes[arp[s]] * 2, at, stepDur * 0.85, 'triangle', m.phase2 ? 0.035 : 0.026, 4200);
  if (s % 2 === 0) {
    const lead = BOSS_LEAD[(Math.floor(step / 16) % 8) * 8 + s / 2];
    if (lead) {
      bmTone(m, lead, at, stepDur * 2.3, 'triangle', 0.085, 5200);
      bmTone(m, lead * 0.5, at, stepDur * 2.3, 'sine', 0.03, 2400);
    }
  }
  if (m.phase2 && s % 4 === 2) bmTone(m, ch.notes[arp[s]] * 4, at, stepDur * 0.7, 'triangle', 0.02, 5600);
  if ([0, 3, 6, 8, 11, 14].includes(s)) bmKick(m, at);
  if (s === 4 || s === 12) {
    bmNoise(m, at, 0.16, 0.13, 1600, 'highpass');
    bmTone(m, 190, at, 0.12, 'triangle', 0.05, 0);
  }
  if (s % 2 === 0) bmNoise(m, at, 0.04, m.phase2 ? 0.03 : 0.02, 7500, 'highpass');
  else if (m.phase2) bmNoise(m, at, 0.028, 0.015, 9000, 'highpass');
  if (bar === 3 && s >= 14) bmTone(m, s === 14 ? 92 : 69, at, stepDur * 1.6, 'sine', 0.16, 0);
}
function scheduleBossMusic(m) {
  if (bossMusic !== m || m.stopped) { clearInterval(m.timer); return; }
  const ac = m.ac, stepDur = 60 / m.tempo / 4;
  if (m.next < ac.currentTime - 0.05) m.next = ac.currentTime + 0.03;
  while (m.next < ac.currentTime + 0.25) {
    if (!muted) playBossStep(m, m.step, m.next, stepDur);
    m.step = (m.step + 1) % 64;
    m.next += stepDur;
  }
}
function startBossMusic() {
  if (bossMusic) return;
  const ac = audio(); if (!ac) return;
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, ac.currentTime);
  master.gain.exponentialRampToValueAtTime(muted ? 0.0001 : 0.3, ac.currentTime + 1.3);
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 16; comp.ratio.value = 3;
  comp.attack.value = 0.004; comp.release.value = 0.18;
  master.connect(comp); comp.connect(ac.destination);
  stopAmbientMusic();
  const nb = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  bossMusic = {
    ac, master, comp, nb, step: 0, next: ac.currentTime + 0.08,
    tempo: 152, phase2: false, stopped: false, timer: null,
  };
  bossMusic.timer = setInterval(() => scheduleBossMusic(bossMusic), 25);
}
function intensifyBossMusic() {
  if (!bossMusic) return;
  bossMusic.phase2 = true; bossMusic.tempo = 168;
  const t = bossMusic.ac.currentTime, g = bossMusic.master.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.exponentialRampToValueAtTime(muted ? 0.0001 : 0.36, t + 0.8);
}
function stopBossMusic() {
  if (!bossMusic) return;
  const m = bossMusic;
  bossMusic = null; m.stopped = true; clearInterval(m.timer);
  const t = m.ac.currentTime, g = m.master.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.exponentialRampToValueAtTime(0.0001, t + 0.7);
  setTimeout(() => { try { m.master.disconnect(); m.comp.disconnect(); } catch {} }, 900);
  setTimeout(() => { if (G.mode === 'play' && !bossMusic) startMusic(); }, 1000);
}
window.addEventListener('keydown', e => {
  if (e.code === 'KeyM') {
    muted = !muted;
    muteBadge.classList.toggle('hidden', !muted);
    if (!muted) musicNodes = [];
    if (bossMusic) {
      const t = bossMusic.ac.currentTime, g = bossMusic.master.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.exponentialRampToValueAtTime(muted ? 0.0001 : (bossMusic.phase2 ? 0.36 : 0.3), t + 0.12);
    }
  }
});

// ============ RENDERER / SCENE ============
const MAX_DPR = 1.5;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_DPR));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false; // dynamic shadow maps are unreliable on software WebGL; blob shadows ground the scene
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202a2c);
scene.fog = new THREE.FogExp2(0x3d4844, 0.0112);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 260);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// dusk sky with drifting cloud banks, low moon and warm horizon haze
{
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0x0a1117).convertSRGBToLinear() },
      uMid: { value: new THREE.Color(0x2b383c).convertSRGBToLinear() },
      uHorizon: { value: new THREE.Color(0x746d5b).convertSRGBToLinear() },
      uGlow: { value: new THREE.Color(0xe0924e).convertSRGBToLinear() },
      uSunDir: { value: new THREE.Vector3(0.35, 0.16, -0.92).normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform vec3 uZenith, uMid, uHorizon, uGlow, uSunDir;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.24, h));
        col = mix(col, uZenith, smoothstep(0.2, 0.9, h));
        float sun = max(dot(d, normalize(uSunDir)), 0.0);
        col += uGlow * pow(sun, 110.0) * 1.7;
        col += uGlow * pow(sun, 9.0) * 0.14;
        col = mix(col, vec3(1.05, 1.08, 1.12), smoothstep(0.99955, 0.9999, sun));
        vec2 uv = d.xz / max(d.y + 0.14, 0.05);
        float c = fbm(uv * 1.25 + vec2(1.7, 3.2));
        c = smoothstep(0.43, 0.76, c) * smoothstep(0.015, 0.30, h);
        col = mix(col, uMid * 1.28 + uGlow * 0.045, c * 0.7);
        col = mix(col, uHorizon, smoothstep(0.16, 0.0, h) * 0.45);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(210, 48, 24), skyMat);
  sky.renderOrder = -10; scene.add(sky);
}

scene.add(new THREE.HemisphereLight(0x7b95aa, 0x1b2016, 0.62));
const moon = new THREE.DirectionalLight(0xc9dbff, 1.25);
moon.position.set(-26, 40, -18); moon.castShadow = false;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -68; moon.shadow.camera.right = 68; moon.shadow.camera.top = 68; moon.shadow.camera.bottom = -68;
moon.shadow.camera.near = 1; moon.shadow.camera.far = 190;
moon.shadow.camera.updateProjectionMatrix();
moon.shadow.bias = -0.00035; moon.shadow.normalBias = 0.025; moon.shadow.radius = 2.5;
scene.add(moon);
const warm = new THREE.PointLight(0xff8c3a, 30, 34, 1.8); warm.position.set(0, 3, 24); scene.add(warm);
const fill = new THREE.DirectionalLight(0xc9d2a8, 0.48); fill.position.set(14, 12, 20); scene.add(fill);
const rim = new THREE.DirectionalLight(0x8bacff, 1.05); rim.position.set(8, 14, -26); scene.add(rim);
const backlight = new THREE.DirectionalLight(0xa8c8e8, 1.45); backlight.position.set(-4, 10, 48); scene.add(backlight);
const arenaLight = new THREE.PointLight(0xffa15c, 55, 42, 1.7); arenaLight.position.set(0, 7, 0); scene.add(arenaLight);

// procedural environment map so metal armour reflects a sky instead of going black
{
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#58666e'); grd.addColorStop(0.42, '#9dadae');
  grd.addColorStop(0.52, '#c6cec0'); grd.addColorStop(0.56, '#5e6a42');
  grd.addColorStop(1, '#262c1c');
  x.fillStyle = grd; x.fillRect(0, 0, 512, 256);
  const fg = x.createLinearGradient(0, 108, 0, 160);
  fg.addColorStop(0, 'rgba(255,120,40,0)'); fg.addColorStop(0.5, 'rgba(255,150,60,0.5)'); fg.addColorStop(1, 'rgba(255,120,40,0)');
  x.fillStyle = fg; x.fillRect(0, 108, 512, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader();
  const rt = pmrem.fromEquirectangular(tex);
  scene.environment = rt.texture;
  tex.dispose(); pmrem.dispose();
}

// ============ POST-PROCESSING (bloom + filmic grade + vignette/grain) ============
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(innerWidth, innerHeight) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);
      float ca = 0.0009 * r2;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * ca).b;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 1.12);
      col *= mix(vec3(0.84, 0.94, 1.14), vec3(1.10, 1.0, 0.88), smoothstep(0.03, 0.6, l));
      col = max(col - 0.0015, 0.0) * 1.035;
      float vig = 1.0 - smoothstep(0.24, 0.92, length(d) * 1.34) * 0.42;
      col *= vig;
      float g = rand(uv * uResolution + uTime * 37.0);
      col += (g - 0.5) * 0.014;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
  type: THREE.HalfFloatType, samples: 2,
}));
composer.setPixelRatio(Math.min(devicePixelRatio, MAX_DPR));
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.62, 0.62, 0.74);
composer.addPass(bloomPass);
const gradePass = new ShaderPass(GradeShader);
composer.addPass(gradePass);
composer.addPass(new OutputPass());
addEventListener('resize', () => {
  composer.setPixelRatio(Math.min(devicePixelRatio, MAX_DPR));
  composer.setSize(innerWidth, innerHeight);
  gradePass.uniforms.uResolution.value.set(innerWidth, innerHeight);
  bloomPass.resolution.set(innerWidth, innerHeight);
});

// ============ TEXTURE HELPERS ============
function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); draw(x, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function hash2i(ix, iy) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const wrapI = (n, p) => ((n % p) + p) % p;
function tileNoise(x, y, period) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = wrapI(xi, period), x1 = wrapI(xi + 1, period), y0 = wrapI(yi, period), y1 = wrapI(yi + 1, period);
  const a = hash2i(x0, y0), b = hash2i(x1, y0), c = hash2i(x0, y1), d = hash2i(x1, y1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
function tileFbm(x, y, period, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * tileNoise(x * f, y * f, period * f); f *= 2; amp *= 0.5; }
  return v;
}
// Sobel height-field -> tileable tangent-space normal map (linear data, not sRGB)
function normalMapTex(size, repeat, scale = 8, strength = 2.2) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); const img = x.createImageData(size, size);
  const H = (i, j) => tileFbm(i / size * scale, j / size * scale, scale, 4);
  const n = new THREE.Vector3();
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const dx = H(i + 1, j) - H(i - 1, j);
      const dy = H(i, j + 1) - H(i, j - 1);
      n.set(-dx * strength, dy * strength, 1).normalize();
      const k = (j * size + i) * 4;
      img.data[k] = (n.x * 0.5 + 0.5) * 255;
      img.data[k + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[k + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}
function noiseMapTex(size, repeat, scale = 7, lo = 0.62, hi = 1.0) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); const img = x.createImageData(size, size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const v = tileFbm(i / size * scale, j / size * scale, scale, 4);
      const g = (lo + (hi - lo) * Math.min(1, Math.max(0, (v - 0.28) * 1.8))) * 255;
      const k = (j * size + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = g; img.data[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

const groundNormalTex = normalMapTex(256, 15, 9, 2.6);
const groundRoughTex = noiseMapTex(256, 15, 7, 0.66, 1.0);
const metalNormalTex = normalMapTex(128, 1, 6, 0.7);
const clothNormalTex = normalMapTex(128, 2, 16, 0.35);
const leatherNormalTex = normalMapTex(128, 2, 12, 0.5);

const grassBladeTex = canvasTex(128, (x, s) => {
  x.clearRect(0, 0, s, s);
  for (let i = 0; i < 30; i++) {
    const bx = 8 + Math.random() * (s - 16), bh = s * (0.35 + Math.random() * 0.55);
    const bend = (Math.random() - 0.5) * 34, w = 1.6 + Math.random() * 2.4;
    const g = x.createLinearGradient(0, s, 0, s - bh);
    const dark = 34 + Math.random() * 26 | 0;
    g.addColorStop(0, `rgba(${dark + 6},${dark + 26},${dark - 4},1)`);
    g.addColorStop(0.6, `rgba(${dark + 24},${dark + 48},${dark + 6},1)`);
    g.addColorStop(1, `rgba(${dark + 46},${dark + 66},${dark + 16},1)`);
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(bx - w, s); x.quadraticCurveTo(bx - w * 0.4 + bend * 0.4, s - bh * 0.55, bx + bend, s - bh);
    x.quadraticCurveTo(bx + w * 0.4 + bend * 0.4, s - bh * 0.55, bx + w, s);
    x.closePath(); x.fill();
  }
});
grassBladeTex.wrapS = grassBladeTex.wrapT = THREE.ClampToEdgeWrapping;

function makeFlameTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 128, 256);
  x.globalCompositeOperation = 'lighter';
  // layered teardrop lobes, white-hot core, orange body
  const lobes = [
    { cx: 64, cy: 176, rx: 26, ry: 70, col: ['rgba(255,252,220,1)', 'rgba(255,196,84,0.95)', 'rgba(255,104,20,0.55)', 'rgba(255,60,0,0)'] },
    { cx: 46, cy: 190, rx: 22, ry: 58, col: ['rgba(255,240,190,0.9)', 'rgba(255,150,40,0.8)', 'rgba(230,60,10,0.35)', 'rgba(180,30,0,0)'] },
    { cx: 84, cy: 194, rx: 20, ry: 54, col: ['rgba(255,246,205,0.85)', 'rgba(255,160,50,0.75)', 'rgba(220,56,8,0.3)', 'rgba(160,24,0,0)'] },
    { cx: 64, cy: 120, rx: 12, ry: 52, col: ['rgba(255,226,150,0.9)', 'rgba(255,140,36,0.55)', 'rgba(200,48,6,0.2)', 'rgba(150,20,0,0)'] },
  ];
  for (const l of lobes) {
    const g = x.createRadialGradient(l.cx, l.cy, 2, l.cx, l.cy, Math.max(l.rx, l.ry));
    g.addColorStop(0, l.col[0]); g.addColorStop(0.35, l.col[1]); g.addColorStop(0.72, l.col[2]); g.addColorStop(1, l.col[3]);
    x.save(); x.translate(l.cx, l.cy); x.scale(l.rx / Math.max(l.rx, l.ry), l.ry / Math.max(l.rx, l.ry)); x.translate(-l.cx, -l.cy);
    x.fillStyle = g; x.beginPath(); x.arc(l.cx, l.cy, Math.max(l.rx, l.ry), 0, Math.PI * 2); x.fill(); x.restore();
  }
  // erode edges into tongues so it does not read as a smooth blob
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, r = 34 + Math.random() * 60;
    x.beginPath(); x.arc(64 + Math.cos(a) * r, 176 + Math.sin(a) * r * 1.2, 3 + Math.random() * 14, 0, Math.PI * 2); x.fill();
  }
  x.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
  return t;
}
const flameTex = makeFlameTexture();
const smokeTex = canvasTex(128, (x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(150,150,145,0.55)'); g.addColorStop(0.5, 'rgba(130,132,128,0.22)'); g.addColorStop(1, 'rgba(120,124,120,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
});

// ============ MEADOW ARENA (grass plain, ring of fire = invisible barrier) ============
const ARENA_R = 16;
const grassTex = canvasTex(512, (x, s) => {
  x.fillStyle = '#4c5733'; x.fillRect(0, 0, s, s);
  // broad damp/dry patches break up the tiling
  for (let i = 0; i < 90; i++) {
    const g = x.createRadialGradient(Math.random() * s, Math.random() * s, 2, Math.random() * s, Math.random() * s, 20 + Math.random() * 90);
    const warm = Math.random() < 0.55;
    g.addColorStop(0, warm ? 'rgba(96,84,48,0.16)' : 'rgba(44,66,38,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  }
  for (let i = 0; i < 26000; i++) {
    const gx = Math.random() * s, gy = Math.random() * s, len = 2 + Math.random() * 9;
    const light = Math.random() < 0.48;
    x.strokeStyle = light
      ? `rgba(${54 + Math.random() * 36 | 0},${76 + Math.random() * 42 | 0},${34 + Math.random() * 22 | 0},${0.22 + Math.random() * 0.34})`
      : `rgba(${24 + Math.random() * 22 | 0},${36 + Math.random() * 26 | 0},${17 + Math.random() * 15 | 0},${0.26 + Math.random() * 0.34})`;
    x.lineWidth = 0.7 + Math.random() * 1.4;
    x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + (Math.random() - 0.5) * 3.2, gy - len); x.stroke();
  }
  for (let i = 0; i < 340; i++) {
    x.fillStyle = `rgba(${52 + Math.random() * 30 | 0},${46 + Math.random() * 24 | 0},${29 + Math.random() * 16 | 0},0.15)`;
    x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, 4 + Math.random() * 22, 3 + Math.random() * 12, Math.random() * 3.14, 0, 6.283); x.fill();
  }
}, 22);

const dirtTex = canvasTex(256, (x, s) => {
  x.fillStyle = '#5b4f39'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 9000; i++) {
    const v = 34 + Math.random() * 64 | 0;
    x.fillStyle = `rgba(${v + 18},${v + 8},${v - 4},${0.18 + Math.random() * 0.3})`;
    x.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  x.strokeStyle = 'rgba(24,18,12,0.22)'; x.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const sx = Math.random() * s, sy = Math.random() * s;
    x.beginPath(); x.moveTo(sx, sy);
    for (let k = 0; k < 4; k++) x.lineTo(sx + (Math.random() - 0.5) * 60, sy + (Math.random() - 0.5) * 60);
    x.stroke();
  }
}, 5);

const stoneTex = canvasTex(256, (x, s) => {
  x.fillStyle = '#6a6a60'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 11000; i++) {
    const v = 54 + Math.random() * 58 | 0;
    x.fillStyle = `rgba(${v + 6},${v + 4},${v - 2},${0.1 + Math.random() * 0.28})`;
    x.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 4, 1 + Math.random() * 4);
  }
  for (let i = 0; i < 40; i++) {
    x.strokeStyle = `rgba(28,28,24,${0.12 + Math.random() * 0.2})`; x.lineWidth = 0.8 + Math.random();
    const sx = Math.random() * s, sy = Math.random() * s;
    x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (Math.random() - 0.5) * 55, sy + (Math.random() - 0.5) * 20); x.stroke();
  }
}, 2);

const fireGlowTex = canvasTex(128, (x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(0.25, 'rgba(255,170,60,0.9)');
  g.addColorStop(0.6, 'rgba(255,90,20,0.35)'); g.addColorStop(1, 'rgba(255,50,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
});

const mistTex = canvasTex(128, (x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(225,235,225,0.85)'); g.addColorStop(0.55, 'rgba(210,225,215,0.35)'); g.addColorStop(1, 'rgba(200,215,205,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
});
const shadowTex = canvasTex(128, (x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(0.55, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
});
shadowTex.wrapS = shadowTex.wrapT = THREE.ClampToEdgeWrapping;

// soft contact shadow decal, used to ground props now that dynamic shadows are off
const blobGeo = new THREE.PlaneGeometry(1, 1);
function groundBlob(x, z, size, opacity = 0.38) {
  const m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({
    map: shadowTex, color: 0x000000, transparent: true, opacity, depthWrite: false,
  }));
  m.rotation.x = -Math.PI / 2; m.scale.set(size, size, 1); m.position.set(x, 0.018, z);
  m.renderOrder = 1; scene.add(m); return m;
}

const arenaFadeTex = canvasTex(256, (x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, s * 0.18, s / 2, s / 2, s / 2);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.62, '#e8e8e8'); g.addColorStop(0.88, '#555555'); g.addColorStop(1, '#000000');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
});
arenaFadeTex.colorSpace = THREE.NoColorSpace;

const fireHaloTex = canvasTex(256, (x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, s * 0.05, s / 2, s / 2, s * 0.5);
  g.addColorStop(0, 'rgba(255,120,40,0)');
  g.addColorStop(0.33, 'rgba(255,120,40,0)');
  g.addColorStop(0.41, 'rgba(255,145,65,0.35)');
  g.addColorStop(0.55, 'rgba(255,110,40,0.10)');
  g.addColorStop(1, 'rgba(255,90,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
});

const groundMat = new THREE.MeshStandardMaterial({
  map: grassTex, color: 0x9fa582, roughness: 1, metalness: 0,
  normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.75, 0.75),
  roughnessMap: groundRoughTex,
});

{
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(230, 230), groundMat);
  meadow.rotation.x = -Math.PI / 2; meadow.receiveShadow = true; scene.add(meadow);

  // trampled duelling ground, worn down to earth in the middle
  const trampled = new THREE.Mesh(new THREE.CircleGeometry(ARENA_R + 1.2, 72),
    new THREE.MeshStandardMaterial({ map: grassTex, color: 0x8f8f6b, roughness: 1, transparent: true, opacity: 0.5, depthWrite: false, normalMap: groundNormalTex, alphaMap: arenaFadeTex }));
  trampled.name = 'trampled'; trampled.rotation.x = -Math.PI / 2; trampled.position.y = 0.006; trampled.receiveShadow = true; scene.add(trampled);

  const dirt = new THREE.Mesh(new THREE.CircleGeometry(ARENA_R - 2.6, 72),
    new THREE.MeshStandardMaterial({ map: dirtTex, color: 0x9a8668, roughness: 1, transparent: true, opacity: 0.62, depthWrite: false, normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.5, 0.5), alphaMap: arenaFadeTex }));
  dirt.name = 'dirt'; dirt.rotation.x = -Math.PI / 2; dirt.position.y = 0.008; dirt.receiveShadow = true; scene.add(dirt);

  // scorched ash ring beneath the fire wall
  const scorch = new THREE.Mesh(new THREE.RingGeometry(ARENA_R - 1.1, ARENA_R + 1.4, 96),
    new THREE.MeshStandardMaterial({ color: 0x211b14, roughness: 1, transparent: true, opacity: 0.45, depthWrite: false }));
  scorch.name = 'scorch'; scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.012; scene.add(scorch);

  // instanced grass blades: two crossed alpha-tested quads, far more convincing than cones
  const bladeGeo = new THREE.BufferGeometry();
  {
    const w = 0.42, h = 0.46;
    const p = new Float32Array([
      -w / 2, 0, 0, w / 2, 0, 0, w / 2, h, 0, -w / 2, h, 0,
      0, 0, -w / 2, 0, 0, w / 2, 0, h, w / 2, 0, h, -w / 2,
    ]);
    const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]);
    bladeGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    bladeGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    bladeGeo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    bladeGeo.computeVertexNormals();
  }
  const bladeMat = new THREE.MeshStandardMaterial({
    map: grassBladeTex, alphaTest: 0.45, side: THREE.DoubleSide,
    color: 0xffffff, roughness: 0.98, metalness: 0,
  });
  const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, 2600); blades.name = 'blades';
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 2600; i++) {
    const a = Math.random() * Math.PI * 2, r = 17 + Math.pow(Math.random(), 0.6) * 52;
    dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    const sc = 0.5 + Math.random() * 0.7;
    dummy.scale.set(sc, sc * (0.7 + Math.random() * 0.55), sc);
    dummy.updateMatrix(); blades.setMatrixAt(i, dummy.matrix);
    blades.setColorAt(i, new THREE.Color().setHSL(0.19 + Math.random() * 0.06, 0.22 + Math.random() * 0.16, 0.28 + Math.random() * 0.14));
  }
  blades.instanceMatrix.needsUpdate = true; blades.instanceColor.needsUpdate = true; blades.receiveShadow = true; scene.add(blades);

  // scattered weathered rocks
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  {
    const p = rockGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.78 + hash2i(i * 17 + 3, 11) * 0.42;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * (k * 0.66), p.getZ(i) * k);
    }
    rockGeo.computeVertexNormals();
  }
  const rockMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x8a8a80, roughness: 0.96, normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.9, 0.9) });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 90); rocks.name = 'rocks';
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 44;
    dummy.position.set(Math.cos(a) * r, -0.06 + Math.random() * 0.05, Math.sin(a) * r);
    dummy.rotation.set(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.5);
    dummy.scale.setScalar(0.14 + Math.pow(Math.random(), 2.2) * 0.85);
    dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true; rocks.castShadow = true; rocks.receiveShadow = true; scene.add(rocks);

  // scattered ash patches and pebbles inside the duelling ring
  const ashPatchMat = new THREE.MeshStandardMaterial({ color: 0x17130f, roughness: 1, transparent: true, opacity: 0.28, alphaMap: arenaFadeTex, depthWrite: false });
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 13;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.6 + Math.random() * 1.2, 14), ashPatchMat);
    patch.rotation.x = -Math.PI / 2; patch.rotation.z = Math.random() * Math.PI * 2;
    patch.position.set(Math.cos(a) * r, 0.016, Math.sin(a) * r);
    patch.renderOrder = 1; scene.add(patch);
  }
  const debrisMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x6f6a5e, roughness: 1, normalMap: groundNormalTex });
  const debris = new THREE.InstancedMesh(rockGeo, debrisMat, 70); debris.name = 'arenaDebris';
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, r = 2 + Math.pow(Math.random(), 0.65) * 13;
    dummy.position.set(Math.cos(a) * r, -0.01, Math.sin(a) * r);
    dummy.rotation.set(Math.random(), Math.random() * Math.PI * 2, Math.random());
    dummy.scale.setScalar(0.04 + Math.pow(Math.random(), 2) * 0.17);
    dummy.updateMatrix(); debris.setMatrixAt(i, dummy.matrix);
  }
  debris.instanceMatrix.needsUpdate = true; debris.receiveShadow = true; scene.add(debris);

  // distant standing stones / broken ruin ring, softened by fog
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x63645c, roughness: 0.96, normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.8, 0.8) });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.24;
    if (Math.abs(angDiff(a, Math.PI / 2)) < 0.42) continue;
    const h = 3.2 + Math.random() * 3.4, rad = 0.38 + Math.random() * 0.42;
    const geo = new THREE.CylinderGeometry(rad * 0.72, rad, h, 7, 5);
    const p = geo.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const yy = p.getY(v), seed = Math.round(yy * 9 + i * 31);
      p.setX(v, p.getX(v) * (0.85 + hash2i(seed, i) * 0.3));
      p.setZ(v, p.getZ(v) * (0.85 + hash2i(seed + 7, i) * 0.3));
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, stoneMat);
    m.position.set(Math.cos(a) * (28 + Math.random() * 8), h / 2 - 0.15, Math.sin(a) * (28 + Math.random() * 8));
    m.rotation.set((Math.random() - 0.5) * 0.12, Math.random() * Math.PI, (Math.random() - 0.5) * 0.16);
    m.castShadow = true; m.receiveShadow = true; m.name = 'standingStone'; scene.add(m);
    groundBlob(m.position.x, m.position.z, 1.6 + rad * 2.2, 0.34);
  }
  // a couple of fallen columns, kept away from the camera's opening view
  for (let i = 0; i < 3; i++) {
    const a = 2.3 + i * 1.4, r = 30 + i * 2.5;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.4, 9, 1), stoneMat);
    m.rotation.set(Math.PI / 2, a, 0.1);
    m.position.set(Math.cos(a) * r, 0.38, Math.sin(a) * r);
    m.castShadow = true; m.receiveShadow = true; m.name = 'fallenColumn'; scene.add(m);
    groundBlob(m.position.x, m.position.z, 3.4, 0.32);
  }
}

// low drifting mist banks
const mistSprites = [];
for (let i = 0; i < 22; i++) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: mistTex, color: 0xdfe7dc, transparent: true, opacity: 0.05 + Math.random() * 0.07,
    depthWrite: false, fog: true,
  }));
  const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 38;
  m.position.set(Math.cos(a) * r, 0.35 + Math.random() * 1.1, Math.sin(a) * r);
  const s = 9 + Math.random() * 16;
  m.scale.set(s, s * 0.42, 1);
  m.userData = { a, r, y: m.position.y, speed: 0.006 + Math.random() * 0.012, phase: Math.random() * 6.28 };
  mistSprites.push(m); scene.add(m);
}

// fire ring — the invisible barrier made visible
window._flames = [];
const flameOuterMat = new THREE.SpriteMaterial({
  map: flameTex, color: 0xff7a28, transparent: true, opacity: 0.62,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
});
const flameCoreMat = new THREE.SpriteMaterial({
  map: flameTex, color: 0xffcf7a, transparent: true, opacity: 0.85,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
});
const emberMat = new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff7a24, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
function flameAt(x, z, h, r, withGlow = false) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z);
  const seed = Math.random() * 100;
  const outer = new THREE.Sprite(flameOuterMat);
  outer.scale.set(r * 2.9, h * 1.5, 1); outer.position.y = h * 0.62; grp.add(outer);
  const core = new THREE.Sprite(flameCoreMat);
  core.scale.set(r * 1.35, h * 0.95, 1); core.position.y = h * 0.50; grp.add(core);
  const sprites = [outer, core];
  if (withGlow) {
    const glow = new THREE.Sprite(emberMat);
    glow.scale.setScalar(r * 7.5); glow.position.y = h * 0.22; grp.add(glow); sprites.push(glow);
  }
  grp.userData = { sprites, w: r, h, seed };
  window._flames.push(grp);
  scene.add(grp);
  return grp;
}
const GATE_ANGLE = Math.PI / 2; // +z (south) — the fog gate gap
for (let i = 0; i < 56; i++) {
  const a = i / 56 * Math.PI * 2;
  let d = a - GATE_ANGLE; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) < 0.24) continue;
  const rr = ARENA_R + 0.15 + (Math.random() - 0.5) * 1.2;
  flameAt(Math.cos(a) * rr, Math.sin(a) * rr, 1.0 + Math.random() * 2.1, 0.32 + Math.random() * 0.42);
}
// faint low glow at the base of the fire line
const bandMat = new THREE.MeshBasicMaterial({ color: 0xff5a14, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const band = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R + 0.25, 0.35, 8, 96), bandMat);
band.rotation.x = Math.PI / 2; band.position.y = 0.3; scene.add(band);
// soft firelight spill on the ground outside the ring
const fireHalo = new THREE.Mesh(new THREE.PlaneGeometry(84, 84), new THREE.MeshBasicMaterial({
  map: fireHaloTex, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending,
  depthWrite: false, fog: false,
}));
fireHalo.rotation.x = -Math.PI / 2; fireHalo.position.y = 0.022; fireHalo.renderOrder = 2; scene.add(fireHalo);
// scattered fires out on the plain, each grounded by a small charred fire pit
const pitStoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x3a342b, roughness: 1, normalMap: groundNormalTex });
const pitCoalMat = new THREE.MeshStandardMaterial({ color: 0x1a0d06, emissive: 0xff5a14, emissiveIntensity: 1.1, roughness: 0.9 });
const pitAshMat = new THREE.MeshStandardMaterial({ color: 0x0c0a07, roughness: 1, transparent: true, opacity: 0.55, alphaMap: arenaFadeTex, depthWrite: false });
function fireBaseAt(x, z) {
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.62, 16), pitAshMat);
  ash.rotation.x = -Math.PI / 2; ash.position.set(x, 0.014, z); scene.add(ash);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + Math.random() * 0.5, r = 0.36 + Math.random() * 0.16;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.10 + Math.random() * 0.07), pitStoneMat);
    s.position.set(x + Math.cos(a) * r, 0.08, z + Math.sin(a) * r);
    s.rotation.set(Math.random(), Math.random(), Math.random()); scene.add(s);
  }
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.045 + Math.random() * 0.035), pitCoalMat);
    c.position.set(x + (Math.random() - 0.5) * 0.3, 0.06, z + (Math.random() - 0.5) * 0.3); scene.add(c);
  }
}
for (let i = 0; i < 8; i++) {
  const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 30;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  fireBaseAt(x, z);
  flameAt(x, z, 0.6 + Math.random() * 0.7, 0.14 + Math.random() * 0.10);
}
// warm glows around the barrier (few, for performance)
for (let i = 0; i < 3; i++) {
  const a = i / 3 * Math.PI * 2 + 0.3;
  const li = new THREE.PointLight(0xff7a26, 26, 32, 1.8);
  li.position.set(Math.cos(a) * ARENA_R, 1.8, Math.sin(a) * ARENA_R); scene.add(li);
}

// mist gate (entry to the ring)
const fogGate = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.4),
  new THREE.MeshBasicMaterial({ map: mistTex, color: 0xe6eee2, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
fogGate.position.set(0, 2.2, ARENA_R - 3.4); scene.add(fogGate);

// bonfire on the grass
const bonfirePos = new THREE.Vector3(0, 0, 26);
groundBlob(bonfirePos.x, bonfirePos.z, 4.2, 0.4);
const smokeSprites = [];
{
  const stone = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x6a665c, roughness: 1, normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.7, 0.7) });
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + Math.random() * 0.1), stone); const a = i / 9 * 6.28; s.position.set(bonfirePos.x + Math.cos(a) * 0.85, 0.18, bonfirePos.z + Math.sin(a) * 0.85); s.rotation.set(Math.random(), Math.random(), Math.random()); s.castShadow = s.receiveShadow = true; scene.add(s); }
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0d, roughness: 1 });
  for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 1.5, 8), woodMat); l.rotation.z = Math.PI / 2.4; l.rotation.y = i * 0.7; l.position.set(bonfirePos.x, 0.32, bonfirePos.z); l.castShadow = true; scene.add(l); }
  // glowing coals
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x2a1208, emissive: 0xff5a14, emissiveIntensity: 1.6, roughness: 0.9 });
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06 + Math.random() * 0.06), coalMat);
    c.position.set(bonfirePos.x + (Math.random() - 0.5) * 0.7, 0.10 + Math.random() * 0.1, bonfirePos.z + (Math.random() - 0.5) * 0.7);
    scene.add(c);
  }
  flameAt(bonfirePos.x, bonfirePos.z, 1.55, 0.46, true);
  flameAt(bonfirePos.x, bonfirePos.z, 0.85, 0.26);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff9a40, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(7); glow.position.set(bonfirePos.x, 1.0, bonfirePos.z); scene.add(glow);
  const bonfireLight = new THREE.PointLight(0xff8b3c, 22, 16, 1.9); bonfireLight.position.set(bonfirePos.x, 1.4, bonfirePos.z); scene.add(bonfireLight);
  // pale smoke drifting up from the fire
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x9a9c94, transparent: true, opacity: 0.10, depthWrite: false, fog: true }));
    s.position.set(bonfirePos.x + (Math.random() - 0.5) * 0.5, 1.2 + i * 0.45, bonfirePos.z + (Math.random() - 0.5) * 0.5);
    s.scale.setScalar(1.2 + i * 0.35);
    s.userData = { y0: s.position.y, phase: Math.random() * 6.28, drift: (Math.random() - 0.5) * 0.16 };
    smokeSprites.push(s); scene.add(s);
  }
}

// ============ AWAKENING STONE (arena centre) ============
const stonePos = new THREE.Vector3(0, 0, 0);
const altarStoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x6d6b61, roughness: 0.94, metalness: 0.02, normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.85, 0.85) });
const altarDarkMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x35342f, roughness: 0.88, metalness: 0.05, normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.7, 0.7) });
let altarGem, altarGemMat, altarGlow, altarLight, altarRuneMat;
{
  const altar = new THREE.Group(); altar.position.copy(stonePos); scene.add(altar);
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.5, 0.28, 12), altarDarkMat);
  dais.position.y = 0.14; dais.castShadow = dais.receiveShadow = true; altar.add(dais);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + 0.2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + Math.random() * 0.14), altarStoneMat);
    rock.position.set(Math.cos(a) * 1.28, 0.24, Math.sin(a) * 1.28);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = rock.receiveShadow = true; altar.add(rock);
  }
  const obGeo = new THREE.CylinderGeometry(0.32, 0.48, 2.15, 5, 3);
  {
    const p = obGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.92 + hash2i(i * 13 + 5, 7) * 0.16;
      p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k);
    }
    obGeo.computeVertexNormals();
  }
  const obelisk = new THREE.Mesh(obGeo, altarStoneMat);
  obelisk.position.y = 1.25; obelisk.rotation.y = 0.12; obelisk.rotation.z = 0.035;
  obelisk.castShadow = obelisk.receiveShadow = true; altar.add(obelisk);
  const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38), altarStoneMat);
  cap.position.set(0.02, 2.33, 0); cap.rotation.set(0.2, 0.4, -0.15); cap.scale.set(1, 0.58, 0.9);
  cap.castShadow = cap.receiveShadow = true; altar.add(cap);

  const socket = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 24), altarDarkMat);
  socket.position.set(0, 1.52, 0.4); socket.rotation.x = 0.06; altar.add(socket);

  altarRuneMat = new THREE.MeshStandardMaterial({ color: 0x2a1206, emissive: 0xff6a1e, emissiveIntensity: 1.6, roughness: 0.55, metalness: 0.1 });
  for (const [x, y, rot, len] of [[-0.16, 1.98, 0.25, 0.34], [-0.16, 1.6, -0.18, 0.28], [0.17, 1.95, -0.22, 0.26], [0.17, 1.5, 0.2, 0.3], [0, 0.98, 0, 0.4]]) {
    const rune = new THREE.Mesh(new THREE.BoxGeometry(0.03, len, 0.02), altarRuneMat);
    rune.position.set(x, y, 0.39); rune.rotation.z = rot; altar.add(rune);
  }

  altarGemMat = new THREE.MeshStandardMaterial({ color: 0xffc27a, emissive: 0xff6a1e, emissiveIntensity: 2.4, metalness: 0.35, roughness: 0.18 });
  altarGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.27, 0), altarGemMat);
  altarGem.scale.set(0.85, 1.3, 0.85);
  altarGem.position.set(0, 1.52, 0.55);
  altarGem.castShadow = true; altar.add(altarGem);

  altarGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff9a46, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  altarGlow.scale.setScalar(2.2); altarGlow.position.set(0, 1.52, 0.52); altar.add(altarGlow);
  altarLight = new THREE.PointLight(0xff7a26, 14, 14, 2);
  altarLight.position.set(0, 1.7, 0.4); altar.add(altarLight);
}
function resetAltar() {
  if (!altarGem) return;
  altarGem.visible = true;
  altarGem.position.set(0, 1.52, 0.55);
  altarGem.scale.set(0.85, 1.3, 0.85);
  altarGem.rotation.set(0, 0, 0);
  altarGemMat.emissiveIntensity = 2.4;
  altarGlow.visible = true;
  altarGlow.material.opacity = 0.62;
  altarGlow.scale.setScalar(2.2);
  altarLight.intensity = 14;
  altarRuneMat.emissiveIntensity = 1.6;
}

// ============ DARK FOREST & DISTANT RUINED KEEP ============
{
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x27221c, roughness: 1, flatShading: true });
  const addBranch = (out, start, dir, len, rad, depth, seed) => {
    const geo = new THREE.CylinderGeometry(rad * 0.5, rad, len, 6, 1);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const pos = start.clone().addScaledVector(dir, len / 2);
    geo.applyMatrix4(new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1)));
    out.push(geo);
    if (depth <= 0) return;
    const end = start.clone().addScaledVector(dir, len);
    const n = depth > 1 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = seed * 1.9 + i * 2.3 + Math.random() * 1.2;
      const spread = 0.45 + Math.random() * 0.55;
      const nd = new THREE.Vector3(dir.x + Math.cos(a) * spread, dir.y * 0.7 + 0.14, dir.z + Math.sin(a) * spread).normalize();
      addBranch(out, end, nd, len * (0.58 + Math.random() * 0.18), rad * 0.58, depth - 1, seed + i * 3.7 + Math.random());
    }
  };
  const treeSpots = [[-25, -22, 2.6], [24, -26, 2.1], [-36, 10, 3.0], [33, 14, 2.4], [-18, 31, 1.7], [41, -8, 2.8], [-46, -12, 2.2], [-10, -41, 2.3], [7, -46, 2.7], [20, -38, 2.0], [-30, -36, 2.4], [36, -30, 2.2]];
  for (let ti = 0; ti < treeSpots.length; ti++) {
    const [x, z, sc] = treeSpots[ti];
    const tree = new THREE.Group(); tree.position.set(x, 0, z); tree.scale.setScalar(sc); tree.name = 'deadTree';
    const geos = [];
    addBranch(geos, new THREE.Vector3(0, 0, 0), new THREE.Vector3((Math.random() - 0.5) * 0.16, 1, (Math.random() - 0.5) * 0.16).normalize(), 3.2 + Math.random() * 1.4, 0.24, 3, ti * 2.1);
    const merged = mergeGeometries(geos, false);
    if (merged) {
      for (const geo of geos) geo.dispose();
      const trunk = new THREE.Mesh(merged, barkMat);
      trunk.castShadow = true; tree.add(trunk);
    } else {
      for (const geo of geos) { const m = new THREE.Mesh(geo, barkMat); m.castShadow = true; tree.add(m); }
    }
    scene.add(tree);
    groundBlob(x, z, 4.0 * sc, 0.36);
  }

  // cold moonlight shafts cutting through the fog
  const rayTex = canvasTex(128, (x, s) => {
    const g = x.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, 'rgba(190,215,255,0.20)'); g.addColorStop(0.55, 'rgba(170,200,255,0.06)'); g.addColorStop(1, 'rgba(150,185,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    x.globalCompositeOperation = 'destination-in';
    const hg = x.createLinearGradient(0, 0, s, 0);
    hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.36, 'rgba(0,0,0,0.85)'); hg.addColorStop(0.64, 'rgba(0,0,0,0.85)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = hg; x.fillRect(0, 0, s, s);
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 16; i++) x.fillRect(Math.random() * s, 0, 1 + Math.random() * 4, s);
  });
  for (let i = 0; i < 5; i++) {
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + Math.random() * 2.6, 52), new THREE.MeshBasicMaterial({
      map: rayTex, transparent: true, opacity: 0.035 + Math.random() * 0.03, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: true,
    }));
    ray.position.set(-30 + Math.random() * 60, 24, -44 + Math.random() * 10);
    ray.rotation.z = 0.28 + Math.random() * 0.16;
    ray.rotation.y = -0.5 + Math.random() * 1.0;
    ray.name = 'moonShaft';
    scene.add(ray);
  }
}

// ============ SHARED MATERIAL TEXTURES ============
const metalTex = canvasTex(256, (x, s) => {
  x.fillStyle = '#8e949b'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const v = 70 + Math.random() * 90 | 0;
    x.fillStyle = `rgba(${v},${v},${v + 6},${0.05 + Math.random() * 0.10})`;
    x.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  for (let i = 0; i < 70; i++) {
    x.strokeStyle = `rgba(${60 + Math.random() * 60 | 0},${60 + Math.random() * 60 | 0},${65 + Math.random() * 60 | 0},${0.15 + Math.random() * 0.25})`;
    x.lineWidth = 0.6 + Math.random(); x.beginPath();
    const y0 = Math.random() * s, x0 = Math.random() * s;
    x.moveTo(x0, y0); x.lineTo(x0 + (Math.random() - 0.5) * 90, y0 + (Math.random() - 0.5) * 14); x.stroke();
  }
});
const mailTex = canvasTex(128, (x, s) => {
  x.fillStyle = '#23262b'; x.fillRect(0, 0, s, s);
  x.strokeStyle = '#6a7078'; x.lineWidth = 1.4;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const cx = col * 13 + (row % 2 ? 6 : 0), cy = row * 13;
      x.beginPath(); x.arc(cx, cy, 5, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = 'rgba(130,140,150,0.45)'; x.beginPath(); x.arc(cx, cy, 5, Math.PI * 0.2, Math.PI * 1.1); x.stroke();
      x.strokeStyle = '#6a7078';
    }
  }
}, 3);
const clothTex = canvasTex(128, (x, s) => {
  x.fillStyle = '#b8b8b8'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 5200; i++) {
    const v = 120 + Math.random() * 70 | 0;
    x.fillStyle = `rgba(${v},${v},${v},${0.1 + Math.random() * 0.2})`;
    x.fillRect(Math.random() * s, Math.random() * s, 1, 2 + Math.random() * 3);
  }
  x.strokeStyle = 'rgba(60,60,60,0.18)'; x.lineWidth = 1;
  for (let i = 0; i < s; i += 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, s); x.stroke(); }
  for (let i = 0; i < s; i += 4) { x.beginPath(); x.moveTo(0, i); x.lineTo(s, i); x.stroke(); }
}, 2);
const leatherTex = canvasTex(128, (x, s) => {
  x.fillStyle = '#4a3726'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 1400; i++) {
    const v = 40 + Math.random() * 60 | 0;
    x.fillStyle = `rgba(${v + 20},${v + 8},${v - 4},${0.15 + Math.random() * 0.25})`;
    x.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}, 2);
const furTex = canvasTex(128, (x, s) => {
  x.fillStyle = '#8d887c'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const v = 110 + Math.random() * 80 | 0;
    x.strokeStyle = `rgba(${v},${v - 6},${v - 18},${0.2 + Math.random() * 0.4})`;
    x.lineWidth = 0.7 + Math.random() * 1.1;
    const sx = Math.random() * s, sy = Math.random() * s;
    x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + (Math.random() - 0.5) * 6, sy + 6 + Math.random() * 12); x.stroke();
  }
}, 2);
const shieldTex = canvasTex(256, (x, s) => {
  const cx = s / 2, cy = s / 2;
  const g = x.createRadialGradient(cx, cy, 6, cx, cy, cx);
  g.addColorStop(0, '#7a6a4e'); g.addColorStop(0.5, '#4a4238'); g.addColorStop(1, '#241f1a');
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, cx, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(190,175,140,0.45)'; x.lineWidth = 3;
  for (let k = 1; k <= 5; k++) {
    x.beginPath();
    for (let i = 0; i <= 60; i++) {
      const a = i / 60 * Math.PI * 2, r = k * 20 + Math.sin(a * 3 + k) * 5;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    x.fillStyle = 'rgba(205,190,150,0.5)';
    x.beginPath(); x.arc(cx + Math.cos(a) * (cx - 14), cy + Math.sin(a) * (cx - 14), 3, 0, Math.PI * 2); x.fill();
  }
});


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
  const steel = new THREE.MeshStandardMaterial({ color: 0xc6ccd3, metalness: 1.0, roughness: 0.26, map: metalTex, bumpMap: metalTex, bumpScale: 0.008 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x767c84, metalness: 0.95, roughness: 0.44, map: metalTex });
  const leather = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.92, map: leatherTex });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb08d4a, metalness: 1.0, roughness: 0.34, map: metalTex });
  const grp = new THREE.Group();
  let len = 1.15, wid = 0.09, thick = 0.025, gripLen = 0.3, guardW = 0.3, wide = false, ember = false;
  if (id === 'rustysword' || id === 'woodensword') { len = 1.0; wid = 0.07; gripLen = 0.25; guardW = 0.2; }
  else if (id === 'longsword') { len = 1.2; wid = 0.09; gripLen = 0.32; guardW = 0.3; }
  else if (id === 'broadsword') { len = 1.3; wid = 0.12; thick = 0.03; gripLen = 0.36; guardW = 0.38; }
  else if (id === 'claymore') { len = 1.5; wid = 0.10; gripLen = 0.44; guardW = 0.44; }
  else if (id === 'greatsword') { len = 1.8; wid = 0.15; thick = 0.05; gripLen = 0.56; guardW = 0.52; wide = true; }
  else if (id === 'ashenGreat') { len = 1.75; wid = 0.14; thick = 0.045; gripLen = 0.52; guardW = 0.54; wide = true; ember = true; }
  else if (id === 'moonblade') { len = 1.35; wid = 0.08; thick = 0.02; gripLen = 0.34; guardW = 0.28; }
  const bladeM = ember
    ? new THREE.MeshStandardMaterial({ color: 0x40454c, metalness: 0.9, roughness: 0.38, map: metalTex, bumpMap: metalTex, bumpScale: 0.01, emissive: 0xff4400, emissiveIntensity: 0.18 })
    : steel;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(wid, len, thick), bladeM);
  blade.position.y = -0.14 - len / 2; blade.castShadow = true; grp.add(blade);
  // fuller groove down both faces
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.26, len * 0.84, thick + 0.005), darkSteel);
  fuller.position.y = blade.position.y - len * 0.015; grp.add(fuller);
  // beveled cutting edges
  [-1, 1].forEach(s => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.10, len, thick * 1.15), steel);
    edge.position.set(s * wid * 0.46, blade.position.y, 0); grp.add(edge);
  });
  const tipLen = wide ? 0.12 : 0.18;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(Math.max(0.03, wid / 1.45), tipLen, 4), bladeM);
  tip.position.y = -0.14 - len - tipLen / 2; tip.rotation.x = Math.PI; tip.rotation.y = Math.PI / 4; grp.add(tip);
  // crossguard with curved quillons
  const guard = new THREE.Mesh(new THREE.BoxGeometry(guardW * 0.7, 0.07, 0.10), gold);
  guard.position.y = -0.14; guard.castShadow = true; grp.add(guard);
  [-1, 1].forEach(s => {
    const q = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 6, 12, Math.PI * 0.72), gold);
    q.position.set(s * (guardW * 0.36), -0.155, 0);
    q.rotation.z = s > 0 ? 0.55 : Math.PI - 0.55;
    q.castShadow = true; grp.add(q);
  });
  if (wide) {
    [-1, 1].forEach(s => {
      const q = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.07), gold);
      q.position.set(s * (guardW / 2 + 0.02), -0.13, 0); q.rotation.z = s * -0.45; grp.add(q);
    });
  }
  // leather grip with wrap rings
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.046, gripLen, 10), leather);
  grip.position.y = -0.14 + gripLen / 2 + 0.03; grp.add(grip);
  const wraps = Math.max(3, Math.round(gripLen / 0.075));
  for (let i = 0; i < wraps; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.007, 5, 12), darkSteel);
    ring.position.y = -0.11 + (i + 0.5) * (gripLen / wraps); ring.rotation.x = Math.PI / 2; grp.add(ring);
  }
  const pom = new THREE.Mesh(new THREE.SphereGeometry(wide ? 0.075 : 0.06, 12, 10), gold);
  pom.position.y = -0.14 + gripLen + 0.09; pom.scale.y = 0.85; grp.add(pom);
  const pomRing = new THREE.Mesh(new THREE.TorusGeometry(wide ? 0.06 : 0.048, 0.012, 6, 12), gold);
  pomRing.position.y = pom.position.y + 0.012; pomRing.rotation.x = Math.PI / 2; grp.add(pomRing);
  grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const glow = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.06, len, thick + 0.04), new THREE.MeshBasicMaterial({ color: 0xffb52e, transparent: true, opacity: 0 }));
  glow.position.y = blade.position.y; grp.add(glow);
  const trail = new THREE.Mesh(new THREE.PlaneGeometry(wid * 3, len + 0.2), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  trail.position.y = blade.position.y; grp.add(trail);
  return { group: grp, glow, trail };
}

// ============ LOOT (swords + spoils, rarity-weighted, no guaranteed sword) ============
const RARITY = {
  common: { label: 'COMMON', color: '#b8bfc9', weight: 0.65 },
  rare: { label: 'RARE', color: '#4a9eff', weight: 0.30 },
  legendary: { label: 'LEGENDARY', color: '#ffb52e', weight: 0.05 },
};
// Passive spoils — only one may be equipped at a time.
const SPOILS = [
  { id: 'buckler', name: 'Worn Buckler', icon: 'shield', rarity: 'common', desc: '+4% damage', apply: P => { P.mods.dmg *= 1.04; }, unapply: P => { P.mods.dmg /= 1.04; } },
  { id: 'signet', name: "Soldier's Ring", icon: 'ring', rarity: 'common', desc: '+5% move speed', apply: P => { P.mods.spd *= 1.05; }, unapply: P => { P.mods.spd /= 1.05; } },
  { id: 'boots', name: 'Leather Boots', icon: 'boot', rarity: 'common', desc: '+8% estus healing', apply: P => { P.mods.flask *= 1.08; }, unapply: P => { P.mods.flask /= 1.08; } },
  { id: 'ember', name: 'Cracked Ember', icon: 'charm', rarity: 'common', desc: '+5% max stamina', apply: P => { P.mods.st *= 1.05; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); }, unapply: P => { P.mods.st /= 1.05; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); } },
  { id: 'knightring', name: "Knight's Signet", icon: 'ring', rarity: 'rare', desc: '+10% damage', apply: P => { P.mods.dmg *= 1.10; }, unapply: P => { P.mods.dmg /= 1.10; } },
  { id: 'ironheart', name: 'Iron Heart', icon: 'heart', rarity: 'rare', desc: '+15% max HP', apply: P => { P.mods.hp *= 1.15; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); }, unapply: P => { P.mods.hp /= 1.15; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); } },
  { id: 'soles', name: 'Swift Soles', icon: 'boot', rarity: 'rare', desc: '+8% move speed', apply: P => { P.mods.spd *= 1.08; }, unapply: P => { P.mods.spd /= 1.08; } },
  { id: 'bloodgem', name: 'Bloodstone', icon: 'gem', rarity: 'rare', desc: '+10% max HP, +5% damage', apply: P => { P.mods.hp *= 1.10; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); P.mods.dmg *= 1.05; }, unapply: P => { P.mods.hp /= 1.10; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); P.mods.dmg /= 1.05; } },
  { id: 'crown', name: "Ashen Lord's Crown", icon: 'crown', rarity: 'legendary', desc: '+20% damage, +20% max HP', apply: P => { P.mods.dmg *= 1.20; P.mods.hp *= 1.20; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); }, unapply: P => { P.mods.dmg /= 1.20; P.mods.hp /= 1.20; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); } },
  { id: 'dragonheart', name: 'Dragonheart', icon: 'heart', rarity: 'legendary', desc: '+35% max HP, +20% stamina', apply: P => { P.mods.hp *= 1.35; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); P.mods.st *= 1.20; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); }, unapply: P => { P.mods.hp /= 1.35; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); P.mods.st /= 1.20; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); } },
  { id: 'vigilblade', name: 'Vigil Talisman', icon: 'sword', rarity: 'legendary', desc: '+30% damage', apply: P => { P.mods.dmg *= 1.30; }, unapply: P => { P.mods.dmg /= 1.30; } },
  { id: 'moongem', name: 'Moonlight Gem', icon: 'gem', rarity: 'legendary', desc: '+25% stamina, +10% move speed', apply: P => { P.mods.st *= 1.25; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); P.mods.spd *= 1.10; }, unapply: P => { P.mods.st /= 1.25; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); P.mods.spd /= 1.10; } },
];
// Swords and spoils share one drop pool. Better swords have rarer tiers.
const DROP_POOL = [
  ...Object.values(WEAPONS).map(w => ({ ...w, type: 'weapon' })),
  ...SPOILS.map(s => ({ ...s, type: 'spoils' })),
];

function drawItemIcon(item) {
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

function rollRarity() {
  const r = Math.random(); let acc = 0;
  for (const k of ['common', 'rare', 'legendary']) { acc += RARITY[k].weight; if (r < acc) return k; }
  return 'common';
}
function applyWeaponMesh(id) {
  const sw = playerK.parts.sword;
  while (sw.children.length) sw.remove(sw.children[0]);
  const w = buildWeaponMesh(id); sw.add(w.group);
  playerK.parts.swordGlow = w.glow; playerK.parts.trail = w.trail;
}
function equipWeapon(id) {
  if (!WEAPONS[id] || !P.owned.includes(id) || P.weapon === id) return;
  P.weapon = id;
  applyWeaponMesh(id);
  sfx.equip(); updateWeaponLabel(); renderWeaponList();
  saveGame();
}

// ============ KNIGHT BUILDER (procedural, jointed, layered plate armor) ============
const ROLL_H = 0.85;
// Collapse a joint group's static meshes into one mesh per material. This keeps
// the rig intact while cutting hundreds of draw calls per knight.
function mergeDirectMeshes(group, skip) {
  const batches = new Map();
  const remove = [];
  for (const child of group.children) {
    if (!child.isMesh || skip.has(child)) continue;
    child.updateMatrix();
    const key = child.material.uuid;
    let batch = batches.get(key);
    if (!batch) { batch = { mat: child.material, geos: [] }; batches.set(key, batch); }
    const geo = (child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone());
    geo.applyMatrix4(child.matrix);
    batch.geos.push(geo);
    remove.push(child);
  }
  if (!remove.length) return;
  for (const child of remove) group.remove(child);
  for (const { mat, geos } of batches.values()) {
    const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
    if (!merged) {
      for (const geo of geos) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; group.add(m); }
      continue;
    }
    if (geos.length > 1) for (const geo of geos) geo.dispose();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true; group.add(mesh);
  }
}
function buildKnight({ scale = 1, armor = 0x5a606e, trim = 0xc9a227, cloth = 0x7c1d12, plume = 0xb02020, emissive = 0x000000, weapon = 'longsword' }) {
  const g = new THREE.Group();
  const armorM = new THREE.MeshPhysicalMaterial({
    color: armor, metalness: 0.86, roughness: 0.40, envMapIntensity: 1.35,
    map: metalTex, bumpMap: metalTex, bumpScale: 0.006,
    normalMap: metalNormalTex, normalScale: new THREE.Vector2(0.55, 0.55),
    clearcoat: 0.22, clearcoatRoughness: 0.42,
  });
  const plateM = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(armor).multiplyScalar(1.22), metalness: 0.82, roughness: 0.36, envMapIntensity: 1.4,
    map: metalTex, bumpMap: metalTex, bumpScale: 0.005,
    normalMap: metalNormalTex, normalScale: new THREE.Vector2(0.5, 0.5),
    clearcoat: 0.3, clearcoatRoughness: 0.36,
  });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x1e2126, metalness: 0.8, roughness: 0.62, map: mailTex, bumpMap: mailTex, bumpScale: 0.02, normalMap: metalNormalTex, normalScale: new THREE.Vector2(0.5, 0.5) });
  const trimM = new THREE.MeshPhysicalMaterial({ color: trim, metalness: 1.0, roughness: 0.28, envMapIntensity: 1.5, map: metalTex, bumpMap: metalTex, bumpScale: 0.005, normalMap: metalNormalTex, normalScale: new THREE.Vector2(0.4, 0.4), clearcoat: 0.45, clearcoatRoughness: 0.3 });
  const clothM = new THREE.MeshPhysicalMaterial({
    color: cloth, metalness: 0, roughness: 0.94, map: clothTex, side: THREE.DoubleSide,
    normalMap: clothNormalTex, normalScale: new THREE.Vector2(0.4, 0.4), bumpMap: clothTex, bumpScale: 0.004,
    sheen: 0.35, sheenRoughness: 0.85, sheenColor: new THREE.Color(cloth).lerp(new THREE.Color(0xffffff), 0.4),
  });
  const capeM = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(cloth).multiplyScalar(0.82), metalness: 0, roughness: 1, map: clothTex, side: THREE.DoubleSide,
    normalMap: clothNormalTex, normalScale: new THREE.Vector2(0.55, 0.55), bumpMap: clothTex, bumpScale: 0.006,
    sheen: 0.25, sheenRoughness: 0.9, sheenColor: new THREE.Color(cloth).lerp(new THREE.Color(0xffffff), 0.3),
  });
  const leatherM = new THREE.MeshStandardMaterial({ color: 0x3b2a1b, metalness: 0.05, roughness: 0.92, map: leatherTex, normalMap: leatherNormalTex, normalScale: new THREE.Vector2(0.7, 0.7), bumpMap: leatherTex, bumpScale: 0.005 });
  const furM = new THREE.MeshStandardMaterial({ color: 0x928c7f, metalness: 0, roughness: 1, map: furTex, bumpMap: furTex, bumpScale: 0.02 });
  const plumeM = new THREE.MeshStandardMaterial({ color: plume, metalness: 0.08, roughness: 0.92, map: furTex, bumpMap: furTex, bumpScale: 0.018 });
  const visorM = new THREE.MeshStandardMaterial({ color: 0x050505, emissive, emissiveIntensity: 1.0, roughness: 0.3 });
  const parts = {};
  const RBox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 3, Math.max(0.003, Math.min(r ?? Math.min(w, h, d) * 0.18, Math.min(w, h, d) * 0.48)));
  const M = (geo, m, x, y, z, parent) => { const ms = new THREE.Mesh(geo, m); ms.position.set(x, y, z); ms.castShadow = true; if (parent) parent.add(ms); return ms; };
  const rivet = (parent, x, y, z, r = 0.018) => M(new THREE.SphereGeometry(r, 6, 5), trimM, x, y, z, parent);
  function ragged(w, h, sx, sy, hem = 0.12) {
    const geo = new THREE.PlaneGeometry(w, h, sx, sy);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), v = (y + h / 2) / h;
      pos.setX(i, x * (1 - 0.45 * v));
      pos.setZ(i, Math.sin(x * 7 + 1.2) * 0.055 * (1 - v * 0.55) + Math.sin(x * 17) * 0.018 + Math.sin(y * 5) * 0.012);
      if (v < 0.10) pos.setY(i, y - Math.abs(x) * hem - Math.random() * 0.05);
    }
    geo.computeVertexNormals();
    return geo;
  }

  const body = new THREE.Group(); body.position.y = ROLL_H; g.add(body); parts.body = body;

  // ---- hips, belt, mail skirt, tassets, satchel ----
  const hips = new THREE.Group(); hips.position.y = 0.12; body.add(hips); parts.hips = hips;
  parts._hipsY = 0.12;
  M(new THREE.SphereGeometry(0.26, 14, 12), armorM, 0, 0.03, 0, hips).scale.set(1.12, 0.82, 0.9);
  M(new THREE.CylinderGeometry(0.305, 0.315, 0.09, 16), leatherM, 0, 0.06, 0, hips);
  M(RBox(0.12, 0.10, 0.045), trimM, 0, 0.06, 0.30, hips);
  rivet(hips, 0, 0.06, 0.325, 0.022);
  M(new THREE.CylinderGeometry(0.30, 0.45, 0.40, 16, 2, true), darkM, 0, -0.28, 0, hips);
  for (let i = -2; i <= 2; i++) {
    const a = i * 0.42;
    const t = M(RBox(0.19, 0.30, 0.05), armorM, Math.sin(a) * 0.33, -0.22, Math.cos(a) * 0.33, hips);
    t.rotation.y = a; t.rotation.x = 0.06;
    const e = M(RBox(0.20, 0.035, 0.055), trimM, Math.sin(a) * 0.335, -0.37, Math.cos(a) * 0.335, hips);
    e.rotation.y = a;
  }
  const pouch = M(RBox(0.24, 0.20, 0.12), leatherM, -0.34, -0.10, 0.02, hips);
  pouch.rotation.z = 0.08;
  M(RBox(0.25, 0.10, 0.13), leatherM, -0.34, 0.01, 0.02, hips).rotation.z = 0.08;
  M(RBox(0.045, 0.42, 0.03), leatherM, -0.24, 0.12, 0.10, hips).rotation.z = 0.5;
  const tabard = M(ragged(0.27, 0.60, 6, 10, 0.14), clothM, 0, -0.27, 0.265, hips);
  M(RBox(0.285, 0.03, 0.025), trimM, 0, -0.555, 0.275, hips);
  tabard.rotation.x = 0.05;

  // ---- legs: cuisse, poleyn, greave, sabaton ----
  function leg(side) {
    const hip = new THREE.Group(); hip.position.set(0.21 * side, -0.02, 0); hips.add(hip);
    M(new THREE.SphereGeometry(0.15, 12, 10), darkM, 0, 0, 0, hip);
    M(new THREE.CapsuleGeometry(0.135, 0.26, 6, 12), armorM, 0, -0.23, 0, hip);
    const thighPlate = M(RBox(0.20, 0.30, 0.10, 0.035), plateM, 0, -0.20, 0.10, hip);
    thighPlate.rotation.x = -0.05;
    M(RBox(0.21, 0.035, 0.105, 0.012), trimM, 0, -0.34, 0.10, hip);
    const wing = M(RBox(0.05, 0.18, 0.16, 0.02), plateM, 0.13 * side, -0.22, 0.03, hip);
    wing.rotation.z = side * -0.12;
    rivet(hip, 0.13 * side, -0.22, 0.12, 0.016);
    const knee = new THREE.Group(); knee.position.y = -0.47; hip.add(knee);
    M(new THREE.SphereGeometry(0.12, 14, 12), trimM, 0, 0, 0.035, knee).scale.set(1, 1, 0.9);
    for (let i = -1; i <= 1; i++) {
      const fan = M(RBox(0.09, 0.07, 0.04, 0.014), plateM, i * 0.075, 0.0, 0.10, knee);
      fan.rotation.z = i * 0.18;
    }
    M(RBox(0.06, 0.11, 0.11, 0.02), trimM, 0.11 * side, 0, 0.045, knee);
    M(new THREE.CylinderGeometry(0.10, 0.085, 0.27, 14), armorM, 0, -0.21, 0, knee);
    M(RBox(0.035, 0.24, 0.03, 0.01), trimM, 0, -0.21, 0.085, knee);
    M(RBox(0.19, 0.11, 0.30, 0.045), armorM, 0, -0.40, 0.03, knee);
    M(new THREE.SphereGeometry(0.075, 12, 10), armorM, 0, -0.43, 0.16, knee).scale.set(1.15, 0.7, 1.2);
    M(RBox(0.17, 0.07, 0.12, 0.025), plateM, 0, -0.43, 0.20, knee);
    M(RBox(0.05, 0.07, 0.09, 0.015), trimM, 0, -0.43, -0.12, knee);
    return { hip, knee };
  }
  const gL = leg(-1), gR = leg(1);
  parts.legL = gL.hip; parts.kneeL = gL.knee; parts.legR = gR.hip; parts.kneeR = gR.knee;

  // ---- torso: fluted cuirass, plackart, collar, straps, fur mantle, cape ----
  const torso = new THREE.Group(); torso.position.y = 0.10; hips.add(torso); parts.torso = torso;
  const chest = M(new THREE.CylinderGeometry(0.305, 0.245, 0.54, 18), armorM, 0, 0.36, 0, torso);
  chest.scale.z = 0.84; parts.chest = chest; parts._chestY = 0.36;
  M(new THREE.SphereGeometry(0.305, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), plateM, 0, 0.55, 0, torso).scale.set(1, 0.7, 0.84);
  for (let i = 0; i < 3; i++) {
    M(new THREE.CylinderGeometry(0.25 - i * 0.015, 0.26 - i * 0.015, 0.075, 16), plateM, 0, 0.12 - i * 0.075, 0, torso).scale.z = 0.86;
  }
  M(RBox(0.035, 0.42, 0.035, 0.012), trimM, 0, 0.37, 0.245, torso);
  M(new THREE.TorusGeometry(0.20, 0.045, 10, 22), trimM, 0, 0.63, 0, torso).rotation.x = Math.PI / 2;
  M(new THREE.CylinderGeometry(0.175, 0.20, 0.13, 16, 1, true), darkM, 0, 0.66, 0, torso);
  M(RBox(0.085, 0.46, 0.03, 0.012), leatherM, -0.145, 0.37, 0.245, torso).rotation.z = 0.30;
  M(RBox(0.085, 0.46, 0.03, 0.012), leatherM, 0.145, 0.37, 0.245, torso).rotation.z = -0.30;
  M(RBox(0.09, 0.09, 0.04, 0.015), trimM, 0, 0.36, 0.265, torso);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; rivet(torso, Math.cos(a) * 0.26, 0.60, Math.sin(a) * 0.22, 0.015); }
  M(RBox(0.04, 0.40, 0.03, 0.012), trimM, 0, 0.36, -0.245, torso);
  // fur mantle around the shoulders
  const mantle = new THREE.Group(); mantle.position.y = 0.58; torso.add(mantle);
  const collar = M(new THREE.TorusGeometry(0.23, 0.085, 8, 22), furM, 0, 0.01, 0, mantle);
  collar.rotation.x = Math.PI / 2; collar.scale.set(1.1, 1, 0.78);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const cone = M(new THREE.ConeGeometry(0.04, 0.15, 5), furM, Math.cos(a) * 0.28, -0.02, Math.sin(a) * 0.23, mantle);
    cone.rotation.z = Math.cos(a) * 0.8;
    cone.rotation.x = -Math.sin(a) * 0.8;
  }
  [-1, 1].forEach(s => {
    const tuft = new THREE.Group(); tuft.position.set(0.38 * s, 0.09, 0); mantle.add(tuft);
    for (let i = 0; i < 5; i++) {
      const c = M(new THREE.ConeGeometry(0.045, 0.16 + Math.random() * 0.08, 5), furM, (Math.random() - 0.5) * 0.14, Math.random() * 0.04, (Math.random() - 0.5) * 0.14, tuft);
      c.rotation.z = (Math.random() - 0.5) * 1.2; c.rotation.x = (Math.random() - 0.5) * 1.2;
    }
  });
  const cape1 = M(ragged(0.62, 0.54, 10, 8, 0.16), capeM, 0, 0.36, -0.30, torso);
  cape1.rotation.x = 0.13; parts.cape = cape1;
  const cape2 = M(ragged(0.72, 0.62, 10, 8, 0.26), capeM, 0, -0.47, 0, cape1);
  cape2.rotation.x = 0.16; parts.cape2 = cape2;
  [-1, 1].forEach(s => rivet(torso, 0.16 * s, 0.61, 0.20, 0.028));

  // ---- head: mailed coif, great helm with crest, wrapped face, swept mane ----
  const headG = new THREE.Group(); headG.position.y = 0.72; torso.add(headG); parts.head = headG;
  M(new THREE.CylinderGeometry(0.13, 0.15, 0.14, 12), darkM, 0, -0.02, 0, headG);
  // cloth hood behind the helm
  const hood = M(ragged(0.34, 0.34, 6, 6, 0.10), clothM, 0, 0.02, -0.13, headG);
  hood.rotation.x = 0.22;
  [-1, 1].forEach(s => { const panel = M(RBox(0.05, 0.28, 0.20, 0.024), clothM, 0.185 * s, 0.0, -0.02, headG); panel.rotation.y = s * -0.25; });
  // helm skull
  M(new THREE.SphereGeometry(0.205, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), armorM, 0, 0.12, 0, headG);
  M(new THREE.TorusGeometry(0.195, 0.022, 8, 24), trimM, 0, 0.12, 0, headG).rotation.x = Math.PI / 2;
  const crown = M(new THREE.SphereGeometry(0.195, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), armorM, 0, 0.235, -0.01, headG);
  crown.scale.set(1, 0.9, 1.06);
  M(new THREE.ConeGeometry(0.055, 0.15, 10), trimM, 0, 0.345, -0.02, headG);
  M(RBox(0.035, 0.13, 0.36, 0.014), trimM, 0, 0.22, 0.0, headG);
  // faceplate: rounded dark steel, recessed eye slit, nasal guard and cheek plates
  const face = M(RBox(0.225, 0.25, 0.075, 0.045), darkM, 0, 0.05, 0.175, headG);
  face.rotation.x = 0.04;
  M(RBox(0.17, 0.055, 0.035, 0.014), new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.55 }), 0, 0.14, 0.213, headG);
  M(RBox(0.02, 0.22, 0.025, 0.008), leatherM, 0, 0.05, 0.213, headG);
  const visor = M(RBox(0.145, 0.022, 0.03, 0.008), visorM, 0, 0.141, 0.226, headG); parts.visor = visor;
  [-1, 1].forEach(s => { const ch = M(RBox(0.075, 0.18, 0.13, 0.03), plateM, 0.14 * s, 0.045, 0.125, headG); ch.rotation.y = s * 0.35; });
  M(new THREE.CylinderGeometry(0.16, 0.18, 0.10, 14, 1, false, -Math.PI * 0.35, Math.PI * 0.7), armorM, 0, -0.02, 0.04, headG);
  for (let i = 0; i < 12; i++) { const a = -2.2 + i * 0.4; rivet(headG, Math.sin(a) * 0.185, 0.05, Math.cos(a) * 0.185 + 0.02, 0.011); }
  for (let i = 0; i < 11; i++) {
    const a = (i - 5) * 0.24;
    const hair = M(new THREE.ConeGeometry(0.04, 0.22 + Math.random() * 0.10, 7), plumeM, Math.sin(a) * 0.165, 0.19 - Math.abs(a) * 0.03, -0.12 - Math.cos(a) * 0.09, headG);
    hair.rotation.x = 1.05 + Math.random() * 0.25; hair.rotation.z = a * 0.75;
  }

  // ---- arms: layered pauldrons, couter, vambrace, gauntlet ----
  function arm(side) {
    const sh = new THREE.Group(); sh.position.set(0.44 * side, 0.55, 0); torso.add(sh);
    M(new THREE.SphereGeometry(0.145, 12, 10), darkM, 0, 0, 0, sh);
    const cap = M(new THREE.SphereGeometry(0.235, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.52), plateM, 0.015 * side, 0.03, 0, sh);
    cap.scale.set(0.92, 0.42, 0.84); cap.rotation.z = -side * 0.17;
    const lame1 = M(new THREE.SphereGeometry(0.215, 10, 4, 0, Math.PI * 2, Math.PI * 0.46, Math.PI * 0.34), trimM, 0.02 * side, -0.10, 0, sh);
    lame1.scale.set(0.9, 0.4, 0.82); lame1.rotation.z = -side * 0.10;
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI; rivet(sh, Math.cos(a) * 0.22 * side, 0.09, Math.sin(a) * 0.15, 0.013); }
    M(new THREE.CapsuleGeometry(0.105, 0.24, 6, 12), armorM, 0, -0.25, 0, sh);
    M(new THREE.TorusGeometry(0.11, 0.018, 6, 12), trimM, 0, -0.16, 0, sh).rotation.x = Math.PI / 2;
    const el = new THREE.Group(); el.position.y = -0.45; sh.add(el);
    M(new THREE.SphereGeometry(0.105, 14, 12), trimM, 0, 0, 0, el);
    M(RBox(0.05, 0.12, 0.07, 0.016), trimM, 0.105 * side, 0, 0.02, el);
    M(new THREE.CylinderGeometry(0.10, 0.085, 0.25, 14), armorM, 0, -0.20, 0, el);
    M(RBox(0.035, 0.22, 0.03, 0.01), trimM, 0, -0.20, 0.078, el);
    [-0.12, -0.27].forEach(y => { M(new THREE.TorusGeometry(0.096, 0.014, 6, 16), leatherM, 0, y, 0, el).rotation.x = Math.PI / 2; });
    const hand = new THREE.Group(); hand.position.y = -0.40; el.add(hand);
    M(RBox(0.14, 0.16, 0.15, 0.045), darkM, 0, -0.04, 0, hand);
    for (let i = 0; i < 4; i++) {
      const f = M(new THREE.CapsuleGeometry(0.021, 0.062, 3, 8), armorM, (i - 1.5) * 0.033, -0.075, 0.055, hand);
      f.rotation.x = 0.6 + i * 0.04;
      const knuckle = M(new THREE.SphereGeometry(0.019, 8, 6), trimM, (i - 1.5) * 0.033, -0.008, 0.075, hand);
    }
    M(RBox(0.105, 0.045, 0.145, 0.02), plateM, 0, 0.035, 0.005, hand);
    M(new THREE.CapsuleGeometry(0.026, 0.06, 3, 8), armorM, 0.075 * side, -0.03, 0.035, hand).rotation.z = side * 0.8;
    return { sh, el, hand };
  }
  parts.armR = arm(1); parts.armL = arm(-1);

  // sword (mesh swapped by the inventory system)
  const swordG = new THREE.Group(); parts.armR.hand.add(swordG); parts.sword = swordG;
  const wpn0 = buildWeaponMesh(weapon); swordG.add(wpn0.group);
  parts.swordGlow = wpn0.glow; parts.trail = wpn0.trail;

  // engraved round shield on the left forearm
  const shield = new THREE.Group(); shield.position.set(-0.07, -0.20, 0.13); shield.rotation.y = -0.18; parts.armL.el.add(shield); parts.shield = shield;
  const shM = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 36), new THREE.MeshStandardMaterial({ color: 0x3f3a33, metalness: 0.85, roughness: 0.55, map: metalTex }));
  shM.rotation.x = Math.PI / 2; shM.castShadow = true; shield.add(shM);
  const shieldFace = new THREE.Mesh(new THREE.CircleGeometry(0.415, 44), new THREE.MeshStandardMaterial({ map: shieldTex, metalness: 0.35, roughness: 0.6 }));
  shieldFace.position.z = 0.035; shield.add(shieldFace);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.415, 0.032, 8, 44), trimM); rim.position.z = 0.01; shield.add(rim);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.02, 8, 44), new THREE.MeshStandardMaterial({ color: 0x2a2824, metalness: 0.9, roughness: 0.5, map: metalTex })); shield.add(rim2);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; rivet(shield, Math.cos(a) * 0.39, Math.sin(a) * 0.39, 0.055, 0.014); }
  const shBoss = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), trimM); shBoss.position.z = 0.075; shBoss.scale.z = 0.7; shield.add(shBoss);
  M(new THREE.BoxGeometry(0.06, 0.26, 0.04), leatherM, 0, -0.05, -0.045, shield);
  M(new THREE.BoxGeometry(0.30, 0.05, 0.03), leatherM, 0, 0.10, -0.045, shield);

  g.scale.setScalar(scale);
  const keepSeparate = new Set([parts.chest, parts.cape, parts.cape2, parts.visor]);
  const groups = [];
  g.traverse(o => { if (o.isGroup) groups.push(o); });
  for (const grp of groups) mergeDirectMeshes(grp, keepSeparate);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, parts };
}

const playerK = buildKnight({ scale: 0.95, armor: 0x7b8694, trim: 0xcbb98a, cloth: 0x2f4468, plume: 0xbcc9d8, emissive: 0x7fb4ff, weapon: 'longsword' });
scene.add(playerK.group); playerK.group.name = 'player';
const BOSS_BASE_SCALE = 1.55, BOSS_RAGE_SCALE = BOSS_BASE_SCALE * 1.3;
const bossK = buildKnight({ scale: BOSS_BASE_SCALE, armor: 0x737983, trim: 0x9a7b45, cloth: 0x5e1a12, plume: 0xd9d3c4, emissive: 0xff5a1e, weapon: 'greatsword' });
scene.add(bossK.group); bossK.group.name = 'boss';

// soft contact shadows anchor the fighters to the ground
function blobShadow(size, opacity) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
    map: shadowTex, color: 0x000000, transparent: true, opacity, depthWrite: false,
  }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.025; m.renderOrder = 1; scene.add(m); return m;
}
const playerShadow = blobShadow(1.9, 0.38);
const bossShadow = blobShadow(3.2, 0.42);

// cloth simulation: cache rest positions, then let capes breathe and billow
function cacheCloth(mesh, amp = 1) {
  if (!mesh) return;
  const p = mesh.geometry.attributes.position;
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  mesh.userData.cloth = { base: Float32Array.from(p.array), y0, y1, amp };
}
for (const K of [playerK, bossK]) { cacheCloth(K.parts.cape, 0.9); cacheCloth(K.parts.cape2, 1.25); }
function animateCloth(mesh, time, updateNormals = true) {
  const c = mesh.userData.cloth; if (!c) return;
  const p = mesh.geometry.attributes.position, base = c.base;
  const span = Math.max(0.001, c.y1 - c.y0);
  for (let i = 0; i < p.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
    const v = Math.min(1, Math.max(0, (c.y1 - y) / span));
    const sway = (Math.sin(time * 2.2 + x * 7 + y * 3.5) * 0.018 + Math.sin(time * 3.7 + x * 13) * 0.006) * v * v * c.amp;
    p.setZ(i, z + sway);
    p.setX(i, x + Math.sin(time * 1.4 + y * 4) * 0.006 * v * c.amp);
  }
  p.needsUpdate = true;
  if (updateNormals) mesh.geometry.computeVertexNormals();
}

// ============ DROP SYSTEM ============
function rollDrops() {
  const out = [];
  for (let i = 0; i < 3; i++) {
    const rarity = rollRarity();
    const pool = DROP_POOL.filter(d => d.rarity === rarity);
    const pick = pool[Math.random() * pool.length | 0] || DROP_POOL[Math.random() * DROP_POOL.length | 0];
    out.push({ ...pick });
  }
  return out;
}

// ============ PARTICLES / VFX ============
// One pooled Points cloud for every spark/ember/dust particle: a single draw
// call instead of allocating a mesh + material per particle.
const MAX_SPARKS = 320;
const sparks = [];
for (let i = 0; i < MAX_SPARKS; i++) sparks.push({ i, active: false, v: new THREE.Vector3(), life: 0, size: 0.2, color: new THREE.Color() });
let sparkCursor = 0;
const sparkPos = new Float32Array(MAX_SPARKS * 3);
const sparkCol = new Float32Array(MAX_SPARKS * 3);
const sparkAlpha = new Float32Array(MAX_SPARKS);
const sparkSize = new Float32Array(MAX_SPARKS);
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3).setUsage(THREE.DynamicDrawUsage));
sparkGeo.setAttribute('aColor', new THREE.BufferAttribute(sparkCol, 3).setUsage(THREE.DynamicDrawUsage));
sparkGeo.setAttribute('aAlpha', new THREE.BufferAttribute(sparkAlpha, 1).setUsage(THREE.DynamicDrawUsage));
sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sparkSize, 1).setUsage(THREE.DynamicDrawUsage));
const sparkMat = new THREE.ShaderMaterial({
  uniforms: { uMap: { value: fireGlowTex }, uPixelRatio: { value: renderer.getPixelRatio() } },
  vertexShader: `
    attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
    uniform float uPixelRatio;
    varying float vAlpha; varying vec3 vColor;
    void main() {
      vAlpha = aAlpha; vColor = aColor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * uPixelRatio * (260.0 / max(0.1, -mv.z));
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform sampler2D uMap; varying float vAlpha; varying vec3 vColor;
    void main() {
      vec4 t = texture2D(uMap, gl_PointCoord);
      float a = t.a * vAlpha;
      if (a < 0.01) discard;
      gl_FragColor = vec4(vColor * (0.68 + 0.32 * t.rgb), a);
    }
  `,
  transparent: true, depthWrite: false, blending: THREE.NormalBlending,
});
const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
sparkPoints.frustumCulled = false; sparkPoints.renderOrder = 6; scene.add(sparkPoints);
function spawnSparks(pos, n = 10, color = 0xffc861, speed = 5) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    let s = null;
    for (let j = 0; j < MAX_SPARKS; j++) {
      const i = (sparkCursor + j) % MAX_SPARKS;
      if (!sparks[i].active) { s = sparks[i]; sparkCursor = (i + 1) % MAX_SPARKS; break; }
    }
    if (!s) { s = sparks[sparkCursor]; sparkCursor = (sparkCursor + 1) % MAX_SPARKS; }
    s.active = true; s.life = 0.5 + Math.random() * 0.3;
    s.size = 0.16 + Math.random() * 0.16; s.color.copy(c);
    s.v.set((Math.random() - 0.5) * speed, Math.random() * speed * 0.9, (Math.random() - 0.5) * speed);
    sparkPos[s.i * 3] = pos.x; sparkPos[s.i * 3 + 1] = pos.y; sparkPos[s.i * 3 + 2] = pos.z;
    sparkCol[s.i * 3] = c.r; sparkCol[s.i * 3 + 1] = c.g; sparkCol[s.i * 3 + 2] = c.b;
    sparkSize[s.i] = s.size; sparkAlpha[s.i] = 1;
  }
  sparkGeo.attributes.aColor.needsUpdate = true;
}
function updateSparks(dt) {
  for (const s of sparks) {
    if (!s.active) continue;
    s.life -= dt;
    if (s.life <= 0) { s.active = false; sparkAlpha[s.i] = 0; continue; }
    s.v.y -= 9 * dt;
    const i = s.i * 3;
    let y = sparkPos[i + 1] + s.v.y * dt;
    if (y < 0.03) { y = 0.03; s.v.y *= -0.3; }
    sparkPos[i] += s.v.x * dt; sparkPos[i + 1] = y; sparkPos[i + 2] += s.v.z * dt;
    sparkAlpha[s.i] = Math.min(1, s.life * 2.2);
  }
  sparkGeo.attributes.position.needsUpdate = true;
  sparkGeo.attributes.aAlpha.needsUpdate = true;
  sparkGeo.attributes.aSize.needsUpdate = true;
}
function spawnDust(pos) { spawnSparks(pos, 8, 0x8a8078, 2.5); }
const rings = [];
function spawnRing(pos, color = 0xffb52e, maxR = 6) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y = 0.12;
  m.userData = { r: 1, maxR }; scene.add(m); rings.push(m);
}

// ============ BOSS HAZARDS: telegraphed fire pillars ============
const pillars = [];
const pillarRingGeo = new THREE.RingGeometry(0.78, 1.0, 44);
const pillarFillGeo = new THREE.CircleGeometry(0.78, 28);
function spawnFirePillar(x, z, delay = 2.0, radius = 2.2, dmg = 34, mult = 1) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); scene.add(grp);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff7a24, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xff3b0a, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(pillarRingGeo, ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.scale.setScalar(radius); grp.add(ring);
  const fill = new THREE.Mesh(pillarFillGeo, fillMat);
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.04; fill.scale.setScalar(radius * 0.2); grp.add(fill);
  const fire = new THREE.Group(); fire.visible = false; grp.add(fire);
  for (let i = 0; i < 6; i++) {
    const isOuter = i % 2 === 0;
    const s = new THREE.Sprite(isOuter ? flameOuterMat : flameCoreMat);
    s.position.set((Math.random() - 0.5) * radius * 0.5, 1.0 + i * 1.05, (Math.random() - 0.5) * radius * 0.5);
    s.scale.set(radius * (isOuter ? 2.6 - i * 0.12 : 1.15), 2.0 + Math.random() * 0.7, 1);
    fire.add(s);
  }
  const glow = new THREE.Sprite(emberMat);
  glow.scale.setScalar(radius * 4.2); glow.position.y = 0.9; fire.add(glow);
  pillars.push({ grp, ring, fill, ringMat, fillMat, fire, x, z, radius, dmg, mult, t: 0, delay, state: 'indicator', eruptT: 0 });
}
function spawnPillarBarrage(mult = 1, count = 10, announce = true) {
  const baseA = Math.random() * Math.PI * 2;
  const lim = ARENA_R - 2.2;
  const placed = [];
  const place = (x, z, delay, minGap = 0) => {
    const dd = Math.hypot(x, z);
    if (dd > lim) { x *= lim / dd; z *= lim / dd; }
    if (minGap) {
      for (const p of placed) if (Math.hypot(p.x - x, p.z - z) < minGap) return false;
    }
    placed.push({ x, z });
    spawnFirePillar(x, z, delay, 2.0, TUNE.bossDmg.pillar, mult);
    return true;
  };
  // a closing ring around the player, plus one eruption beneath their feet
  const around = Math.max(4, Math.ceil(count * 0.4));
  for (let i = 0; i < around; i++) {
    if (i === 0) place(P.pos.x, P.pos.z, 1.7);
    else {
      const a = baseA + i * (Math.PI * 2 / around), r = 3.1 + Math.random() * 2.1;
      place(P.pos.x + Math.cos(a) * r, P.pos.z + Math.sin(a) * r, 1.8 + Math.random() * 0.5, 3.2);
    }
  }
  // scatter the rest across the whole arena so every lane burns
  for (let tries = 0; placed.length < count && tries < 400; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (lim - 0.4);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - P.pos.x, z - P.pos.z) < 2.6) continue;
    place(x, z, 1.8 + Math.random() * 1.3, 3.4);
  }
  sfx.pillarWarn();
  if (announce) showSub(count >= 14 ? 'THE ARENA ITSELF IGNITES — KEEP MOVING' : 'THE EARTH GLOWS — LAVA RISES ALL AROUND');
}
function updatePillars(dt) {
  for (let i = pillars.length - 1; i >= 0; i--) {
    const p = pillars[i];
    if (!p) continue;
    p.t += dt;
    if (p.state === 'indicator') {
      const k = Math.min(1, p.t / p.delay);
      const pulse = 0.55 + 0.45 * Math.sin(p.t * 14);
      p.ring.scale.setScalar(p.radius * (0.94 + pulse * 0.07));
      p.ringMat.opacity = 0.30 + pulse * 0.35;
      p.fill.scale.setScalar(p.radius * (0.2 + 0.8 * k));
      p.fillMat.opacity = 0.06 + k * 0.16 + pulse * 0.04;
      if (p.t >= p.delay) {
        p.state = 'erupt'; p.eruptT = 0;
        p.fire.visible = true; p.ring.visible = false; p.fill.visible = false;
        sfx.pillar(); G.shake = Math.max(G.shake, 0.4);
        spawnRing(new THREE.Vector3(p.x, 0, p.z), 0xff7a26, p.radius * 2.6);
        spawnSparks(new THREE.Vector3(p.x, 0.5, p.z), 18, 0xff8a3a, 6);
        if (P.state !== 'dead' && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < p.radius + 0.35) {
          damagePlayer(Math.round(p.dmg * p.mult), new THREE.Vector3(p.x, 0, p.z), 'pillar');
        }
      }
    } else {
      p.eruptT += dt;
      const rise = Math.min(1, p.eruptT / 0.16);
      const fade = p.eruptT > 0.75 ? Math.max(0, 1 - (p.eruptT - 0.75) / 0.75) : 1;
      p.fire.scale.set(fade * (0.9 + rise * 0.2), rise * (0.6 + fade * 0.6), fade * (0.9 + rise * 0.2));
      p.fire.position.x = Math.sin(p.eruptT * 23 + p.x) * 0.08;
      p.fire.position.z = Math.cos(p.eruptT * 19 + p.z) * 0.08;
      if (p.eruptT > 1.5) removePillar(i);
    }
  }
}
function removePillar(i) {
  const p = pillars[i];
  scene.remove(p.grp);
  p.ringMat.dispose(); p.fillMat.dispose();
  pillars.splice(i, 1);
}
function clearBossHazards() {
  for (let i = pillars.length - 1; i >= 0; i--) removePillar(i);
}

// ============ GAME STATE ============
const G = {
  mode: 'title', // title | play | dead | victory
  inArena: false, bossActive: false, bossDead: false,
  locked: false, ng: 0, fightTime: 0, hitstop: 0, paused: false,
  camYaw: 0, camPitch: 0.32, camDist: 6.5,
  shake: 0,
  awakening: false, awakeT: 0, awakeBurst: false, bossRevealed: false, bossRevealY: 0,
};
const P = {
  pos: new THREE.Vector3(1.9, 0, 27.6), yaw: Math.PI, hp: TUNE.playerHP, maxHP: TUNE.playerHP,
  st: TUNE.playerST, stDelay: 0, flasks: TUNE.flasks,
  state: 'idle', t: 0, combo: 0, comboQueued: false, heavyHeld: false,
  rollDir: new THREE.Vector3(), iframes: false, hurtT: 0, drinkHeal: 0,
  owned: ['longsword'], weapon: 'longsword',
  items: [], spoils: [], equippedSpoils: null, stMax: TUNE.playerST,
  mods: { dmg: 1, hp: 1, st: 1, spd: 1, flask: 1 },
};

// ============ SAVE / LOAD (browser localStorage) ============
const SAVE_KEY = 'ashen-vigil-save-v1';
const SAVE_NOTE = 'PROGRESS AUTO-SAVES IN THIS BROWSER';
function saveGame(silent = false) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1,
      owned: P.owned,
      weapon: P.weapon,
      spoils: P.spoils,
      equippedSpoils: P.equippedSpoils,
      ng: G.ng,
      savedAt: Date.now(),
    }));
    if (!silent) {
      const el = document.getElementById('save-note');
      if (el) {
        el.textContent = 'SAVED ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        el.classList.add('saved');
        clearTimeout(saveGame._t);
        saveGame._t = setTimeout(() => { el.textContent = SAVE_NOTE; el.classList.remove('saved'); }, 2500);
      }
    }
    return true;
  } catch (e) {
    const el = document.getElementById('save-note');
    if (el) el.textContent = 'AUTOSAVE UNAVAILABLE IN THIS BROWSER';
    return false;
  }
}
function loadGame() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return false; }
  if (!d || d.v !== 1) return false;
  const validWeapon = id => Object.prototype.hasOwnProperty.call(WEAPONS, id);
  const owned = Array.isArray(d.owned) ? d.owned.filter(validWeapon) : [];
  P.owned = WEAPON_ORDER.filter(id => id === 'longsword' || owned.includes(id));
  if (!P.owned.length) P.owned = ['longsword'];
  P.weapon = (validWeapon(d.weapon) && P.owned.includes(d.weapon)) ? d.weapon : 'longsword';
  P.spoils = Array.isArray(d.spoils) ? d.spoils.filter(id => SPOILS.some(s => s.id === id)) : [];
  P.equippedSpoils = P.spoils.includes(d.equippedSpoils) ? d.equippedSpoils : null;
  G.ng = Number.isFinite(d.ng) ? Math.max(0, Math.floor(d.ng)) : 0;
  // rebuild stats from a clean base so restoring is idempotent
  P.mods = { dmg: 1, hp: 1, st: 1, spd: 1, flask: 1 };
  P.maxHP = TUNE.playerHP; P.stMax = TUNE.playerST;
  if (P.equippedSpoils) {
    const s = SPOILS.find(x => x.id === P.equippedSpoils);
    if (s) s.apply(P);
  }
  applyWeaponMesh(P.weapon);
  return true;
}
function eraseSave() {
  if (!confirm('Erase saved progress (weapons, spoils and NG+)? This cannot be undone.')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  P.owned = ['longsword']; P.weapon = 'longsword';
  P.spoils = []; P.equippedSpoils = null;
  P.mods = { dmg: 1, hp: 1, st: 1, spd: 1, flask: 1 };
  P.maxHP = TUNE.playerHP; P.stMax = TUNE.playerST;
  G.ng = 0; G.inArena = false; G.bossDead = false; G.bossActive = false; G.fightTime = 0;
  applyWeaponMesh('longsword');
  closeInventory();
  resetBoss(); resetPlayer(); updateFlasks(); updateWeaponLabel(); updateHUD();
  const el = document.getElementById('save-note'); if (el) el.textContent = SAVE_NOTE;
  showCenter('SAVE ERASED', 'a new vigil begins');
}
const B = {
  pos: new THREE.Vector3(0, 0, -8), yaw: 0, hp: TUNE.bossHP, maxHP: TUNE.bossHP,
  state: 'dormant', t: 0, aiT: 0, decideCd: 0, attackKind: '', hasHit: false,
  poise: 100, blocking: false, phase2: false, introT: 0, specialCd: 0,
};
function resetBoss(scaleHp = 1) {
  stopBossMusic();
  B.maxHP = (TUNE.bossHP + G.ng * 150) * scaleHp;
  B.hp = B.maxHP; B.pos.set(0, 0, -8); B.yaw = 0;
  B.state = 'dormant'; B.t = 0; B.poise = 100; B.phase2 = false; B.blocking = false; B.specialCd = 0;
  clearBossHazards();
  telegraphEl.classList.add('hidden'); bossK.parts.swordGlow.material.opacity = 0;
  bossK.group.scale.setScalar(BOSS_BASE_SCALE); bossShadow.scale.setScalar(1);
  bossNameEl.textContent = 'SER DUNCAN  ·  THE ASHEN KNIGHT';
  bossK.group.position.copy(B.pos); bossK.group.rotation.y = Math.PI;
  bossK.group.visible = false; bossShadow.visible = false;
  bossPlate.classList.add('hidden'); G.bossActive = false;
  G.awakening = false; G.awakeT = 0; G.awakeBurst = false;
  G.bossRevealed = false; G.bossRevealY = 0;
  G.locked = false; lockHint.classList.add('hidden');
  resetAltar();
}
function resetPlayer() {
  P.pos.set(G.inArena ? 0 : 1.9, 0, G.inArena ? 8 : 27.6); P.yaw = Math.PI;
  G.camYaw = 0; // camera behind player (south), player faces the arena (north)
  P.hp = P.maxHP; P.st = P.stMax; P.flasks = TUNE.flasks;
  P.state = 'idle'; P.t = 0; P.iframes = false; P.drinkHeal = 0;
}
const saveRestored = loadGame();
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
  if (G.mode !== 'play' || G.awakening) return;
  if (e.code === 'KeyQ') { setLock(!G.locked); if (G.locked) sfx.bonfire(); }
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
  if (G.mode !== 'play' || G.awakening) return;
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
  if (G.awakening) return;
  if (near(bonfirePos, P.pos, 3.2) && !G.inArena) { restAtBonfire(); return; }
  if (!G.inArena && near(new THREE.Vector3(0, 0, ARENA_R - 3.4), P.pos, 3.0)) { enterArena(); return; }
  if (G.inArena && !G.bossActive && !G.bossDead && near(stonePos, P.pos, 3.4)) { touchStone(); return; }
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
  // while auto-tracking, movement is relative to the boss-facing camera (not the stale free-cam yaw)
  const baseYaw = lockOnActive() ? bossFacingYaw() + Math.PI : G.camYaw;
  const c = Math.cos(baseYaw), s = Math.sin(baseYaw);
  return new THREE.Vector3(v.x * c + v.z * s, 0, -v.x * s + v.z * c);
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function inArc(from, facingYaw, to, range, arc) {
  if (dist2D(from, to) > range) return false;
  const want = Math.atan2(to.x - from.x, to.z - from.z);
  return Math.abs(angDiff(want, facingYaw)) < arc;
}
function lockTargetValid() {
  return G.bossActive && B.state !== 'dead' && B.state !== 'dormant' && bossK.group.visible;
}
function setLock(on) {
  G.locked = !!on && lockTargetValid();
  lockHint.classList.toggle('hidden', !G.locked);
}
function lockOnActive() { return G.locked && lockTargetValid(); }
function bossFacingYaw() {
  const dx = B.pos.x - P.pos.x, dz = B.pos.z - P.pos.z;
  if (dx * dx + dz * dz < 1e-4) return P.yaw;
  return Math.atan2(dx, dz);
}
function resolveBossCollision() {
  if (!bossK.group.visible || B.state === 'dead' || !G.bossActive) return;
  const dx = P.pos.x - B.pos.x, dz = P.pos.z - B.pos.z;
  const d = Math.hypot(dx, dz);
  const scaleF = bossK.group.scale.x / BOSS_BASE_SCALE;
  const minD = 1.12 * scaleF + 0.42;
  if (d >= minD) return;
  let nx, nz;
  if (d < 1e-4) { const a = P.yaw + Math.PI; nx = Math.sin(a); nz = Math.cos(a); }
  else { nx = dx / d; nz = dz / d; }
  P.pos.x = B.pos.x + nx * minD;
  P.pos.z = B.pos.z + nz * minD;
  if (G.inArena) {
    const rr = Math.hypot(P.pos.x, P.pos.z);
    if (rr > ARENA_R - 0.8) { P.pos.x *= (ARENA_R - 0.8) / rr; P.pos.z *= (ARENA_R - 0.8) / rr; }
  }
  P.pos.y = 0;
}
function resolveStoneCollision() {
  if (!G.inArena) return;
  const dx = P.pos.x - stonePos.x, dz = P.pos.z - stonePos.z;
  const d = Math.hypot(dx, dz), minD = 1.15;
  if (d >= minD) return;
  let nx, nz;
  if (d < 1e-4) { nx = 0; nz = 1; }
  else { nx = dx / d; nz = dz / d; }
  P.pos.x = stonePos.x + nx * minD;
  P.pos.z = stonePos.z + nz * minD;
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
  if (!G.bossActive || B.state === 'dead' || B.state === 'transform' || G.mode !== 'play') return;
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
    B.phase2 = true; B.state = 'transform'; B.t = 0; B.blocking = false; B.poise = 100;
    B.attackKind = ''; B.specialCd = 4;
    G.hitstop = 0.12;
    showCenter('THE ASHEN VIGIL BREAKS', 'he is reborn in flame — the ground will burn');
    bossNameEl.textContent = 'SER DUNCAN  ·  THE ASHEN LORD';
    sfx.roar(); spawnRing(B.pos, 0xff5030, 12);
    intensifyBossMusic();
    spawnSparks(new THREE.Vector3(B.pos.x, 2.2, B.pos.z), 40, 0xff6a2a, 7);
    telegraphEl.classList.add('hidden'); bossK.parts.swordGlow.material.opacity = 0;
    spawnPillarBarrage(1 + G.ng * 0.25, 10, false);
  }
  if (B.hp <= 0) bossDie();
}

// ============ FLOW ============
function showCenter(t, sub = '') { centerMsg.textContent = t; centerMsg.classList.remove('hidden'); subMsg.textContent = sub; subMsg.classList.toggle('hidden', !sub); clearTimeout(showCenter._t); showCenter._t = setTimeout(() => { centerMsg.classList.add('hidden'); subMsg.classList.add('hidden'); }, 2600); }
function showSub(t) { subMsg.textContent = t; subMsg.classList.remove('hidden'); clearTimeout(showSub._t); showSub._t = setTimeout(() => subMsg.classList.add('hidden'), 1400); }
function updateFlasks() { let s = ''; for (let i = 0; i < TUNE.flasks; i++) s += `<span class="${i < P.flasks ? '' : 'empty'}">▮</span>`; flasksEl.innerHTML = `ESTUS ${s} <span style="color:#8a7a5a;font-size:12px">(press R)</span>`; }
function restAtBonfire() {
  P.hp = P.maxHP; P.flasks = TUNE.flasks; P.st = P.stMax; updateFlasks();
  if (!G.bossDead && G.bossActive) { resetBoss(); showSub('Rested. The knight resumes his vigil.'); }
  else showCenter('RESTED AT THE BONFIRE', 'flasks refilled · wounds mended');
  sfx.bonfire(); spawnSparks(bonfirePos, 16, 0xffa63e, 3);
}
function enterArena() {
  G.inArena = true; fogGate.material.opacity = 0.12;
  showCenter('THE ASHEN STONE', 'touch the gem at the centre of the ring');
  sfx.bonfire(); spawnSparks(new THREE.Vector3(stonePos.x, 1.5, stonePos.z), 10, 0xffa63e, 3);
}
function touchStone() {
  if (!G.inArena || G.bossActive || G.bossDead || G.awakening) return;
  G.awakening = true; G.awakeT = 0; G.awakeBurst = false;
  G.bossRevealed = false; G.bossRevealY = 0;
  setLock(false);
  P.state = 'idle'; P.t = 0;
  P.yaw = Math.atan2(stonePos.x - P.pos.x, stonePos.z - P.pos.z);
  spawnSparks(new THREE.Vector3(stonePos.x, 1.55, stonePos.z + 0.55), 16, 0xffb26a, 3.5);
  sfx.cast(); G.shake = Math.max(G.shake, 0.14);
  showCenter('THE ASHEN STONE', 'the gem answers your touch');
}
function updateAwakening(dt) {
  G.awakeT += dt;
  const T = G.awakeT;
  P.t += dt;
  if (!G.awakeBurst) {
    if (T < 1.15) {
      const k = clampJ(T / 1.15, 0, 1);
      altarGem.visible = true;
      altarGem.position.set(0, 1.52 + k * 0.95, 0.55 + k * 0.28);
      altarGem.rotation.y += dt * (2.5 + k * 10);
      altarGem.rotation.x = k * 0.5;
      altarGem.scale.set(0.85 + k * 0.22, 1.3 + k * 0.34, 0.85 + k * 0.22);
      altarGemMat.emissiveIntensity = 2.4 + k * 3.4;
      altarGlow.material.opacity = 0.62 + k * 0.3;
      altarGlow.scale.setScalar(2.2 + k * 1.8);
      altarLight.intensity = 14 + k * 34;
      if (Math.random() < 0.55) spawnSparks(new THREE.Vector3(stonePos.x + (Math.random() - 0.5) * 0.5, altarGem.position.y, stonePos.z + 0.55 + (Math.random() - 0.5) * 0.3), 1, 0xffa03a, 2.4);
    } else {
      G.awakeBurst = true;
      altarGem.visible = false;
      altarGlow.visible = false;
      altarLight.intensity = 0;
      altarRuneMat.emissiveIntensity = 0.15;
      spawnRing(new THREE.Vector3(stonePos.x, 0, stonePos.z), 0xff8a2a, 9);
      spawnSparks(new THREE.Vector3(stonePos.x, 2.3, stonePos.z + 0.5), 48, 0xffb052, 8);
      sfx.pillar(); G.shake = Math.max(G.shake, 0.5);
    }
  }
  const RT = T - 1.15;
  if (!G.bossRevealed && RT >= 0.35) {
    G.bossRevealed = true;
    bossK.group.visible = true;
    bossShadow.visible = true;
    bossK.group.scale.setScalar(BOSS_BASE_SCALE * 0.55);
    bossShadow.scale.setScalar(0.55);
    B.state = 'intro'; B.t = 0; B.attackKind = ''; B.phase2 = false; B.blocking = false;
    spawnRing(B.pos, 0xff7a26, 7);
    spawnSparks(new THREE.Vector3(B.pos.x, 0.4, B.pos.z), 42, 0xff6a2a, 8);
    sfx.roar(); G.shake = Math.max(G.shake, 0.6);
    showCenter('SER DUNCAN, THE ASHEN KNIGHT', 'the vigil wakes');
    startBossMusic();
  }
  if (G.bossRevealed) {
    const k = clampJ(RT / 1.75, 0, 1);
    bossK.group.scale.setScalar(BOSS_BASE_SCALE * (0.55 + 0.45 * k));
    bossShadow.scale.setScalar(0.55 + 0.45 * k);
    G.bossRevealY = -1.7 * (1 - k);
    B.t = Math.min(1.6, k * 1.6);
    if (Math.random() < 0.55) spawnSparks(new THREE.Vector3(B.pos.x + (Math.random() - 0.5) * 1.7, 0.2 + Math.random() * 1.5, B.pos.z + (Math.random() - 0.5) * 1.7), 1, Math.random() < 0.5 ? 0xff5a1e : 0xffc861, 3);
  }
  if (T >= 3.0) {
    G.awakening = false;
    G.bossRevealY = 0;
    bossK.group.scale.setScalar(BOSS_BASE_SCALE);
    bossShadow.scale.setScalar(1);
    B.state = 'idle'; B.t = 0; B.decideCd = 0.9;
    G.bossActive = true; G.fightTime = 0;
    bossPlate.classList.remove('hidden');
    bossNameEl.textContent = 'SER DUNCAN  ·  THE ASHEN KNIGHT';
    setLock(true);
    showCenter('SER DUNCAN, THE ASHEN KNIGHT', 'a vicious duel — he will not relent');
    spawnRing(B.pos, 0xff7a26, 8);
    sfx.roar(); G.shake = Math.max(G.shake, 0.6);
  }
}
function playerDie() {
  P.state = 'dead'; P.t = 0; G.mode = 'dead'; sfx.death();
  stopBossMusic();
  clearBossHazards();
  telegraphEl.classList.add('hidden');
  setTimeout(() => deathScreen.classList.remove('hidden'), 900);
  setTimeout(() => {
    deathScreen.classList.add('hidden');
    G.inArena = false; fogGate.material.opacity = 0.55;
    resetBoss(); resetPlayer(); updateFlasks();
    G.mode = 'play';
    showCenter('YOU WAKE AT THE BONFIRE', 'the fog awaits again — he believes in you');
  }, 3400);
}
function bossDie() {
  B.state = 'dead'; B.t = 0; G.bossDead = true; G.bossActive = false;
  stopBossMusic();
  setLock(false);
  clearBossHazards();
  telegraphEl.classList.add('hidden'); bossK.parts.swordGlow.material.opacity = 0;
  sfx.victory(); spawnSparks(new THREE.Vector3(B.pos.x, 1.5, B.pos.z), 40, 0xffd76e, 7); spawnRing(B.pos, 0xffd76e, 10);
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
  saveGame();
  showVictory();
}
function showVictory() {
  G.mode = 'victory';
  const mins = Math.floor(G.fightTime / 60), secs = Math.floor(G.fightTime % 60);
  victoryStats.innerHTML = `Time <b>${mins}:${String(secs).padStart(2, '0')}</b> · NG+<b>${G.ng}</b><br>Estus left <b>${P.flasks}</b> · HP <b>${Math.ceil(P.hp)}/${P.maxHP}</b>`;
  victoryScreen.classList.remove('hidden');
}
$('btn-claim').onclick = () => claimDrops();
$('btn-erase').onclick = () => eraseSave();
addEventListener('beforeunload', () => saveGame(true));
$('btn-again').onclick = () => {  victoryScreen.classList.add('hidden');
  stopBossMusic();
  G.ng++; G.bossDead = false; G.inArena = false; G.fightTime = 0;
  fogGate.material.opacity = 0.55; resetBoss(); resetPlayer(); updateFlasks();
  G.mode = 'play'; saveGame();
  showCenter('NEW VIGIL — NG+' + G.ng, 'he strikes 25% harder. Honour him.');
};
$('btn-begin').onclick = () => {
  audio(); startMusic();
  titleScreen.style.display = 'none'; hud.classList.remove('hidden');
  G.mode = 'play'; updateFlasks();
  showCenter('FIND THE BONFIRE', saveRestored ? 'progress restored · rest (E), then step through the fog (E)' : 'rest (E), then step through the fog (E)');
};

// ============ BOSS AI ============
function bossDecide() {
  const d = dist2D(B.pos, P.pos);
  const opts = [];
  if (d < 3.6) opts.push('slash', 'slash', 'slash', 'bash');
  else if (d < 7) opts.push('approach_slash', 'thrust', 'slam', 'approach_slash');
  else opts.push('run_thrust', 'run_slash', B.phase2 ? 'jump' : 'run_thrust');
  if (B.phase2) {
    opts.push('slam', 'jump', 'jump');
    if (B.specialCd <= 0) opts.push('pillars', 'pillars');
  } else if (B.specialCd <= 0) {
    opts.push('pillars');
    if (d > 6) opts.push('pillars');
  }
  // rare guard
  if (Math.random() < 0.07 && d < 5) { B.state = 'block'; B.t = 0; B.blocking = true; return; }
  const pick = opts[Math.random() * opts.length | 0];
  B.attackKind = pick; B.state = 'chase'; B.t = 0; B.hasHit = false;
}
function bossStartSwing(kind) {
  B.attackKind = kind; B.state = 'windup'; B.t = 0; B.hasHit = false;
  if (kind === 'pillars') B.specialCd = B.phase2 ? 3.0 : 5.5;
  sfx.swing();
  telegraphEl.classList.remove('hidden');
  bossK.parts.swordGlow.material.opacity = 0.85;
}
const BOSS_ATK = {
  slash: { wind: 0.62, swing: 0.34, recover: 0.92, range: 3.6, arc: 1.2, dmg: 'slash' },
  slash2: { wind: 0.44, swing: 0.32, recover: 1.0, range: 3.6, arc: 1.2, dmg: 'slash2' },
  slam: { wind: 0.72, swing: 0.25, recover: 1.05, range: 3.8, arc: 2.6, dmg: 'slam' },
  thrust: { wind: 0.54, swing: 0.33, recover: 0.98, range: 4.6, arc: 0.5, dmg: 'thrust' },
  jump: { wind: 0.6, swing: 0.35, recover: 1.15, range: 4.5, arc: 2.8, dmg: 'jump' },
  bash: { wind: 0.52, swing: 0.29, recover: 0.86, range: 2.8, arc: 1.4, dmg: 'bash' },
  pillars: { wind: 0.82, swing: 0.35, recover: 1.35, range: 60, arc: 6.28, dmg: 'pillar' },
};
function bossDoHit(kind) {
  const a = BOSS_ATK[kind]; if (!a) return;
  let mult = 1 + G.ng * 0.25;
  if (B.phase2) mult *= 1.18;
  if (kind === 'pillars') {
    spawnPillarBarrage(mult, B.phase2 ? 16 : 10);
    G.shake = Math.max(G.shake, 0.35);
    return;
  }
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
        // auto-tracking keeps the body squared up with the boss while strafing
        const want = lockOnActive() ? bossFacingYaw() : Math.atan2(mv.x, mv.z);
        P.yaw += angDiff(want, P.yaw) * Math.min(1, (lockOnActive() ? 16 : 12) * dt);
        const sp = lockOnActive() ? speed * 0.85 : speed;
        P.pos.x += mv.x * sp * dt; P.pos.z += mv.z * sp * dt;
        P.state = 'run';
      } else P.state = 'idle';
      if (lockOnActive()) { const w = bossFacingYaw(); P.yaw += angDiff(w, P.yaw) * Math.min(1, 12 * dt); }
      break;
    }
    case 'attack': {
      const dur = 0.55 * wpn.spd, hitA = 0.18 * wpn.spd, hitB = 0.34 * wpn.spd;
      const want = lockOnActive() ? bossFacingYaw() : P.yaw;
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
      P.yaw += (lockOnActive() ? angDiff(bossFacingYaw(), P.yaw) : 0) * Math.min(1, 4 * dt);
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
  B.specialCd = Math.max(0, B.specialCd - dt);
  const toP = Math.atan2(P.pos.x - B.pos.x, P.pos.z - B.pos.z);
  const d = dist2D(B.pos, P.pos);
  const turn = (B.phase2 ? 3.4 : TUNE.bossTurn);
  switch (B.state) {
    case 'dormant': {
      // kneel; rise handled by intro
      B.yaw += angDiff(0, B.yaw) * Math.min(1, dt);
      break;
    }
    case 'intro': {
      if (B.t > 1.6) { B.state = 'idle'; B.decideCd = 0.35; G.fightTime = 0; }
      break;
    }
    case 'transform': {
      // grow into the Ashen Lord, shedding embers as the armour splits
      const k = sstep(clampJ(B.t / 1.9, 0, 1));
      bossK.group.scale.setScalar(BOSS_BASE_SCALE + (BOSS_RAGE_SCALE - BOSS_BASE_SCALE) * k);
      bossShadow.scale.setScalar(1 + 0.3 * k);
      B.yaw += angDiff(toP, B.yaw) * Math.min(1, 1.6 * dt);
      if (Math.random() < 0.7) {
        spawnSparks(new THREE.Vector3(
          B.pos.x + (Math.random() - 0.5) * 1.8,
          0.4 + Math.random() * 2.6,
          B.pos.z + (Math.random() - 0.5) * 1.8
        ), 1, Math.random() < 0.5 ? 0xff5a1e : 0xffc861, 3);
      }
      if (B.t >= 1.9) {
        bossK.group.scale.setScalar(BOSS_RAGE_SCALE);
        bossShadow.scale.setScalar(1.3);
        B.state = 'idle'; B.decideCd = 0.35;
        sfx.roar(); spawnRing(B.pos, 0xff7a26, 9);
      }
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
      const spd = d > 7 ? TUNE.bossRun : TUNE.bossSpeed * (B.phase2 ? 1.3 : 1);
      B.pos.x += Math.sin(B.yaw) * spd * dt; B.pos.z += Math.cos(B.yaw) * spd * dt;
      const reach = { slash: 3.0, approach_slash: 3.0, thrust: 4.2, slam: 4.6, run_thrust: 4.2, run_slash: 3.2, jump: 5.2, bash: 2.4, pillars: 99 }[B.attackKind] || 3;
      if (d <= reach) {
        const map = { approach_slash: 'slash', run_thrust: 'thrust', run_slash: 'slash' };
        bossStartSwing(map[B.attackKind] || B.attackKind);
      } else if (B.t > 2.8) { B.state = 'idle'; B.decideCd = 0.2; } // gave up chase
      break;
    }
    case 'windup': {
      B.yaw += angDiff(toP, B.yaw) * Math.min(1, (B.attackKind === 'thrust' ? 3.2 : 1.4) * dt);
      const a = BOSS_ATK[B.attackKind];
      // lunge for thrust / jump
      if (B.attackKind === 'thrust' && B.t > a.wind * 0.5) B.pos.addScaledVector(forwardOf(B.yaw), 3.5 * dt);
      if (B.attackKind === 'jump' && B.t > a.wind * 0.4) B.pos.addScaledVector(forwardOf(B.yaw), 6.5 * dt);
      if (B.t >= a.wind) { B.state = 'swing'; B.t = 0; telegraphEl.classList.add('hidden'); bossK.parts.swordGlow.material.opacity = 0; bossDoHit(B.attackKind); if (B.attackKind !== 'slam' && B.attackKind !== 'jump' && B.attackKind !== 'pillars') sfx.slam(); }
      break;
    }
    case 'swing': {
      const a = BOSS_ATK[B.attackKind];
      if (B.attackKind === 'thrust') B.pos.addScaledVector(forwardOf(B.yaw), 4 * dt);
      if (B.t >= a.swing) {
        // combo: slash -> slash2 (relentless)
        if (B.attackKind === 'slash' && Math.random() < (B.phase2 ? 0.85 : 0.72) && d < 4.5 && P.state !== 'dead') bossStartSwing('slash2');
        else { B.state = 'recover'; B.t = 0; }
      }
      break;
    }
    case 'recover': {
      B.yaw += angDiff(toP, B.yaw) * Math.min(1, 1.0 * dt);
      const rec = (BOSS_ATK[B.attackKind]?.recover || 1) * (B.phase2 ? 0.88 : 1) * (TUNE.recovery / 1.35);
      if (B.t >= rec) { B.state = 'idle'; B.decideCd = 0.22 + Math.random() * 0.3; }
      break;
    }
    case 'block': {
      B.yaw += angDiff(toP, B.yaw) * Math.min(1, 3 * dt);
      if (B.t > 1.1) { B.blocking = false; B.state = 'idle'; B.decideCd = 0.4; }
      break;
    }
    case 'stagger': {
      if (B.t > 1.6) { B.state = 'idle'; B.poise = 100; B.decideCd = 0.4; }
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
  K.group.position.y = (o.pos.y || 0) + (o.yOffset || 0);
  const body = p.body;
  body.rotation.set(0, 0, 0);
  body.position.y = ROLL_H;

  // ---- shared shape vars ----
  let hipsDip = 0, torsoX = 0.07, torsoY = 0, headX = 0, headY = 0;
  let legLx = sw * strideAmp, legRx = -sw * strideAmp, kneeL = 0, kneeR = 0;
  let shRx = -0.55 + sw * 0.16, shRz = -0.14, elR = -0.55;
  let shLx = -0.42 - sw * 0.16, shLz = 0.18, elL = -0.62;
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
  } else if (S === 'transform') {
    // armour splits and the knight swells; arms flung wide, head thrown back
    const k = sstep(clampJ(o.t / 1.9, 0, 1)), arch = Math.sin(k * Math.PI);
    hipsDip = 0.10 + arch * 0.14;
    torsoX = 0.06 - arch * 0.45; headX = -arch * 0.55;
    shRx = -0.55 - arch * 1.7; elR = -0.55 - arch * 0.4;
    shLx = -0.45 - arch * 1.0; elL = -0.85 - arch * 0.7;
    shRz = -0.14 - arch * 0.4; shLz = 0.18 + arch * 0.3;
  } else if (S === 'windup') {
    const a = BOSS_ATK[o.kind], k = sstep(clampJ(o.t / ((a && a.wind) || 0.6), 0, 1));
    if (o.kind === 'slam' || o.kind === 'jump' || o.kind === 'pillars') {
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
    if (o.kind === 'slam' || o.kind === 'jump' || o.kind === 'pillars') {
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
  p.shield.rotation.x = clampJ(-(AL.sh.rotation.x + AL.el.rotation.x) - 0.08, -2.6, 2.6);
  p.shield.rotation.z = -AL.sh.rotation.z * 0.75;
  // sword trail follows swing energy
  K._trail = (K._trail || 0) + (trailT - (K._trail || 0)) * Math.min(1, 16 * dt);
  p.trail.material.opacity = K._trail;
  p.trail.rotation.y = Math.sin(time * 30) * 0.06 * K._trail;
  p.visor.material.emissiveIntensity = o.enrage ? 2.2 + Math.sin(time * 10) * 0.8 : 0.65;
}

// ============ CAMERA ============
const camTarget = new THREE.Vector3();
const camLook = new THREE.Vector3(0, 1.7, 28);
const _camWant = new THREE.Vector3(), _camAim = new THREE.Vector3(), _camLookTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (G.awakening) {
    if (G.awakeT < 1.15) {
      _camWant.set(2.8, 2.25, 3.8);
      camLook.lerp(_camLookTarget.set(stonePos.x, 1.5, stonePos.z), 1 - Math.exp(-5 * dt));
    } else {
      _camWant.set(4.2, 3.2, 2.8);
      const aimY = 1.1 + 0.95 * (bossK.group.scale.x / BOSS_BASE_SCALE);
      camLook.lerp(_camLookTarget.set(B.pos.x, aimY, B.pos.z), 1 - Math.exp(-3.2 * dt));
    }
    camTarget.lerp(_camWant, 1 - Math.exp(-3.4 * dt));
  } else if (lockOnActive()) {
    const dx = P.pos.x - B.pos.x, dz = P.pos.z - B.pos.z;
    const len = Math.hypot(dx, dz);
    let bx, bz;
    if (len < 0.001) { bx = -Math.sin(P.yaw); bz = -Math.cos(P.yaw); }
    else { bx = dx / len; bz = dz / len; }
    const d = dist2D(P.pos, B.pos);
    const scaleF = bossK.group.scale.x / BOSS_BASE_SCALE;
    const dist = 2.7 + Math.min(2.2, d * 0.16);
    _camWant.set(P.pos.x + bx * dist, 2.15 + Math.min(0.9, d * 0.08), P.pos.z + bz * dist);
    // never let the camera slip inside the boss
    const vx = _camWant.x - B.pos.x, vz = _camWant.z - B.pos.z;
    const vd = Math.hypot(vx, vz), minCam = 1.9 * scaleF;
    if (vd < minCam) {
      const ax = vd < 0.001 ? bx : vx / vd, az = vd < 0.001 ? bz : vz / vd;
      _camWant.x = B.pos.x + ax * minCam; _camWant.z = B.pos.z + az * minCam;
    }
    const rr = Math.hypot(_camWant.x, _camWant.z);
    if (G.inArena && rr > ARENA_R + 1) { const f = (ARENA_R + 1) / rr; _camWant.x *= f; _camWant.z *= f; }
    _camWant.y = Math.max(1.2, _camWant.y);
    camTarget.lerp(_camWant, 1 - Math.exp(-7 * dt));
    camLook.lerp(_camAim.set(B.pos.x, 2.05 * scaleF, B.pos.z), 1 - Math.exp(-10 * dt));
  } else {
    const cx = Math.sin(G.camYaw) * Math.cos(G.camPitch), cz = Math.cos(G.camYaw) * Math.cos(G.camPitch);
    _camWant.set(P.pos.x + cx * G.camDist, 1.6 + Math.sin(G.camPitch) * G.camDist, P.pos.z + cz * G.camDist);
    // keep camera out of walls
    const dd = Math.hypot(_camWant.x, _camWant.z);
    if (G.inArena && dd > ARENA_R + 1) {
      const f = (ARENA_R + 1) / dd;
      _camWant.x *= f; _camWant.z *= f;
      _camWant.y = 1.6 + (_camWant.y - 1.6) * f;
    }
    _camWant.y = Math.max(1.0, _camWant.y);
    camTarget.lerp(_camWant, 1 - Math.exp(-10 * dt));
    camLook.lerp(_camLookTarget.set(P.pos.x, 1.7, P.pos.z), 1 - Math.exp(-12 * dt));
  }
  camera.position.copy(camTarget);
  if (G.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * G.shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * G.shake * 0.5;
    G.shake = Math.max(0, G.shake - dt * 1.8);
  }
  camera.lookAt(camLook);
  // FOV punch on dodge-roll / sprint: speed you can feel
  const targetFov = 55 + (P.state === 'roll' ? 8 : 0) + ((keys.ShiftLeft && P.state === 'run') ? 3 : 0);
  if (Math.abs(camera.fov - targetFov) > 0.02) { camera.fov += (targetFov - camera.fov) * Math.min(1, 8 * dt); camera.updateProjectionMatrix(); }
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
  if (G.mode === 'play' && !G.awakening) {
    if (!G.inArena && near(bonfirePos, P.pos, 3.2)) { interactPrompt.classList.remove('hidden'); interactText.textContent = 'to rest at the bonfire'; }
    else if (!G.inArena && near(new THREE.Vector3(0, 0, ARENA_R - 3.4), P.pos, 3.0)) { interactPrompt.classList.remove('hidden'); interactText.textContent = 'to face Ser Duncan'; }
    else if (G.inArena && !G.bossActive && !G.bossDead && near(stonePos, P.pos, 3.4)) { interactPrompt.classList.remove('hidden'); interactText.textContent = 'to touch the ashen stone'; }
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
  saveGame();
}
function unequipSpoils() {
  if (!P.equippedSpoils) return;
  const old = SPOILS.find(x => x.id === P.equippedSpoils);
  if (old) old.unapply(P);
  P.equippedSpoils = null;
  sfx.equip();
  renderWeaponList();
  saveGame();
}

// ============ MAIN LOOP ============
const clock = new THREE.Clock();
camTarget.set(0, 4, 32);
let first = true, frameNo = 0, hudTick = 0;
function loop() {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, clock.getDelta());
  if (G.hitstop > 0) { G.hitstop -= dt; dt *= 0.07; } // hit-stop: impacts land with weight
  const t = clock.elapsedTime;
  frameNo++;
  // fire flicker (layered sprites breathe and lick sideways)
  for (const f of window._flames) {
    const u = f.userData; if (!u.sprites) continue;
    const [outer, core] = u.sprites;
    const k = 1 + Math.sin(t * 10 + u.seed) * 0.10 + Math.sin(t * 23 + u.seed * 1.7) * 0.045;
    outer.scale.set(u.w * 2.9 * (1 + Math.sin(t * 7.3 + u.seed) * 0.06), u.h * 1.5 * k, 1);
    outer.position.x = Math.sin(t * 1.35 + u.seed) * u.w * 0.10;
    core.scale.set(u.w * 1.35 * (1 + Math.sin(t * 12.7 + u.seed) * 0.08), u.h * 0.95 * k, 1);
    core.position.x = Math.sin(t * 1.8 + u.seed * 1.3) * u.w * 0.06;
  }
  for (const s of smokeSprites) {
    s.position.y += dt * 0.22;
    s.position.x += Math.sin(t * 0.5 + s.userData.phase) * dt * s.userData.drift;
    s.material.opacity = 0.10 * Math.max(0, 1 - (s.position.y - s.userData.y0) / 4.5);
    if (s.position.y > s.userData.y0 + 4.5) { s.position.y = s.userData.y0; s.position.x = bonfirePos.x + (Math.random() - 0.5) * 0.5; }
    s.scale.setScalar(1.2 + (s.position.y - s.userData.y0) * 0.5);
  }
  for (const m of mistSprites) {
    m.userData.a += dt * m.userData.speed;
    m.position.x = Math.cos(m.userData.a) * m.userData.r;
    m.position.z = Math.sin(m.userData.a) * m.userData.r;
    m.position.y = m.userData.y + Math.sin(t * 0.35 + m.userData.phase) * 0.22;
  }
  if (!G.awakening && altarGem.visible) {
    altarGem.rotation.y = t * 1.1;
    altarGem.position.y = 1.52 + Math.sin(t * 1.8) * 0.04;
    altarGlow.material.opacity = 0.52 + Math.sin(t * 3.2) * 0.12;
    altarLight.intensity = 12 + Math.sin(t * 4.1) * 3;
  }
  fogGate.material.opacity = (G.inArena ? 0.1 : 0.5) + Math.sin(t * 1.7) * 0.06;
  warm.intensity = 24 + Math.sin(t * 9) * 4;
  // embers
  if (Math.random() < 0.25) spawnSparks(new THREE.Vector3((Math.random()-0.5)*20, 0.5, (Math.random()-0.5)*20 + 6), 1, Math.random() < 0.5 ? 0xff8c3a : 0x555566, 1.2);
  updateSparks(dt);
  for (let i = rings.length - 1; i >= 0; i--) {
    const m = rings[i]; m.userData.r += dt * 14;
    const k = m.userData.r / m.userData.maxR;
    m.scale.setScalar(m.userData.r); m.material.opacity = 0.9 * (1 - k);
    if (k >= 1) { scene.remove(m); rings.splice(i, 1); }
  }
  if (G.mode === 'play' && !G.paused) {
    if (G.awakening) {
      updateAwakening(dt);
    } else {
      updatePlayer(dt);
      resolveStoneCollision();
      resolveBossCollision();
    }
    if (!G.awakening && (G.bossActive || B.state === 'dormant')) updateBoss(dt);
    if (!G.awakening) { resolveStoneCollision(); resolveBossCollision(); }
    updatePillars(dt);
  }
  // poses
  const pMoving = ['run'].includes(P.state) || (['idle'].includes(P.state) && moveVec().lengthSq() > 0.01);
  poseKnight(playerK, { moving: pMoving, sprint: !!keys.ShiftLeft, state: P.state, t: P.t, combo: P.combo, pos: P.pos, yaw: P.yaw }, dt);
  const bMoving = ['chase'].includes(B.state);
  poseKnight(bossK, { moving: bMoving, sprint: false, bossStep: true, state: B.state, t: B.t, kind: B.attackKind, pos: B.pos, yaw: B.yaw, yOffset: G.awakening ? G.bossRevealY : 0, enrage: B.phase2 }, dt);
  const clothNormals = (frameNo % 3) === 0;
  animateCloth(playerK.parts.cape, t, clothNormals); animateCloth(playerK.parts.cape2, t * 1.07, clothNormals);
  animateCloth(bossK.parts.cape, t * 0.9, clothNormals); animateCloth(bossK.parts.cape2, t * 0.97, clothNormals);
  playerShadow.position.set(P.pos.x, 0.025, P.pos.z);
  bossShadow.position.set(B.pos.x, 0.025, B.pos.z);
  bossShadow.visible = bossK.group.visible && B.state !== 'dead';
  updateCamera(dt);
  if ((hudTick++ % 3) === 0) updateHUD();
  gradePass.uniforms.uTime.value = t;
  composer.render();
  if (first) { first = false; $('loading').style.display = 'none'; }
}
updateFlasks();
updateWeaponLabel();
loop();

// expose for automated checks
window.__game = { G, P, B, TUNE, WEAPONS, SPOILS, RARITY, DROP_POOL, enterArena, touchStone, updateAwakening, stonePos, restAtBonfire, damageBoss, damagePlayer, equipWeapon, toggleInventory, equipSpoils, unequipSpoils, rollDrops, claimDrops, showDropScreen, spawnPillarBarrage, clearBossHazards, pillars, saveGame, loadGame, eraseSave };
window.__scene = { scene, camera, renderer, moon, composer, playerShadow, bossShadow, THREE };


if (location.hash === '#bosstest') {
  setTimeout(() => {
    document.getElementById('btn-begin').click();
    G.inArena = true; touchStone();
  }, 300);
  setTimeout(() => {
    const m = bossMusic;
    document.body.setAttribute('data-bm', m
      ? ('ON step=' + m.step + ' tempo=' + m.tempo + ' gain=' + m.master.gain.value.toFixed(3) + ' state=' + m.ac.state + ' ambientNodes=' + musicNodes.length)
      : 'OFF');
  }, 6000);
}
