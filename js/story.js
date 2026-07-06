'use strict';
// ============================== FUEGO ==============================
function flammable(t) {
  if (t.fire > 0) return false;
  if (['tree', 'berry', 'fiber', 'door', 'bed', 'table', 'taller', 'telar', 'farol'].includes(t.o)) return true;
  if (t.farm && t.crop !== null && t.crop > 0.15) return true;
  if (t.bp) return true;
  return false;
}
function igniteTile(t) {
  if (t.fire > 0 || !flammable(t)) return;
  t.fire = 9 + Math.random() * 5;
  t.fireTick = 2;
  fires.push(t);
}
function burnOut(t) {
  const hadDoor = t.o === 'door' || t.o === 'wall';
  if (['tree', 'berry', 'fiber', 'door', 'bed', 'table', 'taller', 'telar', 'farol'].includes(t.o)) {
    t.o = null;
    t.ore = null;
  }
  if (t.crop !== null) t.crop = null;
  if (t.bp) t.bp = null;
  t.desig = null;
  t.fire = 0;
  t.scorched = true;
  repaintTile(t.x, t.y);
  if (hadDoor) roomsDirty = true;
}
function updateFires(dt) {
  if (!fires.length) return;
  for (const t of fires) {
    t.fire -= dt;
    t.fireTick -= dt;
    if (t.fireTick <= 0) {
      t.fireTick = 2;
      const chance = season().id === 'winter' ? 0.10 : 0.22;
      for (const [dx, dy] of DIRS) {
        if (!inB(t.x + dx, t.y + dy)) continue;
        if (Math.random() < chance) igniteTile(T(t.x + dx, t.y + dy));
      }
    }
    if (t.fire <= 0) burnOut(t);
  }
  fires = fires.filter(t => t.fire > 0);
}

// ============================== INTERIORES ==============================
// un tile está "bajo techo" si su zona no llega al borde del mapa (cerrada con muros y puertas)
function computeRooms() {
  roomsDirty = false;
  const out = new Uint8Array(MW * MH);
  const pass = t => t.o !== 'wall' && t.o !== 'door';
  const q = [];
  const seed = i => { if (pass(tiles[i]) && !out[i]) { out[i] = 1; q.push(i); } };
  for (let x = 0; x < MW; x++) { seed(idx(x, 0)); seed(idx(x, MH - 1)); }
  for (let y = 0; y < MH; y++) { seed(idx(0, y)); seed(idx(MW - 1, y)); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MW, y = (i / MW) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inB(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (!out[ni] && pass(tiles[ni])) { out[ni] = 1; q.push(ni); }
    }
  }
  for (let i = 0; i < tiles.length; i++) tiles[i].indoor = !out[i] && pass(tiles[i]);
}

