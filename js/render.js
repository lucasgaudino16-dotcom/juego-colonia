'use strict';
// ============================== CÁMARA ==============================
function clampCam() {
  const vw = canvas.width / cam.z, vh = canvas.height / cam.z;
  cam.x = vw >= MW * TW ? (MW * TW - vw) / 2 : clamp(cam.x, 0, MW * TW - vw);
  cam.y = vh >= MH * TW ? (MH * TW - vh) / 2 : clamp(cam.y, 0, MH * TW - vh);
}
function zoomAt(sx, sy, f) {
  const wx = cam.x + sx / cam.z, wy = cam.y + sy / cam.z;
  cam.z = clamp(cam.z * f, 0.5, 2.5);
  cam.x = wx - sx / cam.z;
  cam.y = wy - sy / cam.z;
  clampCam();
}
function updateMouseWorld() {
  mouse.wx = cam.x + mouse.px / cam.z;
  mouse.wy = cam.y + mouse.py / cam.z;
  mouse.tx = clamp((mouse.wx / TW) | 0, 0, MW - 1);
  mouse.ty = clamp((mouse.wy / TW) | 0, 0, MH - 1);
}
const w2sx = wx => (wx - cam.x) * cam.z;
const w2sy = wy => (wy - cam.y) * cam.z;

// copos de nieve para el invierno (en pantalla)
const flakes = [];
for (let i = 0; i < 70; i++) {
  flakes.push({ x0: Math.random() * 960, y0: Math.random() * 640, spd: 18 + Math.random() * 26,
                ph: Math.random() * 7, sz: Math.random() < 0.3 ? 2 : 1.4 });
}

// ============================== MINIMAPA ==============================
const MM_S = 2, MM_W = MW * MM_S, MM_H = MH * MM_S, MM_PAD = 8;
const mmCanvas = document.createElement('canvas');
mmCanvas.width = MM_W;
mmCanvas.height = MM_H;
const mmCtx = mmCanvas.getContext('2d');
function mmRect() { return { x: MM_PAD, y: canvas.height - MM_H - MM_PAD, w: MM_W, h: MM_H }; }
function redrawMinimap() {
  const winter = season().id === 'winter';
  const grassCol = { spring: '#38703a', summer: '#427035', autumn: '#5c6e33', winter: '#c8d2de' }[season().id];
  for (const t of tiles) {
    mmCtx.fillStyle =
      t.g === 'water' ? (winter ? '#7aa6d1' : '#2b5f9e') :
      t.o === 'tree' ? '#1e5a26' :
      t.o === 'rock' ? (t.ore ? '#a0715a' : '#6f7580') :
      t.o === 'wall' ? '#9aa0ac' :
      t.g === 'soil' ? '#6b4f2f' : grassCol;
    mmCtx.fillRect(t.x * MM_S, t.y * MM_S, MM_S, MM_S);
  }
  mmCtx.fillStyle = '#d9c36a';
  for (const a of animals) mmCtx.fillRect((a.x / TW) * MM_S - 1, (a.y / TW) * MM_S - 1, 2, 2);
  if (trader) {
    mmCtx.fillStyle = '#e8b04b';
    mmCtx.fillRect((trader.x / TW) * MM_S - 1, (trader.y / TW) * MM_S - 1, 3, 3);
  }
  if (colonyDog) {
    mmCtx.fillStyle = '#c9915c';
    mmCtx.fillRect((colonyDog.x / TW) * MM_S - 1, (colonyDog.y / TW) * MM_S - 1, 3, 3);
  }
  mmCtx.fillStyle = '#fff';
  for (const c of colonists) mmCtx.fillRect((c.x / TW) * MM_S - 1, (c.y / TW) * MM_S - 1, 3, 3);
}

