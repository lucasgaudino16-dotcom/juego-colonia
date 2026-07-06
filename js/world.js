'use strict';
// ============================== MAPA Y TERRENO ==============================
// lienzo pre-renderizado con el suelo (se repinta solo cuando cambia un tile)
const terrain = document.createElement('canvas');
terrain.width = MW * TW;
terrain.height = MH * TW;
const tctx = terrain.getContext('2d');

function patchShade(x, y) {
  return 0.05 + 0.05 * Math.sin(x * 0.31 + y * 0.17) + 0.04 * Math.sin(y * 0.23 - x * 0.11) + Math.random() * 0.05;
}
function mkTile(x, y) {
  const r = Math.random();
  return {
    x, y, g: 'grass', shade: patchShade(x, y),
    deco: r < 0.70 ? 0 : r < 0.85 ? 1 : r < 0.93 ? 2 : 3,
    o: null, ore: null, desig: null, bp: null, stock: false, farm: false, crop: null,
    item: null, rsv: null, fire: 0, fireTick: 0, scorched: false, indoor: false, floor: false,
  };
}

// paletas de suelo por estación
const GROUND_PAL = {
  spring: { grass: [66, 128, 68],  water: ['#2b5f9e', '#2d63a4'], shore: '#4a7fb8', tuft: 'rgba(30,70,32,0.55)' },
  summer: { grass: [78, 132, 58],  water: ['#2b5f9e', '#2d63a4'], shore: '#4a7fb8', tuft: 'rgba(60,80,25,0.55)' },
  autumn: { grass: [96, 116, 52],  water: ['#2b5a92', '#2d5e98'], shore: '#4a7ab0', tuft: 'rgba(90,70,25,0.6)' },
  winter: { grass: [216, 224, 234], water: ['#6f9cc7', '#7aa6d1'], shore: '#a8c6e0', tuft: 'rgba(120,135,155,0.6)' },
};
function paintGround(x, y) {
  const t = T(x, y), px = x * TW, py = y * TW;
  const pal = GROUND_PAL[season().id];
  const winter = season().id === 'winter';
  if (t.g === 'water') {
    tctx.fillStyle = pal.water[(x + y) % 2];
    tctx.fillRect(px, py, TW, TW);
    // costa: borde claro + espuma hacia los tiles de tierra vecinos
    for (const [dx, dy] of DIRS) {
      if (!inB(x + dx, y + dy) || T(x + dx, y + dy).g === 'water') continue;
      tctx.fillStyle = pal.shore;
      if (dx === 1) tctx.fillRect(px + TW - 3, py, 3, TW);
      if (dx === -1) tctx.fillRect(px, py, 3, TW);
      if (dy === 1) tctx.fillRect(px, py + TW - 3, TW, 3);
      if (dy === -1) tctx.fillRect(px, py, TW, 3);
      tctx.fillStyle = 'rgba(220,235,250,0.55)';
      if (dx === 1) tctx.fillRect(px + TW - 1, py, 1, TW);
      if (dx === -1) tctx.fillRect(px, py, 1, TW);
      if (dy === 1) tctx.fillRect(px, py + TW - 1, TW, 1);
      if (dy === -1) tctx.fillRect(px, py, TW, 1);
    }
    return;
  }
  if (t.floor) {                             // piso de tablas
    tctx.fillStyle = '#8a6a42';
    tctx.fillRect(px, py, TW, TW);
    tctx.fillStyle = '#75572f';
    tctx.fillRect(px, py + 3, TW, 1);
    tctx.fillRect(px, py + 8, TW, 1);
    tctx.fillRect(px, py + 13, TW, 1);
    tctx.fillRect(px + ((x % 2) ? 4 : 10), py, 1, TW);
    if (t.scorched) { tctx.fillStyle = 'rgba(28,22,18,0.55)'; tctx.fillRect(px, py, TW, TW); }
    return;
  }
  if (t.g === 'soil') {
    tctx.fillStyle = winter ? '#77685a' : '#6b4f2f';
    tctx.fillRect(px, py, TW, TW);
    tctx.fillStyle = winter ? '#665a4e' : '#5a4226';
    tctx.fillRect(px, py + 4, TW, 2);
    tctx.fillRect(px, py + 10, TW, 2);
    if (winter) {
      tctx.fillStyle = 'rgba(225,232,240,0.5)';
      tctx.fillRect(px + 2, py + 2, 3, 2);
      tctx.fillRect(px + 10, py + 12, 3, 2);
    }
    return;
  }
  // pasto (o nieve en invierno) con matices y detalles
  const s = 1 - t.shade * (winter ? 0.35 : 1);
  const [gr, gg, gb] = pal.grass;
  tctx.fillStyle = `rgb(${(gr * s) | 0},${(gg * s) | 0},${(gb * s) | 0})`;
  tctx.fillRect(px, py, TW, TW);
  if (t.deco === 1) {                        // matas de pasto
    tctx.strokeStyle = pal.tuft;
    tctx.lineWidth = 1;
    for (const [ox, l] of [[4, 4], [8, 5], [12, 3]]) {
      tctx.beginPath();
      tctx.moveTo(px + ox, py + 12);
      tctx.lineTo(px + ox - 1, py + 12 - l);
      tctx.stroke();
    }
  } else if (t.deco === 2 && !winter) {      // florcitas (no en invierno)
    const cols = ['#e8e18a', '#e8a1b0', '#f0f0f0'];
    tctx.fillStyle = cols[(x + y) % 3];
    tctx.fillRect(px + 4, py + 5, 2, 2);
    tctx.fillRect(px + 10, py + 10, 2, 2);
  } else if (t.deco === 3) {                 // piedritas
    tctx.fillStyle = winter ? 'rgba(150,160,175,0.7)' : 'rgba(140,145,150,0.5)';
    tctx.fillRect(px + 5, py + 9, 2, 2);
    tctx.fillRect(px + 10, py + 6, 2, 2);
  }
  if (t.scorched) {                          // tierra quemada
    tctx.fillStyle = 'rgba(28,22,18,0.55)';
    tctx.fillRect(px, py, TW, TW);
  }
}
function repaintAll() {
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) paintGround(x, y);
}
function repaintTile(x, y) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
    if (inB(x + dx, y + dy)) paintGround(x + dx, y + dy);
}