// ============================== METAS DE LA CRONISTA ==============================
const GOALS = [
  { desc: 'Dos camas bajo techo (muros y puerta)', reward: { wood: 15, food: 8 },
    prog: () => `${tiles.filter(t => t.o === 'bed' && t.indoor).length}/2`,
    done: () => tiles.filter(t => t.o === 'bed' && t.indoor).length >= 2,
    tale: 'Un techo propio: el primer paso para volver a ser un pueblo.' },
  { desc: 'Guardar comida para varios días (25 🍎)', reward: { gold: 8 },
    prog: () => `${Math.min(25, resources.food + resources.guiso * 3)}/25`,
    done: () => resources.food + resources.guiso * 3 >= 25,
    tale: 'Nadie pasa hambre en un pueblo de verdad.' },
  { desc: 'Una mesa y un fogón para comer caliente', reward: { food: 10 },
    prog: () => `${(tiles.some(t => t.o === 'table') ? 1 : 0) + (tiles.some(t => t.o === 'fogon') ? 1 : 0)}/2`,
    done: () => tiles.some(t => t.o === 'table') && tiles.some(t => t.o === 'fogon'),
    tale: 'Comida caliente compartida: eso es un hogar.' },
  { desc: 'Ropa tejida para 3 colonos', reward: { fiber: 8, gold: 5 },
    prog: () => `${colonists.filter(c => c.outfit).length}/3`,
    done: () => colonists.filter(c => c.outfit).length >= 3,
    tale: 'El invierno vendrá. Los abrigados lo contarán.' },
  { desc: 'Cosechar 10 cultivos', reward: { food: 10 },
    prog: () => `${Math.min(10, stats.harvested)}/10`,
    done: () => stats.harvested >= 10,
    tale: 'La tierra ya reconoce sus manos.' },
  { desc: 'Fabricar 2 herramientas en el taller', reward: { iron: 4 },
    prog: () => `${Math.min(2, stats.tools)}/2`,
    done: () => stats.tools >= 2,
    tale: 'Buenas herramientas, buen futuro.' },
  { desc: 'Ser 6 colonos', reward: { gold: 10 },
    prog: () => `${colonists.length}/6`,
    done: () => colonists.length >= 6,
    tale: 'Las voces se multiplican: esto ya es un pueblo.' },
  { desc: 'Levantar una estatua en la plaza', reward: { gold: 8 },
    prog: () => `${tiles.some(t => t.o === 'statue') ? 1 : 0}/1`,
    done: () => tiles.some(t => t.o === 'statue'),
    tale: 'El arte solo florece donde sobra el pan.' },
  { desc: 'Juntar 40 de oro comerciando', reward: { tools: 1, ropa: 1 },
    prog: () => `${Math.min(40, resources.gold)}/40`,
    done: () => resources.gold >= 40,
    tale: 'Los mercaderes ya hablan de este lugar.' },
  { desc: 'Sobrevivir un año entero', reward: { gold: 25 },
    prog: () => `${Math.min(day, SEASON_DAYS * 4 + 1)}/${SEASON_DAYS * 4 + 1}`,
    done: () => day > SEASON_DAYS * 4,
    tale: 'Un año. Cuatro estaciones. Una leyenda que recién empieza.' },
];
let goalTimer = 0;
function goalTick(dt) {
  if (gameOver || goalIndex >= GOALS.length) return;
  goalTimer -= dt;
  if (goalTimer > 0) return;
  goalTimer = 1;
  const g = GOALS[goalIndex];
  if (!goalAnnounced) {
    if (gtime >= goalAnnounceAt) {
      goalAnnounced = true;
      addStory(`🎯 La Cronista propone: <b>${g.desc}</b>. <i>${g.tale}</i>`);
      showEventModal('🎯', 'La Cronista propone', `<b>${g.desc}</b><br><i>"${g.tale}"</i>`);
      sfx('event');
    }
    return;
  }
  if (g.done()) {
    for (const r in g.reward) resources[r] += g.reward[r];
    const rtxt = Object.entries(g.reward).map(([r, n]) => `+${n}${RES_EMOJI[r]}`).join(' ');
    addStory(`✅ Meta cumplida: <b>${g.desc}</b> (${rtxt}). <i>${g.tale}</i>`);
    showEventModal('✅', '¡Meta cumplida!', `<b>${g.desc}</b><br>Recompensa: ${rtxt}<br><i>"${g.tale}"</i>`);
    for (const c of colonists) addBuff(c, 'Meta cumplida 🎯', 8, 150);
    sfx('level');
    goalIndex++;
    goalAnnounced = false;
    goalAnnounceAt = gtime + 60;
    if (goalIndex >= GOALS.length)
      addStory('🏆 La Cronista cierra el capítulo: esta colonia ya es leyenda. Lo que venga, lo escribirán ustedes.');
  }
}

