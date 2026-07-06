'use strict';
// ============================== SIMULACIÓN ==============================
let lastSeason = null;
function simStep(dt) {
  const prevTime = time;
  gtime += dt;
  time += dt / DAY_LEN;
  if (time >= 1) { time -= 1; day++; }
  // cambio de estación: repintar el terreno y avisar
  if (lastSeason !== season().id) {
    if (lastSeason === 'winter' && season().id === 'spring')
      addStory('🌸 ¡La colonia sobrevivió al invierno! Empieza una nueva primavera.');
    else if (lastSeason !== null)
      addLog(`${season().emoji} Empezó ${season().id === 'spring' ? 'la' : 'el'} ${season().name.toLowerCase()}.`);
    lastSeason = season().id;
    repaintAll();
  }
  // eventos del amanecer
  if (prevTime < 0.25 && time >= 0.25) {
    // envejecer: los bebés crecen
    for (const c of colonists) {
      c.age++;
      if (c.age === 3) addLog(`🎂 <b>${c.name}</b> ya es niño/a: puede acarrear cosas.`);
      if (c.age === 6) addLog(`🎂 <b>${c.name}</b> creció: ¡ya trabaja como adulto!`);
    }
    // riesgo de enfermarse: el frío y el mal ánimo pasan factura
    for (const c of colonists) {
      if (c.sick) continue;
      let risk = 0.02;
      if (c.buffs.some(b => b.txt.includes('Frío'))) risk += 0.10;
      if (moodOf(c) < 30) risk += 0.05;
      if (Math.random() < risk) getSick(c);
    }
    // nacimientos: parejas con buen humor pueden tener bebés
    for (const c of colonists) {
      if (!c.partner || c.id > c.partner) continue;
      const p = colonists.find(x => x.id === c.partner);
      if (!p || stageOf(c) !== 'adult' || stageOf(p) !== 'adult') continue;
      if (colonists.length >= 10 || Math.random() >= 0.15) continue;
      if (moodOf(c) < 50 || moodOf(p) < 50) continue;
      const nb = spawnBaby(c, p);
      addStory(`👶 ¡Nació <b>${nb.name}</b>, de ${c.name} y ${p.name}!`);
      sfx('baby');
      addBuff(c, 'Fuimos padres 👶', 10, 240);
      addBuff(p, 'Fuimos padres 👶', 10, 240);
    }
    // viajero que se une
    if (colonists.length > 0 && colonists.length < 8 && Math.random() < 0.35) {
      const base = colonists[0];
      const bfs = bfsFrom(base.tx, base.ty);
      for (let tries = 0; tries < 80; tries++) {
        const side = ri(0, 3);
        const x = side < 2 ? ri(1, MW - 2) : side === 2 ? ri(0, 1) : ri(MW - 2, MW - 1);
        const y = side === 0 ? ri(0, 1) : side === 1 ? ri(MH - 2, MH - 1) : ri(1, MH - 2);
        if (bfs.dist[idx(x, y)] >= 0) {
          const c = spawnColonist(x, y);
          say(c, pick(CHAT.join), 4);
          const back = backstoryOf(c);
          addStory(`🚶 <b>${c.name}</b> se unió a la colonia. ${back.name}: ${back.tale}.`);
          break;
        }
      }
    }
    // mercader
    if (!trader && day >= nextTraderDay && colonists.length > 0) {
      spawnTrader();
      nextTraderDay = day + 3 + ri(0, 1);
    }
    // rebrote natural (no en invierno) + la tierra quemada se recupera
    if (season().id !== 'winter') {
      for (let i = 0; i < 60; i++) {
        const t = T(ri(1, MW - 2), ri(1, MH - 2));
        if (t.scorched && Math.random() < 0.4) { t.scorched = false; repaintTile(t.x, t.y); continue; }
        if (t.g !== 'grass' || t.o || t.bp || t.farm || t.stock || t.item || t.desig || t.scorched) continue;
        const nearTree = DIRS.some(([dx, dy]) => inB(t.x + dx, t.y + dy) && T(t.x + dx, t.y + dy).o === 'tree');
        if (nearTree && Math.random() < 0.4) t.o = 'tree';
        else if (Math.random() < 0.05) t.o = 'berry';
        else if (Math.random() < 0.04) t.o = 'fiber';
        else if (Math.random() < 0.025) t.o = 'herb';
      }
    }
    // fauna (escasea en invierno)
    const animalCap = season().id === 'winter' ? 6 : 14;
    while (animals.filter(a => !a.dead).length < animalCap) spawnAnimalAtEdge();
    // autoguardado
    saveGame(true);
  }
  // crecimiento de cultivos (solo de día; depende de la estación y las heladas)
  if (!isNight() && gtime >= coldSnapUntil) {
    const seaMult = { spring: 1, summer: 1.2, autumn: 0.6, winter: 0 }[season().id];
    if (seaMult > 0) {
      const rate = dt / (DAY_LEN * 1.5) * seaMult;   // un cultivo tarda ~1,5 días
      for (const t of tiles) if (t.farm && t.crop !== null && t.crop < 1) t.crop = Math.min(1, t.crop + rate);
    }
  }
  // la Cronista, sus metas, el fuego y los interiores
  narratorTick();
  goalTick(dt);
  updateFires(dt);
  if (roomsDirty) computeRooms();
  // mini-animaciones de eventos
  for (const e of effects) e.t += dt;
  effects = effects.filter(e => e.t < e.dur);
  for (const c of colonists) updateColonist(c, dt);
  colonists = colonists.filter(c => !c.dead);
  for (const a of animals) if (!a.dead) updateAnimal(a, dt);
  animals = animals.filter(a => !a.dead);
  updateDog(dt);
  updateTrader(dt);
  // charlas
  updateConvos();
  convoTimer -= dt;
  if (convoTimer <= 0) { convoTimer = 2.5; scanForConvos(); }
  // textos flotantes
  for (const f of floaters) f.t += dt;
  floaters = floaters.filter(f => f.t < 1.3);
  if (!gameOver && colonists.length === 0) {
    gameOver = true;
    localStorage.removeItem(SAVE_KEY);
    addLog('💀 La colonia se perdió...');
    showLegacy();
  }
}