function genMap(scx, scy) {
  scx = scx == null ? MW >> 1 : scx;
  scy = scy == null ? MH >> 1 : scy;
  currentBiome = pick(BIOMES);
  const b = currentBiome;
  tiles = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) tiles.push(mkTile(x, y));
  // río serpenteante con vados para cruzar
  if (b.river) {
    const fords = [ri(10, (MW >> 1) - 5), ri((MW >> 1) + 5, MW - 11)];
    let ry = ri(15, MH - 16);
    for (let x = 0; x < MW; x++) {
      ry = clamp(ry + ri(-1, 1), 3, MH - 5);
      if (fords.some(f => Math.abs(x - f) < 2)) continue;
      const w = 2 + (x % 7 === 0 ? 1 : 0);
      for (let dy = 0; dy < w; dy++) if (inB(x, ry + dy)) T(x, ry + dy).g = 'water';
    }
  }
  // lagunas (paseo aleatorio)
  for (let i = 0; i < b.lakes; i++) {
    let x = ri(6, MW - 7), y = ri(6, MH - 7);
    for (let j = 0; j < 70; j++) {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
        if (inB(x + dx, y + dy)) T(x + dx, y + dy).g = 'water';
      x = clamp(x + ri(-2, 2), 1, MW - 3);
      y = clamp(y + ri(-2, 2), 1, MH - 3);
    }
  }
  // bosques
  for (let i = 0; i < b.forests; i++) {
    const cx = ri(2, MW - 3), cy = ri(2, MH - 3);
    for (let j = 0; j < 20; j++) {
      const x = cx + ri(-3, 3), y = cy + ri(-3, 3);
      if (inB(x, y) && T(x, y).g === 'grass' && !T(x, y).o && Math.random() < 0.7)
        T(x, y).o = 'tree';
    }
  }
  // rocas (35% de los grupos tienen veta de hierro)
  for (let i = 0; i < b.rocks; i++) {
    const cx = ri(2, MW - 3), cy = ri(2, MH - 3);
    const iron = Math.random() < 0.35;
    for (let j = 0; j < 10; j++) {
      const x = cx + ri(-2, 2), y = cy + ri(-2, 2);
      if (inB(x, y) && T(x, y).g === 'grass' && !T(x, y).o) {
        T(x, y).o = 'rock';
        T(x, y).ore = iron && Math.random() < 0.8 ? 'iron' : null;
      }
    }
  }
  // arbustos de bayas
  for (let i = 0; i < b.berries; i++) {
    const t = T(ri(1, MW - 2), ri(1, MH - 2));
    if (t.g === 'grass' && !t.o) t.o = 'berry';
  }
  // fibra silvestre (en matas)
  for (let i = 0; i < b.fiberP; i++) {
    const cx = ri(2, MW - 3), cy = ri(2, MH - 3);
    for (let j = 0; j < 5; j++) {
      const x = cx + ri(-1, 1), y = cy + ri(-1, 1);
      if (inB(x, y) && T(x, y).g === 'grass' && !T(x, y).o) T(x, y).o = 'fiber';
    }
  }
  // hierba medicinal (matas chicas, más escasa)
  for (let i = 0; i < Math.ceil(b.fiberP * 0.45); i++) {
    const cx = ri(2, MW - 3), cy = ri(2, MH - 3);
    for (let j = 0; j < 3; j++) {
      const x = cx + ri(-1, 1), y = cy + ri(-1, 1);
      if (inB(x, y) && T(x, y).g === 'grass' && !T(x, y).o) T(x, y).o = 'herb';
    }
  }
  // despejar la zona donde se funda la colonia
  for (let dy = -4; dy <= 4; dy++) for (let dx = -6; dx <= 6; dx++) {
    const t = T(scx + dx, scy + dy);
    t.o = null; t.ore = null; t.g = 'grass';
  }
  // almacén inicial
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++)
    T(scx + 3 + dx, scy - 1 + dy).stock = true;
  repaintAll();
}

