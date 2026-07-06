'use strict';
// ============================== COLONOS ==============================
function defaultPrio() {
  const p = {};
  for (const c of PRIO_CATS) p[c.id] = 2;
  return p;
}
function defaultSkills() {
  const s = {};
  for (const k of SKILLS) s[k.id] = { lv: ri(0, 3), xp: 0 };
  return s;
}
function backstoryOf(c) {
  return BACKSTORIES.find(b => b.id === c.back) || BACKSTORY_BABY;
}
function randomName() {
  const used = new Set(colonists.map(c => c.name));
  const free = NAMES.filter(n => !used.has(n));
  return free.length ? pick(free) : pick(NAMES) + ' II';
}
function randomColor() {
  const used = new Set(colonists.map(c => c.color));
  const free = PAWN_COLORS.filter(n => !used.has(n));
  return free.length ? pick(free) : pick(PAWN_COLORS);
}
function spawnColonist(x, y) {
  const back = pick(BACKSTORIES);
  const c = {
    id: nextId++,
    name: randomName(),
    color: randomColor(),
    trait: pick(TRAIT_KEYS),
    back: back.id,
    x: x * TW + TW / 2, y: y * TW + TW / 2, tx: x, ty: y,
    path: [], task: null, inv: {}, tool: false, outfit: false,
    prio: defaultPrio(), skills: defaultSkills(),
    age: 6 + ri(0, 20), parents: null, partner: null, inspiredUntil: 0,
    hunger: 90 + ri(0, 10), energy: 80 + ri(0, 20), hp: 100,
    think: Math.random() * 0.5, artTimer: Math.random() * 3,
    buffs: [], say: null, inConvo: false, convoCd: gtime + ri(4, 12),
  };
  // el pasado deja marcas: +3 a su oficio, y trabajos que evita
  if (back.skill) c.skills[back.skill].lv = Math.min(10, c.skills[back.skill].lv + 3);
  if (back.ban) c.prio[back.ban] = 0;
  colonists.push(c);
  stats.everColonists++;
  if ([5, 8, 10].includes(colonists.length))
    addStory(`👥 La colonia ya cuenta con ${colonists.length} miembros.`);
  return c;
}
function spawnBaby(a, b) {
  const nb = spawnColonist(a.tx, a.ty);
  nb.age = 0;
  nb.parents = [a.id, b.id];
  nb.back = 'nacido';
  nb.prio = defaultPrio();
  for (const k of SKILLS) nb.skills[k.id] = { lv: 0, xp: 0 };
  return nb;
}

// vínculos de origen entre los fundadores: nadie llega solo a un lugar así
function generateBonds() {
  const bonds = [];
  let coupleUsed = false;
  for (let i = 0; i < colonists.length; i++) for (let j = i + 1; j < colonists.length; j++) {
    const a = colonists[i], b = colonists[j];
    const k = relKey(a, b);
    const r = Math.random();
    if (r < 0.12 && !coupleUsed && stageOf(a) === 'adult' && stageOf(b) === 'adult') {
      coupleUsed = true;
      a.partner = b.id; b.partner = a.id;
      rels[k] = 8;
      bonds.push(`💕 <b>${a.name}</b> y <b>${b.name}</b> despertaron de la mano: son pareja, de eso sí se acuerdan.`);
    } else if (r < 0.28) {
      kin[k] = 1;
      rels[k] = 5;
      bonds.push(`👫 <b>${a.name}</b> y <b>${b.name}</b> son hermanos: solo se tienen el uno al otro.`);
    } else if (r < 0.48) {
      rels[k] = 4;
      bonds.push(`🤝 <b>${a.name}</b> y <b>${b.name}</b> eran amigos en un pueblo que ya no existe.`);
    } else if (r < 0.62) {
      grudges[k] = 1;
      bonds.push(`⚡ <b>${a.name}</b> y <b>${b.name}</b> se conocían de antes... y no se soportan.`);
    } else {
      bonds.push(`❔ <b>${a.name}</b> y <b>${b.name}</b> jamás se habían visto.`);
    }
  }
  return bonds;
}

function equipTool(c) {
  if (!c.tool && resources.tools > 0) { c.tool = true; resources.tools--; }
}

function startTask(c, bfs, type, nr, workTime, paidCost) {
  c.task = { type, x: nr.t.x, y: nr.t.y, workLeft: workTime, workTotal: workTime, phase: 'go' };
  if (paidCost) { pay(paidCost); c.task.paidCost = paidCost; }
  if (['build','chop','mine','harvest','harvestCrop','sow','cook','craft'].includes(type)) equipTool(c);
  c.path = buildPath(bfs, nr.goal);
  return true;
}

function abandonTask(c) {
  if (c.task) {
    if (c.task.paidCost) refund(c.task.paidCost);
    if (c.task.type === 'treat') {
      const p = colonists.find(x => x.id === c.task.target);
      if (p) p.beingTreated = false;
    }
    const t = inB(c.task.x, c.task.y) ? T(c.task.x, c.task.y) : null;
    if (t && t.rsv === c.id) t.rsv = null;
  }
  c.task = null;
  c.path = [];
}

function dropItem(t, res, n) {
  if (t.stock) {                                          // cae en almacén: se guarda directo
    resources[res] += n;
    addFloater(t.x * TW + TW / 2, t.y * TW, `+${n} ${RES_EMOJI[res]}`);
    return;
  }
  if (t.item && t.item.res === res) { t.item.n += n; return; }
  if (!t.item) { t.item = { res, n }; return; }
  for (const [dx, dy] of DIRS) {                          // tile ocupado: buscar vecino libre
    if (!inB(t.x + dx, t.y + dy)) continue;
    const nt = T(t.x + dx, t.y + dy);
    if (walkable(nt) && (!nt.item || nt.item.res === res || nt.stock)) { dropItem(nt, res, n); return; }
  }
  t.item.n += n;                                          // sin lugar: mezclar igual
}

