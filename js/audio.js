'use strict';
// ============================== SONIDO (Web Audio, todo sintetizado) ==============================
let audioCtx = null;
let muted = localStorage.getItem('mcMuted') === '1';

function initAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
// el navegador exige un gesto del usuario antes de reproducir sonido
document.addEventListener('pointerdown', initAudio);
document.addEventListener('keydown', initAudio);

function audioOk() { return !muted && audioCtx && audioCtx.state === 'running'; }

function beep(freq, dur, type, vol, delay, slideTo) {
  if (!audioOk()) return;
  const t0 = audioCtx.currentTime + (delay || 0);
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}
function noiseBurst(dur, filterFreq, vol, delay, hipass) {
  if (!audioOk()) return;
  const t0 = audioCtx.currentTime + (delay || 0);
  const len = Math.max(1, (dur * audioCtx.sampleRate) | 0);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const f = audioCtx.createBiquadFilter();
  f.type = hipass ? 'highpass' : 'lowpass';
  f.frequency.value = filterFreq;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(audioCtx.destination);
  src.start(t0);
}

function sfx(name) {
  if (!audioOk()) return;
  switch (name) {
    case 'chop':   noiseBurst(0.07, 420, 0.10); beep(140, 0.05, 'triangle', 0.05); break;
    case 'mine':   noiseBurst(0.05, 2500, 0.07, 0, true); beep(220, 0.06, 'square', 0.03); break;
    case 'build':  beep(180, 0.06, 'triangle', 0.06); beep(160, 0.06, 'triangle', 0.06, 0.12); break;
    case 'cook':   noiseBurst(0.25, 900, 0.03); beep(520, 0.1, 'sine', 0.03, 0.1); break;
    case 'craft':  beep(300, 0.05, 'square', 0.04); beep(340, 0.05, 'square', 0.04, 0.1); break;
    case 'harvest': noiseBurst(0.09, 1200, 0.04); break;
    case 'eat':    beep(320, 0.05, 'sine', 0.05, 0, 220); break;
    case 'thud':   noiseBurst(0.06, 300, 0.09); break;
    case 'level':  beep(523, 0.09, 'sine', 0.06); beep(659, 0.09, 'sine', 0.06, 0.09); beep(784, 0.14, 'sine', 0.06, 0.18); break;
    case 'baby':   beep(700, 0.1, 'sine', 0.05); beep(900, 0.14, 'sine', 0.05, 0.12); break;
    case 'love':   beep(600, 0.1, 'sine', 0.05); beep(750, 0.1, 'sine', 0.05, 0.1); beep(900, 0.16, 'sine', 0.05, 0.2); break;
    case 'horn':   beep(220, 0.28, 'sawtooth', 0.05); beep(277, 0.24, 'sawtooth', 0.045, 0.26); break;
    case 'bad':    beep(180, 0.3, 'sawtooth', 0.05, 0, 90); break;
    case 'chirp': {
      const f = 2200 + Math.random() * 900;
      beep(f, 0.05, 'sine', 0.028, 0, f * 1.25);
      beep(f * 1.1, 0.06, 'sine', 0.024, 0.09, f * 0.9);
      if (Math.random() < 0.5) beep(f * 1.2, 0.05, 'sine', 0.02, 0.2);
      break;
    }
    case 'cricket':
      for (let i = 0; i < 3; i++) beep(4100 + Math.random() * 300, 0.025, 'sine', 0.016, i * 0.07);
      break;
    case 'wind':   noiseBurst(1.6, 350, 0.02); break;
    case 'douse':  noiseBurst(0.35, 700, 0.05); break;
    case 'splash': noiseBurst(0.15, 950, 0.05); beep(300, 0.08, 'sine', 0.03, 0.05, 180); break;
    case 'bark':   beep(620, 0.07, 'square', 0.05); beep(520, 0.09, 'square', 0.045, 0.11); break;
    case 'fire':   noiseBurst(0.5, 500, 0.06); beep(90, 0.4, 'sawtooth', 0.03); break;
    case 'event':  beep(440, 0.12, 'sine', 0.05); beep(587, 0.18, 'sine', 0.05, 0.13); break;
  }
}

// sonido de eventos solo si pasan dentro de la vista
function sfxAt(name, wx, wy) {
  if (wx < cam.x - 40 || wx > cam.x + canvas.width / cam.z + 40 ||
      wy < cam.y - 40 || wy > cam.y + canvas.height / cam.z + 40) return;
  sfx(name);
}