// ============================== DIBUJO DE OBJETOS ==============================
// copas de árbol según la estación [oscuro, medio, brillo]
const TREE_PAL = {
  spring: ['#245c2b', '#2f7a36', '#469a4e'],
  summer: ['#1e5c22', '#28742c', '#3a9440'],
  autumn: ['#8a5220', '#b56a2a', '#d08a3a'],
  winter: ['#1e4023', '#28522c', '#33663a'],
};
function drawObject(t, px, py) {
  const x = t.x, y = t.y;
  const sea = season().id;
  if (t.o === 'tree') {
    const v = (x * 31 + y * 17) % 3;
    const sw = Math.sin(gtime * 1.5 + (x * 13 + y * 7) % 10) * 0.8;   // balanceo suave
    const r = [6, 7, 5][v];
    const pal = TREE_PAL[sea];
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(px + 8, py + 14, 6, 2.2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#54381c';
    ctx.fillRect(px + 7, py + 8, 3, 7);
    ctx.fillStyle = pal[0];
    ctx.beginPath(); ctx.arc(px + 8 + sw, py + 6, r, 0, 7); ctx.fill();
    ctx.fillStyle = pal[1];
    ctx.beginPath(); ctx.arc(px + 7 + sw, py + 5, r - 1.5, 0, 7); ctx.fill();
    ctx.fillStyle = pal[2];
    ctx.beginPath(); ctx.arc(px + 6 + sw, py + 3.5, r * 0.4, 0, 7); ctx.fill();
    if (sea === 'winter') {                 // gorro de nieve
      ctx.fillStyle = 'rgba(235,240,248,0.9)';
      ctx.beginPath(); ctx.arc(px + 8 + sw, py + 3.5, r * 0.55, Math.PI, 0); ctx.fill();
    }
  } else if (t.o === 'rock') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(px + 8, py + 13, 6.5, 2.2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4c515a';
    ctx.beginPath(); ctx.ellipse(px + 8, py + 10, 7, 4.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a818c';
    ctx.beginPath(); ctx.arc(px + 7, py + 8, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#6d747e';
    ctx.beginPath(); ctx.arc(px + 11, py + 10, 3.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#99a1ad';
    ctx.beginPath(); ctx.arc(px + 5.5, py + 6.5, 2, 0, 7); ctx.fill();
    if (t.ore === 'iron') {
      ctx.fillStyle = '#c07840';
      for (const [ox, oy] of [[6, 9], [9, 7], [11, 11]]) {
        ctx.fillRect(px + ox, py + oy, 2, 2);
      }
    }
  } else if (t.o === 'berry') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(px + 8, py + 13, 5, 1.8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = sea === 'winter' ? '#3a5c40' : '#2c7032';
    ctx.beginPath(); ctx.arc(px + 8, py + 9, 5, 0, 7); ctx.fill();
    ctx.fillStyle = sea === 'winter' ? '#487050' : '#37853e';
    ctx.beginPath(); ctx.arc(px + 6.5, py + 7.5, 3.5, 0, 7); ctx.fill();
    if (sea !== 'winter') {
      ctx.fillStyle = '#d13b4e';
      for (const [ox, oy] of [[5, 8], [9, 7], [8, 11]]) {
        ctx.beginPath(); ctx.arc(px + ox, py + oy, 1.4, 0, 7); ctx.fill();
      }
    }
  } else if (t.o === 'fiber') {
    const sw = Math.sin(gtime * 2 + x * 3) * 0.7;
    ctx.strokeStyle = '#a8b657';
    ctx.lineWidth = 1.4;
    for (const [ox, l, k] of [[5, 8, -2], [8, 10, 0], [11, 7, 2]]) {
      ctx.beginPath();
      ctx.moveTo(px + ox, py + 14);
      ctx.quadraticCurveTo(px + ox + k, py + 14 - l / 2, px + ox + k + sw, py + 14 - l);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  } else if (t.o === 'wall') {
    ctx.fillStyle = '#787e8a';
    ctx.fillRect(px, py, TW, TW);
    ctx.fillStyle = '#8b919d';
    ctx.fillRect(px, py, TW, 3);
    ctx.strokeStyle = '#565b66';
    ctx.strokeRect(px + 0.5, py + 0.5, TW - 1, TW - 1);
    ctx.strokeStyle = 'rgba(86,91,102,0.6)';
    ctx.beginPath();
    ctx.moveTo(px, py + 8.5); ctx.lineTo(px + TW, py + 8.5);
    ctx.moveTo(px + 8.5, py); ctx.lineTo(px + 8.5, py + 8);
    ctx.stroke();
  } else if (t.o === 'door') {
    ctx.fillStyle = '#787e8a';
    ctx.fillRect(px, py, TW, TW);
    ctx.fillStyle = '#8a6a3c';
    ctx.fillRect(px + 2, py + 2, TW - 4, TW - 4);
    ctx.strokeStyle = '#5a4426';
    ctx.strokeRect(px + 2.5, py + 2.5, TW - 5, TW - 5);
    ctx.fillStyle = '#5a4426';
    ctx.fillRect(px + TW - 6, py + TW / 2 - 1, 2, 2);
  } else if (t.o === 'bed') {
    ctx.fillStyle = '#2c3f6b';
    ctx.fillRect(px + 2, py + 2, TW - 4, TW - 4);
    ctx.fillStyle = '#3f5a94';
    ctx.fillRect(px + 3, py + 3, TW - 6, TW - 6);
    ctx.fillStyle = '#dfe4ee';
    ctx.fillRect(px + 3, py + 3, TW - 6, 4);
  } else if (t.o === 'table') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(px + 3, py + 12, TW - 6, 2);
    ctx.fillStyle = '#a58548';
    ctx.fillRect(px + 2, py + 3, TW - 4, TW - 7);
    ctx.strokeStyle = '#6e5527';
    ctx.strokeRect(px + 2.5, py + 3.5, TW - 5, TW - 8);
  } else if (t.o === 'fogata') {
    ctx.fillStyle = '#5c5f66';
    for (const [ox, oy] of [[4, 12], [8, 13], [12, 12]]) {
      ctx.beginPath(); ctx.arc(px + ox, py + oy, 2, 0, 7); ctx.fill();
    }
    const fl = 1 + Math.sin(gtime * 9 + t.x) * 0.25;
    ctx.fillStyle = '#e88a2a';
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 12); ctx.lineTo(px + 8, py + 12 - 8 * fl); ctx.lineTo(px + 12, py + 12);
    ctx.fill();
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.moveTo(px + 6, py + 12); ctx.lineTo(px + 8, py + 12 - 4.5 * fl); ctx.lineTo(px + 10, py + 12);
    ctx.fill();
  } else if (t.o === 'fogon') {
    ctx.fillStyle = '#4a4e57';
    ctx.fillRect(px + 2, py + 4, TW - 4, TW - 6);
    ctx.fillStyle = '#2b2d33';
    ctx.beginPath(); ctx.arc(px + 8, py + 9, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#c96f35';
    ctx.beginPath(); ctx.arc(px + 8, py + 9, 2.5, 0, 7); ctx.fill();
  } else if (t.o === 'taller') {
    ctx.fillStyle = '#6e5527';
    ctx.fillRect(px + 1, py + 4, TW - 2, TW - 6);
    ctx.fillStyle = '#a58548';
    ctx.fillRect(px + 2, py + 5, TW - 4, 4);
    ctx.font = '8px sans-serif';
    ctx.fillText('⚒️', px + TW / 2, py + TW - 3);
  } else if (t.o === 'telar') {
    ctx.fillStyle = '#7a6234';
    ctx.fillRect(px + 2, py + 3, TW - 4, TW - 5);
    ctx.strokeStyle = '#d8d2b8';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(px + 4 + i * 3, py + 4);
      ctx.lineTo(px + 4 + i * 3, py + TW - 3);
      ctx.stroke();
    }
  } else if (t.o === 'statue') {
    ctx.fillStyle = '#9aa0ac';
    ctx.fillRect(px + 4, py + 11, 8, 3);
    ctx.font = '11px sans-serif';
    ctx.fillText('🗿', px + TW / 2, py + 11);
  } else if (t.o === 'farol') {
    ctx.fillStyle = '#54381c';
    ctx.fillRect(px + 7, py + 6, 2, 9);
    ctx.fillStyle = '#3d2a14';
    ctx.fillRect(px + 5, py + 14, 6, 2);
    ctx.fillStyle = darkness() > 0.05 ? '#ffd97a' : '#c9a95e';
    ctx.fillRect(px + 5.5, py + 3, 5, 5);
    ctx.strokeStyle = '#3d2a14';
    ctx.strokeRect(px + 5.5, py + 3, 5, 5);
  } else if (t.o === 'herb') {
    const sw = Math.sin(gtime * 2.2 + x * 2) * 0.6;
    ctx.strokeStyle = '#5fae6a';
    ctx.lineWidth = 1.4;
    for (const [ox, l, k] of [[6, 7, -1.5], [9, 9, 1], [11, 6, 2]]) {
      ctx.beginPath();
      ctx.moveTo(px + ox, py + 14);
      ctx.quadraticCurveTo(px + ox + k, py + 14 - l / 2, px + ox + k + sw, py + 14 - l);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.fillStyle = '#cfe8a0';
    ctx.fillRect(px + 8, py + 5, 2, 2);
  } else if (t.o === 'desk') {
    ctx.fillStyle = '#7a5c34';
    ctx.fillRect(px + 1, py + 5, TW - 2, TW - 8);
    ctx.fillStyle = '#8f6f42';
    ctx.fillRect(px + 2, py + 6, TW - 4, 3);
    ctx.fillStyle = '#e9e4d2';
    ctx.fillRect(px + 4, py + 7, 5, 4);
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(px + 11, py + 7, 2, 3);
  } else if (t.o === 'chair') {
    ctx.fillStyle = '#8a6a3c';
    ctx.fillRect(px + 4, py + 7, 8, 6);
    ctx.fillRect(px + 4, py + 2, 2, 6);
    ctx.fillStyle = '#6e5327';
    ctx.fillRect(px + 4, py + 13, 2, 2);
    ctx.fillRect(px + 10, py + 13, 2, 2);
  } else if (t.o === 'shelf') {
    ctx.fillStyle = '#6e5327';
    ctx.fillRect(px + 2, py + 2, TW - 4, TW - 4);
    ctx.fillStyle = '#54401e';
    ctx.fillRect(px + 3, py + 7, TW - 6, 1.5);
    ctx.fillRect(px + 3, py + 11, TW - 6, 1.5);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = ['#a34d4d', '#4d7aa3', '#5da34d', '#c2a23e'][i];
      ctx.fillRect(px + 4 + i * 2.4, py + 3.5, 1.8, 3.5);
    }
  } else if (t.o === 'chest') {
    ctx.fillStyle = '#7a5c34';
    ctx.fillRect(px + 3, py + 5, TW - 6, TW - 8);
    ctx.fillStyle = '#5c431f';
    ctx.fillRect(px + 3, py + 8, TW - 6, 1.5);
    ctx.fillStyle = '#e0c04b';
    ctx.fillRect(px + 7, py + 8, 2, 3);
  } else if (t.o === 'brazier') {
    ctx.fillStyle = '#3a3d45';
    ctx.fillRect(px + 4, py + 8, 8, 4);
    ctx.fillRect(px + 5, py + 12, 2, 3);
    ctx.fillRect(px + 9, py + 12, 2, 3);
    const fl = 1 + Math.sin(gtime * 10 + x * 2) * 0.3;
    ctx.fillStyle = '#e88a2a';
    ctx.beginPath();
    ctx.moveTo(px + 5, py + 8);
    ctx.lineTo(px + 8, py + 8 - 5 * fl);
    ctx.lineTo(px + 11, py + 8);
    ctx.fill();
  } else if (t.o === 'medbed') {
    ctx.fillStyle = '#5c6470';
    ctx.fillRect(px + 2, py + 2, TW - 4, TW - 4);
    ctx.fillStyle = '#eef1f5';
    ctx.fillRect(px + 3, py + 3, TW - 6, TW - 6);
    ctx.fillStyle = '#d64545';
    ctx.fillRect(px + 7, py + 6, 2, 6);
    ctx.fillRect(px + 5, py + 8, 6, 2);
  } else if (t.o === 'pier') {
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(px, py + 3, TW, 10);
    ctx.fillStyle = '#75572f';
    ctx.fillRect(px, py + 6, TW, 1);
    ctx.fillRect(px, py + 9, TW, 1);
    ctx.fillStyle = '#5c431f';
    ctx.fillRect(px + 2, py + 13, 2, 3);
    ctx.fillRect(px + 12, py + 13, 2, 3);
    // caña apuntando al agua más cercana
    ctx.strokeStyle = '#3d2a14';
    ctx.beginPath();
    ctx.moveTo(px + 8, py + 6);
    ctx.lineTo(px + 13, py - 2);
    ctx.stroke();
  }
}

// ============================== MINI-ANIMACIONES DE EVENTOS ==============================
function drawEffectsWorld() {
  for (const e of effects) {
    if (e.kind === 'bolt') {
      // rayo que cae del cielo con quiebres
      ctx.strokeStyle = `rgba(255,255,220,${clamp((e.dur - e.t) * 2, 0, 1)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let bx = e.x + ri(-3, 3), by = e.y - 150;
      ctx.moveTo(bx, by);
      for (let i = 1; i <= 6; i++) {
        bx = e.x + (i === 6 ? 0 : ri(-8, 8));
        by = e.y - 150 + (150 / 6) * i;
        ctx.lineTo(bx, by);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
    } else if (e.kind === 'sparkle') {
      // chispas doradas que se abren en círculo
      ctx.fillStyle = `rgba(255,220,110,${clamp(1 - e.t / e.dur, 0, 1)})`;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + e.t;
        const d = 4 + e.t * 16;
        ctx.fillRect(e.x + Math.cos(a) * d - 1, e.y + Math.sin(a) * d - 1, 2.5, 2.5);
      }
    } else if (e.kind === 'bugs') {
      // bichos que corretean por el cultivo
      ctx.fillStyle = `rgba(60,45,25,${clamp(1.5 - e.t / e.dur * 1.5, 0, 1)})`;
      for (let i = 0; i < 7; i++) {
        const bx = e.x + Math.sin(e.t * 6 + i * 2.2) * 12 + Math.cos(i * 3.1) * 6;
        const by = e.y + Math.cos(e.t * 5 + i * 1.7) * 9;
        ctx.fillRect(bx, by, 2.5, 2);
      }
    } else if (e.kind === 'stars') {
      const c = colonists.find(x => x.id === e.cid);
      if (!c) continue;
      ctx.font = '8px sans-serif';
      for (let i = 0; i < 3; i++) {
        const a = gtime * 3 + i * 2.1;
        ctx.fillText('✨', c.x + Math.cos(a) * 11, c.y - 6 + Math.sin(a) * 5);
      }
    } else if (e.kind === 'cloud') {
      const c = colonists.find(x => x.id === e.cid);
      if (!c) continue;
      ctx.fillStyle = 'rgba(90,95,110,0.75)';
      for (const [ox, r] of [[-4, 3.5], [0, 4.5], [4, 3.5]]) {
        ctx.beginPath(); ctx.arc(c.x + ox, c.y - 18, r, 0, 7); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(120,150,200,0.7)';
      for (let i = 0; i < 3; i++) {
        const dy = (gtime * 18 + i * 4) % 8;
        ctx.beginPath();
        ctx.moveTo(c.x - 4 + i * 4, c.y - 14 + dy);
        ctx.lineTo(c.x - 4 + i * 4, c.y - 12 + dy);
        ctx.stroke();
      }
    } else if (e.kind === 'fox') {
      // el zorro entra, roba y se escapa
      let px, py;
      if (e.t < 3.2) {
        const p = e.t / 3.2;
        px = e.from.x + (e.to.x - e.from.x) * p;
        py = e.from.y + (e.to.y - e.from.y) * p;
      } else if (e.t < 3.9) {
        px = e.to.x; py = e.to.y;
        if (!e.grabbed) { e.grabbed = true; addFloater(e.to.x, e.to.y - 8, `-${e.n} 🍎`); }
      } else {
        const p = (e.t - 3.9) / (e.dur - 3.9);
        px = e.to.x + (e.from.x - e.to.x) * p;
        py = e.to.y + (e.from.y - e.to.y) * p;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(px, py + 5, 5, 2, 0, 0, 7); ctx.fill();
      ctx.font = '12px sans-serif';
      ctx.fillText('🦊', px, py + 4 + Math.sin(e.t * 18) * 1.5);
    }
  }
}

function drawFire(px, py, x, y) {
  const fl = 1 + Math.sin(gtime * 11 + x * 3 + y) * 0.3;
  ctx.fillStyle = 'rgba(232,110,30,0.85)';
  ctx.beginPath();
  ctx.moveTo(px + 2, py + 14);
  ctx.lineTo(px + 5, py + 14 - 9 * fl);
  ctx.lineTo(px + 8, py + 14 - 4);
  ctx.lineTo(px + 11, py + 14 - 10 * fl);
  ctx.lineTo(px + 14, py + 14);
  ctx.fill();
  ctx.fillStyle = 'rgba(245,197,66,0.9)';
  ctx.beginPath();
  ctx.moveTo(px + 5, py + 14);
  ctx.lineTo(px + 8, py + 14 - 6 * fl);
  ctx.lineTo(px + 11, py + 14);
  ctx.fill();
  // humo
  ctx.fillStyle = 'rgba(90,90,95,0.35)';
  const sy = (gtime * 9 + x * 5) % 12;
  ctx.beginPath(); ctx.arc(px + 8 + Math.sin(gtime * 2 + x) * 2, py + 2 - sy * 0.5, 2.5, 0, 7); ctx.fill();
}

// ============================== DIBUJO PRINCIPAL ==============================
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0c0e12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(cam.z, 0, 0, cam.z, -cam.x * cam.z, -cam.y * cam.z);
  const vx0 = Math.max(0, (cam.x / TW) | 0), vy0 = Math.max(0, (cam.y / TW) | 0);
  const vx1 = Math.min(MW - 1, Math.ceil((cam.x + canvas.width / cam.z) / TW));
  const vy1 = Math.min(MH - 1, Math.ceil((cam.y + canvas.height / cam.z) / TW));
  // suelo pre-renderizado
  const sx = vx0 * TW, sy = vy0 * TW, sw = (vx1 - vx0 + 1) * TW, sh = (vy1 - vy0 + 1) * TW;
  ctx.drawImage(terrain, sx, sy, sw, sh, sx, sy, sw, sh);
  // brillo animado del agua
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  for (let y = vy0; y <= vy1; y++) for (let x = vx0; x <= vx1; x++) {
    const t = T(x, y);
    if (t.g !== 'water' || (x * 7 + y * 11) % 4 !== 0) continue;
    const px = x * TW, py = y * TW;
    const off = Math.sin(gtime * 1.3 + x * 0.9 + y * 1.7) * 3;
    ctx.beginPath();
    ctx.moveTo(px + 4 + off, py + 8);
    ctx.lineTo(px + 10 + off, py + 8);
    ctx.stroke();
  }
  // capas dinámicas del suelo
  for (let y = vy0; y <= vy1; y++) for (let x = vx0; x <= vx1; x++) {
    const t = T(x, y);
    const px = x * TW, py = y * TW;
    if (t.stock) {
      ctx.fillStyle = 'rgba(230,200,90,0.12)';
      ctx.fillRect(px, py, TW, TW);
      ctx.strokeStyle = 'rgba(230,200,90,0.5)';
      ctx.strokeRect(px + 1.5, py + 1.5, TW - 3, TW - 3);
    }
    if (t.farm && t.crop !== null) {
      const g = t.crop;
      ctx.strokeStyle = g >= 1 ? '#e0c04b' : '#7fce5e';
      ctx.lineWidth = 1.5;
      const h = 3 + g * 8;
      for (const ox of [4, 8, 12]) {
        ctx.beginPath();
        ctx.moveTo(px + ox, py + TW - 2);
        ctx.lineTo(px + ox, py + TW - 2 - h);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
    }
    if (t.item) {
      ctx.fillStyle = { wood:'#a3763c', stone:'#9aa0a8', iron:'#b07048', fiber:'#a8b657',
                        food:'#d95555', meat:'#c46a6a' }[t.item.res] || '#ccc';
      ctx.fillRect(px + 4, py + 6, 8, 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.strokeRect(px + 4.5, py + 6.5, 7, 5);
    }
    if (t.desig) {
      ctx.fillStyle = 'rgba(255,160,50,0.30)';
      ctx.fillRect(px, py, TW, TW);
    }
    if (t.bp) {
      ctx.fillStyle = 'rgba(120,180,255,0.28)';
      ctx.fillRect(px, py, TW, TW);
      ctx.strokeStyle = 'rgba(150,200,255,0.8)';
      ctx.strokeRect(px + 1.5, py + 1.5, TW - 3, TW - 3);
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(BUILDS[t.bp.type].icon, px + TW / 2, py + TW / 2 + 3);
    }
  }
  // objetos
  ctx.textAlign = 'center';
  for (let y = vy0; y <= vy1; y++) for (let x = vx0; x <= vx1; x++) {
    const t = T(x, y);
    if (t.o) drawObject(t, x * TW, y * TW);
    if (t.fire > 0) drawFire(x * TW, y * TW, x, y);
  }
  // animales
  ctx.font = '11px sans-serif';
  for (const a of animals) {
    if (a.x < cam.x - 20 || a.x > cam.x + canvas.width / cam.z + 20 ||
        a.y < cam.y - 20 || a.y > cam.y + canvas.height / cam.z + 20) continue;
    if (a.hunted) {
      ctx.strokeStyle = 'rgba(224,91,91,0.9)';
      ctx.beginPath(); ctx.arc(a.x, a.y, 8, 0, 7); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(a.x, a.y + 5, 5, 2, 0, 0, 7); ctx.fill();
    ctx.fillText(ANIMALS[a.kind].emoji, a.x, a.y + 4);
  }
  // el perro de la colonia
  if (colonyDog) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(colonyDog.x, colonyDog.y + 5, 4.5, 1.8, 0, 0, 7); ctx.fill();
    ctx.font = '11px sans-serif';
    const hop = colonyDog.target ? Math.abs(Math.sin(gtime * 12)) * 1.5 : 0;
    ctx.fillText('🐕', colonyDog.x, colonyDog.y + 4 - hop);
  }
  // mercader
  if (trader) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(trader.x, trader.y + 5, 5, 2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a5a2a';
    ctx.beginPath(); ctx.arc(trader.x, trader.y + 1, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(trader.x, trader.y - 5, 3.5, 0, 7); ctx.fill();
    ctx.font = '9px sans-serif';
    ctx.fillText('🧳', trader.x + 8, trader.y + 3);
    ctx.font = '11px sans-serif';
  }
  // colonos
  for (const c of colonists) {
    const bob = (c.path.length || c.moving) ? Math.sin(gtime * 14 + c.id) * 1.2 : 0;
    const st = stageOf(c);
    const bodyR = st === 'baby' ? 3 : st === 'child' ? 4 : 5;
    const headR = st === 'baby' ? 2.2 : st === 'child' ? 2.8 : 3.5;
    const headY = st === 'baby' ? -3 : st === 'child' ? -4 : -5;
    if (selected === c.id) {
      ctx.strokeStyle = controlling === c.id ? '#7fd4ff' : '#fff';
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(c.x, c.y, 10, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(c.x, c.y + 5, bodyR, 2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = c.color;
    ctx.beginPath(); ctx.arc(c.x, c.y + 1 + bob, bodyR, 0, 7); ctx.fill();
    if (c.outfit) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(c.x, c.y + 2 + bob, bodyR - 1, 0, Math.PI); ctx.fill();
    }
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(c.x, c.y + headY + bob, headR, 0, 7); ctx.fill();
    if (invTotal(c) > 0) {
      ctx.fillStyle = '#7a5c34';
      ctx.fillRect(c.x + 4, c.y - 4, 5, 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeRect(c.x + 4.5, c.y - 3.5, 4, 4);
    }
    if (c.task && c.task.phase === 'work' && c.task.workTotal > 0) {
      const p = 1 - c.task.workLeft / c.task.workTotal;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(c.x - 8, c.y + 8, 16, 3);
      ctx.fillStyle = '#e8b04b';
      ctx.fillRect(c.x - 8, c.y + 8, 16 * clamp(p, 0, 1), 3);
    }
  }
  // mini-animaciones de eventos
  ctx.textAlign = 'center';
  drawEffectsWorld();
  // rectángulo de arrastre
  if (dragStart && mouse.in) {
    const x0 = Math.min(dragStart.tx, mouse.tx) * TW, x1 = (Math.max(dragStart.tx, mouse.tx) + 1) * TW;
    const y0 = Math.min(dragStart.ty, mouse.ty) * TW, y1 = (Math.max(dragStart.ty, mouse.ty) + 1) * TW;
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
    ctx.setLineDash([]);
  } else if (mouse.in && !panning) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(mouse.tx * TW + 0.5, mouse.ty * TW + 0.5, TW - 1, TW - 1);
  }
  // noche + resplandor de fogatas
  const dk = darkness();
  if (dk > 0.01) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(10,15,45,${dk})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(cam.z, 0, 0, cam.z, -cam.x * cam.z, -cam.y * cam.z);
    ctx.globalCompositeOperation = 'lighter';
    for (let y = vy0; y <= vy1; y++) for (let x = vx0; x <= vx1; x++) {
      const tt = T(x, y);
      if (tt.o !== 'fogata' && tt.o !== 'farol' && tt.o !== 'brazier' && tt.fire <= 0) continue;
      const fx = x * TW + 8, fy = y * TW + 10;
      const r = (tt.fire > 0 ? 64 : tt.o === 'farol' ? 34 : tt.o === 'brazier' ? 42
                 : 52 + Math.sin(gtime * 8 + x) * 5) * dk / 0.55;
      const g = ctx.createRadialGradient(fx, fy, 4, fx, fy, r);
      g.addColorStop(0, 'rgba(255,170,70,0.45)');
      g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(fx, fy, r, 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // ---- capa de pantalla (texto nítido, sin escalar) ----
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'center';
  // destello del rayo y escarcha de la ola de frío
  for (const e of effects) {
    if (e.kind === 'bolt' && e.t < 0.25) {
      ctx.fillStyle = `rgba(255,255,255,${(0.25 - e.t) * 1.6})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (e.kind === 'frost') {
      ctx.fillStyle = `rgba(160,200,255,${clamp(0.18 * (1 - e.t / e.dur), 0, 0.18)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
  if (gtime < coldSnapUntil) {
    ctx.fillStyle = 'rgba(150,195,255,0.06)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (cam.z >= 0.75) {
    ctx.font = '9px monospace';
    for (const c of colonists) {
      const px = w2sx(c.x), py = w2sy(c.y - 12);
      if (px < -20 || px > canvas.width + 20 || py < -20 || py > canvas.height + 20) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(c.name, px + 1, py + 1);
      ctx.fillStyle = controlling === c.id ? '#7fd4ff' : '#fff';
      ctx.fillText(c.name, px, py);
      if (isSleeping(c) || (c.task && c.task.manual && c.task.type === 'sleep')) {
        ctx.font = '10px sans-serif';
        ctx.fillText('💤', px + 12, py + 2);
        ctx.font = '9px monospace';
      }
      if (c.sick) {
        ctx.font = '10px sans-serif';
        ctx.fillText('🤒', px - 13, py + 2);
        ctx.font = '9px monospace';
      }
    }
    if (trader) {
      const px = w2sx(trader.x), py = w2sy(trader.y - 12);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText('Mercader', px + 1, py + 1);
      ctx.fillStyle = '#e8b04b';
      ctx.fillText('Mercader', px, py);
    }
    if (colonyDog) {
      const px = w2sx(colonyDog.x), py = w2sy(colonyDog.y - 11);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(colonyDog.name, px + 1, py + 1);
      ctx.fillStyle = '#e0c08a';
      ctx.fillText(colonyDog.name, px, py);
    }
  }
  // textos flotantes
  ctx.font = 'bold 10px sans-serif';
  for (const f of floaters) {
    ctx.globalAlpha = clamp(1.3 - f.t, 0, 1);
    const px = w2sx(f.x), py = w2sy(f.y) - f.t * 18;
    ctx.fillStyle = '#000';
    ctx.fillText(f.text, px + 1, py + 1);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(f.text, px, py);
  }
  ctx.globalAlpha = 1;
  // nevada en invierno
  if (season().id === 'winter') {
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (const f of flakes) {
      const fy = (f.y0 + gtime * f.spd) % (canvas.height + 8);
      const fx = (f.x0 + Math.sin(gtime * 0.7 + f.ph) * 24 + gtime * 7) % (canvas.width + 8);
      ctx.fillRect(fx, fy, f.sz, f.sz);
    }
  }
  // burbujas de diálogo
  for (const c of colonists) if (c.say) drawBubble(c);
  if (trader && trader.say) drawBubble(trader);
  // minimapa
  const mm = mmRect();
  ctx.globalAlpha = 0.88;
  ctx.drawImage(mmCanvas, mm.x, mm.y);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#333845';
  ctx.strokeRect(mm.x - 0.5, mm.y - 0.5, mm.w + 1, mm.h + 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.strokeRect(
    mm.x + cam.x / TW * MM_S, mm.y + cam.y / TW * MM_S,
    canvas.width / cam.z / TW * MM_S, canvas.height / cam.z / TW * MM_S);
  // aviso de la Cronista
  if (banner && gtime < banner.until) {
    ctx.font = '13px sans-serif';
    const bw = ctx.measureText(banner.text).width + 40;
    ctx.fillStyle = 'rgba(35,30,20,0.9)';
    ctx.strokeStyle = '#e8b04b';
    ctx.beginPath();
    ctx.roundRect(canvas.width / 2 - bw / 2, 40, bw, 30, 6);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f0e2c0';
    ctx.textAlign = 'center';
    ctx.fillText(banner.text, canvas.width / 2, 60);
  }
  // banner de control
  if (controlling) {
    const c = ctlPawn();
    if (c) {
      ctx.fillStyle = 'rgba(20,25,40,0.85)';
      ctx.fillRect(canvas.width / 2 - 235, 8, 470, 24);
      ctx.strokeStyle = '#7fd4ff';
      ctx.strokeRect(canvas.width / 2 - 235.5, 7.5, 471, 25);
      ctx.fillStyle = '#d8dbe2';
      ctx.font = '12px sans-serif';
      ctx.fillText(`🎮 Controlando a ${c.name} — WASD/flechas mover · E interactuar · Esc soltar`, canvas.width / 2, 24);
    }
  }
  if (mouse.in && !dragStart && !panning) drawTooltip();
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e05b5b';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('La colonia se perdió', canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillStyle = '#d8dbe2';
    ctx.font = '15px sans-serif';
    ctx.fillText('Recargá la página para volver a intentar', canvas.width / 2, canvas.height / 2 + 22);
  }
  if (speed === 0 && !gameOver) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('⏸ PAUSA', canvas.width / 2, 24);
  }
}

function drawBubble(c) {
  const text = c.say.text;
  ctx.font = '10px sans-serif';
  const w = ctx.measureText(text).width + 12;
  const px = w2sx(c.x), py = w2sy(c.y);
  if (px < -w || px > canvas.width + w || py < -40 || py > canvas.height + 20) return;
  const bx = clamp(px, w / 2 + 3, canvas.width - w / 2 - 3);
  const by = Math.max(24, py - 24);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.beginPath();
  ctx.roundRect(bx - w / 2, by - 15, w, 16, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(clamp(px, bx - w / 2 + 6, bx + w / 2 - 6) - 3, by + 1);
  ctx.lineTo(clamp(px, bx - w / 2 + 6, bx + w / 2 - 6) + 3, by + 1);
  ctx.lineTo(px, py - 10);
  ctx.fill();
  ctx.fillStyle = '#1a1d24';
  ctx.textAlign = 'center';
  ctx.fillText(text, bx, by - 3);
}

function drawTooltip() {
  const t = T(mouse.tx, mouse.ty);
  const lines = [];
  for (const c of colonists) if (c.tx === mouse.tx && c.ty === mouse.ty) lines.push(`👤 ${c.name}`);
  for (const a of animals) if (a.tx === mouse.tx && a.ty === mouse.ty)
    lines.push(`${ANIMALS[a.kind].emoji} ${ANIMALS[a.kind].name}${a.hunted ? ' (marcado 🏹)' : ''}`);
  if (trader && trader.tx === mouse.tx && trader.ty === mouse.ty) lines.push('🧳 Mercader');
  if (colonyDog && colonyDog.tx === mouse.tx && colonyDog.ty === mouse.ty)
    lines.push(`🐕 ${colonyDog.name}, el perro de la colonia`);
  if (t.o) lines.push(t.o === 'rock' && t.ore === 'iron' ? '🔩 Veta de hierro' : O_NAME[t.o]);
  if (t.bp) lines.push(`📐 Plano: ${BUILDS[t.bp.type].name}${t.bp.paid ? '' : ' (esperando materiales)'}`);
  if (t.farm) lines.push(t.crop === null ? '🌾 Cultivo (sin sembrar)'
    : t.crop >= 1 ? '🌾 Cultivo ¡listo!' : `🌾 Cultivo ${Math.round(t.crop * 100)}%`);
  if (t.stock) lines.push('📦 Almacén');
  if (t.item) lines.push(`${RES_EMOJI[t.item.res]} ${RES_NAME[t.item.res]} ×${t.item.n}`);
  if (t.desig) lines.push(`⚑ Orden: ${({chop:'talar', mine:'minar', harvest:'cosechar'})[t.desig]}`);
  if (t.fire > 0) lines.push('🔥 ¡EN LLAMAS!');
  if (t.floor) lines.push('🟫 Piso de tablas (+25% velocidad)');
  if (t.indoor) lines.push(`🏠 Interior · belleza ${roomBeautyAt(t)}${roomBeautyAt(t) >= 8 ? ' 🖼️' : roomBeautyAt(t) >= 4 ? ' 🛋️' : ''}`);
  if (t.scorched) lines.push('🌫️ Tierra quemada');
  if (t.g === 'water') lines.push('💧 Agua');
  if (!lines.length) return;
  ctx.font = '10px sans-serif';
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 12;
  const h = lines.length * 13 + 8;
  const bx = clamp(mouse.px + 14, 2, canvas.width - w - 2);
  const by = clamp(mouse.py + 14, 2, canvas.height - h - 2);
  ctx.fillStyle = 'rgba(20,23,30,0.92)';
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.roundRect(bx, by, w, h, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d8dbe2';
  ctx.textAlign = 'left';
  lines.forEach((l, i) => ctx.fillText(l, bx + 6, by + 14 + i * 13));
  ctx.textAlign = 'center';
}