// ============================== TRABAJOS (por prioridad) ==============================
function tryDeposit(c, bfs) {
  if (invTotal(c) <= 0 || !anyStock()) return false;
  const nr = nearestReach(bfs, t => t.stock, true);
  if (!nr) return false;
  c.task = { type: 'deposit', x: nr.t.x, y: nr.t.y, phase: 'go', workLeft: 0, workTotal: 0 };
  c.path = buildPath(bfs, nr.goal);
  return true;
}
function tryBuild(c, bfs) {
  const nr = nearestReach(bfs, t => t.bp && t.rsv === null && (t.bp.paid || canAfford(t.bp.cost)), false);
  if (!nr) return false;
  if (!nr.t.bp.paid) { pay(nr.t.bp.cost); nr.t.bp.paid = true; }
  nr.t.rsv = c.id;
  return startTask(c, bfs, 'build', nr, BUILDS[nr.t.bp.type].work);
}
function tryFarm(c, bfs) {
  let nr = nearestReach(bfs, t => t.farm && t.crop !== null && t.crop >= 1 && t.rsv === null, true);
  if (nr) { nr.t.rsv = c.id; return startTask(c, bfs, 'harvestCrop', nr, 2); }
  nr = nearestReach(bfs, t => t.farm && t.crop === null && !t.bp && t.rsv === null, true);
  if (nr) { nr.t.rsv = c.id; return startTask(c, bfs, 'sow', nr, 2); }
  return false;
}
function tryCook(c, bfs) {
  if (resources.guiso >= colonists.length) return false;
  const recipe = (resources.meat >= 1 && resources.food >= 1) ? { meat: 1, food: 1 }
               : (resources.fish >= 1 && resources.food >= 1) ? { fish: 1, food: 1 }
               : (resources.food >= 6) ? { food: 3 } : null;
  if (!recipe || !canAfford(recipe)) return false;
  const nr = nearestReach(bfs, t => t.o === 'fogon' && t.rsv === null, false);
  if (!nr) return false;
  nr.t.rsv = c.id;
  return startTask(c, bfs, 'cook', nr, 4, recipe);
}
function tryCraft(c, bfs) {
  // herramientas en el taller
  if (canAfford({ wood: 2, iron: 1 }) && resources.tools < colonists.filter(o => !o.tool).length) {
    const nr = nearestReach(bfs, t => t.o === 'taller' && t.rsv === null, false);
    if (nr) {
      nr.t.rsv = c.id;
      startTask(c, bfs, 'craft', nr, 5, { wood: 2, iron: 1 });
      c.task.product = 'tools';
      return true;
    }
  }
  // medicina en el taller (requiere investigación)
  if (researched.medicina && canAfford({ herb: 2 }) && resources.medicina < 4) {
    const nr = nearestReach(bfs, t => t.o === 'taller' && t.rsv === null, false);
    if (nr) {
      nr.t.rsv = c.id;
      startTask(c, bfs, 'craft', nr, 4, { herb: 2 });
      c.task.product = 'medicina';
      return true;
    }
  }
  // ropa en el telar (con Telares mejorados cuesta menos)
  const ropaCost = { fiber: researched.textil ? 3 : 4 };
  if (canAfford(ropaCost) && resources.ropa < colonists.filter(o => !o.outfit).length) {
    const nr = nearestReach(bfs, t => t.o === 'telar' && t.rsv === null, false);
    if (nr) {
      nr.t.rsv = c.id;
      startTask(c, bfs, 'craft', nr, 5, ropaCost);
      c.task.product = 'ropa';
      return true;
    }
  }
  return false;
}
function tryResearch(c, bfs) {
  if (!research.current || researched[research.current]) return false;
  const nr = nearestReach(bfs, t => t.o === 'desk' && t.rsv === null, false);
  if (!nr) return false;
  nr.t.rsv = c.id;
  return startTask(c, bfs, 'research', nr, 4);
}
function tryMedic(c, bfs) {
  if (resources.medicina < 1) return false;
  const patient = colonists.find(p => p !== c && !p.dead && p.sick && p.sick.severity > 0.2 &&
    (p.treatCd || 0) <= gtime && !p.beingTreated);
  if (!patient) return false;
  const nr = nearestReach(bfs, t => t.x === patient.tx && t.y === patient.ty, false);
  if (!nr) return false;
  patient.beingTreated = true;
  c.task = { type: 'treat', target: patient.id, x: patient.tx, y: patient.ty,
             workLeft: 2, workTotal: 2, phase: 'go' };
  c.path = buildPath(bfs, nr.goal);
  return true;
}
function tryGather(c, bfs) {
  const nr = nearestReach(bfs, t => t.desig !== null && t.rsv === null, false);
  if (!nr) return false;
  nr.t.rsv = c.id;
  const wt = nr.t.desig === 'mine' ? 4 : nr.t.desig === 'chop' ? 3 : 2;
  return startTask(c, bfs, nr.t.desig, nr, wt);
}
function tryHunt(c, bfs) {
  let best = null, bd = 1e9;
  for (const a of animals) {
    if (a.dead || !a.hunted) continue;
    const d = Math.abs(a.tx - c.tx) + Math.abs(a.ty - c.ty);
    if (d < bd) { bd = d; best = a; }
  }
  if (best) {
    c.task = { type: 'hunt', target: best.id, x: best.tx, y: best.ty, phase: 'go', workLeft: 0, workTotal: 0 };
    return true;
  }
  // sin presas marcadas: a pescar al muelle (hasta tener una buena reserva)
  if (resources.fish < colonists.length * 2) {
    const nr = nearestReach(bfs, t => t.o === 'pier' && t.rsv === null, true);
    if (nr) { nr.t.rsv = c.id; return startTask(c, bfs, 'fish', nr, 6); }
  }
  return false;
}
function tryHaul(c, bfs) {
  if (!anyStock() || invTotal(c) >= INV_CAP) return false;
  const nr = nearestReach(bfs, t => t.item && !t.stock && t.rsv === null, true);
  if (!nr) return false;
  nr.t.rsv = c.id;
  return startTask(c, bfs, 'haul', nr, 0);
}
const JOBFNS = {
  medic: tryMedic, build: tryBuild, farm: tryFarm, cook: tryCook, craft: tryCraft,
  research: tryResearch, gather: tryGather, hunt: tryHunt, haul: tryHaul,
};

