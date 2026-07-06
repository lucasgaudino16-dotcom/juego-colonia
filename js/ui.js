'use strict';
// ============================== BARRA DE HERRAMIENTAS ==============================
const catsDiv = document.getElementById('cats');
const toolRow = document.getElementById('toolrow');
const toolInfo = document.getElementById('toolinfo');
for (const cat of CATS) {
  const b = document.createElement('button');
  b.className = 'cat' + (cat.id === activeCat ? ' active' : '');
  b.textContent = cat.label;
  b.onclick = () => {
    activeCat = cat.id;
    document.querySelectorAll('.cat').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    renderTools();
  };
  catsDiv.appendChild(b);
}
function renderTools() {
  toolRow.innerHTML = '';
  for (const t of TOOLS.filter(t => t.cat === activeCat)) {
    const key = t.id.startsWith('b:') ? t.id.slice(2) : null;
    const needTech = key && BUILDS[key].tech && !researched[BUILDS[key].tech];
    const b = document.createElement('button');
    b.className = 'tool' + (t.id === tool ? ' active' : '') + (needTech ? ' locked' : '');
    b.innerHTML = `${needTech ? '🔒' : t.icon} ${t.name}${t.cost ? ` <span class="cost">${t.cost}</span>` : ''}`;
    b.onclick = () => {
      if (needTech) {
        toolInfo.textContent = `🔒 Requiere investigar: ${TECHS.find(x => x.id === BUILDS[key].tech).name} (panel 🧪)`;
        return;
      }
      tool = t.id;
      document.querySelectorAll('.tool').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      toolInfo.textContent = t.desc;
    };
    b.onmouseenter = () => {
      toolInfo.textContent = needTech
        ? `🔒 Requiere investigar: ${TECHS.find(x => x.id === BUILDS[key].tech).name} (panel 🧪)`
        : t.desc;
    };
    toolRow.appendChild(b);
  }
}
renderTools();

// ============================== BOTONES SUPERIORES ==============================
document.querySelectorAll('.spd').forEach(b => { b.onclick = () => setSpeed(+b.dataset.s); });
function setSpeed(s) {
  speed = s;
  document.querySelectorAll('.spd').forEach(x => x.classList.toggle('active', +x.dataset.s === s));
}
document.getElementById('zin').onclick = () => zoomAt(canvas.width / 2, canvas.height / 2, 1.25);
document.getElementById('zout').onclick = () => zoomAt(canvas.width / 2, canvas.height / 2, 1 / 1.25);
document.getElementById('savebtn').onclick = () => saveGame(false);
document.getElementById('newbtn').onclick = newGame;
const muteBtn = document.getElementById('mutebtn');
muteBtn.textContent = muted ? '🔇' : '🔊';
muteBtn.onclick = () => {
  muted = !muted;
  localStorage.setItem('mcMuted', muted ? '1' : '0');
  muteBtn.textContent = muted ? '🔇' : '🔊';
  if (!muted) initAudio();
};
window.addEventListener('beforeunload', () => saveGame(true));
// crónica de la colonia
function renderChronicle() {
  document.getElementById('crows').innerHTML = story.slice().reverse()
    .map(s => `<div class="crow"><b>Día ${s.day}</b> — ${s.txt}</div>`).join('') ||
    '<div class="crow">Todavía no pasó nada digno de contar...</div>';
}
document.getElementById('chronbtn').onclick = () => {
  const el = document.getElementById('chron');
  el.style.display = el.style.display === 'none' ? '' : 'none';
  if (el.style.display !== 'none') renderChronicle();
};
document.getElementById('cclose').onclick = () => { document.getElementById('chron').style.display = 'none'; };

