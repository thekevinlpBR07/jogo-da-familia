/* Motor de regras do Jogo da Família.
   Estado 100% serializável (JSON). Decisões dos jogadores ficam em state.pending e são
   respondidas com a ação {t:'choose', v}. Efeitos em cadeia usam a fila state.queue. */
(function () {
  const G = window.G;
  const C = G.CARDS;
  const LIM = { atk: 3, def: 3, apoio: 2 };
  const ZN = { atk: 'Ataque', def: 'Defesa', apoio: 'Apoio' };
  const ZI = { atk: '⚔️', def: '🛡️', apoio: '🤝' };
  G.ZN = ZN; G.ZI = ZI; G.LIM = LIM;
  // energia máxima (a energia sobe 1 por turno até este valor)
  G.ENERGY_MAX = 10;
  // Regras ajustáveis (v4: energia que recarrega).
  G.RULES = {
    autoEvent: 3,        // o Evento troca sozinho a cada N rodadas completas (0 = desligado)
    secondBonus: 'coin4', // compensação do 2º jogador: 'coinN' = ⚡+(N-1) no 2º turno dele (o 1º turno é ⚡1 para todos) | 'card' | 'sup' | 'draw' | 'none'
    fatigueTurn: 80,     // a partir deste turno (global) quem abre o turno perde Vida (evita partidas eternas); 0 = desligado
    fatigueDmg: 3,
    supDrawEvery: 2,     // compra automática de 1 Suporte a cada N turnos do próprio jogador (0 = desligado)
    lifeStart: 25,       // pontos de vida de cada herói
    heartPts: 5,         // 1 ❤️ impresso nas cartas = 5 pontos de vida ("recupere ❤️1" cura 5)
    moveCost: 1,         // mover um Personagem custa ⚡ (1x por Personagem por turno)
    buyCost: 1,          // comprar 1 Suporte custa ⚡
  };

  const AE = new Set(['peekReorder2', 'apoioToAtk', 'moveOther', 'peekCharBottom', 'evilynIdol', 'bounceSupport',
    'evilynRainha', 'protStunOther', 'healIfLow', 'peekReorder3', 'moveAny', 'doloresDeusa', 'revealTop', 'moveToDef',
    'energyIfLessLife', 'brunor', 'helsoTranquilo', 'helsoCoco', 'peekSupBottom', 'jonesRei', 'donJones', 'julianaSerena',
    'lecoDeus', 'adeniSanta', 'fredOraculo', 'fredMestre', 'gabrielSerio', 'arcanjo', 'neiaDurona', 'lookHand',
    'nathaliaFiscal', 'nathaliaBruxa', 'peekEvent', 'luarFada', 'luarDeusa']);
  G.hasAE = (id) => AE.has(C[id].fx);

  // ---------------------------------------------------------------- utilidades
  function rnd(s) {
    s.rng = (s.rng + 0x6d2b79f5) | 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(s, a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd(s) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const D = (c) => C[c.id];
  const opp = (p) => 1 - p;
  const nm = (c) => { const d = D(c); return d.type === 'char' ? d.name + ', ' + d.title : d.name; };
  const pn = (s, p) => s.players[p].name;
  function log(s, t, c) {
    s.log.push({ n: ++s.logN, t, c: c || '' });
    if (s.log.length > 200) s.log.shift();
  }
  function fx(s, o) {
    o.seq = ++s.fxN; // não usar "n": é a quantidade em fx de energia/vida
    s.fx.push(o);
    if (s.fx.length > 80) s.fx.shift();
  }
  const evKey = (s) => (s.event ? C[s.event].fx : null);
  const fieldChars = (pl) => pl.atk.concat(pl.def, pl.apoio);
  const clean = (c) => ({ uid: c.uid, id: c.id });
  const space = (s, p, z) => s.players[p][z].length < LIM[z];
  const deckN = (s, k) => (s[k + 'DeckN'] != null ? s[k + 'DeckN'] : s[k + 'Deck'].length);
  const hasPerm = (s, p, f) => s.players[p].perms.find((c) => D(c).fx === f);
  const onField = (s, p, f, zones) => (zones || ['atk', 'def', 'apoio']).some((z) => s.players[p][z].some((c) => D(c).fx === f));

  function locate(s, uid) {
    for (let p = 0; p < 2; p++) {
      const pl = s.players[p];
      for (const z of ['atk', 'def', 'apoio', 'hand', 'perms', 'discard']) {
        const i = pl[z].findIndex((c) => c.uid === uid);
        if (i >= 0) return { p, z, i, card: pl[z][i] };
      }
    }
    return null;
  }
  G.locate = locate;

  // ---------------------------------------------------------------- recursos
  function gainE(s, p, n) {
    const pl = s.players[p];
    if (pl.turns <= 1) return 0; // no 1º turno de cada jogador só existe ⚡1: nenhum efeito dá energia extra
    const b = pl.energy;
    pl.energy = Math.min(G.ENERGY_MAX, pl.energy + n);
    const g = pl.energy - b;
    if (g > 0) fx(s, { t: 'energy', p, n: g });
    return g;
  }
  function heal(s, p, n) {
    if (evKey(s) === 'discussao') { log(s, 'Discussão Generalizada: ninguém pode recuperar ❤️.'); return 0; }
    const pl = s.players[p];
    const b = pl.life;
    pl.life = Math.min(G.RULES.lifeStart, pl.life + n * G.RULES.heartPts);
    const g = pl.life - b;
    if (g > 0) { fx(s, { t: 'heal', p, n: g }); log(s, `${pn(s, p)} recuperou ${g} de vida.`, 'good'); }
    return g;
  }
  function loseLife(s, p, n, why) {
    const pl = s.players[p];
    pl.life = Math.max(0, pl.life - n);
    fx(s, { t: 'damage', p, n });
    log(s, `💔 ${pn(s, p)} perdeu ${n} de vida${why ? ' (' + why + ')' : ''}.`, 'bad');
    if (pl.life <= 0 && s.winner == null) {
      s.winner = opp(p);
      s.phase = 'over';
      s.queue = [];
      s.pending = null;
      log(s, `🏆 ${pn(s, opp(p))} venceu a partida!`, 'win');
      fx(s, { t: 'win', p: opp(p) });
    }
  }
  // Só recebemos cartas que dá para jogar: a compra pega a primeira carta do baralho que cabe na energia do jogador
  // (teto de energia do turno); se não houver nenhuma assim, pega a do topo.
  function takePlayable(s, deck, ceil) {
    let i = deck.findIndex((c) => G.CARDS[c.id].cost <= ceil);
    if (i < 0) i = 0;
    return deck.splice(i, 1)[0];
  }
  function drawChar(s, p, isPhase) {
    const pl = s.players[p];
    if (pl.hand.length >= 7) { if (isPhase) log(s, `${pn(s, p)} está com a mão cheia (7) e não compra.`); return false; }
    if (!s.charDeck.length) {
      if (isPhase) loseLife(s, p, 1, 'baralho de Personagens vazio');
      return false;
    }
    pl.hand.push(takePlayable(s, s.charDeck, Math.min(G.ENERGY_MAX, (pl.maxE || 0) + (isPhase ? 1 : 0))));
    fx(s, { t: 'draw', p });
    return true;
  }
  function drawSup(s, p) {
    const pl = s.players[p];
    if (pl.hand.length >= 7) return false;
    if (!s.supDeck.length) refillSup(s);
    if (!s.supDeck.length) { log(s, 'O baralho de Suportes acabou.'); return false; }
    pl.hand.push(takePlayable(s, s.supDeck, Math.max(1, pl.maxE || 0)));
    fx(s, { t: 'draw', p, sup: true });
    return true;
  }
  function refillSup(s) {
    if (evKey(s) === 'treta') return;
    const pool = [];
    s.players.forEach((pl) => {
      pl.discard = pl.discard.filter((c) => { if (D(c).type === 'sup') { pool.push(clean(c)); return false; } return true; });
    });
    if (pool.length) { s.supDeck = shuffle(s, pool); log(s, 'Suportes descartados foram embaralhados de volta.'); }
  }
  function discardPerm(s, p, card) {
    const pl = s.players[p];
    const i = pl.perms.findIndex((c) => c.uid === card.uid);
    if (i >= 0) pl.perms.splice(i, 1);
    pl.discard.push(clean(card));
    fx(s, { t: 'permOut', uid: card.uid, p });
  }

  // ---------------------------------------------------------------- campo
  function removeFromField(s, uid) {
    const L = locate(s, uid);
    if (!L || !LIM[L.z]) return null;
    s.players[L.p][L.z].splice(L.i, 1);
    return L;
  }
  function sendDefeated(s, L, o) {
    const c = L.card, p = L.p;
    if (o.combat && L.z === 'atk') {
      const ar = hasPerm(s, p, 'arena');
      if (ar) {
        discardPerm(s, p, ar);
        s.players[p].hand.push(clean(c));
        log(s, `🐓 Arena dos Galos devolveu ${nm(c)} à mão de ${pn(s, p)}.`, 'good');
        return 'hand';
      }
    }
    if (D(c).fx === 'boba' || o.toBottom) {
      s.charDeck.push(clean(c));
      log(s, `${nm(c)} foi para o fundo do Baralho de Personagens.`);
      return 'deck';
    }
    s.players[p].discard.push(clean(c));
    return 'discard';
  }
  function defeat(s, uid, o) {
    const L = removeFromField(s, uid);
    if (!L) return null;
    fx(s, { t: 'defeat', uid, p: L.p });
    log(s, `☠️ ${nm(L.card)} foi derrotado.`, 'bad');
    return sendDefeated(s, L, o || {});
  }
  function stun(s, c, p) {
    if (c.stunned) return false;
    if (D(c).fx === 'noStunAtk') { log(s, `${nm(c)} não pode ser Atordoada.`); return false; }
    if (c.protStun) { log(s, `${nm(c)} está protegido e não pode ser Atordoado.`); return false; }
    c.stunned = true;
    c.stunT = s.turn;
    fx(s, { t: 'stun', uid: c.uid });
    log(s, `💫 ${nm(c)} ficou Atordoado.`, 'warn');
    if (D(c).fx === 'vascaino' && !c.vascoUsed) {
      c.vascoUsed = true;
      gainE(s, p, 1);
      log(s, `Bruno, o Sofredor Vascaíno: ${pn(s, p)} ganhou ⚡1.`, 'good');
    }
    return true;
  }
  function unstun(s, c) {
    if (!c.stunned) return;
    c.stunned = false;
    fx(s, { t: 'unstun', uid: c.uid });
    log(s, `✨ ${nm(c)} não está mais Atordoado.`);
  }
  function movableBy(s, c, owner, byOpp) {
    if (c.stunned) return false;
    if (!byOpp) return true;
    const f = D(c).fx;
    if (f === 'immovable' || f === 'cacique' || c.protMove) return false;
    const L = locate(s, c.uid);
    if (L && L.z === 'def' && fieldChars(s.players[owner]).some((o) => o.uid !== c.uid && D(o).fx === 'matriarca')) return false;
    return true;
  }
  function bounceable(c) {
    const f = D(c).fx;
    return f !== 'cacique' && f !== 'noBounce';
  }
  function moveTo(s, uid, z) {
    const L = locate(s, uid);
    if (!L || L.z === z || !LIM[L.z]) return false;
    if (!space(s, L.p, z)) return false;
    s.players[L.p][L.z].splice(L.i, 1);
    s.players[L.p][z].push(L.card);
    fx(s, { t: 'move', uid, z });
    log(s, `${nm(L.card)} foi para ${ZI[z]} ${ZN[z]}.`);
    return true;
  }
  const other = (z) => (z === 'atk' ? 'def' : 'atk');

  // ---------------------------------------------------------------- custos
  function charCost(s, p, c, red) { return Math.max(1, D(c).cost - (red || 0)); }
  function supCost(s, p, c) { return Math.max(1, D(c).cost - (evKey(s) === 'praia' ? 1 : 0)); }
  function actCost(s, p, c) {
    let k = D(c).ecost;
    if (evKey(s) === 'semLuz') k += 1;
    if (hasPerm(s, p, 'cristal') && s.players[p].cristalT !== s.turn) k -= 1;
    return Math.max(0, k);
  }
  G.charCost = charCost; G.supCost = supCost; G.actCost = actCost;

  // ---------------------------------------------------------------- fila / escolhas
  const STEP = {};
  function push(s, ...steps) { s.queue.unshift(...steps); }
  function ask(s, st, pend) { s.pending = Object.assign({ step: st, min: 1, max: 1 }, pend); }
  function run(s) {
    let guard = 0;
    while (!s.pending && s.queue.length && s.winner == null && guard++ < 1000) {
      const st = s.queue.shift();
      STEP[st.k](s, st);
    }
  }
  // Pede para escolher uma carta dentre `options`. Retorna undefined se perguntou, null se pulou/sem opção, ou a carta.
  function pickOne(s, st, v, cfg) {
    const opts = cfg.options;
    if (v === undefined) {
      if (!opts.length) return null;
      if (!cfg.optional && opts.length === 1 && cfg.auto) return opts[0];
      ask(s, st, {
        player: cfg.player, kind: 'pick', title: cfg.title, text: cfg.text || '', purpose: cfg.purpose || st.k,
        options: opts.map((c) => ({ v: c.uid, id: c.id })), min: cfg.optional ? 0 : 1, max: 1,
      });
      return undefined;
    }
    if (!v || !v.length) return null;
    return opts.find((c) => c.uid === v[0]) || null;
  }
  function info(s, p, title, ids, text) {
    push(s, { k: 'info', p, title, ids, text });
  }
  STEP.info = (s, st, v) => {
    if (v === undefined) {
      ask(s, st, { player: st.p, kind: 'info', title: st.title, text: st.text || '', options: st.ids.map((id, i) => ({ v: i, id })), min: 0, max: 0, purpose: 'info' });
    }
  };

  // olhar topo e reordenar
  STEP.reorderTop = (s, st, v) => {
    const top = s.charDeck.slice(0, st.n);
    if (top.length < 2) {
      if (top.length === 1 && v === undefined) return info(s, st.p, 'Próxima carta de Personagem', [top[0].id]);
      return;
    }
    if (v === undefined) {
      return ask(s, st, { player: st.p, kind: 'order', title: `Reordene as próximas ${top.length} cartas de Personagem`, text: 'Toque nas cartas na ordem em que quer que saiam (a 1ª fica no topo).', options: top.map((c, i) => ({ v: i, id: c.id })), purpose: 'reorder' });
    }
    const order = v.map((i) => top[i]);
    s.charDeck.splice(0, top.length, ...order);
    log(s, `${pn(s, st.p)} reorganizou o topo do Baralho de Personagens.`);
  };
  // olhar o topo de um baralho e decidir se vai para o fundo
  STEP.peekBottom = (s, st, v) => {
    const deck = st.deck === 'sup' ? s.supDeck : s.charDeck;
    const top = deck[0];
    if (!top) return;
    if (v === undefined) {
      return ask(s, st, { player: st.p, kind: 'confirm', title: 'Colocar esta carta no fundo do baralho?', text: 'Sim = vai para o fundo · Não = continua no topo', options: [{ v: 0, id: top.id }], purpose: 'peekBottom' });
    }
    if (v) { deck.push(deck.shift()); log(s, `${pn(s, st.p)} olhou o topo de um baralho e colocou a carta no fundo.`); }
    else log(s, `${pn(s, st.p)} olhou o topo de um baralho e deixou a carta lá.`);
    if (st.draw && (v || !st.ifBottomed)) {
      if (st.draw === 'sup' ? drawSup(s, st.p) : drawChar(s, st.p)) log(s, `${pn(s, st.p)} comprou 1 ${st.draw === 'sup' ? 'Suporte' : 'Personagem'}.`, 'good');
    }
  };
  // olhar N, 1 para a mão e o resto no fundo
  STEP.pickToHand = (s, st, v) => {
    const deck = st.deck === 'sup' ? s.supDeck : s.charDeck;
    if (st.deck === 'sup' && !deck.length) refillSup(s);
    const top = deck.slice(0, st.n);
    if (!top.length) return;
    const pl = s.players[st.p];
    if (v === undefined) {
      return ask(s, st, {
        player: st.p, kind: 'pick', title: pl.hand.length >= 7 ? 'Mão cheia — escolha qual fica no topo' : 'Escolha 1 carta para a mão',
        text: 'As outras vão para o fundo do baralho.', options: top.map((c) => ({ v: c.uid, id: c.id })), min: 1, max: 1, purpose: 'pickToHand',
      });
    }
    const chosen = top.find((c) => c.uid === v[0]) || top[0];
    deck.splice(0, top.length);
    const rest = top.filter((c) => c !== chosen);
    if (pl.hand.length < 7) { pl.hand.push(chosen); fx(s, { t: 'draw', p: st.p, sup: st.deck === 'sup' }); }
    else deck.unshift(chosen);
    deck.push(...rest);
    log(s, `${pn(s, st.p)} pegou 1 carta e colocou ${rest.length} no fundo.`);
  };

  // ---------------------------------------------------------------- preparação
  function mkPlayer(name) {
    return { name, life: G.RULES.lifeStart, energy: 0, maxE: 0, hand: [], atk: [], def: [], apoio: [], perms: [], discard: [], noReplay: null };
  }
  G.newGame = function (o) {
    o = o || {};
    const s = {
      v: 1, rng: (o.seed != null ? o.seed : Math.floor(Math.random() * 2 ** 31)) | 0, uidN: 0, logN: 0, fxN: 0,
      turn: 0, active: 0, first: 0, phase: 'setup',
      players: [mkPlayer(o.names ? o.names[0] : 'Jogador 1'), mkPlayer(o.names ? o.names[1] : 'Jogador 2')],
      charDeck: [], supDeck: [], evDeck: [], evDiscard: [], event: null,
      queue: [], pending: null, log: [], fx: [], winner: null,
      defeated: 0, lastPlayed: null, resolving: null,
    };
    const mk = (id) => ({ uid: 'u' + ++s.uidN, id });
    s.charDeck = shuffle(s, G.CHAR_IDS.map(mk));
    s.supDeck = shuffle(s, G.SUP_IDS.map(mk));
    s.evDeck = shuffle(s, G.EV_IDS.map(mk));
    s.first = o.first != null ? o.first : rnd(s) < 0.5 ? 0 : 1;
    s.active = s.first;
    log(s, `🎲 ${pn(s, s.first)} começa a partida.`);
    // mão inicial: 4 Personagens e 2 Suportes, todos baratos (custo até ⚡3) e com pelo menos 1 Personagem de ⚡1,
    // para que nenhuma carta inicial fique parada; ninguém escolhe nem devolve cartas
    for (const p of [s.first, opp(s.first)]) {
      const h = s.players[p].hand;
      h.push(takePlayable(s, s.charDeck, 1));
      for (let i = 0; i < 3; i++) h.push(takePlayable(s, s.charDeck, 3));
      for (let i = 0; i < 2; i++) h.push(takePlayable(s, s.supDeck, 3));
    }
    if (G.RULES.secondBonus === 'card') s.players[opp(s.first)].hand.push(s.charDeck.shift());
    if (G.RULES.secondBonus === 'sup') s.players[opp(s.first)].hand.push(s.supDeck.shift());
    s.queue.push({ k: 'setupDone' });
    run(s);
    return s;
  };
  STEP.setupDone = (s) => {
    // não há Evento no início: o primeiro entra sozinho no fim da 3ª rodada
    push(s, { k: 'startTurn' });
    s.turn = 1;
  };

  // ---------------------------------------------------------------- eventos
  STEP.revealEvent = (s) => {
    if (s.event) s.evDiscard.push(s.event);
    if (!s.evDeck.length) {
      s.evDeck = shuffle(s, s.evDiscard.map((id) => ({ uid: 'u' + ++s.uidN, id })));
      s.evDiscard = [];
    }
    const e = s.evDeck.shift();
    s.event = e.id;
    s.evRound = 0;
    fx(s, { t: 'event', id: e.id });
    log(s, `🌟 Novo Evento: ${C[e.id].name}.`, 'event');
    const f = C[e.id].fx;
    const order = [s.active, opp(s.active)];
    if (f === 'flamengo') order.forEach((p) => { if (s.players[p].hand.some((c) => D(c).flamengo)) { gainE(s, p, 1); log(s, `${pn(s, p)} tem um rubro-negro na mão e ganhou ⚡1.`, 'good'); } });
    if (f === 'churrasco') order.forEach((p) => drawChar(s, p));
    if (f === 'presente') order.forEach((p) => drawSup(s, p));
    if (f === 'billSolto') order.forEach((p) => {
      const pl = s.players[p];
      if (pl.def.length >= 2) {
        const low = pl.def.slice().sort((a, b) => D(a).def - D(b).def)[0];
        removeFromField(s, low.uid);
        pl.hand.push(clean(low));
        fx(s, { t: 'bounce', uid: low.uid });
        log(s, `🐶 Bill Solto! ${nm(low)} voltou para a mão de ${pn(s, p)}.`);
      }
    });
    if (f === 'viajar') push(s, ...order.map((p) => ({ k: 'viajar', p })));
    if (f === 'bagunca') push(s, ...order.map((p) => ({ k: 'bagunca', p })));
    if (f === 'bronca') push(s, ...order.map((p) => ({ k: 'bronca', p })));
  };
  STEP.viajar = (s, st, v) => {
    const pl = s.players[st.p];
    const opts = pl.hand.filter((c) => D(c).type === 'char');
    const c = pickOne(s, st, v, { player: st.p, options: opts, optional: true, title: 'Todo Mundo Vai Viajar', text: 'Você pode colocar 1 Personagem da mão no fundo do baralho e comprar 1 Personagem.', purpose: 'viajar' });
    if (!c) return;
    pl.hand.splice(pl.hand.indexOf(c), 1);
    s.charDeck.push(c);
    drawChar(s, st.p);
    log(s, `${pn(s, st.p)} trocou 1 Personagem da mão.`);
  };
  STEP.bagunca = (s, st, v) => {
    const pl = s.players[st.p];
    const chars = pl.hand.filter((c) => D(c).type === 'char');
    if (!chars.length) return;
    if (v === undefined) return ask(s, st, { player: st.p, kind: 'confirm', title: 'Virou Bagunça!', text: `Embaralhar seus ${chars.length} Personagens da mão no baralho e comprar a mesma quantidade?`, options: [], purpose: 'bagunca' });
    if (!v) return;
    pl.hand = pl.hand.filter((c) => D(c).type !== 'char');
    s.charDeck.push(...chars);
    shuffle(s, s.charDeck);
    for (let i = 0; i < chars.length; i++) drawChar(s, st.p);
    log(s, `${pn(s, st.p)} embaralhou a mão e comprou ${chars.length} Personagens novos.`);
  };
  STEP.bronca = (s, st, v) => {
    const o = opp(st.p);
    const opts = space(s, o, 'def') ? s.players[o].atk.filter((c) => movableBy(s, c, o, true)) : [];
    const c = pickOne(s, st, v, { player: st.p, options: opts, title: 'Vô Deu Bronca!', text: 'Escolha 1 Personagem adversário em ⚔️ para mandar para 🛡️.', purpose: 'enemyToDef' });
    if (c) moveTo(s, c.uid, 'def');
  };

  // ---------------------------------------------------------------- turno
  STEP.startTurn = (s) => {
    const p = s.active, pl = s.players[p];
    s.phase = 'main';
    s.defeated = 0;
    s.lastPlayed = null;
    fx(s, { t: 'turn', p });
    log(s, `— Turno ${s.turn}: ${pn(s, p)} —`, 'turn');
    fieldChars(pl).forEach((c) => {
      c.dmg = 0; // o dano sofrido nas cartas cura no início do turno do dono
      c.protStun = false;
      c.protMove = false;
      if (c.stunned && c.stunT < s.turn && D(c).fx === 'earlyRecover') unstun(s, c);
    });
    if (G.RULES.fatigueTurn && s.turn >= G.RULES.fatigueTurn) {
      log(s, `⏳ Cansaço: a partida se arrasta (turno ${s.turn}).`, 'warn');
      loseLife(s, p, G.RULES.fatigueDmg, 'Cansaço');
      if (s.winner != null) return;
    }
    const casa = hasPerm(s, p, 'casa');
    if (casa && pl.life <= G.RULES.heartPts) { discardPerm(s, p, casa); log(s, '🏠 Casa da Vó — aqui ninguém morre!'); heal(s, p, 2); }
    if (s.turn === 1) log(s, `${pn(s, p)} é o primeiro jogador e não compra no primeiro turno.`);
    else drawChar(s, p, true);
    pl.turns = (pl.turns || 0) + 1;
    if (pl.turns === 2 && p !== s.first && /^coin\d$/.test(G.RULES.secondBonus)) {
      // compensação do 2º jogador: energia extra no 2º turno dele (o 1º turno continua com ⚡1 para todos); coinN = ⚡+(N-1)
      pl.pendingCoin = +G.RULES.secondBonus.slice(4) - 1;
    }
    if (pl.turns === 1 && p !== s.first && (G.RULES.secondBonus === 'draw' || G.RULES.secondBonus === 'draw2') && s.charDeck.length) {
      // compensação do 2º jogador: compra extra no 1º turno, mesmo com a mão cheia (a mão pode ir a 8 por um turno)
      const n = G.RULES.secondBonus === 'draw2' ? 2 : 1;
      for (let i = 0; i < n && s.charDeck.length; i++) pl.hand.push(takePlayable(s, s.charDeck, 3));
      log(s, `${pn(s, p)} jogou em 2º e comprou ${n === 1 ? 'uma carta' : n + ' cartas'} extra.`, 'good');
    }
    // energia: o máximo sobe 1 por turno (até 10) e a energia enche até o máximo; o que sobrou do turno anterior se perde
    pl.maxE = Math.min(G.ENERGY_MAX, (pl.maxE || 0) + 1);
    pl.energy = pl.maxE;
    fx(s, { t: 'energy', p, n: pl.energy });
    if (pl.pendingCoin) { gainE(s, p, pl.pendingCoin); log(s, `${pn(s, p)} jogou em 2º e ganhou ⚡+${pl.pendingCoin} neste turno.`, 'good'); pl.pendingCoin = 0; }
    if (pl.turns === 1 && p !== s.first && G.RULES.secondBonus === 'coin') { gainE(s, p, 1); log(s, `${pn(s, p)} jogou em 2º e ganhou uma moeda: ⚡+1 neste turno.`, 'good'); }
    {
      const e = evKey(s);
      if (e === 'caiuPix') { gainE(s, p, 1); log(s, 'Caiu o PIX: ⚡+1 extra neste turno.', 'good'); }
      if (e === 'naoCaiuPix') { pl.energy = Math.max(1, pl.energy - 1); log(s, 'O PIX Não Caiu: ⚡-1 neste turno.', 'warn'); }
      if (e === 'noite') fieldChars(pl).forEach((c) => unstun(s, c));
      const sofa = hasPerm(s, p, 'sofa');
      if (sofa) { gainE(s, p, 1); log(s, 'Sofá: ⚡+1 extra neste turno.', 'good'); }
    }
    if (G.RULES.supDrawEvery && pl.turns > 1 && pl.turns % G.RULES.supDrawEvery === 0) {
      if (drawSup(s, p)) log(s, `${pn(s, p)} comprou 1 Suporte (compra automática).`, 'good');
    }
  };
  STEP.endTurn = (s, st) => {
    const p = s.active, pl = s.players[p];
    fieldChars(pl).forEach((c) => {
      if (c.stunned && c.stunT < s.turn && D(c).fx !== 'earlyRecover') unstun(s, c);
    });
    s.phase = 'end';
    const steps = [];
    if (G.RULES.autoEvent && p !== s.first) {
      s.evRound = (s.evRound || 0) + 1;
      if (s.evRound >= G.RULES.autoEvent) steps.push({ k: 'revealEvent' });
    }
    s.turn++;
    s.active = opp(p);
    steps.push({ k: 'startTurn' });
    push(s, ...steps);
  };

  // ---------------------------------------------------------------- jogar Personagem
  function playChar(s, p, uid, zone, o) {
    o = o || {};
    const pl = s.players[p];
    const i = pl.hand.findIndex((c) => c.uid === uid);
    const c = pl.hand.splice(i, 1)[0];
    const cost = charCost(s, p, c, o.red);
    pl.energy -= cost;
    const inst = { uid: c.uid, id: c.id, enteredT: s.turn };
    pl[zone].push(inst);
    if (evKey(s) === 'sono') { stun(s, inst, p); }
    s.lastPlayed = { uid: c.uid, id: c.id, p };
    fx(s, { t: 'play', uid: c.uid, p, zone });
    log(s, `${pn(s, p)} jogou ${nm(c)} em ${ZI[zone]} ${ZN[zone]} (⚡${cost}).`);
    if (D(c).fx === 'zeroEnergy' && pl.energy === 0) { gainE(s, p, 1); log(s, `${D(c).name} ficou com ⚡0 e ganhou ⚡1.`, 'good'); }
    const steps = [];
    if (AE.has(D(c).fx)) steps.push({ k: 'aeCheck', p, uid: c.uid });
    if (pl.verT !== s.turn && pl.apoio.some((x) => x.uid !== c.uid && D(x).fx === 'vereador')) steps.push({ k: 'vereador', p });
    if (zone === 'atk' && hasPerm(s, p, 'bola')) steps.push({ k: 'bola', p, uid: c.uid });
    push(s, ...steps);
  }
  STEP.aeCheck = (s, st, v) => {
    const o = opp(st.p);
    const nv = hasPerm(s, o, 'naovaleu');
    const L = locate(s, st.uid);
    if (nv && L) {
      if (v === undefined) return ask(s, st, { player: o, kind: 'confirm', title: 'Manual Oficial do "Não Valeu!"', text: `Descartar o Manual para cancelar o efeito Ao Entrar de ${nm(L.card)}?`, options: [{ v: 0, id: L.card.id }], purpose: 'naovaleu' });
      if (v) {
        discardPerm(s, o, nv);
        log(s, `🚫 ${pn(s, o)} usou "Não Valeu!" e cancelou o efeito de ${nm(L.card)}.`, 'warn');
        return;
      }
    }
    push(s, { k: 'aeOffer', p: st.p, uid: st.uid, id: L ? L.card.id : null });
  };
  // Todo efeito Ao Entrar é opcional. Simula o efeito numa cópia: se ele não faria nada, pula;
  // se já oferece "pular" sozinho, resolve direto; senão pergunta ao dono se quer usar.
  const sig = (x) => JSON.stringify([x.players, x.charDeck, x.supDeck, x.evDeck, x.event]);
  STEP.aeOffer = (s, st, v) => {
    if (!st.id) return;
    const ae = { k: 'ae', p: st.p, uid: st.uid, id: st.id };
    if (v === undefined) {
      const sim = JSON.parse(JSON.stringify(s));
      sim.queue = [ae];
      sim.pending = null;
      run(sim);
      const pd = sim.pending;
      const changed = sig(sim) !== sig(s);
      if (!changed && !pd) return; // nada aconteceria (condição não cumprida)
      const needAsk = changed || (pd.player !== st.p) || (pd.kind === 'pick' && pd.min >= 1) || pd.kind === 'option';
      if (!needAsk) return push(s, ae);
      return ask(s, st, { player: st.p, kind: 'confirm', title: `Usar o efeito de ${C[st.id].name}?`, text: C[st.id].text, options: [{ v: 0, id: st.id }], purpose: 'useAE' });
    }
    if (v) push(s, ae);
    else log(s, `${pn(s, st.p)} decidiu não usar o efeito Ao Entrar de ${C[st.id].name}.`);
  };
  STEP.vereador = (s, st) => {
    const pl = s.players[st.p];
    pl.verT = s.turn;
    if (s.charDeck[0]) info(s, st.p, 'Rogerinho, o Vereador: próxima carta de Personagem', [s.charDeck[0].id]);
  };
  STEP.bola = (s, st, v) => {
    const b = hasPerm(s, st.p, 'bola');
    const L = locate(s, st.uid);
    if (!b || !L) return;
    if (v === undefined) return ask(s, st, { player: st.p, kind: 'confirm', title: 'Bola: Quem Perder Paga a Coca', text: `Descartar a Bola para ${nm(L.card)} poder atacar neste turno?`, options: [{ v: 0, id: L.card.id }], purpose: 'bola' });
    if (v) { discardPerm(s, st.p, b); L.card.canAtkT = s.turn; log(s, `⚽ ${nm(L.card)} pode atacar neste turno!`, 'good'); }
  };

  // ---------------------------------------------------------------- efeitos Ao Entrar
  function ownOthers(s, p, uid, zones) {
    const pl = s.players[p];
    return zones.flatMap((z) => pl[z]).filter((c) => c.uid !== uid);
  }
  STEP.ae = (s, st, v) => {
    const p = st.p, o = opp(p), pl = s.players[p], op = s.players[o];
    const id = st.id || (locate(s, st.uid) || {}).card?.id;
    if (!id) return;
    const d = C[id];
    const L = locate(s, st.uid);
    const zone = L && LIM[L.z] ? L.z : null;
    const src = d.name;
    const T = (t) => src + ' — ' + t;
    switch (d.fx) {
      case 'peekReorder2': return push(s, { k: 'reorderTop', p, n: 2 });
      case 'peekReorder3': return push(s, { k: 'reorderTop', p, n: 3 });
      case 'peekCharBottom': return push(s, { k: 'peekBottom', p, deck: 'char' });
      case 'peekSupBottom': return push(s, { k: 'peekBottom', p, deck: 'sup' });
      case 'apoioToAtk': {
        const opts = space(s, p, 'atk') ? pl.apoio.filter((c) => c.uid !== st.uid && !c.stunned) : [];
        const c = pickOne(s, st, v, { player: p, options: opts, optional: true, title: T('mover de Apoio para Ataque'), text: 'Você pode mover 1 Personagem seu de 🤝 para ⚔️.', purpose: 'moveToAtk' });
        if (c) moveTo(s, c.uid, 'atk');
        return;
      }
      case 'moveOther': case 'moveAny': {
        const opts = ownOthers(s, p, d.fx === 'moveAny' ? null : st.uid, ['atk', 'def']).filter((c) => !c.stunned && space(s, p, other(locate(s, c.uid).z)));
        const c = pickOne(s, st, v, { player: p, options: opts, optional: id === 'p69', title: T('mover entre ⚔️ e 🛡️'), text: 'Escolha um Personagem seu: quem está no Ataque vai para a Defesa e vice-versa.', purpose: 'swapZone' });
        if (c) moveTo(s, c.uid, other(locate(s, c.uid).z));
        return;
      }
      case 'moveToDef': {
        const opts = space(s, p, 'def') ? ownOthers(s, p, st.uid, ['atk', 'apoio']).filter((c) => !c.stunned) : [];
        const c = pickOne(s, st, v, { player: p, options: opts, optional: id === 'p24', title: T('mover para Defesa'), text: 'Escolha um Personagem seu para ir para 🛡️.', purpose: 'moveToDef' });
        if (c) moveTo(s, c.uid, 'def');
        return;
      }
      case 'evilynIdol':
        if (pl.hand.length < op.hand.length) { if (drawChar(s, p)) log(s, `${src}: ${pn(s, p)} comprou 1 Personagem.`, 'good'); }
        return;
      case 'bounceSupport': case 'nathaliaFiscal': {
        if (d.fx === 'nathaliaFiscal' && !st.paid) {
          if (op.perms.length < 2 || pl.energy < 1 || !op.perms.some((c) => D(c).cost <= 2)) return;
          {
            if (v === undefined) return ask(s, st, { player: p, kind: 'confirm', title: T('pagar ⚡1?'), text: 'Pague ⚡1 para devolver à mão 1 Suporte Permanente adversário de custo ⚡2 ou menos.', options: [], purpose: 'payFiscal' });
            if (!v) return;
            pl.energy -= 1;
            return push(s, { k: 'ae', p, uid: st.uid, id, paid: true });
          }
        }
        const opts = op.perms.filter((c) => D(c).cost <= 2);
        const c = pickOne(s, st, v, { player: p, options: opts, title: T('devolver Suporte adversário'), text: 'Escolha 1 Suporte do adversário para voltar à mão dele.', purpose: 'bounceSup' });
        if (c) push(s, { k: 'bounceSup', p: o, uid: c.uid });
        return;
      }
      case 'evilynRainha': case 'nathaliaBruxa': case 'arcanjo': {
        if (d.fx === 'evilynRainha' && !(pl.life < op.life)) return;
        if (d.fx === 'arcanjo' && op.atk.length < 3) return;
        const max = d.fx === 'evilynRainha' ? 5 : d.fx === 'nathaliaBruxa' ? 4 : 6;
        const opts = op.atk.filter((c) => D(c).def <= max && !c.stunned);
        const c = pickOne(s, st, v, { player: p, options: opts, title: T('Atordoar inimigo'), text: `Escolha 1 Personagem inimigo em ⚔️ com 🛡️${max} ou menos.`, purpose: 'stunEnemy' });
        if (c) stun(s, c, o);
        return;
      }
      case 'protStunOther': case 'fredMestre': {
        const opts = ownOthers(s, p, st.uid, ['atk', 'def', 'apoio']);
        const c = pickOne(s, st, v, { player: p, options: opts, title: T('proteger aliado'), text: d.fx === 'fredMestre' ? 'Até o início do seu próximo turno, ele não pode ser Atordoado nem movido por efeitos adversários.' : 'Ele não pode ser Atordoado até o início do seu próximo turno.', purpose: 'protect' });
        if (c) { c.protStun = true; if (d.fx === 'fredMestre') c.protMove = true; fx(s, { t: 'shield', uid: c.uid }); log(s, `🛡️ ${nm(c)} está protegido até o próximo turno de ${pn(s, p)}.`, 'good'); }
        return;
      }
      case 'healIfLow': if (pl.life <= 2 * G.RULES.heartPts) heal(s, p, 1); return;
      case 'adeniSanta': heal(s, p, pl.life <= G.RULES.heartPts ? 2 : 1); return;
      case 'energyIfLessLife': if (pl.life < op.life) { gainE(s, p, 1); log(s, `${src}: ganhou ⚡1.`, 'good'); } return;
      case 'helsoCoco': if (pl.energy <= 2) { gainE(s, p, 1); log(s, `${src}: ganhou ⚡1.`, 'good'); } return;
      case 'helsoTranquilo': if (zone === 'def' && pl.def.length === 1) { gainE(s, p, 1); log(s, `${src}: único Defensor, ganhou ⚡1.`, 'good'); } return;
      case 'neiaDurona': if (fieldChars(op).length > fieldChars(pl).length) { gainE(s, p, 1); log(s, `${src}: ganhou ⚡1.`, 'good'); } return;
      case 'julianaSerena':
        if (zone === 'def' && pl.def.length === 1 && L) { L.card.protMove = true; log(s, `${src} não pode ser movida por efeitos adversários até o próximo turno.`); }
        return;
      case 'doloresDeusa': {
        const opts = space(s, o, 'def') ? op.atk.filter((c) => movableBy(s, c, o, true)) : [];
        const c = pickOne(s, st, v, { player: p, options: opts, optional: true, title: T('empurrar inimigo'), text: 'Você pode mover 1 Personagem inimigo de ⚔️ para 🛡️.', purpose: 'enemyToDef' });
        if (c) moveTo(s, c.uid, 'def');
        return;
      }
      case 'revealTop':
        if (s.charDeck[0]) { fx(s, { t: 'reveal', id: s.charDeck[0].id }); log(s, `🗣️ Sara revelou o topo do baralho: ${nm(s.charDeck[0])}.`); }
        return;
      case 'brunor': if (pl.life < op.life) push(s, { k: 'pickToHand', p, deck: 'sup', n: 2 }); return;
      case 'jonesRei': if (!pl.hand.some((c) => D(c).type === 'sup')) push(s, { k: 'pickToHand', p, deck: 'sup', n: 2 }); return;
      case 'fredOraculo': push(s, { k: 'pickToHand', p, deck: 'char', n: 3 }); return;
      case 'donJones': {
        const opts = ownOthers(s, p, st.uid, ['atk', 'def', 'apoio']).filter((c) => c.stunned);
        const c = pickOne(s, st, v, { player: p, options: opts, optional: true, title: T('resgatar Atordoado'), text: 'Você pode devolver à mão 1 Personagem seu Atordoado.', purpose: 'rescue' });
        if (c) { removeFromField(s, c.uid); pl.hand.push(clean(c)); fx(s, { t: 'bounce', uid: c.uid }); log(s, `${nm(c)} voltou para a mão.`); }
        return;
      }
      case 'lecoDeus': {
        if (evKey(s) === 'treta') { log(s, 'Treta no Grupo: nada sai do descarte.'); return; }
        const opts = pl.discard.filter((c) => D(c).type === 'sup' && D(c).kind !== 'imm' && D(c).cost <= 3 && D(c).fx !== 'gambiarra');
        const c = pickOne(s, st, v, { player: p, options: opts, title: T('recuperar Suporte'), text: 'Escolha 1 Suporte Permanente de custo ⚡3 ou menos do seu descarte.', purpose: 'recoverSup' });
        if (c) { pl.discard.splice(pl.discard.indexOf(c), 1); pl.hand.push(c); log(s, `${pn(s, p)} recuperou ${nm(c)} do descarte.`, 'good'); }
        return;
      }
      case 'gabrielSerio': {
        if (zone !== 'def') return;
        const opts = ownOthers(s, p, st.uid, ['atk', 'def', 'apoio']).filter((c) => c.stunned);
        const c = pickOne(s, st, v, { player: p, options: opts, title: T('retirar Atordoamento'), text: 'Escolha um Personagem seu Atordoado.', purpose: 'unstun', auto: true });
        if (c) unstun(s, c);
        return;
      }
      case 'lookHand':
        log(s, `👀 ${pn(s, p)} olhou a mão de ${pn(s, o)}.`);
        info(s, p, `Mão de ${pn(s, o)}`, op.hand.map((c) => c.id), op.hand.length ? '' : 'A mão está vazia.');
        return;
      case 'peekEvent':
        if (s.evDeck[0]) { log(s, `${pn(s, p)} espiou o próximo Evento.`); info(s, p, 'Próximo Evento', [s.evDeck[0].id]); }
        return;
      case 'luarFada': {
        const opts = space(s, p, 'def') ? ownOthers(s, p, st.uid, ['atk']).filter((c) => !c.stunned) : [];
        const c = pickOne(s, st, v, { player: p, options: opts, optional: true, title: T('recuar aliado'), text: 'Você pode mover outro Personagem seu de ⚔️ para 🛡️. Ele fica imune a movimentos adversários até seu próximo turno.', purpose: 'moveToDef' });
        if (c && moveTo(s, c.uid, 'def')) c.protMove = true;
        return;
      }
      case 'luarDeusa': {
        const opts = ownOthers(s, p, st.uid, ['atk', 'def']).filter((c) => !c.stunned);
        if (v === undefined) {
          if (!opts.length) return;
          return ask(s, st, { player: p, kind: 'pick', title: T('mover até 2 aliados'), text: 'Escolha até 2 Personagens seus para trocar entre ⚔️ e 🛡️.', options: opts.map((c) => ({ v: c.uid, id: c.id })), min: 0, max: 2, purpose: 'swapZone' });
        }
        const moved = [];
        (v || []).forEach((u) => { const Lc = locate(s, u); if (Lc && moveTo(s, u, other(Lc.z)) && other(Lc.z) === 'def') moved.push(u); });
        if (moved.length) push(s, { k: 'luarDeusa2', p, moved });
        return;
      }
      default:
    }
  };
  STEP.luarDeusa2 = (s, st, v) => {
    const opts = st.moved.map((u) => locate(s, u)).filter((L) => L && L.z === 'def').map((L) => L.card);
    const c = pickOne(s, st, v, { player: st.p, options: opts, title: 'Luar, Deusa da Lua — bênção lunar', text: 'Escolha 1 que foi para 🛡️: ele não pode ser Atordoado até seu próximo turno.', purpose: 'protect', auto: true });
    if (c) { c.protStun = true; fx(s, { t: 'shield', uid: c.uid }); log(s, `🌙 ${nm(c)} está protegido.`, 'good'); }
  };
  STEP.bounceSup = (s, st, v) => {
    const o = st.p; // dono do Suporte alvo
    const pl = s.players[o];
    const tgt = pl.perms.find((c) => c.uid === st.uid);
    if (!tgt) return;
    const troll = pl.apoio.some((c) => D(c).fx === 'lecoTroll') && pl.trollT !== s.turn && pl.energy >= 1;
    if (troll && !st.trollAsked) {
      if (v === undefined) return ask(s, st, { player: o, kind: 'confirm', title: 'Leco, Troll da Construção', text: `Pagar ⚡1 para impedir que ${nm(tgt)} saia do campo?`, options: [{ v: 0, id: tgt.id }], purpose: 'troll' });
      if (v) { pl.energy -= 1; pl.trollT = s.turn; log(s, `🔨 Leco segurou ${nm(tgt)} no lugar (⚡1).`, 'good'); return; }
    }
    const gb = pl.perms.find((c) => D(c).fx === 'gambiarra' && c.uid !== tgt.uid);
    if (gb) { discardPerm(s, o, gb); log(s, `🔧 Gambiarra do Leco foi descartada no lugar de ${nm(tgt)}. Agora aguenta!`, 'good'); return; }
    pl.perms.splice(pl.perms.indexOf(tgt), 1);
    pl.hand.push(clean(tgt));
    fx(s, { t: 'permOut', uid: tgt.uid, p: o });
    log(s, `${nm(tgt)} voltou para a mão de ${pn(s, o)}.`, 'warn');
  };

  // ---------------------------------------------------------------- Suportes
  function playSup(s, p, uid) {
    const pl = s.players[p];
    const i = pl.hand.findIndex((c) => c.uid === uid);
    const c = pl.hand.splice(i, 1)[0];
    const cost = supCost(s, p, c);
    pl.energy -= cost;
    const d = D(c);
    fx(s, { t: 'sup', p, id: c.id, uid: c.uid });
    log(s, `${pn(s, p)} jogou o Suporte ${d.name} (⚡${cost}).`);
    const steps = [];
    if (d.kind === 'imm') {
      s.resolving = { uid: c.uid, id: c.id, p };
      steps.push({ k: 'supEffect', p, uid: c.uid, id: c.id }, { k: 'supDone', p, card: clean(c) });
    } else steps.push({ k: 'permIn', p, card: clean(c) });
    if (pl.kmT !== s.turn && pl.apoio.some((x) => D(x).fx === 'kevinMestre')) steps.push({ k: 'kevinMestre', p });
    push(s, ...steps);
  }
  STEP.kevinMestre = (s, st) => {
    s.players[st.p].kmT = s.turn;
    push(s, { k: 'peekBottom', p: st.p, deck: 'char' });
  };
  STEP.permIn = (s, st, v) => {
    const pl = s.players[st.p];
    if (pl.perms.length >= 2) {
      const c = pickOne(s, st, v, { player: st.p, options: pl.perms.slice(), title: 'Vagas de Suporte cheias', text: `Descarte 1 Suporte Permanente para abrir espaço para ${nm(st.card)}.`, purpose: 'replacePerm' });
      if (c === undefined) return;
      if (c) discardPerm(s, st.p, c);
    }
    pl.perms.push(st.card);
    fx(s, { t: 'permIn', uid: st.card.uid, p: st.p });
  };
  STEP.supDone = (s, st) => {
    const pl = s.players[st.p];
    pl.discard.push(st.card);
    s.resolving = null;
    if (pl.lpT !== s.turn && fieldChars(pl).some((c) => D(c).fx === 'lecoPedreiro')) {
      pl.lpT = s.turn;
      gainE(s, st.p, 1);
      log(s, 'Leco, o Pedreiro: ganhou ⚡1.', 'good');
    }
  };
  STEP.supEffect = (s, st, v) => {
    const p = st.p, pl = s.players[p], o = opp(p), op = s.players[o];
    switch (C[st.id].fx) {
      case 'fifinha': return push(s, { k: 'pickToHand', p, deck: 'char', n: 2 });
      case 'cafezinho': gainE(s, p, 2); return;
      case 'agua': return push(s, { k: 'reorderTop', p, n: 2 });
      case 'pf': heal(s, p, 1); return;
      case 'caixa': {
        if (evKey(s) === 'treta') { log(s, 'Treta no Grupo: nada sai do descarte.'); return; }
        const opts = pl.discard.filter((c) => D(c).type === 'sup' && D(c).kind !== 'imm' && D(c).cost <= 3);
        const c = pickOne(s, st, v, { player: p, options: opts, title: 'Caixa de Ferramentas — recuperar Suporte', text: 'Escolha 1 Suporte Permanente de custo ⚡3 ou menos do descarte.', purpose: 'recoverSup' });
        if (c) { pl.discard.splice(pl.discard.indexOf(c), 1); pl.hand.push(c); log(s, `${pn(s, p)} recuperou ${nm(c)}.`, 'good'); }
        return;
      }
      case 'grupo':
        log(s, `👀 ${pn(s, p)} olhou a mão de ${pn(s, o)}.`);
        return info(s, p, `Mão de ${pn(s, o)}`, op.hand.map((c) => c.id), op.hand.length ? '' : 'A mão está vazia.');
      case 'van': {
        const opts = fieldChars(pl).filter((c) => !c.stunned);
        if (v === undefined) {
          if (!opts.length) return;
          return ask(s, st, { player: p, kind: 'pick', title: 'Van do Bruno — Cabe Mais Um!', text: 'Escolha até 2 Personagens seus para mudar de área.', options: opts.map((c) => ({ v: c.uid, id: c.id })), min: 0, max: 2, purpose: 'van' });
        }
        push(s, ...(v || []).map((u) => ({ k: 'zoneMove', p, uid: u })));
        return;
      }
      case 'espelho': {
        const lp = s.lastPlayed;
        if (!lp || lp.p !== p || !AE.has(C[lp.id].fx) || C[lp.id].cost > 4) { log(s, 'Espelho: não há efeito Ao Entrar válido para copiar.'); return; }
        log(s, `🪞 Espelho copiou o efeito de ${C[lp.id].name}!`, 'good');
        return push(s, { k: 'ae', p, uid: lp.uid, id: lp.id });
      }
      case 'garrafada': case 'poltrona': {
        const isG = C[st.id].fx === 'garrafada';
        if (v === undefined) {
          return ask(s, st, { player: p, kind: 'option', title: C[st.id].name, text: 'Escolha 1:', purpose: C[st.id].fx,
            options: isG ? [{ v: 'e', label: 'Ganhar ⚡2' }, { v: 'h', label: 'Recuperar ❤️2' }] : [{ v: 'h', label: 'Recuperar ❤️2' }, { v: 'd', label: 'Comprar até 2 Personagens' }] });
        }
        if (v === 'e') gainE(s, p, 2);
        else if (v === 'h') heal(s, p, 2);
        else { let n = 0; if (drawChar(s, p)) n++; if (drawChar(s, p)) n++; log(s, `${pn(s, p)} comprou ${n} Personagem(ns).`); }
        return;
      }
      case 'churrasco': push(s, { k: 'pickToHand', p, deck: 'char', n: 3 }, { k: 'gain', p, n: 1 }); return;
      case 'g220': {
        const opts = pl.hand.filter((c) => D(c).type === 'char' && canPlayCharAnywhere(s, p, c, 2));
        const c = pickOne(s, st, v, { player: p, options: opts, title: 'Gambiarra 220V no 110V', text: 'Escolha 1 Personagem da mão para jogar agora pagando ⚡2 a menos.', purpose: 'g220' });
        if (c) push(s, { k: 'zonePlay', p, uid: c.uid, red: 2 });
        return;
      }
      case 'taxi': {
        if (!st.out) {
          const opts = fieldChars(pl);
          const c = pickOne(s, st, v, { player: p, options: opts, title: 'Táxi do Rogerinho — quem sai do campo?', text: 'Escolha 1 Personagem seu no campo para voltar à mão.', purpose: 'taxiOut' });
          if (c) push(s, { k: 'supEffect', p, id: st.id, uid: st.uid, out: c.uid });
          return;
        }
        const Lout = locate(s, st.out);
        if (!Lout) return;
        const opts = pl.hand.filter((c) => D(c).type === 'char' && pl.energy >= charCost(s, p, c, 1) && !(pl.noReplay && pl.noReplay.uid === c.uid && pl.noReplay.t === s.turn));
        const c = pickOne(s, st, v, { player: p, options: opts, optional: true, title: 'Táxi do Rogerinho — quem entra?', text: `Escolha 1 Personagem da mão para entrar em ${ZN[Lout.z]} no lugar de ${nm(Lout.card)} (custa ⚡1 a menos).`, purpose: 'taxiIn' });
        if (!c) return;
        const z = Lout.z;
        removeFromField(s, Lout.card.uid);
        fx(s, { t: 'bounce', uid: Lout.card.uid });
        playChar(s, p, c.uid, z, { red: 1 });
        pl.hand.push(clean(Lout.card));
        log(s, `🚕 ${nm(Lout.card)} pegou o táxi de volta para a mão.`);
        return;
      }
      default:
    }
  };
  STEP.gain = (s, st) => { gainE(s, st.p, st.n); };
  STEP.drawC = (s, st) => { if (drawChar(s, st.p)) log(s, `${pn(s, st.p)} comprou 1 Personagem.`, 'good'); };
  STEP.peekEvBottom = (s, st, v) => {
    const top = s.evDeck[0];
    if (!top) return;
    if (v === undefined) return ask(s, st, { player: st.p, kind: 'confirm', title: 'Próximo Evento — colocar no fundo?', text: 'Sim = vai para o fundo do baralho de Eventos · Não = continua no topo', options: [{ v: 0, id: top.id }], purpose: 'peekBottom' });
    if (v) { s.evDeck.push(s.evDeck.shift()); log(s, `${pn(s, st.p)} mandou o próximo Evento para o fundo.`); }
  };
  STEP.zoneMove = (s, st, v) => {
    const L = locate(s, st.uid);
    if (!L || !LIM[L.z] || L.card.stunned) return;
    const zs = ['atk', 'def', 'apoio'].filter((z) => z !== L.z && space(s, st.p, z));
    if (!zs.length) return;
    if (v === undefined) return ask(s, st, { player: st.p, kind: 'option', title: `Para onde vai ${nm(L.card)}?`, text: '', purpose: 'zone', options: zs.map((z) => ({ v: z, label: ZI[z] + ' ' + ZN[z] })).concat([{ v: 'stay', label: 'Ficar onde está' }]), cardId: L.card.id });
    if (LIM[v]) moveTo(s, st.uid, v);
  };
  STEP.zonePlay = (s, st, v) => {
    const pl = s.players[st.p];
    const c = pl.hand.find((x) => x.uid === st.uid);
    if (!c) return;
    const zs = ['atk', 'def', 'apoio'].filter((z) => space(s, st.p, z));
    if (!zs.length || pl.energy < charCost(s, st.p, c, st.red)) return;
    if (v === undefined) return ask(s, st, { player: st.p, kind: 'option', title: `Onde jogar ${nm(c)}?`, text: `Custo com desconto: ⚡${charCost(s, st.p, c, st.red)}`, purpose: 'zone', options: zs.map((z) => ({ v: z, label: ZI[z] + ' ' + ZN[z] })), cardId: c.id });
    if (LIM[v]) playChar(s, st.p, c.uid, v, { red: st.red });
  };
  function canPlayCharAnywhere(s, p, c, red) {
    const pl = s.players[p];
    if (pl.noReplay && pl.noReplay.uid === c.uid && pl.noReplay.t === s.turn) return false;
    return pl.energy >= charCost(s, p, c, red) && ['atk', 'def', 'apoio'].some((z) => space(s, p, z));
  }

  // ---------------------------------------------------------------- Ativáveis
  function actTargets(s, p, c) {
    const pl = s.players[p];
    switch (D(c).fx) {
      case 'actUnstun': return fieldChars(pl).filter((x) => x.uid !== c.uid && x.stunned);
      case 'actUnstunDef': return pl.def.filter((x) => x.uid !== c.uid && x.stunned);
      case 'actPeek': return deckN(s, 'char') ? [true] : [];
      default: return [];
    }
  }
  STEP.act = (s, st, v) => {
    const L = locate(s, st.uid);
    if (!L) return;
    const f = D(L.card).fx;
    if (f === 'actPeek') return push(s, { k: 'peekBottom', p: st.p, deck: 'char' });
    const opts = actTargets(s, st.p, L.card);
    const c = pickOne(s, st, v, { player: st.p, options: opts, title: `${D(L.card).name} — retirar Atordoamento`, text: 'Escolha o aliado que vai se recuperar.', purpose: 'unstun', auto: true });
    if (c) unstun(s, c);
  };
  STEP.porta = (s, st, v) => {
    const pl = s.players[st.p];
    const c = pickOne(s, st, v, { player: st.p, options: fieldChars(pl), optional: true, title: 'Porta dos Fundos Dimensional', text: 'Escolha 1 Personagem seu para voltar à mão.', purpose: 'porta' });
    if (!c) return;
    const pt = hasPerm(s, st.p, 'porta');
    if (!pt) return;
    discardPerm(s, st.p, pt);
    removeFromField(s, c.uid);
    pl.hand.push(clean(c));
    pl.noReplay = { uid: c.uid, t: s.turn };
    fx(s, { t: 'bounce', uid: c.uid });
    log(s, `🚪 ${nm(c)} saiu pela Porta dos Fundos e voltou para a mão.`);
  };

  // ---------------------------------------------------------------- Passar
  STEP.afterPass = (s, st, v) => {
    const p = st.p, pl = s.players[p];
    if (st.what === 'bill') {
      if (hasPerm(s, p, 'bill')) push(s, { k: 'reorderTop', p, n: 2 });
      return;
    }
    const j = hasPerm(s, p, 'jardim');
    if (!j || pl.life > 2 * G.RULES.heartPts || evKey(s) === 'discussao') return;
    if (v === undefined) return ask(s, st, { player: p, kind: 'confirm', title: 'Jardim Milagroso da Dolores', text: 'Descartar o Jardim para recuperar ❤️2?', options: [{ v: 0, id: j.id }], purpose: 'jardim' });
    if (v) { discardPerm(s, p, j); heal(s, p, 2); }
  };

  // ---------------------------------------------------------------- Combate
  function canAttack(s, p, c) {
    const pl = s.players[p];
    return pl.atk.includes(c) && !c.stunned && c.attackedT !== s.turn && c.movedT !== s.turn && (c.enteredT !== s.turn || c.canAtkT === s.turn);
  }
  function attackTargets(s, p) {
    const o = s.players[opp(p)];
    const t = o.def.map((c) => c.uid).concat(o.atk.map((c) => c.uid));
    if (!o.def.length && evKey(s) !== 'almoco') t.push('life');
    return t;
  }
  G.canAttack = canAttack;
  G.attackTargets = attackTargets;
  // Combate: o atacante causa o próprio ATK; um Personagem atacado contra-ataca com o ATK dele (ao mesmo tempo).
  // O dano fica na carta até o início do turno do dono dela (a carta cai quando o dano chega à DEF).
  // Ataque ao herói tira vida igual ao ATK do atacante e não sofre contra-ataque.
  function resolveAttack(s, p, A, target) {
    const o = opp(p), O = s.players[o];
    A.attackedT = s.turn;
    if (target === 'life') {
      const dmg = D(A).atk;
      fx(s, { t: 'attack', uid: A.uid, target: 'life', p: o, a: dmg });
      log(s, `⚔️ ${nm(A)} atacou ${pn(s, o)} diretamente!`, 'warn');
      loseLife(s, o, dmg, nm(A));
      return;
    }
    const T = O.def.concat(O.atk).find((c) => c.uid === target);
    const challenge = O.atk.includes(T);
    const a = D(A).atk;
    const t = D(T).atk + (D(T).fx === 'quebraManta' && challenge ? 2 : 0); // contra-ataque
    fx(s, { t: 'attack', uid: A.uid, target: T.uid, a, d: t });
    log(s, `⚔️ ${nm(A)} (${a} de ataque) ${challenge ? 'desafiou' : 'atacou'} ${nm(T)}, que contra-atacou com ${t}.`);
    const lastDef = !challenge && O.def.length === 1;
    T.dmg = (T.dmg || 0) + a;
    A.dmg = (A.dmg || 0) + t;
    fx(s, { t: 'hit', uid: T.uid, n: a });
    fx(s, { t: 'hit', uid: A.uid, n: t });
    let tDown = T.dmg >= D(T).def;
    let aDown = A.dmg >= D(A).def;
    const both = tDown && aDown;
    if (both && challenge && D(A).fx === 'paladino') { aDown = false; A.dmg = D(A).def - 1; log(s, 'Paladino Nervoso: no empate do Desafio, só o inimigo cai!'); }
    if (aDown) {
      const L = removeFromField(s, A.uid);
      fx(s, { t: 'defeat', uid: A.uid, p });
      log(s, `☠️ ${nm(A)} foi derrotado.`, 'bad');
      sendDefeated(s, L, { combat: true, toBottom: both && D(A).fx === 'helsoPe' });
    }
    if (tDown) {
      const L = removeFromField(s, T.uid);
      fx(s, { t: 'defeat', uid: T.uid, p: o });
      log(s, `☠️ ${nm(T)} foi derrotado.`, 'bad');
      sendDefeated(s, L, { combat: true, toBottom: challenge && D(A).fx === 'helsoNasa' && !aDown });
      s.defeated++;
    }
    if (lastDef && tDown) {
      const pe = hasPerm(s, o, 'pe');
      if (pe) { discardPerm(s, o, pe); log(s, '🙏 Pé de Benção da Vó!'); heal(s, o, 1); }
      if (D(T).fx === 'julianaDama') { log(s, 'Juliana, Dama da Paciência Infinita: a última Defesa cai, mas a vida volta!', 'good'); heal(s, o, 1); }
    }
    if (tDown && !aDown && s.winner == null) {
      const f = D(A).fx;
      if (((!challenge && f === 'afterDefToDef') || (challenge && f === 'taitanos')) && space(s, p, 'def')) push(s, { k: 'selfToDef', p, uid: A.uid });
    }
  }
  STEP.selfToDef = (s, st, v) => {
    const L = locate(s, st.uid);
    if (!L || L.z !== 'atk' || !space(s, st.p, 'def')) return;
    if (v === undefined) return ask(s, st, { player: st.p, kind: 'confirm', title: `${D(L.card).name}: recuar para a Defesa?`, text: 'Depois da vitória, você pode mover este Personagem para 🛡️.', options: [{ v: 0, id: L.card.id }], purpose: 'selfToDef' });
    if (v) moveTo(s, st.uid, 'def');
  };

  // ---------------------------------------------------------------- ações públicas
  function err(m) { return { ok: false, err: m }; }
  function validChoice(pd, v) {
    const vals = (pd.options || []).map((o) => o.v);
    switch (pd.kind) {
      case 'info': return true;
      case 'confirm': return typeof v === 'boolean';
      case 'option': return vals.includes(v);
      case 'order': return Array.isArray(v) && v.length === vals.length && vals.every((x) => v.includes(x));
      case 'pick': return Array.isArray(v) && v.length >= pd.min && v.length <= pd.max && v.every((x) => vals.includes(x)) && new Set(v).size === v.length;
      default: return false;
    }
  }

  G.act = function (s, p, a) {
    if (s.winner != null) return err('A partida acabou.');
    if (s.pending) {
      if (a.t !== 'choose' || s.pending.player !== p) return err('Aguardando uma escolha.');
      if (!validChoice(s.pending, a.v)) return err('Escolha inválida.');
      const st = s.pending.step;
      s.pending = null;
      STEP[st.k](s, st, a.v);
      run(s);
      return { ok: true };
    }
    if (a.t === 'choose') return err('Nada para escolher.');
    if (p !== s.active) return err('Não é o seu turno.');
    const pl = s.players[p];
    if (s.phase !== 'main') return err('Agora não.');
    switch (a.t) {
      case 'playChar': {
        const c = pl.hand.find((x) => x.uid === a.uid);
        if (!c || D(c).type !== 'char') return err('Carta inválida.');
        if (!LIM[a.zone] || !space(s, p, a.zone)) return err('Sem espaço nessa zona.');
        if (pl.noReplay && pl.noReplay.uid === c.uid && pl.noReplay.t === s.turn) return err('Esse Personagem não pode ser jogado de novo neste turno.');
        if (pl.energy < charCost(s, p, c)) return err('Energia insuficiente.');
        playChar(s, p, c.uid, a.zone);
        break;
      }
      case 'playSup': {
        const c = pl.hand.find((x) => x.uid === a.uid);
        if (!c || D(c).type !== 'sup') return err('Carta inválida.');
        if (pl.energy < supCost(s, p, c)) return err('Energia insuficiente.');
        playSup(s, p, c.uid);
        break;
      }
      case 'buySup': {
        if (pl.hand.length >= 7) return err('Mão cheia (7 cartas).');
        if (pl.energy < G.RULES.buyCost) return err(`Comprar um Suporte custa ⚡${G.RULES.buyCost}.`);
        if (!s.supDeck.length) refillSup(s);
        if (!s.supDeck.length) return err('Não há Suportes para comprar.');
        pl.energy -= G.RULES.buyCost;
        log(s, `${pn(s, p)} comprou 1 Suporte (⚡${G.RULES.buyCost}).`);
        if (fieldChars(pl).some((c) => D(c).fx === 'jonesPets')) push(s, { k: 'pickToHand', p, deck: 'sup', n: 2 });
        else drawSup(s, p);
        break;
      }
      case 'move': {
        if (evKey(s) === 'temporal') return err('Temporal de Domingo: mover Personagens está bloqueado.');
        const L = locate(s, a.uid);
        if (!L || L.p !== p || !LIM[L.z]) return err('Carta inválida.');
        if (L.card.stunned) return err('Personagem Atordoado não pode se mover.');
        if (L.card.movedT === s.turn) return err('Esse Personagem já foi movido neste turno.');
        if (!LIM[a.zone] || a.zone === L.z || !space(s, p, a.zone)) return err('Sem espaço nessa zona.');
        if (pl.energy < G.RULES.moveCost) return err(`Mover custa ⚡${G.RULES.moveCost}.`);
        pl.energy -= G.RULES.moveCost;
        moveTo(s, a.uid, a.zone);
        L.card.movedT = s.turn;
        break;
      }
      case 'activate': {
        if (evKey(s) === 'festa') return err('Festa da Família: habilidades Ativáveis bloqueadas.');
        const L = locate(s, a.uid);
        if (!L || L.p !== p || !LIM[L.z] || !D(L.card).activatable) return err('Carta inválida.');
        if (L.card.stunned) return err('Personagem Atordoado não pode usar habilidades.');
        if (L.card.actT === s.turn) return err('Essa habilidade já foi usada neste turno.');
        const cost = actCost(s, p, L.card);
        if (pl.energy < cost) return err('Energia insuficiente.');
        if (!actTargets(s, p, L.card).length) return err('Não há alvo válido para essa habilidade.');
        if (hasPerm(s, p, 'cristal') && pl.cristalT !== s.turn) pl.cristalT = s.turn;
        pl.energy -= cost;
        L.card.actT = s.turn;
        log(s, `✨ ${pn(s, p)} ativou ${nm(L.card)} (⚡${cost}).`);
        fx(s, { t: 'activate', uid: L.card.uid });
        push(s, { k: 'act', p, uid: L.card.uid });
        break;
      }
      case 'usePerm': {
        const c = pl.perms.find((x) => x.uid === a.uid);
        if (!c || D(c).fx !== 'porta' || !fieldChars(pl).length) return err('Não dá para usar agora.');
        push(s, { k: 'porta', p });
        break;
      }
      case 'attack': {
        const A = pl.atk.find((x) => x.uid === a.uid);
        if (!A || !canAttack(s, p, A)) return err('Esse Personagem não pode atacar agora.');
        if (!attackTargets(s, p).includes(a.target)) return err('Alvo inválido.');
        resolveAttack(s, p, A, a.target);
        break;
      }
      case 'endTurn':
        // gatilhos de "fim do turno" (Bill, Jardim da Dolores) e depois a troca de turno
        push(s, { k: 'afterPass', p, what: 'bill' }, { k: 'afterPass', p, what: 'jardim' }, { k: 'endTurn' });
        break;
      default:
        return err('Ação desconhecida.');
    }
    run(s);
    return { ok: true };
  };

  // Todas as ações possíveis agora (usado pela IA e pela interface).
  G.legal = function (s, p) {
    const out = [];
    if (s.winner != null || s.pending || p !== s.active || s.phase !== 'main') return out;
    const pl = s.players[p];
    pl.hand.forEach((c) => {
      const d = D(c);
      if (d.type === 'char') {
        if (pl.noReplay && pl.noReplay.uid === c.uid && pl.noReplay.t === s.turn) return;
        if (pl.energy < charCost(s, p, c)) return;
        ['atk', 'def', 'apoio'].forEach((z) => { if (space(s, p, z)) out.push({ t: 'playChar', uid: c.uid, zone: z }); });
      } else if (pl.energy >= supCost(s, p, c)) out.push({ t: 'playSup', uid: c.uid });
    });
    if (pl.hand.length < 7 && pl.energy >= G.RULES.buyCost && (deckN(s, 'sup') || (evKey(s) !== 'treta' && s.players.some((x) => x.discard.some((c) => D(c).type === 'sup'))))) out.push({ t: 'buySup' });
    if (evKey(s) !== 'temporal' && pl.energy >= G.RULES.moveCost) {
      ['atk', 'def', 'apoio'].forEach((z) => pl[z].forEach((c) => {
        if (c.stunned || c.movedT === s.turn) return;
        ['atk', 'def', 'apoio'].forEach((z2) => { if (z2 !== z && space(s, p, z2)) out.push({ t: 'move', uid: c.uid, zone: z2 }); });
      }));
    }
    if (evKey(s) !== 'festa') fieldChars(pl).forEach((c) => {
      if (D(c).activatable && !c.stunned && c.actT !== s.turn && pl.energy >= actCost(s, p, c) && actTargets(s, p, c).length) out.push({ t: 'activate', uid: c.uid });
    });
    const tg = attackTargets(s, p);
    pl.atk.forEach((c) => { if (canAttack(s, p, c)) tg.forEach((t) => out.push({ t: 'attack', uid: c.uid, target: t })); });
    pl.perms.forEach((c) => { if (D(c).fx === 'porta' && fieldChars(pl).length) out.push({ t: 'usePerm', uid: c.uid }); });
    out.push({ t: 'endTurn' });
    return out;
  };

  // Visão do estado para um jogador (esconde a mão do adversário, baralhos e escolhas alheias).
  G.viewFor = function (s, p) {
    const v = JSON.parse(JSON.stringify(s));
    const o = opp(p);
    v.players[o].hand = v.players[o].hand.map((c) => ({ uid: c.uid, hidden: true, back: C[c.id].type }));
    v.charDeckN = s.charDeck.length;
    v.supDeckN = s.supDeck.length;
    v.evDeckN = s.evDeck.length;
    v.charDeck = []; v.supDeck = []; v.evDeck = [];
    v.queue = [];
    v.rng = 0;
    v.me = p;
    if (v.pending) {
      if (v.pending.player !== p) v.pending = { player: v.pending.player, kind: 'wait', title: v.pending.title };
      else delete v.pending.step;
    }
    return v;
  };

  G.clone = (s) => JSON.parse(JSON.stringify(s));
  G.util = { D, opp, nm, fieldChars, evKey, space, hasPerm, onField, movableBy, actTargets, canPlayCharAnywhere };
})();