// -------- búsqueda de trabajo --------
function findTask(c) {
  const bfs = bfsFrom(c.tx, c.ty);
  const stage = stageOf(c);
  let nr;
  // equiparse ropa si hay
  if (!c.outfit && resources.ropa > 0) { c.outfit = true; resources.ropa--; }
  // 0. mochila llena → depositar
  if (invTotal(c) >= INV_CAP && tryDeposit(c, bfs)) return true;
  // 1. hambre
  if (c.hunger < 35) {
    if ((c.inv.food || 0) > 0 || (c.inv.meat || 0) > 0) {
      c.task = { type: 'eatInv', x: c.tx, y: c.ty, workLeft: 1.2, workTotal: 1.2, phase: 'work' };
      return true;
    }
    if (resources.food >= 1 || resources.guiso >= 1 || resources.meat >= 1) {
      nr = nearestReach(bfs, t => t.stock, true);
      if (nr) return startTask(c, bfs, 'eat', nr, 1.2);
      c.task = { type: 'eatHere', x: c.tx, y: c.ty, workLeft: 1.2, workTotal: 1.2, phase: 'work' };
      return true;
    }
    nr = nearestReach(bfs, t => t.o === 'berry' && t.rsv === null, false);
    if (nr) { nr.t.rsv = c.id; return startTask(c, bfs, 'eatBerry', nr, 1.5); }
  }
  // 1b. enfermo grave → a reposar (enfermería primero)
  if (c.sick && c.sick.severity > 0.35) {
    nr = nearestReach(bfs, t => t.o === 'medbed' && t.rsv === null, true) ||
         nearestReach(bfs, t => t.o === 'bed' && t.rsv === null, true);
    if (nr) { nr.t.rsv = c.id; return startTask(c, bfs, 'sleep', nr, 0); }
  }
  // 2. sueño
  if (c.energy < 22 || (isNight() && c.energy < 65)) {
    nr = nearestReach(bfs, t => (t.o === 'bed' || t.o === 'medbed') && t.rsv === null, true);
    if (nr) { nr.t.rsv = c.id; return startTask(c, bfs, 'sleep', nr, 0); }
    c.task = { type: 'sleepHere', x: c.tx, y: c.ty, phase: 'work', workLeft: 0, workTotal: 0 };
    return true;
  }
  // 2b. ¡fuego! todos menos los bebés corren a apagarlo
  if (fires.length && stage !== 'baby') {
    nr = nearestReach(bfs, t => t.fire > 0 && t.rsv === null, false);
    if (nr) { nr.t.rsv = c.id; return startTask(c, bfs, 'extinguish', nr, 1.5); }
  }
  // 3. los bebés siguen a sus papás en vez de trabajar
  if (stage === 'baby') {
    const par = colonists.find(p => c.parents && (p.id === c.parents[0] || p.id === c.parents[1]) && !p.dead);
    if (par && Math.hypot(c.x - par.x, c.y - par.y) > 4 * TW) {
      nr = nearestReach(bfs, t => t.x === par.tx && t.y === par.ty, false);
      if (nr) {
        c.task = { type: 'follow', x: par.tx, y: par.ty, phase: 'go', workLeft: 0, workTotal: 0 };
        c.path = buildPath(bfs, nr.goal);
        return true;
      }
    }
  } else {
    // trabajos según las prioridades del colono (1 = alta, 2 = normal, 3 = baja, 0 = nunca)
    // los niños solo acarrean
    for (let p = 1; p <= 3; p++) {
      for (const cat of PRIO_CATS) {
        if (stage === 'child' && cat.id !== 'haul') continue;
        if (c.prio[cat.id] !== p) continue;
        if (JOBFNS[cat.id](c, bfs)) return true;
      }
    }
    // 4. depositar lo que quede en la mochila
    if (invTotal(c) > 0 && tryDeposit(c, bfs)) return true;
  }
  // 5. de noche, juntarse a la fogata
  if (isNight() && c.energy > 40) {
    nr = nearestReach(bfs, t => t.o === 'fogata', false);
    if (nr) {
      const spots = DIRS.map(([dx, dy]) => [nr.t.x + dx, nr.t.y + dy])
        .filter(([x, y]) => inB(x, y) && walkable(T(x, y)) && bfs.dist[idx(x, y)] >= 0);
      if (spots.length) {
        const [sx, sy] = pick(spots);
        c.task = { type: 'campfire', x: nr.t.x, y: nr.t.y, phase: 'go', workLeft: 0, workTotal: 0 };
        c.path = buildPath(bfs, idx(sx, sy));
        return true;
      }
    }
  }
  // 6. buscar compañía para charlar
  if (colonists.length > 1 && c.convoCd <= gtime && Math.random() < 0.4) {
    const others = colonists.filter(o => o !== c && !o.dead && !isSleeping(o) && !o.inConvo);
    if (others.length) {
      const o = others[ri(0, others.length - 1)];
      nr = nearestReach(bfs, t => t.x === o.tx && t.y === o.ty, false);
      if (nr) {
        c.task = { type: 'social', x: o.tx, y: o.ty, phase: 'go', workLeft: 0, workTotal: 0, target: o.id };
        c.path = buildPath(bfs, nr.goal);
        return true;
      }
    }
  }
  // 7. deambular
  if (Math.random() < 0.25) {
    const x = clamp(c.tx + ri(-5, 5), 0, MW - 1), y = clamp(c.ty + ri(-5, 5), 0, MH - 1);
    const i = idx(x, y);
    if (bfs.dist[i] > 0 && walkable(tiles[i])) {
      c.task = { type: 'wander', x, y, phase: 'go', workLeft: 0, workTotal: 0 };
      c.path = buildPath(bfs, i);
      return true;
    }
  }
  return false;
}

// -------- movimiento --------
function moveAlong(c, dt) {
  if (!c.path.length) return true;
  const n = c.path[0], px = n.x * TW + TW / 2, py = n.y * TW + TW / 2;
  let spd = stageOf(c) === 'baby' ? 30 : stageOf(c) === 'child' ? 46 : 58;
  if (T(c.tx, c.ty).floor) spd *= 1.25;               // el piso de tablas acelera
  const dx = px - c.x, dy = py - c.y, d = Math.hypot(dx, dy), step = spd * dt;
  if (d <= step) {
    c.x = px; c.y = py; c.tx = n.x; c.ty = n.y; c.path.shift();
  } else {
    c.x += dx / d * step; c.y += dy / d * step;
  }
  if (c.path.length && !walkable(T(c.path[0].x, c.path[0].y))) { abandonTask(c); return false; }
  return !c.path.length;
}