// ============================== PANEL DE INVESTIGACIÓN ==============================
function renderResearch() {
  document.getElementById('rrows').innerHTML = TECHS.map(t => {
    const done = !!researched[t.id];
    const active = research.current === t.id;
    const prog = research.prog[t.id] || 0;
    return `<div class="rrow${done ? ' done' : active ? ' active' : ''}">
      <div class="rname">${t.icon} ${t.name} ${done ? '✓' : ''}</div>
      <div class="rdesc">${t.desc}</div>
      ${done ? '' : `<div class="rbar"><i style="width:${Math.min(100, prog / t.cost * 100)}%"></i></div>
        <div class="rdesc">${Math.min(prog | 0, t.cost)}/${t.cost} puntos</div>
        ${active ? '<div class="rdesc" style="color:#7fb5e0">▶ En investigación</div>'
                 : `<button data-tech="${t.id}">Investigar</button>`}`}
    </div>`;
  }).join('');
}
document.getElementById('resbtn').onclick = () => {
  const el = document.getElementById('respanel');
  el.style.display = el.style.display === 'none' ? '' : 'none';
  if (el.style.display !== 'none') renderResearch();
};
document.getElementById('rclose').onclick = () => { document.getElementById('respanel').style.display = 'none'; };
document.getElementById('rrows').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !b.dataset.tech) return;
  research.current = b.dataset.tech;
  addLog(`🧪 La colonia empieza a investigar <b>${TECHS.find(t => t.id === research.current).name}</b>.`);
  renderResearch();
});

// ============================== MODAL DE EVENTOS ==============================
let modalPrevSpeed = 1;
function showEventModal(icon, title, html) {
  modalPrevSpeed = speed || modalPrevSpeed || 1;
  setSpeed(0);
  document.getElementById('emicon').textContent = icon;
  document.getElementById('emtitle').textContent = title;
  document.getElementById('emtext').innerHTML = html;
  const el = document.getElementById('eventmodal');
  el.style.display = 'none';
  void el.offsetWidth;                 // reinicia la animación CSS
  el.style.display = '';
}
document.getElementById('emok').onclick = () => {
  document.getElementById('eventmodal').style.display = 'none';
  setSpeed(modalPrevSpeed || 1);
};

// ============================== MODAL DE INICIO (el despertar) ==============================
function showIntro(bonds) {
  setSpeed(0);
  document.getElementById('introtext').innerHTML =
    `Tres personas despiertan en un claro. Nadie recuerda cómo llegó hasta acá:
     solo hay un arcón con provisiones, herramientas gastadas... y un mundo entero por delante.<br>
     El mundo tomó forma: <b>${currentBiome ? currentBiome.name : 'Tierras desconocidas'} 🌍</b>`;
  document.getElementById('introcards').innerHTML = colonists.map(c => {
    const b = backstoryOf(c);
    const best = SKILLS.reduce((m, s) => c.skills[s.id].lv > c.skills[m.id].lv ? s : m, SKILLS[0]);
    return `<div class="fcard">
      <div class="fn" style="color:${c.color}">● ${c.name}</div>
      <div>${TRAITS[c.trait].name}</div>
      <div class="fb">📜 ${b.name}</div>
      <div class="ft">"${b.tale}"</div>
      <div style="margin-top:3px">Mejor oficio: ${best.icon} ${best.name} ${c.skills[best.id].lv}</div>
    </div>`;
  }).join('');
  document.getElementById('introbonds').innerHTML =
    '<b style="color:#e8b04b">Lo que sí recuerdan:</b>' + bonds.map(b => `<div>${b}</div>`).join('');
  document.getElementById('intro').style.display = '';
  // el mapa se dibuja línea por línea, como si el mundo se creara
  const ic = document.getElementById('introMap').getContext('2d');
  ic.clearRect(0, 0, 400, 280);
  let row = 0;
  const iv = setInterval(() => {
    for (let k = 0; k < 3 && row < MM_H; k++, row++)
      ic.drawImage(mmCanvas, 0, row, MM_W, 1, 0, row * 2, MM_W * 2, 2);
    if (row >= MM_H) clearInterval(iv);
  }, 18);
}
document.getElementById('introok').onclick = () => {
  document.getElementById('intro').style.display = 'none';
  setSpeed(1);
};

// ============================== FINAL CON LEGADO ==============================
function showLegacy() {
  setSpeed(0);
  document.getElementById('eventmodal').style.display = 'none';
  const years = Math.floor((day - 1) / (SEASON_DAYS * 4));
  document.getElementById('legacytext').innerHTML =
    `La colonia resistió <b>${day} día${day === 1 ? '' : 's'}</b>${years > 0 ? ` (${years} año${years > 1 ? 's' : ''})` : ''}.<br>
     Pasaron por ella <b>${stats.everColonists}</b> alma${stats.everColonists === 1 ? '' : 's'};
     ${stats.deaths} quedaron en esta tierra.<br>
     Metas cumplidas: <b>${goalIndex}</b> · Tecnologías: <b>${Object.keys(researched).length}</b> ·
     Cosechas: <b>${stats.harvested}</b>.<br>
     ${colonyDog ? `${colonyDog.name} aulló hasta el final. 🐕<br>` : ''}
     <i>Esta fue su historia:</i>`;
  document.getElementById('legacylog').innerHTML = story.slice(-12).reverse()
    .map(s => `<div class="crow"><b>Día ${s.day}</b> — ${s.txt}</div>`).join('');
  document.getElementById('legacy').style.display = '';
}
document.getElementById('legacyok').onclick = () => location.reload();

