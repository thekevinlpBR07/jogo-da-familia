/* Efeitos sonoros sintetizados (WebAudio) — nenhum arquivo de áudio necessário. */
(function () {
  const G = window.G;
  let ctx = null;
  let on = true;
  try { on = localStorage.getItem('jf-sound') !== 'off'; } catch (e) { /* sem storage */ }

  function ac() {
    if (!ctx) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return null;
      ctx = new A();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, slide, delay) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, hp, delay) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + (delay || 0);
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp || 800;
    const g = c.createGain();
    g.gain.value = vol || 0.2;
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }
  const S = {
    click: () => tone(660, 0.06, 'triangle', 0.08),
    select: () => { tone(520, 0.07, 'triangle', 0.08); tone(780, 0.08, 'triangle', 0.06, 0, 0.05); },
    play: () => { noise(0.18, 0.12, 1500); tone(300, 0.25, 'sine', 0.12, 700); },
    sup: () => { tone(523, 0.12, 'triangle', 0.1); tone(659, 0.12, 'triangle', 0.1, 0, 0.08); tone(784, 0.2, 'triangle', 0.1, 0, 0.16); },
    attack: () => { noise(0.25, 0.18, 2500); tone(220, 0.18, 'sawtooth', 0.06, 90); },
    hit: () => { noise(0.2, 0.3, 300); tone(120, 0.25, 'square', 0.1, 50); },
    defeat: () => { noise(0.45, 0.22, 600); tone(300, 0.45, 'sawtooth', 0.07, 60); },
    damage: () => { tone(180, 0.35, 'square', 0.14, 70); noise(0.3, 0.2, 200); },
    heal: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'sine', 0.09, 0, i * 0.07)); },
    energy: () => { tone(880, 0.1, 'triangle', 0.07, 1320); },
    stun: () => { [900, 700, 900, 700].forEach((f, i) => tone(f, 0.08, 'sine', 0.06, 0, i * 0.06)); },
    turn: () => { tone(392, 0.18, 'triangle', 0.1); tone(587, 0.3, 'triangle', 0.1, 0, 0.14); },
    event: () => { [440, 554, 659, 880].forEach((f, i) => tone(f, 0.22, 'triangle', 0.08, 0, i * 0.09)); },
    win: () => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.1, 0, i * 0.13)); },
    lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, 'sine', 0.1, 0, i * 0.18)); },
    error: () => tone(160, 0.18, 'square', 0.07),
    emote: () => tone(1046, 0.12, 'sine', 0.08, 1400),
  };
  G.sfx = function (name) {
    if (!on || !S[name]) return;
    try { S[name](); } catch (e) { /* áudio indisponível */ }
  };
  G.sfx.toggle = function () {
    on = !on;
    try { localStorage.setItem('jf-sound', on ? 'on' : 'off'); } catch (e) { /* sem storage */ }
    return on;
  };
  G.sfx.isOn = () => on;
  G.sfx.ctx = ac;
})();