// -------- ejecución de tareas --------
function nearTable(c) {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
    if (inB(c.tx + dx, c.ty + dy) && T(c.tx + dx, c.ty + dy).o === 'table') return true;
  return false;
}
function nearChair(c) {
  for (const [dx, dy] of [[0, 0], ...DIRS])
    if (inB(c.tx + dx, c.ty + dy) && T(c.tx + dx, c.ty + dy).o === 'chair') return true;
  return false;
}
function eatFromStock(c) {
  if (resources.guiso >= 1) {
    resources.guiso--;
    c.hunger = 100;
    addBuff(c, 'Comí guiso 🍲', 8, 120);
  } else if (resources.food >= 1) {
    const eaten = Math.min(2, resources.food);
    resources.food -= eaten;
    c.hunger = clamp(c.hunger + eaten * 45, 0, 100);
    addBuff(c, 'Comí bien 🍎', 4, 90);
  } else if (resources.fish >= 1) {
    const eaten = Math.min(2, resources.fish);
    resources.fish -= eaten;
    c.hunger = clamp(c.hunger + eaten * 40, 0, 100);
    addBuff(c, 'Pescado crudo 🐟', -3, 90);
  } else if (resources.meat >= 1) {
    const eaten = Math.min(2, resources.meat);
    resources.meat -= eaten;
    c.hunger = clamp(c.hunger + eaten * 40, 0, 100);
    addBuff(c, 'Carne cruda 🍖', -4, 90);
  }
  if (nearTable(c)) addBuff(c, 'Comí en la mesa 🍽️', 4, 90);
  if (nearChair(c)) addBuff(c, 'Comí sentado 🪑', 2, 90);
  const rb = roomBeautyAt(T(c.tx, c.ty));
  if (rb >= 8) addBuff(c, 'Comedor precioso 🖼️', 4, 90);
  if (Math.random() < 0.4) say(c, pick(CHAT.food), 2.2);
}

const WORK_SFX = { chop:'chop', mine:'mine', build:'build', cook:'cook', craft:'craft',
                   harvest:'harvest', harvestCrop:'harvest', eat:'eat', eatHere:'eat', eatInv:'eat',
                   fish:'splash' };
function finishWork(c, t) {
  const k = c.task.type;
  if (t && t.rsv === c.id) t.rsv = null;
  if (SKILL_OF_TASK[k]) gainXp(c, SKILL_OF_TASK[k], 8);
  if (WORK_SFX[k]) sfxAt(WORK_SFX[k], c.x, c.y);
  switch (k) {
    case 'chop':
      t.o = null; t.desig = null;
      addToInv(c, 'wood', 6);
      break;
    case 'mine':
      if (t.ore === 'iron') { addToInv(c, 'iron', 3); addToInv(c, 'stone', 1); }
      else addToInv(c, 'stone', 5);
      t.o = null; t.ore = null; t.desig = null;
      break;
    case 'harvest':
      addToInv(c, t.o === 'fiber' ? 'fiber' : t.o === 'herb' ? 'herb' : 'food',
               t.o === 'herb' ? 2 : 3);
      t.o = null; t.desig = null;
      break;
    case 'eatBerry':
      t.o = null; t.desig = null;
      c.hunger = clamp(c.hunger + 60, 0, 100);
      addBuff(c, 'Comí bayas crudas 🫐', -3, 80);
      break;
    case 'build':
      if (t.bp) {
        const type = t.bp.type;
        t.bp = null;
        if (type === 'floor') {                       // el piso es suelo, no un objeto
          t.floor = true;
          repaintTile(t.x, t.y);
          break;
        }
        if (!tiles.some(q => q.o === type))
          addStory(`🔨 Se construyó ${type === 'statue' ? 'la primera' : 'el primer'} ${BUILDS[type].name.toLowerCase()} de la colonia.`);
        t.o = type;
        if (t.o === 'wall') { t.farm = false; t.stock = false; }
        if (t.o === 'chest') t.stock = true;          // el baúl es un mini-almacén
        if (t.o === 'wall' || t.o === 'door') roomsDirty = true;
      }
      break;
    case 'extinguish':
      t.fire = 0;
      fires = fires.filter(q => q !== t);
      sfxAt('douse', c.x, c.y);
      break;
    case 'sow':         t.crop = 0.001; break;
    case 'harvestCrop':
      t.crop = null;
      addToInv(c, 'food', researched.agricultura ? 4 : 3);
      stats.harvested++;
      break;
    case 'fish':
      addToInv(c, 'fish', ri(1, 2));
      break;
    case 'research': {
      const tech = TECHS.find(x => x.id === research.current);
      if (tech && !researched[tech.id]) {
        research.prog[tech.id] = (research.prog[tech.id] || 0) + 6 + skillLv(c, 'research');
        addFloater(c.x, c.y - 10, '+📚');
        if (research.prog[tech.id] >= tech.cost) {
          researched[tech.id] = true;
          research.current = null;
          addStory(`🔬 Investigación completada: <b>${tech.name}</b>. ${tech.desc}`);
          showEventModal(tech.icon, '¡Investigación completada!', `<b>${tech.name}</b><br>${tech.desc}`);
          sfx('level');
          renderTools();
        }
      }
      break;
    }
    case 'cook':
      c.task.paidCost = null;
      resources.guiso++;
      addFloater(t.x * TW + 8, t.y * TW, '+1 🍲');
      break;
    case 'craft': {
      c.task.paidCost = null;
      const prod = c.task.product || 'tools';
      resources[prod]++;
      if (prod === 'tools') stats.tools++;
      addFloater(t.x * TW + 8, t.y * TW, `+1 ${RES_EMOJI[prod]}`);
      break;
    }
    case 'eat': case 'eatHere':
      eatFromStock(c);
      break;
    case 'eatInv': {
      const f = takeFromInv(c, 'food', 2);
      if (f > 0) {
        c.hunger = clamp(c.hunger + f * 45, 0, 100);
        addBuff(c, 'Comí bien 🍎', 4, 90);
      } else {
        const m = takeFromInv(c, 'meat', 2);
        c.hunger = clamp(c.hunger + m * 40, 0, 100);
        if (m > 0) addBuff(c, 'Carne cruda 🍖', -4, 90);
      }
      break;
    }
  }
  c.task = null;
}