// ============================== LOOP ==============================
let last = performance.now(), panelTimer = 0, mmTimer = 0, ambientTimer = 3;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (let i = 0; i < speed; i++) simStep(dt);
  // sonido ambiente: pájaros de día, grillos de noche, viento en invierno
  if (speed > 0) {
    ambientTimer -= dt;
    if (ambientTimer <= 0) {
      if (season().id === 'winter') { sfx('wind'); ambientTimer = 5 + Math.random() * 7; }
      else if (isNight()) { sfx('cricket'); ambientTimer = 2 + Math.random() * 4; }
      else { sfx('chirp'); ambientTimer = 3 + Math.random() * 6; }
    }
  }
  // cámara: seguir al controlado o panear con teclado
  const cp = ctlPawn();
  if (cp) {
    cam.x += (cp.x - canvas.width / cam.z / 2 - cam.x) * Math.min(1, dt * 6);
    cam.y += (cp.y - canvas.height / cam.z / 2 - cam.y) * Math.min(1, dt * 6);
    clampCam();
  } else {
    const pan = 420 / cam.z * dt;
    let mx = 0, my = 0;
    if (keys.has('a') || keys.has('ArrowLeft')) mx -= pan;
    if (keys.has('d') || keys.has('ArrowRight')) mx += pan;
    if (keys.has('w') || keys.has('ArrowUp')) my -= pan;
    if (keys.has('s') || keys.has('ArrowDown')) my += pan;
    if (mx || my) { cam.x += mx; cam.y += my; clampCam(); }
  }
  updateMouseWorld();
  mmTimer -= dt;
  if (mmTimer <= 0) { mmTimer = 0.5; redrawMinimap(); }
  draw();
  panelTimer -= dt;
  if (panelTimer <= 0) { panelTimer = 0.2; updatePanel(); }
  requestAnimationFrame(loop);
}

// ============================== INICIO ==============================
if (!loadGame()) {
  // la colonia se funda en un lugar distinto cada partida
  const scx = ri((MW * 0.3) | 0, (MW * 0.7) | 0), scy = ri((MH * 0.3) | 0, (MH * 0.7) | 0);
  genMap(scx, scy);
  spawnColonist(scx - 2, scy);
  spawnColonist(scx, scy + 1);
  spawnColonist(scx + 1, scy - 1);
  cam.z = 1.3;
  cam.x = scx * TW - canvas.width / cam.z / 2;
  cam.y = scy * TW - canvas.height / cam.z / 2;
  for (let i = 0; i < 14; i++) spawnAnimalAtEdge();
  nextEventAt = gtime + (0.8 + Math.random() * 0.6) * DAY_LEN;
  const bonds = generateBonds();
  const founders = colonists.map(c => `<b>${c.name}</b> (${backstoryOf(c).name})`).join(', ');
  addStory(`🌍 El mundo tomó forma: <b>${currentBiome.name}</b>.`);
  addStory(`⛺ ${founders} despertaron en un claro sin recordar cómo llegaron. Fundaron una colonia con lo puesto y un sueño: reconstruir un hogar.`);
  for (const b of bonds) addStory(b);
  addLog('💡 Encerrá camas entre muros y puerta: dormir bajo techo abriga y da humor. Crónica en 📖.');
  clampCam();
  redrawMinimap();
  showIntro(bonds);
} else {
  addLog('📂 Partida cargada. ¡Seguimos!');
  clampCam();
  redrawMinimap();
}
requestAnimationFrame(loop);