// ============================== PATHFINDING (BFS) ==============================
function bfsFrom(sx, sy) {
  const dist = new Int32Array(MW * MH).fill(-1);
  const prev = new Int32Array(MW * MH).fill(-1);
  const q = [idx(sx, sy)];
  dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MW, y = (i / MW) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inB(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (dist[ni] < 0 && walkable(tiles[ni])) {
        dist[ni] = dist[i] + 1; prev[ni] = i; q.push(ni);
      }
    }
  }
  return { dist, prev };
}
function buildPath(bfs, goal) {
  const p = [];
  let i = goal;
  while (i !== -1 && bfs.dist[i] > 0) {
    p.push({ x: i % MW, y: (i / MW) | 0 });
    i = bfs.prev[i];
  }
  p.reverse();
  return p;
}
// tile más cercano (alcanzable) que cumpla pred. standOn: hay que pararse encima; si no, al lado.
function nearestReach(bfs, pred, standOn) {
  let bd = Infinity, bt = null, bg = -1;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (!pred(t)) continue;
    if (standOn) {
      if (bfs.dist[i] >= 0 && bfs.dist[i] < bd) { bd = bfs.dist[i]; bt = t; bg = i; }
    } else {
      if (walkable(t) && bfs.dist[i] >= 0 && bfs.dist[i] < bd) { bd = bfs.dist[i]; bt = t; bg = i; }
      for (const [dx, dy] of DIRS) {
        const nx = t.x + dx, ny = t.y + dy;
        if (!inB(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (bfs.dist[ni] >= 0 && bfs.dist[ni] < bd && walkable(tiles[ni])) {
          bd = bfs.dist[ni]; bt = t; bg = ni;
        }
      }
    }
  }
  return bt ? { t: bt, goal: bg } : null;
}

// ============================== ANIMALES ==============================
function spawnAnimal(kind, x, y) {
  animals.push({ id: nextAnimalId++, kind, x: x * TW + 8, y: y * TW + 8, tx: x, ty: y,
    hp: ANIMALS[kind].hp, hunted: false, think: Math.random() * 3, target: null, flee: 0, fleeAng: 0 });
}
function spawnAnimalAtEdge() {
  for (let tries = 0; tries < 40; tries++) {
    const side = ri(0, 3);
    const x = side < 2 ? ri(1, MW - 2) : side === 2 ? 1 : MW - 2;
    const y = side === 0 ? 1 : side === 1 ? MH - 2 : ri(1, MH - 2);
    if (walkable(T(x, y))) { spawnAnimal(Math.random() < 0.6 ? 'rabbit' : 'deer', x, y); return; }
  }
}
function hitAnimal(c, a) {
  a.hp--;
  a.flee = 2;
  a.fleeAng = Math.atan2(a.y - c.y, a.x - c.x);
  addFloater(a.x, a.y - 6, '💥');
  sfxAt('thud', a.x, a.y);
  gainXp(c, 'hunt', 4);
  if (a.hp <= 0) {
    a.dead = true;
    addToInv(c, 'meat', ANIMALS[a.kind].meat);
    gainXp(c, 'hunt', 10);
  }
}
function updateAnimal(a, dt) {
  if (a.flee > 0) {
    a.flee -= dt;
    const sp = 88 * dt;
    const nx = a.x + Math.cos(a.fleeAng) * sp, ny = a.y + Math.sin(a.fleeAng) * sp;
    if (nx > 5 && ny > 5 && nx < MW * TW - 5 && ny < MH * TW - 5 && walkable(T((nx / TW) | 0, (ny / TW) | 0))) {
      a.x = nx; a.y = ny;
    } else a.fleeAng += 1.5;
    a.tx = (a.x / TW) | 0; a.ty = (a.y / TW) | 0;
    return;
  }
  if (a.target) {
    const dx = a.target.x - a.x, dy = a.target.y - a.y, d = Math.hypot(dx, dy);
    const sp = ANIMALS[a.kind].speed * dt;
    if (d <= sp) { a.x = a.target.x; a.y = a.target.y; a.target = null; }
    else { a.x += dx / d * sp; a.y += dy / d * sp; }
    a.tx = (a.x / TW) | 0; a.ty = (a.y / TW) | 0;
    return;
  }
  a.think -= dt;
  if (a.think <= 0) {
    a.think = 2 + Math.random() * 4;
    const nx = clamp(a.tx + ri(-2, 2), 1, MW - 2), ny = clamp(a.ty + ri(-2, 2), 1, MH - 2);
    if (walkable(T(nx, ny))) a.target = { x: nx * TW + 8, y: ny * TW + 8 };
  }
}

// ============================== EL PERRO DE LA COLONIA ==============================
function updateDog(dt) {
  const d = colonyDog;
  if (!d || !colonists.length) return;
  d.think -= dt;
  if (d.think <= 0) {
    d.think = 1.5 + Math.random() * 2;
    // seguir al colono más cercano
    let best = null, bd = 1e9;
    for (const c of colonists) {
      const q = Math.hypot(c.x - d.x, c.y - d.y);
      if (q < bd) { bd = q; best = c; }
    }
    if (best && bd > 3.5 * TW) {
      const tx = clamp(best.tx + ri(-1, 1), 1, MW - 2), ty = clamp(best.ty + ri(-1, 1), 1, MH - 2);
      if (walkable(T(tx, ty))) d.target = { x: tx * TW + 8, y: ty * TW + 8 };
    } else if (Math.random() < 0.4) {
      const tx = clamp(d.tx + ri(-2, 2), 1, MW - 2), ty = clamp(d.ty + ri(-2, 2), 1, MH - 2);
      if (walkable(T(tx, ty))) d.target = { x: tx * TW + 8, y: ty * TW + 8 };
    }
    if (Math.random() < 0.05) sfxAt('bark', d.x, d.y);
  }
  if (d.target) {
    const dx = d.target.x - d.x, dy = d.target.y - d.y, q = Math.hypot(dx, dy), sp = 52 * dt;
    if (q <= sp) { d.x = d.target.x; d.y = d.target.y; d.target = null; }
    else { d.x += dx / q * sp; d.y += dy / q * sp; }
    d.tx = (d.x / TW) | 0;
    d.ty = (d.y / TW) | 0;
  }
}

// ============================== MERCADER ==============================
function spawnTrader() {
  const base = colonists[0];
  if (!base) return;
  const bfs = bfsFrom(base.tx, base.ty);
  for (let tries = 0; tries < 60; tries++) {
    const side = ri(0, 3);
    const x = side < 2 ? ri(1, MW - 2) : side === 2 ? 1 : MW - 2;
    const y = side === 0 ? 1 : side === 1 ? MH - 2 : ri(1, MH - 2);
    if (bfs.dist[idx(x, y)] >= 0) {
      trader = { x: x * TW + 8, y: y * TW + 8, tx: x, ty: y, path: [], state: 'coming', say: null };
      const tb = bfsFrom(x, y);
      const nr = nearestReach(tb, t => t.stock, false) ||
                 nearestReach(tb, t => t.x === base.tx && t.y === base.ty, false);
      if (nr) trader.path = buildPath(tb, nr.goal);
      addLog('🧳 Llegó un <b>mercader</b> — ¡comerciá antes del atardecer!');
      sfx('horn');
      return;
    }
  }
}
function traderMove(tr, dt) {
  if (!tr.path.length) return true;
  const n = tr.path[0], px = n.x * TW + 8, py = n.y * TW + 8;
  const dx = px - tr.x, dy = py - tr.y, d = Math.hypot(dx, dy), step = 50 * dt;
  if (d <= step) { tr.x = px; tr.y = py; tr.tx = n.x; tr.ty = n.y; tr.path.shift(); }
  else { tr.x += dx / d * step; tr.y += dy / d * step; }
  if (tr.path.length && !walkable(T(tr.path[0].x, tr.path[0].y))) tr.path = [];
  return !tr.path.length;
}
function updateTrader(dt) {
  if (!trader) return;
  if (trader.say && gtime > trader.say.until) trader.say = null;
  if (trader.state === 'coming') {
    if (traderMove(trader, dt)) { trader.state = 'staying'; say(trader, pick(TRADER_LINES), 3); }
  } else if (trader.state === 'staying') {
    traderSay -= dt;
    if (traderSay <= 0) { traderSay = 14 + Math.random() * 10; say(trader, pick(TRADER_LINES), 3); }
    if (time > 0.72 && time < 0.8) {
      trader.state = 'leaving';
      say(trader, '¡Me voy! Hasta la próxima.', 3);
      addLog('🧳 El mercader se fue.');
      const tb = bfsFrom(trader.tx, trader.ty);
      let best = -1, bd = -1;
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        if ((t.x <= 1 || t.y <= 1 || t.x >= MW - 2 || t.y >= MH - 2) && tb.dist[i] >= 0 &&
            (bd < 0 || tb.dist[i] < bd)) { bd = tb.dist[i]; best = i; }
      }
      if (best >= 0) trader.path = buildPath(tb, best); else trader = null;
    }
  } else if (trader.state === 'leaving') {
    if (traderMove(trader, dt)) trader = null;
  }
}