function taskValid(c) {
  const k = c.task.type;
  if (!inB(c.task.x, c.task.y)) return true;
  const t = T(c.task.x, c.task.y);
  if (c.task.manual) {
    switch (k) {
      case 'chop':        return t.o === 'tree';
      case 'mine':        return t.o === 'rock';
      case 'harvest':     return t.o === 'berry' || t.o === 'fiber' || t.o === 'herb';
      case 'eatBerry':    return t.o === 'berry';
      case 'build':       return !!t.bp;
      case 'sow':         return t.farm && t.crop === null;
      case 'harvestCrop': return t.farm && t.crop !== null && t.crop >= 1;
      case 'sleep':       return t.o === 'bed' || t.o === 'medbed';
      case 'cook':        return t.o === 'fogon';
      case 'craft':       return c.task.product === 'ropa' ? t.o === 'telar' : t.o === 'taller';
      case 'extinguish':  return t.fire > 0;
      case 'research':    return t.o === 'desk';
      case 'fish':        return t.o === 'pier';
    }
    return true;
  }
  switch (k) {
    case 'chop':        return t.o === 'tree' && t.desig === 'chop';
    case 'mine':        return t.o === 'rock' && t.desig === 'mine';
    case 'harvest':     return (t.o === 'berry' || t.o === 'fiber' || t.o === 'herb') && t.desig === 'harvest';
    case 'eatBerry':    return t.o === 'berry';
    case 'build':       return !!t.bp;
    case 'sow':         return t.farm && t.crop === null;
    case 'harvestCrop': return t.farm && t.crop !== null && t.crop >= 1;
    case 'eat':         return resources.food >= 1 || resources.guiso >= 1 || resources.meat >= 1 || c.task.phase === 'work';
    case 'sleep':       return t.o === 'bed' || t.o === 'medbed';
    case 'haul':        return c.task.phase !== 'go' || !!t.item;
    case 'cook':        return t.o === 'fogon';
    case 'craft':       return c.task.product === 'ropa' ? t.o === 'telar' : t.o === 'taller';
    case 'campfire':    return t.o === 'fogata';
    case 'extinguish':  return t.fire > 0;
    case 'research':    return t.o === 'desk' && !!research.current;
    case 'fish':        return t.o === 'pier';
  }
  return true;
}

// -------- control directo --------
function canStand(px, py) {
  if (px < 5 || py < 5 || px > MW * TW - 5 || py > MH * TW - 5) return false;
  for (const [ox, oy] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
    if (!walkable(T(((px + ox) / TW) | 0, ((py + oy) / TW) | 0))) return false;
  }
  return true;
}

function manualInteract(c) {
  if (c.task) return;
  const t0 = T(c.tx, c.ty);
  // acciones instantáneas en el propio tile
  if (t0.item && invTotal(c) < INV_CAP) {
    const it = t0.item;
    t0.item = null;
    addToInv(c, it.res, it.n);
    return;
  }
  if (t0.stock && invTotal(c) > 0) {
    for (const r in c.inv) resources[r] += c.inv[r];
    c.inv = {};
    addFloater(c.x, c.y - 8, '📦✓');
    return;
  }
  // cazar al animal más cercano
  let na = null, nd = 1e9;
  for (const a of animals) {
    if (a.dead) continue;
    const d = Math.hypot(c.x - a.x, c.y - a.y);
    if (d < nd) { nd = d; na = a; }
  }
  if (na && nd <= 1.8 * TW) { hitAnimal(c, na); return; }
  const mk = (type, t, work, paidCost, product) => {
    c.task = { type, x: t.x, y: t.y, workLeft: work, workTotal: work, phase: 'work', manual: true };
    if (paidCost) { pay(paidCost); c.task.paidCost = paidCost; }
    if (product) c.task.product = product;
    if (t.rsv === null) t.rsv = c.id;
    equipTool(c);
  };
  if (t0.o === 'bed' || t0.o === 'medbed') { mk('sleep', t0, 0); return; }
  if (t0.o === 'pier') { mk('fish', t0, 6); return; }
  if (t0.stock && c.hunger < 80 && (resources.food >= 1 || resources.guiso >= 1 || resources.meat >= 1)) { mk('eat', t0, 1.2); return; }
  if (t0.farm && t0.crop === null) { mk('sow', t0, 2); return; }
  // acciones en tiles adyacentes (incluido el propio)
  const cand = [[c.tx, c.ty], ...DIRS.map(([dx, dy]) => [c.tx + dx, c.ty + dy])];
  for (const [x, y] of cand) {
    if (!inB(x, y)) continue;
    const t = T(x, y);
    if (t.fire > 0) { mk('extinguish', t, 1.5); return; }
    if (t.rsv !== null && t.rsv !== c.id) continue;
    if (t.bp && (t.bp.paid || canAfford(t.bp.cost))) {
      if (!t.bp.paid) { pay(t.bp.cost); t.bp.paid = true; }
      mk('build', t, BUILDS[t.bp.type].work);
      return;
    }
    if (t.farm && t.crop !== null && t.crop >= 1) { mk('harvestCrop', t, 2); return; }
    if (t.o === 'tree')  { mk('chop', t, 3); return; }
    if (t.o === 'rock')  { mk('mine', t, 4); return; }
    if (t.o === 'fiber' || t.o === 'herb') { mk('harvest', t, 1.8); return; }
    if (t.o === 'berry') { mk(c.hunger < 50 ? 'eatBerry' : 'harvest', t, 1.8); return; }
    if (t.o === 'desk' && research.current && !researched[research.current]) { mk('research', t, 4); return; }
    if (t.o === 'fogon' && (resources.food >= 3 || (resources.meat >= 1 && resources.food >= 1))) {
      const recipe = (resources.meat >= 1 && resources.food >= 1) ? { meat: 1, food: 1 } : { food: 3 };
      mk('cook', t, 4, recipe);
      return;
    }
    if (t.o === 'taller' && canAfford({ wood: 2, iron: 1 })) { mk('craft', t, 5, { wood: 2, iron: 1 }, 'tools'); return; }
    if (t.o === 'telar' && canAfford({ fiber: 4 })) { mk('craft', t, 5, { fiber: 4 }, 'ropa'); return; }
  }
  say(c, 'Acá no hay nada para hacer.', 1.8);
}

