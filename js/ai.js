/* Inteligência artificial: Fácil (aleatória e impulsiva), Médio (simula cada jogada e avalia o tabuleiro) e Difícil (planeja o turno inteiro e simula a resposta do adversário). */
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
  // valor das posições: ataque extra (auras) e redução de dano (Resistente)
  function posVal(s, p) {
    const pl = s.players[p];
    let atk = 0, red = 0;
    pl.atk.forEach((c) => { atk += G.effAtk(s, p, c) - D(c).atk; red += G.incomingRed(s, p, c); });
    pl.def.forEach((c) => { red += G.incomingRed(s, p, c); });
    return { atk, red };
  }
  function side(s, p) {
    const pl = s.players[p];
    const pv = posVal(s, p);
    let v = pv.atk * 1.4 + pv.red * 1.2 + pl.life * 2.8 + pl.energy * 0.12 + pl.hand.length * 1.7 + pl.perms.length * 2.5;
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
          case 'peCancel': return pd.dmg >= 5 || pl.life - pd.dmg <= 10;
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
          case 'pickToHand': case 'protect': case 'unstun': case 'rescue': case 'taxiIn': case 'g220': case 'recoverSup': case 'tutor': case 'espelho': pick = byVal(1)[0]; break;
          case 'pingTarget': {
            const n = pd.dmg || 2;
            const sc = (o) => { const L = G.locate(s, o.v); if (!L) return -1; const d = C[L.card.id]; return (d.def - (L.card.dmg || 0) <= n ? 100 : 0) + d.atk * 1.5 + d.cost * 0.3 + (L.card.dmg || 0) * 0.5; };
            pick = opts.slice().sort((a, b) => sc(b) - sc(a))[0]; break;
          }
          case 'ligPick': return opts.filter((o) => { const L = G.locate(s, o.v); return L && L.z === 'atk' && L.card.enteredT === s.turn; }).slice(0, 2).map((o) => o.v);
          case 'bolaTarget': pick = opts.slice().sort((a, b) => C[b.id].atk - C[a.id].atk)[0]; break;
          case 'cureHaste': case 'cureProtect': case 'cureOne': { // cura quem mais perdeu vida (ataque forte desempata)
            const dm = (o) => { const L = G.locate(s, o.v); return L ? (L.card.dmg || 0) * 2 + C[L.card.id].atk * 0.1 : 0; };
            pick = opts.slice().sort((x, y) => dm(y) - dm(x))[0]; break;
          }
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
          case 'porta': { // devolve o mais ferido (só vale a pena se houver dano)
            const dm = (o) => { const L = G.locate(s, o.v); return L ? (L.card.dmg || 0) : 0; };
            pick = opts.slice().sort((x, y) => dm(y) - dm(x))[0];
            if (pick && dm(pick) === 0 && need === 0) return [];
            break;
          }
          case 'van': { // dá Ligeiro para quem acabou de entrar
            const fresh = opts.filter((o) => { const L = G.locate(s, o.v); return L && L.card.enteredT === s.turn; }).slice(0, 2);
            return fresh.map((o) => o.v);
          }
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
    const quickPurposes = ['mulligan', 'pickToHand', 'naovaleu', 'peekBottom'];
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


  // ---------------------------------------------------------------- Difícil
  // Difícil: planeja o TURNO INTEIRO. Busca em feixe (beam search) sobre sequências de jogadas (cartas, Suportes, movimentos, ataques),
  // depois simula a resposta do adversário para os melhores finais e escolhe o plano que deixa a mesa melhor DEPOIS do turno dele.
  const cl = (s) => { const lg = s.log, fx = s.fx; s.log = []; s.fx = []; const c = JSON.parse(JSON.stringify(s)); s.log = lg; s.fx = fx; return c; };
  // pesos da avaliação da Difícil (ajustados por simulação, sem informação privilegiada)
  const WDEF = { life: 2.271, en: 0.108, hand: 0.812, perm: 3.093, atkBase: 4.92, atkA: 2.885, atkHp: 0.786, stunA: 0.813, defBase: 3.175, defHp: 0.733, defA: 0.197, stunD: 0.515, apBase: 1.537, apCost: 0.586, noDef: 5.438, lowL: 2.584, oppLow: 1.609, waste: 0.599, move: 1.509, buy: 1.833, thr: 0.962, thrO: 0.334 };
  function sideH(s, p, w) {
    const pl = s.players[p];
    const pv = posVal(s, p);
    let v = pv.atk * w.atkA + pv.red * 1.5 + pl.life * w.life + pl.energy * w.en + pl.hand.length * w.hand + pl.perms.length * w.perm;
    pl.atk.forEach((c) => { const d = D(c); v += w.atkBase + d.atk * w.atkA + hp(c) * w.atkHp - (c.stunned ? w.stunA : 0); });
    pl.def.forEach((c) => { const d = D(c); v += w.defBase + hp(c) * w.defHp + d.atk * w.defA - (c.stunned ? w.stunD : 0); });
    pl.apoio.forEach((c) => { v += w.apBase + D(c).cost * w.apCost; });
    if (!pl.def.length) v -= w.noDef;
    return v;
  }
  function evalH(s, p, wasteEnergy) {
    if (s.winner === p) return 1e6;
    if (s.winner === opp(p)) return -1e6;
    const w = HP.w || WDEF;
    const me = s.players[p], o = s.players[opp(p)];
    let v = sideH(s, p, w) - sideH(s, opp(p), w);
    v -= Math.max(0, 12 - me.life) * w.lowL;
    v += Math.max(0, 12 - o.life) * w.oppLow;
    if (wasteEnergy) v -= me.energy * w.waste;
    if (w.thr) v -= threat(s, p) * w.thr;
    if (w.thrO) v += threat(s, opp(p)) * w.thrO;
    return v;
  }
  // política rápida para simular o turno do adversário (sem busca)
  function fastTurn(s, q) {
    let g = 0;
    while (s.winner == null && g++ < 14) {
      settle(s);
      if (s.winner != null || s.active !== q) break;
      const pl = s.players[q];
      const legal = G.legal(s, q);
      let act = null;
      const plays = legal.filter((a) => a.t === 'playChar');
      if (plays.length) {
        const cost = (a) => G.charCost(s, q, pl.hand.find((c) => c.uid === a.uid));
        const need = pl.def.length === 0 ? 'def' : pl.atk.length < 2 ? 'atk' : 'def';
        const best = plays.slice().sort((a, b) => (valId(pl.hand.find((c) => c.uid === b.uid).id) + (b.zone === need ? 3 : 0)) - (valId(pl.hand.find((c) => c.uid === a.uid).id) + (a.zone === need ? 3 : 0)))[0];
        if (best && cost(best) <= pl.energy) act = best;
      }
      if (!act) { const sup = legal.find((a) => a.t === 'playSup'); if (sup) act = sup; }
      if (!act) act = bestAttack(s, q) || null;
      if (!act) act = { t: 'endTurn' };
      const r = G.act(s, q, act);
      if (!r.ok) { G.act(s, q, { t: 'endTurn' }); }
      if (act.t === 'endTurn') break;
    }
    settle(s);
  }
  const HP = { W: 4, K: 3, DEPTH: 9, reply: 'fast', rollouts: 0, rolloutTurns: 30, w: null }; // parâmetros da busca (ajustáveis nos testes)
  // resposta do adversário simulada com a política do Médio (mais precisa e mais lenta)
  function mediumTurn(s, q) {
    let g = 0;
    while (s.winner == null && g++ < 14) {
      settle(s);
      if (s.winner != null || s.active !== q) break;
      const a = mediumAction(s, q);
      const r = G.act(s, q, a);
      if (!r.ok) G.act(s, q, { t: 'endTurn' });
      if (a.t === 'endTurn') break;
    }
    settle(s);
  }
  // vitórias estimadas de `p` jogando R partidas rápidas a partir do estado `st`
  function rolloutScore(st, p, R) {
    let wins = 0;
    for (let i = 0; i < R; i++) {
      const sim = cl(st);
      const limit = sim.turn + HP.rolloutTurns;
      let g = 0;
      while (sim.winner == null && sim.turn < limit && g++ < 60) {
        fastTurn(sim, sim.pending ? sim.pending.player : sim.active);
      }
      if (sim.winner === p) wins += 1;
      else if (sim.winner == null) { const a = sim.players[p].life, b = sim.players[opp(p)].life; wins += a > b ? 0.65 : a < b ? 0.35 : 0.5; }
    }
    return wins / R;
  }
  const planCache = new WeakMap();
  function hardPlan(s, p) {
    const { W, K, DEPTH } = HP;
    let frontier = [{ s: cl(s), acts: [], sc: 0 }];
    const finals = [];
    const endNow = (node) => {
      const sim = cl(node.s);
      if (sim.winner != null) { finals.push({ acts: node.acts, st: sim, sc: evalH(sim, p, true) }); return; }
      if (!G.act(sim, p, { t: 'endTurn' }).ok) return;
      settle(sim);
      finals.push({ acts: node.acts.concat([{ t: 'endTurn' }]), st: sim, sc: evalH(sim, p, true) });
    };
    for (let depth = 0; depth < DEPTH && frontier.length; depth++) {
      const next = [];
      frontier.forEach((node) => {
        endNow(node);
        if (node.s.winner != null) return;
        G.legal(node.s, p).forEach((a) => {
          if (a.t === 'endTurn' || a.t === 'cycle') return;
          const sim = cl(node.s);
          if (!G.act(sim, p, a).ok) return;
          settle(sim);
          let sc = evalH(sim, p, false) + Math.random() * 0.4;
          if (a.t === 'move') sc -= (HP.w || WDEF).move;
          if (a.t === 'buySup') sc -= (HP.w || WDEF).buy;
          next.push({ s: sim, acts: node.acts.concat([a]), sc });
        });
      });
      next.sort((a, b) => b.sc - a.sc);
      frontier = next.slice(0, W);
    }
    frontier.forEach(endNow);
    finals.sort((a, b) => b.sc - a.sc);
    // resposta do adversário aos melhores finais
    let best = null;
    finals.slice(0, K).forEach((f) => {
      let sc = f.sc;
      if (f.st.winner == null && f.st.active === opp(p)) {
        const r = f.st;
        if (HP.rollouts) { sc = rolloutScore(f.st, p, HP.rollouts) * 100 + f.sc * 0.02; }
        else { if (HP.reply === 'medium') mediumTurn(r, opp(p)); else fastTurn(r, opp(p)); sc = evalH(r, p, false) + f.sc * 0.15; }
      }
      if (!best || sc > best.sc) best = { acts: f.acts, sc };
    });
    return best ? best.acts : [{ t: 'endTurn' }];
  }
  function sameAct(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  // o plano é montado num mundo sorteado (sem informação privilegiada) e guardado por turno; a validade é checada no estado real
  function hardAction(s0, p) {
    let c = planCache.get(s0);
    const fresh = () => { const w = determinize(s0, p); const c2 = { turn: s0.turn, p, acts: hardPlan(w, p) }; planCache.set(s0, c2); return c2; };
    if (!c || c.turn !== s0.turn || c.p !== p || !c.acts.length) c = fresh();
    for (let tries = 0; tries < 2; tries++) {
      const legal = G.legal(s0, p);
      while (c.acts.length) {
        const a = c.acts.shift();
        if (a.t === 'endTurn' || legal.some((l) => sameAct(l, a))) return a;
      }
      c = fresh();
    }
    return { t: 'endTurn' };
  }
  function hardChoice(s, pd) {
    const quickKinds = ['info', 'order'];
    const quickPurposes = ['mulligan', 'pickToHand', 'naovaleu', 'peekBottom'];
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
      const sim = cl(s);
      if (!G.act(sim, p, { t: 'choose', v }).ok) return;
      settle(sim);
      const sc = evalH(sim, p, false) + Math.random() * 0.3;
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

  // ---------------------------------------------------------------- sem informação privilegiada
  // A IA decide sobre um "mundo sorteado": mantém tudo o que ela pode ver (a própria mão, o campo, os descartes, o Evento atual)
  // e embaralha o que não pode ver (a mão do adversário, a ordem dos baralhos e o próximo Evento), respeitando as cartas que ainda não apareceram.
  let detN = 0;
  const shuf = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function determinize(s, p) {
    const w = cl(s);
    const o = opp(p), O = w.players[o];
    const known = new Set();
    const mark = (c) => { if (c && c.id) known.add(c.id); };
    w.players.forEach((pl, i) => { ['atk', 'def', 'apoio', 'perms', 'discard'].forEach((z) => pl[z].forEach(mark)); if (i === p) pl.hand.forEach(mark); });
    if (w.event) known.add(w.event);
    (w.evDiscard || []).forEach(mark);
    if (w.resolving) known.add(w.resolving.id);
    if (w.pending && w.pending.options) w.pending.options.forEach((x) => { if (x.id) known.add(x.id); });
    const unk = (ids) => shuf(ids.filter((id) => !known.has(id)));
    const chars = unk(G.CHAR_IDS), sups = unk(G.SUP_IDS), evs = unk(G.EV_IDS);
    const take = (pool, type) => pool.pop() || (type === 'char' ? G.CHAR_IDS : G.SUP_IDS)[0];
    O.hand.forEach((c) => { c.id = C[c.id].type === 'sup' ? take(sups, 'sup') : take(chars, 'char'); });
    const refill = (arr, pool) => { const n = arr.length; arr.length = 0; for (let i = 0; i < n; i++) arr.push({ uid: 'z' + (++detN), id: pool.length ? pool.pop() : 'p01' }); };
    refill(w.charDeck, chars); refill(w.supDeck, sups); refill(w.evDeck, evs);
    w.rng = Math.floor(Math.random() * 2 ** 31);
    return w;
  }

  G.AI = {
    // devolve a próxima ação da IA ({t:'choose', v} quando há escolha pendente para ela)
    step(s0, p, level) {
      if (s0.winner != null) return null;
      if (s0.pending && s0.pending.player !== p) return null;
      if (!s0.pending && s0.active !== p) return null;
      // a decisão é tomada num mundo sorteado: nada de olhar a mão do adversário nem as próximas cartas
      const s = level === 'easy' ? s0 : determinize(s0, p);
      if (s.winner != null) return null;
      if (s.pending) {
        if (s.pending.player !== p) return null;
        const v = level === 'easy' ? easyChoice(s, s.pending) : level === 'hard' ? hardChoice(s, s.pending) : mediumChoice(s, s.pending);
        return { t: 'choose', v };
      }
      if (s.active !== p) return null;
      return level === 'easy' ? easyAction(s, p) : level === 'hard' ? hardAction(s0, p) : mediumAction(s, p);
    },
    quick, evalS, params: HP, WDEF, determinize,
  };
})();