// ============================== GUARDADO ==============================
function saveGame(silent) {
  if (gameOver) return;
  const data = {
    v: 11, day, time, gtime, nextId, nextTraderDay, resources, rels, msgs, story, coldSnapUntil,
    stats, goalIndex, goalAnnounced, goalAnnounceAt, researched, research,
    colonyDog: colonyDog ? { name: colonyDog.name, x: colonyDog.x, y: colonyDog.y } : null,
    cam: { x: cam.x, y: cam.y, z: cam.z },
    kin, grudges,
    tiles: tiles.map(t => [t.g, t.o, t.desig, t.stock ? 1 : 0, t.farm ? 1 : 0, t.crop,
      t.item ? [t.item.res, t.item.n] : 0, t.bp ? [t.bp.type, t.bp.paid ? 1 : 0] : 0, t.ore,
      t.fire > 0 ? Math.round(t.fire) : 0, t.scorched ? 1 : 0, t.floor ? 1 : 0]),
    colonists: colonists.map(c => ({ id: c.id, name: c.name, color: c.color, trait: c.trait,
      back: c.back, x: c.x, y: c.y, hunger: c.hunger, energy: c.energy, hp: c.hp, tool: c.tool,
      outfit: c.outfit, inv: c.inv, prio: c.prio, buffs: c.buffs, inspiredUntil: c.inspiredUntil,
      skills: c.skills, age: c.age, parents: c.parents, partner: c.partner,
      sick: c.sick, treatCd: c.treatCd })),
    animals: animals.filter(a => !a.dead).map(a => ({ kind: a.kind, x: a.x, y: a.y, hp: a.hp, hunted: a.hunted })),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    if (!silent) addLog('💾 Partida guardada.');
  } catch (e) { if (!silent) addLog('⚠️ No se pudo guardar.'); }
}
function loadGame() {
  let d;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
  if (!d || d.v !== 11) return false;
  day = d.day; time = d.time; gtime = d.gtime; nextId = d.nextId;
  nextTraderDay = d.nextTraderDay; resources = d.resources; rels = d.rels || {};
  msgs = d.msgs || [];
  story = d.story || [];
  coldSnapUntil = d.coldSnapUntil || 0;
  stats = d.stats || { harvested: 0, tools: 0 };
  goalIndex = d.goalIndex || 0;
  goalAnnounced = !!d.goalAnnounced;
  goalAnnounceAt = d.goalAnnounceAt || gtime + 30;
  kin = d.kin || {};
  grudges = d.grudges || {};
  researched = d.researched || {};
  research = d.research || { current: null, prog: {} };
  stats = Object.assign({ harvested: 0, tools: 0, everColonists: 0, deaths: 0 }, d.stats || {});
  colonyDog = d.colonyDog
    ? { name: d.colonyDog.name, x: d.colonyDog.x, y: d.colonyDog.y,
        tx: clamp((d.colonyDog.x / TW) | 0, 0, MW - 1), ty: clamp((d.colonyDog.y / TW) | 0, 0, MH - 1),
        target: null, think: 1 }
    : null;
  tiles = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const s = d.tiles[idx(x, y)];
    const t = mkTile(x, y);
    t.g = s[0]; t.o = s[1]; t.desig = s[2]; t.stock = !!s[3]; t.farm = !!s[4]; t.crop = s[5];
    t.item = s[6] ? { res: s[6][0], n: s[6][1] } : null;
    t.bp = s[7] ? { type: s[7][0], cost: BUILDS[s[7][0]].cost, paid: !!s[7][1] } : null;
    t.ore = s[8] || null;
    t.fire = s[9] || 0;
    t.scorched = !!s[10];
    t.floor = !!s[11];
    tiles.push(t);
  }
  fires = tiles.filter(t => t.fire > 0);
  roomsDirty = true;
  nextEventAt = gtime + (0.5 + Math.random() * 0.8) * DAY_LEN;
  colonists = d.colonists.map(c => ({ ...c,
    tx: clamp((c.x / TW) | 0, 0, MW - 1), ty: clamp((c.y / TW) | 0, 0, MH - 1),
    path: [], task: null, moving: false, think: Math.random() * 0.5, artTimer: 1,
    inv: c.inv || {}, outfit: !!c.outfit, prio: c.prio || defaultPrio(),
    skills: c.skills || defaultSkills(), age: c.age == null ? 6 : c.age,
    parents: c.parents || null, partner: c.partner || null,
    back: c.back || null, inspiredUntil: c.inspiredUntil || 0,
    sick: c.sick || null, treatCd: c.treatCd || 0, beingTreated: false,
    buffs: c.buffs || [], say: null, inConvo: false, convoCd: gtime + ri(4, 12) }));
  animals = [];
  for (const a of d.animals || []) {
    spawnAnimal(a.kind, clamp((a.x / TW) | 0, 0, MW - 1), clamp((a.y / TW) | 0, 0, MH - 1));
    const na = animals[animals.length - 1];
    na.hp = a.hp; na.hunted = a.hunted;
  }
  if (d.cam) { cam.x = d.cam.x; cam.y = d.cam.y; cam.z = d.cam.z; }
  document.getElementById('log').innerHTML = msgs.map(m => `<div>${m}</div>`).join('');
  repaintAll();
  return true;
}
function newGame() {
  if (!confirm('¿Empezar una partida nueva? Se borra la guardada.')) return;
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}