function updateControlled(c, dt) {
  const vx = ((keys.has('d') || keys.has('ArrowRight')) ? 1 : 0) - ((keys.has('a') || keys.has('ArrowLeft')) ? 1 : 0);
  const vy = ((keys.has('s') || keys.has('ArrowDown')) ? 1 : 0) - ((keys.has('w') || keys.has('ArrowUp')) ? 1 : 0);
  if (vx || vy) {
    if (c.task) abandonTask(c);
    const norm = vx && vy ? 0.7071 : 1;
    const sp = 78 * (T(c.tx, c.ty).floor ? 1.25 : 1) * dt * norm;
    const nx = c.x + vx * sp, ny = c.y + vy * sp;
    if (canStand(nx, c.y)) c.x = nx;
    if (canStand(c.x, ny)) c.y = ny;
    c.tx = clamp((c.x / TW) | 0, 0, MW - 1);
    c.ty = clamp((c.y / TW) | 0, 0, MH - 1);
    c.moving = true;
  } else c.moving = false;
  if (c.task && c.task.manual) {
    if (!taskValid(c)) { abandonTask(c); return; }
    if (c.task.type === 'sleep') {
      c.energy = clamp(c.energy + 4.5 * dt, 0, 100);
      if (c.energy >= 100) {
        addBuff(c, 'Dormí en cama 🛏️', 8, 60);
        abandonTask(c);
      }
      return;
    }
    c.task.workLeft -= dt * workMult(c, SKILL_OF_TASK[c.task.type]);
    if (c.task.workLeft <= 0) {
      c.task.paidCost = null;
      finishWork(c, T(c.task.x, c.task.y));
    }
  }
}