// ============================== LA CRONISTA (narradora de eventos) ==============================
const NARRATOR_EVENTS = [
  { id: 'herd', kind: 'good',
    can: () => animals.length < 20,
    run() {
      for (let tries = 0; tries < 40; tries++) {
        const side = ri(0, 3);
        const x = side < 2 ? ri(5, MW - 6) : side === 2 ? 2 : MW - 3;
        const y = side === 0 ? 2 : side === 1 ? MH - 3 : ri(5, MH - 6);
        if (!walkable(T(x, y))) continue;
        for (let j = 0; j < 5; j++) {
          const ax = clamp(x + ri(-2, 2), 1, MW - 2), ay = clamp(y + ri(-2, 2), 1, MH - 2);
          if (walkable(T(ax, ay))) {
            spawnAnimal('deer', ax, ay);
            // entran galopando hacia el interior del mapa
            const a = animals[animals.length - 1];
            a.flee = 3 + Math.random() * 2;
            a.fleeAng = Math.atan2(MH * TW / 2 - a.y, MW * TW / 2 - a.x) + (Math.random() - 0.5) * 0.6;
          }
        }
        return '🦌 Una manada de ciervos cruza la región. ¡Buena caza!';
      }
      return null;
    } },
  { id: 'bloom', kind: 'good',
    can: () => season().id !== 'winter',
    run() {
      let n = 0;
      for (let i = 0; i < 40 && n < 12; i++) {
        const t = T(clamp((MW >> 1) + ri(-22, 22), 1, MW - 2), clamp((MH >> 1) + ri(-16, 16), 1, MH - 2));
        if (t.g === 'grass' && !t.o && !t.farm && !t.stock && !t.bp) {
          t.o = Math.random() < 0.5 ? 'berry' : 'fiber';
          n++;
        }
      }
      return '🌺 El bosque floreció: brotaron bayas y fibra cerca de la colonia.';
    } },
  { id: 'gift', kind: 'good',
    can: () => true,
    run() {
      const r = pick(['wood', 'food', 'stone', 'gold']);
      const n = r === 'gold' ? ri(6, 12) : ri(10, 20);
      resources[r] += n;
      const st = tiles.find(t => t.stock);
      if (st) addEffect({ kind: 'sparkle', x: st.x * TW + 8, y: st.y * TW + 8, dur: 2 });
      return `🎁 Un viajero agradecido dejó un regalo: +${n} ${RES_EMOJI[r]}.`;
    } },
  { id: 'inspire', kind: 'good',
    can: () => colonists.some(c => stageOf(c) === 'adult'),
    run() {
      const c = pick(colonists.filter(x => stageOf(x) === 'adult'));
      c.inspiredUntil = gtime + DAY_LEN * 0.5;
      addBuff(c, 'Inspirado/a ✨', 12, DAY_LEN * 0.5);
      say(c, '¡Hoy me sale todo!', 3);
      addEffect({ kind: 'stars', cid: c.id, dur: 6 });
      return `✨ ${c.name} amaneció inspirado/a: trabaja al doble por medio día.`;
    } },
  { id: 'trader', kind: 'good',
    can: () => !trader && colonists.length > 0,
    run() {
      spawnTrader();
      nextTraderDay = day + 3 + ri(0, 1);
      return null;      // spawnTrader ya avisa
    } },
  { id: 'fire', kind: 'bad',
    can: () => tiles.some(t => t.o === 'tree' && !t.indoor),
    run() {
      const trees = tiles.filter(t => t.o === 'tree');
      const t = pick(trees);
      igniteTile(t);
      for (const [dx, dy] of DIRS)
        if (inB(t.x + dx, t.y + dy) && Math.random() < 0.5) igniteTile(T(t.x + dx, t.y + dy));
      addEffect({ kind: 'bolt', x: t.x * TW + 8, y: t.y * TW + 8, dur: 0.7 });
      sfx('fire');
      return '⚡ ¡Un rayo seco encendió el bosque! Los colonos corren a apagarlo.';
    } },
  { id: 'coldsnap', kind: 'bad',
    can: () => season().id !== 'winter' && gtime >= coldSnapUntil,
    run() {
      coldSnapUntil = gtime + DAY_LEN;
      addEffect({ kind: 'frost', dur: 5 });
      return '🥶 Ola de frío repentina: un día entero de heladas. ¡Abríguense o prendan fogatas!';
    } },
  { id: 'blight', kind: 'bad',
    can: () => tiles.some(t => t.farm && t.crop !== null && t.crop > 0.2),
    run() {
      let n = 0, where = null;
      for (const t of tiles) {
        if (n >= 6) break;
        if (t.farm && t.crop !== null && t.crop > 0.2 && Math.random() < 0.5) {
          t.crop = null;
          n++;
          where = where || t;
        }
      }
      if (where) addEffect({ kind: 'bugs', x: where.x * TW + 8, y: where.y * TW + 8, dur: 4 });
      return `🐛 Una plaga arrasó ${n} cultivos. Habrá que resembrar.`;
    } },
  { id: 'fox', kind: 'bad',
    can: () => resources.food > 8 && tiles.some(t => t.stock),
    run() {
      const n = Math.min(resources.food, ri(5, 9));
      resources.food -= n;
      // el zorro entra corriendo desde el borde, roba y se escapa
      const st = tiles.find(t => t.stock);
      const to = { x: st.x * TW + 8, y: st.y * TW + 8 };
      const edges = [{ x: to.x, y: 6 }, { x: to.x, y: MH * TW - 6 }, { x: 6, y: to.y }, { x: MW * TW - 6, y: to.y }];
      let from = edges[0];
      for (const e of edges)
        if (Math.hypot(e.x - to.x, e.y - to.y) < Math.hypot(from.x - to.x, from.y - to.y)) from = e;
      addEffect({ kind: 'fox', from, to, n, grabbed: false, dur: 8 });
      return `🦊 Un zorro se metió al almacén y robó ${n} de comida. ¡Ahí va!`;
    } },
  { id: 'blues', kind: 'bad',
    can: () => colonists.some(c => stageOf(c) === 'adult'),
    run() {
      const c = pick(colonists.filter(x => stageOf(x) === 'adult'));
      addBuff(c, 'Nostalgia 😔', -12, 200);
      say(c, 'Extraño mi vida de antes...', 3);
      addEffect({ kind: 'cloud', cid: c.id, dur: 6 });
      return `😔 ${c.name} amaneció con nostalgia de su vida anterior.`;
    } },
];