// ============================== COMERCIO ==============================
function renderTradeRows() {
  document.getElementById('t-gold').textContent = resources.gold;
  document.getElementById('trows').innerHTML = TRADE_GOODS.map((g, i) => {
    const sell = g.sellN > 0 ? `<button data-tr="s${i}" ${resources[g.res] < g.sellN ? 'disabled' : ''}>Vender ${g.sellN} → +${g.sellG}🪙</button>` : '';
    const buy = g.buyN > 0 ? `<button data-tr="b${i}" ${resources.gold < g.buyG ? 'disabled' : ''}>Comprar ${g.buyN} → −${g.buyG}🪙</button>` : '';
    return `<div class="trow"><span class="tn">${RES_EMOJI[g.res]} ${RES_NAME[g.res]} (${resources[g.res]})</span>${sell}${buy}</div>`;
  }).join('');
}
document.getElementById('tradebtn').onclick = () => {
  const el = document.getElementById('trade');
  el.style.display = el.style.display === 'none' ? '' : 'none';
  if (el.style.display !== 'none') renderTradeRows();
};
document.getElementById('tclose').onclick = () => { document.getElementById('trade').style.display = 'none'; };
document.getElementById('trows').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !b.dataset.tr) return;
  const kind = b.dataset.tr[0], g = TRADE_GOODS[+b.dataset.tr.slice(1)];
  if (kind === 's' && resources[g.res] >= g.sellN) { resources[g.res] -= g.sellN; resources.gold += g.sellG; }
  if (kind === 'b' && resources.gold >= g.buyG) { resources.gold -= g.buyG; resources[g.res] += g.buyN; }
  renderTradeRows();
});

// ============================== TECLADO ==============================
window.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); setSpeed(speed === 0 ? 1 : 0); return; }
  if (e.key === '1') setSpeed(1);
  if (e.key === '2') setSpeed(2);
  if (e.key === '3') setSpeed(4);
  if (e.key === 'Escape') {
    if (controlling) controlling = null;
    else selected = null;
    dragStart = null;
  }
  if (e.key === 'c' || e.key === 'C') {
    if (controlling) controlling = null;
    else if (selected) { controlling = selected; const c = ctlPawn(); if (c) abandonTask(c); }
  }
  if ((e.key === 'e' || e.key === 'E') && controlling) {
    const c = ctlPawn();
    if (c) manualInteract(c);
  }
  if (['w','a','s','d','W','A','S','D'].includes(e.key)) keys.add(e.key.toLowerCase());
  if (e.key.startsWith('Arrow')) { keys.add(e.key); if (controlling) e.preventDefault(); }
});
window.addEventListener('keyup', e => {
  keys.delete(e.key.toLowerCase());
  keys.delete(e.key);
});