// -------- actualización principal de cada colono --------
function updateColonist(c, dt) {
  const sleeping = isSleeping(c);
  const winter = season().id === 'winter';
  const stage = stageOf(c);
  // ritmos relativos al largo del día: comen ~2 veces y duermen ~1 vez por día
  const hungerRate = ((stage === 'baby' ? 36 : stage === 'child' ? 45 : 55) / DAY_LEN) *
                     (c.trait === 'gloton' ? 1.25 : 1) * (winter ? 1.15 : 1);
  c.hunger = clamp(c.hunger - hungerRate * dt, 0, 100);
  if (!sleeping) c.energy = clamp(c.energy - (110 / DAY_LEN) * (c.trait === 'dormilon' ? 1.3 : 1) * dt, 0, 100);
  if (c.hunger <= 0) c.hp -= 2.5 * dt;
  else if (!(c.sick && c.sick.severity >= 1)) c.hp = clamp(c.hp + 1.5 * dt, 0, 100);
  // la gripe avanza si no se trata; el reposo (sobre todo en enfermería) la cura
  if (c.sick) {
    const resting = isSleeping(c);
    const onMedbed = resting && inB(c.task.x, c.task.y) && T(c.task.x, c.task.y).o === 'medbed';
    const rate = onMedbed ? -1.3 : resting ? -0.5 : 0.55;
    c.sick.severity = clamp(c.sick.severity + rate * dt / DAY_LEN, 0, 1.2);
    if (c.sick.severity <= 0) cureSick(c);
    else if (c.sick.severity >= 1) c.hp -= 1.5 * dt;
    if (c.sick && !c.say && !c.inConvo && Math.random() < 0.004 * dt * 60) say(c, pick(CHAT.sick));
  }
  if (c.hp <= 0) {
    c.dead = true;
    const cause = c.hunger <= 0 ? 'de hambre' : 'por la gripe';
    abandonTask(c);
    for (const r in c.inv) if (c.inv[r] > 0) dropItem(T(c.tx, c.ty), r, c.inv[r]);
    if (selected === c.id) selected = null;
    if (controlling === c.id) controlling = null;
    if (c.partner) {
      const p = colonists.find(x => x.id === c.partner);
      if (p) { p.partner = null; addBuff(p, 'Perdí a mi pareja 💔', -20, 240); }
    }
    stats.deaths++;
    addStory(`☠️ <b>${c.name}</b> murió ${cause}.`);
    sfx('bad');
    return;
  }
  // frío (invierno u ola de frío): abrigan la ropa, el fuego, la cama o estar bajo techo
  if (isFreezing()) {
    c.coldTimer = (c.coldTimer || 0) - dt;
    if (c.coldTimer <= 0) {
      c.coldTimer = 2;
      let warm = c.outfit || (sleeping && c.task.type === 'sleep') || T(c.tx, c.ty).indoor;
      if (!warm) {
        outerCold:
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const o = inB(c.tx + dx, c.ty + dy) ? T(c.tx + dx, c.ty + dy).o : null;
          if (o === 'fogata' || o === 'brazier') { warm = true; break outerCold; }
        }
      }
      if (!warm) {
        addBuff(c, 'Frío ❄️', -8, 6);
        if (!c.say && !c.inConvo && Math.random() < 0.15) say(c, pick(CHAT.cold));
      }
    }
  }
  if (c.say && gtime > c.say.until) c.say = null;
  c.buffs = c.buffs.filter(b => b.until > gtime);
  // arte cercano
  c.artTimer -= dt;
  if (c.artTimer <= 0) {
    c.artTimer = 3;
    outer:
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      if (inB(c.tx + dx, c.ty + dy) && T(c.tx + dx, c.ty + dy).o === 'statue') {
        addBuff(c, 'Arte cerca 🗿', 4, 40);
        break outer;
      }
    }
    if (colonyDog && Math.hypot(c.x - colonyDog.x, c.y - colonyDog.y) < 3.5 * TW)
      addBuff(c, `${colonyDog.name} cerca 🐕`, 3, 20);
  }
  // comentarios espontáneos
  if (!c.say && !c.inConvo && Math.random() < (c.trait === 'charlatan' ? 0.014 : 0.006) * dt * 60) {
    if (c.hunger < 30) say(c, pick(CHAT.hungry));
    else if (c.energy < 25 && !sleeping) say(c, pick(CHAT.tired));
    else if (c.task && c.task.type === 'campfire' && c.task.phase === 'work') say(c, pick(CHAT.campfire));
    else if (c.task && c.task.phase === 'work' && c.task.workTotal > 0) say(c, pick(CHAT.work));
    else if (isNight() && !sleeping && Math.random() < 0.5) say(c, pick(CHAT.night));
  }
  // modo control directo
  if (c.id === controlling) { updateControlled(c, dt); return; }

  if (!c.task) {
    c.think -= dt;
    if (c.think <= 0) { c.think = 0.4 + Math.random() * 0.4; findTask(c); }
    return;
  }
  const tk = c.task;
  if (c.hunger < 10 && !['eat', 'eatHere', 'eatInv', 'eatBerry'].includes(tk.type)) { abandonTask(c); return; }
  if (!taskValid(c)) { abandonTask(c); return; }

  // curación: el doctor va hasta el paciente
  if (tk.type === 'treat') {
    const p = colonists.find(x => x.id === tk.target && !x.dead);
    if (!p || !p.sick || resources.medicina < 1) {
      if (p) p.beingTreated = false;
      c.task = null;
      return;
    }
    if (Math.hypot(c.x - p.x, c.y - p.y) <= 1.8 * TW) {
      c.path = [];
      tk.workLeft -= dt * workMult(c, 'medic');
      if (tk.workLeft <= 0) {
        resources.medicina--;
        p.sick.severity -= 0.6;
        p.treatCd = gtime + 80;
        p.beingTreated = false;
        if (p.sick.severity <= 0) cureSick(p);
        else addBuff(p, 'Atendido 💊', 4, 120);
        addFloater(p.x, p.y - 10, '💊');
        gainXp(c, 'medic', 10);
        sfxAt('eat', c.x, c.y);
        c.task = null;
      }
    } else {
      tk.repath = (tk.repath || 0) - dt;
      if (tk.repath <= 0 || !c.path.length) {
        tk.repath = 0.8;
        const bfs = bfsFrom(c.tx, c.ty);
        const nr = nearestReach(bfs, t => t.x === p.tx && t.y === p.ty, false);
        if (!nr) { p.beingTreated = false; c.task = null; return; }
        tk.x = p.tx; tk.y = p.ty;
        c.path = buildPath(bfs, nr.goal);
      }
      moveAlong(c, dt);
    }
    return;
  }
  // caza: persecución con recálculo de ruta
  if (tk.type === 'hunt') {
    const a = animals.find(x => x.id === tk.target && !x.dead);
    if (!a || !a.hunted) { c.task = null; return; }
    if (Math.hypot(c.x - a.x, c.y - a.y) <= 1.7 * TW) {
      c.path = [];
      tk.strike = (tk.strike || 0) + dt * workMult(c, 'hunt');
      if (tk.strike >= 0.9) {
        tk.strike = 0;
        hitAnimal(c, a);
        if (a.dead) c.task = null;
      }
    } else {
      tk.repath = (tk.repath || 0) - dt;
      if (tk.repath <= 0 || !c.path.length) {
        tk.repath = 0.8;
        const bfs = bfsFrom(c.tx, c.ty);
        const nr = nearestReach(bfs, t => t.x === a.tx && t.y === a.ty, false);
        if (!nr) { c.task = null; return; }
        tk.x = a.tx; tk.y = a.ty;
        c.path = buildPath(bfs, nr.goal);
      }
      moveAlong(c, dt);
    }
    return;
  }
  if (tk.phase === 'go') {
    if (moveAlong(c, dt)) {
      if (!c.task) return;
      if (tk.type === 'wander' || tk.type === 'follow') { c.task = null; return; }
      if (tk.type === 'social') {
        const o = colonists.find(x => x.id === tk.target);
        c.task = null;
        if (o && !o.dead && Math.hypot(c.x - o.x, c.y - o.y) <= 3.5 * TW) tryStartConvo(c, o);
        return;
      }
      if (tk.type === 'haul') {
        const t = T(tk.x, tk.y);
        if (t.rsv === c.id) t.rsv = null;
        if (t.item) {
          const it = t.item;
          t.item = null;
          addToInv(c, it.res, it.n);
        }
        c.task = null;
        return;
      }
      if (tk.type === 'deposit') {
        for (const r in c.inv) if (c.inv[r] > 0) resources[r] += c.inv[r];
        c.inv = {};
        addFloater(c.x, c.y - 8, '📦✓');
        c.task = null;
        return;
      }
      tk.phase = 'work';
    }
    return;
  }
  // phase 'work'
  if (tk.type === 'sleep' || tk.type === 'sleepHere') {
    const rate = ((tk.type === 'sleep' ? 300 : 150) / DAY_LEN) * (c.trait === 'dormilon' ? 1.3 : 1);
    c.energy = clamp(c.energy + rate * dt, 0, 100);
    // los enfermos se quedan reposando aunque estén descansados
    const stillSick = c.sick && c.sick.severity > 0.15 && tk.type === 'sleep';
    if ((c.energy >= 100 && !stillSick) ||
        (c.energy > 60 && !isNight() && tk.type === 'sleepHere' && !c.sick)) {
      const bt = inB(tk.x, tk.y) ? T(tk.x, tk.y) : null;
      if (bt && bt.rsv === c.id) bt.rsv = null;
      addBuff(c, tk.type === 'sleep' ? 'Dormí en cama 🛏️' : 'Dormí en el suelo 🪨',
              tk.type === 'sleep' ? 8 : -8, 120);
      if (tk.type === 'sleep' && bt && bt.indoor) {
        addBuff(c, 'Dormí bajo techo 🏠', 4, 120);
        const rb = roomBeautyAt(bt);
        if (rb >= 8) addBuff(c, 'Cuarto precioso 🖼️', 6, 120);
        else if (rb >= 4) addBuff(c, 'Cuarto acogedor 🛋️', 3, 120);
      }
      c.task = null;
    }
    return;
  }
  if (tk.type === 'campfire') {
    addBuff(c, 'Noche de fogata 🔥', 8, 90);
    if (!isNight() || c.energy < 25 || c.hunger < 35) c.task = null;
    return;
  }
  tk.workLeft -= dt * workMult(c, SKILL_OF_TASK[tk.type]);
  if (tk.workLeft <= 0) {
    tk.paidCost = null;                     // el costo ya se convierte en producto
    finishWork(c, inB(tk.x, tk.y) ? T(tk.x, tk.y) : null);
  }
}

