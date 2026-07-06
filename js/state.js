'use strict';
// ============================== ESTADO GLOBAL ==============================
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let tiles = [];
let colonists = [];
let animals = [];
let resources = { wood: 40, stone: 20, iron: 0, fiber: 0, food: 30, meat: 0, guiso: 0, tools: 1, ropa: 0, gold: 10 };
let day = 1, time = 0.3, speed = 1, gtime = 0;
let tool = 'chop', activeCat = 'orders';
let dragStart = null, panning = null;
let mouse = { tx: 0, ty: 0, px: 0, py: 0, wx: 0, wy: 0, in: false };
let msgs = [];
let nextId = 1, nextAnimalId = 1;
let gameOver = false;
let selected = null, controlling = null;
let convos = [], convoTimer = 2;
let floaters = [];
let rels = {};
let kin = {};        // parentescos (hermanos): no pueden ser pareja
let grudges = {};    // rivalidades de origen: discuten más
let currentBiome = null;
let trader = null, nextTraderDay = 3, traderSay = 0;
let story = [];                              // crónica de la colonia
let banner = null;                           // aviso grande de la Cronista
let effects = [];                            // mini-animaciones de eventos
let stats = { harvested: 0, tools: 0 };      // contadores para las metas
let goalIndex = 0, goalAnnounced = false, goalAnnounceAt = 50;
let fires = [];                              // tiles en llamas
let roomsDirty = true;                       // recalcular interiores
let coldSnapUntil = 0;                       // ola de frío (evento)
let nextEventAt = 0, lastEventId = null;     // narradora
const keys = new Set();
const cam = { x: 0, y: 0, z: 1 };

// ============================== HELPERS ==============================
const idx = (x, y) => y * MW + x;
const inB = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
const T = (x, y) => tiles[idx(x, y)];
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function walkable(t) {
  return t.g !== 'water' && t.o !== 'tree' && t.o !== 'rock' && t.o !== 'wall';
}
function isNight() { return time < 0.22 || time > 0.78; }
function season() { return SEASONS[Math.floor((day - 1) / SEASON_DAYS) % 4]; }
function stageOf(c) { return c.age < 3 ? 'baby' : c.age < 6 ? 'child' : 'adult'; }
function stageName(c) { return { baby: 'Bebé 👶', child: 'Niño/a 🧒', adult: null }[stageOf(c)]; }
function darkness() {
  const s = Math.sin((time - 0.25) * Math.PI * 2);
  return clamp(0.28 - s * 0.5, 0, 0.55);
}
function canAfford(cost) { return Object.keys(cost).every(r => resources[r] >= cost[r]); }
function pay(cost)    { for (const r in cost) resources[r] -= cost[r]; }
function refund(cost) { for (const r in cost) resources[r] += cost[r]; }
function addLog(txt) {
  msgs.unshift(`Día ${day} — ${txt}`);
  if (msgs.length > 10) msgs.pop();
  document.getElementById('log').innerHTML = msgs.map(m => `<div>${m}</div>`).join('');
}
// hito importante: va al registro Y a la crónica de la colonia
function addStory(txt) {
  story.push({ day, txt });
  if (story.length > 200) story.shift();
  addLog(txt);
}
function showBanner(text) { banner = { text, until: gtime + 8 }; }
function addEffect(e) { e.t = 0; effects.push(e); }
// qué tan bien viene la colonia (0 mal … 1 excelente) — la Cronista decide con esto
function colonyHealth() {
  if (!colonists.length) return 0;
  const avgMood = colonists.reduce((s, c) => s + moodOf(c), 0) / colonists.length;
  const foodDays = (resources.food + resources.guiso * 3 + resources.meat) / (colonists.length * 4);
  return clamp(avgMood / 100 * 0.6 + clamp(foodDays / 3, 0, 1) * 0.4, 0, 1);
}
function isFreezing() { return season().id === 'winter' || gtime < coldSnapUntil; }
function anyStock() { return tiles.some(t => t.stock); }
function isSleeping(c) {
  return c.task && (c.task.type === 'sleep' || c.task.type === 'sleepHere') && c.task.phase === 'work';
}
function addFloater(px, py, text) { floaters.push({ x: px, y: py, text, t: 0 }); }
function ctlPawn() { return colonists.find(c => c.id === controlling) || null; }

