/* Trilha sonora sintetizada (WebAudio): nenhuma gravação, tudo é gerado em tempo real.
   Faixas: "Salão dos Reis" (épica), "Churrasco Maluco" (polca engraçada), "Agente 220V" (espião atrapalhado). */
(function () {
  const G = window.G;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const noiseBufs = new WeakMap();

  // ------------------------------------------------------------------ blocos de som
  function noiseBuf(c) {
    if (!noiseBufs.has(c)) {
      const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noiseBufs.set(c, b);
    }
    return noiseBufs.get(c);
  }
  function adsr(c, dest, t, dur, vol, a, r) {
    const g = c.createGain();
    const hold = t + Math.max(a, dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, hold);
    g.gain.exponentialRampToValueAtTime(0.0001, hold + r);
    g.connect(dest);
    return { g, end: hold + r };
  }
  function osc(c, type, f, t, end, detune) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    if (detune) o.detune.value = detune;
    o.start(t);
    o.stop(end + 0.05);
    return o;
  }
  function filt(c, type, f, q) {
    const b = c.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    if (q) b.Q.value = q;
    return b;
  }
  function nsrc(c, t, end) {
    const s = c.createBufferSource();
    s.buffer = noiseBuf(c);
    s.loop = true;
    s.start(t, Math.random());
    s.stop(end + 0.05);
    return s;
  }
  function vib(c, o, t, end, rate, depth, delay) {
    const l = osc(c, 'sine', rate, t, end);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(depth, t + delay + 0.2);
    l.connect(g);
    g.connect(o.frequency);
  }
  const amp = (c, v, dest) => { const g = c.createGain(); g.gain.value = v; g.connect(dest); return g; };

  const V = {
    pad(c, d, t, dur, notes, vol) {
      notes.forEach((m) => {
        const { g, end } = adsr(c, d, t, dur, vol, 0.8, 1.0);
        const lp = filt(c, 'lowpass', 950, 0.4);
        lp.connect(g);
        [-9, 9].forEach((dt) => osc(c, 'sawtooth', mtof(m), t, end, dt).connect(lp));
      });
    },
    horn(c, d, t, dur, m, vol) {
      const f = mtof(m);
      const { g, end } = adsr(c, d, t, dur, vol, 0.06, 0.16);
      const lp = filt(c, 'lowpass', 1500, 1);
      lp.connect(g);
      const o1 = osc(c, 'sawtooth', f, t, end);
      o1.connect(lp);
      osc(c, 'square', f, t, end, 6).connect(amp(c, 0.4, lp));
      vib(c, o1, t, end, 5, f * 0.008, 0.15);
    },
    harp(c, d, t, m, vol) {
      const f = mtof(m);
      const { g, end } = adsr(c, d, t, 0.02, vol, 0.003, 0.7);
      osc(c, 'triangle', f, t, end).connect(g);
      osc(c, 'sine', f * 2, t, end).connect(amp(c, 0.3, g));
    },
    kick(c, d, t, vol) {
      const { g, end } = adsr(c, d, t, 0.02, vol, 0.002, 0.35);
      const o = osc(c, 'sine', 130, t, end);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
      o.connect(g);
    },
    taiko(c, d, t, vol) {
      const { g, end } = adsr(c, d, t, 0.03, vol, 0.003, 0.6);
      const o = osc(c, 'sine', 100, t, end);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.4);
      o.connect(g);
      const n = nsrc(c, t, t + 0.15);
      const lp = filt(c, 'lowpass', 320);
      n.connect(lp);
      lp.connect(amp(c, vol * 0.5, g));
    },
    snare(c, d, t, vol) {
      const e = adsr(c, d, t, 0.01, vol, 0.002, 0.16);
      const hp = filt(c, 'highpass', 1300);
      nsrc(c, t, e.end).connect(hp);
      hp.connect(e.g);
      const e2 = adsr(c, d, t, 0.01, vol * 0.5, 0.002, 0.08);
      osc(c, 'triangle', 190, t, e2.end).connect(e2.g);
    },
    hat(c, d, t, vol) {
      const { g, end } = adsr(c, d, t, 0.005, vol, 0.001, 0.045);
      const hp = filt(c, 'highpass', 7000);
      nsrc(c, t, end).connect(hp);
      hp.connect(g);
    },
    clap(c, d, t, vol) {
      const { g, end } = adsr(c, d, t, 0.008, vol, 0.002, 0.12);
      const bp = filt(c, 'bandpass', 1600, 1.2);
      nsrc(c, t, end).connect(bp);
      bp.connect(g);
    },
    swell(c, d, t, dur, vol) {
      const { g, end } = adsr(c, d, t, dur * 0.1, vol, dur * 0.9, 0.5);
      const bp = filt(c, 'bandpass', 400, 0.8);
      bp.frequency.setValueAtTime(400, t);
      bp.frequency.exponentialRampToValueAtTime(4500, t + dur);
      nsrc(c, t, end).connect(bp);
      bp.connect(g);
    },
    bass(c, d, t, dur, m, vol) {
      const f = mtof(m);
      const { g, end } = adsr(c, d, t, dur, vol, 0.012, 0.1);
      const lp = filt(c, 'lowpass', 520, 0.7);
      lp.connect(g);
      osc(c, 'sawtooth', f, t, end).connect(amp(c, 0.55, lp));
      osc(c, 'sine', f, t, end).connect(lp);
    },
    tuba(c, d, t, dur, m, vol) {
      const f = mtof(m);
      const { g, end } = adsr(c, d, t, dur, vol, 0.012, 0.06);
      const lp = filt(c, 'lowpass', 600, 0.9);
      lp.connect(g);
      osc(c, 'square', f, t, end).connect(amp(c, 0.7, lp));
      osc(c, 'sine', f, t, end).connect(lp);
    },
    accordion(c, d, t, dur, notes, vol) {
      notes.forEach((m) => {
        const { g, end } = adsr(c, d, t, dur, vol, 0.02, 0.05);
        const bp = filt(c, 'bandpass', 1400, 0.6);
        bp.connect(g);
        [-12, 12].forEach((dt) => osc(c, 'sawtooth', mtof(m), t, end, dt).connect(bp));
      });
    },
    whistle(c, d, t, dur, m, vol) {
      const f = mtof(m);
      const { g, end } = adsr(c, d, t, dur, vol, 0.03, 0.08);
      const o = osc(c, 'sine', f, t, end);
      o.connect(g);
      vib(c, o, t, end, 5.5, f * 0.012, 0.1);
      osc(c, 'sine', f * 2, t, end).connect(amp(c, 0.12, g));
    },
    kazoo(c, d, t, dur, m, vol) {
      const f = mtof(m);
      const { g, end } = adsr(c, d, t, dur, vol, 0.02, 0.06);
      const bp = filt(c, 'bandpass', 1300, 2.5);
      const lp = filt(c, 'lowpass', 3500);
      bp.connect(lp);
      lp.connect(g);
      const o = osc(c, 'sawtooth', f, t, end);
      o.connect(bp);
      vib(c, o, t, end, 6.5, f * 0.02, 0.05);
    },
    pluck(c, d, t, m, vol) {
      const f = mtof(m);
      const { g, end } = adsr(c, d, t, 0.01, vol, 0.004, 0.22);
      osc(c, 'triangle', f, t, end).connect(g);
      osc(c, 'sine', f * 2, t, end).connect(amp(c, 0.25, g));
    },
    xylo(c, d, t, m, vol) {
      const f = mtof(m);
      const { g, end } = adsr(c, d, t, 0.005, vol, 0.002, 0.28);
      osc(c, 'sine', f, t, end).connect(g);
      osc(c, 'sine', f * 3.9, t, end).connect(amp(c, 0.28, g));
    },
    boing(c, d, t, vol) {
      const { g, end } = adsr(c, d, t, 0.3, vol, 0.01, 0.2);
      const o = osc(c, 'sine', 240, t, end);
      o.frequency.exponentialRampToValueAtTime(1100, t + 0.12);
      o.frequency.exponentialRampToValueAtTime(320, t + 0.5);
      o.connect(g);
      vib(c, o, t + 0.1, end, 18, 60, 0);
    },
    slide(c, d, t, f0, f1, dur, vol) {
      const { g, end } = adsr(c, d, t, dur, vol, 0.02, 0.1);
      const o = osc(c, 'sine', f0, t, end);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      o.connect(g);
      vib(c, o, t, end, 7, 18, 0.05);
    },
    cowbell(c, d, t, vol) {
      const { g, end } = adsr(c, d, t, 0.01, vol, 0.002, 0.22);
      const bp = filt(c, 'bandpass', 820, 1.6);
      bp.connect(g);
      [587, 845].forEach((f) => osc(c, 'square', f, t, end).connect(bp));
    },
    bongo(c, d, t, vol, f) {
      const { g, end } = adsr(c, d, t, 0.01, vol, 0.002, 0.12);
      const o = osc(c, 'sine', f, t, end);
      o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.1);
      o.connect(g);
    },
  };

  // ------------------------------------------------------------------ acordes e melodias
  // melodia: por compasso, lista de [passo(0-15), nota MIDI, duração em passos]
  const idx = (bars) => bars.map((b) => { const m = {}; b.forEach(([s, n, l]) => { m[s] = [n, l]; }); return m; });

  const EP = {
    Dm: { bass: 38, tri: [57, 62, 65] }, Bb: { bass: 46, tri: [58, 62, 65] }, F: { bass: 41, tri: [57, 60, 65] },
    C: { bass: 48, tri: [55, 60, 64] }, Gm: { bass: 43, tri: [58, 62, 67] }, A: { bass: 45, tri: [57, 61, 64] },
  };
  const EP_CH = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'A', 'A', 'Gm', 'Dm', 'Bb', 'F', 'Gm', 'C', 'A', 'A'];
  const EP_MEL = idx([
    [[0, 74, 4], [4, 77, 4], [8, 81, 6], [14, 79, 2]],
    [[0, 82, 4], [4, 81, 4], [8, 77, 8]],
    [[0, 77, 4], [4, 81, 4], [8, 84, 6], [14, 82, 2]],
    [[0, 79, 8], [8, 76, 4], [12, 79, 4]],
    [[0, 74, 4], [4, 77, 4], [8, 81, 6], [14, 82, 2]],
    [[0, 86, 8], [8, 84, 4], [12, 82, 4]],
    [[0, 81, 4], [4, 85, 4], [8, 86, 4], [12, 85, 4]],
    [[0, 81, 12]],
    [[0, 82, 6], [6, 79, 2], [8, 82, 4], [12, 86, 4]],
    [[0, 86, 6], [6, 81, 2], [8, 77, 4], [12, 81, 4]],
    [[0, 82, 4], [4, 86, 4], [8, 89, 8]],
    [[0, 84, 4], [4, 89, 4], [8, 88, 4], [12, 84, 4]],
    [[0, 86, 4], [4, 82, 4], [8, 79, 4], [12, 82, 4]],
    [[0, 84, 8], [8, 79, 4], [12, 84, 4]],
    [[0, 85, 4], [4, 88, 4], [8, 86, 4], [12, 85, 4]],
    [[0, 81, 8], [8, 81, 4]],
  ]);

  const PO = {
    C: { r: 36, f: 43, ch: [60, 64, 67] }, G: { r: 43, f: 50, ch: [59, 62, 67] }, F: { r: 41, f: 48, ch: [60, 65, 69] },
  };
  const PO_CH = ['C', 'C', 'G', 'G', 'C', 'C', 'G', 'C', 'F', 'F', 'C', 'C', 'G', 'G', 'G', 'C'];
  const PO_MEL = idx([
    [[0, 76, 2], [2, 76, 2], [4, 76, 2], [6, 72, 2], [8, 76, 4], [12, 79, 4]],
    [[0, 84, 6], [6, 79, 2], [8, 76, 4], [12, 72, 4]],
    [[0, 74, 2], [2, 74, 2], [4, 74, 2], [6, 79, 2], [8, 83, 4], [12, 79, 4]],
    [[0, 74, 8], [8, 79, 4], [12, 83, 4]],
    [[0, 76, 2], [2, 76, 2], [4, 76, 2], [6, 72, 2], [8, 76, 4], [12, 81, 4]],
    [[0, 84, 4], [4, 81, 4], [8, 79, 4], [12, 76, 4]],
    [[0, 74, 4], [4, 77, 4], [8, 74, 4], [12, 71, 4]],
    [[0, 72, 8], [10, 79, 2], [12, 84, 4]],
    [[0, 81, 2], [2, 84, 2], [4, 81, 2], [6, 77, 2], [8, 81, 8]],
    [[0, 77, 4], [4, 81, 4], [8, 84, 8]],
    [[0, 79, 2], [2, 76, 2], [4, 79, 2], [6, 84, 2], [8, 79, 8]],
    [[0, 76, 4], [4, 72, 4], [8, 76, 8]],
    [[0, 79, 2], [2, 83, 2], [4, 86, 2], [6, 83, 2], [8, 79, 8]],
    [[0, 83, 4], [4, 79, 4], [8, 74, 8]],
    [[0, 79, 2], [2, 77, 2], [4, 76, 2], [6, 74, 2], [8, 71, 8]],
    [[0, 72, 8], [8, 76, 2], [10, 79, 2], [12, 84, 4]],
  ]);

  const SP_BASS = {
    Am: [45, 45, 48, 48, 50, 51, 52, 52], E7: [52, 52, 56, 56, 59, 58, 57, 56], Dm: [50, 50, 53, 53, 55, 56, 57, 57],
  };
  const SP_CH = ['Am', 'Am', 'Am', 'E7', 'Am', 'Am', 'Dm', 'E7', 'Am', 'Am', 'Am', 'E7', 'Dm', 'E7', 'Am', 'Am'];
  const SP_MEL = idx([
    [[0, 69, 2], [3, 72, 1], [4, 71, 2], [6, 69, 2], [8, 68, 2], [10, 69, 4]],
    [[0, 72, 2], [2, 71, 2], [4, 69, 2], [6, 68, 2], [8, 69, 4]],
    [[0, 69, 2], [3, 72, 1], [4, 71, 2], [6, 69, 2], [8, 68, 2], [10, 69, 4]],
    [[0, 68, 2], [2, 71, 2], [4, 74, 2], [6, 71, 2], [8, 68, 4], [12, 71, 2], [14, 68, 2]],
    [[0, 69, 2], [2, 76, 2], [4, 74, 2], [6, 72, 2], [8, 71, 2], [10, 69, 2], [12, 68, 4]],
    [[0, 69, 2], [2, 72, 2], [4, 76, 4], [8, 74, 2], [10, 72, 2], [12, 71, 4]],
    [[0, 74, 2], [2, 77, 2], [4, 81, 4], [8, 77, 2], [10, 74, 2], [12, 72, 4]],
    [[0, 76, 2], [2, 74, 2], [4, 71, 2], [6, 68, 2], [8, 71, 8]],
    [[0, 81, 2], [2, 81, 2], [4, 76, 2], [6, 76, 2], [8, 81, 2], [10, 81, 2], [12, 76, 4]],
    [[0, 72, 2], [2, 76, 2], [4, 81, 4], [8, 79, 2], [10, 77, 2], [12, 76, 4]],
    [[0, 81, 2], [2, 81, 2], [4, 76, 2], [6, 76, 2], [8, 81, 2], [10, 81, 2], [12, 76, 4]],
    [[0, 80, 2], [2, 76, 2], [4, 71, 2], [6, 76, 2], [8, 80, 8]],
    [[0, 77, 2], [2, 81, 2], [4, 77, 2], [6, 74, 2], [8, 77, 4], [12, 81, 4]],
    [[0, 80, 2], [2, 83, 2], [4, 80, 2], [6, 76, 2], [8, 80, 4], [12, 83, 4]],
    [[0, 81, 4], [4, 76, 4], [8, 72, 4], [12, 69, 4]],
    [[0, 69, 2], [2, 71, 2], [4, 72, 2], [6, 74, 2], [8, 76, 2], [10, 77, 2], [12, 76, 2]],
  ]);

  // ------------------------------------------------------------------ as faixas
  const TRACKS = {
    epic: {
      name: 'Salão dos Reis', emoji: '⚔️', bpm: 92, bars: 16, loops: 2,
      onStep(c, d, t, i, sd) {
        const bar = i >> 4, s = i & 15, B = bar >= 8, ch = EP[EP_CH[bar]];
        if (s === 0) V.pad(c, d, t, sd * 16 * 0.97, ch.tri, B ? 0.05 : 0.04);
        if (s === 0 && (bar === 0 || bar === 8)) V.swell(c, d, t - sd * 0 , sd * 6, 0.05);
        if (B ? s % 2 === 0 : s % 4 === 0) V.bass(c, d, t, sd * (B ? 1.7 : 3.5), ch.bass, B ? 0.13 : 0.12);
        if (s === 0) V.kick(c, d, t, 0.32);
        if (!B && bar >= 2 && s === 8) V.taiko(c, d, t, 0.34);
        if (B) {
          if (s === 8 || s === 10) V.kick(c, d, t, 0.28);
          if (s === 4 || s === 12) V.snare(c, d, t, 0.14);
          if (s % 2 === 0) V.hat(c, d, t, 0.05);
          if (s === 14 && bar % 4 === 3) V.taiko(c, d, t, 0.3);
        } else if (bar >= 4 && (s === 4 || s === 12)) V.hat(c, d, t, 0.04);
        if (bar >= 4 && s % 2 === 0) V.harp(c, d, t, ch.tri[[0, 1, 2, 1][(s / 2) % 4]] + 12, B ? 0.04 : 0.032);
        const n = EP_MEL[bar][s];
        if (n) {
          V.horn(c, d, t, sd * n[1] * 0.95, n[0], B ? 0.075 : 0.06);
          if (B) V.horn(c, d, t, sd * n[1] * 0.95, n[0] - 12, 0.04);
        }
      },
    },
    funny1: {
      name: 'Churrasco Maluco', emoji: '🥩', bpm: 152, bars: 16, loops: 3,
      onStep(c, d, t, i, sd) {
        const bar = i >> 4, s = i & 15, B = bar >= 8, ch = PO[PO_CH[bar]];
        if (s === 0) V.tuba(c, d, t, sd * 3, ch.r, 0.2);
        if (s === 8) V.tuba(c, d, t, sd * 3, ch.f, 0.19);
        if (s === 4 || s === 12) V.accordion(c, d, t, sd * 2.4, ch.ch, 0.035);
        if (s === 4 || s === 12) V.snare(c, d, t, 0.07);
        if (s % 4 === 2) V.hat(c, d, t, 0.05);
        if (bar % 4 === 3 && (s === 12 || s === 14)) V.cowbell(c, d, t, 0.07);
        const n = PO_MEL[bar][s];
        if (n) (B ? V.kazoo : V.whistle)(c, d, t, sd * n[1] * 0.92, n[0], B ? 0.09 : 0.11);
        if ((bar === 7 || bar === 15) && s === 14) V.boing(c, d, t, 0.14);
        if (bar === 15 && s === 8) V.slide(c, d, t, 500, 2200, sd * 4, 0.07);
      },
    },
    funny2: {
      name: 'Agente 220V', emoji: '🕵️', bpm: 126, bars: 16, loops: 2,
      onStep(c, d, t, i, sd) {
        const bar = i >> 4, s = i & 15, B = bar >= 8, name = SP_CH[bar];
        if (s % 2 === 0) V.bass(c, d, t, sd * 1.5, SP_BASS[name][s / 2], 0.14);
        if ([0, 3, 6, 8, 11, 14].includes(s)) V.bongo(c, d, t, 0.12, s % 3 === 0 ? 220 : 300);
        if (s === 4 || s === 12) V.clap(c, d, t, 0.07);
        if (s % 2 === 1) V.hat(c, d, t, 0.04);
        const n = SP_MEL[bar][s];
        if (n) {
          if (B) V.kazoo(c, d, t, sd * n[1] * 0.85, n[0], 0.085);
          else V.xylo(c, d, t, n[0], 0.14);
        }
        if (bar === 7 && s === 14) V.boing(c, d, t, 0.13);
        if (bar === 15 && s === 12) V.slide(c, d, t, 1800, 300, sd * 4, 0.07);
      },
    },
  };
  const ORDER = ['epic', 'funny1', 'funny2'];

  // ------------------------------------------------------------------ player
  function store(k, d) { try { const v = localStorage.getItem('jf-' + k); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem('jf-' + k, v); } catch (e) { /* sem storage */ } }

  // Faixas gravadas (geradas no Google Flow Music) + trilha sintetizada de reserva
  const FILES = {
    royal: { name: 'The Royal Gambit', emoji: '⚔️', url: 'assets/music/royal-gambit.m4a', loop: true },
    polka: { name: 'Churrasco Polka Panic', emoji: '🥩', url: 'assets/music/churrasco-polka-panic.m4a', loop: true },
  };
  const abs = (p) => new URL(p, document.baseURI).href;
  const themeTrack = (key) => { const t = (G.THEMES || []).find((x) => x.key === key); return t ? { name: 'Tema do ' + t.name, emoji: t.emoji, url: t.url } : null; };
  const SYNTH = { seq: 'Sintetizada: sequência', epic: 'Sintetizada: ' + TRACKS.epic.name, funny1: 'Sintetizada: ' + TRACKS.funny1.name, funny2: 'Sintetizada: ' + TRACKS.funny2.name };
  let EXTRAS = []; // músicas extras listadas em assets/music/extras/extras.json
  const extraTrack = (i) => { const e = EXTRAS[+i]; return e ? { name: e.name, emoji: e.emoji || '🎵', url: abs('assets/music/extras/' + e.file) } : null; };
  const validMode = (m) => m === 'off' || m === 'todas' || m.startsWith('extra:') || m === 'temas' || FILES[m] || SYNTH[m] || (m.startsWith('tema:') && themeTrack(m.slice(5)));
  const saved = store('music2', 'royal');

  const M = (G.Music = {
    mode: validMode(saved) ? saved : 'royal',
    vol: Math.min(1, Math.max(0, parseFloat(store('music-vol3', '0.4')) || 0.4)), // posição do controle (0..1); o ganho real usa uma curva
    entrance: store('music-entrance', 'on') !== 'off', // trecho do tema quando uma Lendária entra em campo
    tracks: TRACKS,
    onTrack: null,
    onState: null, // chamado quando muda o estado (tocando/pausado/faixa)
    now: null,     // faixa atual: { name, emoji }
  });
  let ctx = null, master = null, timer = null, cur = null, step = 0, loops = 0, nextT = 0, playing = false;
  let paused = false, hist = [];
  let audio = null, audioFade = null, lastTheme = null, stingAudio = null, stingT = null, ducked = false;
  const synthMode = () => !!SYNTH[M.mode];
  const curve = (v) => v * v;
  const fileGain = () => curve(M.vol) * 0.9 * (ducked ? 0.2 : 1);

  // ---------- arquivos
  function fadeAudio(a, to, ms, done) {
    clearInterval(a.__f);
    const from = a.volume, t0 = performance.now();
    a.__f = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k >= 1) { clearInterval(a.__f); if (done) done(); }
    }, 40);
  }
  function playFile(tr, loop, onEnd) {
    if (audio) { const old = audio; fadeAudio(old, 0, 500, () => { old.pause(); old.src = ''; }); }
    const a = new Audio(tr.url);
    a.loop = loop;
    a.volume = 0;
    a.onended = onEnd || null;
    a.play().catch(() => {});
    audio = a;
    fadeAudio(a, fileGain(), 1500);
    M.now = { name: tr.name, emoji: tr.emoji };
    if (M.onTrack) M.onTrack(M.mode, tr);
    state();
  }
  function nextTheme() {
    const list = (G.THEMES || []).filter((t) => t.key !== lastTheme);
    const t = list[Math.floor(Math.random() * list.length)];
    if (lastTheme) hist.push(lastTheme);
    lastTheme = t.key;
    playFile({ name: 'Tema do ' + t.name, emoji: t.emoji, url: t.url }, false, () => { if (playing && M.mode === 'temas') nextTheme(); });
  }
  // quando uma faixa acaba, começa outra, sorteada entre todas (menos a que acabou de tocar)
  let curId = null;
  function shuffleNext() {
    const ids = cycleIds().filter((i) => i !== curId);
    curId = ids[Math.floor(Math.random() * ids.length)];
    const t = trackOf(curId);
    lastTheme = null;
    if (t) playFile(t, false, () => { if (playing && !Sy.on) { if (M.mode !== 'temas') M.mode = 'todas'; shuffleNext(); } });
  }
  function startFileMode() {
    if (M.mode === 'temas') return nextTheme();
    if (M.mode === 'todas') return shuffleNext();
    curId = M.mode;
    const tr = trackOf(M.mode);
    if (tr) playFile(tr, false, () => { if (playing && !Sy.on) { M.mode = 'todas'; state(); shuffleNext(); } });
  }

  // ---------- sintetizada (WebAudio)
  function chain(c) {
    const out = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    out.connect(comp);
    comp.connect(c.destination);
    return out;
  }
  function beginSynth(id) {
    cur = TRACKS[id];
    step = 0;
    loops = 0;
    nextT = ctx.currentTime + 0.12;
    M.now = { name: cur.name, emoji: cur.emoji };
    if (M.onTrack) M.onTrack(id, cur);
    state();
  }
  function tick() {
    if (!playing || !ctx || !cur) return;
    if (nextT < ctx.currentTime - 0.3) nextT = ctx.currentTime + 0.05;
    const sd = 60 / cur.bpm / 4;
    while (nextT < ctx.currentTime + 0.3) {
      try { cur.onStep(ctx, master, nextT, step, sd); } catch (e) { console.error('música', e); }
      step++;
      nextT += sd;
      if (step >= cur.bars * 16) {
        step = 0;
        loops++;
        if (M.mode === 'seq' && loops >= cur.loops) {
          const id = ORDER[(ORDER.indexOf(Object.keys(TRACKS).find((k) => TRACKS[k] === cur)) + 1) % ORDER.length];
          cur = TRACKS[id];
          loops = 0;
          M.now = { name: cur.name, emoji: cur.emoji };
          if (M.onTrack) M.onTrack(id, cur);
          state();
        }
      }
    }
  }
  function startSynth() {
    ctx = G.sfx && G.sfx.ctx && G.sfx.ctx();
    if (!ctx) return;
    if (!master || master.context !== ctx) master = chain(ctx);
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.linearRampToValueAtTime(curve(M.vol) * 0.75 * (ducked ? 0.2 : 1), ctx.currentTime + 1.8);
    beginSynth(M.mode === 'seq' ? ORDER[0] : M.mode);
    clearInterval(timer);
    timer = setInterval(tick, 40);
  }

  // ---------- modo online: os dois ouvem a mesma faixa, no mesmo ponto
  // O anfitrião manda: guarda S = { mode, track, started (hora do anfitrião em que a faixa estava em 0:00), paused, pos }
  // e reenvia a cada 4 s. O convidado toca a mesma faixa e se corrige se desviar mais de ~0,5 s.
  const Sy = { on: false, role: null, send: null, hostNow: () => Date.now(), S: null, beat: null, drift: null, hist: [], localMute: false };
  const trackOf = (id) => {
    let t = null;
    if (FILES[id]) t = FILES[id];
    else if (id.startsWith('extra:')) t = extraTrack(id.slice(6));
    else if (id.startsWith('tema:')) t = themeTrack(id.slice(5));
    return t ? Object.assign({ id }, t) : null;
  };
  const isSyncable = (m) => m === 'temas' || m === 'todas' || !!FILES[m] || (m.startsWith('extra:') && !!extraTrack(m.slice(6))) || (m.startsWith('tema:') && !!themeTrack(m.slice(5)));
  const pub = () => { if (Sy.send && Sy.S) Sy.send({ type: 'music', S: Sy.S }); };
  function syncTarget() {
    const S = Sy.S;
    if (!S) return 0;
    if (S.paused) return S.pos || 0;
    const el = (Sy.hostNow() - S.started) / 1000;
    const dur = audio && audio.duration;
    if (audio && audio.loop && isFinite(dur) && dur > 0) return el % dur;
    return Math.max(0, el);
  }
  function fixDrift(force) {
    if (!audio || !Sy.S || Sy.S.paused) return;
    const t = syncTarget();
    let diff = audio.currentTime - t;
    const dur = audio.duration;
    if (audio.loop && isFinite(dur) && dur > 0) diff = ((diff + dur / 2) % dur + dur) % dur - dur / 2;
    if (Math.abs(diff) > (force ? 0.15 : 0.45)) { try { audio.currentTime = t; } catch (e) { /* ainda carregando */ } }
  }
  // baixa a faixa inteira para a memória: arquivo em memória sempre permite pular para qualquer ponto,
  // mesmo em servidores sem suporte a "Range" (necessário para manter os dois sincronizados)
  const blobs = new Map();
  function blobUrl(url) {
    if (!blobs.has(url)) blobs.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error('http'); return r.blob(); }).then((b) => URL.createObjectURL(b)).catch(() => url));
    return blobs.get(url);
  }
  function applyS() {
    const S = Sy.S;
    if (!S || !playing) return;
    const tr = trackOf(S.track);
    if (!tr) return;
    M.mode = S.mode;
    paused = S.paused;
    if (!audio || audio.__id !== S.track) {
      if (audio) { const old = audio; fadeAudio(old, 0, 500, () => { old.pause(); old.src = ''; }); }
      const a = new Audio();
      a.__id = S.track;
      a.loop = false;
      a.volume = 0;
      a.muted = Sy.localMute;
      a.onended = () => { if (Sy.role === 'host' && Sy.S && playing && audio === a && !Sy.S.paused) hostPick(Sy.S.mode === 'temas' ? 'temas' : 'todas'); };
      audio = a;
      a.addEventListener('loadedmetadata', () => {
        const t = syncTarget();
        if (isFinite(t) && t > 0.3) { try { a.currentTime = t; } catch (e) { /* ignora */ } }
        if (Sy.S && Sy.S.paused) a.pause();
      }, { once: true });
      blobUrl(tr.url).then((u) => {
        if (audio !== a) return; // a faixa mudou enquanto carregava
        a.src = u;
        if (!(Sy.S && Sy.S.paused)) a.play().catch(() => {});
      });
      fadeAudio(a, fileGain(), 1200);
      M.now = { name: tr.name, emoji: tr.emoji };
      if (M.onTrack) M.onTrack(S.mode, tr);
    } else if (S.paused) {
      audio.pause();
      try { audio.currentTime = S.pos || 0; } catch (e) { /* ignora */ }
    } else {
      audio.play().catch(() => {});
      fixDrift(true);
    }
    state();
  }
  function randomThemeId() {
    const cur = Sy.S && Sy.S.track && Sy.S.track.startsWith('tema:') ? Sy.S.track.slice(5) : null;
    const list = (G.THEMES || []).filter((t) => t.key !== cur);
    return 'tema:' + list[Math.floor(Math.random() * list.length)].key;
  }
  function randomAnyId() {
    const cur = Sy.S && Sy.S.track;
    const ids = cycleIds().filter((i) => i !== cur);
    return ids[Math.floor(Math.random() * ids.length)];
  }
  function hostPick(mode, forceTrack) {
    let track = forceTrack;
    if (!track) track = mode === 'temas' ? randomThemeId() : mode === 'todas' ? randomAnyId() : mode;
    if (mode === 'temas' && !forceTrack && Sy.S && Sy.S.track && Sy.S.track.startsWith('tema:')) Sy.hist.push(Sy.S.track);
    Sy.S = { mode, track, started: Date.now(), paused: false, pos: 0, seq: (Sy.S ? Sy.S.seq : 0) + 1 };
    applyS();
    pub();
  }
  function hostSkip(dir) {
    const S = Sy.S;
    if (!S) return hostPick(M.mode);
    if (S.mode === 'temas') {
      if (dir < 0 && Sy.hist.length) return hostPick('temas', Sy.hist.pop());
      return hostPick('temas');
    }
    const ids = cycleIds();
    let i = ids.indexOf(S.track);
    i = i < 0 ? 0 : (i + dir + ids.length) % ids.length;
    hostPick(ids[i]);
  }
  function hostToggle() {
    const S = Sy.S;
    if (!S) return hostPick(M.mode);
    if (S.paused) { S.paused = false; S.started = Date.now() - (S.pos || 0) * 1000; }
    else {
      const dur = audio && audio.duration;
      const el = (Date.now() - S.started) / 1000;
      S.paused = true;
      S.pos = isFinite(dur) && dur > 0 ? el % dur : el;
    }
    S.seq++;
    applyS();
    pub();
  }
  function syncCmd(cmd, arg) {
    if (Sy.role === 'guest') { if (Sy.send) Sy.send({ type: 'musicCmd', cmd, arg }); return; }
    if (cmd === 'skip') hostSkip(arg);
    else if (cmd === 'toggle') hostToggle();
    else if (cmd === 'mode' && isSyncable(arg)) hostPick(arg);
  }
  function syncStart() {
    if (playing) return;
    playing = true;
    paused = false;
    clearInterval(Sy.beat); clearInterval(Sy.drift);
    Sy.drift = setInterval(() => fixDrift(false), 2000);
    if (Sy.role === 'host') { Sy.beat = setInterval(() => { if (playing) pub(); }, 4000); hostPick(isSyncable(M.mode) ? M.mode : 'royal'); }
    else if (Sy.S) applyS();
    state();
  }
  M.sync = {
    // role: 'host' | 'guest'; send(msg) manda ao outro jogador; hostNow() = relógio do anfitrião
    enable(role, send, hostNow) {
      Sy.on = true; Sy.role = role; Sy.send = send; Sy.hostNow = hostNow || (() => Date.now());
      Sy.hist = [];
      if (role === 'host' && !playing) Sy.S = null; // se já está tocando (convidado reconectou / revanche), mantém o estado
      if (!isSyncable(M.mode)) M.mode = 'royal';
    },
    disable() { Sy.on = false; Sy.send = null; clearInterval(Sy.beat); clearInterval(Sy.drift); Sy.S = null; Sy.localMute = false; },
    receive(m) {
      if (m.type === 'music' && m.S) { Sy.S = m.S; if (Sy.on && Sy.role === 'guest' && playing) applyS(); }
      else if (m.type === 'musicCmd' && Sy.on && Sy.role === 'host') syncCmd(m.cmd, m.arg);
    },
    info() { return { dbg: audio ? { dur: audio.duration, rs: audio.readyState, buf: audio.buffered.length ? audio.buffered.end(audio.buffered.length - 1) : 0, seek: audio.seekable.length ? audio.seekable.end(audio.seekable.length - 1) : 0, loop: audio.loop, paused: audio.paused } : null, track: Sy.S && Sy.S.track, paused: Sy.S && Sy.S.paused, cur: audio ? audio.currentTime : null, target: syncTarget(), muted: Sy.localMute, started: Sy.S && Sy.S.started }; },
    isOn: () => Sy.on,
    resend: pub, // reenvia o estado atual ao convidado (ex.: ele acabou de entrar)
    _audio: () => audio, // só para testes
  };

  // ---------- API
  M.start = function () {
    if (Sy.on) return syncStart();
    if (playing || M.mode === 'off') return;
    playing = true;
    paused = false;
    if (synthMode()) startSynth(); else startFileMode();
    state();
  };
  M.stop = function () {
    if (!playing) return;
    playing = false;
    paused = false;
    state();
    clearInterval(timer);
    clearInterval(Sy.beat);
    clearInterval(Sy.drift);
    if (master && ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
    }
    if (audio) { const old = audio; audio = null; fadeAudio(old, 0, 600, () => { old.pause(); old.src = ''; }); }
    M.stopSting();
  };
  M.setMode = function (m) {
    if (Sy.on) {
      if (m === 'off') { Sy.localMute = true; if (audio) audio.muted = true; state(); return; }
      if (!isSyncable(m)) return;
      Sy.localMute = false;
      if (audio) audio.muted = false;
      return syncCmd('mode', m);
    }
    if (!validMode(m)) return;
    M.mode = m;
    save('music2', m);
    const was = playing;
    M.stop();
    if (was && m !== 'off') setTimeout(() => M.start(), 700);
  };
  M.setVol = function (v) {
    M.vol = Math.min(1, Math.max(0, v));
    save('music-vol3', String(M.vol));
    applyGain();
  };
  M.setEntrance = function (on) { M.entrance = !!on; save('music-entrance', on ? 'on' : 'off'); };
  function state() { if (M.onState) M.onState({ playing, paused, now: M.now, mode: M.mode }); }
  M.isPaused = () => paused;
  M.pause = function () {
    if (!playing || paused) return;
    paused = true;
    if (audio) audio.pause();
    if (ctx && synthMode()) ctx.suspend().catch(() => {});
    state();
  };
  M.resume = function () {
    if (!playing || !paused) return;
    paused = false;
    if (audio) audio.play().catch(() => {});
    if (ctx && synthMode()) ctx.resume().catch(() => {});
    state();
  };
  // botão tocar/pausar (se estiver parada, começa a tocar)
  M.toggle = function () {
    if (Sy.on) { Sy.localMute = false; if (audio) audio.muted = false; if (!playing) return M.start(); return syncCmd('toggle'); }
    if (!playing) { if (M.mode === 'off') M.mode = 'royal'; save('music2', M.mode); M.start(); }
    else if (paused) M.resume();
    else M.pause();
  };
  // ids que o "pular/voltar" percorre (faixas gravadas; a trilha sintetizada fica de fora)
  function cycleIds() { return ['royal', 'polka'].concat(EXTRAS.map((_, i) => 'extra:' + i), (G.THEMES || []).map((t) => 'tema:' + t.key)); }
  M.skip = function (dir) {
    if (Sy.on) { Sy.localMute = false; if (audio) audio.muted = false; if (!playing) return M.start(); return syncCmd('skip', dir); }
    if (M.mode === 'todas' && playing) { shuffleNext(); paused = false; return; }
    if (M.mode === 'temas' && playing) {
      if (dir < 0 && hist.length) { const key = hist.pop(); lastTheme = null; const t = themeTrack(key); lastTheme = key; if (t) playFile(t, false, () => { if (playing && M.mode === 'temas') nextTheme(); }); }
      else nextTheme();
      paused = false;
      return;
    }
    const ids = cycleIds();
    let i = ids.indexOf(M.mode);
    i = i < 0 ? (dir > 0 ? 0 : ids.length - 1) : (i + dir + ids.length) % ids.length;
    M.mode = ids[i];
    save('music2', M.mode);
    const wasPlaying = playing;
    M.stop();
    setTimeout(() => M.start(), wasPlaying ? 500 : 0);
  };
  function applyGain() {
    if (audio) audio.volume = fileGain();
    if (master && ctx && playing && synthMode()) master.gain.setTargetAtTime(curve(M.vol) * 0.75 * (ducked ? 0.2 : 1), ctx.currentTime, 0.1);
  }
  // a música abaixa quando algo mais importante toca/fala (meme, tema de Lendária, conversa por voz); cada um com sua "chave"
  const duckKeys = new Set();
  function duck(on, key) { if (on) duckKeys.add(key || 'x'); else duckKeys.delete(key || 'x'); ducked = duckKeys.size > 0; applyGain(); }
  M.duck = duck;
  M.isPlaying = () => playing;

  // opções para o seletor de música
  M.options = function () {
    const out = [
      { id: 'royal', label: '⚔️ The Royal Gambit', hint: 'música principal', group: 'Músicas do jogo' },
      { id: 'polka', label: '🥩 Churrasco Polka Panic', hint: 'a engraçada', group: 'Músicas do jogo' },
      { id: 'todas', label: '🔀 Todas as músicas (aleatório)', hint: 'uma atrás da outra', group: 'Músicas do jogo' },
      { id: 'temas', label: '🎲 Temas da família (aleatório)', hint: 'um tema atrás do outro', group: 'Temas dos personagens' },
    ];
    (G.THEMES || []).forEach((t) => out.push({ id: 'tema:' + t.key, label: `${t.emoji} Tema do ${t.name}`, group: 'Temas dos personagens' }));
    EXTRAS.forEach((e, i) => out.push({ id: 'extra:' + i, label: `${e.emoji || '🎵'} ${e.name}`, group: 'Músicas extras' }));
    if (!Sy.on) Object.keys(SYNTH).forEach((k) => out.push({ id: k, label: '🎹 ' + SYNTH[k].replace('Sintetizada: ', ''), group: 'Trilha sintetizada (reserva)' }));
    out.push({ id: 'off', label: Sy.on ? '🔇 Silenciar (só para mim)' : '🔇 Sem música', group: '' });
    return out;
  };
  M.isMuted = () => (Sy.on ? Sy.localMute : M.mode === 'off');
  M.label = function () {
    if (Sy.on && Sy.localMute) return '🔇 Silenciada (só para mim)';
    const o = M.options().find((x) => x.id === M.mode);
    return o ? o.label : '';
  };

  // trecho do tema de uma Lendária quando ela entra no campo
  M.stopSting = function () {
    clearTimeout(stingT);
    if (stingAudio) { const a = stingAudio; stingAudio = null; fadeAudio(a, 0, 400, () => { a.pause(); a.src = ''; }); }
    duck(false, 'sting');
  };
  M.sting = function (cardId) {
    if (!playing || !M.entrance || M.mode === 'off') return;
    const th = G.themeOf && G.themeOf(cardId);
    if (!th) return;
    M.stopSting();
    const a = new Audio(th.url);
    a.volume = Math.min(1, curve(M.vol));
    a.play().catch(() => {});
    stingAudio = a;
    duck(true, 'sting');
    stingT = setTimeout(() => {
      fadeAudio(a, 0, 1500, () => { a.pause(); a.src = ''; if (stingAudio === a) stingAudio = null; });
      setTimeout(() => duck(false, 'sting'), 900);
    }, 9000);
  };
  // jingle de fim de jogo; devolve false se a música estiver desligada
  M.jingle = function (kind) {
    if (M.isMuted()) return false;
    M.stop();
    const a = new Audio(abs('assets/music/temas/' + kind + '.m4a'));
    a.volume = Math.min(1, curve(M.vol));
    a.play().catch(() => {});
    return true;
  };

  // renderiza uma faixa sintetizada inteira offline (usado para testes)
  M.render = function (id, seconds, sampleRate) {
    const sr = sampleRate || 22050;
    const oc = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
    const out = chain(oc);
    out.gain.value = 0.75 * 0.6 * curve(M.vol) / Math.max(0.0001, M.vol);
    const tr = TRACKS[id];
    const sd = 60 / tr.bpm / 4;
    const n = Math.min(Math.floor(seconds / sd), tr.bars * 16 * 4);
    for (let i = 0; i < n; i++) tr.onStep(oc, out, i * sd, i % (tr.bars * 16), sd);
    return oc.startRendering();
  };

  fetch('assets/music/extras/extras.json').then((r) => r.json()).then((l) => { if (Array.isArray(l)) EXTRAS = l.filter((e) => e && e.name && e.file); }).catch(() => {});

  // economiza bateria: pausa tudo quando a aba fica escondida
  document.addEventListener('visibilitychange', () => {
    if (ctx && !paused) (document.hidden ? ctx.suspend() : ctx.resume()).catch(() => {});
    [audio, stingAudio].forEach((a) => { if (a) { if (document.hidden || (paused && a === audio)) a.pause(); else a.play().catch(() => {}); } });
  });
  // o navegador só libera o áudio depois de um toque/clique
  ['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, () => { if (G.sfx && G.sfx.ctx) G.sfx.ctx(); }, { passive: true }));
})();