// ============================== CHARLAS ==============================
function tryStartConvo(a, b) {
  if (a.inConvo || b.inConvo || a.convoCd > gtime || b.convoCd > gtime) return false;
  if (isSleeping(a) || isSleeping(b)) return false;
  if (stageOf(a) === 'baby' || stageOf(b) === 'baby') return false;
  const r = Math.random();
  const partners = a.partner === b.id;
  const single = !a.partner && !b.partner && stageOf(a) === 'adult' && stageOf(b) === 'adult' &&
                 !kin[relKey(a, b)];                          // los hermanos no coquetean
  const rivals = !!grudges[relKey(a, b)];
  let kind;
  if (partners && r < 0.4) kind = 'sweet';
  else if (rivals && r < 0.4) kind = 'argue';                 // los rivales chocan seguido
  else if (single && relOf(a, b) >= 4 && r < 0.35) kind = 'flirt';
  else kind = r < 0.12 ? 'argue' : r < 0.34 ? 'joke' : 'chat';
  const friends = areFriends(a, b);
  let script;
  if (kind === 'sweet') {
    script = [
      { c: a, t: fmt(pick(CHAT.sweet), b.name) },
      { c: b, t: pick(CHAT.sweetReply) },
    ];
  } else if (kind === 'flirt') {
    script = [
      { c: a, t: fmt(pick(CHAT.flirt), b.name) },
      { c: b, t: pick(CHAT.flirtReply) },
      { c: a, t: fmt(pick(CHAT.flirt), b.name) },
    ];
  } else if (kind === 'argue') {
    script = [
      { c: a, t: pick(CHAT.argue) },
      { c: b, t: pick(CHAT.argueReply) },
      { c: a, t: pick(CHAT.argueReply) },
    ];
  } else if (kind === 'joke') {
    script = [
      { c: a, t: pick(CHAT.joke) },
      { c: b, t: pick(CHAT.laugh) },
    ];
  } else {
    const atCampfire = a.task && a.task.type === 'campfire';
    const first = Math.random() < 0.5 ? a : b;
    const second = first === a ? b : a;
    script = [
      { c: a, t: fmt(pick(friends ? CHAT.greetFriend : CHAT.greet), b.name) },
      { c: b, t: friends && Math.random() < 0.4 ? fmt(pick(CHAT.deep), a.name) : pick(CHAT.reply) },
      { c: first, t: pick(atCampfire ? CHAT.campfire : CHAT.topic) },
      { c: second, t: pick(CHAT.topicReply) },
    ];
  }
  convos.push({ a, b, kind, script, step: 0, next: gtime + 0.3 });
  a.inConvo = b.inConvo = true;
  return true;
}
function endConvo(cv, success) {
  cv.a.inConvo = cv.b.inConvo = false;
  for (const c of [cv.a, cv.b]) c.convoCd = gtime + (c.trait === 'charlatan' ? ri(8, 14) : ri(24, 40));
  if (success) {
    const k = relKey(cv.a, cv.b), before = rels[k] || 0;
    if (cv.kind === 'argue') {
      rels[k] = Math.max(0, before - 1);
      for (const c of [cv.a, cv.b]) addBuff(c, 'Discutí 😠', -6, 50);
      addLog(`😠 <b>${cv.a.name}</b> y <b>${cv.b.name}</b> discutieron.`);
    } else if (cv.kind === 'flirt') {
      rels[k] = before + 2;
      for (const c of [cv.a, cv.b]) addBuff(c, 'Mariposas 🦋', 8, 120);
      if (rels[k] >= 7 && !cv.a.partner && !cv.b.partner) {
        cv.a.partner = cv.b.id;
        cv.b.partner = cv.a.id;
        addStory(`💕 <b>${cv.a.name}</b> y <b>${cv.b.name}</b> ahora son pareja.`);
        sfx('love');
      }
    } else if (cv.kind === 'sweet') {
      rels[k] = before + 1;
      for (const c of [cv.a, cv.b]) addBuff(c, 'Momento con mi pareja 💕', 10, 120);
    } else {
      rels[k] = before + 1;
      const friends = rels[k] >= 3;
      for (const c of [cv.a, cv.b]) {
        if (cv.kind === 'joke') addBuff(c, 'Me reí 😂', 8, 100);
        else addBuff(c, friends ? 'Charla con un amigo 💞' : 'Buena charla 💬', friends ? 8 : 6, 100);
      }
      if (before < 3 && rels[k] >= 3)
        addStory(`🤝 <b>${cv.a.name}</b> y <b>${cv.b.name}</b> se hicieron amigos.`);
    }
  }
  cv.done = true;
}
function updateConvos() {
  for (const cv of convos) {
    if (cv.done) continue;
    const far = Math.hypot(cv.a.x - cv.b.x, cv.a.y - cv.b.y) > 4.5 * TW;
    if (cv.a.dead || cv.b.dead || far || isSleeping(cv.a) || isSleeping(cv.b)) { endConvo(cv, false); continue; }
    if (gtime >= cv.next) {
      const l = cv.script[cv.step];
      say(l.c, l.t, 2.3);
      cv.step++;
      cv.next = gtime + 1.9 + Math.random() * 0.6;
      if (cv.step >= cv.script.length) endConvo(cv, true);
    }
  }
  convos = convos.filter(cv => !cv.done);
}
function scanForConvos() {
  for (let i = 0; i < colonists.length; i++) for (let j = i + 1; j < colonists.length; j++) {
    const a = colonists[i], b = colonists[j];
    if (Math.hypot(a.x - b.x, a.y - b.y) <= 2.6 * TW && tryStartConvo(a, b)) return;
  }
}
