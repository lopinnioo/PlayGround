// SOULS BOSS DEMO — one-boss souls-like. Three.js, no assets, all procedural.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
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
const dropScreenEl = $('drop-screen'), dropListEl = $('drop-list'), spoilsSlotEl = $('spoils-slot'), spoilTipEl = $('spoil-tip');
const vigilMenuEl = $('vigil-menu'), vigilBossListEl = $('vigil-boss-list');
const worldFade = $('world-fade');

// ============ TUNING (vicious) ============
const TUNE = {
  playerHP: 380, playerST: 143, flasks: 2, flaskHeal: 200,
  lightDmg: [43.4, 46.2, 64.4], heavyDmg: 94.5, lightST: [18, 18, 22], heavyST: 32,
  rollST: 24, sprintDrain: 18, stRegen: 46, rollTime: 0.46, iframes: [0.06, 0.30],
  bossHP: 1450, bossDmg: { slash: 42, slash2: 46, slam: 64, ring: 38, thrust: 50, jump: 60, bash: 26, pillar: 48, fireball: 34, firewave: 44, meteor: 62 },
  bossSpeed: 3.7, bossRun: 6.3, bossTurn: 3.2, recovery: 1.12,
  witchHP: 1320, witchDmg: { bolt: 34, wave: 42, curse: 52, blink: 46, storm: 30, beam: 50, skeleton: 18, moonzone: 46 }, witchSpeed: 3.2,
  dragonHP: 4048, dragonDmg: { bite: 61, tail: 71, breath: 50, dive: 73, wing: 42, backdraft: 55 }, dragonSpeed: 3.0,
  fangHP: 2550, fangDmg: { rend: 40, skyrend: 28, skyrendBig: 56, spin: 50, plunge: 66, duskwave: 38, duskfire: 42, afterimage: 44 }, fangSpeed: 4.0,
  duoHP: 1580, duoDmg: { thrust: 48, sweep: 42, slam: 62, charge: 58, toll: 48, echo: 26 }, duoSpeed: 3.6,
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
  slash() { noise(0.16, 0.14, 4200); tone(660, 0.16, 'triangle', 0.05, -260); },
  dash() { noise(0.18, 0.08, 1200); tone(180, 0.18, 'sawtooth', 0.06, -120); },
  pillarWarn() { tone(110, 0.55, 'triangle', 0.12, 45); noise(0.3, 0.06, 700); },
  pillar() { tone(46, 0.7, 'sine', 0.35, -12); noise(0.5, 0.24, 900); },
  fireBreath() { noise(0.55, 0.08, 1600); tone(86, 0.55, 'sawtooth', 0.05, -26); },
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

// ============ BOSS MUSIC (procedural orchestral / choral) ============
let bossMusic = null;
const BOSS_STEPS = 128;

// Eight-bar D-minor progression: Dm | Bb | F | C | Dm | Bb | Gm | A
const BOSS_CHORDS = [
  { root: 73.42, notes: [146.83, 174.61, 220.00] },
  { root: 58.27, notes: [116.54, 146.83, 174.61] },
  { root: 87.31, notes: [174.61, 220.00, 261.63] },
  { root: 65.41, notes: [130.81, 164.81, 196.00] },
  { root: 73.42, notes: [146.83, 174.61, 220.00] },
  { root: 58.27, notes: [116.54, 146.83, 174.61] },
  { root: 98.00, notes: [98.00, 116.54, 146.83] },
  { root: 55.00, notes: [110.00, 138.59, 164.81] },
];
// Long original soprano line, one entry per bar. at/len are 16th-note steps.
const BOSS_MELODY = [
  [{ f: 440.00, at: 0, len: 8 }, { f: 349.23, at: 8, len: 8 }],
  [{ f: 293.66, at: 0, len: 11 }, { f: 261.63, at: 11, len: 5 }],
  [{ f: 349.23, at: 0, len: 8 }, { f: 440.00, at: 8, len: 8 }],
  [{ f: 329.63, at: 0, len: 8 }, { f: 392.00, at: 8, len: 8 }],
  [{ f: 440.00, at: 0, len: 8 }, { f: 523.25, at: 8, len: 8 }],
  [{ f: 466.16, at: 0, len: 8 }, { f: 349.23, at: 8, len: 8 }],
  [{ f: 293.66, at: 0, len: 8 }, { f: 233.08, at: 8, len: 8 }],
  [{ f: 277.18, at: 0, len: 14 }, { f: 220.00, at: 14, len: 2 }],
];

function bmEnv(m, out, at, dur, vol, attack, release, send, pan) {
  const ac = m.ac;
  let src = out;
  if (pan) {
    const p = ac.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    out.connect(p); src = p;
  }
  const g = ac.createGain();
  const peak = Math.max(0.0002, vol);
  const a = Math.max(0.005, Math.min(attack == null ? 0.018 : attack, dur * 0.45));
  const r = Math.max(0.03, Math.min(release == null ? 0.28 : release, dur * 0.8));
  const rel = Math.max(at + a, at + dur - r);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + a);
  g.gain.setValueAtTime(peak, rel);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(g); g.connect(m.master);
  if (send) {
    const s = ac.createGain(); s.gain.value = send;
    g.connect(s); s.connect(m.reverbSend);
  }
  return g;
}
function bmTone(m, freq, at, dur, type, vol, cutoff, opts) {
  opts = opts || {};
  const ac = m.ac;
  const o = ac.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, at);
  if (opts.detune) o.detune.setValueAtTime(opts.detune, at);
  let out = o;
  if (cutoff) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, at); f.Q.value = opts.q == null ? 0.7 : opts.q;
    o.connect(f); out = f;
  }
  bmEnv(m, out, at, dur, vol, opts.attack, opts.release, opts.send == null ? 0.1 : opts.send, opts.pan || 0);
  o.start(at); o.stop(at + dur + 0.05);
}
function bmNoise(m, at, dur, vol, freq, type, send) {
  const ac = m.ac;
  const s = ac.createBufferSource(); s.buffer = m.nb; s.loop = true;
  const f = ac.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq; f.Q.value = 0.6;
  const g = ac.createGain();
  const a = 0.008, r = Math.min(0.16, dur * 0.4), rel = Math.max(at + a, at + dur - r);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + a);
  g.gain.setValueAtTime(Math.max(0.0002, vol), rel);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  s.connect(f).connect(g).connect(m.master);
  if (send) { const sg = ac.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(m.reverbSend); }
  s.start(at); s.stop(at + dur + 0.04);
}
function bmTimpani(m, freq, at, vol) {
  const ac = m.ac;
  const o = ac.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(Math.max(34, freq * 1.7), at);
  o.frequency.exponentialRampToValueAtTime(Math.max(26, freq * 0.82), at + 0.28);
  bmEnv(m, o, at, 0.62, vol, 0.004, 0.5, 0.16, 0);
  o.start(at); o.stop(at + 0.68);
  bmNoise(m, at, 0.1, vol * 0.34, 260, 'lowpass', 0.1);
}
function bmString(m, freq, at, dur, vol, pan, cutoff) {
  for (const d of [-0.0032, 0.0032]) {
    bmTone(m, freq * (1 + d), at, dur, 'sawtooth', vol * 0.56, cutoff || 1500, {
      attack: 0.34, release: 0.9, send: 0.24, pan,
    });
  }
}
function bmBrass(m, freq, at, dur, vol, pan) {
  bmTone(m, freq, at, dur, 'sawtooth', vol, 920, { attack: 0.16, release: 0.42, send: 0.32, pan, q: 0.9 });
  bmTone(m, freq * 1.003, at, dur, 'sawtooth', vol * 0.52, 1080, { attack: 0.2, release: 0.45, send: 0.32, pan });
}
function bmChoir(m, freq, at, dur, vol, pan, vowel) {
  const ac = m.ac;
  const input = ac.createGain(); input.gain.value = 1;
  const bus = ac.createGain(); bus.gain.value = 1;
  const formants = vowel === 'oh'
    ? [[430, 1, 7], [800, 0.62, 9], [2500, 0.22, 11]]
    : [[720, 1, 7], [1180, 0.66, 9], [2700, 0.34, 11]];
  for (const [ff, fg, q] of formants) {
    const f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = ff; f.Q.value = q;
    const g = ac.createGain(); g.gain.value = fg;
    input.connect(f); f.connect(g); g.connect(bus);
  }
  const body = ac.createBiquadFilter();
  body.type = 'lowpass'; body.frequency.value = 680; body.Q.value = 0.7;
  const bodyG = ac.createGain(); bodyG.gain.value = 0.5;
  input.connect(body); body.connect(bodyG); bodyG.connect(bus);
  for (const det of [-6, 6]) {
    const o = ac.createOscillator();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, at); o.detune.setValueAtTime(det, at);
    o.connect(input); o.start(at); o.stop(at + dur + 0.1);
  }
  const sub = ac.createOscillator();
  sub.type = 'sine'; sub.frequency.setValueAtTime(freq / 2, at);
  const subG = ac.createGain(); subG.gain.value = 0.18;
  sub.connect(subG).connect(input); sub.start(at); sub.stop(at + dur + 0.1);
  bmEnv(m, bus, at, dur, vol, 0.45, 0.95, 0.45, pan);
}
function bmImpulse(ac, seconds) {
  const len = Math.floor(ac.sampleRate * seconds);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0, lp2 = 0;
    for (let i = 0; i < len; i++) {
      const k = i / len, decay = Math.pow(1 - k, 2.35);
      const n = Math.random() * 2 - 1;
      lp += (n - lp) * 0.16;
      lp2 += (lp - lp2) * 0.2;
      d[i] = (lp * 0.72 + lp2 * 0.28) * decay;
    }
    for (const [ms, amp] of [[29, 0.24], [57, 0.18], [97, 0.13]]) {
      const i = Math.floor(ac.sampleRate * ms / 1000);
      if (i < len) d[i] += amp;
    }
  }
  return ir;
}
function playBossStep(m, step, at, stepDur) {
  const s = step % 16, bar = Math.floor(step / 16) % 8;
  const ch = BOSS_CHORDS[bar];
  if (s === 0) {
    ch.notes.forEach((n, i) => bmString(m, n, at, stepDur * 16, 0.018, [-0.55, 0.55, 0][i]));
    bmString(m, ch.root, at, stepDur * 16, 0.014, 0, 760);
    ch.notes.forEach((n, i) => bmChoir(m, n * 2, at, stepDur * 16, 0.024, [-0.42, 0.42, 0][i], 'ah'));
    bmChoir(m, ch.root * 2, at, stepDur * 16, 0.017, -0.12, 'oh');
    bmTone(m, ch.root, at, stepDur * 7.5, 'triangle', 0.095, 230, { attack: 0.02, release: 0.34, send: 0.12 });
    bmTimpani(m, ch.root, at, 0.15);
    if (bar === 0 || bar === 4 || bar === 7) {
      bmBrass(m, ch.notes[0] / 2, at, stepDur * 10, 0.024, -0.2);
      bmBrass(m, ch.notes[2] / 2, at, stepDur * 10, 0.016, 0.2);
    }
  }
  if (s === 8) {
    bmTone(m, ch.root, at, stepDur * 4.5, 'triangle', 0.075, 240, { attack: 0.03, release: 0.3, send: 0.1 });
    bmTimpani(m, ch.root * 1.5, at, 0.09);
  }
  if (s === 6 || s === 12) {
    bmTone(m, ch.root * 1.5, at, stepDur * 2.3, 'triangle', 0.052, 220, { attack: 0.02, release: 0.24, send: 0.1 });
  }
  if (bar === 7 && s === 14) bmTimpani(m, ch.root, at, 0.13);
  if (bar === 7 && s === 8) bmNoise(m, at, 0.9, 0.013, 760, 'lowpass', 0.1);
  const melody = BOSS_MELODY[bar];
  if (s === 0 && melody) {
    for (const n of melody) {
      const t2 = at + n.at * stepDur, d2 = n.len * stepDur;
      bmChoir(m, n.f, t2, d2, 0.02, 0.15, 'ah');
      bmTone(m, n.f, t2, d2, 'triangle', 0.032, 2400, { attack: 0.12, release: 0.65, send: 0.35, pan: 0.15 });
    }
  }
  if (m.phase2 && s === 0 && bar % 2 === 0) {
    bmBrass(m, ch.notes[1], at, stepDur * 7, 0.016, 0);
  }
}
function scheduleBossMusic(m) {
  if (bossMusic !== m || m.stopped) { clearInterval(m.timer); return; }
  const ac = m.ac, stepDur = 60 / m.tempo / 4;
  if (m.next < ac.currentTime - 0.05) m.next = ac.currentTime + 0.03;
  while (m.next < ac.currentTime + 0.55) {
    if (!muted) playBossStep(m, m.step, m.next, stepDur);
    m.step = (m.step + 1) % BOSS_STEPS;
    m.next += stepDur;
  }
}
function startBossMusic() {
  if (bossMusic) return;
  const ac = audio(); if (!ac) return;
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, ac.currentTime);
  master.gain.exponentialRampToValueAtTime(muted ? 0.0001 : 0.27, ac.currentTime + 1.5);
  const eq = ac.createBiquadFilter();
  eq.type = 'peaking'; eq.frequency.value = 240; eq.Q.value = 0.7; eq.gain.value = 2.2;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 30; hp.Q.value = 0.7;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 6200; lp.Q.value = 0.65;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -15; comp.knee.value = 18; comp.ratio.value = 2.6;
  comp.attack.value = 0.006; comp.release.value = 0.22;
  master.connect(eq).connect(hp).connect(lp).connect(comp);
  comp.connect(ac.destination);

  const conv = ac.createConvolver();
  conv.buffer = bmImpulse(ac, 2.7);
  const wet = ac.createGain(); wet.gain.value = 0.3;
  const reverbSend = ac.createGain(); reverbSend.gain.value = 0.9;
  reverbSend.connect(conv); conv.connect(wet); wet.connect(master);

  stopAmbientMusic();
  const nb = ac.createBuffer(1, Math.floor(ac.sampleRate * 1.5), ac.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  bossMusic = {
    ac, master, eq, hp, lp, comp, conv, wet, reverbSend, nb,
    step: 0, next: ac.currentTime + 0.08,
    tempo: 74, phase2: false, stopped: false, timer: null,
  };
  bossMusic.timer = setInterval(() => scheduleBossMusic(bossMusic), 25);
}
function intensifyBossMusic() {
  if (!bossMusic) return;
  bossMusic.phase2 = true; bossMusic.tempo = 88;
  const t = bossMusic.ac.currentTime, g = bossMusic.master.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.exponentialRampToValueAtTime(muted ? 0.0001 : 0.33, t + 0.9);
}
function stopBossMusic() {
  if (!bossMusic) return;
  const m = bossMusic;
  bossMusic = null; m.stopped = true; clearInterval(m.timer);
  const t = m.ac.currentTime, g = m.master.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.exponentialRampToValueAtTime(0.0001, t + 0.8);
  setTimeout(() => {
    for (const n of [m.master, m.eq, m.hp, m.lp, m.comp, m.conv, m.wet, m.reverbSend]) {
      try { n.disconnect(); } catch (e) {}
    }
  }, 1000);
  setTimeout(() => { if (G.mode === 'play' && !bossMusic) startMusic(); }, 1100);
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
      g.exponentialRampToValueAtTime(muted ? 0.0001 : (bossMusic.phase2 ? 0.33 : 0.27), t + 0.12);
    }
  }
});

// ============ RENDERER / SCENE ============
const MAX_DPR = 1.35;
let renderScale = 1;
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
let skyMat;
{
  skyMat = new THREE.ShaderMaterial({
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

const hemiLight = new THREE.HemisphereLight(0x7b95aa, 0x1b2016, 0.62);
scene.add(hemiLight);
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

// procedural environment maps so metal armour reflects the world sky instead of going black
let envDuncan = null, envWitch = null, envDragon = null, envFang = null, envDuo = null;
{
  const pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader();
  const makeEnv = (stops, glow) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const x = c.getContext('2d');
    const grd = x.createLinearGradient(0, 0, 0, 256);
    for (const [at, col] of stops) grd.addColorStop(at, col);
    x.fillStyle = grd; x.fillRect(0, 0, 512, 256);
    const fg = x.createLinearGradient(0, 108, 0, 160);
    fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(0.5, glow); fg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = fg; x.fillRect(0, 108, 512, 52);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
    const rt = pmrem.fromEquirectangular(tex);
    tex.dispose();
    return rt.texture;
  };
  envDuncan = makeEnv([[0, '#58666e'], [0.42, '#9dadae'], [0.52, '#c6cec0'], [0.56, '#5e6a42'], [1, '#262c1c']], 'rgba(255,150,60,0.5)');
  envWitch = makeEnv([[0, '#120a30'], [0.38, '#2a1e66'], [0.52, '#4a2a7a'], [0.58, '#3a1028'], [1, '#08040f']], 'rgba(190,40,90,0.5)');
  envDragon = makeEnv([[0, '#160806'], [0.38, '#3c140c'], [0.52, '#7a2a12'], [0.58, '#2a0b06'], [1, '#090302']], 'rgba(255,92,28,0.65)');
  envFang = makeEnv([[0, '#07040d'], [0.38, '#1b1030'], [0.52, '#5c102c'], [0.58, '#1a0510'], [1, '#050207']], 'rgba(255,32,90,0.6)');
  envDuo = makeEnv([[0, '#0b0a08'], [0.38, '#262018'], [0.52, '#6b5834'], [0.58, '#2a1d12'], [1, '#080604']], 'rgba(228,196,112,0.55)');
  scene.environment = envDuncan;
  pmrem.dispose();
}

// ============ WORLD MOODS (Duncan's ashen ring vs Morgana's nightshade hollow) ============
const WORLD_STYLES = {
  duncan: {
    bg: 0x202a2c, fog: 0x3d4844, fogDensity: 0.0112, env: () => envDuncan,
    sky: { zenith: 0x0a1117, mid: 0x2b383c, horizon: 0x746d5b, glow: 0xe0924e },
    hemi: { sky: 0x7b95aa, ground: 0x1b2016, intensity: 0.62 },
    moon: { color: 0xc9dbff, intensity: 1.25 },
    fill: { color: 0xc9d2a8, intensity: 0.48 },
    rim: { color: 0x8bacff, intensity: 1.05 },
    backlight: { color: 0xa8c8e8, intensity: 1.45 },
    arena: { color: 0xffa15c, intensity: 55 },
  },
  witch: {
    bg: 0x080410, fog: 0x1b0e33, fogDensity: 0.042, env: () => envWitch,
    sky: { zenith: 0x03020a, mid: 0x150b33, horizon: 0x3c1a5c, glow: 0x9c2450 },
    hemi: { sky: 0x6f63ff, ground: 0x150a20, intensity: 0.62 },
    moon: { color: 0xb9a6ff, intensity: 1.0 },
    fill: { color: 0x6a7cff, intensity: 0.45 },
    rim: { color: 0xa64dff, intensity: 1.8 },
    backlight: { color: 0x5a3cff, intensity: 1.15 },
    arena: { color: 0x9b5cff, intensity: 0 },
  },
  dragon: {
    bg: 0x120604, fog: 0x2a0d08, fogDensity: 0.036, env: () => envDragon,
    sky: { zenith: 0x050202, mid: 0x2a0c08, horizon: 0x9c3a12, glow: 0xff5a1e },
    hemi: { sky: 0xff7a42, ground: 0x140604, intensity: 0.58 },
    moon: { color: 0xff8a4a, intensity: 0.85 },
    fill: { color: 0xff5a2a, intensity: 0.55 },
    rim: { color: 0xff4218, intensity: 1.8 },
    backlight: { color: 0xffa24a, intensity: 1.35 },
    arena: { color: 0xff5a1e, intensity: 0 },
  },
  fang: {
    bg: 0x07040d, fog: 0x1a0b18, fogDensity: 0.032, env: () => envFang,
    sky: { zenith: 0x020107, mid: 0x160920, horizon: 0x5c102c, glow: 0xff274f },
    hemi: { sky: 0x8b6cff, ground: 0x100812, intensity: 0.55 },
    moon: { color: 0xff8a9a, intensity: 0.75 },
    fill: { color: 0xaa5cff, intensity: 0.5 },
    rim: { color: 0xff2a5e, intensity: 1.9 },
    backlight: { color: 0x7a2cff, intensity: 1.25 },
    arena: { color: 0xff2a5e, intensity: 0 },
  },
  duo: {
    bg: 0x0b0906, fog: 0x1d1810, fogDensity: 0.034, env: () => envDuo,
    sky: { zenith: 0x030202, mid: 0x16110b, horizon: 0x5c4824, glow: 0xe4c470 },
    hemi: { sky: 0xd8c48a, ground: 0x120d08, intensity: 0.58 },
    moon: { color: 0xf0d9a0, intensity: 0.95 },
    fill: { color: 0xc9a85c, intensity: 0.52 },
    rim: { color: 0xffd27a, intensity: 1.7 },
    backlight: { color: 0x8c6a32, intensity: 1.15 },
    arena: { color: 0xe4c470, intensity: 0 },
  },
};
const duncanLights = [];
const dragonLights = [];
const fangLights = [];
const duoLights = [];
function applyWorldStyle(id) {
  const s = WORLD_STYLES[id] || WORLD_STYLES.duncan;
  scene.background = new THREE.Color(s.bg);
  scene.fog = new THREE.FogExp2(s.fog, s.fogDensity);
  scene.environment = s.env();
  if (skyMat) {
    skyMat.uniforms.uZenith.value.setHex(s.sky.zenith).convertSRGBToLinear();
    skyMat.uniforms.uMid.value.setHex(s.sky.mid).convertSRGBToLinear();
    skyMat.uniforms.uHorizon.value.setHex(s.sky.horizon).convertSRGBToLinear();
    skyMat.uniforms.uGlow.value.setHex(s.sky.glow).convertSRGBToLinear();
  }
  hemiLight.color.setHex(s.hemi.sky); hemiLight.groundColor.setHex(s.hemi.ground);
  hemiLight.intensity = s.hemi.intensity;
  moon.color.setHex(s.moon.color); moon.intensity = s.moon.intensity;
  fill.color.setHex(s.fill.color); fill.intensity = s.fill.intensity;
  rim.color.setHex(s.rim.color); rim.intensity = s.rim.intensity;
  backlight.color.setHex(s.backlight.color); backlight.intensity = s.backlight.intensity;
  arenaLight.color.setHex(s.arena.color); arenaLight.intensity = s.arena.intensity;
  const duncanWorld = id === 'duncan';
  warm.intensity = duncanWorld ? 30 : 0;
  warm.visible = duncanWorld;
  arenaLight.visible = duncanWorld;
  fogGate.visible = duncanWorld;
  for (const l of duncanLights) l.visible = duncanWorld;
  for (const l of dragonLights) l.visible = id === 'dragon';
  for (const l of fangLights) l.visible = id === 'fang';
  for (const l of duoLights) l.visible = id === 'duo';
}
function flashWorldSwap() {
  if (!worldFade) return;
  worldFade.style.transition = 'none';
  worldFade.style.opacity = '1';
  requestAnimationFrame(() => {
    worldFade.style.transition = 'opacity .5s';
    worldFade.style.opacity = '0';
  });
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
  type: THREE.HalfFloatType, samples: 0,
}));
composer.setPixelRatio(Math.min(devicePixelRatio, MAX_DPR));
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.62, 0.62, 0.74);
composer.addPass(bloomPass);
const gradePass = new ShaderPass(GradeShader);
composer.addPass(gradePass);
composer.addPass(new OutputPass());
const fxaaPass = new ShaderPass(FXAAShader);
function setFXAAResolution(pr) {
  const w = Math.max(1, innerWidth * pr), h = Math.max(1, innerHeight * pr);
  fxaaPass.material.uniforms.resolution.value.set(1 / w, 1 / h);
}
setFXAAResolution(Math.min(devicePixelRatio, MAX_DPR));
composer.addPass(fxaaPass);
addEventListener('resize', () => {
  const pr = Math.min(devicePixelRatio, MAX_DPR) * renderScale;
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(pr);
  composer.setSize(innerWidth, innerHeight);
  gradePass.uniforms.uResolution.value.set(innerWidth, innerHeight);
  bloomPass.resolution.set(innerWidth, innerHeight);
  setFXAAResolution(pr);
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
const WITCH_R = 16;
const WITCH_CENTER = new THREE.Vector3(0, 0, -82);
const DRAGON_R = 17;
const DRAGON_CENTER = new THREE.Vector3(0, 0, -168);
const DRAGON_BASE_SCALE = 0.74;
const FANG_R = 18;
const FANG_CENTER = new THREE.Vector3(0, 0, -254);
const FANG_BASE_SCALE = 1.42;
const DUO_R = 19;
const DUO_CENTER = new THREE.Vector3(0, 0, -340);
const DUO_A_BASE_SCALE = 1.30;
const DUO_B_BASE_SCALE = 1.55;
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
fireGlowTex.generateMipmaps = false;
fireGlowTex.minFilter = THREE.LinearFilter;

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
  duncanLights.push(li);
}

// mist gate (entry to the ring)
const fogGate = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.4),
  new THREE.MeshBasicMaterial({ map: mistTex, color: 0xe6eee2, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
fogGate.position.set(0, 2.2, ARENA_R - 3.4); scene.add(fogGate);

// bonfire on the grass
const bonfirePos = new THREE.Vector3(0, 0, 26);
groundBlob(bonfirePos.x, bonfirePos.z, 4.2, 0.4);
const smokeSprites = [];
let bonfireLight = null;
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
  bonfireLight = new THREE.PointLight(0xff8b3c, 22, 16, 1.9); bonfireLight.position.set(bonfirePos.x, 1.4, bonfirePos.z); scene.add(bonfireLight); duncanLights.push(bonfireLight);
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
  altarLight.position.set(0, 1.7, 0.4); altar.add(altarLight); duncanLights.push(altarLight);
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

// ============ THE NIGHTSHADE HOLLOW (witch arena) ============
const witchStonePos = new THREE.Vector3(WITCH_CENTER.x, 0, WITCH_CENTER.z - 10.5);
const dragonStonePos = new THREE.Vector3(DRAGON_CENTER.x, 0, DRAGON_CENTER.z - 11.5);
let witchCrystal, witchCrystalMat, witchCrystalGlow, witchLight;
let witchMoonCore = null, witchMoonGlow = null;
const witchFlames = [];
const hexFlameOuterMat = new THREE.SpriteMaterial({
  map: flameTex, color: 0x9b5cff, transparent: true, opacity: 0.58,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
});
const hexFlameCoreMat = new THREE.SpriteMaterial({
  map: flameTex, color: 0xe6d2ff, transparent: true, opacity: 0.82,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
});
const hexEmberMat = new THREE.SpriteMaterial({ map: fireGlowTex, color: 0x8f5cff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
const eclipseFlameOuterMat = new THREE.SpriteMaterial({ map: flameTex, color: 0xff2a5e, transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
const eclipseFlameCoreMat = new THREE.SpriteMaterial({ map: flameTex, color: 0xffd6e8, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
const eclipseEmberMat = new THREE.SpriteMaterial({ map: fireGlowTex, color: 0x9b1fff, transparent: true, opacity: 0.36, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
const lunarFlameOuterMat = new THREE.SpriteMaterial({ map: flameTex, color: 0x9ec4ff, transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
const lunarFlameCoreMat = new THREE.SpriteMaterial({ map: flameTex, color: 0xfff2dd, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
const lunarEmberMat = new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xcddfff, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
const witchArenaGroup = new THREE.Group();
witchArenaGroup.name = 'witch-arena';
scene.add(witchArenaGroup);
function hexFlameAt(x, z, h, r, withGlow = false) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z);
  const seed = Math.random() * 100;
  const outer = new THREE.Sprite(hexFlameOuterMat);
  outer.scale.set(r * 2.9, h * 1.5, 1); outer.position.y = h * 0.62; grp.add(outer);
  const core = new THREE.Sprite(hexFlameCoreMat);
  core.scale.set(r * 1.35, h * 0.95, 1); core.position.y = h * 0.50; grp.add(core);
  const sprites = [outer, core];
  if (withGlow) {
    const glow = new THREE.Sprite(hexEmberMat);
    glow.scale.setScalar(r * 7.5); glow.position.y = h * 0.22; grp.add(glow); sprites.push(glow);
  }
  grp.userData = { sprites, w: r, h, seed };
  witchFlames.push(grp);
  witchArenaGroup.add(grp);
  return grp;
}
{
  const C = WITCH_CENTER;
  const witchGroundMat = new THREE.MeshStandardMaterial({
    map: dirtTex, color: 0x4a3a5e, roughness: 1, transparent: true, opacity: 0.9,
    alphaMap: arenaFadeTex, depthWrite: false,
    normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.8, 0.8),
  });
  const witchTrampled = new THREE.Mesh(new THREE.CircleGeometry(WITCH_R + 1.6, 72), witchGroundMat);
  witchTrampled.rotation.x = -Math.PI / 2; witchTrampled.position.set(C.x, 0.007, C.z); witchTrampled.receiveShadow = true; witchArenaGroup.add(witchTrampled);

  const witchScorch = new THREE.Mesh(new THREE.RingGeometry(WITCH_R - 1.3, WITCH_R + 1.7, 96),
    new THREE.MeshStandardMaterial({ color: 0x140d20, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }));
  witchScorch.rotation.x = -Math.PI / 2; witchScorch.position.set(C.x, 0.013, C.z); witchArenaGroup.add(witchScorch);

  const runeMat = new THREE.MeshBasicMaterial({ color: 0x9b5cff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const [rad, wdt, op] of [[3.15, 0.055, 0.55], [4.4, 0.035, 0.4], [7.8, 0.05, 0.3], [12.2, 0.04, 0.24]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(rad - wdt, rad + wdt, 72), runeMat.clone());
    ring.material.opacity = op; ring.rotation.x = -Math.PI / 2; ring.position.set(C.x, 0.02, C.z); witchArenaGroup.add(ring);
  }
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2;
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.5 + Math.random() * 0.45), runeMat);
    rune.position.set(C.x + Math.cos(a) * (4.4 + Math.random() * 0.7), 0.021, C.z + Math.sin(a) * (4.4 + Math.random() * 0.7));
    rune.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2 + (Math.random() - 0.5) * 0.3); witchArenaGroup.add(rune);
  }

  // black stone dais and the suspended heart-crystal
  const daisStone = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x413550, roughness: 0.92, metalness: 0.08, normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.8, 0.8) });
  const daisDark = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x1d1626, roughness: 0.85, metalness: 0.12, normalMap: groundNormalTex });
  const DS = witchStonePos;
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.75, 0.34, 8), daisDark);
  dais.position.set(DS.x, 0.17, DS.z); dais.castShadow = dais.receiveShadow = true; witchArenaGroup.add(dais);
  const daisTop = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.32, 0.16, 8), daisStone);
  daisTop.position.set(DS.x, 0.4, DS.z); daisTop.castShadow = true; witchArenaGroup.add(daisTop);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + 0.2;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9 + Math.random() * 0.7, 5), daisStone);
    shard.position.set(DS.x + Math.cos(a) * 1.32, 0.6, DS.z + Math.sin(a) * 1.32);
    shard.rotation.z = (Math.random() - 0.5) * 0.25; shard.castShadow = true; witchArenaGroup.add(shard);
  }
  witchCrystalMat = new THREE.MeshStandardMaterial({ color: 0xd9b7ff, emissive: 0x7b3aff, emissiveIntensity: 2.6, metalness: 0.25, roughness: 0.15 });
  witchCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), witchCrystalMat);
  witchCrystal.scale.set(0.8, 1.75, 0.8); witchCrystal.position.set(DS.x, 2.35, DS.z); witchArenaGroup.add(witchCrystal);
  const crystalRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.035, 8, 40), runeMat.clone());
  crystalRing.material.opacity = 0.6; crystalRing.position.set(DS.x, 2.35, DS.z); witchArenaGroup.add(crystalRing);
  witchCrystalGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0x9b5cff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  witchCrystalGlow.scale.setScalar(4.4); witchCrystalGlow.position.set(DS.x, 2.35, DS.z); witchArenaGroup.add(witchCrystalGlow);
  witchLight = new THREE.PointLight(0x9b5cff, 46, 52, 1.7); witchLight.position.set(C.x, 7.5, C.z); witchArenaGroup.add(witchLight);

  // witchfire boundary
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2;
    let d = a - GATE_ANGLE; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < 0.2) continue;
    const rr = WITCH_R + 0.15 + (Math.random() - 0.5) * 1.2;
    hexFlameAt(C.x + Math.cos(a) * rr, C.z + Math.sin(a) * rr, 1.0 + Math.random() * 2.2, 0.3 + Math.random() * 0.42);
  }
  const hexBand = new THREE.Mesh(new THREE.TorusGeometry(WITCH_R + 0.25, 0.35, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0x8f5cff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  hexBand.rotation.x = Math.PI / 2; hexBand.position.set(C.x, 0.3, C.z); witchArenaGroup.add(hexBand);
  const hexHalo = new THREE.Mesh(new THREE.PlaneGeometry(84, 84), new THREE.MeshBasicMaterial({
    map: fireHaloTex, color: 0x9b5cff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  }));
  hexHalo.rotation.x = -Math.PI / 2; hexHalo.position.set(C.x, 0.022, C.z); hexHalo.renderOrder = 2; witchArenaGroup.add(hexHalo);

  // rune-carved obelisks and candles encircling the hollow
  const obeliskMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x3a3048, roughness: 0.95, normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.9, 0.9) });
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2 + 0.18;
    if (Math.abs(angDiff(a, GATE_ANGLE)) < 0.3) continue;
    const h = 2.8 + Math.random() * 3.2, rad = 0.34 + Math.random() * 0.36;
    const ob = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.68, rad, h, 6, 3), obeliskMat);
    const rr = 20.5 + Math.random() * 5.5;
    ob.position.set(C.x + Math.cos(a) * rr, h / 2 - 0.12, C.z + Math.sin(a) * rr);
    ob.rotation.set((Math.random() - 0.5) * 0.1, Math.random() * Math.PI, (Math.random() - 0.5) * 0.12);
    ob.castShadow = ob.receiveShadow = true; witchArenaGroup.add(ob);
    const glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.75), runeMat.clone());
    glyph.material.opacity = 0.4; glyph.position.set(ob.position.x, 1.1, ob.position.z + 0.02);
    glyph.rotation.y = -a + Math.PI / 2; witchArenaGroup.add(glyph);
  }
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + 0.5, rr = 10.5 + Math.random() * 1.6;
    const x = C.x + Math.cos(a) * rr, z = C.z + Math.sin(a) * rr;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.22, 0.34, 8), daisDark);
    bowl.position.set(x, 0.17, z); bowl.castShadow = true; witchArenaGroup.add(bowl);
    hexFlameAt(x, z, 0.72 + Math.random() * 0.3, 0.16 + Math.random() * 0.08, true);
  }

  // the veil gate on the southern edge
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.4),
    new THREE.MeshBasicMaterial({ map: mistTex, color: 0xb08cff, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }));
  veil.position.set(C.x, 2.2, C.z + WITCH_R - 3.4); witchArenaGroup.add(veil);

  witchArenaGroup.add(groundBlob(C.x, C.z, 4.4, 0.42));
}

witchArenaGroup.visible = false;

// ============ THE NIGHTSHADE HOLLOW — A WORLD UNTO ITSELF ============
// Morgana's arena is wrapped in its own violet forest so the ashen ring is nowhere in sight.
const witchWorldGroup = new THREE.Group();
witchWorldGroup.name = 'witch-world';
scene.add(witchWorldGroup);
const witchMotes = [];
{
  const C = WITCH_CENTER;
  const witchGroundTex = canvasTex(512, (x, s) => {
    x.fillStyle = '#241640'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 150; i++) {
      const g = x.createRadialGradient(Math.random() * s, Math.random() * s, 2, Math.random() * s, Math.random() * s, 24 + Math.random() * 110);
      const palette = ['rgba(38,54,128,0.20)', 'rgba(96,44,150,0.20)', 'rgba(112,16,44,0.16)', 'rgba(22,28,84,0.24)', 'rgba(64,24,100,0.18)'];
      g.addColorStop(0, palette[Math.random() * palette.length | 0]);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, s, s);
    }
    for (let i = 0; i < 24000; i++) {
      const gx = Math.random() * s, gy = Math.random() * s, len = 2 + Math.random() * 9;
      const blue = Math.random() < 0.52;
      x.strokeStyle = blue
        ? `rgba(${28 + Math.random() * 34 | 0},${42 + Math.random() * 38 | 0},${92 + Math.random() * 70 | 0},${0.22 + Math.random() * 0.34})`
        : `rgba(${62 + Math.random() * 48 | 0},${24 + Math.random() * 34 | 0},${92 + Math.random() * 60 | 0},${0.22 + Math.random() * 0.34})`;
      x.lineWidth = 0.7 + Math.random() * 1.4;
      x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + (Math.random() - 0.5) * 3.2, gy - len); x.stroke();
    }
    // dark red roots and spores bleeding through the violet soil
    for (let i = 0; i < 90; i++) {
      x.strokeStyle = `rgba(${74 + Math.random() * 54 | 0},${6 + Math.random() * 16 | 0},${22 + Math.random() * 24 | 0},${0.18 + Math.random() * 0.28})`;
      x.lineWidth = 0.8 + Math.random() * 2.2;
      const sx = Math.random() * s, sy = Math.random() * s;
      x.beginPath(); x.moveTo(sx, sy);
      for (let k = 0; k < 4; k++) x.lineTo(sx + (Math.random() - 0.5) * 70, sy + (Math.random() - 0.5) * 70);
      x.stroke();
    }
    for (let i = 0; i < 420; i++) {
      x.fillStyle = `rgba(${120 + Math.random() * 90 | 0},${40 + Math.random() * 60 | 0},${180 + Math.random() * 70 | 0},${0.1 + Math.random() * 0.2})`;
      x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 0.7 + Math.random() * 2.2, 0, 6.283); x.fill();
    }
  }, 26);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(250, 250), new THREE.MeshStandardMaterial({
    map: witchGroundTex, color: 0xffffff, roughness: 0.98, metalness: 0.02,
    normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.9, 0.9),
  }));
  floor.name = 'nightshade-floor';
  floor.rotation.x = -Math.PI / 2; floor.position.set(C.x, 0.004, C.z); floor.receiveShadow = true;
  witchWorldGroup.add(floor);

  // violet-blue forest ringing the hollow; every ninth tree carries the dark red bloom
  const trees = [];
  for (let i = 0; i < 64; i++) {
    let a = i / 64 * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
    if (Math.abs(angDiff(a, GATE_ANGLE)) < 0.28) a += 0.36;
    trees.push({
      a, r: 18.5 + Math.random() * 30, h: 5 + Math.random() * 6,
      lean: (Math.random() - 0.5) * 0.1, red: i % 9 === 4, seed: Math.random() * 100,
    });
  }
  const dummy = new THREE.Object3D();
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.46, 1, 6, 3);
  {
    const p = trunkGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.82 + hash2i(i * 7 + 3, 5) * 0.36;
      p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
    }
    trunkGeo.computeVertexNormals();
  }
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1a1028, roughness: 1, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  trees.forEach((tr, i) => {
    const x = C.x + Math.cos(tr.a) * tr.r, z = C.z + Math.sin(tr.a) * tr.r;
    dummy.position.set(x, tr.h / 2 - 0.08, z);
    dummy.rotation.set(tr.lean, tr.seed, tr.lean * 0.7);
    dummy.scale.set(0.9 + tr.h * 0.04, tr.h, 0.9 + tr.h * 0.04);
    dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
  });
  trunks.instanceMatrix.needsUpdate = true; trunks.castShadow = true; trunks.receiveShadow = true;
  witchWorldGroup.add(trunks);

  const foliageGeo = new THREE.IcosahedronGeometry(1, 1);
  {
    const p = foliageGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.82 + hash2i(i * 13 + 7, 9) * 0.34;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * (0.75 + k * 0.3), p.getZ(i) * k);
    }
    foliageGeo.computeVertexNormals();
  }
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.9, metalness: 0.02, flatShading: true,
    emissive: 0x24104a, emissiveIntensity: 1.0,
  });
  const blossoms = new THREE.InstancedMesh(foliageGeo, foliageMat, trees.length * 3);
  const bluePalette = [0x4b3cff, 0x5a5cff, 0x3958e8, 0x7a4dff, 0x2f3fc8];
  const redPalette = [0x8e1230, 0xa8183a, 0x6a0a22];
  const tint = new THREE.Color();
  let bi = 0;
  trees.forEach(tr => {
    const x = C.x + Math.cos(tr.a) * tr.r, z = C.z + Math.sin(tr.a) * tr.r;
    for (let k = 0; k < 3; k++) {
      const ang = tr.seed + k * 2.1;
      const off = k === 0 ? 0.4 : 1.2 + Math.random() * 1.2;
      const rad = (2.0 + Math.random() * 1.5) * (0.75 + tr.h * 0.04);
      dummy.position.set(x + Math.cos(ang) * off, tr.h * (0.62 + k * 0.16) + (Math.random() - 0.5) * 0.5, z + Math.sin(ang) * off);
      dummy.rotation.set(Math.random() * 0.6, Math.random() * Math.PI * 2, Math.random() * 0.6);
      dummy.scale.set(rad * (0.8 + Math.random() * 0.4), rad * (0.7 + Math.random() * 0.4), rad * (0.8 + Math.random() * 0.4));
      dummy.updateMatrix(); blossoms.setMatrixAt(bi, dummy.matrix);
      tint.setHex(tr.red ? redPalette[k % redPalette.length] : bluePalette[(bi + k) % bluePalette.length]);
      blossoms.setColorAt(bi, tint); bi++;
    }
  });
  blossoms.instanceMatrix.needsUpdate = true; blossoms.instanceColor.needsUpdate = true;
  blossoms.castShadow = true; witchWorldGroup.add(blossoms);

  // dark red shards sprouting just beyond the witchfire boundary
  const crystalGeo = new THREE.OctahedronGeometry(0.6, 0);
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x5e0a1c, emissive: 0xc21a3c, emissiveIntensity: 1.6,
    roughness: 0.3, metalness: 0.15, flatShading: true,
  });
  const crystalCount = 52;
  const crystals = new THREE.InstancedMesh(crystalGeo, crystalMat, crystalCount);
  for (let i = 0; i < crystalCount; i++) {
    let a = Math.random() * Math.PI * 2;
    if (Math.abs(angDiff(a, GATE_ANGLE)) < 0.18) a += 0.32;
    const rr = WITCH_R + 1.6 + Math.random() * 9;
    const sc = 0.35 + Math.random() * 1.25;
    dummy.position.set(C.x + Math.cos(a) * rr, sc * 0.55, C.z + Math.sin(a) * rr);
    dummy.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5);
    dummy.scale.set(sc, sc * (1.4 + Math.random() * 1.8), sc);
    dummy.updateMatrix(); crystals.setMatrixAt(i, dummy.matrix);
  }
  crystals.instanceMatrix.needsUpdate = true; witchWorldGroup.add(crystals);

  // blue glow-caps and crimson lamps tucked into the roots
  const shroomGeo = new THREE.ConeGeometry(0.22, 0.65, 6);
  const shroomMat = new THREE.MeshStandardMaterial({ color: 0x8ab8ff, emissive: 0x3a68ff, emissiveIntensity: 1.4, roughness: 0.5 });
  const shrooms = new THREE.InstancedMesh(shroomGeo, shroomMat, 70);
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = WITCH_R + 2.2 + Math.random() * 15;
    const sc = 0.5 + Math.random() * 1.2;
    dummy.position.set(C.x + Math.cos(a) * rr, 0.3 * sc, C.z + Math.sin(a) * rr);
    dummy.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.25);
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix(); shrooms.setMatrixAt(i, dummy.matrix);
  }
  shrooms.instanceMatrix.needsUpdate = true; witchWorldGroup.add(shrooms);

  for (let i = 0; i < 2; i++) {
    const a = i / 2 * Math.PI * 2 + 0.9, rr = WITCH_R + 4 + Math.random() * 6;
    const li = new THREE.PointLight(0xb01838, 16, 20, 2);
    li.position.set(C.x + Math.cos(a) * rr, 1.6 + Math.random() * 1.4, C.z + Math.sin(a) * rr);
    witchWorldGroup.add(li);
  }

  // a crimson moon hanging beyond the canopy
  witchMoonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: fireGlowTex, color: 0xb02852, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  witchMoonGlow.scale.setScalar(34); witchMoonGlow.position.set(C.x - 46, 44, C.z - 72);
  witchWorldGroup.add(witchMoonGlow);
  witchMoonCore = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), new THREE.MeshBasicMaterial({
    color: 0xd94870, transparent: true, opacity: 0.85, fog: false,
  }));
  witchMoonCore.position.set(C.x - 46, 44, C.z - 72); witchMoonCore.lookAt(C.x, 2, C.z);
  witchWorldGroup.add(witchMoonCore);

  // drifting hex-motes
  const moteMats = [0x9b7cff, 0x4a6cff, 0xc02048].map(c => new THREE.SpriteMaterial({
    map: fireGlowTex, color: c, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  }));
  for (let i = 0; i < 34; i++) {
    const sp = new THREE.Sprite(moteMats[i % 3]);
    const a = Math.random() * Math.PI * 2, rr = 4 + Math.random() * 30;
    sp.position.set(C.x + Math.cos(a) * rr, 0.4 + Math.random() * 5, C.z + Math.sin(a) * rr);
    sp.scale.setScalar(0.18 + Math.random() * 0.3);
    sp.userData = { a, rr, y: sp.position.y, speed: 0.04 + Math.random() * 0.12, bob: Math.random() * 6.28 };
    witchMotes.push(sp); witchWorldGroup.add(sp);
  }
}

// ============ THE CALDERA (Vytles' arena) ============
const dragonStonePos2 = dragonStonePos;
const dragonFlames = [];
const dragonFlameOuterMat = new THREE.SpriteMaterial({
  map: flameTex, color: 0xff5a18, transparent: true, opacity: 0.6,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
});
const dragonFlameCoreMat = new THREE.SpriteMaterial({
  map: flameTex, color: 0xffd27a, transparent: true, opacity: 0.86,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
});
const dragonEmberMat = new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff6a22, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
const dragonArenaGroup = new THREE.Group();
dragonArenaGroup.name = 'dragon-arena';
scene.add(dragonArenaGroup);
function dragonFlameAt(x, z, h, r, withGlow = false) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z);
  const seed = Math.random() * 100;
  const outer = new THREE.Sprite(dragonFlameOuterMat);
  outer.scale.set(r * 2.9, h * 1.5, 1); outer.position.y = h * 0.62; grp.add(outer);
  const core = new THREE.Sprite(dragonFlameCoreMat);
  core.scale.set(r * 1.35, h * 0.95, 1); core.position.y = h * 0.50; grp.add(core);
  const sprites = [outer, core];
  if (withGlow) {
    const glow = new THREE.Sprite(dragonEmberMat);
    glow.scale.setScalar(r * 7.5); glow.position.y = h * 0.22; grp.add(glow); sprites.push(glow);
  }
  grp.userData = { sprites, w: r, h, seed };
  dragonFlames.push(grp);
  dragonArenaGroup.add(grp);
  return grp;
}
let dragonStone = null, dragonStoneMat = null, dragonStoneGlow = null;
{
  const C = DRAGON_CENTER;
  const groundMat = new THREE.MeshStandardMaterial({
    map: dirtTex, color: 0x4a1d10, roughness: 1, transparent: true, opacity: 0.94,
    alphaMap: arenaFadeTex, depthWrite: false,
    normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.9, 0.9),
  });
  const trampled = new THREE.Mesh(new THREE.CircleGeometry(DRAGON_R + 1.8, 72), groundMat);
  trampled.rotation.x = -Math.PI / 2; trampled.position.set(C.x, 0.008, C.z); trampled.receiveShadow = true; dragonArenaGroup.add(trampled);

  const scorch = new THREE.Mesh(new THREE.RingGeometry(DRAGON_R - 1.6, DRAGON_R + 1.8, 96),
    new THREE.MeshStandardMaterial({ color: 0x120504, roughness: 1, transparent: true, opacity: 0.68, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2; scorch.position.set(C.x, 0.014, C.z); dragonArenaGroup.add(scorch);

  // molten rings and radial cracks
  const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff5a16, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const [rad, wdt, op] of [[3.4, 0.07, 0.55], [5.2, 0.045, 0.4], [8.6, 0.06, 0.3], [13.4, 0.04, 0.25]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(rad - wdt, rad + wdt, 72), lavaMat.clone());
    ring.material.opacity = op; ring.rotation.x = -Math.PI / 2; ring.position.set(C.x, 0.02, C.z); dragonArenaGroup.add(ring);
  }
  const crackGeo = new THREE.BoxGeometry(0.07, 0.012, 1);
  const crackMat = new THREE.MeshBasicMaterial({ color: 0xff6a1e, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false });
  const cracks = new THREE.InstancedMesh(crackGeo, crackMat, 30);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = 3.2 + Math.random() * (DRAGON_R - 4.2);
    const len = 1.2 + Math.random() * 4.8;
    dummy.position.set(C.x + Math.cos(a) * rr, 0.025, C.z + Math.sin(a) * rr);
    dummy.rotation.set(0, -a + Math.PI / 2, 0);
    dummy.scale.set(1, 1, len);
    dummy.updateMatrix(); cracks.setMatrixAt(i, dummy.matrix);
  }
  cracks.instanceMatrix.needsUpdate = true; dragonArenaGroup.add(cracks);

  // black stone dais holding the dragon's ember
  const daisStone = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x3a1c14, roughness: 0.94, metalness: 0.08, normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.8, 0.8) });
  const daisDark = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x170a07, roughness: 0.9, metalness: 0.15, normalMap: groundNormalTex });
  const DS = dragonStonePos2;
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.36, 8), daisDark);
  dais.position.set(DS.x, 0.18, DS.z); dais.castShadow = dais.receiveShadow = true; dragonArenaGroup.add(dais);
  const daisTop = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.4, 0.18, 8), daisStone);
  daisTop.position.set(DS.x, 0.43, DS.z); daisTop.castShadow = true; dragonArenaGroup.add(daisTop);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + 0.25;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.0 + Math.random() * 0.8, 5), daisStone);
    shard.position.set(DS.x + Math.cos(a) * 1.42, 0.66, DS.z + Math.sin(a) * 1.42);
    shard.rotation.z = (Math.random() - 0.5) * 0.28; shard.castShadow = true; dragonArenaGroup.add(shard);
  }
  dragonStoneMat = new THREE.MeshStandardMaterial({ color: 0xffb36a, emissive: 0xff4a12, emissiveIntensity: 2.8, metalness: 0.3, roughness: 0.18 });
  dragonStone = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), dragonStoneMat);
  dragonStone.scale.set(0.8, 1.9, 0.8); dragonStone.position.set(DS.x, 2.45, DS.z); dragonArenaGroup.add(dragonStone);
  const stoneRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.035, 8, 40), lavaMat.clone());
  stoneRing.material.opacity = 0.6; stoneRing.position.set(DS.x, 2.45, DS.z); dragonArenaGroup.add(stoneRing);
  dragonStoneGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff6a22, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  dragonStoneGlow.scale.setScalar(4.8); dragonStoneGlow.position.set(DS.x, 2.45, DS.z); dragonArenaGroup.add(dragonStoneGlow);

  // the dragonfire boundary
  for (let i = 0; i < 46; i++) {
    const a = i / 46 * Math.PI * 2;
    let d = a - GATE_ANGLE; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < 0.2) continue;
    const rr = DRAGON_R + 0.15 + (Math.random() - 0.5) * 1.3;
    dragonFlameAt(C.x + Math.cos(a) * rr, C.z + Math.sin(a) * rr, 1.2 + Math.random() * 2.4, 0.32 + Math.random() * 0.44);
  }
  const band = new THREE.Mesh(new THREE.TorusGeometry(DRAGON_R + 0.25, 0.38, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0xff4a12, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  band.rotation.x = Math.PI / 2; band.position.set(C.x, 0.3, C.z); dragonArenaGroup.add(band);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(88, 88), new THREE.MeshBasicMaterial({
    map: fireHaloTex, color: 0xff4a12, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  }));
  halo.rotation.x = -Math.PI / 2; halo.position.set(C.x, 0.022, C.z); halo.renderOrder = 2; dragonArenaGroup.add(halo);

  // obsidian spires around the caldera
  const spireGeo = new THREE.ConeGeometry(0.6, 1, 5);
  const spireMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x24100b, roughness: 0.92, metalness: 0.1, flatShading: true, normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.9, 0.9) });
  const spires = new THREE.InstancedMesh(spireGeo, spireMat, 20);
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2 + 0.18;
    if (Math.abs(angDiff(a, GATE_ANGLE)) < 0.26) continue;
    const h = 3.8 + Math.random() * 6.5;
    const rr = 21.5 + Math.random() * 6.5;
    dummy.position.set(C.x + Math.cos(a) * rr, h / 2 - 0.2, C.z + Math.sin(a) * rr);
    dummy.rotation.set((Math.random() - 0.5) * 0.18, Math.random() * Math.PI, (Math.random() - 0.5) * 0.16);
    dummy.scale.set(0.8 + Math.random() * 1.2, h, 0.8 + Math.random() * 1.2);
    dummy.updateMatrix(); spires.setMatrixAt(i, dummy.matrix);
  }
  spires.instanceMatrix.needsUpdate = true; spires.castShadow = spires.receiveShadow = true; dragonArenaGroup.add(spires);

  // glowing magma braziers
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + 0.4, rr = 11.2 + Math.random() * 1.4;
    const x = C.x + Math.cos(a) * rr, z = C.z + Math.sin(a) * rr;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.26, 0.36, 8), daisDark);
    bowl.position.set(x, 0.18, z); bowl.castShadow = true; dragonArenaGroup.add(bowl);
    dragonFlameAt(x, z, 0.9 + Math.random() * 0.4, 0.18 + Math.random() * 0.08, true);
  }

  const veil = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.4),
    new THREE.MeshBasicMaterial({ map: mistTex, color: 0xff8a52, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }));
  veil.position.set(C.x, 2.2, C.z + DRAGON_R - 3.4); dragonArenaGroup.add(veil);

}
dragonArenaGroup.visible = false;

// The caldera is wrapped in its own burning world.
const dragonWorldGroup = new THREE.Group();
dragonWorldGroup.name = 'dragon-world';
scene.add(dragonWorldGroup);
const dragonMotes = [];
{
  const C = DRAGON_CENTER;
  const floorTex = canvasTex(512, (x, s) => {
    x.fillStyle = '#1a0b07'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 140; i++) {
      const g = x.createRadialGradient(Math.random() * s, Math.random() * s, 2, Math.random() * s, Math.random() * s, 24 + Math.random() * 110);
      const pal = ['rgba(92,28,12,0.22)', 'rgba(32,12,8,0.26)', 'rgba(140,48,14,0.16)', 'rgba(12,6,4,0.3)', 'rgba(210,74,20,0.10)'];
      g.addColorStop(0, pal[Math.random() * pal.length | 0]); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, s, s);
    }
    for (let i = 0; i < 22000; i++) {
      const gx = Math.random() * s, gy = Math.random() * s, len = 2 + Math.random() * 10;
      x.strokeStyle = `rgba(${28 + Math.random() * 34 | 0},${14 + Math.random() * 18 | 0},${8 + Math.random() * 14 | 0},${0.22 + Math.random() * 0.34})`;
      x.lineWidth = 0.7 + Math.random() * 1.4;
      x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + (Math.random() - 0.5) * 3.2, gy - len); x.stroke();
    }
    for (let i = 0; i < 70; i++) {
      x.strokeStyle = `rgba(${160 + Math.random() * 80 | 0},${42 + Math.random() * 40 | 0},${8 + Math.random() * 16 | 0},${0.12 + Math.random() * 0.28})`;
      x.lineWidth = 1 + Math.random() * 2.4;
      const sx = Math.random() * s, sy = Math.random() * s;
      x.beginPath(); x.moveTo(sx, sy);
      for (let k = 0; k < 4; k++) x.lineTo(sx + (Math.random() - 0.5) * 80, sy + (Math.random() - 0.5) * 80);
      x.stroke();
    }
  }, 26);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({
    map: floorTex, color: 0xffffff, roughness: 0.99, metalness: 0.01,
    normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.9, 0.9),
  }));
  floor.name = 'caldera-floor';
  floor.rotation.x = -Math.PI / 2; floor.position.set(C.x, 0.004, C.z); floor.receiveShadow = true;
  dragonWorldGroup.add(floor);

  // jagged volcanic mountains ringing the caldera
  const mountainGeo = new THREE.ConeGeometry(1, 1, 5);
  const mountainMat = new THREE.MeshStandardMaterial({ color: 0x160907, roughness: 0.96, metalness: 0.04, flatShading: true });
  const mountains = new THREE.InstancedMesh(mountainGeo, mountainMat, 34);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 34; i++) {
    const a = i / 34 * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
    const rr = 34 + Math.random() * 52;
    const h = 12 + Math.random() * 26;
    dummy.position.set(C.x + Math.cos(a) * rr, h / 2 - 1, C.z + Math.sin(a) * rr);
    dummy.rotation.set((Math.random() - 0.5) * 0.12, Math.random() * Math.PI, (Math.random() - 0.5) * 0.12);
    dummy.scale.set(5 + Math.random() * 9, h, 5 + Math.random() * 9);
    dummy.updateMatrix(); mountains.setMatrixAt(i, dummy.matrix);
  }
  mountains.instanceMatrix.needsUpdate = true; mountains.castShadow = true; dragonWorldGroup.add(mountains);

  // rivers of fire snaking through the outer waste
  const lavaGeo = new THREE.PlaneGeometry(1, 1);
  const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff4a12, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const rivers = new THREE.InstancedMesh(lavaGeo, lavaMat, 16);
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = DRAGON_R + 5 + Math.random() * 28;
    dummy.position.set(C.x + Math.cos(a) * rr, 0.02, C.z + Math.sin(a) * rr);
    dummy.rotation.set(-Math.PI / 2, 0, a + (Math.random() - 0.5) * 0.8);
    dummy.scale.set(0.4 + Math.random() * 1.2, 8 + Math.random() * 24, 1);
    dummy.updateMatrix(); rivers.setMatrixAt(i, dummy.matrix);
  }
  rivers.instanceMatrix.needsUpdate = true; dragonWorldGroup.add(rivers);

  // drifting embers
  const moteMats = [0xff5a1e, 0xffb052, 0xff2a08].map(c => new THREE.SpriteMaterial({
    map: fireGlowTex, color: c, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  }));
  for (let i = 0; i < 26; i++) {
    const sp = new THREE.Sprite(moteMats[i % 3]);
    const a = Math.random() * Math.PI * 2, rr = 4 + Math.random() * 30;
    sp.position.set(C.x + Math.cos(a) * rr, 0.5 + Math.random() * 7, C.z + Math.sin(a) * rr);
    sp.scale.setScalar(0.2 + Math.random() * 0.36);
    sp.userData = { a, rr, y: sp.position.y, speed: 0.05 + Math.random() * 0.14, bob: Math.random() * 6.28 };
    dragonMotes.push(sp); dragonWorldGroup.add(sp);
  }

  const li = new THREE.PointLight(0xff5a1e, 70, 60, 1.65); li.position.set(C.x, 8, C.z);
  dragonWorldGroup.add(li); dragonLights.push(li);
}
dragonWorldGroup.visible = false;

// ============ THE MOONLESS COURT (Korvath arena + eclipse world) ============
const fangStonePos = new THREE.Vector3(FANG_CENTER.x, 0, FANG_CENTER.z - 11.5);
let fangStone, fangStoneMat, fangStoneGlow, fangLight;
const fangArenaGroup = new THREE.Group();
fangArenaGroup.name = 'fang-arena';
scene.add(fangArenaGroup);
{
  const C = FANG_CENTER;
  const courtMat = new THREE.MeshStandardMaterial({
    map: dirtTex, color: 0x2e2438, roughness: 1, transparent: true, opacity: 0.94,
    alphaMap: arenaFadeTex, depthWrite: false,
    normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.9, 0.9),
  });
  const court = new THREE.Mesh(new THREE.CircleGeometry(FANG_R + 1.8, 72), courtMat);
  court.rotation.x = -Math.PI / 2; court.position.set(C.x, 0.006, C.z); court.receiveShadow = true; fangArenaGroup.add(court);
  const bleed = new THREE.Mesh(new THREE.RingGeometry(FANG_R - 1.5, FANG_R + 1.8, 96),
    new THREE.MeshBasicMaterial({ color: 0x4a0b22, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  bleed.rotation.x = -Math.PI / 2; bleed.position.set(C.x, 0.014, C.z); fangArenaGroup.add(bleed);
  for (const [rr, op] of [[4.8, 0.37], [8.7, 0.24], [12.9, 0.15]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(rr, rr + 0.055, 96),
      new THREE.MeshBasicMaterial({ color: 0xff2a5e, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(C.x, 0.02, C.z); fangArenaGroup.add(ring);
  }
  const obMat = new THREE.MeshStandardMaterial({ color: 0x17111d, roughness: 0.92, metalness: 0.12, flatShading: true });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + 0.12;
    const rr = FANG_R - 0.7 + Math.random() * 0.7;
    const h = 2.6 + Math.random() * 4.4;
    const ob = new THREE.Mesh(new THREE.ConeGeometry(0.42 + Math.random() * 0.28, h, 4), obMat);
    ob.position.set(C.x + Math.cos(a) * rr, h / 2 - 0.15, C.z + Math.sin(a) * rr);
    ob.rotation.y = -a + (Math.random() - 0.5) * 0.4;
    ob.rotation.z = (Math.random() - 0.5) * 0.12;
    ob.castShadow = true; fangArenaGroup.add(ob);
  }
  const DS = fangStonePos;
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.3, 0.32, 8), new THREE.MeshStandardMaterial({ color: 0x241a2c, roughness: 0.85, metalness: 0.3, flatShading: true }));
  dais.position.set(DS.x, 0.18, DS.z); dais.castShadow = dais.receiveShadow = true; fangArenaGroup.add(dais);
  const daisTop = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.98, 0.10, 8), new THREE.MeshStandardMaterial({ color: 0x3a243e, roughness: 0.7, metalness: 0.5 }));
  daisTop.position.set(DS.x, 0.39, DS.z); daisTop.castShadow = true; fangArenaGroup.add(daisTop);
  fangStoneMat = new THREE.MeshStandardMaterial({ color: 0x120a18, emissive: 0xff2a5e, emissiveIntensity: 1.9, metalness: 0.7, roughness: 0.24 });
  fangStone = new THREE.Mesh(new THREE.OctahedronGeometry(0.78, 0), fangStoneMat);
  fangStone.scale.set(0.72, 2.15, 0.72); fangStone.position.set(DS.x, 2.45, DS.z); fangStone.castShadow = true; fangArenaGroup.add(fangStone);
  const stoneRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.035, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0xff4d6d, transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending, depthWrite: false }));
  stoneRing.position.set(DS.x, 2.45, DS.z); stoneRing.rotation.x = 0.18; fangArenaGroup.add(stoneRing);
  fangStoneGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff2a5e, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  fangStoneGlow.scale.setScalar(4.8); fangStoneGlow.position.set(DS.x, 2.45, DS.z); fangArenaGroup.add(fangStoneGlow);
  fangLight = new THREE.PointLight(0xff2a5e, 62, 52, 1.7); fangLight.position.set(C.x, 7.5, C.z);
  fangArenaGroup.add(fangLight); fangLights.push(fangLight);
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.8),
    new THREE.MeshBasicMaterial({ color: 0x140818, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false }));
  veil.position.set(C.x, 2.2, C.z + FANG_R - 3.4); fangArenaGroup.add(veil);
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.08 + Math.random() * 0.12, 0),
      new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xff2a5e : 0x8b5cff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    shard.position.set(C.x + Math.cos(a) * (FANG_R - 2.4 + Math.random() * 0.9), 0.12 + Math.random() * 0.2, C.z + Math.sin(a) * (FANG_R - 2.4 + Math.random() * 0.9));
    shard.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); fangArenaGroup.add(shard);
  }
}
fangArenaGroup.visible = false;

const fangWorldGroup = new THREE.Group();
fangWorldGroup.name = 'fang-world';
scene.add(fangWorldGroup);
const fangMotes = [];
let fangMoonDisc = null, fangMoonRing = null;
{
  const C = FANG_CENTER;
  const floorTex = canvasTex(512, (x, s) => {
    x.fillStyle = '#120d1a'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 150; i++) {
      const g = x.createRadialGradient(Math.random() * s, Math.random() * s, 2, Math.random() * s, Math.random() * s, 20 + Math.random() * 90);
      const pal = ['rgba(40,26,58,0.24)', 'rgba(70,20,46,0.14)', 'rgba(10,7,16,0.32)', 'rgba(94,30,72,0.10)'];
      g.addColorStop(0, pal[Math.random() * pal.length | 0]); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, s, s);
    }
    for (let i = 0; i < 16000; i++) {
      const v = 14 + Math.random() * 30 | 0;
      x.fillStyle = `rgba(${v + 8},${v},${v + 14},${0.2 + Math.random() * 0.3})`;
      x.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 2);
    }
  }, 24);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({
    map: floorTex, color: 0xffffff, roughness: 0.98, metalness: 0.02,
    normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.8, 0.8),
  }));
  floor.name = 'moonless-floor'; floor.rotation.x = -Math.PI / 2; floor.position.set(C.x, 0.004, C.z); floor.receiveShadow = true; fangWorldGroup.add(floor);
  const ruMat = new THREE.MeshStandardMaterial({ color: 0x18121f, roughness: 0.94, metalness: 0.08, flatShading: true });
  const dummy = new THREE.Object3D();
  const count = 44;
  const ruins = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), ruMat, count);
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const rr = FANG_R + 4 + Math.random() * 34;
    const h = 2 + Math.random() * 13;
    dummy.position.set(C.x + Math.cos(a) * rr, h / 2 - 0.2, C.z + Math.sin(a) * rr);
    dummy.rotation.set((Math.random() - 0.5) * 0.1, Math.random() * Math.PI, (Math.random() - 0.5) * 0.14);
    dummy.scale.set(0.6 + Math.random() * 2.4, h, 0.6 + Math.random() * 2.4);
    dummy.updateMatrix(); ruins.setMatrixAt(i, dummy.matrix);
  }
  ruins.instanceMatrix.needsUpdate = true; ruins.castShadow = true; fangWorldGroup.add(ruins);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshBasicMaterial({ color: 0x050208, fog: false }));
  disc.position.set(C.x, 35, C.z - 78); fangWorldGroup.add(disc); fangMoonDisc = disc;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(16.7, 0.34, 8, 96), new THREE.MeshBasicMaterial({ color: 0xff2a5e, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  ring.position.set(C.x, 35, C.z - 77.8); fangWorldGroup.add(ring); fangMoonRing = ring;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff2a5e, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.setScalar(48); halo.position.set(C.x, 35, C.z - 78); fangWorldGroup.add(halo);
  const moteMats = [0xff2a5e, 0x8b5cff, 0xff8a9a].map(c => new THREE.SpriteMaterial({
    map: fireGlowTex, color: c, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  }));
  for (let i = 0; i < 24; i++) {
    const sp = new THREE.Sprite(moteMats[i % 3]);
    const a = Math.random() * Math.PI * 2, rr = 5 + Math.random() * 30;
    sp.position.set(C.x + Math.cos(a) * rr, 0.6 + Math.random() * 7, C.z + Math.sin(a) * rr);
    sp.scale.setScalar(0.16 + Math.random() * 0.3);
    sp.userData = { a, rr, y: sp.position.y, speed: 0.05 + Math.random() * 0.12, bob: Math.random() * 6.28 };
    fangMotes.push(sp); fangWorldGroup.add(sp);
  }
  const li = new THREE.PointLight(0xff2a5e, 58, 58, 1.7); li.position.set(C.x, 8, C.z);
  fangWorldGroup.add(li); fangLights.push(li);
}
fangWorldGroup.visible = false;

// ============ THE HOLLOW CHOIR (Vesper & Morrow arena + sepulchre world) ============
const duoStonePos = new THREE.Vector3(DUO_CENTER.x, 0, DUO_CENTER.z - 11.5);
let duoStone, duoStoneMat, duoStoneGlow, duoLight;
const duoArenaGroup = new THREE.Group();
duoArenaGroup.name = 'duo-arena';
scene.add(duoArenaGroup);
{
  const C = DUO_CENTER;
  const floorMat = new THREE.MeshStandardMaterial({
    map: dirtTex, color: 0x5a4a32, roughness: 1, transparent: true, opacity: 0.95,
    alphaMap: arenaFadeTex, depthWrite: false,
    normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.85, 0.85),
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(DUO_R + 1.6, 72), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(C.x, 0.006, C.z); floor.receiveShadow = true; duoArenaGroup.add(floor);
  for (const [rr, w, op, col] of [[2.9, 0.07, 0.40, 0xe4c470], [7.4, 0.045, 0.24, 0xd8b45e], [12.2, 0.055, 0.18, 0xf0d9a0], [DUO_R - 1.2, 0.10, 0.32, 0xb99348]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(rr, rr + w, 96),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(C.x, 0.02 + rr * 0.0002, C.z); duoArenaGroup.add(ring);
  }
  const columnMat = new THREE.MeshStandardMaterial({ color: 0x2d2418, roughness: 0.9, metalness: 0.14, flatShading: true });
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2 + 0.1;
    const rr = DUO_R - 0.4 + Math.random() * 0.8;
    const h = 3.4 + Math.random() * 5.2;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, h, 7), columnMat);
    shaft.position.set(C.x + Math.cos(a) * rr, h / 2 - 0.1, C.z + Math.sin(a) * rr);
    shaft.rotation.y = -a; shaft.castShadow = true; duoArenaGroup.add(shaft);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 1.1), columnMat);
    cap.position.set(C.x + Math.cos(a) * rr, h - 0.02, C.z + Math.sin(a) * rr);
    cap.rotation.y = -a; cap.castShadow = true; duoArenaGroup.add(cap);
  }
  const DS = duoStonePos;
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.10, 1.42, 0.34, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a3020, roughness: 0.8, metalness: 0.34, flatShading: true }));
  dais.position.set(DS.x, 0.19, DS.z); dais.castShadow = dais.receiveShadow = true; duoArenaGroup.add(dais);
  duoStoneMat = new THREE.MeshStandardMaterial({ color: 0x1a1409, emissive: 0xe4c470, emissiveIntensity: 1.7, metalness: 0.72, roughness: 0.2 });
  duoStone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.82, 0), duoStoneMat);
  duoStone.scale.set(0.78, 1.9, 0.78); duoStone.position.set(DS.x, 2.4, DS.z); duoStone.castShadow = true; duoArenaGroup.add(duoStone);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.04, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0xf0d9a0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.set(DS.x, 2.4, DS.z); halo.rotation.x = 1.18; duoArenaGroup.add(halo);
  duoStoneGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xe4c470, transparent: true, opacity: 0.44, blending: THREE.AdditiveBlending, depthWrite: false }));
  duoStoneGlow.scale.setScalar(5.0); duoStoneGlow.position.set(DS.x, 2.4, DS.z); duoArenaGroup.add(duoStoneGlow);
  duoLight = new THREE.PointLight(0xe4c470, 60, 56, 1.7); duoLight.position.set(C.x, 8, C.z);
  duoArenaGroup.add(duoLight); duoLights.push(duoLight);
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 4.0),
    new THREE.MeshBasicMaterial({ color: 0x120e08, transparent: true, opacity: 0.58, side: THREE.DoubleSide, depthWrite: false }));
  veil.position.set(C.x, 2.25, C.z + DUO_R - 3.2); duoArenaGroup.add(veil);
}
duoArenaGroup.visible = false;

const duoWorldGroup = new THREE.Group();
duoWorldGroup.name = 'duo-world';
scene.add(duoWorldGroup);
const duoMotes = [];
let duoHalo = null;
{
  const C = DUO_CENTER;
  const floorTex = canvasTex(512, (x, s) => {
    x.fillStyle = '#1b160e'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 130; i++) {
      const g = x.createRadialGradient(Math.random() * s, Math.random() * s, 2, Math.random() * s, Math.random() * s, 18 + Math.random() * 80);
      const pal = ['rgba(80,66,40,0.22)', 'rgba(44,34,20,0.28)', 'rgba(12,9,6,0.34)', 'rgba(110,88,48,0.09)'];
      g.addColorStop(0, pal[Math.random() * pal.length | 0]); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, s, s);
    }
    for (let i = 0; i < 14000; i++) {
      const v = 18 + Math.random() * 34 | 0;
      x.fillStyle = `rgba(${v + 12},${v + 6},${v},${0.2 + Math.random() * 0.3})`;
      x.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 2);
    }
  }, 24);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({
    map: floorTex, color: 0xffffff, roughness: 0.98, metalness: 0.02,
    normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.8, 0.8),
  }));
  floor.name = 'hollow-choir-floor'; floor.rotation.x = -Math.PI / 2; floor.position.set(C.x, 0.004, C.z); floor.receiveShadow = true; duoWorldGroup.add(floor);
  const ruMat = new THREE.MeshStandardMaterial({ color: 0x241d12, roughness: 0.94, metalness: 0.06, flatShading: true });
  const dummy = new THREE.Object3D();
  const count = 54;
  const ruins = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), ruMat, count);
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2 + (Math.random() - 0.5) * 0.22;
    const rr = DUO_R + 6 + Math.random() * 42;
    const h = 3 + Math.random() * 18;
    dummy.position.set(C.x + Math.cos(a) * rr, h / 2 - 0.2, C.z + Math.sin(a) * rr);
    dummy.rotation.set((Math.random() - 0.5) * 0.08, Math.random() * Math.PI, (Math.random() - 0.5) * 0.1);
    dummy.scale.set(0.7 + Math.random() * 2.8, h, 0.7 + Math.random() * 2.8);
    dummy.updateMatrix(); ruins.setMatrixAt(i, dummy.matrix);
  }
  ruins.instanceMatrix.needsUpdate = true; ruins.castShadow = true; duoWorldGroup.add(ruins);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshBasicMaterial({ color: 0x070604, fog: false }));
  disc.position.set(C.x, 34, C.z - 84); duoWorldGroup.add(disc);
  duoHalo = new THREE.Mesh(new THREE.TorusGeometry(14.5, 0.24, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0xe4c470, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  duoHalo.position.set(C.x, 34, C.z - 83.8); duoWorldGroup.add(duoHalo);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xe4c470, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  glow.scale.setScalar(50); glow.position.set(C.x, 34, C.z - 84); duoWorldGroup.add(glow);
  const moteMats = [0xe4c470, 0xf0d9a0, 0x9b7a3e].map(c => new THREE.SpriteMaterial({
    map: fireGlowTex, color: c, transparent: true, opacity: 0.46, blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  }));
  for (let i = 0; i < 28; i++) {
    const sp = new THREE.Sprite(moteMats[i % 3]);
    const a = Math.random() * Math.PI * 2, rr = 5 + Math.random() * 32;
    sp.position.set(C.x + Math.cos(a) * rr, 0.6 + Math.random() * 7, C.z + Math.sin(a) * rr);
    sp.scale.setScalar(0.16 + Math.random() * 0.3);
    sp.userData = { a, rr, y: sp.position.y, speed: 0.04 + Math.random() * 0.11, bob: Math.random() * 6.28 };
    duoMotes.push(sp); duoWorldGroup.add(sp);
  }
  const li = new THREE.PointLight(0xe4c470, 56, 58, 1.7); li.position.set(C.x, 8, C.z);
  duoWorldGroup.add(li); duoLights.push(li);
}
duoWorldGroup.visible = false;

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
  hexbane: { id: 'hexbane', name: 'Nightshade Saber', icon: 'sword', rarity: 'legendary', dmg: 1.42, spd: 1.08, st: 1.12, reach: 1.18, wt: 'Standard', desc: 'A pale edge that drinks hexes. Faster than a knight\'s blade.' },
  calderablade: { id: 'calderablade', name: 'Caldera Greatsword', icon: 'sword', rarity: 'legendary', dmg: 2.0, spd: 0.78, st: 1.5, reach: 1.26, wt: 'Heavy', desc: 'Forged in Vytles\'s furnace. The steel still breathes heat.' },
  eclipseblade: { id: 'eclipseblade', name: 'Eclipse Edge', icon: 'sword', rarity: 'legendary', dmg: 2.35, spd: 0.9, st: 1.4, reach: 1.28, wt: 'Heavy', desc: 'Korvath\'s black steel. It cuts the light before the flesh.' },
};
const WEAPON_ORDER = ['rustysword', 'woodensword', 'longsword', 'broadsword', 'claymore', 'greatsword', 'ashenGreat', 'moonblade', 'hexbane', 'calderablade', 'eclipseblade'];

function buildWeaponMesh(id) {
  const steel = new THREE.MeshStandardMaterial({ color: 0xc6ccd3, metalness: 1.0, roughness: 0.26, map: metalTex, bumpMap: metalTex, bumpScale: 0.008 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x767c84, metalness: 0.95, roughness: 0.44, map: metalTex });
  const leather = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.92, map: leatherTex });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb08d4a, metalness: 1.0, roughness: 0.34, map: metalTex });
  const grp = new THREE.Group();
  let len = 1.15, wid = 0.09, thick = 0.025, gripLen = 0.3, guardW = 0.3, wide = false, ember = false, violet = false, voidblade = false;
  if (id === 'rustysword' || id === 'woodensword') { len = 1.0; wid = 0.07; gripLen = 0.25; guardW = 0.2; }
  else if (id === 'longsword') { len = 1.2; wid = 0.09; gripLen = 0.32; guardW = 0.3; }
  else if (id === 'broadsword') { len = 1.3; wid = 0.12; thick = 0.03; gripLen = 0.36; guardW = 0.38; }
  else if (id === 'claymore') { len = 1.5; wid = 0.10; gripLen = 0.44; guardW = 0.44; }
  else if (id === 'greatsword') { len = 1.8; wid = 0.15; thick = 0.05; gripLen = 0.56; guardW = 0.52; wide = true; }
  else if (id === 'ashenGreat') { len = 1.75; wid = 0.14; thick = 0.045; gripLen = 0.52; guardW = 0.54; wide = true; ember = true; }
  else if (id === 'moonblade') { len = 1.35; wid = 0.08; thick = 0.02; gripLen = 0.34; guardW = 0.28; }
  else if (id === 'hexbane') { len = 1.32; wid = 0.075; thick = 0.022; gripLen = 0.34; guardW = 0.3; violet = true; }
  else if (id === 'calderablade') { len = 1.65; wid = 0.14; thick = 0.045; gripLen = 0.5; guardW = 0.5; wide = true; ember = true; }
  else if (id === 'eclipseblade') { len = 1.75; wid = 0.12; thick = 0.038; gripLen = 0.46; guardW = 0.46; wide = true; voidblade = true; }
  const bladeM = ember
    ? new THREE.MeshStandardMaterial({ color: 0x40454c, metalness: 0.9, roughness: 0.38, map: metalTex, bumpMap: metalTex, bumpScale: 0.01, emissive: 0xff4400, emissiveIntensity: 0.18 })
    : voidblade
      ? new THREE.MeshStandardMaterial({ color: 0x19121f, metalness: 0.95, roughness: 0.3, map: metalTex, bumpMap: metalTex, bumpScale: 0.01, emissive: 0x8b1a3a, emissiveIntensity: 0.22 })
      : violet
        ? new THREE.MeshStandardMaterial({ color: 0x5b4269, metalness: 0.92, roughness: 0.32, map: metalTex, bumpMap: metalTex, bumpScale: 0.008, emissive: 0x8b5cff, emissiveIntensity: 0.15 })
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
  const glowColor = voidblade ? 0xff2a5e : violet ? 0xc08cff : 0xffb52e;
  const trailColor = voidblade ? 0xff7a9a : violet ? 0xe0d0ff : 0xffd9a0;
  const glow = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.06, len, thick + 0.04), new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0 }));
  glow.position.y = blade.position.y; grp.add(glow);
  const trail = new THREE.Mesh(new THREE.PlaneGeometry(wid * 3, len + 0.2), new THREE.MeshBasicMaterial({ color: trailColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  trail.position.y = blade.position.y; grp.add(trail);
  return { group: grp, glow, trail };
}

// ============ LOOT (weighted swords + spoils, no guaranteed sword) ============
const RARITY = {
  common: { label: 'COMMON', color: '#b8bfc9' },
  rare: { label: 'RARE', color: '#4a9eff' },
  legendary: { label: 'LEGENDARY', color: '#ffb52e' },
};
// Passive spoils — only one may be equipped at a time.
const SPOILS = [
  { id: 'buckler', name: 'Worn Buckler', icon: 'shield', rarity: 'common', desc: '+8% damage', apply: P => { P.mods.dmg *= 1.08; }, unapply: P => { P.mods.dmg /= 1.08; } },
  { id: 'signet', name: "Soldier's Ring", icon: 'ring', rarity: 'common', desc: '+8% move speed', apply: P => { P.mods.spd *= 1.08; }, unapply: P => { P.mods.spd /= 1.08; } },
  { id: 'boots', name: 'Leather Boots', icon: 'boot', rarity: 'common', desc: '+14% estus healing', apply: P => { P.mods.flask *= 1.14; }, unapply: P => { P.mods.flask /= 1.14; } },
  { id: 'ember', name: 'Cracked Ember', icon: 'charm', rarity: 'common', desc: '+9% max stamina', apply: P => { P.mods.st *= 1.09; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); }, unapply: P => { P.mods.st /= 1.09; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); } },
  { id: 'knightring', name: "Knight's Signet", icon: 'ring', rarity: 'rare', desc: '+16% damage', apply: P => { P.mods.dmg *= 1.16; }, unapply: P => { P.mods.dmg /= 1.16; } },
  { id: 'ironheart', name: 'Iron Heart', icon: 'heart', rarity: 'rare', desc: '+22% max HP', apply: P => { P.mods.hp *= 1.22; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); }, unapply: P => { P.mods.hp /= 1.22; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); } },
  { id: 'soles', name: 'Swift Soles', icon: 'boot', rarity: 'rare', desc: '+13% move speed', apply: P => { P.mods.spd *= 1.13; }, unapply: P => { P.mods.spd /= 1.13; } },
  { id: 'bloodgem', name: 'Bloodstone', icon: 'gem', rarity: 'rare', desc: '+16% max HP, +9% damage', apply: P => { P.mods.hp *= 1.16; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); P.mods.dmg *= 1.09; }, unapply: P => { P.mods.hp /= 1.16; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); P.mods.dmg /= 1.09; } },
  { id: 'crown', name: "Ashen Lord's Crown", icon: 'crown', rarity: 'legendary', desc: '+28% damage, +28% max HP', apply: P => { P.mods.dmg *= 1.28; P.mods.hp *= 1.28; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); }, unapply: P => { P.mods.dmg /= 1.28; P.mods.hp /= 1.28; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); } },
  { id: 'dragonheart', name: 'Dragonheart', icon: 'heart', rarity: 'legendary', desc: '+45% max HP, +30% stamina', apply: P => { P.mods.hp *= 1.45; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); P.mods.st *= 1.30; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); }, unapply: P => { P.mods.hp /= 1.45; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); P.mods.st /= 1.30; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); } },
  { id: 'vigilblade', name: 'Vigil Talisman', icon: 'sword', rarity: 'legendary', desc: '+40% damage', apply: P => { P.mods.dmg *= 1.40; }, unapply: P => { P.mods.dmg /= 1.40; } },
  { id: 'moongem', name: 'Moonlight Gem', icon: 'gem', rarity: 'legendary', desc: '+35% stamina, +16% move speed', apply: P => { P.mods.st *= 1.35; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); P.mods.spd *= 1.16; }, unapply: P => { P.mods.st /= 1.35; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); P.mods.spd /= 1.16; } },
];
const BOSS_SHARDS = [
  { id: 'ashenShard', name: 'Ashen Shard', icon: 'gem', rarity: 'legendary', boss: 'duncan', desc: 'A shard of Duncan\'s vigil. +18% damage, +14% max HP.', apply: P => { P.mods.dmg *= 1.18; P.mods.hp *= 1.14; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); }, unapply: P => { P.mods.dmg /= 1.18; P.mods.hp /= 1.14; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); } },
  { id: 'nightshadeShard', name: 'Nightshade Shard', icon: 'gem', rarity: 'legendary', boss: 'witch', desc: 'A splinter of Morgana\'s veil. +26% max stamina, +14% move speed.', apply: P => { P.mods.st *= 1.26; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); P.mods.spd *= 1.14; }, unapply: P => { P.mods.st /= 1.26; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); P.mods.spd /= 1.14; } },
  { id: 'dragonShard', name: 'Dragon Shard', icon: 'gem', rarity: 'legendary', boss: 'dragon', desc: 'A scale of Vytles, still molten. +32% max HP, +18% damage.', apply: P => { P.mods.hp *= 1.32; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); P.mods.dmg *= 1.18; }, unapply: P => { P.mods.hp /= 1.32; P.maxHP = Math.round(TUNE.playerHP * P.mods.hp); P.hp = Math.min(P.hp, P.maxHP); P.mods.dmg /= 1.18; } },
  { id: 'eclipseShard', name: 'Eclipse Fang', icon: 'gem', rarity: 'legendary', boss: 'fang', desc: 'A splinter of Korvath\'s black blade. +24% damage, +14% move speed.', apply: P => { P.mods.dmg *= 1.24; P.mods.spd *= 1.14; }, unapply: P => { P.mods.dmg /= 1.24; P.mods.spd /= 1.14; } },
  { id: 'choirShard', name: 'Hollow Choir Shard', icon: 'gem', rarity: 'legendary', boss: 'duo', desc: 'A note torn from the twins\' requiem. +30% damage, +20% max stamina.', apply: P => { P.mods.dmg *= 1.30; P.mods.st *= 1.20; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); }, unapply: P => { P.mods.dmg /= 1.30; P.mods.st /= 1.20; P.stMax = Math.round(TUNE.playerST * P.mods.st); P.st = Math.min(P.st, P.stMax); } },
];
const ALL_SPOILS = [...SPOILS, ...BOSS_SHARDS];
function bossShardFor(id) { return BOSS_SHARDS.find(s => s.boss === id) || null; }
// Explicit weights keep the best swords near 15% per kill while still allowing
// a three-item roll to be all swords, all spoils, or any mix of the two.
const DROP_WEIGHTS = {
  rustysword: 8, woodensword: 8, longsword: 6, broadsword: 6,
  claymore: 4, greatsword: 4, ashenGreat: 4, moonblade: 4,
  hexbane: 8, calderablade: 7, eclipseblade: 6,
  buckler: 7, signet: 7, boots: 7, ember: 7,
  knightring: 10, ironheart: 10, soles: 10, bloodgem: 10,
  crown: 14, dragonheart: 14, vigilblade: 14, moongem: 14,
  ashenShard: 18, nightshadeShard: 18, dragonShard: 18, eclipseShard: 18, choirShard: 18,
};
const SWORD_DROPS = Object.values(WEAPONS).map(w => ({ ...w, type: 'weapon' }));
const SPOIL_DROPS = SPOILS.map(s => ({ ...s, type: 'spoils' }));
const DROP_POOL = [...SWORD_DROPS, ...SPOIL_DROPS];

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

const infernoOrb = (() => {
  const group = new THREE.Group(); group.name = 'inferno-orb'; group.visible = false; scene.add(group);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.82, 3), new THREE.MeshBasicMaterial({ color: 0xffedc4 }));
  group.add(core);
  const shellMat = new THREE.MeshBasicMaterial({ color: 0xff6a18, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.28, 3), shellMat);
  group.add(shell);
  const haloMat = new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff7a26, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(7.5); group.add(halo);
  const flameMats = [
    new THREE.SpriteMaterial({ map: flameTex, color: 0xff7a28, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }),
    new THREE.SpriteMaterial({ map: flameTex, color: 0xffd27a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  ];
  const flames = [];
  for (let i = 0; i < 18; i++) {
    const sprite = new THREE.Sprite(flameMats[i % 2]);
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    if (dir.lengthSq() < 0.02) dir.set(0, 1, 0);
    dir.normalize();
    const baseScale = 0.75 + Math.random() * 0.75;
    sprite.userData = { dir, baseScale, phase: Math.random() * Math.PI * 2, speed: 1.4 + Math.random() * 2.2 };
    group.add(sprite); flames.push(sprite);
  }
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb24a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.045, 8, 56), ringMat);
  ringA.rotation.x = Math.PI / 2; group.add(ringA);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.03, 8, 64), ringMat);
  ringB.rotation.x = Math.PI / 2.4; ringB.rotation.z = 0.6; group.add(ringB);
  const light = new THREE.PointLight(0xff7a26, 0, 26, 1.7); light.position.y = 0.2; group.add(light);
  return { group, core, shell, shellMat, halo, haloMat, flames, ringA, ringB, ringMat, light, t: 0 };
})();

const infernoMark = (() => {
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff7a24, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xff2f08, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.84, 1, 64), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; group.add(ring);
  const inner = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.42, 48), ringMat);
  inner.rotation.x = -Math.PI / 2; inner.position.y = 0.055; group.add(inner);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), fillMat);
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.04; group.add(fill);
  return { group, ring, inner, fill, ringMat, fillMat, t: 0 };
})();

const bossFireAura = (() => {
  const group = new THREE.Group(); group.visible = false; bossK.group.add(group);
  const flameMats = [
    new THREE.SpriteMaterial({ map: flameTex, color: 0xff6a22, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
    new THREE.SpriteMaterial({ map: flameTex, color: 0xffbe62, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }),
  ];
  const flames = [];
  for (let i = 0; i < 12; i++) {
    const sprite = new THREE.Sprite(flameMats[i % 2]);
    const a = i / 12 * Math.PI * 2 + Math.random() * 0.3;
    sprite.userData = { a, r: 0.48 + Math.random() * 0.42, y: 0.3 + Math.random() * 2.1, phase: Math.random() * Math.PI * 2, baseScale: 0.34 + Math.random() * 0.42 };
    group.add(sprite); flames.push(sprite);
  }
  const glowMat = new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff7a24, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Sprite(glowMat); glow.scale.setScalar(4.2); glow.position.y = 1.15; group.add(glow);
  const light = new THREE.PointLight(0xff6a1e, 0, 10, 2); light.position.y = 1.1; group.add(light);
  return { group, flames, glow, glowMat, light, t: 0 };
})();

const infernoTarget = new THREE.Vector3();
const infernoStart = new THREE.Vector3();
const _infernoWorld = new THREE.Vector3();

function updateInfernoOrbVisual(dt) {
  if (!infernoOrb.group.visible) return;
  const t = (infernoOrb.t += dt);
  infernoOrb.core.rotation.x += dt * 1.7; infernoOrb.core.rotation.y += dt * 2.3;
  infernoOrb.shell.rotation.x -= dt * 1.1; infernoOrb.shell.rotation.z += dt * 1.6;
  infernoOrb.shellMat.opacity = 0.48 + Math.sin(t * 9) * 0.12;
  infernoOrb.haloMat.opacity = 0.56 + Math.sin(t * 6.3) * 0.14;
  infernoOrb.ringA.rotation.z += dt * 1.8;
  infernoOrb.ringB.rotation.z -= dt * 1.2; infernoOrb.ringB.rotation.x += dt * 0.7;
  infernoOrb.ringMat.opacity = 0.55 + Math.sin(t * 7.4) * 0.25;
  infernoOrb.light.intensity = 44 + Math.sin(t * 11) * 14;
  for (const sprite of infernoOrb.flames) {
    const u = sprite.userData;
    const p = 1.02 + Math.sin(t * u.speed + u.phase) * 0.18;
    sprite.position.copy(u.dir).multiplyScalar(p * 1.35);
    const sc = u.baseScale * (0.85 + Math.sin(t * u.speed * 1.3 + u.phase) * 0.18);
    sprite.scale.set(sc, sc * 2.1, 1);
  }
  if (Math.random() < 0.75) {
    spawnSparks(new THREE.Vector3(
      infernoOrb.group.position.x + (Math.random() - 0.5) * 2.2,
      infernoOrb.group.position.y + (Math.random() - 0.5) * 2.2,
      infernoOrb.group.position.z + (Math.random() - 0.5) * 2.2
    ), 1, Math.random() < 0.5 ? 0xff5a1e : 0xffd27a, 2.6);
  }
}

function updateInfernoMark(dt) {
  if (!infernoMark.group.visible) return;
  const t = (infernoMark.t += dt);
  const pulse = 0.9 + Math.sin(t * 12) * 0.1;
  infernoMark.ring.scale.setScalar(2.1 * pulse);
  infernoMark.inner.scale.setScalar(2.1 * (0.7 + Math.sin(t * 9 + 1) * 0.12));
  infernoMark.fill.scale.setScalar(2.1 * (0.92 + Math.sin(t * 7) * 0.05));
  infernoMark.ringMat.opacity = 0.5 + Math.sin(t * 12) * 0.28;
}

function updateBossFireAura(dt) {
  const active = B.phase2 && bossK.group.visible && B.state !== 'inferno' && B.state !== 'dead';
  bossFireAura.group.visible = active;
  if (!active) return;
  const t = (bossFireAura.t += dt);
  for (const sprite of bossFireAura.flames) {
    const u = sprite.userData;
    const a = u.a + t * 0.9;
    sprite.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 3.6 + u.phase) * 0.22, Math.sin(a) * u.r);
    const sc = u.baseScale * (0.82 + Math.sin(t * 5.2 + u.phase) * 0.2);
    sprite.scale.set(sc, sc * 2.2, 1);
  }
  bossFireAura.glowMat.opacity = 0.32 + Math.sin(t * 6.5) * 0.12;
  bossFireAura.light.intensity = 18 + Math.sin(t * 8) * 7;
  if (Math.random() < 0.5) {
    bossK.group.getWorldPosition(_infernoWorld);
    spawnSparks(new THREE.Vector3(_infernoWorld.x + (Math.random() - 0.5) * 1.6, 0.3 + Math.random() * 2.6, _infernoWorld.z + (Math.random() - 0.5) * 1.6), 1, Math.random() < 0.5 ? 0xff5a1e : 0xffc861, 2.4);
  }
}

// ============ MORGANA, THE NIGHTSHADE HEX ============
const WITCH_BASE_SCALE = 1.28;
function buildWitch() {
  const g = new THREE.Group();
  const root = new THREE.Group(); g.add(root);

  // ---- materials: pale flesh, plum velvet, tarnished gold, black hair ----
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xd7c1c0, roughness: 0.55, metalness: 0.0,
    sheen: 0.4, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x8a4a63),
    emissive: 0x1c0d24, emissiveIntensity: 0.32,
  });
  const robeMat = new THREE.MeshPhysicalMaterial({
    color: 0x241331, metalness: 0.04, roughness: 0.82, side: THREE.DoubleSide,
    map: clothTex, normalMap: clothNormalTex, normalScale: new THREE.Vector2(0.55, 0.55),
    sheen: 0.85, sheenRoughness: 0.55, sheenColor: new THREE.Color(0x9b6bff),
  });
  const velvetMat = new THREE.MeshPhysicalMaterial({
    color: 0x352044, metalness: 0.03, roughness: 0.74, side: THREE.DoubleSide,
    map: clothTex, normalMap: clothNormalTex, normalScale: new THREE.Vector2(0.45, 0.45),
    sheen: 1.0, sheenRoughness: 0.42, sheenColor: new THREE.Color(0xc08bff),
  });
  const underMat = new THREE.MeshStandardMaterial({ color: 0x120a1c, roughness: 0.92, map: clothTex });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x9a7534, metalness: 0.9, roughness: 0.34, emissive: 0x2a0a44, emissiveIntensity: 0.6 });
  const hairMat = new THREE.MeshPhysicalMaterial({ color: 0x100b16, roughness: 0.4, metalness: 0.08, sheen: 0.6, sheenRoughness: 0.35, sheenColor: new THREE.Color(0x5a3a88) });
  const lipMat = new THREE.MeshStandardMaterial({ color: 0x6e2f42, roughness: 0.42, metalness: 0.05, emissive: 0x22080f, emissiveIntensity: 0.4 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe6d2ff });
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0x150d18, roughness: 0.28 });
  const orbMat = new THREE.MeshStandardMaterial({ color: 0xd9b7ff, emissive: 0x7b3aff, emissiveIntensity: 3.2, roughness: 0.15, metalness: 0.2 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x24181a, roughness: 0.82, map: leatherTex });

  const M = (geo, mat, x, y, z, parent) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = true;
    if (parent) parent.add(m);
    return m;
  };
  const RB = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 3, Math.max(0.004, Math.min(r ?? Math.min(w, h, d) * 0.3, Math.min(w, h, d) * 0.48)));

  // ---- floor-length gown, folded and frayed at the hem ----
  const skirtGeo = new THREE.CylinderGeometry(0.33, 1.03, 1.5, 64, 14, true);
  {
    const p = skirtGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const ang = Math.atan2(x, z);
      const v = Math.min(1, Math.max(0, (0.75 - y) / 1.5));
      const fold = Math.sin(ang * 9 + v * 1.1) * 0.5 + Math.sin(ang * 17 - 0.7) * 0.26 + Math.sin(ang * 5 + v * 3.2) * 0.24;
      const k = 1 + fold * (0.012 + v * 0.05);
      let ny = y;
      if (v > 0.985) ny -= 0.03 + Math.abs(Math.sin(ang * 7.0)) * 0.05;
      p.setXYZ(i, x * k, ny, z * k);
    }
    skirtGeo.computeVertexNormals();
  }
  const robe = new THREE.Mesh(skirtGeo, robeMat);
  robe.position.y = 0.78; robe.receiveShadow = true; root.add(robe);
  const innerSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.9, 1.42, 32, 3, true), underMat);
  innerSkirt.position.y = 0.75; root.add(innerSkirt);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.028, 8, 64), trimMat);
  hem.rotation.x = Math.PI / 2; hem.position.y = 0.10; root.add(hem);

  // overlapping overskirt panels, animated as cloth
  const skirtPanels = [];
  function drapePanel(a, width, len, mat, rTop, rBottom, yBase) {
    const geo = new THREE.PlaneGeometry(1, 1, 8, 18);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + 0.5;
      const v = 0.5 - p.getY(i);
      const ang = a + (u - 0.5) * width;
      const rad = rTop + (rBottom - rTop) * v;
      const y = -v * len + (v > 0.97 ? -Math.abs(Math.sin(u * Math.PI * 4 + a * 3)) * 0.05 : 0);
      p.setXYZ(i, Math.sin(ang) * rad, y, Math.cos(ang) * rad);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.position.y = yBase; m.castShadow = true; m.receiveShadow = true;
    root.add(m); skirtPanels.push(m);
    return m;
  }
  for (let i = 0; i < 11; i++) drapePanel(i / 11 * Math.PI * 2, 0.54, 1.4 + (i % 3) * 0.05, i % 2 ? robeMat : velvetMat, 0.37, 1.0, 1.52);

  // ---- fitted bodice, belt and lacing ----
  const bodicePts = [
    new THREE.Vector2(0.30, 0.00), new THREE.Vector2(0.32, 0.08),
    new THREE.Vector2(0.305, 0.18), new THREE.Vector2(0.295, 0.28),
    new THREE.Vector2(0.315, 0.38), new THREE.Vector2(0.37, 0.48),
    new THREE.Vector2(0.415, 0.58), new THREE.Vector2(0.42, 0.64),
    new THREE.Vector2(0.36, 0.71), new THREE.Vector2(0.24, 0.76),
    new THREE.Vector2(0.145, 0.785),
  ];
  const bodice = new THREE.Mesh(new THREE.LatheGeometry(bodicePts, 48), velvetMat);
  bodice.position.y = 1.40; bodice.castShadow = true; root.add(bodice);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.03, 8, 40), trimMat);
  belt.rotation.x = Math.PI / 2; belt.position.y = 1.44; root.add(belt);
  M(new THREE.OctahedronGeometry(0.055, 0), orbMat, 0, 1.44, 0.325, root);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    const bone = M(RB(0.014, 0.44, 0.012, 0.005), trimMat, Math.sin(a) * 0.345, 1.70, Math.cos(a) * 0.345, root);
    bone.rotation.y = a;
  }
  for (let i = 0; i < 5; i++) {
    const lace = M(new THREE.TorusGeometry(0.15, 0.005, 4, 16, Math.PI * 0.8), trimMat, 0, 1.55 + i * 0.075, 0.345, root);
    lace.rotation.z = Math.PI / 2 + (i % 2 ? 0.7 : -0.7);
  }

  // ---- shoulders, standing cowl and short mantle ----
  const shoulders = M(new THREE.SphereGeometry(0.4, 24, 16), robeMat, 0, 1.98, 0, root);
  shoulders.scale.set(1.18, 0.52, 0.84);
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.62, 0.52, 40, 4, true, 0.52, Math.PI * 2 - 1.04), velvetMat);
  cowl.position.y = 2.01; cowl.castShadow = true; root.add(cowl);
  const cowlTrim = new THREE.Mesh(new THREE.TorusGeometry(0.60, 0.014, 6, 40), trimMat);
  cowlTrim.rotation.x = Math.PI / 2; cowlTrim.position.y = 1.77; root.add(cowlTrim);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI - 1.15 + i / 6 * 2.3;
    drapePanel(a, 0.38, 0.95 + (i % 3) * 0.1, i % 2 ? robeMat : velvetMat, 0.5, 0.7, 2.0);
  }

  // ---- neck and head ----
  const head = new THREE.Group(); head.position.y = 2.32; root.add(head);
  M(new THREE.CylinderGeometry(0.088, 0.112, 0.22, 16), skinMat, 0, -0.19, 0.005, head);
  const skull = M(new THREE.SphereGeometry(0.215, 28, 22), skinMat, 0, 0, 0, head);
  skull.scale.set(0.9, 1.03, 0.95);
  const jaw = M(new THREE.SphereGeometry(0.155, 20, 16), skinMat, 0, -0.11, 0.03, head);
  jaw.scale.set(0.8, 0.74, 0.84);
  const chin = M(new THREE.SphereGeometry(0.07, 14, 10), skinMat, 0, -0.188, 0.105, head);
  chin.scale.set(0.82, 0.7, 0.72);
  for (const s of [-1, 1]) {
    const cheek = M(new THREE.SphereGeometry(0.055, 12, 10), skinMat, 0.108 * s, -0.012, 0.145, head);
    cheek.scale.set(0.95, 0.62, 0.7);
    const ear = M(new THREE.SphereGeometry(0.045, 12, 10), skinMat, 0.196 * s, 0.005, 0.005, head);
    ear.scale.set(0.42, 1.1, 0.72);
  }
  const nose = M(new THREE.ConeGeometry(0.032, 0.1, 6), skinMat, 0, -0.012, 0.216, head);
  nose.rotation.x = Math.PI / 2; nose.scale.set(1, 1, 0.8);
  const lip = M(new THREE.CapsuleGeometry(0.021, 0.062, 3, 8), lipMat, 0, -0.09, 0.199, head);
  lip.rotation.z = Math.PI / 2; lip.scale.set(1, 1, 0.55);
  const lipU = M(new THREE.CapsuleGeometry(0.009, 0.05, 2, 6), lipMat, 0, -0.074, 0.205, head);
  lipU.rotation.z = Math.PI / 2; lipU.scale.set(1, 1, 0.5);
  const eyes = [];
  for (const s of [-1, 1]) {
    const socket = M(new THREE.SphereGeometry(0.044, 14, 12), scleraMat, 0.078 * s, 0.035, 0.174, head);
    socket.scale.set(1, 0.72, 0.62);
    const iris = M(new THREE.SphereGeometry(0.019, 10, 8), eyeMat, 0.078 * s, 0.035, 0.208, head);
    iris.scale.set(1, 1, 0.62); eyes.push(iris);
    const brow = M(RB(0.095, 0.012, 0.018, 0.005), hairMat, 0.082 * s, 0.084, 0.192, head);
    brow.rotation.z = -0.12 * s;
  }

  // ---- hair: cap, back mass and loose wavy locks ----
  const hairStrands = [];
  const hairCap = M(new THREE.SphereGeometry(0.235, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat, 0, 0.018, -0.012, head);
  hairCap.scale.set(1.03, 1.09, 1.06);
  const hairBack = M(new THREE.SphereGeometry(0.2, 20, 16), hairMat, 0, -0.15, -0.115, head);
  hairBack.scale.set(1.15, 1.7, 0.9);
  function hairLock(x, z, len, rad, phase, bend) {
    const geo = new THREE.CylinderGeometry(rad * 0.35, rad, len, 6, 12);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), t = (len / 2 - y) / len;
      p.setX(i, p.getX(i) + Math.sin(t * 3.1 + phase) * bend * t);
      p.setZ(i, p.getZ(i) + Math.cos(t * 2.4 + phase) * bend * 0.7 * t);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, hairMat);
    m.position.set(x, 0.03 - len / 2, z);
    m.userData = { phase, bend };
    m.castShadow = true; head.add(m); hairStrands.push(m);
    return m;
  }
  for (let i = 0; i < 12; i++) {
    const a = -1.15 + i / 11 * 2.3;
    hairLock(Math.sin(a) * 0.185, -0.11 - Math.cos(a) * 0.07, 0.62 + (i % 4) * 0.11, 0.028, i * 0.7, 0.07);
  }
  for (let i = 0; i < 4; i++) {
    const s = i < 2 ? -1 : 1;
    hairLock(0.155 * s, 0.02 + (i % 2) * 0.03, 0.72 + (i % 2) * 0.12, 0.026, 2.1 + i, 0.05);
  }
  const crown = new THREE.Group(); crown.position.y = 0.235; head.add(crown);
  const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.018, 8, 32), trimMat);
  crownRing.rotation.x = Math.PI / 2; crown.add(crownRing);
  const crownRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.188, 0.009, 6, 30), trimMat);
  crownRing2.rotation.x = Math.PI / 2; crownRing2.position.y = 0.05; crown.add(crownRing2);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const h = 0.16 + (i % 2) * 0.11 + (i === 0 ? 0.06 : 0);
    const spike = M(new THREE.ConeGeometry(0.022, h, 5), trimMat, Math.cos(a) * 0.2, h / 2 + 0.02, Math.sin(a) * 0.2, crown);
    spike.rotation.z = -Math.cos(a) * 0.22; spike.rotation.x = Math.sin(a) * 0.22;
    M(new THREE.OctahedronGeometry(0.026, 0), orbMat, Math.cos(a) * 0.2, 0.035, Math.sin(a) * 0.2, crown);
  }

  // ---- arms: articulated elbow, bell cuff, fingers ----
  function arm(side) {
    const sh = new THREE.Group(); sh.position.set(0.35 * side, 1.97, 0); root.add(sh);
    const upper = M(new THREE.CapsuleGeometry(0.085, 0.24, 4, 12), robeMat, 0, -0.20, 0, sh);
    upper.scale.set(1.1, 1, 0.92);
    const elbow = new THREE.Group(); elbow.position.y = -0.42; sh.add(elbow);
    M(new THREE.CylinderGeometry(0.07, 0.115, 0.32, 12, 2, true), robeMat, 0, -0.16, 0, elbow);
    const cuff = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.28, 18, 3, true), robeMat);
    cuff.position.y = -0.39; cuff.castShadow = true; elbow.add(cuff);
    const cuffTrim = M(new THREE.TorusGeometry(0.145, 0.012, 6, 26), trimMat, 0, -0.34, 0, elbow);
    cuffTrim.rotation.x = Math.PI / 2;
    const hand = new THREE.Group(); hand.position.y = -0.555; elbow.add(hand);
    M(RB(0.078, 0.105, 0.048, 0.022), skinMat, 0, -0.025, 0, hand);
    for (let f = 0; f < 4; f++) {
      const base = new THREE.Group(); base.position.set((f - 1.5) * 0.019, -0.078, 0.012); hand.add(base);
      M(new THREE.CapsuleGeometry(0.0085, 0.042, 2, 5), skinMat, 0, -0.028, 0, base);
      const tip = M(new THREE.CapsuleGeometry(0.0075, 0.032, 2, 5), skinMat, 0, -0.071, 0.012, base);
      tip.rotation.x = -0.85;
      base.rotation.x = -0.28 + Math.abs(f - 1.5) * 0.05;
    }
    const thumb = new THREE.Group(); thumb.position.set(0.042 * side, -0.018, 0.012); hand.add(thumb);
    const th = M(new THREE.CapsuleGeometry(0.0095, 0.048, 2, 5), skinMat, 0, -0.03, 0.008, thumb);
    th.rotation.z = -0.95 * side;
    sh.rotation.z = -side * 0.10;
    return { sh, elbow, hand };
  }
  const armR = arm(1), armL = arm(-1);

  // ---- gnarled staff with a caged crystal ----
  const staff = new THREE.Group(); staff.position.set(0.01, -0.04, 0.035); armR.hand.add(staff);
  const staffCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.98, 0), new THREE.Vector3(0.02, -0.45, 0.015),
    new THREE.Vector3(-0.02, 0.35, -0.01), new THREE.Vector3(0.03, 1.05, 0.02),
    new THREE.Vector3(0.01, 1.26, 0),
  ]);
  const shaft = new THREE.Mesh(new THREE.TubeGeometry(staffCurve, 28, 0.033, 8, false), woodMat);
  shaft.castShadow = true; staff.add(shaft);
  for (let i = 0; i < 7; i++) {
    const wrap = M(new THREE.TorusGeometry(0.041, 0.008, 5, 14), underMat, 0, -0.5 + i * 0.11, 0, staff);
    wrap.rotation.x = Math.PI / 2;
  }
  for (const y of [-0.15, 0.35, 0.72]) {
    const knot = M(new THREE.SphereGeometry(0.055, 8, 6), woodMat, 0.015, y, 0.01, staff);
    knot.scale.set(1, 0.65, 1);
    const rune = M(new THREE.BoxGeometry(0.012, 0.09, 0.012), orbMat, 0, y, 0.05, staff);
    rune.rotation.z = 0.25;
  }
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    const prong = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.01, 1.0, 0),
      new THREE.Vector3(Math.cos(a) * 0.22, 1.16, Math.sin(a) * 0.22),
      new THREE.Vector3(Math.cos(a) * 0.14, 1.40, Math.sin(a) * 0.14),
    ]);
    const pm = new THREE.Mesh(new THREE.TubeGeometry(prong, 12, 0.014, 6, false), woodMat);
    pm.castShadow = true; staff.add(pm);
  }
  const staffCrystal = M(new THREE.OctahedronGeometry(0.205, 0), orbMat, 0, 1.24, 0, staff);
  staffCrystal.scale.set(1, 1.7, 1);
  const staffGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0x9b5cff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  staffGlow.scale.setScalar(1.5); staffGlow.position.y = 1.24; staff.add(staffGlow);
  const staffLight = new THREE.PointLight(0x9b5cff, 9, 9, 2); staffLight.position.y = 1.24; staff.add(staffLight);

  const orbs = new THREE.Group(); orbs.position.y = 1.72; root.add(orbs);
  for (let i = 0; i < 3; i++) {
    const orb = M(new THREE.SphereGeometry(0.082, 12, 10), orbMat, 0, 0, 0, orbs);
    const a = i / 3 * Math.PI * 2;
    orb.position.set(Math.cos(a) * 0.82, Math.sin(a * 2) * 0.18 + 0.22, Math.sin(a) * 0.82);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0x9b5cff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
    glow.scale.setScalar(0.6); glow.position.copy(orb.position); orbs.add(glow);
  }

  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0x7b3aff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  aura.scale.set(6, 6, 1); aura.position.y = 1.45; root.add(aura);

  g.scale.setScalar(WITCH_BASE_SCALE);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, parts: {
    root, robe, shoulders, head, hood: cowl, crown, armL: armL.sh, armR: armR.sh,
    elbowL: armL.elbow, elbowR: armR.elbow, handL: armL.hand, handR: armR.hand,
    staff, staffCrystal, staffGlow, staffLight, orbs, aura, robMat: robeMat,
    skirtPanels, hairStrands, eyes, mantle: cowl, bodice,
  } };
}
const witchK = buildWitch();
scene.add(witchK.group); witchK.group.name = 'witch'; witchK.group.visible = false;

// ============ VYTLES, THE DRAGON ============
function buildDragon() {
  const g = new THREE.Group();
  const root = new THREE.Group(); g.add(root);

  const scaleMat = new THREE.MeshStandardMaterial({
    color: 0x3a2018, roughness: 0.7, metalness: 0.2,
    emissive: 0x6a1406, emissiveIntensity: 0.7,
    map: stoneTex, normalMap: groundNormalTex, normalScale: new THREE.Vector2(0.8, 0.8),
    flatShading: true,
  });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: 0x713018, roughness: 0.78, metalness: 0.08,
    emissive: 0x3a0d04, emissiveIntensity: 0.35, flatShading: true,
  });
  const membraneMat = new THREE.MeshStandardMaterial({
    color: 0x8a2410, roughness: 0.78, metalness: 0.04, side: THREE.DoubleSide,
    emissive: 0xd8380e, emissiveIntensity: 0.9, transparent: true, opacity: 0.97,
    flatShading: true,
  });
  const hornMat = new THREE.MeshStandardMaterial({ color: 0x1a0e0a, roughness: 0.5, metalness: 0.35, flatShading: true });
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xd8c8a8, roughness: 0.5, metalness: 0.05, flatShading: true });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffb04a });
  const clawMat = new THREE.MeshStandardMaterial({ color: 0x110908, roughness: 0.42, metalness: 0.4, flatShading: true });

  const M = (geo, mat, x, y, z, parent) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = true;
    if (parent) parent.add(m);
    return m;
  };
  const RB = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 2, Math.max(0.005, Math.min(r ?? Math.min(w, h, d) * 0.22, Math.min(w, h, d) * 0.45)));
  const boneBetween = (a, b, rad, mat, parent) => {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(rad * 0.7, rad, len, 7, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = true; parent.add(mesh);
    return mesh;
  };

  // body, chest and haunches
  const body = M(new THREE.SphereGeometry(1, 18, 14), scaleMat, 0, 3.0, 0, root);
  body.scale.set(1.55, 1.22, 2.45);
  const chest = M(new THREE.SphereGeometry(1, 16, 12), scaleMat, 0, 2.92, 1.35, root);
  chest.scale.set(1.36, 1.1, 1.25);
  const haunch = M(new THREE.SphereGeometry(1, 16, 12), scaleMat, 0, 2.55, -1.45, root);
  haunch.scale.set(1.38, 1.08, 1.35);
  const belly = M(new THREE.SphereGeometry(1, 16, 12), bellyMat, 0, 2.36, 0.15, root);
  belly.scale.set(1.16, 0.62, 2.0);

  // neck and head
  const neck = new THREE.Group(); neck.position.set(0, 3.4, 1.4); root.add(neck);
  for (let i = 0; i < 3; i++) {
    const seg = M(new THREE.SphereGeometry(1, 14, 10), scaleMat, 0, 0.22 + i * 0.5, 0.48 + i * 0.42, neck);
    const sc = 0.72 - i * 0.07;
    seg.scale.set(sc, sc * 1.02, sc * 1.18);
    if (i < 2) {
      for (const s of [-1, 1]) {
        const sn = M(new THREE.ConeGeometry(0.075, 0.42, 5), hornMat, s * (0.5 - i * 0.04), 0.1 + i * 0.5, 0.05 + i * 0.42, neck);
        sn.rotation.z = s * 1.15; sn.rotation.x = -0.35;
      }
    }
  }
  const head = new THREE.Group(); head.position.set(0, 1.72, 1.62); head.scale.setScalar(1.22); neck.add(head);
  const skull = M(new THREE.SphereGeometry(1, 18, 14), scaleMat, 0, 0, 0.06, head);
  skull.scale.set(0.94, 0.74, 1.06);
  const snout = M(RB(1.02, 0.6, 1.62, 0.14), scaleMat, 0, -0.22, 1.06, head);
  snout.rotation.x = 0.05;
  const brow = M(RB(1.22, 0.24, 0.52, 0.08), scaleMat, 0, 0.4, 0.34, head);
  brow.rotation.x = -0.12;
  const jaw = new THREE.Group(); jaw.position.set(0, -0.38, 0.28); head.add(jaw);
  const lowerJaw = M(RB(0.78, 0.24, 1.18, 0.09), bellyMat, 0, -0.06, 0.62, jaw);
  for (let i = 0; i < 4; i++) {
    const s = i < 2 ? -1 : 1;
    const tooth = M(new THREE.ConeGeometry(0.045, 0.24, 5), toothMat, s * (0.22 + (i % 2) * 0.08), -0.12, 0.78 + (i % 2) * 0.2, jaw);
    tooth.rotation.x = Math.PI;
  }
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? -1 : 1;
    const tooth = M(new THREE.ConeGeometry(0.04, 0.2, 5), toothMat, s * (0.18 + (i % 3) * 0.1), -0.3, 0.98 + (i % 2) * 0.16, head);
    tooth.rotation.x = Math.PI;
  }
  const eyes = [], eyeGlows = [];
  for (const s of [-1, 1]) {
    const socket = M(new THREE.SphereGeometry(0.14, 10, 8), hornMat, s * 0.5, 0.2, 0.62, head);
    socket.scale.set(1, 0.72, 0.6);
    const eye = M(new THREE.SphereGeometry(0.085, 10, 8), eyeMat, s * 0.53, 0.21, 0.71, head);
    eye.scale.set(1, 0.7, 0.55); eyes.push(eye);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xffb04a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
    glow.scale.setScalar(0.62); glow.position.set(s * 0.53, 0.21, 0.78); head.add(glow); eyeGlows.push(glow);
    const ridge = M(RB(0.34, 0.11, 0.42, 0.03), hornMat, s * 0.5, 0.4, 0.5, head);
    ridge.rotation.z = s * 0.2;
    // horns sweeping back over the neck
    const hornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.52, 0.5, -0.04),
      new THREE.Vector3(s * 0.98, 1.02, -0.46),
      new THREE.Vector3(s * 0.86, 0.72, -1.38),
    ]);
    const horn = new THREE.Mesh(new THREE.TubeGeometry(hornCurve, 12, 0.1, 7, false), hornMat);
    horn.castShadow = true; head.add(horn);
    const cheekHorn = M(new THREE.ConeGeometry(0.075, 0.52, 5), hornMat, s * 0.64, -0.1, 0.35, head);
    cheekHorn.rotation.z = s * 1.1; cheekHorn.rotation.x = 0.3;
  }
  for (const s of [-1, 1]) {
    const nostril = M(new THREE.SphereGeometry(0.075, 8, 6), hornMat, s * 0.23, -0.04, 1.84, head);
    nostril.scale.set(1, 0.8, 0.6);
  }
  const crest = M(new THREE.ConeGeometry(0.24, 1.0, 5), hornMat, 0, 0.74, -0.3, head);
  crest.rotation.x = -0.55;
  const crest2 = M(new THREE.ConeGeometry(0.16, 0.62, 5), hornMat, 0, 0.5, -0.78, head);
  crest2.rotation.x = -0.8;
  const mouthGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff5a18, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  mouthGlow.scale.setScalar(2.0); mouthGlow.position.set(0, -0.32, 1.05); head.add(mouthGlow);

  // wings
  function makeWing(side) {
    const wing = new THREE.Group();
    wing.position.set(side * 1.05, 3.72, 0.15);
    root.add(wing);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(5.4, 1.6);
    shape.lineTo(7.0, 0.1);
    shape.lineTo(4.9, -1.95);
    shape.lineTo(2.3, -1.12);
    shape.lineTo(0, -0.32);
    shape.closePath();
    const membrane = new THREE.Mesh(new THREE.ShapeGeometry(shape), membraneMat);
    membrane.rotation.x = -Math.PI / 2;
    membrane.rotation.z = 0.06 * side;
    membrane.scale.x = side;
    membrane.castShadow = true;
    wing.add(membrane);
    const p0 = new THREE.Vector3(0, 0, 0);
    boneBetween(p0, new THREE.Vector3(side * 6.3, 0.06, -1.45), 0.13, hornMat, wing);
    boneBetween(p0, new THREE.Vector3(side * 4.8, 0.03, 1.6), 0.09, hornMat, wing);
    for (let i = 0; i < 3; i++) {
      const t = 0.25 + i * 0.22;
      boneBetween(new THREE.Vector3(side * 6.1 * t, 0.02, -1.2 * t), new THREE.Vector3(side * (5.4 - i * 0.45), 0.01, 1.5 - i * 0.6), 0.05, hornMat, wing);
    }
    const claw = M(new THREE.ConeGeometry(0.11, 0.62, 5), hornMat, side * 7.0, 0.06, 0.05, wing);
    claw.rotation.z = side * -Math.PI / 2;
    return wing;
  }
  const wingL = makeWing(-1), wingR = makeWing(1);

  // tail
  const tail = new THREE.Group(); tail.position.set(0, 2.6, -2.15); root.add(tail);
  for (let i = 0; i < 6; i++) {
    const seg = M(new THREE.SphereGeometry(1, 10, 8), scaleMat, 0, -i * 0.14, -i * 0.82, tail);
    const sc = 0.62 - i * 0.085;
    seg.scale.set(sc, sc * 0.9, sc * 1.3);
    if (i >= 3) {
      const spike = M(new THREE.ConeGeometry(0.12, 0.48, 5), hornMat, 0, 0.52 - i * 0.06, -i * 0.82, tail);
      spike.rotation.x = -0.8;
    }
  }
  const tailTip = M(new THREE.ConeGeometry(0.2, 0.82, 6), hornMat, 0, -0.95, -5.2, tail);
  tailTip.rotation.x = Math.PI / 2;

  // back spikes
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const spike = M(new THREE.ConeGeometry(0.12 + t * 0.06, 0.58 + t * 0.35, 5), hornMat, 0, 4.12 - t * 0.3, 1.2 - t * 3.15, root);
    spike.rotation.x = -0.45;
  }

  // legs and claws
  function leg(x, z, front) {
    const hip = new THREE.Group(); hip.position.set(x, front ? 2.45 : 2.15, z); root.add(hip);
    const upper = M(new THREE.CylinderGeometry(0.24, 0.32, 1.0, 7), scaleMat, 0, -0.48, 0, hip);
    upper.rotation.x = front ? -0.12 : 0.1;
    const knee = new THREE.Group(); knee.position.set(0, -1.0, 0); hip.add(knee);
    M(new THREE.CylinderGeometry(0.16, 0.24, 0.9, 7), scaleMat, 0, -0.44, 0, knee);
    const foot = M(RB(0.48, 0.24, 0.72, 0.06), bellyMat, 0, -0.96, 0.16, knee);
    for (let c = 0; c < 3; c++) {
      const claw = M(new THREE.ConeGeometry(0.06, 0.3, 5), clawMat, (c - 1) * 0.14, -1.05, 0.55, knee);
      claw.rotation.x = Math.PI / 2;
    }
    return hip;
  }
  const legFL = leg(-0.9, 1.25, true), legFR = leg(0.9, 1.25, true);
  const legBL = leg(-1.0, -1.4, false), legBR = leg(1.0, -1.4, false);

  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff4a12, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  aura.scale.set(9, 7, 1); aura.position.y = 3.1; root.add(aura);

  const keyLight = new THREE.PointLight(0xff8040, 16, 36, 1.75);
  keyLight.position.set(0, 7.5, 13); g.add(keyLight);
  const fillLight = new THREE.PointLight(0xff3a12, 7, 28, 1.8);
  fillLight.position.set(-8, 4.5, 4); g.add(fillLight);

  g.scale.setScalar(DRAGON_BASE_SCALE);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, parts: { root, body, chest, neck, head, jaw, mouthGlow, wingL, wingR, tail, legFL, legFR, legBL, legBR, eyes, eyeGlows, aura, keyLight, fillLight, scaleMat, membraneMat } };
}
const dragonK = buildDragon();
scene.add(dragonK.group); dragonK.group.name = 'dragon'; dragonK.group.visible = false;
const dragonShadow = blobShadow(5.2, 0.42); dragonShadow.visible = false;

// Korvath — a cursed wolf-knight with a black eclipse blade.
const fangK = buildKnight({ scale: FANG_BASE_SCALE, armor: 0x202029, trim: 0xa32343, cloth: 0x260916, plume: 0x241c2a, emissive: 0xff274f, weapon: 'greatsword' });
scene.add(fangK.group); fangK.group.name = 'fang'; fangK.group.visible = false;
const fangShadow = blobShadow(3.4, 0.44); fangShadow.visible = false;
{
  const p = fangK.parts;
  p.shield.visible = false;
  const furMat = new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 0.96, metalness: 0.02, map: furTex, bumpMap: furTex, bumpScale: 0.02 });
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xc9b9ad, roughness: 0.65, metalness: 0.05 });
  [-1, 1].forEach(side => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.36, 5), furMat);
    ear.position.set(0.115 * side, 0.345, -0.01);
    ear.rotation.x = -0.12; ear.rotation.z = -side * 0.18;
    ear.castShadow = true; p.head.add(ear);
  });
  const snout = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.10, 0.15, 2, 0.03), furMat);
  snout.position.set(0, 0.015, 0.235); snout.castShadow = true; p.head.add(snout);
  [-1, 1].forEach(side => {
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.075, 4), boneMat);
    fang.position.set(0.045 * side, -0.035, 0.30); fang.rotation.x = Math.PI; p.head.add(fang);
  });
  p.tail = new THREE.Group(); p.tail.position.set(0, 0.04, -0.27); p.hips.add(p.tail);
  p.tailSegs = [];
  let tailParent = p.tail;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group();
    seg.position.z = i === 0 ? -0.12 : -0.19;
    tailParent.add(seg);
    const part = new THREE.Mesh(new THREE.CapsuleGeometry(0.055 - i * 0.006, 0.22, 4, 7), furMat);
    part.rotation.x = Math.PI / 2; part.position.z = -0.10; part.castShadow = true; seg.add(part);
    p.tailSegs.push(seg); tailParent = seg;
  }
  const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 6), furMat);
  tuft.rotation.x = -Math.PI / 2; tuft.position.z = -0.16; tailParent.add(tuft);

  const auraMat = new THREE.MeshBasicMaterial({ color: 0xff2a5e, transparent: true, opacity: 0.20, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const auraRing = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.34, 56), auraMat);
  auraRing.rotation.x = -Math.PI / 2; auraRing.position.y = 0.035; fangK.group.add(auraRing);
  p.auraRing = auraRing; p.auraMat = auraMat;

  const swordG = p.sword;
  while (swordG.children.length) swordG.remove(swordG.children[0]);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x0b0910, metalness: 0.92, roughness: 0.30, emissive: 0x9c1030, emissiveIntensity: 0.95 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x5a2434, metalness: 1.0, roughness: 0.26, emissive: 0xff2a5e, emissiveIntensity: 0.55 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a0e15, roughness: 0.95 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.44, 0.055), bladeMat);
  blade.position.y = -0.84; blade.castShadow = true; swordG.add(blade);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.022, 1.42, 0.062), edgeMat);
  edge.position.set(0.072, -0.84, 0); swordG.add(edge);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.30, 4), bladeMat);
  tip.position.y = -1.70; tip.rotation.x = Math.PI; tip.rotation.y = Math.PI / 4; tip.castShadow = true; swordG.add(tip);
  for (let i = 0; i < 7; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 4), bladeMat);
    tooth.position.set(-0.095, -0.30 - i * 0.15, 0); tooth.rotation.z = Math.PI / 2; swordG.add(tooth);
  }
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.12), edgeMat);
  guard.position.y = -0.10; guard.castShadow = true; swordG.add(guard);
  [-1, 1].forEach(side => {
    const quillon = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.20, 4), edgeMat);
    quillon.position.set(side * 0.25, -0.05, 0); quillon.rotation.z = side * 0.8; swordG.add(quillon);
  });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.048, 0.34, 10), gripMat);
  grip.position.y = 0.08; swordG.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), edgeMat);
  pommel.position.y = 0.28; swordG.add(pommel);
  const bladeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.23, 1.46, 0.09),
    new THREE.MeshBasicMaterial({ color: 0xff2a5e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  bladeGlow.position.y = -0.84; swordG.add(bladeGlow); p.swordGlow = bladeGlow;
  const trail = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.78),
    new THREE.MeshBasicMaterial({ color: 0xff2a5e, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  trail.position.y = -0.84; swordG.add(trail); p.trail = trail;
  p.visor.material.emissive.setHex(0xff274f);
  const eyeMat = new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff274f, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  p.eyeGlows = [];
  [-1, 1].forEach(side => {
    const eye = new THREE.Sprite(eyeMat.clone());
    eye.position.set(0.062 * side, 0.095, 0.222); eye.scale.setScalar(0.095);
    p.head.add(eye); p.eyeGlows.push(eye);
  });
  p.keyLight = new THREE.PointLight(0xc9a6ff, 34, 24, 1.8); p.keyLight.position.set(2.8, 5.2, 6.0); fangK.group.add(p.keyLight);
  p.fillLight = new THREE.PointLight(0xff2a5e, 11, 22, 1.9); p.fillLight.position.set(-5.5, 3.2, 1.5); fangK.group.add(p.fillLight);
}


// The Hollow Choir — two bound celebrants, one gaunt cantor and one bell-ringer.
const duoAK = buildKnight({ scale: DUO_A_BASE_SCALE, armor: 0xcabf9f, trim: 0xe4c470, cloth: 0x2a2116, plume: 0xe8d9a8, emissive: 0xffe6a0, weapon: 'longsword' });
scene.add(duoAK.group); duoAK.group.name = 'duo-vesper'; duoAK.group.visible = false;
const duoBK = buildKnight({ scale: DUO_B_BASE_SCALE, armor: 0x493d2b, trim: 0xb98a42, cloth: 0x3a1410, plume: 0x1c130d, emissive: 0xff8a3a, weapon: 'greatsword' });
scene.add(duoBK.group); duoBK.group.name = 'duo-morrow'; duoBK.group.visible = false;
const duoAShadow = blobShadow(2.9, 0.40); duoAShadow.visible = false;
const duoBShadow = blobShadow(3.9, 0.46); duoBShadow.visible = false;
{
  const p = duoAK.parts;
  p.shield.visible = false;
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xf0d9a0, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.018, 6, 40), haloMat);
  halo.position.set(0, 1.08, -0.04); halo.rotation.x = Math.PI / 2; p.body.add(halo); p.halo = halo; p.haloMat = haloMat;
  const maskMat = new THREE.MeshStandardMaterial({ color: 0xefe2bb, metalness: 0.55, roughness: 0.36, emissive: 0xe4c470, emissiveIntensity: 0.42 });
  const mask = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.24, 0.08, 3, 0.04), maskMat);
  mask.position.set(0, 0.05, 0.205); p.head.add(mask);
  for (let i = 0; i < 4; i++) {
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.07, 0.02), new THREE.MeshBasicMaterial({ color: 0x080604 }));
    notch.position.set((i - 1.5) * 0.046, 0.15, 0.252); notch.rotation.z = (i - 1.5) * 0.18; p.head.add(notch);
  }
  const wickMat = new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  p.candles = [];
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.34;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.34 + i * 0.05, 6), new THREE.MeshStandardMaterial({ color: 0xd8cba8, roughness: 0.8 }));
    stick.position.set(Math.sin(a) * 0.24, 0.72 + i * 0.04, -0.20 + Math.cos(a) * 0.03); p.body.add(stick);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xffe6a0, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.scale.setScalar(0.18); flame.position.set(stick.position.x, stick.position.y + 0.22, stick.position.z); p.body.add(flame); p.candles.push(flame);
  }
  p.visor.material.emissive.setHex(0xffe6a0);
  p.keyLight = new THREE.PointLight(0xffe6a0, 22, 18, 1.9); p.keyLight.position.set(1.2, 3.4, 2.4); duoAK.group.add(p.keyLight);
}
{
  const p = duoBK.parts;
  p.shield.visible = false;
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0x3b2c1e, metalness: 0.38, roughness: 0.82, map: leatherTex });
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 16), bellyMat);
  belly.position.set(0, 0.12, 0.24); belly.scale.set(1.06, 0.92, 0.72); belly.castShadow = true; p.torso.add(belly);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.22, 0.04), new THREE.MeshStandardMaterial({ color: 0x9b7438, metalness: 0.75, roughness: 0.42 }));
  plate.position.set(0, 0.08, 0.055); belly.add(plate);
  for (let i = 0; i < 4; i++) {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.30 + i * 0.025, 0.012, 4, 18), new THREE.MeshStandardMaterial({ color: 0x806028, metalness: 0.9, roughness: 0.45 }));
    chain.position.set(0, 0.62, -0.02); chain.rotation.x = Math.PI / 2; p.torso.add(chain);
  }
  const bellMat = new THREE.MeshStandardMaterial({ color: 0x9b7438, metalness: 0.92, roughness: 0.34, emissive: 0x6b3e12, emissiveIntensity: 0.45 });
  const bell = new THREE.Group(); bell.position.set(0, -0.42, 0.06); p.armL.hand.add(bell);
  const bellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.30, 0.38, 12, 1, true), bellMat);
  bellBody.position.y = -0.18; bellBody.castShadow = true; bell.add(bellBody);
  const bellLip = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.035, 6, 18), bellMat);
  bellLip.position.y = -0.37; bellLip.rotation.x = Math.PI / 2; bell.add(bellLip);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2a1b0c, metalness: 0.8, roughness: 0.5 }));
  clapper.position.y = -0.40; bell.add(clapper);
  p.bell = bell; p.bellMat = bellMat;
  p.visor.material.emissive.setHex(0xff8a3a);
  p.keyLight = new THREE.PointLight(0xff8a3a, 18, 18, 1.9); p.keyLight.position.set(-1.8, 3.0, 2.2); duoBK.group.add(p.keyLight);
}

const witchShadow = blobShadow(3.1, 0.36); witchShadow.visible = false;
const witchLunarAura = (() => {
  const group = new THREE.Group(); group.visible = false; witchK.group.add(group);
  const glowMat = new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xcfe2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const glow = new THREE.Sprite(glowMat); glow.scale.setScalar(5.2); glow.position.y = 1.35; group.add(glow);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf0f6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.018, 6, 56), ringMat);
  ring.rotation.x = Math.PI / 2; ring.position.y = 1.5; group.add(ring);
  const light = new THREE.PointLight(0xcfe2ff, 0, 9, 2); light.position.y = 1.4; group.add(light);
  return { group, glow, glowMat, ring, ringMat, light, t: 0 };
})();

const LUNAR_BASE = new THREE.Vector3(WITCH_CENTER.x - 46, 44, WITCH_CENTER.z - 72);
const LUNAR_HOVER = new THREE.Vector3(WITCH_CENTER.x + 6.2, 14, WITCH_CENTER.z + 2.0);
const lunarImpactPoint = new THREE.Vector3(WITCH_CENTER.x + 6.2, 0, WITCH_CENTER.z + 2.0);
const lunarAvatar = (() => {
  const group = new THREE.Group(); group.name = 'lunar-avatar'; group.visible = false; scene.add(group);
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xe8d6de, emissive: 0x8a2346, emissiveIntensity: 0.45, roughness: 0.96, metalness: 0.01 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(3.4, 40, 28), coreMat); group.add(core);
  const craterMat = new THREE.MeshBasicMaterial({ color: 0x8d3652, transparent: true, opacity: 0.22, depthWrite: false });
  const craterGeo = new THREE.SphereGeometry(1, 12, 8);
  const up = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < 12; i++) {
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    if (dir.lengthSq() < 0.04) dir.set(0.6, 0.2, 0.5);
    dir.normalize();
    const crater = new THREE.Mesh(craterGeo, craterMat);
    crater.position.copy(dir).multiplyScalar(3.35);
    const sc = 0.35 + Math.random() * 0.65;
    crater.scale.set(sc, sc * (0.7 + Math.random() * 0.6), 0.1);
    crater.quaternion.setFromUnitVectors(up, dir);
    core.add(crater);
  }
  const glowMat = new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff8fae, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const glow = new THREE.Sprite(glowMat); glow.scale.setScalar(14); group.add(glow);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd0df, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.065, 8, 72), ringMat);
  ring.rotation.x = 0.52; ring.rotation.y = 0.2; group.add(ring);
  const light = new THREE.PointLight(0xff86ab, 0, 70, 1.6); group.add(light);
  return { group, core, coreMat, glow, glowMat, ring, ringMat, light, t: 0, sparkT: 0 };
})();

// cloth simulation: cache rest positions, then let capes breathe and billow
function cacheCloth(mesh, amp = 1) {
  if (!mesh) return;
  const p = mesh.geometry.attributes.position;
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  mesh.userData.cloth = { base: Float32Array.from(p.array), y0, y1, amp };
}
for (const K of [playerK, bossK]) { cacheCloth(K.parts.cape, 0.9); cacheCloth(K.parts.cape2, 1.25); }
for (const panel of witchK.parts.skirtPanels) cacheCloth(panel, 0.5);
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
function weightedLootPick(pool) {
  let total = 0;
  for (const d of pool) total += DROP_WEIGHTS[d.id] || 1;
  let r = Math.random() * total;
  for (const d of pool) {
    r -= DROP_WEIGHTS[d.id] || 1;
    if (r <= 0) return d;
  }
  return pool[pool.length - 1];
}
function lootOwned(d) {
  return d.type === 'weapon' ? P.owned.includes(d.id) : P.spoils.includes(d.id);
}
function lootPoolFor(bossId, type) {
  if (type === 'weapon') return SWORD_DROPS;
  const shard = bossId ? bossShardFor(bossId) : null;
  return shard ? [...SPOIL_DROPS, { ...shard, type: 'spoils' }] : SPOIL_DROPS;
}
function rollDrops(bossId = null) {
  const out = [], used = new Set();
  for (let i = 0; i < 3; i++) {
    let type = Math.random() < 0.5 ? 'weapon' : 'spoils';
    let pool = lootPoolFor(bossId, type).filter(d => !used.has(d.id) && !lootOwned(d));
    if (!pool.length) {
      type = type === 'weapon' ? 'spoils' : 'weapon';
      pool = lootPoolFor(bossId, type).filter(d => !used.has(d.id) && !lootOwned(d));
    }
    if (!pool.length) pool = lootPoolFor(bossId, type).filter(d => !used.has(d.id));
    if (!pool.length) pool = lootPoolFor(bossId, type);
    const pick = weightedLootPick(pool);
    used.add(pick.id);
    out.push({ ...pick });
  }
  return out;
}
function bossDropsFor(id) { return rollDrops(id); }

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
const fxRingGeo = new THREE.RingGeometry(0.8, 1.0, 40);
function spawnRing(pos, color = 0xffb52e, maxR = 6) {
  const m = new THREE.Mesh(fxRingGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y = 0.12;
  m.userData = { r: 1, maxR }; scene.add(m); rings.push(m);
}

// ============ BOSS HAZARDS: telegraphed fire pillars ============
const pillars = [];
const pillarRingGeo = new THREE.RingGeometry(0.78, 1.0, 44);
const pillarFillGeo = new THREE.CircleGeometry(0.78, 28);
const meteorCoreMat = new THREE.MeshBasicMaterial({ color: 0xffc46a });
const meteorGlowMat = new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff5a12, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
function spawnFirePillar(x, z, delay = 2.0, radius = 2.2, dmg = 34, mult = 1, fromSky = false) {
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
  let meteor = null;
  if (fromSky) {
    meteor = new THREE.Group();
    meteor.add(new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 0.34, 1), meteorCoreMat));
    const mGlow = new THREE.Sprite(meteorGlowMat); mGlow.scale.setScalar(radius * 2.0); meteor.add(mGlow);
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(i % 2 ? flameCoreMat : flameOuterMat);
      s.position.set((Math.random() - 0.5) * radius * 0.8, (Math.random() - 0.5) * radius * 0.8, (Math.random() - 0.5) * radius * 0.8);
      s.scale.set(radius * 1.2, radius * 2.1, 1);
      meteor.add(s);
    }
    meteor.position.y = 12 + Math.random() * 3;
    grp.add(meteor);
  }
  pillars.push({ grp, ring, fill, ringMat, fillMat, fire, x, z, radius, dmg, mult, t: 0, delay, state: 'indicator', eruptT: 0, meteor });
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
      if (p.meteor) {
        p.meteor.position.y = 13 * (1 - k) + 0.9;
        p.meteor.rotation.y += dt * 3.4; p.meteor.rotation.x += dt * 2.2;
        if (Math.random() < 0.6) spawnSparks(new THREE.Vector3(p.x + (Math.random() - 0.5) * 1.2, p.meteor.position.y, p.z + (Math.random() - 0.5) * 1.2), 1, Math.random() < 0.5 ? 0xff5a1e : 0xffd27a, 2.6);
      }
      if (p.t >= p.delay) {
        p.state = 'erupt'; p.eruptT = 0;
        if (p.meteor) p.meteor.visible = false;
        p.fire.visible = true; p.ring.visible = false; p.fill.visible = false;
        sfx.pillar(); G.shake = Math.max(G.shake, 0.4);
        spawnRing(new THREE.Vector3(p.x, 0, p.z), 0xff7a24, p.radius * 2.6);
        spawnSparks(new THREE.Vector3(p.x, 0.5, p.z), p.meteor ? 32 : 18, p.meteor ? 0xffb052 : 0xff8a3a, p.meteor ? 8 : 6);
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
  clearFireBolts(); clearFireWaves(); hideInfernoFX();
  stopDragonBreath();
}

// ============ ASHEN LORD HAZARDS: fireballs, flame waves, inferno barrages ============
const fireBolts = [];
const fireBoltGeo = new THREE.SphereGeometry(0.28, 12, 10);
const fireBoltCoreMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
const fireBoltShellMat = new THREE.MeshBasicMaterial({ color: 0xff5a12, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false });
const fireBoltGlowMat = new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff7a24, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });

function spawnFireBolt(origin, angle, speed, dmg, delay = 0, homing = 0) {
  const grp = new THREE.Group();
  const core = new THREE.Mesh(fireBoltGeo, fireBoltCoreMat); grp.add(core);
  const shell = new THREE.Mesh(fireBoltGeo, fireBoltShellMat); shell.scale.setScalar(1.65); grp.add(shell);
  const glow = new THREE.Sprite(fireBoltGlowMat); glow.scale.setScalar(2.4); grp.add(glow);
  grp.position.copy(origin); grp.visible = delay <= 0;
  scene.add(grp);
  fireBolts.push({
    grp, dir: new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)),
    speed, dmg, t: 0, delay, life: 5, hit: false, homing, seed: Math.random() * Math.PI * 2,
  });
}
function spawnFireBoltVolley(count = 5, spread = 0.15, speed = 10.5, dmg = 34) {
  const origin = new THREE.Vector3(B.pos.x, 2.2, B.pos.z);
  const base = Math.atan2(P.pos.x - B.pos.x, P.pos.z - B.pos.z);
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * spread + (Math.random() - 0.5) * 0.035;
    spawnFireBolt(origin, base + off, speed + Math.random() * 0.9, dmg, i * 0.075, i === (count / 2 | 0) ? 0.5 : 0);
  }
  sfx.cast();
}
function removeFireBolt(i) {
  const b = fireBolts[i]; if (!b) return;
  scene.remove(b.grp); fireBolts.splice(i, 1);
}
function updateFireBolts(dt) {
  for (let i = fireBolts.length - 1; i >= 0; i--) {
    const b = fireBolts[i];
    if (!b) continue;
    if (b.delay > 0) { b.delay -= dt; if (b.delay <= 0) b.grp.visible = true; continue; }
    b.t += dt; b.life -= dt;
    if (b.homing > 0) {
      const want = Math.atan2(P.pos.x - b.grp.position.x, P.pos.z - b.grp.position.z);
      const cur = Math.atan2(b.dir.x, b.dir.z);
      const na = cur + angDiff(want, cur) * Math.min(1, b.homing * dt);
      b.dir.set(Math.sin(na), 0, Math.cos(na));
    }
    b.grp.position.addScaledVector(b.dir, b.speed * dt);
    b.grp.position.y = 1.28 + Math.sin(b.t * 9 + b.seed) * 0.12;
    b.grp.rotation.y += dt * 8;
    if (Math.random() < 0.55) spawnSparks(b.grp.position, 1, Math.random() < 0.5 ? 0xff5a1e : 0xffd27a, 1.8);
    if (P.state !== 'dead' && Math.hypot(P.pos.x - b.grp.position.x, P.pos.z - b.grp.position.z) < 0.78) {
      b.hit = true;
      damagePlayer(b.dmg, b.grp.position, 'fireball');
      spawnRing(new THREE.Vector3(b.grp.position.x, 0, b.grp.position.z), 0xff8a2a, 3.4);
      spawnSparks(b.grp.position, 16, 0xffa03a, 6);
      G.shake = Math.max(G.shake, 0.25);
      removeFireBolt(i); continue;
    }
    const dx = b.grp.position.x, dz = b.grp.position.z;
    if (b.life <= 0 || Math.hypot(dx, dz) > ARENA_R + 3) removeFireBolt(i);
  }
}
function clearFireBolts() {
  for (let i = fireBolts.length - 1; i >= 0; i--) removeFireBolt(i);
}

const fireWaves = [];
const fireWaveGeo = new THREE.RingGeometry(0.9, 1.0, 64);
function spawnFireWave(cx, cz, dmg, speed = 12, maxR = ARENA_R + 1.5, color = 0xff7a24) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(fireWaveGeo, mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(cx, 0.11, cz); mesh.scale.setScalar(0.7);
  scene.add(mesh);
  fireWaves.push({ mesh, mat, cx, cz, r: 0.7, maxR, speed, dmg, hit: false, t: 0 });
}
function updateFireWaves(dt) {
  for (let i = fireWaves.length - 1; i >= 0; i--) {
    const w = fireWaves[i];
    if (!w) continue;
    w.t += dt;
    w.r += w.speed * dt;
    w.mesh.scale.setScalar(w.r);
    w.mat.opacity = 0.92 * Math.max(0, 1 - w.r / w.maxR);
    if (Math.random() < 0.7) {
      const a = Math.random() * Math.PI * 2;
      spawnSparks(new THREE.Vector3(w.cx + Math.cos(a) * w.r, 0.25, w.cz + Math.sin(a) * w.r), 1, Math.random() < 0.5 ? 0xff5a1e : 0xffc861, 2.2);
    }
    if (!w.hit && P.state !== 'dead') {
      const d = Math.hypot(P.pos.x - w.cx, P.pos.z - w.cz);
      if (Math.abs(d - w.r) < 0.82) { w.hit = true; damagePlayer(w.dmg, new THREE.Vector3(w.cx, 0, w.cz), 'firewave'); }
    }
    if (w.r >= w.maxR) { scene.remove(w.mesh); w.mat.dispose(); fireWaves.splice(i, 1); }
  }
}
function clearFireWaves() {
  for (let i = fireWaves.length - 1; i >= 0; i--) { const w = fireWaves[i]; scene.remove(w.mesh); w.mat.dispose(); fireWaves.splice(i, 1); }
}

function clampArenaSpot(x, z, pad = 2.2) {
  const d = Math.hypot(x, z), lim = ARENA_R - pad;
  if (d > lim && d > 1e-4) return { x: x / d * lim, z: z / d * lim };
  return { x, z };
}
function spawnInfernoBarrage(mult = 1) {
  const cx = B.pos.x, cz = B.pos.z;
  const rings = [
    { r: 3.2, count: 8, delay: 0.18, step: 0.035 },
    { r: 6.9, count: 10, delay: 0.62, step: 0.03 },
    { r: 10.7, count: 13, delay: 1.1, step: 0.022 },
  ];
  const baseA = Math.random() * Math.PI * 2;
  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri];
    for (let i = 0; i < ring.count; i++) {
      const a = baseA + i / ring.count * Math.PI * 2 + ri * 0.37;
      const spot = clampArenaSpot(cx + Math.cos(a) * ring.r, cz + Math.sin(a) * ring.r);
      spawnFirePillar(spot.x, spot.z, ring.delay + i * ring.step, 1.8, TUNE.bossDmg.pillar, mult);
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, r = 2.4 + Math.random() * 5.4;
    const spot = clampArenaSpot(P.pos.x + Math.cos(a) * r, P.pos.z + Math.sin(a) * r);
    spawnFirePillar(spot.x, spot.z, 1.35 + Math.random() * 0.55, 1.7, TUNE.bossDmg.pillar, mult);
  }
  sfx.pillarWarn();
  showSub('THE RING IS A FURNACE — FIND THE GAPS');
}
function spawnMeteorStorm(mult = 1) {
  const gap = Math.random() * Math.PI * 2;
  const gapHalf = 0.72;
  const ringR = 5.1;
  for (let i = 0; i < 6; i++) {
    let a, r;
    if (i === 0) {
      a = gap; r = 0;
    } else {
      a = gap + gapHalf + (i - 1) / 5 * (Math.PI * 2 - gapHalf * 2);
      r = ringR;
    }
    const spot = clampArenaSpot(P.pos.x + Math.cos(a) * r, P.pos.z + Math.sin(a) * r, 2.6);
    spawnFirePillar(spot.x, spot.z, 1.25, 2.35, TUNE.bossDmg.meteor, mult, true);
  }
  sfx.pillarWarn();
  showSub('THE SKY BURNS — ONE VOLLEY, FIND THE GAP');
}
function hideInfernoFX() {
  infernoOrb.group.visible = false;
  infernoOrb.light.intensity = 0;
  infernoMark.group.visible = false;
}

// ============ WITCH HAZARDS: hex bolts, curse circles, veil waves ============
const hexBolts = [];
const hexBoltGeo = new THREE.SphereGeometry(0.2, 8, 6);
const hexBoltCoreMat = new THREE.MeshBasicMaterial({ color: 0xe6d2ff });
function spawnHexBolt(origin, angle, speed, dmg) {
  const grp = new THREE.Group();
  const core = new THREE.Mesh(hexBoltGeo, hexBoltCoreMat); grp.add(core);
  const glow = new THREE.Sprite(hexEmberMat); glow.scale.setScalar(1.1); grp.add(glow);
  grp.position.copy(origin);
  const vel = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(speed);
  scene.add(grp);
  hexBolts.push({ grp, vel, life: 4.2, dmg, t: 0 });
}
function spawnHexBoltVolley(count, spread, speed, dmg) {
  const origin = new THREE.Vector3(W.pos.x, 2.0, W.pos.z);
  const base = Math.atan2(P.pos.x - W.pos.x, P.pos.z - W.pos.z);
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * spread;
    spawnHexBolt(origin, base + off, speed + Math.random() * 0.8, dmg);
  }
  sfx.cast();
}
function updateHexBolts(dt) {
  for (let i = hexBolts.length - 1; i >= 0; i--) {
    const b = hexBolts[i];
    if (!b) continue;
    b.t += dt; b.life -= dt;
    b.grp.position.addScaledVector(b.vel, dt);
    b.grp.position.y = 1.25 + Math.sin(b.t * 8) * 0.12;
    b.grp.rotation.y += dt * 9;
    if (Math.random() < 0.5) spawnSparks(b.grp.position, 1, 0x9b5cff, 0.7);
    if (P.state !== 'dead' && Math.hypot(P.pos.x - b.grp.position.x, P.pos.z - b.grp.position.z) < 0.72) {
      damagePlayer(b.dmg, b.grp.position, 'hex');
      removeHexBolt(i); continue;
    }
    const dx = b.grp.position.x - ARENA.center.x, dz = b.grp.position.z - ARENA.center.z;
    if (b.life <= 0 || Math.hypot(dx, dz) > ARENA.radius + 5) removeHexBolt(i);
  }
}
function removeHexBolt(i) {
  const b = hexBolts[i]; if (!b) return;
  scene.remove(b.grp); hexBolts.splice(i, 1);
}
function clearHexBolts() {
  for (let i = hexBolts.length - 1; i >= 0; i--) removeHexBolt(i);
}

const hexPillars = [];
function spawnHexPillar(x, z, delay = 1.2, radius = 2.0, dmg = 44, mult = 1, lunar = false, theme = 'witch') {
  const isFang = theme === 'fang';
  const grp = new THREE.Group(); grp.position.set(x, 0, z); scene.add(grp);
  const ringMat = new THREE.MeshBasicMaterial({ color: isFang ? 0xff2a5e : lunar ? 0xdce9ff : 0x9b5cff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const fillMat = new THREE.MeshBasicMaterial({ color: isFang ? 0x7a0b3a : lunar ? 0xff9ec2 : 0xd54aff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(pillarRingGeo, ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.scale.setScalar(radius); grp.add(ring);
  const fill = new THREE.Mesh(pillarFillGeo, fillMat);
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.04; fill.scale.setScalar(radius * 0.2); grp.add(fill);
  const fire = new THREE.Group(); fire.visible = false; grp.add(fire);
  const flameCount = lunar ? 4 : 6;
  for (let i = 0; i < flameCount; i++) {
    const isOuter = i % 2 === 0;
    const flameMat = isFang ? (isOuter ? eclipseFlameOuterMat : eclipseFlameCoreMat) : lunar ? (isOuter ? lunarFlameOuterMat : lunarFlameCoreMat) : (isOuter ? hexFlameOuterMat : hexFlameCoreMat);
    const s = new THREE.Sprite(flameMat);
    s.position.set((Math.random() - 0.5) * radius * 0.5, 1.0 + i * (lunar ? 1.5 : 1.05), (Math.random() - 0.5) * radius * 0.5);
    s.scale.set(radius * (isOuter ? 2.6 - i * 0.12 : 1.15), 2.0 + Math.random() * 0.7, 1);
    fire.add(s);
  }
  const glow = new THREE.Sprite(isFang ? eclipseEmberMat : lunar ? lunarEmberMat : hexEmberMat);
  glow.scale.setScalar(radius * 4.2); glow.position.y = 0.9; fire.add(glow);
  hexPillars.push({ grp, ring, fill, ringMat, fillMat, fire, x, z, radius, dmg, mult, lunar, fang: isFang, t: 0, delay, state: 'indicator', eruptT: 0 });
}
function updateHexPillars(dt) {
  for (let i = hexPillars.length - 1; i >= 0; i--) {
    const p = hexPillars[i];
    if (!p) continue;
    p.t += dt;
    if (p.state === 'indicator') {
      const k = Math.min(1, p.t / p.delay);
      const pulse = 0.55 + 0.45 * Math.sin(p.t * 14);
      p.ring.scale.setScalar(p.radius * (0.94 + pulse * 0.07));
      p.ringMat.opacity = 0.3 + pulse * 0.35;
      p.fill.scale.setScalar(p.radius * (0.2 + 0.8 * k));
      p.fillMat.opacity = 0.06 + k * 0.18 + pulse * 0.04;
      if (p.t >= p.delay) {
        p.state = 'erupt'; p.eruptT = 0;
        p.fire.visible = true; p.ring.visible = false; p.fill.visible = false;
        sfx.pillar(); G.shake = Math.max(G.shake, 0.35);
        spawnRing(new THREE.Vector3(p.x, 0, p.z), p.fang ? 0xff2a5e : p.lunar ? 0xe8f1ff : 0x9b5cff, p.radius * 2.6);
        spawnSparks(new THREE.Vector3(p.x, 0.5, p.z), p.fang ? 18 : p.lunar ? 8 : 16, p.fang ? 0xff4d6d : p.lunar ? 0xffd4e4 : 0x9b5cff, p.fang ? 7 : p.lunar ? 7 : 6);
        if (P.state !== 'dead' && Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < p.radius + 0.35) {
          damagePlayer(Math.round(p.dmg * p.mult), new THREE.Vector3(p.x, 0, p.z), 'curse');
        }
      }
    } else {
      p.eruptT += dt;
      const rise = Math.min(1, p.eruptT / 0.16);
      const fade = p.eruptT > 0.75 ? Math.max(0, 1 - (p.eruptT - 0.75) / 0.75) : 1;
      p.fire.scale.set(fade * (0.9 + rise * 0.2), rise * (0.6 + fade * 0.6), fade * (0.9 + rise * 0.2));
      if (p.eruptT > 1.5) {
        scene.remove(p.grp); p.ringMat.dispose(); p.fillMat.dispose(); hexPillars.splice(i, 1);
      }
    }
  }
}
function clearHexPillars() {
  for (let i = hexPillars.length - 1; i >= 0; i--) {
    const p = hexPillars[i]; scene.remove(p.grp); p.ringMat.dispose(); p.fillMat.dispose(); hexPillars.splice(i, 1);
  }
}

const hexWaves = [];
const hexWaveGeo = new THREE.RingGeometry(0.93, 1.0, 64);
function spawnHexWave(cx, cz, dmg, speed = 11, maxR = WITCH_R, color = 0x9b5cff) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(hexWaveGeo, mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(cx, 0.1, cz);
  mesh.scale.setScalar(0.8);
  scene.add(mesh);
  hexWaves.push({ mesh, mat, cx, cz, r: 0.8, maxR, speed, dmg, hit: false });
}
function updateHexWaves(dt) {
  for (let i = hexWaves.length - 1; i >= 0; i--) {
    const w = hexWaves[i];
    if (!w) continue;
    w.r += w.speed * dt;
    w.mesh.scale.setScalar(w.r);
    w.mat.opacity = 0.9 * Math.max(0, 1 - w.r / w.maxR);
    if (!w.hit && P.state !== 'dead') {
      const d = Math.hypot(P.pos.x - w.cx, P.pos.z - w.cz);
      if (Math.abs(d - w.r) < 0.8) { w.hit = true; damagePlayer(w.dmg, new THREE.Vector3(w.cx, 0, w.cz), 'veil'); }
    }
    if (w.r >= w.maxR) { scene.remove(w.mesh); w.mat.dispose(); hexWaves.splice(i, 1); }
  }
}
function clearHexWaves() {
  for (let i = hexWaves.length - 1; i >= 0; i--) { const w = hexWaves[i]; scene.remove(w.mesh); w.mat.dispose(); hexWaves.splice(i, 1); }
}

const skeletonBoneMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.86, metalness: 0.04, emissive: 0x2b1830, emissiveIntensity: 0.35 });
const skeletonClothMat = new THREE.MeshStandardMaterial({ color: 0x2c1838, roughness: 0.96, metalness: 0.02, side: THREE.DoubleSide });
const skeletonSteelMat = new THREE.MeshStandardMaterial({ color: 0x8d8a91, roughness: 0.46, metalness: 0.82 });
const skeletonEyeMat = new THREE.SpriteMaterial({ map: fireGlowTex, color: 0xff7ac0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
const skeletonSkullGeo = new THREE.SphereGeometry(0.22, 12, 9);
const skeletonBoneGeo = new THREE.CylinderGeometry(1, 1, 1, 5);
const skeletonRibGeo = new THREE.TorusGeometry(0.2, 0.022, 4, 14, Math.PI * 1.55);
const skeletonJawGeo = new THREE.BoxGeometry(0.22, 0.07, 0.14);
const skeletonSwordGeo = new THREE.BoxGeometry(0.055, 0.7, 0.015);
const skeletons = [];

function buildSkeleton() {
  const group = new THREE.Group();
  const body = new THREE.Group(); group.add(body);
  const pelvis = new THREE.Mesh(skeletonBoneGeo, skeletonBoneMat);
  pelvis.scale.set(0.16, 0.12, 0.1); pelvis.position.y = 0.84; pelvis.rotation.z = 0.12; body.add(pelvis);
  const spine = new THREE.Mesh(skeletonBoneGeo, skeletonBoneMat);
  spine.scale.set(0.034, 0.6, 0.034); spine.position.y = 1.16; body.add(spine);
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(skeletonRibGeo, skeletonBoneMat);
    const sc = 0.96 + i * 0.035;
    rib.scale.set(sc, sc, sc); rib.position.y = 1.02 + i * 0.1;
    rib.rotation.set(Math.PI / 2, 0.28 + i * 0.17, 0.1); body.add(rib);
  }
  const shoulder = new THREE.Mesh(skeletonBoneGeo, skeletonBoneMat);
  shoulder.scale.set(0.028, 0.66, 0.028); shoulder.rotation.z = Math.PI / 2; shoulder.position.y = 1.43; body.add(shoulder);
  const head = new THREE.Group(); head.position.y = 1.58; body.add(head);
  const skull = new THREE.Mesh(skeletonSkullGeo, skeletonBoneMat); skull.scale.set(0.9, 1.05, 0.95); head.add(skull);
  const jaw = new THREE.Mesh(skeletonJawGeo, skeletonBoneMat); jaw.position.set(0, -0.16, 0.05); head.add(jaw);
  for (const side of [-1, 1]) {
    const eye = new THREE.Sprite(skeletonEyeMat);
    eye.scale.setScalar(0.085); eye.position.set(0.075 * side, 0.035, 0.19); head.add(eye);
  }
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.55), skeletonClothMat);
  cloth.position.set(0, 0.72, -0.09); cloth.rotation.y = Math.PI; body.add(cloth);
  function arm(side) {
    const sh = new THREE.Group(); sh.position.set(0.32 * side, 1.4, 0); body.add(sh);
    const upper = new THREE.Mesh(skeletonBoneGeo, skeletonBoneMat);
    upper.scale.set(0.032, 0.4, 0.032); upper.position.y = -0.2; sh.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.4; sh.add(elbow);
    const fore = new THREE.Mesh(skeletonBoneGeo, skeletonBoneMat);
    fore.scale.set(0.028, 0.38, 0.028); fore.position.y = -0.19; elbow.add(fore);
    return { sh, elbow };
  }
  const armL = arm(-1), armR = arm(1);
  const sword = new THREE.Mesh(skeletonSwordGeo, skeletonSteelMat);
  sword.position.set(0, -0.36, 0.13); sword.rotation.x = -0.35; armR.elbow.add(sword);
  function leg(side) {
    const hip = new THREE.Group(); hip.position.set(0.12 * side, 0.82, 0); body.add(hip);
    const thigh = new THREE.Mesh(skeletonBoneGeo, skeletonBoneMat);
    thigh.scale.set(0.038, 0.42, 0.038); thigh.position.y = -0.21; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
    const shin = new THREE.Mesh(skeletonBoneGeo, skeletonBoneMat);
    shin.scale.set(0.032, 0.38, 0.032); shin.position.y = -0.19; knee.add(shin);
    const foot = new THREE.Mesh(skeletonJawGeo, skeletonBoneMat);
    foot.scale.set(0.8, 0.55, 1.7); foot.position.set(0, -0.4, 0.08); knee.add(foot);
    return { hip, knee };
  }
  const legL = leg(-1), legR = leg(1);
  return { group, body, head, armL, armR, legL, legR, cloth };
}

function spawnSkeleton(x, z, mult = 1) {
  const parts = buildSkeleton();
  const s = {
    group: parts.group, parts, hp: 55 + G.ng * 10, maxHP: 55 + G.ng * 10,
    dmg: Math.round((TUNE.witchDmg.skeleton + G.ng * 3) * mult),
    speed: 2.55 + Math.random() * 0.35, state: 'rise', t: 0, walk: Math.random() * 6.28,
    attackCd: 0.5, hasHit: false, deadT: 0,
  };
  parts.group.position.set(x, 0, z);
  parts.group.rotation.y = Math.atan2(P.pos.x - x, P.pos.z - z);
  scene.add(parts.group);
  skeletons.push(s);
  spawnRing(new THREE.Vector3(x, 0, z), 0xdbe9ff, 2.6);
  spawnSparks(new THREE.Vector3(x, 0.5, z), 18, 0xd8d2c2, 4);
  return s;
}

function summonSkeletons(count, mult = 1) {
  const active = skeletons.filter(s => s.state !== 'dying').length;
  const n = Math.min(count, Math.max(0, 6 - active));
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    const a = W.yaw + (i - (n - 1) / 2) * 0.75 + (Math.random() - 0.5) * 0.22;
    const r = 2.2 + Math.random() * 2.4;
    const spot = new THREE.Vector3(W.pos.x + Math.sin(a) * r, 0, W.pos.z + Math.cos(a) * r);
    clampToActiveArena(spot, 2.0);
    spawnSkeleton(spot.x, spot.z, mult);
  }
  sfx.cast();
  showSub('BONES ANSWER THE ECLIPSE — CUT THEM DOWN');
}

function removeSkeleton(i) {
  const s = skeletons[i]; if (!s) return;
  scene.remove(s.group); skeletons.splice(i, 1);
}
function damageSkeleton(s, dmg) {
  if (!s || s.state === 'dying') return;
  s.hp -= dmg;
  spawnSparks(new THREE.Vector3(s.group.position.x, 1.1, s.group.position.z), 9, 0xd8d2c2, 4);
  sfx.hitFlesh();
  if (s.hp <= 0) {
    s.state = 'dying'; s.t = 0;
    spawnSparks(new THREE.Vector3(s.group.position.x, 1.0, s.group.position.z), 22, 0xffb6d8, 5);
    spawnRing(s.group.position, 0xdbe9ff, 2.2);
    sfx.stagger();
  }
}
function damageSkeletonsInArc(from, yaw, range, arc, dmg) {
  let hits = 0;
  for (const s of skeletons) {
    if (s.state === 'dying') continue;
    if (dist2D(from, s.group.position) > range + 0.35) continue;
    if (inArc(from, yaw, s.group.position, range, arc)) { damageSkeleton(s, dmg); hits++; }
  }
  return hits;
}
function updateSkeletons(dt) {
  for (let i = skeletons.length - 1; i >= 0; i--) {
    const s = skeletons[i];
    if (!s) continue;
    s.t += dt;
    const p = s.parts, g = s.group;
    if (s.state === 'dying') {
      s.deadT += dt;
      const k = Math.min(1, s.deadT / 0.5);
      p.body.rotation.z = k * 1.35;
      p.body.position.y = -k * 0.55;
      p.group.scale.setScalar(1 + k * 0.02);
      if (s.deadT > 0.55) removeSkeleton(i);
      continue;
    }
    if (s.state === 'rise') {
      const k = Math.min(1, s.t / 0.62);
      p.body.position.y = -1.1 + sstep(k) * 1.1;
      p.head.rotation.x = -0.3 + k * 0.3;
      if (k >= 1) { s.state = 'chase'; s.t = 0; }
      continue;
    }
    const dx = P.pos.x - g.position.x, dz = P.pos.z - g.position.z;
    const d = Math.hypot(dx, dz);
    s.attackCd = Math.max(0, s.attackCd - dt);
    if (P.state !== 'dead') g.rotation.y += angDiff(Math.atan2(dx, dz), g.rotation.y) * Math.min(1, 9 * dt);
    if (s.state === 'attack') {
      const k = Math.min(1, s.t / 0.55);
      p.armR.sh.rotation.x = -2.1 + sstep(k) * 2.1;
      p.armR.elbow.rotation.x = -0.4 + k * 0.4;
      p.armL.sh.rotation.x = 0.25;
      if (!s.hasHit && s.t >= 0.24) {
        s.hasHit = true;
        if (P.state !== 'dead' && Math.hypot(P.pos.x - g.position.x, P.pos.z - g.position.z) < 1.9) {
          damagePlayer(s.dmg, g.position, 'skeleton');
        }
      }
      p.body.position.y = Math.sin(k * Math.PI) * 0.08;
      if (s.t >= 0.58) { s.state = 'chase'; s.t = 0; }
      continue;
    }
    if (s.attackCd <= 0 && d <= 1.75 && P.state !== 'dead') {
      s.state = 'attack'; s.t = 0; s.hasHit = false;
      continue;
    }
    if (d > 1.35 && P.state !== 'dead') {
      const sp = s.speed;
      g.position.x += dx / Math.max(d, 0.001) * sp * dt;
      g.position.z += dz / Math.max(d, 0.001) * sp * dt;
      clampToActiveArena(g.position, 1.1);
      s.walk += dt * 8.5;
      const swing = Math.sin(s.walk);
      p.legL.hip.rotation.x = swing * 0.58;
      p.legR.hip.rotation.x = -swing * 0.58;
      p.legL.knee.rotation.x = Math.max(0, -swing) * 0.5;
      p.legR.knee.rotation.x = Math.max(0, swing) * 0.5;
      p.armL.sh.rotation.x = -swing * 0.38;
      p.armR.sh.rotation.x = swing * 0.3;
      p.body.position.y = Math.abs(Math.sin(s.walk * 2)) * 0.025;
    } else {
      p.legL.hip.rotation.x *= 0.85; p.legR.hip.rotation.x *= 0.85;
      p.legL.knee.rotation.x *= 0.85; p.legR.knee.rotation.x *= 0.85;
      p.armL.sh.rotation.x = Math.sin(s.t * 1.8) * 0.08;
      p.armR.sh.rotation.x = -0.15;
      p.body.position.y = Math.sin(s.t * 2.4) * 0.012;
    }
    p.head.rotation.x = Math.sin(s.t * 1.7) * 0.04;
  }
}
function clearSkeletons() {
  for (let i = skeletons.length - 1; i >= 0; i--) removeSkeleton(i);
}

const moonBeams = [];
const moonBeamWarnGeo = new THREE.BoxGeometry(1, 1, 1);
const moonBeamCylGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
const moonBeamCoreMat = new THREE.MeshBasicMaterial({ color: 0xf8fbff, transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending, depthWrite: false });
const moonBeamGlowMat = new THREE.MeshBasicMaterial({ color: 0xa9c8ff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

function spawnMoonBeam(start, targetX, targetZ, delay, dmg) {
  const end = new THREE.Vector3(targetX, 1.1, targetZ);
  const dx = end.x - start.x, dz = end.z - start.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.4) return;
  const angle = Math.atan2(dx, dz);
  const warnMat = new THREE.MeshBasicMaterial({ color: 0xdceaff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
  const warn = new THREE.Mesh(moonBeamWarnGeo, warnMat);
  warn.scale.set(0.66, 1, len);
  warn.position.set((start.x + end.x) / 2, 0.065, (start.z + end.z) / 2);
  warn.rotation.y = angle;
  scene.add(warn);
  moonBeams.push({ start: start.clone(), end, warn, warnMat, delay, dmg, angle, len, t: 0, state: 'warn', beam: null, life: 0 });
}
function spawnMoonBeamVolley(mult = 1) {
  const start = new THREE.Vector3();
  witchK.parts.staffCrystal.getWorldPosition(start);
  const base = Math.atan2(P.pos.x - W.pos.x, P.pos.z - W.pos.z);
  const perpX = Math.cos(base), perpZ = -Math.sin(base);
  const offsets = [-2.8, 0, 2.8];
  for (let i = 0; i < offsets.length; i++) {
    let x = P.pos.x + perpX * offsets[i], z = P.pos.z + perpZ * offsets[i];
    const dx = x - WITCH_CENTER.x, dz = z - WITCH_CENTER.z, dd = Math.hypot(dx, dz);
    if (dd > WITCH_R - 1.2) { const f = (WITCH_R - 1.2) / dd; x = WITCH_CENTER.x + dx * f; z = WITCH_CENTER.z + dz * f; }
    spawnMoonBeam(start, x, z, 0.62 + i * 0.16, Math.round(TUNE.witchDmg.beam * mult));
  }
  sfx.cast();
  showSub('MOONLIGHT PIERCES THE HOLLOW — STEP OFF THE LINE');
}
function fireMoonBeam(b) {
  b.state = 'fire'; b.life = 0.24;
  scene.remove(b.warn); b.warnMat.dispose(); b.warn = null;
  const dir = b.end.clone().sub(b.start);
  const length = dir.length();
  const grp = new THREE.Group();
  const core = new THREE.Mesh(moonBeamCylGeo, moonBeamCoreMat); core.scale.set(0.14, length, 0.14); grp.add(core);
  const glow = new THREE.Mesh(moonBeamCylGeo, moonBeamGlowMat); glow.scale.set(0.52, length, 0.52); grp.add(glow);
  grp.position.copy(b.start).add(b.end).multiplyScalar(0.5);
  grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  scene.add(grp);
  b.beam = grp;
  const vx = b.end.x - b.start.x, vz = b.end.z - b.start.z;
  const len2 = vx * vx + vz * vz;
  const k = len2 > 0.001 ? clampJ(((P.pos.x - b.start.x) * vx + (P.pos.z - b.start.z) * vz) / len2, 0, 1) : 0;
  const px = b.start.x + vx * k, pz = b.start.z + vz * k;
  if (P.state !== 'dead' && Math.hypot(P.pos.x - px, P.pos.z - pz) < 0.92) damagePlayer(b.dmg, b.end, 'moonbeam');
  spawnRing(new THREE.Vector3(b.end.x, 0, b.end.z), 0xe8f1ff, 3.2);
  spawnSparks(new THREE.Vector3(b.end.x, 0.9, b.end.z), 18, 0xf2f7ff, 6);
  for (let i = 0; i < 7; i++) {
    const kk = i / 7;
    spawnSparks(new THREE.Vector3(b.start.x + vx * kk, b.start.y + (b.end.y - b.start.y) * kk, b.start.z + vz * kk), 1, 0xdceaff, 2.6);
  }
  sfx.hitMetal(); G.shake = Math.max(G.shake, 0.2);
}
function updateMoonBeams(dt) {
  for (let i = moonBeams.length - 1; i >= 0; i--) {
    const b = moonBeams[i];
    if (!b) continue;
    b.t += dt;
    if (b.state === 'warn') {
      b.warnMat.opacity = 0.16 + Math.sin(b.t * 25) * 0.07 + b.t / Math.max(0.001, b.delay) * 0.16;
      if (b.t >= b.delay) fireMoonBeam(b);
    } else {
      b.life -= dt;
      if (b.beam) {
        b.beam.scale.setScalar(Math.max(0.12, 1 - (0.24 - b.life) * 2.2));
      }
      if (b.life <= 0) {
        if (b.beam) scene.remove(b.beam);
        moonBeams.splice(i, 1);
      }
    }
  }
}
function clearMoonBeams() {
  for (let i = moonBeams.length - 1; i >= 0; i--) {
    const b = moonBeams[i];
    if (b.warn) { scene.remove(b.warn); b.warnMat.dispose(); }
    if (b.beam) scene.remove(b.beam);
    moonBeams.splice(i, 1);
  }
}

const LUNAR_FRAGMENT_COUNT = 20;
function spawnLunarBarrage(mult = 1) {
  const targeted = 4;
  const count = Math.max(1, LUNAR_FRAGMENT_COUNT - targeted);
  for (let i = 0; i < count; i++) {
    const a = i * 2.39996 + Math.random() * 0.16;
    const r = 2.2 + Math.sqrt((i + 0.4) / count) * (WITCH_R - 4.6);
    const x = WITCH_CENTER.x + Math.cos(a) * r;
    const z = WITCH_CENTER.z + Math.sin(a) * r;
    spawnHexPillar(x, z, 1.9 + Math.random() * 1.7, 1.65 + Math.random() * 0.55, TUNE.witchDmg.moonzone, mult, true);
  }
  for (let i = 0; i < targeted; i++) {
    const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 2.8;
    const spot = new THREE.Vector3(P.pos.x + Math.cos(a) * r, 0, P.pos.z + Math.sin(a) * r);
    clampToActiveArena(spot, 2.0);
    spawnHexPillar(spot.x, spot.z, 2.15 + Math.random() * 1.1, 1.75, TUNE.witchDmg.moonzone, mult, true);
  }
  sfx.pillarWarn();
  showSub('THE MOON SHATTERS — EVERY MARK WILL ERUPT');
}

function clearLunarFX() {
  G.witchLunarCutscene = false; G.witchLunarT = 0; G.witchLunarImpacted = false;
  lunarAvatar.group.visible = false; lunarAvatar.light.intensity = 0;
  lunarAvatar.group.scale.setScalar(1);
  if (witchMoonCore) witchMoonCore.visible = true;
  if (witchMoonGlow) witchMoonGlow.visible = true;
  if (W.state === 'lunar') W.state = 'idle';
}

function startWitchLunarCutscene() {
  clearHexHazards();
  W.state = 'lunar'; W.t = 0; W.attackKind = ''; W.staggerAcc = 0; W.volleyCount = 0;
  W.specialCd = 2.5; W.summonCd = 0; W.beamCd = 0;
  W.yaw = Math.atan2(P.pos.x - W.pos.x, P.pos.z - W.pos.z);
  P.state = 'idle'; P.t = 0; P.hasHit = false;
  G.witchLunarCutscene = true; G.witchLunarT = 0; G.witchLunarImpacted = false;
  lunarAvatar.group.visible = true; lunarAvatar.group.position.copy(LUNAR_BASE);
  lunarAvatar.group.rotation.set(0, 0, 0); lunarAvatar.group.scale.setScalar(1);
  lunarAvatar.glowMat.opacity = 0.35; lunarAvatar.ringMat.opacity = 0.35;
  lunarAvatar.light.intensity = 12; lunarAvatar.sparkT = 0;
  if (witchMoonCore) witchMoonCore.visible = false;
  if (witchMoonGlow) witchMoonGlow.visible = false;
  showCenter('THE MOON ANSWERS', 'Morgana draws the eclipse down — the hollow will break');
  sfx.roar(); G.shake = Math.max(G.shake, 0.55);
  spawnSparks(new THREE.Vector3(W.pos.x, 1.6, W.pos.z), 24, 0xdceaff, 8);
}

function lunarSlamImpact() {
  G.witchLunarImpacted = true;
  const baseHP = TUNE.witchHP + G.ng * 140;
  W.maxHP = Math.max(320, Math.round(baseHP * 0.45));
  W.hp = W.maxHP;
  W.phase2 = true; W.lunarPhase = true;
  bossNameEl.textContent = 'MORGANA  ·  THE ECLIPSED';
  G.shake = Math.max(G.shake, 1.0); G.hitstop = 0.1;
  sfx.roar(); sfx.slam(); sfx.pillar();
  spawnRing(new THREE.Vector3(lunarImpactPoint.x, 0, lunarImpactPoint.z), 0xf2f7ff, 20);
  spawnRing(new THREE.Vector3(lunarImpactPoint.x, 0, lunarImpactPoint.z), 0xff9ec2, 28);
  spawnSparks(new THREE.Vector3(lunarImpactPoint.x, 1.2, lunarImpactPoint.z), LUNAR_FRAGMENT_COUNT, 0xdceaff, 11);
  spawnLunarBarrage(1 + G.ng * 0.25);
  showCenter('THE MOON SHATTERS', 'the hollow is marked — dodge the falling light');
}

function updateWitchLunar(dt) {
  const T = (G.witchLunarT = W.t);
  W.yaw += angDiff(Math.atan2(P.pos.x - W.pos.x, P.pos.z - W.pos.z), W.yaw) * Math.min(1, 1.2 * dt);
  const la = lunarAvatar;
  la.t += dt;
  la.core.rotation.y += dt * 0.16;
  la.ring.rotation.z += dt * 0.42;
  la.glowMat.opacity = 0.3 + Math.sin(la.t * 5.1) * 0.08;
  if (T < 1.0) {
    la.group.position.copy(LUNAR_BASE);
    la.light.intensity = 10 + Math.sin(la.t * 7) * 4;
  } else if (T < 4.0) {
    const k = sstep(clampJ((T - 1.0) / 3.0, 0, 1));
    la.group.position.lerpVectors(LUNAR_BASE, LUNAR_HOVER, k);
    la.group.position.x += Math.sin(k * Math.PI) * -7;
    la.light.intensity = 10 + k * 32;
  } else if (T < 4.55) {
    const k = clampJ((T - 4.0) / 0.55, 0, 1);
    const e = k * k;
    la.group.position.set(
      LUNAR_HOVER.x + (lunarImpactPoint.x - LUNAR_HOVER.x) * e,
      LUNAR_HOVER.y + (3.2 - LUNAR_HOVER.y) * e,
      LUNAR_HOVER.z + (lunarImpactPoint.z - LUNAR_HOVER.z) * e
    );
    la.light.intensity = 42 + e * 18;
  } else {
    if (!G.witchLunarImpacted) lunarSlamImpact();
    const k = clampJ((T - 4.55) / 0.85, 0, 1);
    la.group.position.set(
      lunarImpactPoint.x,
      3.2 - k * 0.8,
      lunarImpactPoint.z
    );
    la.group.scale.set(1 + k * 0.18, Math.max(0.22, 1 - k * 0.92), 1 + k * 0.18);
    la.glowMat.opacity = Math.max(0, 0.34 * (1 - k));
    la.ringMat.opacity = Math.max(0, 0.35 * (1 - k));
    la.light.intensity = Math.max(0, 60 * (1 - k));
  }
  if (T < 4.6) {
    la.sparkT += dt;
    if (la.sparkT >= 0.09) {
      la.sparkT = 0;
      const p = la.group.position;
      spawnSparks(new THREE.Vector3(p.x + (Math.random() - 0.5) * 5, p.y + (Math.random() - 0.5) * 5, p.z + (Math.random() - 0.5) * 5), 1, Math.random() < 0.5 ? 0xdceaff : 0xffa9c8, 3.5);
    }
  }
  if (T >= 5.7) {
    G.witchLunarCutscene = false;
    W.state = 'idle'; W.t = 0; W.decideCd = 0.9;
    W.specialCd = 2.6; W.summonCd = 3.2; W.beamCd = 2.6;
    la.group.visible = false; la.light.intensity = 0;
    if (witchMoonCore) witchMoonCore.visible = true;
    if (witchMoonGlow) witchMoonGlow.visible = true;
    showSub('SHE IS ECLIPSED — AND THE DEAD RISE');
  }
}

function clearHexHazards() {
  clearHexBolts(); clearHexPillars(); clearHexWaves();
  clearMoonBeams(); clearSkeletons(); clearLunarFX();
}

// ============ GAME STATE ============
const G = {
  mode: 'title', // title | play | dead | victory
  bossId: 'duncan',
  inArena: false, bossActive: false, bossDead: false,
  defeated: { duncan: false, witch: false, dragon: false, fang: false, duo: false },
  locked: false, ng: 0, fightTime: 0, hitstop: 0, paused: false,
  camYaw: 0, camPitch: 0.22, camDist: 6.5,
  shake: 0,
  awakening: false, awakeT: 0, awakeBurst: false, bossRevealed: false, bossRevealY: 0,
  witchAwakening: false, witchAwakeT: 0,
  witchLunarCutscene: false, witchLunarT: 0, witchLunarImpacted: false,
  creator: false,
};

const CREATOR_KEY = 'ashen-vigil-creator-v1';
(function initCreatorMode() {
  try {
    const q = new URLSearchParams(location.search).get('creator');
    if (q === '1' || q === 'true' || location.hash === '#creator') {
      G.creator = true;
      localStorage.setItem(CREATOR_KEY, '1');
    } else if (q === '0' || q === 'false') {
      G.creator = false;
      localStorage.removeItem(CREATOR_KEY);
    } else {
      G.creator = localStorage.getItem(CREATOR_KEY) === '1';
    }
  } catch (e) {}
})();

const ARENAS = {
  duncan: { id: 'duncan', center: new THREE.Vector3(0, 0, 0), radius: ARENA_R, stone: stonePos },
  witch: { id: 'witch', center: WITCH_CENTER, radius: WITCH_R, stone: witchStonePos },
  dragon: { id: 'dragon', center: DRAGON_CENTER, radius: DRAGON_R, stone: dragonStonePos },
  fang: { id: 'fang', center: FANG_CENTER, radius: FANG_R, stone: fangStonePos },
  duo: { id: 'duo', center: DUO_CENTER, radius: DUO_R, stone: duoStonePos },
};
let ARENA = ARENAS.duncan;

const BOSSES = {
  duncan: {
    id: 'duncan', name: 'SER DUNCAN', epithet: 'THE ASHEN KNIGHT', glyph: '⚔',
    accent: '#ff9a46', deep: '#5e130c', difficulty: 'THE FIRST VIGIL',
    desc: 'A knight who never left his post. Steel, embers, and a duel that forgives nothing.',
    bossName: 'SER DUNCAN  ·  THE ASHEN KNIGHT',
    arena: ARENAS.duncan,
  },
  witch: {
    id: 'witch', name: 'MORGANA', epithet: 'THE NIGHTSHADE HEX', glyph: '☾',
    accent: '#b47cff', deep: '#3a0f6e', difficulty: 'THE VEIL UNBOUND',
    desc: 'A sorceress who traded her name for the dark. Her hollow is a violet-blue forest lit by hexfire and old blood, far from every ashen road.',
    bossName: 'MORGANA  ·  THE NIGHTSHADE HEX',
    arena: ARENAS.witch,
  },
  dragon: {
    id: 'dragon', name: 'VYTLES', epithet: 'THE DRAGON', glyph: '☄',
    accent: '#ff6a2a', deep: '#3a0b05', difficulty: 'THE CALDERA AWAKENS',
    desc: 'An old wyrm coiled beneath a burning caldera. Vytles has outlived every knight who came before, and the mountain still answers his roar.',
    bossName: 'VYTLES  ·  THE DRAGON',
    arena: ARENAS.dragon,
  },
  fang: {
    id: 'fang', name: 'KORVATH', epithet: 'THE ECLIPSE FANG', glyph: 'ᛉ',
    accent: '#ff3d6d', deep: '#2a0614', difficulty: 'THE LAST VIGIL',
    desc: 'A wolf-knight bound to a dying eclipse. Korvath\'s black blade drinks the light, and his shadow always strikes first.',
    bossName: 'KORVATH  ·  THE ECLIPSE FANG',
    arena: ARENAS.fang,
  },
  duo: {
    id: 'duo', name: 'VESPER & MORROW', epithet: 'THE HOLLOW CHOIR', glyph: '♱',
    accent: '#e4c470', deep: '#3b2a0e', difficulty: 'THE FINAL HYMN',
    desc: 'Two voices bound in one sepulchre. When one twin falls, the other sings it back — break the requiem before the choir is made whole.',
    bossName: 'VESPER & MORROW  ·  THE HOLLOW CHOIR',
    arena: ARENAS.duo,
  },
};
const BOSS_ORDER = ['duncan', 'witch', 'dragon', 'fang', 'duo'];
function bossUnlocked(id) {
  if (G.creator) return true;
  const i = BOSS_ORDER.indexOf(id);
  return i <= 0 || !!G.defeated[BOSS_ORDER[i - 1]];
}
function previousBossName(id) {
  const i = BOSS_ORDER.indexOf(id);
  return i > 0 ? BOSSES[BOSS_ORDER[i - 1]].name : '';
}
function setCreatorMode(on, persist = true) {
  G.creator = !!on;
  try {
    if (persist) {
      if (G.creator) localStorage.setItem(CREATOR_KEY, '1');
      else localStorage.removeItem(CREATOR_KEY);
    }
  } catch (e) {}
  buildBossSelect();
  if (vigilMenuEl && !vigilMenuEl.classList.contains('hidden')) renderBossSwitchCards(vigilBossListEl, switchBossFromVigil);
  if (G.mode === 'play' && G.bossActive) return;
  showSub(G.creator ? 'CREATOR MODE — EVERY VIGIL IS OPEN' : 'CREATOR MODE OFF');
}
function activeBoss() { return G.bossId === 'witch' ? W : G.bossId === 'dragon' ? V : G.bossId === 'fang' ? F : G.bossId === 'duo' ? D : B; }
function activeBossGroup() { return G.bossId === 'witch' ? witchK.group : G.bossId === 'dragon' ? dragonK.group : G.bossId === 'fang' ? fangK.group : G.bossId === 'duo' ? duoTwins[D.target].k.group : bossK.group; }
function activeStonePos() { return ARENA.stone; }
function activeBossScale() {
  if (G.bossId === 'witch') return witchK.group.scale.x / WITCH_BASE_SCALE;
  if (G.bossId === 'dragon') return dragonK.group.scale.x / DRAGON_BASE_SCALE;
  if (G.bossId === 'fang') return fangK.group.scale.x / FANG_BASE_SCALE;
  if (G.bossId === 'duo') return duoTwins[D.target].k.group.scale.x / (D.target === 0 ? DUO_A_BASE_SCALE : DUO_B_BASE_SCALE);
  return bossK.group.scale.x / BOSS_BASE_SCALE;
}
function activeBossAimY() {
  if (G.bossId === 'witch') return 2.05;
  if (G.bossId === 'dragon') return 2.55;
  if (G.bossId === 'fang') return 2.35;
  if (G.bossId === 'duo') return D.target === 0 ? 2.05 : 2.45;
  return 2.05 * activeBossScale();
}
function setBossName(id) {
  const def = BOSSES[id] || BOSSES.duncan;
  bossNameEl.textContent = def.bossName;
  bossPlate.style.setProperty('--boss-accent', def.accent);
  bossPlate.style.setProperty('--boss-deep', def.deep || '#5e130c');
}
function clampToActiveArena(pos, pad = 0.8) {
  const c = ARENA.center;
  const dx = pos.x - c.x, dz = pos.z - c.z;
  const d = Math.hypot(dx, dz), maxR = ARENA.radius - pad;
  if (d > maxR && d > 1e-6) { pos.x = c.x + dx / d * maxR; pos.z = c.z + dz / d * maxR; }
}
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
      defeated: G.defeated,
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
  P.spoils = Array.isArray(d.spoils) ? d.spoils.filter(id => ALL_SPOILS.some(s => s.id === id)) : [];
  P.equippedSpoils = P.spoils.includes(d.equippedSpoils) ? d.equippedSpoils : null;
  G.ng = Number.isFinite(d.ng) ? Math.max(0, Math.floor(d.ng)) : 0;
  G.defeated = {
    duncan: !!(d.defeated && d.defeated.duncan),
    witch: !!(d.defeated && d.defeated.witch),
    dragon: !!(d.defeated && d.defeated.dragon),
    fang: !!(d.defeated && d.defeated.fang),
  };
  // rebuild stats from a clean base so restoring is idempotent
  P.mods = { dmg: 1, hp: 1, st: 1, spd: 1, flask: 1 };
  P.maxHP = TUNE.playerHP; P.stMax = TUNE.playerST;
  if (P.equippedSpoils) {
    const s = ALL_SPOILS.find(x => x.id === P.equippedSpoils);
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
  G.defeated = { duncan: false, witch: false, dragon: false, fang: false };
  G.bossId = 'duncan'; ARENA = ARENAS.duncan;
  witchArenaGroup.visible = false; witchWorldGroup.visible = false;
  dragonArenaGroup.visible = false; dragonWorldGroup.visible = false;
  fangArenaGroup.visible = false; fangWorldGroup.visible = false;
  applyWorldStyle('duncan');
  applyWeaponMesh('longsword');
  closeInventory();
  resetBoss(); resetWitch(); resetDragon(); resetFang(); resetPlayer(); updateFlasks(); updateWeaponLabel(); updateHUD();
  setBossName(G.bossId);
  const el = document.getElementById('save-note'); if (el) el.textContent = SAVE_NOTE;
  showCenter('SAVE ERASED', 'a new vigil begins');
}
const B = {
  pos: new THREE.Vector3(0, 0, -8), yaw: 0, hp: TUNE.bossHP, maxHP: TUNE.bossHP,
  state: 'dormant', t: 0, aiT: 0, decideCd: 0, attackKind: '', hasHit: false,
  poise: 100, blocking: false, phase2: false, introT: 0, specialCd: 0, fireCd: 0,
  infernoFormed: false, infernoTargeted: false, infernoImpacted: false,
};
const W = {
  pos: new THREE.Vector3(WITCH_CENTER.x, 0, WITCH_CENTER.z - 4), yaw: Math.PI, hp: TUNE.witchHP, maxHP: TUNE.witchHP,
  state: 'dormant', t: 0, decideCd: 0, attackKind: '', hasHit: false,
  phase2: false, lunarPhase: false, specialCd: 0, summonCd: 0, beamCd: 0, staggerAcc: 0, deadT: 0, volleyCount: 0,
};
let dragonBreathWarn = null, dragonBreathWarnMat = null;
let dragonBreathFX = null;
const _dragonMouthPos = new THREE.Vector3();
let dragonDiveWarn = null, dragonDiveWarnMat = null;
const dragonDiveMark = new THREE.Vector3();
let dragonBackdraftWarn = null, dragonBackdraftWarnMat = null;
const dragonBackdraftMark = new THREE.Vector3();
let dragonBackdraftYaw = 0;
const V = {
  pos: new THREE.Vector3(DRAGON_CENTER.x, 0, DRAGON_CENTER.z - 5), yaw: Math.PI, hp: TUNE.dragonHP, maxHP: TUNE.dragonHP,
  state: 'dormant', t: 0, decideCd: 0, attackKind: '', hasHit: false,
  phase2: false, staggerAcc: 0, deadT: 0, breathCd: 0, stormCd: 0, roarCd: 0, animT: 0, lastAttack: '',
};
let fangMarkWarn = null, fangMarkWarnMat = null;
const fangEchoes = [];
const fangSlashes = [];
function clearFangEchoes() {
  for (let i = fangEchoes.length - 1; i >= 0; i--) { scene.remove(fangEchoes[i].grp); fangEchoes[i].mat.dispose(); }
  fangEchoes.length = 0;
}
function ensureFangMarkWarn() {
  if (fangMarkWarn) return;
  fangMarkWarnMat = new THREE.MeshBasicMaterial({ color: 0xff2a5e, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  fangMarkWarn = new THREE.Group();
  const edge = new THREE.Mesh(new THREE.RingGeometry(4.7, 5.5, 56), fangMarkWarnMat);
  edge.rotation.x = -Math.PI / 2; fangMarkWarn.add(edge);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(5.35, 48), fangMarkWarnMat);
  fill.rotation.x = -Math.PI / 2; fill.position.y = -0.002; fangMarkWarn.add(fill);
  const core = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.05, 32), fangMarkWarnMat);
  core.rotation.x = -Math.PI / 2; fangMarkWarn.add(core);
  fangMarkWarn.position.y = 0.075; fangMarkWarn.visible = false; scene.add(fangMarkWarn);
}
function hideFangMarkWarn() { if (fangMarkWarn) fangMarkWarn.visible = false; }
const F = {
  pos: new THREE.Vector3(FANG_CENTER.x, 0, FANG_CENTER.z - 5), yaw: Math.PI, hp: TUNE.fangHP, maxHP: TUNE.fangHP,
  state: 'dormant', t: 0, decideCd: 0, attackKind: '', hasHit: false,
  phase2: false, staggerAcc: 0, deadT: 0, animT: 0, lastAttack: '', mark: new THREE.Vector3(),
};
const DUO_ATK = {
  thrust: { wind: 0.52, active: 0.26, recover: 0.72, range: 4.6, arc: 0.48 },
  sweep: { wind: 0.66, active: 0.32, recover: 0.86, range: 4.8, arc: 1.55 },
  slam: { wind: 0.88, active: 0.30, recover: 1.02, range: 4.5, arc: 2.7 },
  charge: { wind: 0.64, active: 0.48, recover: 0.98, range: 2.1, arc: 0.9 },
  toll: { wind: 1.18, active: 0.34, recover: 1.18, range: DUO_R, arc: Math.PI * 2 },
  echo: { wind: 0.82, active: 0.38, recover: 1.05, range: DUO_R, arc: Math.PI * 2 },
};
const duoTwins = [
  {
    id: 0, name: 'VESPER', k: duoAK, shadow: duoAShadow, base: DUO_A_BASE_SCALE,
    pos: new THREE.Vector3(DUO_CENTER.x - 3.4, 0, DUO_CENTER.z - 2.2), yaw: 0,
    home: new THREE.Vector3(DUO_CENTER.x - 3.4, 0, DUO_CENTER.z - 2.2),
    hp: TUNE.duoHP, maxHP: TUNE.duoHP, state: 'dormant', t: 0, decideCd: 0,
    attackKind: '', hasHit: false, staggerAcc: 0, deadT: 0, animT: 0, lastAttack: '',
    chargeDir: new THREE.Vector3(), revived: 0, flashT: 0,
  },
  {
    id: 1, name: 'MORROW', k: duoBK, shadow: duoBShadow, base: DUO_B_BASE_SCALE,
    pos: new THREE.Vector3(DUO_CENTER.x + 3.8, 0, DUO_CENTER.z - 3.4), yaw: Math.PI,
    home: new THREE.Vector3(DUO_CENTER.x + 3.8, 0, DUO_CENTER.z - 3.4),
    hp: TUNE.duoHP, maxHP: TUNE.duoHP, state: 'dormant', t: 0, decideCd: 0,
    attackKind: '', hasHit: false, staggerAcc: 0, deadT: 0, animT: 0, lastAttack: '',
    chargeDir: new THREE.Vector3(), revived: 0, flashT: 0,
  },
];
const D = {
  pos: new THREE.Vector3(DUO_CENTER.x, 0, DUO_CENTER.z - 3), yaw: Math.PI,
  hp: TUNE.duoHP * 2, maxHP: TUNE.duoHP * 2, state: 'dormant', t: 0, target: 0,
  decideCd: 0, phase2: false, requiemBy: -1, requiemT: 0, reviveT: 0, tollCd: 0,
  animT: 0, deadT: 0, lastAttack: '',
};
function duoSyncHP() {
  let hp = 0, maxHP = 0;
  for (const t of duoTwins) { hp += t.hp; maxHP += t.maxHP; }
  D.hp = hp; D.maxHP = maxHP;
}
function duoAlive(t) { return t.state !== 'dead' && t.state !== 'dormant'; }
function duoOther(t) { return duoTwins[1 - t.id]; }
function duoSelectTarget() {
  const current = duoTwins[D.target];
  if (duoAlive(current)) return D.target;
  let best = -1, bestD = Infinity;
  for (const t of duoTwins) {
    if (!duoAlive(t)) continue;
    const d = dist2D(P.pos, t.pos);
    if (d < bestD) { bestD = d; best = t.id; }
  }
  if (best >= 0) D.target = best;
  return D.target;
}
function duoName() {
  const a = duoTwins[0], b = duoTwins[1];
  if (duoAlive(a) && duoAlive(b)) return 'VESPER & MORROW  ·  THE HOLLOW CHOIR';
  if (duoAlive(a)) return 'VESPER  ·  THE HOLLOW CHOIR';
  if (duoAlive(b)) return 'MORROW  ·  THE HOLLOW CHOIR';
  return 'THE HOLLOW CHOIR  ·  SILENCED';
}
function duoResetTwin(T) {
  T.hp = T.maxHP; T.pos.copy(T.home); T.yaw = T.id === 0 ? 0 : Math.PI;
  T.state = 'dormant'; T.t = 0; T.decideCd = 0; T.attackKind = ''; T.hasHit = false;
  T.staggerAcc = 0; T.deadT = 0; T.animT = 0; T.lastAttack = ''; T.revived = 0; T.flashT = 0;
  T.k.group.position.copy(T.pos); T.k.group.rotation.y = T.yaw;
  T.k.group.scale.setScalar(T.base); T.k.group.visible = false; T.shadow.visible = false;
  if (T.k.parts.swordGlow) T.k.parts.swordGlow.material.opacity = 0;
}
function resetDuo() {
  for (const t of duoTwins) { t.maxHP = TUNE.duoHP + G.ng * 78; duoResetTwin(t); }
  duoTwins[0].home.set(DUO_CENTER.x - 3.4, 0, DUO_CENTER.z - 2.2);
  duoTwins[1].home.set(DUO_CENTER.x + 3.8, 0, DUO_CENTER.z - 3.4);
  duoTwins[0].pos.copy(duoTwins[0].home); duoTwins[1].pos.copy(duoTwins[1].home);
  D.pos.set(DUO_CENTER.x, 0, DUO_CENTER.z - 3); D.yaw = Math.PI;
  D.state = 'dormant'; D.t = 0; D.target = 0; D.decideCd = 0; D.phase2 = false;
  D.requiemBy = -1; D.requiemT = 0; D.reviveT = 0; D.tollCd = 0; D.animT = 0; D.deadT = 0; D.lastAttack = '';
  duoSyncHP();
  clearBossHazards(); clearHexHazards();
  telegraphEl.classList.add('hidden');
  if (G.bossId === 'duo') { bossPlate.classList.add('hidden'); G.bossActive = false; }
}
function duoStartAttack(T) {
  const other = duoOther(T);
  const dist = dist2D(T.pos, P.pos);
  let opts;
  if (D.requiemBy >= 0) opts = T.id === 0 ? ['thrust', 'sweep'] : ['slam', 'charge'];
  else if (T.id === 0) opts = dist < 5.0 ? ['thrust', 'sweep', 'echo'] : ['echo', 'thrust'];
  else opts = dist < 5.2 ? ['slam', 'sweep', 'charge'] : ['charge', 'echo'];
  if (D.tollCd <= 0 && D.requiemBy < 0 && !(other.state === 'active' && other.attackKind === 'toll')) {
    opts.push('toll', 'toll');
  }
  if (opts.length > 1 && T.lastAttack) opts = opts.filter(k => k !== T.lastAttack);
  const pick = opts[Math.random() * opts.length | 0] || 'thrust';
  T.attackKind = pick; T.state = 'windup'; T.t = 0; T.hasHit = false; T.lastAttack = pick;
  D.lastAttack = pick;
  if (pick === 'toll') D.tollCd = 9.5;
  else if (pick === 'echo') D.tollCd = Math.max(0, D.tollCd - 0.6);
  if (pick === 'toll' || pick === 'slam' || pick === 'charge') telegraphEl.classList.remove('hidden');
  sfx.swing();
}
function duoRelease(T) {
  T.state = 'active'; T.t = 0; T.hasHit = false;
  const mult = 1 + G.ng * 0.25;
  const kind = T.attackKind;
  telegraphEl.classList.add('hidden');
  if (kind === 'toll') {
    T.hasHit = true;
    spawnHexWave(T.pos.x, T.pos.z, Math.round(TUNE.duoDmg.toll * mult), 8.6, DUO_R, 0xe4c470);
    spawnRing(T.pos, 0xe4c470, 10);
    spawnRing(T.pos, 0xfff0c8, 6);
    showSub('THE BELL TOLLS — LEAVE THE RING');
    sfx.slam(); G.shake = Math.max(G.shake, 0.45);
  } else if (kind === 'echo') {
    T.hasHit = true;
    spawnHexWave(T.pos.x, T.pos.z, Math.round(TUNE.duoDmg.echo * mult), 12.5, DUO_R, 0xf0d9a0);
    showSub('THE CHOIR ECHOES — KEEP MOVING');
    sfx.cast();
  } else if (kind === 'charge') {
    T.chargeDir.set(P.pos.x - T.pos.x, 0, P.pos.z - T.pos.z).normalize();
    sfx.dash();
  } else if (kind === 'slam') {
    spawnRing(T.pos, 0xe4c470, 7);
    sfx.heavySwing();
  } else {
    sfx.heavySwing();
  }
}
function duoMeleeHit(T) {
  if (T.hasHit || T.state !== 'active' || P.state === 'dead') return;
  const s = DUO_ATK[T.attackKind];
  if (!s) return;
  if (T.attackKind === 'charge') {
    if (dist2D(T.pos, P.pos) < s.range) {
      T.hasHit = true;
      damagePlayer(Math.round(TUNE.duoDmg.charge * (1 + G.ng * 0.25)), T.pos, 'charge');
    }
    return;
  }
  if (T.t < 0.08) return;
  if (inArc(T.pos, T.yaw, P.pos, s.range, s.arc)) {
    T.hasHit = true;
    damagePlayer(Math.round(TUNE.duoDmg[T.attackKind] * (1 + G.ng * 0.25)), T.pos, T.attackKind);
  }
}
function updateDuoTwin(T, dt) {
  T.t += dt; T.animT += dt;
  if (T.flashT > 0) T.flashT -= dt;
  const other = duoOther(T);
  const toP = Math.atan2(P.pos.x - T.pos.x, P.pos.z - T.pos.z);
  if (T.state === 'dead') { T.deadT += dt; return; }
  if (T.state === 'dormant') return;
  if (T.state === 'requiem') {
    T.yaw += angDiff(toP, T.yaw) * Math.min(1, 0.8 * dt);
    return;
  }
  if (T.state === 'intro') {
    T.yaw += angDiff(toP, T.yaw) * Math.min(1, 0.9 * dt);
    if (T.t >= 1.2) { T.state = 'idle'; T.decideCd = 0.7 + Math.random() * 0.5; }
    return;
  }
  if (T.state === 'stagger') {
    if (T.t >= 1.15) { T.state = 'idle'; T.decideCd = 0.55 + Math.random() * 0.4; }
    return;
  }
  if (T.state === 'windup') {
    T.yaw += angDiff(toP, T.yaw) * Math.min(1, 2.0 * dt);
    const s = DUO_ATK[T.attackKind] || DUO_ATK.thrust;
    if (T.t >= s.wind) duoRelease(T);
    return;
  }
  if (T.state === 'active') {
    const s = DUO_ATK[T.attackKind] || DUO_ATK.thrust;
    if (T.attackKind === 'charge') {
      T.pos.addScaledVector(T.chargeDir, 13.5 * dt);
      if (G.inArena) clampToActiveArena(T.pos, 1.8);
      if (Math.random() < 0.8) spawnSparks(new THREE.Vector3(T.pos.x, 0.4, T.pos.z), 1, 0xe4c470, 2.2);
    }
    duoMeleeHit(T);
    if (T.t >= s.active) { T.state = 'recover'; T.t = 0; }
    return;
  }
  if (T.state === 'recover') {
    T.yaw += angDiff(toP, T.yaw) * Math.min(1, 1.2 * dt);
    const s = DUO_ATK[T.attackKind] || DUO_ATK.thrust;
    if (T.t >= s.recover) {
      T.state = 'idle'; T.t = 0;
      T.decideCd = 0.42 + Math.random() * 0.62;
      if (D.phase2) T.decideCd *= 0.78;
    }
    return;
  }
  if (T.state === 'idle' || T.state === 'advance') {
    T.yaw += angDiff(toP, T.yaw) * Math.min(1, 2.1 * dt);
    const desired = T.id === 0 ? 3.3 : 4.2;
    const d = Math.max(0.001, dist2D(T.pos, P.pos));
    const speed = TUNE.duoSpeed * (T.id === 0 ? 1.0 : 0.82) * (D.phase2 ? 1.12 : 1);
    if (d > desired + 0.35) {
      T.pos.x += Math.sin(toP) * speed * dt;
      T.pos.z += Math.cos(toP) * speed * dt;
    } else if (d < desired - 0.55) {
      T.pos.x -= Math.sin(toP) * speed * 0.8 * dt;
      T.pos.z -= Math.cos(toP) * speed * 0.8 * dt;
    } else {
      const strafe = Math.sin(D.t * 0.7 + T.id * 2.1) * (D.phase2 ? 0.55 : 0.32);
      T.pos.x += Math.cos(toP) * strafe * dt;
      T.pos.z -= Math.sin(toP) * strafe * dt;
    }
    const sep = dist2D(T.pos, other.pos);
    if (sep < 2.35 && sep > 0.001) {
      const sx = (T.pos.x - other.pos.x) / sep, sz = (T.pos.z - other.pos.z) / sep;
      T.pos.x += sx * (2.35 - sep) * 0.6;
      T.pos.z += sz * (2.35 - sep) * 0.6;
    }
    if (G.inArena) clampToActiveArena(T.pos, 1.8);
    T.decideCd -= dt;
    if (T.decideCd <= 0 && P.state !== 'dead' && D.requiemBy < 0) duoStartAttack(T);
    return;
  }
}
function duoDown(T) {
  if (T.state === 'dead') return;
  T.state = 'dead'; T.t = 0; T.deadT = 0; T.attackKind = ''; T.hasHit = false;
  T.shadow.visible = false;
  if (T.k.parts.swordGlow) T.k.parts.swordGlow.material.opacity = 0;
  duoSyncHP();
  bossNameEl.textContent = duoName();
  spawnRing(T.pos, 0xe4c470, 9);
  spawnSparks(new THREE.Vector3(T.pos.x, 1.5, T.pos.z), 34, 0xf0d9a0, 7);
  const other = duoOther(T);
  if (other.state === 'dead') { duoDie(); return; }
  D.requiemBy = -1; D.requiemT = 0; D.reviveT = 0;
  if (T.revived >= 1) {
    showCenter(`${T.name} FALLS SILENT`, 'the choir can no longer wake this voice');
    return;
  }
  D.requiemBy = other.id;
  D.requiemT = 0; D.reviveT = 0;
  showCenter(`${T.name} FALLS SILENT`, `${other.name} begins the requiem — interrupt the singer`);
  intensifyBossMusic();
}
function duoRevive(fallen, singer) {
  fallen.revived = 1;
  fallen.hp = Math.max(1, Math.round(fallen.maxHP * 0.55));
  fallen.state = 'intro'; fallen.t = 0; fallen.decideCd = 0.9; fallen.staggerAcc = 0;
  fallen.pos.copy(fallen.home); fallen.yaw = Math.atan2(P.pos.x - fallen.pos.x, P.pos.z - fallen.pos.z);
  fallen.k.group.visible = true; fallen.shadow.visible = true;
  fallen.k.group.position.copy(fallen.pos); fallen.k.group.rotation.y = fallen.yaw;
  D.requiemBy = -1; D.requiemT = 0; D.reviveT = 0;
  singer.state = 'recover'; singer.t = 0; singer.attackKind = '';
  duoSyncHP();
  bossNameEl.textContent = duoName();
  showCenter('THE HYMN COMPLETES', `${fallen.name} rises — break the choir before it sings again`);
  spawnRing(fallen.pos, 0xe4c470, 14);
  spawnRing(fallen.pos, 0xfff0c8, 8);
  spawnSparks(new THREE.Vector3(fallen.pos.x, 1.8, fallen.pos.z), 48, 0xf0d9a0, 8);
  sfx.roar(); G.shake = Math.max(G.shake, 0.7);
  intensifyBossMusic();
}
function duoDie() {
  if (D.state === 'dead') return;
  D.state = 'dead'; D.requiemBy = -1; G.bossDead = true; G.bossActive = false;
  G.defeated.duo = true;
  stopBossMusic(); setLock(false);
  clearBossHazards(); clearHexHazards(); telegraphEl.classList.add('hidden');
  bossNameEl.textContent = duoName();
  sfx.death(); sfx.victory();
  spawnSparks(new THREE.Vector3(DUO_CENTER.x, 2.0, DUO_CENTER.z - 2), 72, 0xf0d9a0, 11);
  spawnRing(duoTwins[0].pos, 0xe4c470, 18);
  spawnRing(duoTwins[1].pos, 0xfff0c8, 18);
  G.drops = bossDropsFor('duo');
  setTimeout(showDropScreen, 1600);
}
function damageDuo(dmg, poiseDmg = 26) {
  if (!G.bossActive || D.state === 'dead' || G.mode !== 'play') return;
  const target = duoTwins[duoSelectTarget()];
  if (!target || target.state === 'dead' || target.state === 'dormant') return;
  dmg *= P.mods.dmg;
  const prev = target.hp;
  target.hp = Math.max(0, target.hp - dmg);
  target.flashT = 0.12;
  target.staggerAcc += poiseDmg;
  sfx.hitFlesh(); G.shake = Math.min(0.5, G.shake + 0.15); G.hitstop = 0.045;
  spawnSparks(new THREE.Vector3(target.pos.x, 1.75, target.pos.z), 12, target.id === 0 ? 0xffe6a0 : 0xff9a5e, 6);
  if (target.state === 'requiem') {
    target.state = 'stagger'; target.t = 0;
    D.requiemBy = -1; D.requiemT = 0; D.reviveT = 0;
    showSub('THE REQUIEM BREAKS');
    sfx.stagger();
  } else if (target.staggerAcc >= 130 && target.state !== 'stagger' && target.state !== 'windup' && target.hp > 0) {
    target.staggerAcc = 0; target.state = 'stagger'; target.t = 0; target.attackKind = '';
    telegraphEl.classList.add('hidden');
    showSub(`${target.name} STAGGERS — STRIKE NOW`);
    sfx.stagger();
  }
  duoSyncHP();
  if (!D.phase2 && D.hp < D.maxHP * 0.5 && D.hp > 0) {
    D.phase2 = true;
    showCenter('THE HOLLOW CHOIR RISES', 'the twins sing as one — their cadence quickens');
    intensifyBossMusic();
    spawnRing(D.pos, 0xe4c470, 15);
  }
  if (target.hp <= 0) duoDown(target);
  else if (prev > 0 && D.requiemBy >= 0 && target.id === D.requiemBy) {
    // The singer was struck but survived: the requiem still breaks.
    D.requiemBy = -1; D.requiemT = 0; D.reviveT = 0;
  }
}
function updateDuo(dt) {
  if (D.state === 'dormant') return;
  D.t += dt; D.animT += dt;
  D.tollCd = Math.max(0, D.tollCd - dt);
  duoSelectTarget();
  for (const T of duoTwins) {
    if (T.hp <= 0 && T.state !== 'dead') duoDown(T);
    updateDuoTwin(T, dt);
  }
  if (D.state !== 'dead') {
    if (D.requiemBy >= 0) {
      const singer = duoTwins[D.requiemBy], fallen = duoOther(singer);
      if (singer.state === 'dead' || fallen.state !== 'dead') {
        D.requiemBy = -1; D.requiemT = 0; D.reviveT = 0;
      } else {
        D.requiemT += dt;
        if (singer.state !== 'requiem' && D.requiemT >= 2.4 && ['idle', 'advance', 'recover'].includes(singer.state)) {
          singer.state = 'requiem'; singer.t = 0; singer.attackKind = ''; singer.hasHit = false;
          telegraphEl.classList.add('hidden');
          showCenter('THE REQUIEM RISES', `strike ${singer.name} before the song completes`);
          sfx.cast();
        }
        if (singer.state === 'requiem') {
          D.reviveT += dt;
          if (Math.random() < 0.16) spawnSparks(new THREE.Vector3(fallen.pos.x + (Math.random() - 0.5) * 1.4, 0.3 + Math.random() * 1.6, fallen.pos.z + (Math.random() - 0.5) * 1.4), 1, 0xf0d9a0, 1.2);
          if (D.reviveT >= 4.6) duoRevive(fallen, singer);
        }
      }
    }
    bossNameEl.textContent = duoName();
    const t = duoTwins[D.target];
    if (t) {
      D.pos.copy(t.pos);
      D.yaw = t.yaw;
    }
  }
  for (const t of duoTwins) {
    t.k.group.position.copy(t.pos);
    t.k.group.rotation.y = t.yaw;
    t.shadow.position.set(t.pos.x, 0.025, t.pos.z);
    t.shadow.visible = t.state !== 'dead' && t.state !== 'dormant';
  }
}
function poseDuo(dt) {
  const time = performance.now() * 0.001;
  for (const T of duoTwins) {
    const K = T.k;
    if (!K.group.visible) continue;
    const moving = T.state === 'idle' || T.state === 'advance';
    poseKnight(K, { moving, sprint: false, bossStep: true, state: T.state === 'requiem' ? 'block' : T.state, t: T.t, kind: T.attackKind, pos: T.pos, yaw: T.yaw, enrage: D.phase2 }, dt);
    if (T.state === 'requiem') {
      const p = K.parts;
      p.armL.sh.rotation.x = -2.4 + Math.sin(time * 2.2) * 0.1;
      p.armR.sh.rotation.x = -2.4 + Math.sin(time * 2.2 + 1) * 0.1;
      p.armL.el.rotation.x = -0.25; p.armR.el.rotation.x = -0.25;
    }
    if (K.parts.halo) { K.parts.halo.rotation.z = time * 0.25; K.parts.haloMat.opacity = (T.state === 'requiem' ? 0.9 : 0.38) + Math.sin(time * 2.4 + T.id) * 0.1; }
    if (K.parts.candles) for (let i = 0; i < K.parts.candles.length; i++) K.parts.candles[i].material.opacity = 0.62 + Math.sin(time * 7 + i * 2) * 0.18;
    if (K.parts.bell) K.parts.bell.rotation.x = Math.sin(time * 1.8 + T.id) * 0.10 + (T.state === 'windup' ? -0.5 : 0);
    if (K.parts.swordGlow) K.parts.swordGlow.material.opacity = T.state === 'windup' ? 0.5 + Math.sin(time * 12) * 0.2 : 0.06;
  }
}

function resetFang() {
  F.maxHP = TUNE.fangHP + G.ng * 142;
  F.hp = F.maxHP; F.pos.set(FANG_CENTER.x, 0, FANG_CENTER.z - 5); F.yaw = Math.PI;
  F.state = 'dormant'; F.t = 0; F.decideCd = 0; F.attackKind = ''; F.hasHit = false;
  F.phase2 = false; F.staggerAcc = 0; F.deadT = 0; F.lastAttack = '';
  clearBossHazards(); clearHexHazards();
  hideFangMarkWarn(); telegraphEl.classList.add('hidden');
  clearFangEchoes();
  clearFangSlashes();
  fangK.group.position.copy(F.pos); fangK.group.rotation.y = F.yaw;
  fangK.group.scale.setScalar(FANG_BASE_SCALE);
  fangK.group.visible = false; fangShadow.visible = false;
  if (fangK.parts.swordGlow) fangK.parts.swordGlow.material.opacity = 0;
  if (G.bossId === 'fang') { bossPlate.classList.add('hidden'); G.bossActive = false; }
}
function resetDragon() {
  V.maxHP = TUNE.dragonHP + G.ng * 187;
  V.hp = V.maxHP; V.pos.set(DRAGON_CENTER.x, 0, DRAGON_CENTER.z - 5); V.yaw = Math.PI;
  V.state = 'dormant'; V.t = 0; V.decideCd = 0; V.attackKind = ''; V.hasHit = false;
  V.phase2 = false; V.staggerAcc = 0; V.deadT = 0; V.breathCd = 0; V.stormCd = 0; V.roarCd = 0; V.lastAttack = '';
  clearBossHazards();
  stopDragonBreath();
  hideDragonBreathWarn();
  hideDragonDiveWarn();
  hideDragonBackdraftWarn();
  dragonK.group.position.copy(V.pos); dragonK.group.rotation.y = V.yaw;
  dragonK.group.scale.setScalar(DRAGON_BASE_SCALE);
  dragonK.parts.root.position.set(0, 0, 0);
  dragonK.parts.root.rotation.set(0, 0, 0);
  dragonK.parts.mouthGlow.material.opacity = 0;
  dragonK.group.visible = false; dragonShadow.visible = false;
  if (G.bossId === 'dragon') { bossPlate.classList.add('hidden'); G.bossActive = false; }
  telegraphEl.classList.add('hidden');
}
function resetWitch() {
  W.maxHP = TUNE.witchHP + G.ng * 140;
  W.hp = W.maxHP; W.pos.set(WITCH_CENTER.x, 0, WITCH_CENTER.z - 4); W.yaw = Math.PI;
  W.state = 'dormant'; W.t = 0; W.decideCd = 0; W.attackKind = ''; W.hasHit = false;
  W.phase2 = false; W.lunarPhase = false; W.specialCd = 0; W.summonCd = 0; W.beamCd = 0; W.staggerAcc = 0; W.deadT = 0; W.volleyCount = 0;
  G.witchAwakening = false; G.witchAwakeT = 0;
  G.witchLunarCutscene = false; G.witchLunarT = 0; G.witchLunarImpacted = false;
  witchLunarAura.group.visible = false;
  clearHexHazards();
  witchK.group.scale.setScalar(WITCH_BASE_SCALE);
  witchK.group.position.copy(W.pos); witchK.group.rotation.y = W.yaw;
  witchK.group.visible = false; witchShadow.visible = false;
  if (G.bossId === 'witch') { bossPlate.classList.add('hidden'); G.bossActive = false; }
  telegraphEl.classList.add('hidden');
}
function resetBoss(scaleHp = 1) {
  stopBossMusic();
  B.maxHP = (TUNE.bossHP + G.ng * 150) * scaleHp;
  B.hp = B.maxHP; B.pos.set(0, 0, -8); B.yaw = 0;
  B.state = 'dormant'; B.t = 0; B.poise = 100; B.phase2 = false; B.blocking = false; B.specialCd = 0; B.fireCd = 0;
  B.infernoFormed = false; B.infernoTargeted = false; B.infernoImpacted = false;
  clearBossHazards();
  bossK.parts.body.visible = true; bossFireAura.group.visible = false;
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
resetBoss(); resetWitch(); resetDragon(); resetFang(); resetPlayer();
applyWorldStyle(G.bossId);

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
  if (e.code === 'KeyT') { e.preventDefault(); toggleVigilMenu(); return; }
  if (e.code === 'KeyQ') { e.preventDefault(); toggleLock(); return; }
  if (e.code === 'Escape') {
    if (!vigilMenuEl.classList.contains('hidden')) { closeVigilMenu(); return; }
    if (!inventoryEl.classList.contains('hidden')) closeInventory();
    return;
  }
  if (/^Digit[1-9]$/.test(e.code) || e.code === 'Digit0') {
    const slot = e.code === 'Digit0' ? 9 : +e.code.slice(5) - 1;
    const id = WEAPON_ORDER[slot];
    if (id && P.owned.includes(id)) equipWeapon(id);
    return;
  }
  if (G.mode !== 'play' || G.awakening || G.witchAwakening || G.witchLunarCutscene) return;
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
  if (G.mode !== 'play' || G.awakening || G.witchAwakening || G.witchLunarCutscene) return;
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
  if (G.awakening || G.witchAwakening || G.witchLunarCutscene) return;
  if (G.bossId === 'witch') {
    if (G.inArena && !G.bossActive && !G.bossDead && near(witchStonePos, P.pos, 3.6)) touchWitchStone();
    return;
  }
  if (G.bossId === 'dragon') {
    if (G.inArena && !G.bossActive && !G.bossDead && near(dragonStonePos, P.pos, 3.8)) touchDragonStone();
    return;
  }
  if (G.bossId === 'fang') {
    if (G.inArena && !G.bossActive && !G.bossDead && near(fangStonePos, P.pos, 3.8)) touchFangStone();
    return;
  }
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
  const t = activeBoss();
  return G.bossActive && t.state !== 'dead' && t.state !== 'dormant' && activeBossGroup().visible;
}
function setLock(on) {
  G.locked = !!on && lockTargetValid();
  lockHint.classList.toggle('hidden', !G.locked);
}
function toggleLock() {
  if (G.mode !== 'play' || !G.bossActive) return;
  if (G.locked) {
    setLock(false);
    showSub('LOCK-ON RELEASED');
  } else {
    setLock(true);
    if (G.locked) showSub('LOCKED ON');
  }
}
function lockOnActive() { return G.locked && lockTargetValid(); }
function bossFacingYaw() {
  const t = activeBoss();
  const dx = t.pos.x - P.pos.x, dz = t.pos.z - P.pos.z;
  if (dx * dx + dz * dz < 1e-4) return P.yaw;
  return Math.atan2(dx, dz);
}
function resolveBossCollision() {
  const t = activeBoss(), grp = activeBossGroup();
  if (!grp.visible || t.state === 'dead' || t.state === 'inferno' || !G.bossActive) return;
  const dx = P.pos.x - t.pos.x, dz = P.pos.z - t.pos.z;
  const d = Math.hypot(dx, dz);
  const scaleF = activeBossScale();
  const minD = (G.bossId === 'witch' ? 1.05 : G.bossId === 'dragon' ? 2.2 : G.bossId === 'duo' ? 1.32 : 1.12) * scaleF + 0.42;
  if (d >= minD) return;
  let nx, nz;
  if (d < 1e-4) { const a = P.yaw + Math.PI; nx = Math.sin(a); nz = Math.cos(a); }
  else { nx = dx / d; nz = dz / d; }
  P.pos.x = t.pos.x + nx * minD;
  P.pos.z = t.pos.z + nz * minD;
  if (G.inArena) clampToActiveArena(P.pos, 0.8);
  P.pos.y = 0;
}
function resolveStoneCollision() {
  if (!G.inArena) return;
  const s = activeStonePos();
  const dx = P.pos.x - s.x, dz = P.pos.z - s.z;
  const d = Math.hypot(dx, dz), minD = G.bossId === 'witch' ? 1.75 : G.bossId === 'dragon' ? 2.2 : G.bossId === 'fang' ? 1.9 : G.bossId === 'duo' ? 1.9 : 1.15;
  if (d >= minD) return;
  let nx, nz;
  if (d < 1e-4) { nx = 0; nz = 1; }
  else { nx = dx / d; nz = dz / d; }
  P.pos.x = s.x + nx * minD;
  P.pos.z = s.z + nz * minD;
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
  if (!G.bossActive || B.state === 'dead' || B.state === 'transform' || B.state === 'inferno' || G.mode !== 'play') return;
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
    B.phase2 = true; B.state = 'inferno'; B.t = 0; B.blocking = false; B.poise = 100;
    B.attackKind = ''; B.specialCd = 4; B.fireCd = 0;
    B.infernoFormed = false; B.infernoTargeted = false; B.infernoImpacted = false;
    clearBossHazards();
    G.hitstop = 0.12;
    showCenter('THE ASHEN VIGIL BREAKS', 'he becomes a living pyre — the ground will burn');
    bossNameEl.textContent = 'SER DUNCAN  ·  THE ASHEN LORD';
    sfx.roar(); spawnRing(B.pos, 0xff5030, 12);
    intensifyBossMusic();
    spawnSparks(new THREE.Vector3(B.pos.x, 2.2, B.pos.z), 40, 0xff6a2a, 7);
    telegraphEl.classList.add('hidden'); bossK.parts.swordGlow.material.opacity = 0;
  }
  if (B.hp <= 0) bossDie();
}
function damageWitch(dmg, poiseDmg = 26) {
  if (!G.bossActive || W.state === 'dead' || W.state === 'rage' || W.state === 'lunar' || G.mode !== 'play') return;
  dmg *= P.mods.dmg;
  W.hp = Math.max(0, W.hp - dmg);
  W.staggerAcc += poiseDmg;
  sfx.hitFlesh(); G.shake = Math.min(0.5, G.shake + 0.16); G.hitstop = 0.05;
  spawnSparks(new THREE.Vector3(W.pos.x, 1.8, W.pos.z), 12, 0xc9a0ff, 6);
  if (W.staggerAcc >= 130 && W.state !== 'stagger' && W.hp > 0) {
    W.state = 'stagger'; W.t = 0; W.staggerAcc = 0; W.attackKind = '';
    telegraphEl.classList.add('hidden'); G.hitstop = 0.1;
    showSub('THE HEX STAGGERS — STRIKE NOW!');
    sfx.stagger();
  }
  if (!W.phase2 && W.hp < W.maxHP * 0.5 && W.hp > 0) {
    W.maxHP *= 2;
    W.hp = W.maxHP;
    W.phase2 = true; W.state = 'rage'; W.t = 0; W.specialCd = 2; W.staggerAcc = 0; W.volleyCount = 0;
    G.hitstop = 0.12;
    showCenter('THE VEIL TEARS', 'the Nightshade Hex is unbound');
    bossNameEl.textContent = 'MORGANA  ·  THE VEIL UNBOUND';
    intensifyBossMusic();
    sfx.roar(); spawnRing(W.pos, 0x9b5cff, 13);
    spawnHexWave(W.pos.x, W.pos.z, Math.round(TUNE.witchDmg.wave * (1 + G.ng * 0.25)), 14, WITCH_R, 0xd54aff);
    spawnSparks(new THREE.Vector3(W.pos.x, 2.2, W.pos.z), 46, 0x9b5cff, 8);
  } else if (W.phase2 && !W.lunarPhase && W.hp < W.maxHP * 0.25 && W.hp > 0) {
    G.hitstop = 0.12;
    startWitchLunarCutscene();
  }
  if (W.hp <= 0) witchDie();
}
function dealDamageToActiveBoss(dmg, poiseDmg) {
  if (G.bossId === 'witch') damageWitch(dmg, poiseDmg);
  else if (G.bossId === 'dragon') damageDragon(dmg, poiseDmg);
  else if (G.bossId === 'fang') damageFang(dmg, poiseDmg);
  else damageBoss(dmg, poiseDmg);
}

// ============ FLOW ============
function showCenter(t, sub = '') { centerMsg.textContent = t; centerMsg.classList.remove('hidden'); subMsg.textContent = sub; subMsg.classList.toggle('hidden', !sub); clearTimeout(showCenter._t); showCenter._t = setTimeout(() => { centerMsg.classList.add('hidden'); subMsg.classList.add('hidden'); }, 2600); }
function showSub(t) { subMsg.textContent = t; subMsg.classList.remove('hidden'); clearTimeout(showSub._t); showSub._t = setTimeout(() => subMsg.classList.add('hidden'), 1400); }

const BOSS_ARRIVAL = {
  duncan: ['THE ASHEN RING', 'approach the ashen stone and press E to wake the knight'],
  witch: ['MORGANA', 'the Nightshade Hex awaits — touch the crystal to summon her'],
  dragon: ['VYTLES, THE DRAGON', 'the caldera breathes — touch the dragon stone to wake him'],
  fang: ['KORVATH, THE ECLIPSE FANG', 'the moonless court waits — touch the eclipse stone'],
  duo: ['THE HOLLOW CHOIR', 'the sepulchre waits — touch the choir stone to wake the twins'],
};

function showBossArrival(id) {
  const m = BOSS_ARRIVAL[id];
  if (m) showCenter(m[0], m[1]);
}
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
function touchWitchStone() {
  if (!G.inArena || G.bossActive || G.bossDead || G.witchAwakening) return;
  G.witchAwakening = true; G.witchAwakeT = 0;
  setLock(false);
  P.state = 'idle'; P.t = 0;
  P.yaw = Math.atan2(witchStonePos.x - P.pos.x, witchStonePos.z - P.pos.z);
  spawnSparks(new THREE.Vector3(witchStonePos.x, 2.2, witchStonePos.z), 24, 0xd9b7ff, 4);
  spawnRing(new THREE.Vector3(witchStonePos.x, 0, witchStonePos.z), 0x9b5cff, 5);
  sfx.cast(); G.shake = Math.max(G.shake, 0.14);
  showCenter('THE NIGHTSHADE CRYSTAL', 'the veil answers your touch');
}
function updateWitchAwakening(dt) {
  G.witchAwakeT += dt;
  const T = G.witchAwakeT;
  P.t += dt;
  if (witchCrystal) {
    const k = Math.min(1, T / 0.9);
    witchCrystal.rotation.y += dt * (3 + k * 14);
    witchCrystalMat.emissiveIntensity = 2.6 + k * 4.5;
    witchCrystalGlow.material.opacity = 0.42 + k * 0.4;
    witchCrystalGlow.scale.setScalar(4.4 + k * 3.0);
    witchLight.intensity = 46 + k * 34;
  }
  if (T < 1.1 && Math.random() < 0.6) {
    spawnSparks(new THREE.Vector3(
      witchStonePos.x + (Math.random() - 0.5) * 1.8,
      0.6 + Math.random() * 2.4,
      witchStonePos.z + (Math.random() - 0.5) * 1.8
    ), 1, Math.random() < 0.5 ? 0x9b5cff : 0xd9b7ff, 2.6);
  }
  if (T >= 1.15) {
    G.witchAwakening = false;
    spawnRing(new THREE.Vector3(witchStonePos.x, 0, witchStonePos.z), 0xd54aff, 9);
    spawnSparks(new THREE.Vector3(witchStonePos.x, 2.3, witchStonePos.z), 52, 0xd9b7ff, 8);
    sfx.pillar(); G.shake = Math.max(G.shake, 0.45);
    beginWitch();
  }
}
function playerDie() {
  P.state = 'dead'; P.t = 0; G.mode = 'dead'; sfx.death();
  stopBossMusic();
  clearBossHazards();
  clearHexHazards();
  hideDragonBreathWarn(); hideDragonDiveWarn(); hideDragonBackdraftWarn(); hideFangMarkWarn();
  clearFangEchoes(); clearFangSlashes();
  telegraphEl.classList.add('hidden');
  setTimeout(() => deathScreen.classList.remove('hidden'), 900);
  setTimeout(() => {
    deathScreen.classList.add('hidden');
    if (G.bossId === 'witch') {
      resetWitch(); G.inArena = true;
      resetPlayer();
      P.pos.set(WITCH_CENTER.x, 0, WITCH_CENTER.z + 8); P.yaw = Math.PI;
      updateFlasks(); G.mode = 'play';
      showCenter('YOU WAKE AT THE VEIL', 'touch the nightshade crystal to call her back');
    } else if (G.bossId === 'dragon') {
      resetDragon(); G.inArena = true;
      resetPlayer();
      P.pos.set(DRAGON_CENTER.x, 0, DRAGON_CENTER.z + 8); P.yaw = Math.PI;
      updateFlasks(); G.mode = 'play';
      showCenter('YOU WAKE AT THE CALDERA', 'touch the dragon stone to call Vytles back');
    } else if (G.bossId === 'fang') {
      resetFang(); G.inArena = true;
      resetPlayer();
      P.pos.set(FANG_CENTER.x, 0, FANG_CENTER.z + 8); P.yaw = Math.PI;
      updateFlasks(); G.mode = 'play';
      showCenter('YOU WAKE IN THE MOONLESS COURT', 'touch the eclipse stone to call Korvath back');
    } else {
      G.inArena = false; fogGate.material.opacity = 0.55;
      resetBoss(); resetPlayer(); updateFlasks();
      G.mode = 'play';
      showCenter('YOU WAKE AT THE BONFIRE', 'the fog awaits again — he believes in you');
    }
  }, 3400);
}
function bossDie() {
  B.state = 'dead'; B.t = 0; G.bossDead = true; G.bossActive = false; G.defeated.duncan = true;
  stopBossMusic();
  setLock(false);
  clearBossHazards();
  bossK.parts.body.visible = true; bossFireAura.group.visible = false;
  telegraphEl.classList.add('hidden'); bossK.parts.swordGlow.material.opacity = 0;
  sfx.victory(); spawnSparks(new THREE.Vector3(B.pos.x, 1.5, B.pos.z), 40, 0xffd76e, 7); spawnRing(B.pos, 0xffd76e, 10);
  G.drops = bossDropsFor('duncan');
  setTimeout(showDropScreen, 1500);
}
function witchDie() {
  W.state = 'dead'; W.t = 0; W.deadT = 0; G.bossDead = true; G.bossActive = false; G.defeated.witch = true;
  stopBossMusic();
  setLock(false);
  clearHexHazards();
  telegraphEl.classList.add('hidden');
  sfx.victory();
  spawnSparks(new THREE.Vector3(W.pos.x, 1.5, W.pos.z), 44, 0xd9b7ff, 7);
  spawnRing(W.pos, 0x9b5cff, 11);
  G.drops = bossDropsFor('witch');
  setTimeout(showDropScreen, 1500);
}
function showDropScreen() {
  if (G.mode !== 'play') return;
  const titleEl = $('drop-title');
  if (titleEl) titleEl.textContent = (BOSSES[G.bossId] ? BOSSES[G.bossId].name.toUpperCase() : 'THE VIGIL') + ' HAS FALLEN';
  const list = $('drop-list'); list.innerHTML = '';
  for (const d of G.drops) {
    const rc = RARITY[d.rarity];
    const card = document.createElement('div');
    card.className = 'drop-card rarity-' + d.rarity;
    const typeTag = d.type === 'weapon' ? 'WEAPON' : d.boss ? 'BOSS SHARD' : 'SPOILS';
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
  const isWitch = G.bossId === 'witch';
  const isDragon = G.bossId === 'dragon';
  const isFang = G.bossId === 'fang';
  const mins = Math.floor(G.fightTime / 60), secs = Math.floor(G.fightTime % 60);
  victoryStats.innerHTML = `Time <b>${mins}:${String(secs).padStart(2, '0')}</b> · NG+<b>${G.ng}</b><br>Estus left <b>${P.flasks}</b> · HP <b>${Math.ceil(P.hp)}/${P.maxHP}</b>`;
  $('victory-title').textContent = isFang ? 'THE ECLIPSE BREAKS' : isDragon ? 'THE CALDERA FALLS SILENT' : isWitch ? 'THE HOLLOW FALLS SILENT' : 'THE VIGIL ENDS';
  $('victory-tip').textContent = isFang
    ? 'New Game+ : Korvath\'s shadow cuts deeper. Can you outrun the eclipse again?'
    : isDragon
    ? 'New Game+ : the dragon\'s fire burns 25% hotter. Can you cool the caldera again?'
    : isWitch
      ? 'New Game+ : her hexes bite 25% harder. How deep will you walk the veil?'
      : 'New Game+ : he hits 25% harder each victory. How high can you go?';
  $('btn-again').textContent = isFang ? '↻  FACE THE ECLIPSE AGAIN  ↻' : isDragon ? '↻  FACE THE DRAGON AGAIN  ↻' : isWitch ? '↻  FACE HER AGAIN  ↻' : '↻  FACE HIM AGAIN  ↻';
  buildVictorySwitch();
  victoryScreen.classList.remove('hidden');
}
function renderBossSwitchCards(host, onPick) {
  if (!host) return;
  host.innerHTML = '';
  for (const def of Object.values(BOSSES)) {
    const current = def.id === G.bossId;
    const felled = !!G.defeated[def.id];
    const unlocked = bossUnlocked(def.id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'vs-card' + (felled ? ' defeated' : '') + (current ? ' current' : '') + (!unlocked ? ' locked' : '');
    card.style.setProperty('--accent', def.accent);
    card.disabled = current || !unlocked;
    const state = !unlocked
      ? 'SEALED · FELL ' + (previousBossName(def.id) || 'THE PREVIOUS VIGIL').toUpperCase() + ' FIRST'
      : current ? 'THIS VIGIL · ' + (felled ? 'FELLED' : 'UNBROKEN') : felled ? 'FELLED · RETURN' : 'HUNT ›';
    card.innerHTML = '<span class="vs-glyph">' + def.glyph + '</span>' +
      '<span class="vs-name">' + def.name + '</span>' +
      '<span class="vs-epithet">' + def.epithet + '</span>' +
      '<span class="vs-state">' + state + '</span>';
    if (!current && unlocked) card.onclick = () => onPick(def.id);
    host.appendChild(card);
  }
}
function buildVictorySwitch() {
  renderBossSwitchCards($('victory-boss-list'), switchBossFromVictory);
}
function travelToWorld(id, source) {
  if (!BOSSES[id] || id === G.bossId) return;
  if (!bossUnlocked(id)) {
    showSub('SEALED — FELL ' + (previousBossName(id) || 'THE PREVIOUS VIGIL').toUpperCase() + ' FIRST');
    return;
  }
  if (source === 'victory') {
    victoryScreen.classList.add('hidden');
    dropScreenEl.classList.add('hidden');
  } else {
    closeVigilMenu();
  }
  stopBossMusic();
  chooseBoss(id);
  showCenter(id === 'witch' ? 'THE NIGHTSHADE HOLLOW' : id === 'dragon' ? 'THE CALDERA' : id === 'fang' ? 'THE MOONLESS COURT' : 'THE ASHEN RING',
    id === 'witch' ? 'a violet forest beyond the veil' : id === 'dragon' ? 'a burning hollow beneath the world' : id === 'fang' ? 'a court where the last light died' : 'the old meadow, far from the hollow');
}
function switchBossFromVictory(id) { travelToWorld(id, 'victory'); }
function switchBossFromVigil(id) { travelToWorld(id, 'vigil'); }
function anyVigilFelled() { return Object.values(G.defeated).some(Boolean); }
function toggleVigilMenu() {
  if (!vigilMenuEl) return;
  if (!vigilMenuEl.classList.contains('hidden')) { closeVigilMenu(); return; }
  if (G.mode !== 'play') return;
  if (!anyVigilFelled() && !G.creator) { showSub('DEFEAT A VIGIL TO UNLOCK THE CROSSROADS'); return; }
  if (G.bossActive) { showSub('THE DUEL IS NOT DONE'); return; }
  if (!inventoryEl.classList.contains('hidden')) closeInventory();
  renderBossSwitchCards(vigilBossListEl, switchBossFromVigil);
  vigilMenuEl.classList.remove('hidden');
  G.paused = true;
  if (document.pointerLockElement) document.exitPointerLock();
}
function closeVigilMenu() {
  if (!vigilMenuEl) return;
  vigilMenuEl.classList.add('hidden');
  if (G.mode === 'play') G.paused = false;
}

// ============ ARENA SELECTION ============
function enterBossArena(id) {
  const def = BOSSES[id]; if (!def) return;
  ARENA = def.arena; G.bossId = id;
  witchArenaGroup.visible = id === 'witch';
  witchWorldGroup.visible = id === 'witch';
  dragonArenaGroup.visible = id === 'dragon';
  dragonWorldGroup.visible = id === 'dragon';
  fangArenaGroup.visible = id === 'fang';
  fangWorldGroup.visible = id === 'fang';
  applyWorldStyle(id);
  G.awakening = false; G.bossRevealed = false; G.bossRevealY = 0;
  G.witchAwakening = false; G.witchAwakeT = 0;
  G.bossActive = false; G.bossDead = false; G.fightTime = 0; G.paused = false;
  G.inArena = true; G.locked = false; lockHint.classList.add('hidden');
  clearBossHazards(); clearHexHazards();
  resetBoss(); resetWitch(); resetDragon(); resetFang(); resetPlayer();
  P.yaw = Math.PI; G.camYaw = 0; G.camPitch = 0.22;
  bossPlate.classList.add('hidden');
  setBossName(id);
  if (id === 'witch') {
    P.pos.set(WITCH_CENTER.x, 0, WITCH_CENTER.z + 8); P.yaw = Math.PI;
    fogGate.material.opacity = 0.1;
  } else if (id === 'dragon') {
    P.pos.set(DRAGON_CENTER.x, 0, DRAGON_CENTER.z + 8); P.yaw = Math.PI;
    fogGate.material.opacity = 0.1;
  } else if (id === 'fang') {
    P.pos.set(FANG_CENTER.x, 0, FANG_CENTER.z + 8); P.yaw = Math.PI;
    fogGate.material.opacity = 0.1;
  } else {
    P.pos.set(0, 0, 8); P.yaw = Math.PI;
    fogGate.material.opacity = 0.1;
  }
  camTarget.set(P.pos.x + Math.sin(G.camYaw) * G.camDist, 2.4, P.pos.z + Math.cos(G.camYaw) * G.camDist);
  camLook.set(P.pos.x, 1.7, P.pos.z);
  flashWorldSwap();
}
function chooseBoss(id) {
  const def = BOSSES[id]; if (!def) return;
  if (!bossUnlocked(id)) {
    showSub('SEALED — FELL ' + (previousBossName(id) || 'THE PREVIOUS VIGIL').toUpperCase() + ' FIRST');
    return;
  }
  audio(); startMusic();
  titleScreen.style.display = 'none'; hud.classList.remove('hidden');
  enterBossArena(id);
  updateFlasks(); updateWeaponLabel();
  G.mode = 'play';
  showBossArrival(id);
}
function beginWitch() {
  if (G.bossId !== 'witch' || G.mode !== 'play') return;
  ARENA = ARENAS.witch;
  W.maxHP = TUNE.witchHP + G.ng * 140;
  W.hp = W.maxHP; W.state = 'intro'; W.t = 0; W.attackKind = ''; W.hasHit = false;
  W.phase2 = false; W.lunarPhase = false; W.specialCd = 0; W.summonCd = 0; W.beamCd = 0; W.staggerAcc = 0; W.volleyCount = 0;
  G.witchLunarCutscene = false; G.witchLunarT = 0; G.witchLunarImpacted = false;
  witchLunarAura.group.visible = false;
  W.pos.set(WITCH_CENTER.x, 0, WITCH_CENTER.z - 4); W.yaw = Math.PI;
  witchK.group.visible = true; witchShadow.visible = true;
  witchK.group.scale.setScalar(WITCH_BASE_SCALE);
  G.bossActive = true; G.fightTime = 0; G.bossDead = false;
  bossPlate.classList.remove('hidden');
  setBossName('witch');
  startBossMusic(); setLock(true);
  sfx.roar(); G.shake = Math.max(G.shake, 0.5);
  spawnRing(W.pos, 0x9b5cff, 9);
  spawnSparks(new THREE.Vector3(W.pos.x, 1.4, W.pos.z), 42, 0x9b5cff, 7);
  showCenter('MORGANA', 'the veil stirs — do not let her finish a word');
}
function buildBossSelect() {
  const host = $('boss-select'); if (!host) return;
  host.innerHTML = '';
  for (const def of Object.values(BOSSES)) {
    const unlocked = bossUnlocked(def.id);
    const felled = !!G.defeated[def.id];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'boss-card' + (unlocked ? '' : ' locked') + (felled ? ' defeated' : '');
    card.id = 'boss-card-' + def.id;
    card.style.setProperty('--accent', def.accent);
    card.disabled = !unlocked;
    const desc = unlocked ? def.desc : 'Sealed. Defeat ' + (previousBossName(def.id) || 'the previous vigil') + ' before this road opens.';
    const foot = !unlocked ? 'SEALED' : felled ? 'FELLED · RETURN ›' : 'STEP THROUGH THE FOG ›';
    card.innerHTML = '<span class="boss-glyph">' + def.glyph + '</span>' +
      '<span class="boss-card-name">' + def.name + '</span>' +
      '<span class="boss-card-epithet">' + def.epithet + '</span>' +
      '<span class="boss-card-desc">' + desc + '</span>' +
      '<span class="boss-diff">' + def.difficulty + '</span>' +
      '<span class="boss-enter">' + foot + '</span>';
    if (unlocked) card.onclick = () => chooseBoss(def.id);
    host.appendChild(card);
  }
}
buildBossSelect();

$('btn-claim').onclick = () => claimDrops();
$('btn-erase').onclick = () => eraseSave();
addEventListener('beforeunload', () => saveGame(true));
$('btn-again').onclick = () => {  victoryScreen.classList.add('hidden');
  stopBossMusic();
  if (G.bossId === 'fang') {
    G.ng++; G.bossDead = false; G.fightTime = 0; G.mode = 'play';
    resetFang(); resetPlayer(); G.inArena = true;
    P.pos.set(FANG_CENTER.x, 0, FANG_CENTER.z + 8); P.yaw = Math.PI;
    updateFlasks(); saveGame();
    showCenter('NEW VIGIL — NG+' + G.ng, 'his shadow strikes deeper. Touch the eclipse stone to call Korvath.');
  } else if (G.bossId === 'dragon') {
    G.ng++; G.bossDead = false; G.fightTime = 0; G.mode = 'play';
    resetDragon(); resetPlayer(); G.inArena = true;
    P.pos.set(DRAGON_CENTER.x, 0, DRAGON_CENTER.z + 8); P.yaw = Math.PI;
    updateFlasks(); saveGame();
    showCenter('NEW VIGIL — NG+' + G.ng, 'his fire burns 25% hotter. Touch the dragon stone to call him.');
  } else if (G.bossId === 'witch') {
    G.ng++; G.bossDead = false; G.fightTime = 0; G.mode = 'play';
    resetWitch(); resetPlayer(); G.inArena = true;
    P.pos.set(WITCH_CENTER.x, 0, WITCH_CENTER.z + 8); P.yaw = Math.PI;
    updateFlasks(); saveGame();
    showCenter('NEW VIGIL — NG+' + G.ng, 'her hexes bite 25% harder. Touch the crystal to call her.');
  } else {
    G.ng++; G.bossDead = false; G.inArena = false; G.fightTime = 0;
    fogGate.material.opacity = 0.55; resetBoss(); resetPlayer(); updateFlasks();
    G.mode = 'play'; saveGame();
    showCenter('NEW VIGIL — NG+' + G.ng, 'he strikes 25% harder. Honour him.');
  }
};

// ============ BOSS AI ============
function bossDecide() {
  const d = dist2D(B.pos, P.pos);
  const opts = [];
  if (B.phase2) {
    if (d < 3.6) opts.push('slash', 'slash', 'bash', 'slam');
    else if (d < 7.5) opts.push('thrust', 'slam', 'approach_slash', 'jump');
    else opts.push('run_thrust', 'run_slash', 'jump');
    opts.push('slam', 'jump');
    if (B.fireCd <= 0) opts.push('fireball', 'fireball');
    if (B.specialCd <= 0) {
      opts.push('firewave', 'meteor', 'pillars', 'pillars');
      if (d < 4.6) opts.push('firewave');
    }
    if (Math.random() < 0.035 && d < 5) { B.state = 'block'; B.t = 0; B.blocking = true; return; }
  } else {
    if (d < 3.6) opts.push('slash', 'slash', 'slash', 'bash');
    else if (d < 7) opts.push('approach_slash', 'thrust', 'slam', 'approach_slash');
    else opts.push('run_thrust', 'run_slash', 'run_thrust');
    if (B.specialCd <= 0) {
      opts.push('pillars');
      if (d > 6) opts.push('pillars');
    }
    if (Math.random() < 0.07 && d < 5) { B.state = 'block'; B.t = 0; B.blocking = true; return; }
  }
  const pick = opts[Math.random() * opts.length | 0];
  B.attackKind = pick; B.state = 'chase'; B.t = 0; B.hasHit = false;
}
function bossStartSwing(kind) {
  B.attackKind = kind; B.state = 'windup'; B.t = 0; B.hasHit = false;
  if (kind === 'pillars') B.specialCd = B.phase2 ? 3.0 : 5.5;
  else if (kind === 'fireball') B.fireCd = 1.6;
  else if (kind === 'firewave') B.specialCd = B.phase2 ? 3.4 : 6.0;
  else if (kind === 'meteor') B.specialCd = B.phase2 ? 4.9 : 7.0;
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
  fireball: { wind: 0.68, swing: 0.24, recover: 1.0, range: 60, arc: 6.28, dmg: 'fireball' },
  firewave: { wind: 1.0, swing: 0.28, recover: 1.2, range: 60, arc: 6.28, dmg: 'firewave' },
  meteor: { wind: 1.1, swing: 0.32, recover: 1.45, range: 60, arc: 6.28, dmg: 'meteor' },
};
function bossDoHit(kind) {
  const a = BOSS_ATK[kind]; if (!a) return;
  let mult = 1 + G.ng * 0.25;
  if (B.phase2) mult *= 1.18;
  if (kind === 'pillars') {
    spawnPillarBarrage(mult, B.phase2 ? 20 : 10);
    G.shake = Math.max(G.shake, 0.35);
    return;
  }
  if (kind === 'fireball') {
    spawnFireBoltVolley(B.phase2 ? 6 : 4, 0.14, 10.5 + G.ng * 0.4, Math.round(TUNE.bossDmg.fireball * mult));
    G.shake = Math.max(G.shake, 0.18);
    return;
  }
  if (kind === 'firewave') {
    spawnFireWave(B.pos.x, B.pos.z, Math.round(TUNE.bossDmg.firewave * mult), 12.5, ARENA_R + 1.5);
    sfx.cast(); sfx.pillar();
    G.shake = Math.max(G.shake, 0.4);
    return;
  }
  if (kind === 'meteor') {
    spawnMeteorStorm(mult);
    sfx.cast();
    G.shake = Math.max(G.shake, 0.45);
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

// ============ WITCH AI ============
const WITCH_CAST = {
  bolt: { wind: 0.55, recover: 0.9 },
  wave: { wind: 0.8, recover: 1.1 },
  curse: { wind: 0.72, recover: 1.2 },
  blink: { wind: 0.42, recover: 1.0 },
  storm: { wind: 1.0, recover: 1.55 },
  beam: { wind: 0.82, recover: 1.3 },
  summon: { wind: 0.9, recover: 1.15 },
};
function witchDecide() {
  const d = dist2D(W.pos, P.pos);
  const opts = [];
  if (d < 5.5) opts.push('blink', 'wave', 'bolt', 'blink');
  else opts.push('bolt', 'curse', 'bolt', 'wave');
  if (W.phase2) opts.push('storm', 'curse', 'bolt', 'wave');
  if (W.specialCd <= 0) opts.push(W.phase2 ? 'storm' : 'curse');
  if (W.lunarPhase) {
    if (W.summonCd <= 0 && skeletons.filter(s => s.state !== 'dying').length < 6) opts.push('summon', 'summon', 'summon');
    if (W.beamCd <= 0) opts.push('beam', 'beam', 'beam');
  }
  const pick = opts[Math.random() * opts.length | 0];
  W.attackKind = pick; W.state = 'windup'; W.t = 0; W.hasHit = false;
  W.specialCd = pick === 'storm' ? 7.0 : pick === 'curse' ? 4.5 : pick === 'blink' ? 2.2 : 2.8;
  if (pick === 'summon') W.summonCd = 9.5;
  else if (pick === 'beam') W.beamCd = 5.2;
  sfx.swing();
  telegraphEl.classList.remove('hidden');
}
function witchCast(kind) {
  const mult = 1 + G.ng * 0.25;
  W.volleyCount = (W.volleyCount || 0) + 1;
  telegraphEl.classList.add('hidden');
  if (kind === 'bolt') {
    spawnHexBoltVolley(W.phase2 ? 6 : 4, 0.16, 10.5, Math.round(TUNE.witchDmg.bolt * mult));
    showSub('HEXFIRE SEEKS YOU');
  } else if (kind === 'wave') {
    spawnHexWave(W.pos.x, W.pos.z, Math.round(TUNE.witchDmg.wave * mult), 10.5, WITCH_R, 0x9b5cff);
    sfx.pillar(); G.shake = Math.max(G.shake, 0.25);
    showSub('THE VEIL LASHES OUT — ROLL THROUGH IT');
  } else if (kind === 'curse') {
    const n = W.phase2 ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 5.2;
      let x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
      const dx = x - WITCH_CENTER.x, dz = z - WITCH_CENTER.z, dd = Math.hypot(dx, dz);
      if (dd > WITCH_R - 2.2) { x = WITCH_CENTER.x + dx / dd * (WITCH_R - 2.2); z = WITCH_CENTER.z + dz / dd * (WITCH_R - 2.2); }
      spawnHexPillar(x, z, 1.0 + Math.random() * 0.7, 1.75, TUNE.witchDmg.curse, mult);
    }
    sfx.cast();
    showSub('THE GROUND REMEMBERS HER CURSE — KEEP MOVING');
  } else if (kind === 'blink') {
    const old = W.pos.clone();
    const a = Math.random() * Math.PI * 2, r = 3.0 + Math.random() * 1.4;
    let x = P.pos.x + Math.sin(a) * r, z = P.pos.z + Math.cos(a) * r;
    const dx = x - WITCH_CENTER.x, dz = z - WITCH_CENTER.z, dd = Math.hypot(dx, dz);
    if (dd > WITCH_R - 2.4) { x = WITCH_CENTER.x + dx / dd * (WITCH_R - 2.4); z = WITCH_CENTER.z + dz / dd * (WITCH_R - 2.4); }
    spawnSparks(new THREE.Vector3(old.x, 1.2, old.z), 26, 0x9b5cff, 5);
    spawnRing(old, 0x9b5cff, 4);
    W.pos.set(x, 0, z);
    W.yaw = Math.atan2(P.pos.x - x, P.pos.z - z);
    spawnSparks(new THREE.Vector3(x, 1.2, z), 26, 0xd9b7ff, 5);
    spawnRing(W.pos, 0xd54aff, 4.5);
    spawnHexWave(x, z, Math.round(TUNE.witchDmg.blink * mult), 11, 4.5, 0xd54aff);
    sfx.cast(); G.shake = Math.max(G.shake, 0.2);
    showSub('SHE STEPS THROUGH THE VEIL — BEHIND YOU');
  } else if (kind === 'storm') {
    spawnHexBoltVolley(9, 0.13, 12, Math.round(TUNE.witchDmg.storm * mult));
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 8;
      spawnHexPillar(P.pos.x + Math.cos(a) * r, P.pos.z + Math.sin(a) * r, 1.1 + Math.random() * 0.9, 1.8, TUNE.witchDmg.curse, mult);
    }
    spawnHexWave(W.pos.x, W.pos.z, Math.round(TUNE.witchDmg.wave * mult), 9, WITCH_R, 0xd54aff);
    sfx.roar(); G.shake = Math.max(G.shake, 0.4);
    showSub('THE VEIL RAINS HEXFIRE');
  } else if (kind === 'beam') {
    spawnMoonBeamVolley(mult);
  } else if (kind === 'summon') {
    summonSkeletons(3, mult);
  }
}
function updateWitch(dt) {
  W.t += dt;
  W.specialCd = Math.max(0, W.specialCd - dt);
  W.summonCd = Math.max(0, W.summonCd - dt);
  W.beamCd = Math.max(0, W.beamCd - dt);
  const d = dist2D(W.pos, P.pos);
  const toP = Math.atan2(P.pos.x - W.pos.x, P.pos.z - W.pos.z);
  const turn = W.phase2 ? 3.6 : 2.8;
  switch (W.state) {
    case 'lunar': {
      updateWitchLunar(dt);
      break;
    }
    case 'dormant': {
      W.yaw += angDiff(toP, W.yaw) * Math.min(1, dt);
      break;
    }
    case 'intro': {
      W.yaw += angDiff(toP, W.yaw) * Math.min(1, 2 * dt);
      if (W.t > 1.6) { W.state = 'idle'; W.decideCd = 0.9; }
      break;
    }
    case 'idle': {
      W.yaw += angDiff(toP, W.yaw) * Math.min(1, turn * dt);
      const speed = TUNE.witchSpeed * (W.phase2 ? 1.25 : 1) * (1 + G.ng * 0.08);
      let mx = 0, mz = 0;
      if (d < 6.5) { mx = (W.pos.x - P.pos.x) / Math.max(d, 0.001); mz = (W.pos.z - P.pos.z) / Math.max(d, 0.001); }
      else if (d > 11.5) { mx = (P.pos.x - W.pos.x) / Math.max(d, 0.001); mz = (P.pos.z - W.pos.z) / Math.max(d, 0.001); }
      else { mx = Math.cos(W.t * 0.7) * 0.5; mz = Math.sin(W.t * 0.7) * 0.5; }
      W.pos.x += mx * speed * dt; W.pos.z += mz * speed * dt;
      clampToActiveArena(W.pos, 1.6);
      const cd = Math.hypot(W.pos.x - WITCH_CENTER.x, W.pos.z - WITCH_CENTER.z);
      if (cd < 2.4) {
        const px = W.pos.x - WITCH_CENTER.x, pz = W.pos.z - WITCH_CENTER.z;
        W.pos.x = WITCH_CENTER.x + px / Math.max(cd, 0.001) * 2.4;
        W.pos.z = WITCH_CENTER.z + pz / Math.max(cd, 0.001) * 2.4;
      }
      W.decideCd -= dt;
      if (W.decideCd <= 0 && P.state !== 'dead') witchDecide();
      break;
    }
    case 'windup': {
      W.yaw += angDiff(toP, W.yaw) * Math.min(1, 1.6 * dt);
      const c = WITCH_CAST[W.attackKind] || WITCH_CAST.bolt;
      if (W.t >= c.wind) {
        witchCast(W.attackKind);
        W.state = 'recover'; W.t = 0;
      }
      break;
    }
    case 'recover': {
      W.yaw += angDiff(toP, W.yaw) * Math.min(1, 1.2 * dt);
      const c = WITCH_CAST[W.attackKind] || WITCH_CAST.bolt;
      if (W.t >= c.recover) {
        if (W.volleyCount >= 3) {
          W.state = 'rest'; W.t = 0; W.volleyCount = 0;
          telegraphEl.classList.add('hidden');
          showSub('THE HEX FALTERS — SHE MUST RECOVER');
        } else {
          W.state = 'idle'; W.decideCd = 0.95 + Math.random() * 0.75;
        }
      }
      break;
    }
    case 'rest': {
      W.yaw += angDiff(toP, W.yaw) * Math.min(1, 0.7 * dt);
      if (W.t > 3.0) { W.state = 'idle'; W.decideCd = 0.7 + Math.random() * 0.45; }
      break;
    }
    case 'rage': {
      W.yaw += angDiff(toP, W.yaw) * Math.min(1, 1.4 * dt);
      if (W.t > 1.25) { W.state = 'idle'; W.decideCd = 0.6; }
      break;
    }
    case 'stagger': {
      if (W.t > 1.15) { W.state = 'idle'; W.decideCd = 0.25; }
      break;
    }
    case 'dead': {
      W.deadT += dt;
      if (W.deadT > 2.4) { witchK.group.visible = false; witchShadow.visible = false; }
      break;
    }
  }
  if (G.bossActive && P.state !== 'dead') G.fightTime += dt;
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
        let struck = false;
        const dmg = TUNE.lightDmg[P.combo] * wpn.dmg;
        const bossReach = G.bossId === 'dragon' ? 1.5 : 1.0;
        const bossArc = G.bossId === 'dragon' ? 0.22 : 0;
        if (inArc(P.pos, P.yaw, activeBoss().pos, 3.1 * wpn.reach * bossReach, 1.0 + bossArc)) { dealDamageToActiveBoss(dmg, Math.round(30 * wpn.dmg)); struck = true; }
        if (damageSkeletonsInArc(P.pos, P.yaw, 3.1 * wpn.reach, 1.0, dmg)) struck = true;
        if (struck) P.hasHit = true;
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
        let struck = false;
        const dmg = TUNE.heavyDmg * wpn.dmg;
        const bossReach = G.bossId === 'dragon' ? 1.5 : 1.0;
        const bossArc = G.bossId === 'dragon' ? 0.22 : 0;
        if (inArc(P.pos, P.yaw, activeBoss().pos, 3.3 * wpn.reach * bossReach, 0.9 + bossArc)) { dealDamageToActiveBoss(dmg, Math.round(42 * wpn.dmg)); struck = true; }
        if (damageSkeletonsInArc(P.pos, P.yaw, 3.3 * wpn.reach, 0.9, dmg)) struck = true;
        if (struck) P.hasHit = true;
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
  if (G.inArena) clampToActiveArena(P.pos, 0.8);
  else { P.pos.x = Math.max(-8, Math.min(8, P.pos.x)); P.pos.z = Math.max(10, Math.min(30, P.pos.z)); }
  P.pos.y = 0;
}

// ============ UPDATE: BOSS ============
function infernoSlamImpact() {
  B.infernoImpacted = true;
  B.pos.set(infernoTarget.x, 0, infernoTarget.z);
  infernoOrb.group.visible = false; infernoOrb.light.intensity = 0;
  infernoMark.group.visible = false;
  bossK.parts.body.visible = true;
  bossK.group.scale.setScalar(BOSS_RAGE_SCALE);
  bossShadow.scale.setScalar(1.3);
  G.shake = Math.max(G.shake, 0.9); G.hitstop = 0.1;
  sfx.roar(); sfx.slam(); sfx.pillar();
  spawnRing(B.pos, 0xffd27a, 9);
  spawnRing(B.pos, 0xff7a26, 15);
  spawnRing(B.pos, 0xff3b0a, 22);
  spawnSparks(new THREE.Vector3(B.pos.x, 1.2, B.pos.z), 80, 0xff8a3a, 10);
  spawnInfernoBarrage(1 + G.ng * 0.25);
  spawnFireWave(B.pos.x, B.pos.z, Math.round(TUNE.bossDmg.firewave * (1 + G.ng * 0.25) * 1.18), 11, ARENA_R + 1.5);
  showCenter('THE ASHEN LORD RISES', 'the ring is his furnace now');
  B.state = 'recover'; B.t = 0; B.attackKind = 'pillars'; B.specialCd = 2.5; B.fireCd = 1.0;
}

function updateBoss(dt) {
  B.t += dt;
  B.specialCd = Math.max(0, B.specialCd - dt);
  B.fireCd = Math.max(0, B.fireCd - dt);
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
    case 'inferno': {
      B.yaw += angDiff(toP, B.yaw) * Math.min(1, 1.2 * dt);
      if (!B.infernoFormed) {
        if (Math.random() < 0.8) {
          spawnSparks(new THREE.Vector3(
            B.pos.x + (Math.random() - 0.5) * 1.8,
            0.4 + Math.random() * 2.6,
            B.pos.z + (Math.random() - 0.5) * 1.8
          ), 1, Math.random() < 0.5 ? 0xff5a1e : 0xffc861, 3);
        }
        if (B.t >= 0.45) {
          B.infernoFormed = true;
          bossK.parts.body.visible = false;
          bossK.parts.swordGlow.material.opacity = 0;
          infernoOrb.group.visible = true; infernoOrb.t = 0;
          infernoOrb.group.position.set(B.pos.x, 1.3, B.pos.z);
          infernoOrb.group.scale.setScalar(0.35);
          infernoOrb.light.intensity = 44;
          B.pos.y = 1.3;
          spawnRing(new THREE.Vector3(B.pos.x, 0, B.pos.z), 0xff8a2a, 7);
          spawnSparks(new THREE.Vector3(B.pos.x, 1.4, B.pos.z), 34, 0xff7a24, 7);
          sfx.pillar(); G.shake = Math.max(G.shake, 0.55);
        }
      } else if (!B.infernoImpacted) {
        if (B.t < 1.55) {
          const k = sstep(clampJ((B.t - 0.45) / 1.1, 0, 1));
          B.pos.y = 1.3 + k * 5.2;
          infernoOrb.group.position.set(B.pos.x, B.pos.y, B.pos.z);
          infernoOrb.group.scale.setScalar(0.35 + k * 0.75);
        } else if (B.t < 2.05) {
          B.pos.y = 6.5 + Math.sin((B.t - 1.55) * 8) * 0.15;
          infernoOrb.group.position.set(B.pos.x, B.pos.y, B.pos.z);
          infernoOrb.group.scale.setScalar(1.1);
          if (!B.infernoTargeted) {
            B.infernoTargeted = true;
            const spot = clampArenaSpot(P.pos.x, P.pos.z, 1.4);
            infernoTarget.set(spot.x, 0, spot.z);
            infernoStart.set(B.pos.x, B.pos.y, B.pos.z);
            infernoMark.group.position.set(spot.x, 0, spot.z);
            infernoMark.group.visible = true; infernoMark.t = 0;
            sfx.cast();
          }
        } else {
          const k = clampJ((B.t - 2.05) / 0.4, 0, 1);
          const e = k * k;
          B.pos.x = infernoStart.x + (infernoTarget.x - infernoStart.x) * e;
          B.pos.z = infernoStart.z + (infernoTarget.z - infernoStart.z) * e;
          B.pos.y = infernoStart.y * (1 - e) + 0.35 * e;
          infernoOrb.group.position.set(B.pos.x, B.pos.y, B.pos.z);
          infernoOrb.group.scale.setScalar(1.1 + k * 0.35);
          if (B.t >= 2.45) infernoSlamImpact();
        }
      }
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
      const reach = { slash: 3.0, approach_slash: 3.0, thrust: 4.2, slam: 4.6, run_thrust: 4.2, run_slash: 3.2, jump: 5.2, bash: 2.4, pillars: 99, fireball: 99, firewave: 99, meteor: 99 }[B.attackKind] || 3;
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
      if (B.t >= a.wind) { B.state = 'swing'; B.t = 0; telegraphEl.classList.add('hidden'); bossK.parts.swordGlow.material.opacity = 0; bossDoHit(B.attackKind); if (!['slam', 'jump', 'pillars', 'fireball', 'firewave', 'meteor'].includes(B.attackKind)) sfx.slam(); }
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
  if (B.state !== 'inferno') B.pos.y = 0;
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
  } else if (S === 'inferno') {
    const k = sstep(clampJ(o.t / 0.45, 0, 1));
    hipsDip = 0.06 + k * 0.14;
    torsoX = 0.06 - k * 0.38; headX = -k * 0.5;
    shRx = -0.55 - k * 1.85; elR = -0.55 - k * 0.2; shRz = -0.14 - k * 0.45;
    shLx = -0.45 - k * 1.35; elL = -0.85 - k * 0.35; shLz = 0.18 + k * 0.4;
  } else if (S === 'transform') {
    // armour splits and the knight swells; arms flung wide, head thrown back
    const k = sstep(clampJ(o.t / 1.9, 0, 1)), arch = Math.sin(k * Math.PI);
    hipsDip = 0.10 + arch * 0.14;
    torsoX = 0.06 - arch * 0.45; headX = -arch * 0.55;
    shRx = -0.55 - arch * 1.7; elR = -0.55 - arch * 0.4;
    shLx = -0.45 - arch * 1.0; elL = -0.85 - arch * 0.7;
    shRz = -0.14 - arch * 0.4; shLz = 0.18 + arch * 0.3;
  } else if (S === 'windup') {
    const a = (o.atkTable || BOSS_ATK)[o.kind], k = sstep(clampJ(o.t / ((a && a.wind) || 0.6), 0, 1));
    if (o.kind === 'fireball' || o.kind === 'firewave' || o.kind === 'meteor' || o.kind === 'duskwave' || o.kind === 'duskfire') {
      shRx = -0.55 - k * 2.0; elR = -0.55 + k * 0.3;
      shLx = -0.45 - k * 0.7; elL = -0.85 - k * 0.3;
      torsoX = 0.10 - k * 0.35; torsoY = -k * 0.15; headX = -k * 0.2; hipsDip = k * 0.06;
    } else if (o.kind === 'slam' || o.kind === 'jump' || o.kind === 'pillars' || o.kind === 'plunge' || o.kind === 'skyrend') {
      shRx = -0.55 - k * 2.35; elR = -0.55 + k * 0.4; // blade to the sky
      torsoX = 0.10 - k * 0.32; torsoY = -k * 0.3; hipsDip = k * 0.10; // coil down
      shLx = -0.45 - k * 0.4; elL = -0.85 - k * 0.3; headX = -k * 0.25;
    } else if (o.kind === 'thrust' || o.kind === 'lunge') {
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
    const a = (o.atkTable || BOSS_ATK)[o.kind], dur = (a && a.swing) || 0.3;
    const s = sstep(clampJ(o.t / dur, 0, 1));
    if (o.kind === 'fireball' || o.kind === 'firewave' || o.kind === 'meteor' || o.kind === 'duskwave' || o.kind === 'duskfire') {
      shRx = -2.55 + s * 2.35; elR = -0.15;
      torsoX = -0.3 + s * 0.9; hipsDip = 0.08 + s * 0.12;
      shLx = -1.05 + s * 0.6; headX = s * 0.3;
      trailT = Math.sin(s * Math.PI) * 0.6;
    } else if (o.kind === 'slam' || o.kind === 'jump' || o.kind === 'pillars' || o.kind === 'plunge' || o.kind === 'skyrend') {
      shRx = -2.9 + s * 2.7; elR = -0.15; torsoX = -0.22 + s * 0.85; hipsDip = 0.10 + s * 0.10;
      headX = s * 0.3; shLx = -0.85 + s * 0.5;
      trailT = Math.sin(s * Math.PI) * 0.6;
      if (o.kind === 'jump' || o.kind === 'plunge') K.group.position.y += Math.sin(s * Math.PI) * (o.kind === 'plunge' ? 1.5 : 0.9);
    } else if (o.kind === 'thrust' || o.kind === 'lunge') {
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

// ============ WITCH POSE ============
function poseWitch(dt) {
  const time = performance.now() * 0.001;
  const p = witchK.parts;
  let hover = 0.035 + Math.sin(time * 1.55) * 0.012;
  let rX = -0.24 + Math.sin(time * 1.2) * 0.045, rZ = -0.16;
  let lX = -0.24 + Math.sin(time * 1.1 + 1) * 0.045, lZ = 0.16;
  let rEl = -0.30 + Math.sin(time * 0.9 + 2) * 0.04;
  let lEl = -0.24 + Math.sin(time * 0.85) * 0.04;
  let headX = Math.sin(time * 0.9) * 0.04, headY = Math.sin(time * 0.6) * 0.08;
  let rootZ = Math.sin(time * 0.7) * 0.018;
  let restK = 0;
  if (W.state === 'windup') {
    const c = WITCH_CAST[W.attackKind] || WITCH_CAST.bolt;
    const k = sstep(clampJ(W.t / c.wind, 0, 1));
    rX = -0.24 - k * 1.75; rZ = -0.16 - k * 0.35; rEl = -0.30 - k * 0.5;
    lX = -0.24 - k * 0.5; lZ = 0.16 + k * 0.45; lEl = -0.24 - k * 0.45;
    headX = -k * 0.2; headY = -k * 0.1; hover += k * 0.2;
  } else if (W.state === 'recover') {
    const c = WITCH_CAST[W.attackKind] || WITCH_CAST.bolt;
    const k = clampJ(W.t / c.recover, 0, 1);
    rX = -2.0 + k * 1.75; rZ = -0.5 + k * 0.3; rEl = -0.8 + k * 0.45;
    lX = -0.9 + k * 0.6; lZ = 0.7 - k * 0.5; lEl = -0.7 + k * 0.4;
    headX = -0.2 + k * 0.2;
  } else if (W.state === 'rest') {
    restK = sstep(clampJ(W.t / 0.6, 0, 1));
    rX = -0.24 + restK * 0.15; rZ = -0.16 + restK * 0.2;
    lX = -0.24 + restK * 0.12; lZ = 0.16 - restK * 0.08;
    rEl = -0.30 - restK * 0.55; lEl = -0.24 - restK * 0.32;
    headX = restK * 0.12 + Math.sin(time * 1.1) * 0.02;
    headY = Math.sin(time * 0.4) * 0.05;
    hover = 0.035 + Math.sin(time * 1.2) * 0.008 - restK * 0.012;
  } else if (W.state === 'rage') {
    const k = sstep(clampJ(W.t / 1.2, 0, 1));
    rX = -1.4 - Math.sin(W.t * 18) * 0.1; rZ = -1.0; lX = -1.4; lZ = 1.0;
    rEl = -0.15; lEl = -0.15;
    headX = -0.35; hover += 0.35 * Math.sin(k * Math.PI);
  } else if (W.state === 'lunar') {
    const k = sstep(clampJ(W.t / 1.15, 0, 1));
    const tremor = Math.sin(W.t * 17) * 0.045 * (1 - k * 0.6);
    rX = -0.24 - k * 1.95 + tremor; rZ = -0.16 - k * 0.58;
    lX = -0.24 - k * 1.95 - tremor; lZ = 0.16 + k * 0.58;
    rEl = -0.30 - k * 0.12; lEl = -0.24 - k * 0.18;
    headX = -k * 0.38 - tremor * 0.4; headY = Math.sin(W.t * 1.1) * 0.04;
    hover += k * 0.55;
  } else if (W.state === 'stagger') {
    rootZ = 0.18; headX = 0.35;
    rX = -0.5; lX = -0.5; rZ = 0.1; lZ = -0.1;
    rEl = -0.6; lEl = -0.6;
  } else if (W.state === 'dead') {
    hover = Math.max(0.01, 0.035 - W.deadT * 0.01);
    rootZ = Math.min(1.15, W.deadT * 0.9);
    headX = Math.min(0.6, W.deadT * 0.5);
    rX = -0.2; lX = -0.2;
  }
  p.root.position.y = hover;
  p.root.rotation.z = rootZ;
  p.head.rotation.x = headX; p.head.rotation.y = headY;
  p.armR.rotation.set(rX, 0, rZ);
  p.armL.rotation.set(lX, 0, lZ);
  if (p.elbowR) p.elbowR.rotation.x = rEl;
  if (p.elbowL) p.elbowL.rotation.x = lEl;
  // slow breathing in the shoulders and a rare blink
  const breath = Math.sin(time * 1.35);
  if (p.shoulders) p.shoulders.scale.y = 0.52 + breath * 0.006;
  const blink = Math.pow(Math.max(0, Math.sin(time * 0.63 + 2.4)), 50);
  for (const eye of p.eyes) eye.scale.y = 1 - blink * 0.92;
  for (const h of p.hairStrands) {
    const u = h.userData;
    h.rotation.z = Math.sin(time * 1.15 + u.phase) * 0.025 + restK * 0.02;
    h.rotation.x = Math.sin(time * 0.85 + u.phase * 1.3) * 0.02;
  }
  p.orbs.rotation.y += dt * 0.9;
  p.orbs.rotation.x = Math.sin(time * 0.55) * 0.12;
  p.crown.rotation.y += dt * 0.35;
  p.staffCrystal.rotation.y += dt * 2.2;
  const dim = 1 - restK * 0.62;
  const pulse = (2.8 + Math.sin(time * 3.4) * 0.8 + (W.phase2 ? 1.2 : 0) + (W.lunarPhase ? 1.5 : 0)) * dim;
  p.staffCrystal.material.emissiveIntensity = pulse;
  p.staffGlow.material.opacity = (0.42 + Math.sin(time * 2.8) * 0.12 + (W.phase2 ? 0.1 : 0) + (W.lunarPhase ? 0.12 : 0)) * dim;
  p.staffLight.intensity = (8 + Math.sin(time * 3.4) * 2.5 + (W.phase2 ? 3 : 0) + (W.lunarPhase ? 4 : 0)) * dim;
  p.aura.material.opacity = (0.22 + Math.sin(time * 1.7) * 0.06 + (W.phase2 ? 0.08 : 0) + (W.lunarPhase ? 0.06 : 0)) * (1 - restK * 0.35);
  const lunarOn = W.lunarPhase && W.state !== 'dead';
  witchLunarAura.group.visible = lunarOn;
  if (lunarOn) {
    witchLunarAura.t += dt;
    const lt = witchLunarAura.t;
    witchLunarAura.glowMat.opacity = 0.2 + Math.sin(lt * 2.4) * 0.07 + (W.state === 'lunar' ? 0.14 : 0);
    witchLunarAura.ringMat.opacity = 0.3 + Math.sin(lt * 3.1) * 0.12;
    witchLunarAura.ring.rotation.z += dt * 1.25;
    witchLunarAura.ring.scale.setScalar(1 + Math.sin(lt * 2.1) * 0.08);
    witchLunarAura.light.intensity = 7 + Math.sin(lt * 3.3) * 2.5;
  }
  p.robe.scale.x = 1 + Math.sin(time * 1.3) * 0.012;
  p.robe.scale.z = 1 + Math.cos(time * 1.15) * 0.012;
  witchK.group.position.copy(W.pos);
  witchK.group.position.y = W.pos.y || 0;
  witchK.group.rotation.y = W.yaw;
}


// ============ DRAGON AI & HAZARDS ============
const DRAGON_CAST = {
  bite:  { wind: 0.95, recover: 1.05 },
  tail:  { wind: 1.1, recover: 1.2 },
  breath:{ wind: 1.35, recover: 1.45 },
  dive:  { wind: 1.45, recover: 1.35 },
  wing:  { wind: 1.05, recover: 1.2 },
  backdraft: { wind: 1.3, recover: 1.35 },
};
const DRAGON_BACKDRAFT_ARC = Math.PI * 1.4;
function ensureDragonBreathWarn() {
  if (dragonBreathWarn) return dragonBreathWarn;
  const geo = new THREE.RingGeometry(2.2, 25.0, 36, 1, -Math.PI / 2 - 0.475, 0.95);
  dragonBreathWarnMat = new THREE.MeshBasicMaterial({
    color: 0xffb052, transparent: true, opacity: 0.22, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  dragonBreathWarn = new THREE.Mesh(geo, dragonBreathWarnMat);
  dragonBreathWarn.rotation.x = -Math.PI / 2;
  dragonBreathWarn.position.y = 0.09;
  dragonBreathWarn.visible = false;
  scene.add(dragonBreathWarn);
  return dragonBreathWarn;
}
function hideDragonBreathWarn() {
  if (dragonBreathWarn) dragonBreathWarn.visible = false;
}
function ensureDragonDiveWarn() {
  if (dragonDiveWarn) return dragonDiveWarn;
  dragonDiveWarnMat = new THREE.MeshBasicMaterial({
    color: 0xffc861, transparent: true, opacity: 0.36, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const grp = new THREE.Group();
  const edge = new THREE.Mesh(new THREE.RingGeometry(5.2, 5.8, 52), dragonDiveWarnMat);
  const core = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.1, 32), dragonDiveWarnMat);
  edge.rotation.x = -Math.PI / 2;
  core.rotation.x = -Math.PI / 2;
  grp.add(edge, core);
  grp.position.y = 0.07;
  grp.visible = false;
  scene.add(grp);
  dragonDiveWarn = grp;
  return grp;
}
function hideDragonDiveWarn() {
  if (dragonDiveWarn) dragonDiveWarn.visible = false;
}
function ensureDragonBackdraftWarn() {
  if (dragonBackdraftWarn) return dragonBackdraftWarn;
  dragonBackdraftWarnMat = new THREE.MeshBasicMaterial({
    color: 0xff8a3a, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const grp = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 5.4, 52, 1, -Math.PI / 2 - DRAGON_BACKDRAFT_ARC / 2, DRAGON_BACKDRAFT_ARC),
    dragonBackdraftWarnMat
  );
  const inner = new THREE.Mesh(
    new THREE.RingGeometry(3.0, 3.7, 44, 1, -Math.PI / 2 - DRAGON_BACKDRAFT_ARC / 2, DRAGON_BACKDRAFT_ARC),
    dragonBackdraftWarnMat
  );
  grp.add(outer, inner);
  grp.rotation.x = -Math.PI / 2;
  grp.position.y = 0.08;
  grp.visible = false;
  scene.add(grp);
  dragonBackdraftWarn = grp;
  return grp;
}
function hideDragonBackdraftWarn() {
  if (dragonBackdraftWarn) dragonBackdraftWarn.visible = false;
}

const DRAGON_BREATH_REACH = 24;
function ensureDragonBreathFX() {
  if (dragonBreathFX) return dragonBreathFX;
  const beam = [], particles = [];
  for (let i = 0; i < 38; i++) {
    const core = i % 4 === 0;
    const mat = new THREE.SpriteMaterial({
      map: flameTex, color: core ? 0xffe0a0 : 0xff5a18, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
    });
    const spr = new THREE.Sprite(mat);
    spr.visible = false;
    scene.add(spr);
    beam.push({ spr, mat, u: i / 37, core, phase: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 2.4 });
  }
  for (let i = 0; i < 64; i++) {
    const core = i % 3 === 0;
    const mat = new THREE.SpriteMaterial({
      map: flameTex, color: core ? 0xffd27a : 0xff5a18, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
    });
    const spr = new THREE.Sprite(mat);
    spr.visible = false;
    scene.add(spr);
    particles.push({ spr, mat, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, base: 1, spin: 0 });
  }
  const light = new THREE.PointLight(0xff6a1e, 0, 32, 1.7);
  scene.add(light);
  dragonBreathFX = {
    beam, particles, light, active: false, t: 0, dur: 0, tickT: 0, soundT: 0, emitAcc: 0, idx: 0,
    origin: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1),
  };
  return dragonBreathFX;
}
function dragonBreathActive() {
  return !!(dragonBreathFX && dragonBreathFX.active);
}
function startDragonBreath() {
  const fx = ensureDragonBreathFX();
  fx.active = true;
  fx.t = 0; fx.dur = 1.25; fx.tickT = 0.16; fx.soundT = 0; fx.emitAcc = 0;
  const dx = P.pos.x - V.pos.x, dz = P.pos.z - V.pos.z;
  if (dx * dx + dz * dz > 0.0001) V.yaw = Math.atan2(dx, dz);
  fx.dir.set(Math.sin(V.yaw), -0.06, Math.cos(V.yaw)).normalize();
  sfx.fireBreath();
}
function stopDragonBreath() {
  const fx = dragonBreathFX;
  if (!fx) return;
  fx.active = false;
  fx.light.intensity = 0;
  for (const b of fx.beam) { b.spr.visible = false; b.mat.opacity = 0; }
  for (const p of fx.particles) { p.life = 0; p.spr.visible = false; p.mat.opacity = 0; }
}
function updateDragonBreathFX(dt) {
  const fx = dragonBreathFX;
  if (!fx || !fx.active) return;
  fx.t += dt;
  const head = dragonK.parts.head;
  head.updateWorldMatrix(true, false);
  _dragonMouthPos.set(0, -0.34, 1.82);
  head.localToWorld(_dragonMouthPos);
  fx.origin.copy(_dragonMouthPos);
  fx.dir.set(Math.sin(V.yaw), -0.06, Math.cos(V.yaw)).normalize();
  const px = Math.cos(V.yaw), pz = -Math.sin(V.yaw);
  const flick = 0.86 + Math.sin(fx.t * 41) * 0.08 + Math.sin(fx.t * 23 + 1.7) * 0.06;
  const fadeOut = fx.t > fx.dur - 0.25 ? Math.max(0, (fx.dur - fx.t) / 0.25) : 1;
  for (const b of fx.beam) {
    const dist = 0.7 + b.u * DRAGON_BREATH_REACH;
    const wob = Math.sin(fx.t * 13 + b.phase) * (0.16 + dist * 0.024);
    const wobY = Math.cos(fx.t * 9 + b.phase * 1.7) * (0.1 + dist * 0.018);
    b.spr.visible = true;
    b.spr.position.set(
      fx.origin.x + fx.dir.x * dist + px * wob,
      fx.origin.y + fx.dir.y * dist + wobY * 1.6,
      fx.origin.z + fx.dir.z * dist + pz * wob
    );
    const size = (0.55 + b.u * 2.9) * (b.core ? 0.62 : 1);
    b.spr.scale.set(size * 1.15, size * 1.5, 1);
    b.mat.opacity = (b.core ? 0.62 : 0.42) * flick * (1 - b.u * 0.55) * fadeOut;
    b.mat.rotation += b.spin * dt * 2.2;
  }
  fx.emitAcc += dt * 110;
  const emit = Math.min(12, Math.floor(fx.emitAcc));
  fx.emitAcc -= emit;
  for (let i = 0; i < emit; i++) {
    const p = fx.particles[fx.idx++ % fx.particles.length];
    const a = V.yaw + (Math.random() - 0.5) * 0.19;
    const spd = 15 + Math.random() * 11;
    p.vx = Math.sin(a) * spd;
    p.vz = Math.cos(a) * spd;
    p.vy = (Math.random() - 0.5) * 1.8 + 0.35;
    p.spr.position.set(
      fx.origin.x + (Math.random() - 0.5) * 0.35,
      fx.origin.y + (Math.random() - 0.5) * 0.35,
      fx.origin.z + (Math.random() - 0.5) * 0.35
    );
    p.base = 0.5 + Math.random() * 0.5;
    p.life = p.maxLife = 0.42 + Math.random() * 0.32;
    p.spin = (Math.random() - 0.5) * 3;
    p.spr.material.rotation = Math.random() * Math.PI * 2;
    p.spr.visible = true;
  }
  for (const p of fx.particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.spr.visible = false; p.mat.opacity = 0; continue; }
    p.spr.position.x += p.vx * dt;
    p.spr.position.y += p.vy * dt;
    p.spr.position.z += p.vz * dt;
    p.vy += 1.1 * dt;
    p.vx *= (1 - 1.6 * dt); p.vz *= (1 - 1.6 * dt);
    const k = p.life / p.maxLife;
    const size = p.base * (1 + (1 - k) * 2.4);
    p.spr.scale.set(size, size * 1.45, 1);
    p.mat.opacity = Math.min(1, k * 1.7) * 0.8;
    p.mat.rotation += p.spin * dt;
  }
  fx.light.position.set(fx.origin.x + fx.dir.x * 4, fx.origin.y + fx.dir.y * 4 + 0.2, fx.origin.z + fx.dir.z * 4);
  fx.light.intensity = 18 * flick * fadeOut;
  fx.soundT -= dt;
  if (fx.soundT <= 0 && fx.t < fx.dur - 0.3) { sfx.fireBreath(); fx.soundT = 0.38; }
  fx.tickT -= dt;
  if (fx.tickT <= 0 && G.mode === 'play' && !G.paused && P.state !== 'dead') {
    const rx = P.pos.x - fx.origin.x, rz = P.pos.z - fx.origin.z;
    const along = rx * fx.dir.x + rz * fx.dir.z;
    if (along > 1.1 && along < DRAGON_BREATH_REACH + 1.5) {
      const lateral = Math.abs(rx * fx.dir.z - rz * fx.dir.x);
      if (lateral < 0.7 + along * 0.075 + 0.35) {
        damagePlayer(Math.round(TUNE.dragonDmg.breath * (1 + G.ng * 0.18) * 0.55), fx.origin, 'breath');
        fx.tickT = 0.42;
      }
    }
  }
  if (fx.t >= fx.dur) stopDragonBreath();
}
function beginDragon() {
  if (G.bossId !== 'dragon' || G.mode !== 'play' || G.bossActive || G.bossDead) return;
  ARENA = ARENAS.dragon;
  V.maxHP = TUNE.dragonHP + G.ng * 187;
  V.hp = V.maxHP;
  V.pos.set(DRAGON_CENTER.x, 0, DRAGON_CENTER.z - 5);
  V.yaw = Math.atan2(P.pos.x - V.pos.x, P.pos.z - V.pos.z);
  V.state = 'intro'; V.t = 0; V.decideCd = 0.8; V.attackKind = ''; V.hasHit = false;
  V.phase2 = false; V.staggerAcc = 0; V.deadT = 0; V.breathCd = 0; V.stormCd = 0; V.lastAttack = '';
  dragonK.group.position.copy(V.pos); dragonK.group.rotation.y = V.yaw;
  dragonK.group.scale.setScalar(DRAGON_BASE_SCALE);
  dragonK.group.visible = true; dragonShadow.visible = true;
  hideDragonBreathWarn(); hideDragonDiveWarn(); hideDragonBackdraftWarn();
  G.bossActive = true; G.bossDead = false; G.fightTime = 0;
  bossPlate.classList.remove('hidden'); setBossName('dragon'); startBossMusic(); setLock(true);
  sfx.roar(); G.shake = Math.max(G.shake, 0.8);
  spawnRing(V.pos, 0xff5a1e, 14);
  spawnRing(V.pos, 0xffc861, 8);
  spawnSparks(new THREE.Vector3(V.pos.x, 2.0, V.pos.z), 52, 0xff7a24, 8);
  showCenter('VYTLES, THE DRAGON', 'the caldera answers his name');
}
function touchDragonStone() {
  if (!G.inArena || G.bossActive || G.bossDead || P.state === 'dead') return;
  P.state = 'idle'; P.t = 0;
  const stonePos = new THREE.Vector3(DRAGON_CENTER.x, 2.2, DRAGON_CENTER.z - 9);
  spawnRing(new THREE.Vector3(DRAGON_CENTER.x, 0, DRAGON_CENTER.z - 9), 0xff6a2a, 6);
  spawnSparks(new THREE.Vector3(DRAGON_CENTER.x, 1.6, DRAGON_CENTER.z - 9), 24, 0xff9a3a, 6);
  sfx.pillar();
  beginDragon();
}
function dragonDecide() {
  hideDragonBreathWarn(); hideDragonDiveWarn(); hideDragonBackdraftWarn();
  const d = dist2D(V.pos, P.pos);
  const opts = [];
  if (d < 7.2) opts.push('bite', 'bite', 'tail', 'wing');
  else if (d < 14.5) opts.push('breath', 'dive', 'backdraft', 'breath');
  else opts.push('backdraft', 'dive', 'breath');
  if (V.phase2) opts.push('breath', 'dive', 'backdraft');
  let kind = opts[Math.floor(Math.random() * opts.length)];
  if (kind === V.lastAttack && opts.length > 2) {
    const alt = opts.filter(o => o !== kind);
    kind = alt[Math.floor(Math.random() * alt.length)];
  }
  V.lastAttack = kind;
  V.attackKind = kind; V.state = 'windup'; V.t = 0; V.hasHit = false;
  const say = {
    bite: 'JAWS LIKE A CAVE-IN',
    tail: 'THE TAIL SWEEPS — ROLL CLEAR',
    breath: 'CALDERA-FIRE BUILDS — LEAVE THE CONE',
    dive: 'HE TAKES WING — LEAVE THE MARK',
    wing: 'THE WINGS GATHER — BACK AWAY',
    backdraft: 'FIRE BEHIND YOU — RUN',
  }[kind];
  if (say) showSub(say);
  if (kind === 'breath') {
    ensureDragonBreathWarn();
    dragonBreathWarn.position.set(V.pos.x, 0.09, V.pos.z);
    dragonBreathWarn.rotation.z = V.yaw;
    dragonBreathWarn.visible = true;
    dragonBreathWarnMat.opacity = 0.22;
    sfx.cast();
  } else if (kind === 'dive') {
    dragonDiveMark.copy(P.pos);
    ensureDragonDiveWarn();
    dragonDiveWarn.position.set(dragonDiveMark.x, 0.07, dragonDiveMark.z);
    dragonDiveWarn.visible = true;
    dragonDiveWarnMat.opacity = 0.36;
    sfx.cast();
  } else if (kind === 'wing') {
    sfx.cast();
  } else if (kind === 'backdraft') {
    const backYaw = Math.atan2(P.pos.x - V.pos.x, P.pos.z - V.pos.z);
    dragonBackdraftMark.copy(P.pos);
    dragonBackdraftYaw = backYaw;
    ensureDragonBackdraftWarn();
    dragonBackdraftWarn.position.set(P.pos.x, 0.08, P.pos.z);
    dragonBackdraftWarn.rotation.z = backYaw;
    dragonBackdraftWarn.visible = true;
    dragonBackdraftWarnMat.opacity = 0.3;
    sfx.cast();
  }
}
function dragonStrike(kind) {
  const d = dist2D(V.pos, P.pos);
  const mult = 1 + G.ng * 0.18;
  if (kind === 'bite') {
    if (d < 7.4 && inArc(V.pos, V.yaw, P.pos, 7.8, 1.2)) damagePlayer(Math.round(TUNE.dragonDmg.bite * mult), V.pos, 'bite');
    spawnSparks(new THREE.Vector3(V.pos.x + Math.sin(V.yaw) * 3.8, 2.2, V.pos.z + Math.cos(V.yaw) * 3.8), 26, 0xffd27a, 7);
    sfx.slam();
  } else if (kind === 'tail') {
    if (d < 6.2) damagePlayer(Math.round(TUNE.dragonDmg.tail * mult), V.pos, 'tail');
    spawnRing(V.pos, 0xff6a2a, 10.5);
    spawnSparks(new THREE.Vector3(V.pos.x, 1.0, V.pos.z), 36, 0xff8a3a, 9);
    G.shake = Math.max(G.shake, 0.5); sfx.slam();
  } else if (kind === 'breath') {
    hideDragonBreathWarn();
    startDragonBreath();
    spawnSparks(new THREE.Vector3(V.pos.x + Math.sin(V.yaw) * 3.0, 2.6, V.pos.z + Math.cos(V.yaw) * 3.0), 48, 0xff6a24, 10);
    sfx.roar(); G.shake = Math.max(G.shake, 0.55);
  } else if (kind === 'dive') {
    hideDragonDiveWarn();
    const impactX = dragonDiveMark.x, impactZ = dragonDiveMark.z;
    V.pos.set(impactX, 0, impactZ); clampToActiveArena(V.pos, 2.2);
    spawnRing(V.pos, 0xff6a2a, 14);
    spawnRing(V.pos, 0xffc861, 22);
    spawnSparks(new THREE.Vector3(V.pos.x, 1.2, V.pos.z), 60, 0xff7a24, 9);
    sfx.slam(); sfx.roar(); G.shake = Math.max(G.shake, 0.8);
    if (Math.hypot(P.pos.x - impactX, P.pos.z - impactZ) < 5.8) {
      damagePlayer(Math.round(TUNE.dragonDmg.dive * mult), V.pos, 'dive');
    }
  } else if (kind === 'wing') {
    spawnRing(V.pos, 0xffc861, 11);
    spawnRing(V.pos, 0xff5a1e, 7);
    spawnSparks(new THREE.Vector3(V.pos.x, 1.8, V.pos.z), 44, 0xff9a3a, 9);
    sfx.slam(); G.shake = Math.max(G.shake, 0.65);
    if (d < 7.0) damagePlayer(Math.round(TUNE.dragonDmg.wing * mult), V.pos, 'wing');
  } else if (kind === 'backdraft') {
    hideDragonBackdraftWarn();
    const cx = dragonBackdraftMark.x, cz = dragonBackdraftMark.z;
    const base = dragonBackdraftYaw;
    const rings = [
      { r: 5.4, count: 12, delay: 0.3, radius: 1.3 },
      { r: 3.6, count: 9, delay: 0.95, radius: 1.15 },
    ];
    for (const ring of rings) {
      for (let i = 0; i < ring.count; i++) {
        const a = base - DRAGON_BACKDRAFT_ARC / 2 + (i / (ring.count - 1)) * DRAGON_BACKDRAFT_ARC;
        let x = cx + Math.sin(a) * ring.r;
        let z = cz + Math.cos(a) * ring.r;
        const dx = x - DRAGON_CENTER.x, dz = z - DRAGON_CENTER.z;
        const dd = Math.hypot(dx, dz), lim = DRAGON_R - 1.4;
        if (dd > lim) { x = DRAGON_CENTER.x + dx / dd * lim; z = DRAGON_CENTER.z + dz / dd * lim; }
        spawnFirePillar(x, z, ring.delay + i * 0.02, ring.radius, Math.round(TUNE.dragonDmg.backdraft * mult), 1, false);
      }
    }
    spawnSparks(new THREE.Vector3(cx, 1.0, cz), 40, 0xff7a24, 8);
    sfx.roar(); G.shake = Math.max(G.shake, 0.75);
  }
}
function spawnDragonStorm() {
  dragonDiveMark.copy(P.pos);
  dragonStrike('dive');
}
function spawnDragonBreath() {
  dragonStrike('breath');
}
function updateDragon(dt) {
  V.t += dt;
  V.animT += dt;
  if (G.bossActive && P.state !== 'dead') G.fightTime += dt;
  G.hazardsDirty = true;
  if (dragonBreathWarn && dragonBreathWarn.visible) {
    dragonBreathWarnMat.opacity = 0.2 + Math.abs(Math.sin(V.t * 8)) * 0.2;
  }
  if (dragonDiveWarn && dragonDiveWarn.visible) {
    dragonDiveWarnMat.opacity = 0.28 + Math.abs(Math.sin(V.t * 9)) * 0.24;
    dragonDiveWarn.scale.setScalar(1 + Math.sin(V.t * 9) * 0.025);
  }
  if (dragonBackdraftWarn && dragonBackdraftWarn.visible) {
    dragonBackdraftWarnMat.opacity = 0.24 + Math.abs(Math.sin(V.t * 7)) * 0.18;
  }
  const d = dist2D(V.pos, P.pos);
  const toP = Math.atan2(P.pos.x - V.pos.x, P.pos.z - V.pos.z);
  switch (V.state) {
    case 'dormant':
      break;
    case 'intro':
      V.yaw += angDiff(toP, V.yaw) * Math.min(1, 2.4 * dt);
      if (V.t > 1.7) { V.state = 'idle'; V.decideCd = 0.6; G.fightTime = 0; }
      break;
    case 'rage':
      V.yaw += angDiff(toP, V.yaw) * Math.min(1, 2.2 * dt);
      if (V.t > 1.25) { V.state = 'idle'; V.decideCd = 0.35; }
      break;
    case 'idle': {
      V.yaw += angDiff(toP, V.yaw) * Math.min(1, (V.phase2 ? 2.6 : 1.9) * dt);
      V.decideCd = Math.max(0, V.decideCd - dt);
      if (P.state !== 'dead') {
        const spd = TUNE.dragonSpeed * (V.phase2 ? 1.18 : 1) * (1 + G.ng * 0.06);
        const away = d < 4.5, toward = d > 13.0;
        if (away || toward) {
          const dir = away ? -1 : 1;
          V.pos.x += Math.sin(V.yaw) * spd * dt * dir;
          V.pos.z += Math.cos(V.yaw) * spd * dt * dir;
          clampToActiveArena(V.pos, 2.8);
        } else {
          V.pos.x += Math.cos(V.yaw) * spd * dt * 0.32;
          V.pos.z -= Math.sin(V.yaw) * spd * dt * 0.32;
          clampToActiveArena(V.pos, 2.8);
        }
        if (Math.random() < dt * 1.4) sfx.bossStep();
      }
      if (V.decideCd <= 0 && P.state !== 'dead') dragonDecide();
      break;
    }
    case 'windup': {
      V.yaw += angDiff(toP, V.yaw) * Math.min(1, 1.1 * dt);
      const cast = DRAGON_CAST[V.attackKind] || DRAGON_CAST.bite;
      if (V.t >= cast.wind) {
        dragonStrike(V.attackKind);
        V.state = 'recover'; V.t = 0; V.hasHit = true;
        hideDragonBreathWarn(); hideDragonDiveWarn(); hideDragonBackdraftWarn(); telegraphEl.classList.add('hidden');
      }
      break;
    }
    case 'recover': {
      const track = V.attackKind === 'breath' && dragonBreathActive() ? 0.8 : 1.4;
      V.yaw += angDiff(toP, V.yaw) * Math.min(1, track * dt);
      const cast = DRAGON_CAST[V.attackKind] || DRAGON_CAST.bite;
      if (V.t >= cast.recover) { V.state = 'idle'; V.t = 0; V.decideCd = (V.phase2 ? 0.4 : 0.6) + Math.random() * 0.5; }
      break;
    }
    case 'stagger':
      if (V.t > 1.2) { V.state = 'idle'; V.t = 0; V.decideCd = 0.4; }
      break;
    case 'dead':
      V.deadT += dt;
      if (V.deadT > 2.4) { dragonK.group.visible = false; dragonShadow.visible = false; }
      break;
  }
  dragonK.group.position.copy(V.pos);
  dragonK.group.rotation.y = V.yaw;
}
function poseDragon(dt) {
  const p = dragonK.parts;
  const time = V.animT;
  const st = V.state;
  const phase = V.phase2 ? 1 : 0;
  let bob = Math.sin(time * 2.2) * 0.045;
  let headPitch = 0.04 + Math.sin(time * 1.3) * 0.03;
  let neckPitch = Math.sin(time * 1.1) * 0.025;
  let jawOpen = 0.16 + Math.max(0, Math.sin(time * 0.7)) * 0.03;
  let tailYaw = Math.sin(time * 1.2) * 0.12;
  let wing = 0.78 + Math.sin(time * 2.0) * 0.1 + phase * 0.08;
  let mouth = 0;
  let legLift = 0;
  let rootTilt = 0;
  if (st === 'intro') {
    headPitch = -0.28; neckPitch = -0.12; jawOpen = 0.62 + Math.sin(time * 7) * 0.08;
    wing = 0.95 + Math.sin(time * 5) * 0.18; mouth = 0.45;
  } else if (st === 'rage') {
    headPitch = -0.34; neckPitch = -0.16; jawOpen = 0.7; wing = 1.0 + Math.sin(time * 9) * 0.26; mouth = 0.55;
  } else if (st === 'windup') {
    const k = Math.min(1, V.t / ((DRAGON_CAST[V.attackKind] || DRAGON_CAST.bite).wind));
    if (V.attackKind === 'breath') {
      headPitch = -0.16 + k * 0.2; neckPitch = 0.05 * k; jawOpen = 0.2 + k * 0.66; mouth = 0.25 + k * 0.75;
      wing = 0.1 + k * 0.16; bob += k * 0.05;
    } else if (V.attackKind === 'bite') {
      headPitch = -0.18 - k * 0.22; jawOpen = 0.25 + k * 0.55; mouth = 0.1 + k * 0.35;
    } else if (V.attackKind === 'tail') {
      tailYaw = -0.9 * k; rootTilt = -0.04 * k;
    } else if (V.attackKind === 'dive') {
      wing = 0.9 + Math.sin(time * 8) * 0.22; headPitch = -0.34; jawOpen = 0.55; mouth = 0.4;
      bob += k * 0.5; legLift = k * 0.5;
    } else if (V.attackKind === 'wing') {
      wing = 0.35 + k * 0.8; headPitch = -0.2; jawOpen = 0.42; mouth = 0.25;
      bob += k * 0.12;
    } else if (V.attackKind === 'backdraft') {
      headPitch = -0.5 * k; neckPitch = -0.2 * k; jawOpen = 0.3 + k * 0.5; mouth = 0.35 + k * 0.4;
      wing = 1.0 + Math.sin(time * 8) * 0.2; bob += k * 0.2; rootTilt = 0.03 * k;
    }
  } else if (st === 'recover') {
    const k = Math.min(1, V.t / ((DRAGON_CAST[V.attackKind] || DRAGON_CAST.bite).recover));
    if (V.attackKind === 'breath') {
      if (dragonBreathActive()) { mouth = 1; headPitch = 0.05 + Math.sin(time * 30) * 0.012; jawOpen = 0.86; }
      else { mouth = 1 - k; headPitch = 0.34 * (1 - k); jawOpen = 0.4 * (1 - k); }
    }
    else if (V.attackKind === 'dive') { headPitch = 0.42 * (1 - k); wing = 0.25 + 0.55 * (1 - k); legLift = 0.35 * (1 - k); }
    else if (V.attackKind === 'tail') { tailYaw = 0.6 * (1 - k); }
    else if (V.attackKind === 'wing') { wing = 1.15 * (1 - k); }
    else if (V.attackKind === 'backdraft') { mouth = 1 - k; headPitch = -0.15 * (1 - k); wing = 0.45 + 0.4 * (1 - k); }
  } else if (st === 'stagger') {
    headPitch = 0.5; neckPitch = 0.15; jawOpen = 0.25;
    wing = -0.08; bob -= 0.18; rootTilt = 0.06;
  } else if (st === 'dead') {
    rootTilt = Math.min(1, V.deadT / 1.4) * 0.55;
    bob = -Math.min(1, V.deadT / 1.4) * 0.55;
    wing = -0.25; headPitch = 0.55; jawOpen = 0.3; mouth = 0;
  }
  const flap = wing;
  p.wingR.rotation.z = flap;
  p.wingL.rotation.z = -flap;
  p.wingR.rotation.y = 0.38 + Math.sin(time * 0.7) * 0.04;
  p.wingL.rotation.y = -0.38 - Math.sin(time * 0.7) * 0.04;
  p.tail.rotation.y = tailYaw;
  p.tail.rotation.x = Math.sin(time * 0.9) * 0.04;
  p.neck.rotation.x = neckPitch;
  p.head.rotation.x = headPitch;
  p.head.rotation.y = Math.sin(time * 0.8) * 0.035;
  p.jaw.rotation.x = jawOpen;
  p.root.position.y = bob;
  p.root.rotation.z += (rootTilt - p.root.rotation.z) * Math.min(1, 6 * dt);
  p.chest.scale.y = 1.1 + Math.sin(time * 2.4) * 0.015;
  p.legFL.rotation.x = Math.sin(time * 2.1) * 0.04 - legLift;
  p.legFR.rotation.x = Math.sin(time * 2.1 + 1.4) * 0.04 - legLift;
  p.legBL.rotation.x = -Math.sin(time * 2.1) * 0.035;
  p.legBR.rotation.x = -Math.sin(time * 2.1 + 1.4) * 0.035;
  p.mouthGlow.material.opacity += (mouth - p.mouthGlow.material.opacity) * Math.min(1, 9 * dt);
  p.mouthGlow.scale.setScalar(1.7 + mouth * 0.9 + Math.sin(time * 18) * 0.08 * mouth);
  p.aura.material.opacity = 0.14 + Math.sin(time * 1.8) * 0.04 + phase * 0.07;
  p.aura.scale.set(9 + phase * 1.2, 7 + phase * 0.8, 1);
  p.scaleMat.emissiveIntensity = 0.62 + Math.sin(time * 2.2) * 0.1 + phase * 0.3;
  p.keyLight.intensity = 15 + Math.sin(time * 7.3) * 2.5 + phase * 5;
  p.fillLight.intensity = 6 + Math.sin(time * 5.1 + 1) * 1.2 + phase * 2.5;
  p.membraneMat.emissiveIntensity = 0.5 + Math.sin(time * 1.7) * 0.1 + phase * 0.2;
  for (const eye of p.eyes) eye.scale.setScalar(1 + Math.sin(time * 4.5) * 0.08 * (phase + 0.5));
  for (const glow of p.eyeGlows) glow.material.opacity = 0.5 + Math.sin(time * 4.5 + 1) * 0.16 + phase * 0.18;
  dragonK.group.position.copy(V.pos);
  dragonK.group.rotation.y = V.yaw;
  dragonShadow.position.set(V.pos.x, 0.03, V.pos.z);
  dragonShadow.visible = dragonK.group.visible && V.state !== 'dead';
  dragonShadow.scale.setScalar(DRAGON_BASE_SCALE * (1 + Math.sin(time * 1.6) * 0.03));
}
function damageDragon(dmg, poiseDmg = 30) {
  if (!G.bossActive || V.state === 'dead' || V.state === 'rage' || G.mode !== 'play') return;
  dmg *= P.mods.dmg;
  V.hp = Math.max(0, V.hp - dmg);
  V.staggerAcc += poiseDmg;
  const hitPos = new THREE.Vector3(V.pos.x + (Math.random() - 0.5) * 2.0, 2.0 + Math.random() * 1.8, V.pos.z + (Math.random() - 0.5) * 2.0);
  spawnSparks(hitPos, 12, 0xffb052, 5);
  sfx.hitFlesh();
  G.hitstop = 0.035; G.shake = Math.min(0.5, G.shake + 0.16);
  if (!V.phase2 && V.hp < V.maxHP * 0.5) {
    V.phase2 = true; V.state = 'rage'; V.t = 0; V.staggerAcc = 0;
    hideDragonBreathWarn(); hideDragonDiveWarn(); hideDragonBackdraftWarn(); telegraphEl.classList.add('hidden');
    sfx.roar(); G.shake = Math.max(G.shake, 0.9); G.hitstop = 0.1;
    spawnRing(V.pos, 0xff5a1e, 12);
    spawnRing(V.pos, 0xffc861, 20);
    spawnSparks(new THREE.Vector3(V.pos.x, 2.6, V.pos.z), 60, 0xff7a24, 9);
    showCenter('THE CALDERA AWAKENS', 'Vytles sheds the last of his patience');
  } else if (V.staggerAcc >= 160 && V.state !== 'stagger' && V.hp > 0) {
    V.staggerAcc = 0; V.state = 'stagger'; V.t = 0;
    hideDragonBreathWarn(); hideDragonDiveWarn(); hideDragonBackdraftWarn(); telegraphEl.classList.add('hidden');
    showSub('VYTLES STAGGERS — STRIKE NOW');
    sfx.stagger(); G.hitstop = 0.12;
  }
  if (V.hp <= 0) dragonDie();
}
function dragonDie() {
  V.state = 'dead'; V.t = 0; V.deadT = 0;
  G.bossDead = true; G.bossActive = false; G.defeated.dragon = true;
  stopBossMusic();
  setLock(false);
  clearBossHazards();
  stopDragonBreath();
  hideDragonBreathWarn(); hideDragonDiveWarn(); hideDragonBackdraftWarn(); hideFangMarkWarn();
  telegraphEl.classList.add('hidden');
  sfx.death(); sfx.victory();
  spawnSparks(new THREE.Vector3(V.pos.x, 2.4, V.pos.z), 70, 0xff8a3a, 10);
  spawnRing(V.pos, 0xff6a2a, 12);
  spawnRing(V.pos, 0xffc861, 20);
  G.drops = bossDropsFor('dragon');
  setTimeout(showDropScreen, 1600);
}

// ============ KORVATH, THE ECLIPSE FANG ============
const FANG_ATK = {
  rend: { wind: 0.62, swing: 0.30, recover: 1.05 },
  skyrend: { wind: 1.05, swing: 0.30, recover: 2.35 },
  spin: { wind: 0.92, swing: 0.46, recover: 1.20 },
  plunge: { wind: 1.10, swing: 0.30, recover: 1.35 },
  duskwave: { wind: 0.98, swing: 0.42, recover: 1.20 },
  duskfire: { wind: 1.06, swing: 0.44, recover: 1.25 },
  afterimage: { wind: 0.58, swing: 0.30, recover: 1.90 },
};
function spawnFangEcho(x, z, delay, dmg, radius = 3.2) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff2a5e, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const grp = new THREE.Group(); grp.position.set(x, 0.08, z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.72, radius, 48), mat);
  ring.rotation.x = -Math.PI / 2; grp.add(ring);
  const core = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.6, 32), mat);
  core.rotation.x = -Math.PI / 2; core.position.y = 0.002; grp.add(core);
  scene.add(grp);
  fangEchoes.push({ x, z, t: 0, delay, dmg, radius, grp, mat, done: false });
}
function updateFangEchoes(dt) {
  for (let i = fangEchoes.length - 1; i >= 0; i--) {
    const e = fangEchoes[i];
    e.t += dt;
    e.mat.opacity = 0.24 + Math.abs(Math.sin(e.t * 10)) * 0.22;
    if (!e.done && e.t >= e.delay) {
      e.done = true;
      F.pos.set(e.x, 0, e.z); clampToActiveArena(F.pos, 2.4);
      F.yaw = Math.atan2(P.pos.x - F.pos.x, P.pos.z - F.pos.z);
      spawnRing(new THREE.Vector3(e.x, 0, e.z), 0xff2a5e, e.radius * 2.4);
      spawnSparks(new THREE.Vector3(e.x, 1.0, e.z), 20, 0xff4d6d, 7);
      sfx.slash(); G.shake = Math.max(G.shake, 0.28);
      if (Math.hypot(P.pos.x - e.x, P.pos.z - e.z) < e.radius) {
        damagePlayer(Math.round(e.dmg * (1 + G.ng * 0.18)), new THREE.Vector3(e.x, 0, e.z), 'afterimage');
        if (!fangEchoes.includes(e)) break;
      }
      e.mat.opacity = 0.85;
    }
    if (e.done) e.mat.opacity = Math.max(0, e.mat.opacity - dt * 4.2);
    if (e.t > e.delay + 0.34) {
      scene.remove(e.grp); e.mat.dispose();
      fangEchoes.splice(i, 1);
    }
  }
}
let fangSlashTex = null;
function getFangSlashTex() {
  if (fangSlashTex) return fangSlashTex;
  fangSlashTex = canvasTex(256, (x, s) => {
    x.clearRect(0, 0, s, s);
    x.translate(s / 2, s / 2);
    x.rotate(-0.62);
    x.lineCap = 'round';
    const arcs = [[34, 'rgba(255,42,94,0.20)'], [18, 'rgba(255,80,120,0.78)'], [6, 'rgba(255,235,245,1)']];
    for (const [w, col] of arcs) {
      x.strokeStyle = col; x.lineWidth = w;
      x.beginPath(); x.arc(0, 0, 83, -0.86, 0.86); x.stroke();
    }
    x.fillStyle = 'rgba(255,120,160,0.85)';
    for (let i = 0; i < 5; i++) {
      const a = -0.7 + i * 0.35, r = 98 + (i % 2) * 8;
      x.beginPath(); x.arc(Math.cos(a) * r, Math.sin(a) * r, 2.2, 0, Math.PI * 2); x.fill();
    }
  }, 1);
  fangSlashTex.generateMipmaps = false;
  fangSlashTex.minFilter = THREE.LinearFilter;
  return fangSlashTex;
}
function spawnFangSkySlash(delay, travel, dmg, radius, big = false) {
  const color = big ? 0xff5d78 : 0xff2a5e;
  const sprMat = new THREE.SpriteMaterial({ map: getFangSlashTex(), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const spr = new THREE.Sprite(sprMat);
  spr.visible = false;
  scene.add(spr);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const grp = new THREE.Group();
  grp.visible = false;
  scene.add(grp);
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.84, radius, 44), mat);
  ring.rotation.x = -Math.PI / 2; grp.add(ring);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.72, 32), mat);
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.002; grp.add(fill);
  fangSlashes.push({
    t: 0, flight: 0, delay, travel, dmg, radius, big,
    launched: false, impacted: false,
    origin: new THREE.Vector3(), target: new THREE.Vector3(),
    spr, sprMat, grp, mat,
  });
}
function clearFangSlashes() {
  for (let i = fangSlashes.length - 1; i >= 0; i--) {
    const s = fangSlashes[i];
    scene.remove(s.grp); scene.remove(s.spr);
    s.mat.dispose(); s.sprMat.dispose();
  }
  fangSlashes.length = 0;
}
function updateFangSlashes(dt) {
  const mult = 1 + G.ng * 0.18;
  for (let i = fangSlashes.length - 1; i >= 0; i--) {
    const s = fangSlashes[i];
    s.t += dt;
    if (!s.launched) {
      if (s.t < s.delay) continue;
      s.launched = true; s.flight = 0;
      s.target.set(P.pos.x, 0, P.pos.z);
      s.origin.set(F.pos.x, 4.9, F.pos.z);
      s.grp.visible = true; s.grp.position.set(s.target.x, 0.075, s.target.z);
      s.spr.visible = true;
      s.mat.opacity = 0.42;
      sfx.slash();
    }
    if (!s.impacted) {
      s.flight += dt;
      const k = Math.min(1, s.flight / s.travel);
      s.spr.position.set(
        s.origin.x + (s.target.x - s.origin.x) * k,
        s.origin.y * (1 - k) + 0.55 + Math.sin(k * Math.PI) * 0.7,
        s.origin.z + (s.target.z - s.origin.z) * k
      );
      const base = s.big ? 4.4 : 2.6;
      s.spr.scale.set(base * (0.82 + k * 0.42), base * (0.82 + k * 0.42), 1);
      s.sprMat.opacity = Math.min(1, s.flight * 7);
      s.mat.opacity = 0.30 + Math.abs(Math.sin(s.t * 11)) * 0.26;
      if (k >= 1) {
        s.impacted = true;
        s.mat.opacity = 0.92;
        s.sprMat.opacity = 0.95;
        spawnRing(s.target, s.big ? 0xff5d78 : 0xff2a5e, s.big ? s.radius * 3.2 : s.radius * 2.4);
        spawnSparks(new THREE.Vector3(s.target.x, 1.15, s.target.z), s.big ? 42 : 20, 0xff4d6d, s.big ? 10 : 7);
        G.shake = Math.max(G.shake, s.big ? 0.58 : 0.3);
        if (s.big) { sfx.slam(); spawnRing(s.target, 0x8b5cff, s.radius * 4.2); }
        if (Math.hypot(P.pos.x - s.target.x, P.pos.z - s.target.z) < s.radius) {
          damagePlayer(Math.round(s.dmg * mult), s.target, 'skyrend');
          if (!fangSlashes.includes(s)) break;
        }
      }
    } else {
      const fade = dt * (s.big ? 3.6 : 4.8);
      s.mat.opacity = Math.max(0, s.mat.opacity - fade);
      s.sprMat.opacity = Math.max(0, s.sprMat.opacity - fade);
      if (s.flight > s.travel + 0.32) {
        scene.remove(s.grp); scene.remove(s.spr);
        s.mat.dispose(); s.sprMat.dispose();
        fangSlashes.splice(i, 1);
      }
    }
  }
}
function beginFang() {
  if (G.bossId !== 'fang' || G.mode !== 'play' || G.bossActive || G.bossDead) return;
  ARENA = ARENAS.fang;
  F.maxHP = TUNE.fangHP + G.ng * 142;
  F.hp = F.maxHP;
  F.pos.set(FANG_CENTER.x, 0, FANG_CENTER.z - 5);
  F.yaw = Math.atan2(P.pos.x - F.pos.x, P.pos.z - F.pos.z);
  F.state = 'intro'; F.t = 0; F.decideCd = 1.15; F.attackKind = ''; F.hasHit = false;
  F.phase2 = false; F.staggerAcc = 0; F.deadT = 0; F.lastAttack = '';
  fangK.group.position.copy(F.pos); fangK.group.rotation.y = F.yaw;
  fangK.group.scale.setScalar(FANG_BASE_SCALE);
  fangK.group.visible = true; fangShadow.visible = true;
  hideFangMarkWarn(); hideDragonBreathWarn(); hideDragonDiveWarn(); hideDragonBackdraftWarn();
  clearFangEchoes();
  clearFangSlashes();
  G.bossActive = true; G.bossDead = false; G.fightTime = 0;
  bossPlate.classList.remove('hidden'); setBossName('fang'); startBossMusic(); setLock(true);
  bossNameEl.textContent = 'KORVATH  ·  THE ECLIPSE FANG';
  sfx.roar(); G.shake = Math.max(G.shake, 0.7);
  spawnRing(F.pos, 0xff2a5e, 14);
  spawnRing(F.pos, 0x8b5cff, 8);
  spawnSparks(new THREE.Vector3(F.pos.x, 2.0, F.pos.z), 48, 0xff4d6d, 8);
  showCenter('KORVATH, THE ECLIPSE FANG', 'the last light leaves the court');
}
function touchFangStone() {
  if (!G.inArena || G.bossActive || G.bossDead || P.state === 'dead') return;
  P.state = 'idle'; P.t = 0;
  spawnRing(new THREE.Vector3(fangStonePos.x, 0, fangStonePos.z), 0xff2a5e, 6);
  spawnSparks(new THREE.Vector3(fangStonePos.x, 1.6, fangStonePos.z), 24, 0xff4d6d, 6);
  sfx.pillar();
  beginFang();
}
function fangDecide() {
  hideFangMarkWarn();
  const d = dist2D(F.pos, P.pos);
  const opts = [];
  if (d < 4.2) opts.push('rend', 'rend', 'spin', 'skyrend', 'duskwave');
  else if (d < 9.0) opts.push('skyrend', 'rend', 'duskwave', 'plunge');
  else opts.push('skyrend', 'duskfire', 'duskwave', 'plunge');
  if (F.phase2) opts.push('afterimage', 'afterimage', 'duskfire', 'duskwave', 'plunge', 'spin');
  let kind = opts[Math.floor(Math.random() * opts.length)];
  if (kind === F.lastAttack && opts.length > 2) {
    const alt = opts.filter(o => o !== kind);
    kind = alt[Math.floor(Math.random() * alt.length)];
  }
  F.lastAttack = kind;
  F.attackKind = kind; F.state = 'windup'; F.t = 0; F.hasHit = false;
  const say = {
    rend: 'THE BLACK BLADE COMES TWICE — ROLL THROUGH',
    skyrend: 'HE TAKES THE SKY — THREE SLASHES FALL',
    spin: 'THE FANG WHIRLS — LEAVE THE RING',
    plunge: 'HE LEAPS — LEAVE THE MARK',
    duskwave: 'DUSK RUSHES OUTWARD — ROLL IT',
    duskfire: 'ECLIPSE FIRE GATHERS — KEEP MOVING',
    afterimage: 'HIS SHADOW STRIKES FIRST — WATCH THE RINGS',
  }[kind];
  if (say) showSub(say);
  if (kind === 'plunge') {
    F.mark.copy(P.pos);
    ensureFangMarkWarn();
    fangMarkWarn.position.set(F.mark.x, 0.075, F.mark.z);
    fangMarkWarn.visible = true;
    fangMarkWarnMat.opacity = 0.34;
    sfx.cast();
  } else if (kind === 'duskfire') {
    sfx.cast();
  } else if (kind === 'duskwave') {
    sfx.cast();
  }
}
function fangStrike(kind) {
  const d = dist2D(F.pos, P.pos);
  const mult = 1 + G.ng * 0.18;
  const fwd = forwardOf(F.yaw);
  if (kind === 'rend') {
    if (d < 4.6 && inArc(F.pos, F.yaw, P.pos, 4.9, 1.30)) damagePlayer(Math.round(TUNE.fangDmg.rend * mult), F.pos, 'rend');
    spawnRing(F.pos, 0xff2a5e, 5.0);
    spawnSparks(new THREE.Vector3(F.pos.x + fwd.x * 2.2, 1.9, F.pos.z + fwd.z * 2.2), 24, 0xff4d6d, 7);
    fangAfterRend(mult);
    sfx.slash(); sfx.slam();
  } else if (kind === 'skyrend') {
    spawnRing(new THREE.Vector3(F.pos.x, 0, F.pos.z), 0x8b5cff, 7.0);
    spawnSparks(new THREE.Vector3(F.pos.x, 4.6, F.pos.z), 32, 0xff4d6d, 8);
    spawnFangSkySlash(0.02, 0.55, TUNE.fangDmg.skyrend, 2.7, false);
    spawnFangSkySlash(0.38, 0.55, TUNE.fangDmg.skyrend, 2.7, false);
    spawnFangSkySlash(0.90, 0.68, TUNE.fangDmg.skyrendBig, 4.0, true);
    G.shake = Math.max(G.shake, 0.4);
    sfx.dash(); sfx.cast();
  } else if (kind === 'spin') {
    spawnRing(F.pos, 0xff2a5e, 10.5);
    spawnRing(F.pos, 0x8b5cff, 7.2);
    spawnSparks(new THREE.Vector3(F.pos.x, 1.4, F.pos.z), 34, 0xff4d6d, 9);
    if (d < 5.2) damagePlayer(Math.round(TUNE.fangDmg.spin * mult), F.pos, 'spin');
    G.shake = Math.max(G.shake, 0.5); sfx.slam();
  } else if (kind === 'plunge') {
    hideFangMarkWarn();
    F.pos.set(F.mark.x, 0, F.mark.z); clampToActiveArena(F.pos, 2.4);
    F.yaw = Math.atan2(P.pos.x - F.pos.x, P.pos.z - F.pos.z);
    spawnRing(F.pos, 0xff2a5e, 13.5);
    spawnRing(F.pos, 0x8b5cff, 20);
    spawnSparks(new THREE.Vector3(F.pos.x, 1.2, F.pos.z), 46, 0xff4d6d, 9);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      spawnHexPillar(F.pos.x + Math.cos(a) * 3.4, F.pos.z + Math.sin(a) * 3.4, 0.28 + i * 0.02, 1.15, Math.round(TUNE.fangDmg.plunge * mult * 0.55), 1, false, 'fang');
    }
    sfx.slam(); sfx.pillar(); G.shake = Math.max(G.shake, 0.75);
    if (Math.hypot(P.pos.x - F.mark.x, P.pos.z - F.mark.z) < 5.35) damagePlayer(Math.round(TUNE.fangDmg.plunge * mult), F.pos, 'plunge');
  } else if (kind === 'duskwave') {
    spawnFireWave(F.pos.x, F.pos.z, Math.round(TUNE.fangDmg.duskwave * mult), 10, FANG_R + 1.2, 0xff2a5e);
    spawnHexPillar(P.pos.x, P.pos.z, 0.98, 1.7, Math.round(TUNE.fangDmg.duskwave * mult * 0.8), 1, false, 'fang');
    spawnSparks(new THREE.Vector3(F.pos.x, 1.2, F.pos.z), 30, 0xff2a5e, 8);
    G.shake = Math.max(G.shake, 0.45); sfx.cast(); sfx.slam();
  } else if (kind === 'duskfire') {
    const px = P.pos.x, pz = P.pos.z;
    const spots = [
      [px, pz], [px + 3.6, pz], [px - 3.6, pz], [px, pz + 3.6], [px, pz - 3.6],
    ];
    for (let i = 0; i < spots.length; i++) {
      let x = spots[i][0], z = spots[i][1];
      const dx = x - FANG_CENTER.x, dz = z - FANG_CENTER.z;
      const dd = Math.hypot(dx, dz), lim = FANG_R - 1.6;
      if (dd > lim) { x = FANG_CENTER.x + dx / dd * lim; z = FANG_CENTER.z + dz / dd * lim; }
      spawnHexPillar(x, z, 0.84 + i * 0.05, i === 0 ? 2.0 : 1.65, Math.round(TUNE.fangDmg.duskfire * mult), 1, false, 'fang');
    }
    spawnSparks(new THREE.Vector3(F.pos.x + fwd.x * 1.8, 1.8, F.pos.z + fwd.z * 1.8), 32, 0x8b5cff, 8);
    G.shake = Math.max(G.shake, 0.35); sfx.cast(); sfx.pillar();
  } else if (kind === 'afterimage') {
    const side = new THREE.Vector3(Math.cos(F.yaw), 0, -Math.sin(F.yaw));
    const marks = [
      [P.pos.x, P.pos.z],
      [P.pos.x + side.x * 3.1, P.pos.z + side.z * 3.1],
      [P.pos.x - side.x * 3.1, P.pos.z - side.z * 3.1],
    ];
    for (let i = 0; i < marks.length; i++) spawnFangEcho(marks[i][0], marks[i][1], 0.44 + i * 0.38, TUNE.fangDmg.afterimage, i === 0 ? 2.6 : 2.5);
    spawnSparks(new THREE.Vector3(F.pos.x, 1.9, F.pos.z), 36, 0xff2a5e, 9);
    spawnRing(F.pos, 0x8b5cff, 8);
    G.shake = Math.max(G.shake, 0.5); sfx.dash(); sfx.roar();
  }
}
function fangAfterRend(mult) {
  setTimeout(() => {
    if (!G.bossActive || F.state === 'dead' || G.mode !== 'play') return;
    const d = dist2D(F.pos, P.pos);
    if (d < 4.6 && inArc(F.pos, F.yaw, P.pos, 4.9, 1.30)) damagePlayer(Math.round(TUNE.fangDmg.rend * mult * 0.85), F.pos, 'rend');
    spawnRing(F.pos, 0xff4d6d, 3.8);
    spawnSparks(new THREE.Vector3(F.pos.x + Math.sin(F.yaw) * 2.0, 1.7, F.pos.z + Math.cos(F.yaw) * 2.0), 16, 0x8b5cff, 6);
    sfx.slash();
  }, 180);
}
function updateFang(dt) {
  F.t += dt;
  F.animT += dt;
  if (G.bossActive && P.state !== 'dead') G.fightTime += dt;
  G.hazardsDirty = true;
  if (fangMarkWarn && fangMarkWarn.visible) {
    fangMarkWarnMat.opacity = 0.26 + Math.abs(Math.sin(F.t * 8.5)) * 0.24;
    fangMarkWarn.scale.setScalar(1 + Math.sin(F.t * 8.5) * 0.03);
  }
  updateFangEchoes(dt);
  updateFangSlashes(dt);
  const d = dist2D(F.pos, P.pos);
  const toP = Math.atan2(P.pos.x - F.pos.x, P.pos.z - F.pos.z);
  switch (F.state) {
    case 'dormant':
      break;
    case 'intro':
      F.yaw += angDiff(toP, F.yaw) * Math.min(1, 2.8 * dt);
      if (F.t > 1.65) { F.state = 'idle'; F.decideCd = 1.0; G.fightTime = 0; }
      break;
    case 'rage':
      F.yaw += angDiff(toP, F.yaw) * Math.min(1, 2.4 * dt);
      if (F.t > 1.15) { F.state = 'idle'; F.decideCd = 0.65; }
      break;
    case 'idle': {
      F.yaw += angDiff(toP, F.yaw) * Math.min(1, (F.phase2 ? 3.4 : 2.7) * dt);
      F.decideCd = Math.max(0, F.decideCd - dt);
      if (P.state !== 'dead') {
        const spd = TUNE.fangSpeed * (F.phase2 ? 1.22 : 1) * (1 + G.ng * 0.05);
        if (d > 4.2) {
          F.pos.x += Math.sin(F.yaw) * spd * dt;
          F.pos.z += Math.cos(F.yaw) * spd * dt;
        } else if (d < 2.8) {
          F.pos.x -= Math.sin(F.yaw) * spd * dt * 0.7;
          F.pos.z -= Math.cos(F.yaw) * spd * dt * 0.7;
        } else {
          F.pos.x += Math.cos(F.yaw) * spd * dt * 0.25;
          F.pos.z -= Math.sin(F.yaw) * spd * dt * 0.25;
        }
        clampToActiveArena(F.pos, 2.2);
      }
      if (F.decideCd <= 0 && P.state !== 'dead') fangDecide();
      break;
    }
    case 'windup': {
      F.yaw += angDiff(toP, F.yaw) * Math.min(1, 1.5 * dt);
      const cast = FANG_ATK[F.attackKind] || FANG_ATK.rend;
      if (F.t >= cast.wind) {
        fangStrike(F.attackKind);
        F.state = 'recover'; F.t = 0; F.hasHit = true;
        hideFangMarkWarn();
      }
      break;
    }
    case 'recover': {
      F.yaw += angDiff(toP, F.yaw) * Math.min(1, 1.8 * dt);
      const cast = FANG_ATK[F.attackKind] || FANG_ATK.rend;
      if (F.t >= cast.recover) { F.state = 'idle'; F.t = 0; F.decideCd = (F.phase2 ? 0.55 : 0.8) + Math.random() * (F.phase2 ? 0.45 : 0.6); }
      break;
    }
    case 'stagger':
      if (F.t > 1.05) { F.state = 'idle'; F.t = 0; F.decideCd = 0.55; }
      break;
    case 'dead':
      F.deadT += dt;
      if (F.deadT > 2.2) { fangK.group.visible = false; fangShadow.visible = false; }
      break;
  }
}
function poseFang(dt) {
  const p = fangK.parts;
  const moving = F.state === 'idle' && dist2D(F.pos, P.pos) > 2.7;
  let airY = 0;
  if (F.attackKind === 'skyrend') {
    if (F.state === 'windup') airY = sstep(clampJ(F.t / (FANG_ATK.skyrend.wind * 0.82), 0, 1)) * 4.4;
    else if (F.state === 'recover') airY = F.t < 1.35 ? 4.4 : 4.4 * (1 - sstep(clampJ((F.t - 1.35) / 0.55, 0, 1)));
  }
  poseKnight(fangK, {
    moving, sprint: false, bossStep: true, state: F.state, t: F.t, kind: F.attackKind,
    atkTable: FANG_ATK, pos: F.pos, yaw: F.yaw, enrage: F.phase2, yOffset: airY,
  }, dt);
  const phase = F.phase2 ? 1 : 0;
  p.chest.position.y = p._chestY + Math.sin(F.animT * 6.2) * 0.009;
  p.tail.rotation.x = 0.52 + Math.sin(F.animT * 1.4) * 0.06;
  p.tail.rotation.y = 0.30 + Math.sin(F.animT * 1.05) * 0.05;
  for (let i = 0; i < p.tailSegs.length; i++) {
    const seg = p.tailSegs[i];
    seg.rotation.y = Math.sin(F.animT * 2.4 - i * 0.6) * (0.16 + phase * 0.05);
    seg.rotation.x = Math.sin(F.animT * 1.8 - i * 0.45) * 0.08;
  }
  p.auraMat.opacity = 0.12 + phase * 0.10 + (F.state === 'windup' ? 0.06 : 0);
  p.auraRing.scale.setScalar(1 + Math.sin(F.animT * 2.1) * 0.035);
  p.auraRing.rotation.z = F.animT * 0.15;
  const charging = F.state === 'windup';
  p.swordGlow.material.opacity += (((charging ? 0.42 + Math.sin(F.animT * 14) * 0.13 : 0.08 + phase * 0.10)) - p.swordGlow.material.opacity) * Math.min(1, 8 * dt);
  p.visor.material.emissiveIntensity = (F.phase2 ? 2.2 : 0.8) + Math.sin(F.animT * 9) * 0.25 + (charging ? 0.6 : 0);
  for (const eye of p.eyeGlows) eye.material.opacity = 0.55 + phase * 0.3 + Math.sin(F.animT * 5.2) * 0.15;
  p.keyLight.intensity = 32 + phase * 8 + (charging ? 7 : 0) + Math.sin(F.animT * 6.3) * 2;
  p.fillLight.intensity = 10 + phase * 4 + Math.sin(F.animT * 4.1 + 1) * 1.5;
}
function damageFang(dmg, poiseDmg = 24) {
  if (!G.bossActive || F.state === 'dead' || F.state === 'rage' || G.mode !== 'play') return;
  dmg *= P.mods.dmg;
  F.hp = Math.max(0, F.hp - dmg);
  F.staggerAcc += poiseDmg;
  const hitPos = new THREE.Vector3(F.pos.x + (Math.random() - 0.5) * 1.1, 1.7 + Math.random() * 1.2, F.pos.z + (Math.random() - 0.5) * 1.1);
  spawnSparks(hitPos, 12, 0xff5d78, 5);
  sfx.hitFlesh();
  G.hitstop = 0.035; G.shake = Math.min(0.5, G.shake + 0.16);
  if (!F.phase2 && F.hp < F.maxHP * 0.5 && F.hp > 0) {
    F.phase2 = true; F.state = 'rage'; F.t = 0; F.staggerAcc = 0;
    hideFangMarkWarn(); clearFangEchoes(); clearFangSlashes(); clearBossHazards(); clearHexHazards();
    sfx.roar(); G.shake = Math.max(G.shake, 0.9); G.hitstop = 0.1;
    spawnRing(F.pos, 0xff2a5e, 12);
    spawnRing(F.pos, 0x8b5cff, 20);
    spawnSparks(new THREE.Vector3(F.pos.x, 2.2, F.pos.z), 58, 0xff4d6d, 9);
    showCenter('THE ECLIPSE DEVOURS', 'Korvath draws the last light into his blade');
    bossNameEl.textContent = 'KORVATH  ·  THE ECLIPSE UNBOUND';
    intensifyBossMusic();
  } else if (F.staggerAcc >= 120 && F.state !== 'stagger' && F.hp > 0) {
    F.staggerAcc = 0; F.state = 'stagger'; F.t = 0;
    hideFangMarkWarn();
    showSub('KORVATH STAGGERS — STRIKE NOW');
    sfx.stagger(); G.hitstop = 0.12;
  }
  if (F.hp <= 0) fangDie();
}
function fangDie() {
  F.state = 'dead'; F.t = 0; F.deadT = 0;
  G.bossDead = true; G.bossActive = false; G.defeated.fang = true;
  stopBossMusic();
  setLock(false);
  clearBossHazards(); clearHexHazards();
  hideFangMarkWarn();
  clearFangEchoes();
  clearFangSlashes();
  telegraphEl.classList.add('hidden');
  sfx.death(); sfx.victory();
  spawnSparks(new THREE.Vector3(F.pos.x, 2.0, F.pos.z), 64, 0xff4d6d, 10);
  spawnRing(F.pos, 0xff2a5e, 12);
  spawnRing(F.pos, 0x8b5cff, 20);
  G.drops = bossDropsFor('fang');
  setTimeout(showDropScreen, 1600);
}

// ============ CAMERA ============
const camTarget = new THREE.Vector3();
const camLook = new THREE.Vector3(0, 1.7, 28);
const _camWant = new THREE.Vector3(), _camAim = new THREE.Vector3(), _camLookTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (G.witchAwakening) {
    const cx = Math.sin(G.camYaw) * Math.cos(G.camPitch), cz = Math.cos(G.camYaw) * Math.cos(G.camPitch);
    _camWant.set(P.pos.x + cx * G.camDist, 1.6 + Math.sin(G.camPitch) * G.camDist, P.pos.z + cz * G.camDist);
    camTarget.lerp(_camWant, 1 - Math.exp(-7 * dt));
    const k = Math.min(1, G.witchAwakeT / 0.6);
    camLook.lerp(_camLookTarget.set(witchStonePos.x, 2.35, witchStonePos.z), 1 - Math.exp(-(3 + k * 4) * dt));
  } else if (G.awakening && G.bossId === 'duncan') {
    if (G.awakeT < 1.15) {
      _camWant.set(2.8, 2.25, 3.8);
      camLook.lerp(_camLookTarget.set(stonePos.x, 1.5, stonePos.z), 1 - Math.exp(-5 * dt));
    } else {
      _camWant.set(4.2, 3.2, 2.8);
      const aimY = 1.1 + 0.95 * (bossK.group.scale.x / BOSS_BASE_SCALE);
      camLook.lerp(_camLookTarget.set(B.pos.x, aimY, B.pos.z), 1 - Math.exp(-3.2 * dt));
    }
    camTarget.lerp(_camWant, 1 - Math.exp(-3.4 * dt));
  } else if (G.witchLunarCutscene) {
    const T = G.witchLunarT;
    if (T < 4.45) {
      _camWant.set(WITCH_CENTER.x + 5.0, 5.4, WITCH_CENTER.z + 14.0);
      const moon = lunarAvatar.group.position;
      const w = Math.min(0.5, Math.max(0, (T - 2.2) / 1.8) * 0.5);
      _camLookTarget.set(
        W.pos.x + (moon.x - W.pos.x) * w,
        2.4 + (moon.y - 2.4) * w,
        W.pos.z + (moon.z - W.pos.z) * w
      );
    } else {
      _camWant.set(WITCH_CENTER.x + 8.2, 6.0, WITCH_CENTER.z + 14.0);
      _camLookTarget.set(lunarImpactPoint.x, 2.6, lunarImpactPoint.z);
    }
    camTarget.lerp(_camWant, 1 - Math.exp(-2.8 * dt));
    camLook.lerp(_camLookTarget, 1 - Math.exp(-3.6 * dt));
  } else if (lockOnActive()) {
    const tgt = activeBoss();
    const dx = P.pos.x - tgt.pos.x, dz = P.pos.z - tgt.pos.z;
    const len = Math.hypot(dx, dz);
    let bx, bz;
    if (len < 0.001) { bx = -Math.sin(P.yaw); bz = -Math.cos(P.yaw); }
    else { bx = dx / len; bz = dz / len; }
    const d = dist2D(P.pos, tgt.pos);
    const scaleF = activeBossScale();
    const dist = 2.7 + Math.min(2.2, d * 0.16);
    const camH = G.bossId === 'dragon'
      ? 1.5 + Math.min(0.6, d * 0.055)
      : 1.95 + Math.min(0.8, d * 0.075);
    _camWant.set(P.pos.x + bx * dist, camH, P.pos.z + bz * dist);
    // never let the camera slip inside the boss
    const vx = _camWant.x - tgt.pos.x, vz = _camWant.z - tgt.pos.z;
    const vd = Math.hypot(vx, vz), minCam = 1.9 * scaleF;
    if (vd < minCam) {
      const ax = vd < 0.001 ? bx : vx / vd, az = vd < 0.001 ? bz : vz / vd;
      _camWant.x = tgt.pos.x + ax * minCam; _camWant.z = tgt.pos.z + az * minCam;
    }
    const c = ARENA.center, limit = ARENA.radius + 1;
    const rr = Math.hypot(_camWant.x - c.x, _camWant.z - c.z);
    if (G.inArena && rr > limit) {
      const f = limit / rr;
      _camWant.x = c.x + (_camWant.x - c.x) * f;
      _camWant.z = c.z + (_camWant.z - c.z) * f;
    }
    _camWant.y = Math.max(1.2, _camWant.y);
    camTarget.lerp(_camWant, 1 - Math.exp(-7 * dt));
    camLook.lerp(_camAim.set(tgt.pos.x, activeBossAimY(), tgt.pos.z), 1 - Math.exp(-10 * dt));
  } else {
    const cx = Math.sin(G.camYaw) * Math.cos(G.camPitch), cz = Math.cos(G.camYaw) * Math.cos(G.camPitch);
    _camWant.set(P.pos.x + cx * G.camDist, 1.6 + Math.sin(G.camPitch) * G.camDist, P.pos.z + cz * G.camDist);
    // keep camera out of walls
    const c = ARENA.center, limit = ARENA.radius + 1;
    const dd = Math.hypot(_camWant.x - c.x, _camWant.z - c.z);
    if (G.inArena && dd > limit) {
      const f = limit / dd;
      _camWant.x = c.x + (_camWant.x - c.x) * f;
      _camWant.z = c.z + (_camWant.z - c.z) * f;
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
  const bossNow = activeBoss();
  const bk = bossNow.hp / bossNow.maxHP;
  bossFill.style.width = (bk * 100) + '%';
  bossShown += (bk - bossShown) * 0.04; bossGhost.style.width = (Math.max(bk, bossShown) * 100) + '%';
  vignette.classList.toggle('lowhp', hpk < 0.3);
  const tracking = lockOnActive() && G.mode === 'play';
  lockHint.classList.toggle('hidden', !tracking);
  // interact prompt
  if (G.mode === 'play' && !G.awakening && !G.witchAwakening && !G.witchLunarCutscene && G.bossId === 'witch') {
    if (G.inArena && !G.bossActive && !G.bossDead && near(witchStonePos, P.pos, 3.6)) { interactPrompt.classList.remove('hidden'); interactText.textContent = 'to touch the nightshade crystal'; }
    else interactPrompt.classList.add('hidden');
  } else if (G.mode === 'play' && !G.awakening && !G.witchAwakening && !G.witchLunarCutscene && G.bossId === 'dragon') {
    if (G.inArena && !G.bossActive && !G.bossDead && near(dragonStonePos, P.pos, 3.8)) { interactPrompt.classList.remove('hidden'); interactText.textContent = 'to touch the dragon stone'; }
    else interactPrompt.classList.add('hidden');
  } else if (G.mode === 'play' && !G.awakening && !G.witchAwakening && !G.witchLunarCutscene && G.bossId === 'fang') {
    if (G.inArena && !G.bossActive && !G.bossDead && near(fangStonePos, P.pos, 3.8)) { interactPrompt.classList.remove('hidden'); interactText.textContent = 'to touch the eclipse stone'; }
    else interactPrompt.classList.add('hidden');
  } else if (G.mode === 'play' && !G.awakening && !G.witchAwakening && !G.witchLunarCutscene && G.bossId === 'duncan') {
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
function hideSpoilTip() {
  if (spoilTipEl) spoilTipEl.classList.add('hidden');
}
function showSpoilTip(row, s) {
  if (!spoilTipEl) return;
  const title = document.createElement('b');
  title.className = 'rarity-' + s.rarity;
  title.textContent = s.name;
  const desc = document.createElement('span');
  desc.textContent = s.desc;
  spoilTipEl.innerHTML = '';
  spoilTipEl.appendChild(title);
  spoilTipEl.appendChild(desc);
  spoilTipEl.classList.remove('hidden');
  const r = row.getBoundingClientRect();
  const tw = spoilTipEl.offsetWidth, th = spoilTipEl.offsetHeight;
  let x = r.right + 10;
  if (x + tw > innerWidth - 8) x = r.left - tw - 10;
  let y = r.top + r.height / 2 - th / 2;
  x = Math.max(8, x);
  y = Math.max(8, Math.min(innerHeight - th - 8, y));
  spoilTipEl.style.left = x + 'px';
  spoilTipEl.style.top = y + 'px';
}
function renderWeaponList() {
  hideSpoilTip();
  if (inventoryEl.classList.contains('hidden')) return;
  const w = WEAPONS[P.weapon];
  invStatsEl.innerHTML = 'VIGOR <b>' + Math.ceil(P.hp) + '/' + P.maxHP + '</b> · ENDURANCE <b>' + Math.ceil(P.st) + '/' + P.stMax + '</b> · FLASKS <b>' + P.flasks + '/' + TUNE.flasks + '</b>';
  slotWeaponEl.textContent = w.name + ' (' + w.wt + ')';
  // Spoils slot
  const es = P.equippedSpoils ? ALL_SPOILS.find(x => x.id === P.equippedSpoils) : null;
  if (spoilsSlotEl) {
    spoilsSlotEl.innerHTML = '';
    if (es) {
      const nameEl = document.createElement('span');
      nameEl.className = 'rarity-' + es.rarity;
      nameEl.textContent = es.name;
      const unequipEl = document.createElement('span');
      unequipEl.className = 'unequip-hint';
      unequipEl.textContent = ' (unequip)';
      unequipEl.onclick = unequipSpoils;
      spoilsSlotEl.appendChild(nameEl);
      spoilsSlotEl.appendChild(unequipEl);
    } else {
      const emptyEl = document.createElement('span');
      emptyEl.className = 'none';
      emptyEl.textContent = '— empty — ';
      const hintEl = document.createElement('span');
      hintEl.className = 'hint';
      hintEl.textContent = '(click a spoil to equip)';
      emptyEl.appendChild(hintEl);
      spoilsSlotEl.appendChild(emptyEl);
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
      ? bar('DMG', wd.dmg, 2.5) + bar('SPD', wd.spd, 1.35) + bar('WT', wd.st, 1.8)
      : '<span class="wstat"><i>DMG</i><b style="width:0%"></b></span><span class="wstat"><i>SPD</i><b style="width:0%"></b></span><span class="wstat"><i>WT</i><b style="width:0%"></b></span>';
    const keyLabel = i < 8 ? i + 1 : i === 8 ? 9 : i === 9 ? 0 : '·';
    row.innerHTML = '<span class="wkey">' + keyLabel + '</span><span class="wname rarity-' + wd.rarity + '">' + (owned ? wd.name : '???') + '</span>' +
      '<span class="wbars">' + bars + '</span>' +
      '<span class="wstate">' + (id === P.weapon ? 'EQUIPPED' : owned ? 'EQUIP' : 'NOT FOUND') + '</span>';
    if (owned) row.onclick = () => equipWeapon(id);
    weaponListEl.appendChild(row);
  });
  // Spoils list — one slot, click to equip or swap
  const spoilsListEl = $('spoils-list');
  spoilsListEl.innerHTML = '';
  if (P.spoils.length) {
    P.spoils.forEach(sid => {
      const s = ALL_SPOILS.find(x => x.id === sid);
      if (!s) return;
      const eq = P.equippedSpoils === sid;
      const row = document.createElement('div');
      row.className = 'spoil rarity-' + s.rarity + (eq ? ' equipped' : '');
      row.textContent = s.name;
      if (eq) {
        const tag = document.createElement('span');
        tag.className = 'eq-tag';
        tag.textContent = 'EQUIPPED';
        row.appendChild(document.createTextNode(' '));
        row.appendChild(tag);
      }
      row.onmouseenter = () => showSpoilTip(row, s);
      row.onmouseleave = hideSpoilTip;
      row.onclick = () => { hideSpoilTip(); equipSpoils(sid); };
      spoilsListEl.appendChild(row);
    });
  } else {
    const empty = document.createElement('div');
    empty.className = 'spoil none';
    empty.textContent = 'None yet — defeat Ser Duncan';
    spoilsListEl.appendChild(empty);
  }
}
function toggleInventory() {
  if (inventoryEl.classList.contains('hidden')) {
    if (!vigilMenuEl.classList.contains('hidden')) closeVigilMenu();
    inventoryEl.classList.remove('hidden');
    G.paused = true;
    if (document.pointerLockElement) document.exitPointerLock();
    renderWeaponList();
  } else closeInventory();
}
function closeInventory() {
  hideSpoilTip();
  inventoryEl.classList.add('hidden');
  G.paused = false;
}
function equipSpoils(id) {
  const s = ALL_SPOILS.find(x => x.id === id);
  if (!s || !P.spoils.includes(id)) return;
  if (P.equippedSpoils) {
    const old = ALL_SPOILS.find(x => x.id === P.equippedSpoils);
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
  const old = ALL_SPOILS.find(x => x.id === P.equippedSpoils);
  if (old) old.unapply(P);
  P.equippedSpoils = null;
  sfx.equip();
  renderWeaponList();
  saveGame();
}

// ============ MAIN LOOP ============
function setRenderScale(next) {
  const clamped = Math.max(0.7, Math.min(1, Math.round(next * 100) / 100));
  const pr = Math.min(devicePixelRatio, MAX_DPR) * clamped;
  if (Math.abs(pr - renderer.getPixelRatio()) < 0.004) return;
  renderScale = clamped;
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(pr);
  composer.setSize(innerWidth, innerHeight);
  gradePass.uniforms.uResolution.value.set(innerWidth, innerHeight);
  setFXAAResolution(pr);
  sparkMat.uniforms.uPixelRatio.value = pr;
}
let perfWarmup = 2.5, perfWindowT = 0, perfWindowFrames = 0, perfGoodWindows = 0;
function updateAdaptiveResolution(rawDt) {
  if (document.hidden) return;
  if (rawDt > 1.0) { perfWindowT = 0; perfWindowFrames = 0; return; }
  if (perfWarmup > 0) { perfWarmup -= rawDt; return; }
  perfWindowT += rawDt; perfWindowFrames++;
  if (perfWindowT < 1.4) return;
  const fps = perfWindowFrames / perfWindowT;
  perfWindowT = 0; perfWindowFrames = 0;
  if (fps < 48) { perfGoodWindows = 0; setRenderScale(renderScale - 0.08); }
  else if (fps > 57) {
    if (++perfGoodWindows >= 2) { perfGoodWindows = 0; setRenderScale(renderScale + 0.04); }
  } else perfGoodWindows = 0;
}
const clock = new THREE.Clock();
camTarget.set(0, 4, 32);
let first = true, frameNo = 0, hudTick = 0;
function loop() {
  requestAnimationFrame(loop);
  const rawDt = clock.getDelta();
  let dt = Math.min(0.05, rawDt);
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
  if (witchArenaGroup.visible) for (const f of witchFlames) {
    const u = f.userData; if (!u.sprites) continue;
    const [outer, core] = u.sprites;
    const k = 1 + Math.sin(t * 9 + u.seed) * 0.12 + Math.sin(t * 21 + u.seed * 1.7) * 0.05;
    outer.scale.set(u.w * 2.9 * (1 + Math.sin(t * 6.7 + u.seed) * 0.07), u.h * 1.5 * k, 1);
    outer.position.x = Math.sin(t * 1.2 + u.seed) * u.w * 0.11;
    core.scale.set(u.w * 1.35 * (1 + Math.sin(t * 11.7 + u.seed) * 0.09), u.h * 0.95 * k, 1);
    core.position.x = Math.sin(t * 1.6 + u.seed * 1.3) * u.w * 0.07;
  }
  if (dragonArenaGroup.visible) for (const f of dragonFlames) {
    const u = f.userData; if (!u.sprites) continue;
    const [outer, core] = u.sprites;
    const k = 1 + Math.sin(t * 11 + u.seed) * 0.12 + Math.sin(t * 25 + u.seed * 1.7) * 0.05;
    outer.scale.set(u.w * 2.9 * (1 + Math.sin(t * 7.7 + u.seed) * 0.07), u.h * 1.5 * k, 1);
    outer.position.x = Math.sin(t * 1.5 + u.seed) * u.w * 0.11;
    core.scale.set(u.w * 1.35 * (1 + Math.sin(t * 13.1 + u.seed) * 0.09), u.h * 0.95 * k, 1);
    core.position.x = Math.sin(t * 1.9 + u.seed * 1.3) * u.w * 0.07;
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
  if (witchWorldGroup.visible) {
    for (const m of witchMotes) {
      const u = m.userData;
      u.a += dt * u.speed;
      m.position.x = WITCH_CENTER.x + Math.cos(u.a) * u.rr;
      m.position.z = WITCH_CENTER.z + Math.sin(u.a) * u.rr;
      m.position.y = u.y + Math.sin(t * 0.8 + u.bob) * 0.5;
      m.material.opacity = 0.35 + Math.sin(t * 2.1 + u.bob) * 0.2;
    }
  }
  if (dragonWorldGroup.visible) {
    for (const m of dragonMotes) {
      const u = m.userData;
      u.a += dt * u.speed;
      m.position.x = DRAGON_CENTER.x + Math.cos(u.a) * u.rr;
      m.position.z = DRAGON_CENTER.z + Math.sin(u.a) * u.rr;
      m.position.y = u.y + Math.sin(t * 0.7 + u.bob) * 0.7;
      m.material.opacity = 0.35 + Math.sin(t * 2.3 + u.bob) * 0.2;
    }
  }
  if (dragonStone && dragonArenaGroup.visible) {
    dragonStone.rotation.y = t * 0.55;
    dragonStone.position.y = 2.45 + Math.sin(t * 1.7) * 0.09;
    dragonStoneGlow.material.opacity = 0.5 + Math.sin(t * 3.1) * 0.14;
    dragonStoneMat.emissiveIntensity = 2.6 + Math.sin(t * 4.3) * 0.7;
  }
  if (fangWorldGroup.visible) {
    for (const m of fangMotes) {
      const u = m.userData;
      u.a += dt * u.speed;
      m.position.x = FANG_CENTER.x + Math.cos(u.a) * u.rr;
      m.position.z = FANG_CENTER.z + Math.sin(u.a) * u.rr;
      m.position.y = u.y + Math.sin(t * 0.8 + u.bob) * 0.55;
      m.material.opacity = 0.28 + Math.sin(t * 2.4 + u.bob) * 0.18;
    }
    if (fangMoonRing) {
      fangMoonRing.rotation.z = t * 0.06;
      fangMoonRing.material.opacity = 0.64 + Math.sin(t * 1.2) * 0.12;
    }
  }
  if (fangStone && fangArenaGroup.visible) {
    fangStone.rotation.y = t * 0.7;
    fangStone.position.y = 2.45 + Math.sin(t * 1.8) * 0.10;
    fangStoneGlow.material.opacity = 0.38 + Math.sin(t * 3.3) * 0.14;
    fangStoneMat.emissiveIntensity = 2.3 + Math.sin(t * 4.6) * 0.8 + (F.phase2 ? 1.2 : 0);
    fangLight.intensity = 54 + Math.sin(t * 4.2) * 9 + (F.phase2 ? 10 : 0);
  }
  if (!G.awakening && altarGem.visible) {
    altarGem.rotation.y = t * 1.1;
    altarGem.position.y = 1.52 + Math.sin(t * 1.8) * 0.04;
    altarGlow.material.opacity = 0.52 + Math.sin(t * 3.2) * 0.12;
    altarLight.intensity = 12 + Math.sin(t * 4.1) * 3;
  }
  if (witchCrystal && !G.witchAwakening) {
    witchCrystal.rotation.y = t * 0.8;
    witchCrystal.position.y = 2.35 + Math.sin(t * 1.6) * 0.08;
    witchCrystalMat.emissiveIntensity = 2.4 + Math.sin(t * 3.6) * 0.7 + (W.phase2 ? 1.4 : 0);
    witchCrystalGlow.material.opacity = 0.42 + Math.sin(t * 2.9) * 0.12;
    witchCrystalGlow.scale.setScalar(4.2 + Math.sin(t * 2.2) * 0.5);
    witchLight.intensity = 38 + Math.sin(t * 4.2) * 7;
  }
  fogGate.material.opacity = (G.inArena ? 0.1 : 0.5) + Math.sin(t * 1.7) * 0.06;
  warm.intensity = G.bossId === 'witch' || G.bossId === 'dragon' || G.bossId === 'fang' ? 0 : 24 + Math.sin(t * 9) * 4;
  // embers
  if (G.bossId === 'witch') {
    if (Math.random() < 0.32) spawnSparks(new THREE.Vector3(WITCH_CENTER.x + (Math.random() - 0.5) * 24, 0.5, WITCH_CENTER.z + (Math.random() - 0.5) * 24), 1, Math.random() < 0.5 ? 0x9b5cff : 0xd9b7ff, 1.2);
  } else if (G.bossId === 'dragon') {
    if (Math.random() < 0.5) spawnSparks(new THREE.Vector3(DRAGON_CENTER.x + (Math.random() - 0.5) * 30, 0.4, DRAGON_CENTER.z + (Math.random() - 0.5) * 30), 1, Math.random() < 0.5 ? 0xff6a2a : 0xffc861, 1.6);
  } else if (G.bossId === 'fang') {
    if (Math.random() < 0.4) spawnSparks(new THREE.Vector3(FANG_CENTER.x + (Math.random() - 0.5) * 30, 0.4, FANG_CENTER.z + (Math.random() - 0.5) * 30), 1, Math.random() < 0.5 ? 0xff2a5e : 0x8b5cff, 1.4);
  } else if (Math.random() < 0.25) spawnSparks(new THREE.Vector3((Math.random()-0.5)*20, 0.5, (Math.random()-0.5)*20 + 6), 1, Math.random() < 0.5 ? 0xff8c3a : 0x555566, 1.2);
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
    } else if (G.witchAwakening) {
      updateWitchAwakening(dt);
    } else if (!G.witchLunarCutscene) {
      updatePlayer(dt);
      resolveStoneCollision();
      resolveBossCollision();
    }
    const interacting = G.awakening || G.witchAwakening;
    if (!interacting && G.bossId === 'duncan' && (G.bossActive || B.state === 'dormant')) updateBoss(dt);
    if (!interacting && G.bossId === 'witch') updateWitch(dt);
    if (!interacting && G.bossId === 'dragon' && V.state !== 'dormant') updateDragon(dt);
    if (!interacting && G.bossId === 'fang' && F.state !== 'dormant') updateFang(dt);
    if (!interacting && !G.witchLunarCutscene) { resolveStoneCollision(); resolveBossCollision(); }
    if (G.bossId === 'witch') { updateHexBolts(dt); updateHexPillars(dt); updateHexWaves(dt); updateMoonBeams(dt); updateSkeletons(dt); }
    else if (G.bossId === 'dragon') { updatePillars(dt); updateFireWaves(dt); }
    else if (G.bossId === 'fang') { updatePillars(dt); updateHexPillars(dt); updateFireWaves(dt); }
    else { updatePillars(dt); updateFireBolts(dt); updateFireWaves(dt); }
    if (G.bossId === 'duncan') { updateInfernoOrbVisual(dt); updateInfernoMark(dt); updateBossFireAura(dt); }
  }
  // poses
  const pMoving = ['run'].includes(P.state) || (['idle'].includes(P.state) && moveVec().lengthSq() > 0.01);
  poseKnight(playerK, { moving: pMoving, sprint: !!keys.ShiftLeft, state: P.state, t: P.t, combo: P.combo, pos: P.pos, yaw: P.yaw }, dt);
  const bMoving = ['chase'].includes(B.state);
  const bossVisible = bossK.group.visible;
  if (bossVisible) poseKnight(bossK, { moving: bMoving, sprint: false, bossStep: true, state: B.state, t: B.t, kind: B.attackKind, pos: B.pos, yaw: B.yaw, yOffset: G.awakening ? G.bossRevealY : 0, enrage: B.phase2 }, dt);
  if (witchK.group.visible) poseWitch(dt);
  if (dragonK.group.visible) { poseDragon(dt); updateDragonBreathFX(dt); }
  if (fangK.group.visible) poseFang(dt);
  const clothNormals = (frameNo % 3) === 0;
  animateCloth(playerK.parts.cape, t, clothNormals); animateCloth(playerK.parts.cape2, t * 1.07, clothNormals);
  if (bossVisible) {
    animateCloth(bossK.parts.cape, t * 0.9, clothNormals); animateCloth(bossK.parts.cape2, t * 0.97, clothNormals);
  }
  if (witchK.group.visible) {
    const panels = witchK.parts.skirtPanels;
    for (let i = 0; i < panels.length; i++) animateCloth(panels[i], t * 0.85 + i * 0.17, clothNormals);
  }
  if (fangK.group.visible) {
    animateCloth(fangK.parts.cape, t * 1.02, clothNormals);
    animateCloth(fangK.parts.cape2, t * 1.09, clothNormals);
  }
  playerShadow.position.set(P.pos.x, 0.025, P.pos.z);
  bossShadow.position.set(B.pos.x, 0.025, B.pos.z);
  bossShadow.visible = bossK.group.visible && B.state !== 'dead' && !(B.state === 'inferno' && B.infernoFormed);
  witchShadow.position.set(W.pos.x, 0.025, W.pos.z);
  witchShadow.visible = G.bossId === 'witch' && witchK.group.visible && W.state !== 'dead';
  fangShadow.position.set(F.pos.x, 0.025, F.pos.z);
  fangShadow.visible = G.bossId === 'fang' && fangK.group.visible && F.state !== 'dead';
  fangShadow.scale.setScalar(1.0 + Math.sin(t * 1.9) * 0.03);
  updateCamera(dt);
  if ((hudTick++ % 3) === 0) updateHUD();
  gradePass.uniforms.uTime.value = t;
  composer.render();
  updateAdaptiveResolution(rawDt);
  if (first) { first = false; $('loading').style.display = 'none'; }
}
updateFlasks();
updateWeaponLabel();
loop();

// expose for automated checks
window.__game = { G, P, B, W, V, F, TUNE, WEAPONS, SPOILS, BOSS_SHARDS, ALL_SPOILS, RARITY, DROP_POOL, DROP_WEIGHTS, SWORD_DROPS, SPOIL_DROPS, FANG_ATK, WEAPON_ORDER, ARENAS, BOSSES, BOSS_ORDER, bossUnlocked, bossShardFor, bossDropsFor, chooseBoss, enterBossArena, beginWitch, resetWitch, beginDragon, resetDragon, beginFang, resetFang, enterArena, touchStone, updateAwakening, touchWitchStone, touchDragonStone, updateWitchAwakening, updateDragon, poseDragon, dragonStrike, dragonDecide, spawnDragonBreath, spawnDragonStorm, updateFang, poseFang, fangStrike, fangDecide, touchFangStone, damageFang, fangEchoes, fangSlashes, spawnFangSkySlash, updateFangSlashes, clearFangSlashes, setCreatorMode, bossMusicInfo: () => bossMusic ? { step: bossMusic.step, tempo: bossMusic.tempo, phase2: bossMusic.phase2, state: bossMusic.ac.state, gain: bossMusic.master.gain.value } : null, stonePos, witchStonePos, dragonStonePos, fangStonePos, restAtBonfire, damageBoss, damageWitch, damageDragon, damageFang, damagePlayer, equipWeapon, toggleInventory, equipSpoils, unequipSpoils, rollDrops, claimDrops, showDropScreen, spawnPillarBarrage, spawnInfernoBarrage, spawnMeteorStorm, spawnFireBoltVolley, clearBossHazards, clearHexHazards, pillars, fireBolts, fireWaves, hexPillars, hexBolts, hexWaves, skeletons, moonBeams, lunarAvatar, summonSkeletons, spawnMoonBeamVolley, damageSkeleton, damageSkeletonsInArc, saveGame, loadGame, eraseSave, applyWorldStyle, switchBossFromVictory, switchBossFromVigil, toggleVigilMenu, closeVigilMenu, anyVigilFelled, dragonWorldGroup, dragonArenaGroup, dragonK, fangWorldGroup, fangArenaGroup, fangK, fangShadow, spawnHexPillar, spawnFireWave };
window.__scene = { scene, camera, renderer, moon, composer, playerShadow, bossShadow, witchK, witchShadow, witchWorldGroup, witchArenaGroup, dragonK, dragonShadow, dragonWorldGroup, dragonArenaGroup, fangK, fangShadow, fangWorldGroup, fangArenaGroup, THREE };


if (location.hash === '#bosstest' || location.hash === '#witchtest' || location.hash === '#dragontest' || location.hash === '#fangtest') {
  if (location.hash === '#witchtest') G.defeated.duncan = true;
  if (location.hash === '#dragontest') { G.defeated.duncan = true; G.defeated.witch = true; }
  if (location.hash === '#fangtest') { G.defeated.duncan = true; G.defeated.witch = true; G.defeated.dragon = true; }
  setTimeout(() => {
    const id = location.hash === '#witchtest' ? 'witch' : location.hash === '#dragontest' ? 'dragon' : location.hash === '#fangtest' ? 'fang' : 'duncan';
    chooseBoss(id);
    if (id === 'witch') { touchWitchStone(); G.witchAwakeT = 1.16; updateWitchAwakening(0.01); }
    else if (id === 'dragon') touchDragonStone();
    else if (id === 'fang') touchFangStone();
    else { touchStone(); G.awakeT = 3.05; updateAwakening(0.01); }
  }, 300);
  setTimeout(() => {
    const m = bossMusic;
    document.body.setAttribute('data-bm', m
      ? ('ON step=' + m.step + ' tempo=' + m.tempo + ' gain=' + m.master.gain.value.toFixed(3) + ' state=' + m.ac.state + ' ambientNodes=' + musicNodes.length)
      : 'OFF');
  }, 6000);
}
