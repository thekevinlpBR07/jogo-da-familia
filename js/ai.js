/* Inteligência artificial: Fácil (aleatória e impulsiva) e Médio (simula cada jogada e avalia o tabuleiro). */
(function () {
  const G = window.G;
  const C = G.CARDS;
  const { D, opp, fieldChars } = G.util;
  const rand = (a) => a[Math.floor(Math.random() * a.length)];

  const val = (c) => {
    const d = D(c);
    return d.type === 'char' ? d.cost * 1.6 + d.atk * 0.45 + d.def * 0.45 : d.cost * 1.2 + 1;
  };
  const valId = (id) => val({ id });

  const hp = (c) => D(c).def - (c.dmg || 0);
  function side(s, p) {
    const pl = s.players[p];
    let v = pl.life * 2.8 + pl.energy * 0.12 + pl.hand.length * 1.7 + pl.perms.length * 2.5;
    pl.atk.forEach((c) => { const d = D(c); v += 3 + d.atk * 1.2 + hp(c) * 0.35 - (c.stunned ? 2 : 0); });
    pl.def.forEach((c) => { const d = D(c); v += 3 + hp(c) * 0.9 + d.atk * 0.25 - (c.stunned ? 0.5 : 0); });
    pl.apoio.forEach((c) => { v += 2.5 + D(c).cost * 0.6; });
    if (!pl.def.length) v -= 5;
    return v;
  }
  // dano que o adversário pode causar a `p` no próximo turno dele
  function threat(s, p) {
    const me = s.players[p], o = s.players[opp(p)];
    const potential = o.atk.filter((c) => !c.stunned).reduce((a, c) => a + D(c).atk, 0);
    if (!potential) return 0;
    const wall = me.def.length ? Math.min(1, 0.12 + 0.06 * (3 - me.def.length)) : 1; // com Defensores o dano na vida é bem menor
    const lethal = potential * wall >= me.life ? 40 : 0;
    return potential * wall * 1.1 + lethal;
  }
  function evalS(s, p) {
    if (s.winner === p) return 1e6;
    if (s.winner === opp(p)) return -1e6;
    return side(s, p) - side(s, opp(p)) - threat(s, p) + threat(s, opp(p)) * 0.6;
  }

  // ---------------------------------------------------------------- escolhas rápidas (heurística)
  function quick(s, pd) {
    const p = pd.player, pl = s.players[p];
    const opts = pd.options || [];
    const byVal = (dir) => opts.slice().sort((a, b) => dir * (valId(b.id) - valId(a.id)));
    switch (pd.kind) {
      case 'info': return true;
      case 'confirm':
        switch (pd.purpose) {
          case 'peekBottom': { const d = C[opts[0].id]; return d.type === 'char' ? d.cost > pl.energy + 3 || d.atk + d.def < 9 : d.cost > pl.energy + 2; }
          case 'naovaleu': return C[opts[0].id].cost >= 4;
          case 'bagunca': { const ch = pl.hand.filter((c) => D(c).type === 'char'); return ch.length > 0 && ch.reduce((t, c) => t + val(c), 0) / ch.length < 8; }
          case 'selfToDef': return s.players[p].def.length < 2;
          default: return true;
        }
      case 'option':
        if (pd.purpose === 'garrafada') return pl.life <= 2 ? 'h' : 'e';
        if (pd.purpose === 'poltrona') return pl.life <= 3 || pl.hand.length >= 6 ? 'h' : 'd';
        if (pd.purpose === 'zone') {
          const vs = opts.map((o) => o.v);
          if (vs.includes('def') && s.players[p].def.length === 0) return 'def';
          if (vs.includes('atk')) return 'atk';
          return vs[0];
        }
        return opts[0].v;
      case 'order': {
        const idx = opts.map((o, i) => i);
        const score = (i) => { const d = C[opts[i].id]; return valId(opts[i].id) - Math.max(0, d.cost - pl.energy - 1) * 3; };
        return idx.sort((a, b) => score(b) - score(a)).map((i) => opts[i].v);
      }
      case 'pick': {
        const need = pd.min;
        let pick;
        switch (pd.purpose) {
          case 'mulligan': pick = opts.slice().sort((a, b) => C[b.id].cost - C[a.id].cost)[0]; break;
          case 'pickToHand': case 'protect': case 'unstun': case 'rescue': case 'taxiIn': case 'g220': case 'recoverSup': pick = byVal(1)[0]; break;
          case 'stunEnemy': case 'enemyToDef': pick = opts.slice().sort((a, b) => C[b.id].atk - C[a.id].atk)[0]; break;
          case 'bounceSup': pick = byVal(1)[0]; break;
          case 'replacePerm': case 'taxiOut': pick = byVal(-1)[0]; break;
          case 'swapZone': {
            const fit = opts.map((o) => {
              const L = G.locate(s, o.v); const d = C[o.id];
              return { o, g: L.z === 'atk' ? d.def - d.atk : d.atk - d.def };
            }).sort((a, b) => b.g - a.g);
            if (need === 0 && (!fit.length || fit[0].g <= 0)) return [];
            pick = fit[0].o;
            break;
          }
          case 'moveToDef': if (need === 0 && s.players[p].def.length >= 2) return []; pick = opts.slice().sort((a, b) => C[b.id].def - C[a.id].def)[0]; break;
          case 'moveToAtk': if (need === 0 && s.players[p].atk.length >= 2) return []; pick = opts.slice().sort((a, b) => C[b.id].atk - C[a.id].atk)[0]; break;
          case 'viajar': { const w = byVal(-1)[0]; if (need === 0 && (!w || C[w.id].cost <= pl.energy + 2)) return []; pick = w; break; }
          case 'van': case 'porta': if (need === 0) return []; pick = opts[0]; break;
          default: pick = need === 0 ? null : opts[0];
        }
        if (!pick) return need === 0 ? [] : [opts[0].v];
        return [pick.v];
      }
    }
    return true;
  }
  function settle(s, max) {
    let g = 0;
    while (s.pending && s.winner == null && g++ < (max || 40)) {
      const v = quick(s, s.pending);
      const r = G.act(s, s.pending.player, { t: 'choose', v });
      if (!r.ok) break;
    }
  }

  // ---------------------------------------------------------------- combate guloso
  function attackScore(s, p, A, t, bad) {
    const o = s.players[opp(p)];
    if (t === 'life') return 40;
    const T = o.def.concat(o.atk, o.apoio).find((c) => c.uid === t);
    const a = D(A).atk, back = D(T).atk;
    const kills = a >= hp(T), dies = back >= hp(A);
    if (kills && !dies) return 12 + val(T);
    if (kills && dies) return val(T) - val(A) + 1;
    if (dies) return bad ? 1 : -10 - val(A);
    return 2 + (a - back) * 0.4;
  }
  function bestAttack(s, p, bad) {
    let best = null;
    G.legal(s, p).filter((a) => a.t === 'attack').forEach((a) => {
      const A = s.players[p].atk.find((c) => c.uid === a.uid);
      const sc = attackScore(s, p, A, a.target, bad);
      if (sc > 0 && (!best || sc > best.sc)) best = { a, sc };
    });
    return best && best.a;
  }
  function playAttacks(s, p) {
    let g = 0;
    while (s.winner == null && s.active === p && g++ < 8) {
      settle(s);
      const a = bestAttack(s, p);
      if (!a) break;
      G.act(s, p, a);
    }
    settle(s);
  }

  // ---------------------------------------------------------------- Médio
  // Médio: a cada passo, testa cada jogada possível (jogar carta, Suporte, mover, habilidade) e faz a que mais melhora a mesa.
  // Quando nada compensa, ataca e encerra o turno. Energia que sobrar se perde, então ela quase não pesa na avaliação.
  function mediumAction(s, p) {
    const legal = G.legal(s, p).filter((a) => a.t !== 'cycle');
    const base = evalS(s, p);
    let best = null;
    legal.forEach((a) => {
      if (a.t === 'attack' || a.t === 'endTurn' || a.t === 'usePerm') return;
      const sim = G.clone(s);
      if (!G.act(sim, p, a).ok) return;
      settle(sim);
      let sc = evalS(sim, p) - base + Math.random() * 0.6;
      if (a.t === 'move') sc -= 2.2;       // reposicionar só vale se ajudar de verdade
      if (a.t === 'buySup') sc -= 1.2;
      if (a.t === 'playSup') sc += 1.8;    // a avaliação de mesa não enxerga cartas, Energia e proteção que os Suportes dão
      if (!best || sc > best.sc) best = { a, sc };
    });
    if (best && best.sc > 0.5) return best.a;
    // ataques: testa cada um (atacante x alvo) e faz o que mais melhora a mesa; ataque ao herói pesa bastante
    let bestAtk = null;
    legal.forEach((a) => {
      if (a.t !== 'attack') return;
      const sim = G.clone(s);
      if (!G.act(sim, p, a).ok) return;
      settle(sim);
      const sc = evalS(sim, p) - base + Math.random() * 0.3;
      if (!bestAtk || sc > bestAtk.sc) bestAtk = { a, sc };
    });
    if (bestAtk && bestAtk.sc > 0.4) return bestAtk.a;
    return { t: 'endTurn' };
  }
  function mediumChoice(s, pd) {
    const quickKinds = ['info', 'order'];
    const quickPurposes = ['mulligan', 'pickToHand', 'naovaleu', 'peekBottom', 'bagunca'];
    if (quickKinds.includes(pd.kind) || quickPurposes.includes(pd.purpose)) return quick(s, pd);
    let cands = [];
    if (pd.kind === 'confirm') cands = [true, false];
    else if (pd.kind === 'option') cands = pd.options.map((o) => o.v);
    else if (pd.kind === 'pick') {
      const vs = pd.options.map((o) => o.v);
      if (pd.min === 0) cands.push([]);
      vs.forEach((v) => cands.push([v]));
      if (pd.max >= 2) for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) cands.push([vs[i], vs[j]]);
      cands = cands.filter((c) => c.length >= pd.min && c.length <= pd.max);
    }
    if (!cands.length) return quick(s, pd);
    const p = pd.player;
    let best = null;
    cands.slice(0, 30).forEach((v) => {
      const sim = G.clone(s);
      if (!G.act(sim, p, { t: 'choose', v }).ok) return;
      settle(sim);
      const sc = evalS(sim, p) + Math.random() * 0.3;
      if (!best || sc > best.sc) best = { v, sc };
    });
    return best ? best.v : quick(s, pd);
  }

  // ---------------------------------------------------------------- Fácil
  function easyChoice(s, pd) {
    if (pd.purpose === 'mulligan' || pd.kind === 'info') return quick(s, pd);
    if (Math.random() < 0.45) return quick(s, pd);
    switch (pd.kind) {
      case 'confirm': return Math.random() < 0.5;
      case 'option': return rand(pd.options).v;
      case 'order': return pd.options.map((o) => o.v).sort(() => Math.random() - 0.5);
      case 'pick': {
        const vs = pd.options.map((o) => o.v).sort(() => Math.random() - 0.5);
        const n = Math.max(pd.min, Math.min(pd.max, Math.round(Math.random() * pd.max)));
        return vs.slice(0, n);
      }
    }
    return quick(s, pd);
  }
  function easyAction(s, p) {
    const legal = G.legal(s, p).filter((a) => a.t !== 'cycle');
    const pl = s.players[p];
    const plays = legal.filter((a) => a.t === 'playChar');
    const sups = legal.filter((a) => a.t === 'playSup');
    if (plays.length && Math.random() < 0.8) {
      // escolhe a zona primeiro (defende quando está exposto), depois uma carta que caiba nela
      const nd = pl.def.length, na = pl.atk.length;
      const pDef = nd === 0 ? 0.7 : nd < na ? 0.5 : nd > na ? 0.25 : 0.38;
      const r = Math.random();
      const want = r < 0.08 ? 'apoio' : r < 0.08 + pDef ? 'def' : 'atk';
      const inZone = plays.filter((a) => a.zone === want);
      return rand(inZone.length ? inZone : plays.filter((a) => a.zone !== 'apoio').length ? plays.filter((a) => a.zone !== 'apoio') : plays);
    }
    if (sups.length && Math.random() < 0.5) return rand(sups);
    if (legal.some((a) => a.t === 'buySup') && Math.random() < 0.15) return { t: 'buySup' };
    const attacks = legal.filter((a) => a.t === 'attack');
    if (attacks.length && Math.random() < 0.75) {
      const life = attacks.find((a) => a.target === 'life');
      if (life && Math.random() < 0.85) return life;
      const ok = attacks.filter((a) => {
        const A = pl.atk.find((c) => c.uid === a.uid);
        return attackScore(s, p, A, a.target, true) > 0 || Math.random() < 0.15;
      });
      if (ok.length) return rand(ok);
    }
    return { t: 'endTurn' };
  }

  G.AI = {
    // devolve a próxima ação da IA ({t:'choose', v} quando há escolha pendente para ela)
    step(s, p, level) {
      if (s.winner != null) return null;
      if (s.pending) {
        if (s.pending.player !== p) return null;
        const v = level === 'easy' ? easyChoice(s, s.pending) : mediumChoice(s, s.pending);
        return { t: 'choose', v };
      }
      if (s.active !== p) return null;
      return level === 'easy' ? easyAction(s, p) : mediumAction(s, p);
    },
    quick, evalS,
  };
})();