const EV_META = {
  herd:     ['🦌', 'Manada a la vista'],
  bloom:    ['🌺', 'El bosque florece'],
  gift:     ['🎁', 'Un regalo inesperado'],
  inspire:  ['✨', 'Inspiración'],
  trader:   ['🛒', 'Mercader'],
  fire:     ['⚡', '¡Tormenta seca!'],
  coldsnap: ['🥶', 'Ola de frío'],
  blight:   ['🐛', 'Plaga en los cultivos'],
  fox:      ['🦊', 'Ladrón nocturno'],
  blues:    ['😔', 'Nostalgia'],
};
function narratorTick() {
  if (gameOver || day < 2 || gtime < nextEventAt) return;
  nextEventAt = gtime + (0.6 + Math.random() * 0.9) * DAY_LEN;
  // si la colonia va bien, la Cronista desafía; si sufre, ayuda
  const challenge = Math.random() < 0.2 + colonyHealth() * 0.5;
  const pool = NARRATOR_EVENTS.filter(e =>
    e.kind === (challenge ? 'bad' : 'good') && e.id !== lastEventId && e.can());
  if (!pool.length) return;
  const ev = pick(pool);
  lastEventId = ev.id;
  const msg = ev.run();
  if (msg) {
    addStory('📜 ' + msg);
    const [ic, tt] = EV_META[ev.id] || ['📜', 'Sucede algo'];
    showEventModal(ic, tt, msg);
    sfx('event');
  }
}