// ============================== MOUSE ==============================
function mousePos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    px: (e.clientX - r.left) * (canvas.width / r.width),
    py: (e.clientY - r.top) * (canvas.height / r.height),
  };
}
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const p = mousePos(e);
  zoomAt(p.px, p.py, e.deltaY < 0 ? 1.15 : 1 / 1.15);
}, { passive: false });
canvas.addEventListener('mousedown', e => {
  const p = mousePos(e);
  if (e.button === 2 || e.button === 1) {
    e.preventDefault();
    panning = { px: p.px, py: p.py, cx: cam.x, cy: cam.y };
    return;
  }
  if (e.button !== 0) return;
  const mm = mmRect();
  if (p.px >= mm.x && p.px <= mm.x + mm.w && p.py >= mm.y && p.py <= mm.y + mm.h) {
    cam.x = (p.px - mm.x) / MM_S * TW - canvas.width / cam.z / 2;
    cam.y = (p.py - mm.y) / MM_S * TW - canvas.height / cam.z / 2;
    clampCam();
    return;
  }
  mouse.px = p.px; mouse.py = p.py;
  updateMouseWorld();
  dragStart = { tx: mouse.tx, ty: mouse.ty, wx: mouse.wx, wy: mouse.wy };
});
canvas.addEventListener('mousemove', e => {
  const p = mousePos(e);
  mouse.px = p.px; mouse.py = p.py; mouse.in = true;
  if (panning) {
    cam.x = panning.cx - (p.px - panning.px) / cam.z;
    cam.y = panning.cy - (p.py - panning.py) / cam.z;
    clampCam();
  }
  updateMouseWorld();
});
canvas.addEventListener('mouseleave', () => { mouse.in = false; });
window.addEventListener('mouseup', e => {
  if (e.button === 2 || e.button === 1) { panning = null; return; }
  if (e.button !== 0 || !dragStart) return;
  // click simple sobre un colono → seleccionarlo
  if (dragStart.tx === mouse.tx && dragStart.ty === mouse.ty) {
    const c = colonists.find(c => Math.hypot(c.x - dragStart.wx, c.y - dragStart.wy) < Math.max(8, 11 / cam.z));
    if (c) {
      selected = selected === c.id ? null : c.id;
      dragStart = null;
      return;
    }
  }
  const x0 = Math.min(dragStart.tx, mouse.tx), x1 = Math.max(dragStart.tx, mouse.tx);
  const y0 = Math.min(dragStart.ty, mouse.ty), y1 = Math.max(dragStart.ty, mouse.ty);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) applyTool(T(x, y));
  dragStart = null;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

function applyTool(t) {
  if (tool.startsWith('b:')) {
    const key = tool.slice(2);
    if (key === 'floor' && (t.floor || t.farm)) return;
    // el muelle solo va en la orilla (tierra pegada al agua)
    if (key === 'pier' && !DIRS.some(([dx, dy]) =>
      inB(t.x + dx, t.y + dy) && T(t.x + dx, t.y + dy).g === 'water')) return;
    if (!t.o && !t.bp && !t.item && t.g !== 'water')
      t.bp = { type: key, cost: BUILDS[key].cost, paid: false };
    return;
  }
  switch (tool) {
    case 'chop':    if (t.o === 'tree') t.desig = 'chop'; break;
    case 'mine':    if (t.o === 'rock') t.desig = 'mine'; break;
    case 'harvest': if (t.o === 'berry' || t.o === 'fiber' || t.o === 'herb') t.desig = 'harvest'; break;
    case 'hunt':
      for (const a of animals) if (!a.dead && a.tx === t.x && a.ty === t.y) a.hunted = true;
      break;
    case 'farm':
      if ((t.g === 'grass' || t.g === 'soil') && !t.o && !t.bp && !t.floor) {
        t.farm = true;
        if (t.g !== 'soil') { t.g = 'soil'; repaintTile(t.x, t.y); }
      }
      break;
    case 'stock':
      if (t.g !== 'water' && !t.o && !t.bp) {
        t.stock = true;
        if (t.item) { resources[t.item.res] += t.item.n; t.item = null; }
      }
      break;
    case 'cancel':
      t.desig = null;
      if (t.bp) { if (t.bp.paid) refund(t.bp.cost); t.bp = null; }
      if (t.farm) { t.farm = false; t.crop = null; }
      t.stock = false;
      // demoler construcciones (devuelve la mitad de los materiales)
      if (t.o && BUILDS[t.o]) {
        for (const r in BUILDS[t.o].cost) resources[r] += Math.ceil(BUILDS[t.o].cost[r] / 2);
        if (t.o === 'wall' || t.o === 'door') roomsDirty = true;
        t.o = null;
      }
      if (t.floor) { resources.wood += 1; t.floor = false; repaintTile(t.x, t.y); }
      for (const a of animals) if (a.tx === t.x && a.ty === t.y) a.hunted = false;
      break;
  }
}

// ============================== PANEL LATERAL ==============================
function moodEmoji(m) { return m >= 65 ? '😊' : m >= 40 ? '😐' : m >= 20 ? '😟' : '😫'; }
function updatePanel() {
  document.getElementById('r-wood').textContent = resources.wood;
  document.getElementById('r-stone').textContent = resources.stone;
  document.getElementById('r-iron').textContent = resources.iron;
  document.getElementById('r-fiber').textContent = resources.fiber;
  document.getElementById('r-food').textContent = resources.food;
  document.getElementById('r-meat').textContent = resources.meat;
  document.getElementById('r-fish').textContent = resources.fish;
  document.getElementById('r-guiso').textContent = resources.guiso;
  document.getElementById('r-tools').textContent = resources.tools;
  document.getElementById('r-ropa').textContent = resources.ropa;
  document.getElementById('r-herb').textContent = resources.herb;
  document.getElementById('r-medicina').textContent = resources.medicina;
  document.getElementById('r-gold').textContent = resources.gold;
  const lowFood = resources.food < 10 && resources.guiso < 3 && resources.meat < 5;
  document.getElementById('res-food').classList.toggle('low', lowFood);
  document.getElementById('warn').style.display = lowFood ? '' : 'none';
  const trading = trader && trader.state === 'staying';
  document.getElementById('tradebtn').style.display = trading ? '' : 'none';
  const tradeEl = document.getElementById('trade');
  if (!trading) tradeEl.style.display = 'none';
  else if (tradeEl.style.display !== 'none') renderTradeRows();
  // alertas urgentes
  const alerts = [];
  for (const c of colonists) {
    if (c.sick && c.sick.severity > 0.6)
      alerts.push([`🤒 <b>${c.name}</b> está grave (${Math.round(c.sick.severity * 100)}%): ¡cama y medicina!`, '']);
  }
  if (fires.length) alerts.push(['🔥 ¡Hay un incendio!', '']);
  const bedCount = tiles.filter(t => t.o === 'bed' || t.o === 'medbed').length;
  if (bedCount < colonists.length)
    alerts.push([`🛏️ Faltan camas: ${bedCount} para ${colonists.length} colonos`, ' warn']);
  if (season().id !== 'winter' && SEASONS[Math.floor(day / SEASON_DAYS) % 4].id === 'winter')
    alerts.push(['❄️ El invierno llega mañana: guisos, leña y abrigo', ' warn']);
  document.getElementById('alerts').innerHTML =
    alerts.map(([txt, cls]) => `<div class="alert${cls}">${txt}</div>`).join('');
  // meta actual de la Cronista
  const goalEl = document.getElementById('goal');
  if (goalIndex >= GOALS.length) {
    goalEl.style.display = '';
    goalEl.innerHTML = '🏆 La colonia ya es leyenda.';
  } else if (goalAnnounced) {
    const g = GOALS[goalIndex];
    goalEl.style.display = '';
    goalEl.innerHTML = `🎯 <b>${g.desc}</b> (${g.prog()})
      <div class="gr">Recompensa: ${Object.entries(g.reward).map(([r, n]) => `${n}${RES_EMOJI[r]}`).join(' ')}</div>`;
  } else goalEl.style.display = 'none';
  const h = Math.floor(time * 24), m = Math.floor((time * 24 - h) * 60);
  const sea = season();
  document.getElementById('clock').textContent =
    `Día ${day} · ${sea.name} ${sea.emoji} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${isNight() ? '🌙' : '☀️'}`;
  document.getElementById('pawns').innerHTML = colonists.map(c => {
    const md = moodOf(c);
    const sel = selected === c.id;
    let extra = '';
    if (sel) {
      const buffs = c.buffs.map(b =>
        `<div class="buff${b.val < 0 ? ' neg' : ''}">${b.val > 0 ? '+' : ''}${b.val} ${b.txt}</div>`).join('');
      const fr = friendsOf(c);
      const inv = Object.entries(c.inv).filter(([, n]) => n > 0)
        .map(([r, n]) => `${n}${RES_EMOJI[r]}`).join(' ');
      const prios = PRIO_CATS.map(p =>
        `<span class="prio p${c.prio[p.id]}" data-prio="${c.id}:${p.id}"
           title="${p.name}: ${PRIO_LABEL[c.prio[p.id]]} (click para cambiar)">${p.icon}${c.prio[p.id] || '✕'}</span>`).join('');
      const skills = SKILLS.map(s => {
        const sk = c.skills[s.id] || { lv: 0, xp: 0 };
        return `<span class="prio p2" title="${s.name} nivel ${sk.lv} (${sk.xp}/${30 + sk.lv * 25} xp)">${s.icon}${sk.lv}</span>`;
      }).join('');
      const partner = c.partner ? colonists.find(o => o.id === c.partner) : null;
      const pars = c.parents ? colonists.filter(o => c.parents.includes(o.id)) : [];
      const kins = colonists.filter(o => o !== c && kin[relKey(c, o)]);
      const rivals = colonists.filter(o => o !== c && grudges[relKey(c, o)]);
      const st = stageName(c);
      const back = backstoryOf(c);
      extra = `<div class="trait">${TRAITS[c.trait].name} — ${TRAITS[c.trait].desc}</div>
        <div class="trait">📜 ${back.name}: ${back.tale}.</div>
        ${c.sick ? `<div class="buff neg">🤒 Enfermo/a (${Math.round(c.sick.severity * 100)}%) — necesita reposo y medicina</div>` : ''}
        ${st ? `<div class="buff">${st} (crece con los días)</div>` : ''}
        ${partner ? `<div class="friends">💕 Pareja: ${partner.name}</div>` : ''}
        ${pars.length ? `<div class="friends">👪 De ${pars.map(p => p.name).join(' y ')}</div>` : ''}
        ${kins.length ? `<div class="friends">👫 Hermano/a de ${kins.map(k => k.name).join(', ')}</div>` : ''}
        ${rivals.length ? `<div class="buff neg">⚡ Rival de ${rivals.map(k => k.name).join(', ')}</div>` : ''}
        ${c.tool ? '<div class="buff">🔨 Tiene herramienta (+15% trabajo)</div>' : ''}
        ${c.outfit ? '<div class="buff">👕 Ropa tejida (+5 humor y abrigo)</div>' : ''}
        <div class="inv">🎒 ${inv || 'mochila vacía'} (${invTotal(c)}/${INV_CAP})</div>
        ${fr.length ? `<div class="friends">🤝 Amigos: ${fr.map(f => f.name).join(', ')}</div>` : ''}
        ${buffs}
        <div class="inv" style="margin-top:4px">Habilidades:</div>
        <div class="prios">${skills}</div>
        <div class="inv" style="margin-top:4px">Prioridades (click):</div>
        <div class="prios">${prios}</div>
        <button class="ctlbtn${controlling === c.id ? ' on' : ''}" data-ctl="${c.id}">
          ${controlling === c.id ? '✋ Soltar control (Esc)' : '🎮 Controlar (C)'}</button>`;
    }
    return `
    <div class="pawn${sel ? ' sel' : ''}" data-id="${c.id}">
      <div class="row1">
        <span class="nm" style="color:${c.color}">${controlling === c.id ? '🎮' : '●'} ${c.name}${c.sick ? ' 🤒' : ''}</span>
        <span class="mood">${moodEmoji(md)} ${md}</span>
      </div>
      <div class="tk">${c.inConvo ? 'Charlando 💬' : c.task ? (TASK_LABEL[c.task.type] || c.task.type) : 'Sin tareas'}</div>
      ${extra}
      <div class="needrow">🍗<div class="bar"><i style="width:${c.hunger}%;background:#d97f4a"></i></div></div>
      <div class="needrow">⚡<div class="bar"><i style="width:${c.energy}%;background:#5b9de0"></i></div></div>
    </div>`;
  }).join('') || '<div class="pawn">Nadie queda con vida.</div>';
}
document.getElementById('pawns').addEventListener('click', e => {
  const pr = e.target.closest('.prio');
  if (pr && pr.dataset.prio) {
    const [id, cat] = pr.dataset.prio.split(':');
    const c = colonists.find(x => x.id === +id);
    if (c) c.prio[cat] = { 1: 2, 2: 3, 3: 0, 0: 1 }[c.prio[cat]];
    updatePanel();
    return;
  }
  const ctl = e.target.closest('.ctlbtn');
  if (ctl) {
    const id = +ctl.dataset.ctl;
    if (controlling === id) controlling = null;
    else {
      controlling = id;
      const c = ctlPawn();
      if (c) abandonTask(c);
    }
    updatePanel();
    return;
  }
  const el = e.target.closest('.pawn');
  if (!el || !el.dataset.id) return;
  const id = +el.dataset.id;
  selected = selected === id ? null : id;
  updatePanel();
});