// -------- inventario --------
function invTotal(c) {
  let s = 0;
  for (const k in c.inv) s += c.inv[k];
  return s;
}
function addToInv(c, res, n) {
  const take = Math.min(INV_CAP - invTotal(c), n);
  if (take > 0) {
    c.inv[res] = (c.inv[res] || 0) + take;
    addFloater(c.x, c.y - 10, `+${take} ${RES_EMOJI[res]}`);
  }
  if (n - take > 0) dropItem(T(c.tx, c.ty), res, n - take);
}
function takeFromInv(c, res, n) {
  const have = c.inv[res] || 0, take = Math.min(have, n);
  c.inv[res] = have - take;
  if (c.inv[res] <= 0) delete c.inv[res];
  return take;
}

// -------- humor y frases --------
function addBuff(c, txt, val, dur) {
  c.buffs = c.buffs.filter(b => b.txt !== txt);
  c.buffs.push({ txt, val, until: gtime + dur });
}
function moodOf(c) {
  let m = 50 + (c.hunger - 50) * 0.3 + (c.energy - 50) * 0.2;
  if (c.trait === 'optimista') m += 10;
  if (c.back === 'noble') m += 5;
  if (c.outfit) m += 5;
  if (c.partner && colonists.some(o => o.id === c.partner)) m += 8;   // enamorado 💕
  for (const b of c.buffs) m += b.val;
  return clamp(Math.round(m), 0, 100);
}
// habilidades: la práctica sube el nivel y el nivel acelera el trabajo (×0.75 a ×1.35)
function skillLv(c, id) { return c.skills && c.skills[id] ? c.skills[id].lv : 0; }
function gainXp(c, id, amt) {
  if (!c.skills || !id || stageOf(c) === 'baby') return;
  const s = c.skills[id] || (c.skills[id] = { lv: 0, xp: 0 });
  if (s.lv >= 10) return;
  s.xp += amt;
  const need = 30 + s.lv * 25;
  if (s.xp >= need) {
    s.xp -= need;
    s.lv++;
    addFloater(c.x, c.y - 14, `⬆️ ${SKILLS.find(k => k.id === id).icon}${s.lv}`);
    sfxAt('level', c.x, c.y);
    if (s.lv % 2 === 0) addLog(`⬆️ <b>${c.name}</b> subió ${SKILLS.find(k => k.id === id).name} a nivel ${s.lv}.`);
  }
}
function workMult(c, skillId) {
  let m = c.trait === 'trabajador' ? 1.2 : 1;
  if (c.tool) m *= 1.15;
  if (skillId) m *= 0.75 + skillLv(c, skillId) * 0.06;
  if (stageOf(c) === 'child') m *= 0.6;
  if (c.inspiredUntil > gtime) m *= 1.5;    // evento de inspiración ✨
  m *= 1 + (moodOf(c) - 50) / 250;          // humor: ×0.8 a ×1.2
  return m;
}
function say(c, text, dur) { c.say = { text, until: gtime + (dur || 3) }; }
function fmt(s, n) { return s.replace('{n}', n); }

// -------- relaciones --------
function relKey(a, b) { return a.id < b.id ? a.id + '-' + b.id : b.id + '-' + a.id; }
function relOf(a, b) { return rels[relKey(a, b)] || 0; }
function areFriends(a, b) { return relOf(a, b) >= 3; }
function friendsOf(c) { return colonists.filter(o => o !== c && areFriends(c, o)); }
