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
  Object.defineProperty(G, 'ENERGY_MAX', { get: () => (G.RULES && G.RULES.energyMax) || 10 });
  // Regras ajustáveis (v4: energia que recarrega).
  G.RULES = {
    autoEvent: 3,        // o Evento troca sozinho a cada N rodadas completas (0 = desligado)
    secondBonus: 'none', // compensação do 2º jogador: 'coinN' = ⚡+(N-1) no 2º turno dele (o 1º turno é ⚡1 para todos) | 'card' | 'sup' | 'draw' | 'none'
    catchupHeal: 0,      // (teste) no início do turno, quem tem menos vida recupera N de ❤️
    defHp: 0,            // (teste) vida extra dos Defensores
    defCounter: 0,       // (teste) bônus de contra-ataque dos Defensores
    noAttackUntil: 0,    // (teste) ninguém ataca antes deste turno global
    turnOrder: 'normal', // ordem dos turnos: 'normal' (A B A B) | 'snake' (A B B A A B B A) | 'tm' (Thue-Morse)
    fatigueTurn: 80,     // a partir deste turno (global) quem abre o turno perde Vida (evita partidas eternas); 0 = desligado
    fatigueDmg: 3,
    supDrawEvery: 2,     // compra automática de 1 Suporte a cada N turnos do próprio jogador (0 = desligado)
    lifeStart: 25,       // pontos de vida de cada herói
    heartPts: 5,         // 1 ❤️ impresso nas cartas = 5 pontos de vida ("recupere ❤️1" cura 5)
    moveCost: 1,         // mover um Personagem custa ⚡ (1x por Personagem por turno)
    buyCost: 1,
    energyMax: 10,       // teto da energia por turno
    secondEnergyTurns: 5, // quem joga em 2º tem ⚡+1 nos primeiros N turnos dele (equilibra a vantagem de começar)
    secondEnergy: 0,     // (teste) energia extra de quem joga em 2º (ele começa com ⚡1+N e sobe 1 por turno)
    secondLife: 0,       // (teste) pontos de vida extras de quem joga em 2º
    defResist: 1,        // todo Defensor (🛡️) sofre N de dano a menos em cada ataque (mínimo 1)
    swapCost: 2,         // trocar 2 Personagens seus de lugar custa ⚡ (1x por turno)
    cycleCost: 1,        // descartar 1 carta da mão e comprar 1 do mesmo tipo (1x por turno)          // comprar 1 Suporte custa ⚡
  };

  const AE = new Set(['cureIfBehind', 'cureAllHeal1', 'cureHaste', 'cure5Each', 'cureProtect', 'healBoard', 'drawIfFew', 'heal2', 'nextCharRed', 'nextSupRed', 'drawSup1', 'apoioToAtk', 'moveOther', 'evilynIdol', 'bounceSupport',
    'healIfLow', 'moveAny', 'doloresDeusa', 'moveToDef',
    'energyIfLessLife', 'brunor', 'helsoTranquilo', 'helsoCoco', 'jonesRei', 'donJones', 'julianaSerena',
    'lecoDeus', 'adeniSanta', 'fredOraculo', 'gabrielSerio', 'neiaDurona', 'lookHand',
    'nathaliaFiscal', 'peekEvent', 'luarFada', 'luarDeusa',
    'heal1', 'cure3Def', 'heal1cure3', 'ping2', 'ping3', 'ping4', 'pingAtk2', 'giveLig2']);
  // cartas cujo efeito depende de onde elas (ou as outras) estão no campo
  const POS_FX = new Set(['auraRightAtk', 'auraFrontAtk', 'cureRight1', 'cureRight2', 'frontResist', 'auraNeighborsResist', 'guardiaFront', 'auraAtk', 'apoioCureDef2', 'apoioDefResist']);
  G.POS_FX = POS_FX;
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
  // espaços fixos: cada zona tem LIM[z] espaços (0 = esquerda); a carta fica no espaço onde foi jogada
  const freeSlots = (s, p, z) => { const used = new Set(s.players[p][z].map((c) => c.slot)); const out = []; for (let i = 0; i < LIM[z]; i++) if (!used.has(i)) out.push(i); return out; };
  function ensureSlots(s) { // garante `slot` em cartas de jogos antigos
    s.players.forEach((pl) => ['atk', 'def', 'apoio'].forEach((z) => {
      const used = new Set();
      pl[z].forEach((c) => { if (c.slot == null || c.slot >= LIM[z] || used.has(c.slot)) c.slot = null; else used.add(c.slot); });
      pl[z].forEach((c) => { if (c.slot == null) { for (let i = 0; i < LIM[z]; i++) if (!used.has(i)) { c.slot = i; used.add(i); break; } } });
    }));
  }
  function placeIn(s, p, z, card, slot) {
    const fr = freeSlots(s, p, z);
    card.slot = slot != null && fr.includes(slot) ? slot : fr[0];
    s.players[p][z].push(card);
  }
  const cardAt = (s, p, z, slot) => s.players[p][z].find((c) => c.slot === slot) || null;
  G.freeSlots = freeSlots; G.cardAt = cardAt; G.ensureSlots = ensureSlots;
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
    pl.life = Math.min(pl.maxLife || G.RULES.lifeStart, pl.life + n * G.RULES.heartPts);
    const g = pl.life - b;
    if (g > 0) { fx(s, { t: 'heal', p, n: g }); const hh = g / G.RULES.heartPts; log(s, `${pn(s, p)} recuperou ${Number.isInteger(hh) ? '❤️' + hh + ' (' + g + ' de vida)' : g + ' de vida'}.`, 'good'); }
    return g;
  }
  function loseLife(s, p, n, why) {
    const pl = s.players[p];
    const casa = hasPerm(s, p, 'casa');
    if (casa && n > 0 && pl.life - n <= 0) {
      discardPerm(s, p, casa);
      pl.life = G.RULES.heartPts;
      fx(s, { t: 'damage', p, n });
      log(s, `🏠 Casa da Vó — aqui ninguém morre! ${pn(s, p)} fica com ❤️1.`, 'good');
      return;
    }
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
      // série: quem vencer 2 partidas seguidas leva a série
      const sr = s.series;
      if (sr) {
        sr.res.push(s.winner); sr.w[s.winner]++;
        const L = sr.res.length;
        if (L >= 2 && sr.res[L - 1] === sr.res[L - 2]) { sr.champ = s.winner; log(s, `🏅 ${pn(s, s.winner)} venceu a série com 2 vitórias seguidas!`, 'win'); }
      }
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
    pl.hand.push(takePlayable(s, s.charDeck, (pl.maxE || 0) + (isPhase ? 1 : 0) + 2)); // só cartas de até ⚡2 acima da sua energia
    fx(s, { t: 'draw', p });
    return true;
  }
  function drawSup(s, p) {
    const pl = s.players[p];
    if (pl.hand.length >= 7) return false;
    if (!s.supDeck.length) refillSup(s);
    if (!s.supDeck.length) { log(s, 'O baralho de Suportes acabou.'); return false; }
    pl.hand.push(takePlayable(s, s.supDeck, Math.max(1, pl.maxE || 0) + 2));
    fx(s, { t: 'draw', p, sup: true });
    return true;
  }
  function refillSup(s) {
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
    if (L.z === 'def' && fieldChars(s.players[p]).some((x) => D(x).fx === 'damaRevenge')) {
      fieldChars(s.players[p]).forEach((x) => { x.dmg = 0; });
      log(s, `🛡️ Juliana Dama: todo o dano dos Personagens de ${pn(s, p)} sumiu.`, 'good');
    }
    if (o.combat && L.z === 'atk') {
      const ar = s.players[p].hand.length < 7 && hasPerm(s, p, 'arena');
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
  function moveTo(s, uid, z, slot) {
    const L = locate(s, uid);
    if (!L || L.z === z || !LIM[L.z]) return false;
    if (!space(s, L.p, z)) return false;
    s.players[L.p][L.z].splice(L.i, 1);
    placeIn(s, L.p, z, L.card, slot != null ? slot : L.card.slot);
    fx(s, { t: 'move', uid, z });
    log(s, `${nm(L.card)} foi para ${ZI[z]} ${ZN[z]}.`);
    return true;
  }
  const other = (z) => (z === 'atk' ? 'def' : 'atk');

  // ---------------------------------------------------------------- custos
  function charCost(s, p, c, red) { const pl = s.players[p]; return Math.max(1, D(c).cost - (red || 0) - (pl.nextRedT === s.turn ? 1 : 0) - (pl.discT === s.turn && pl.discUid === c.uid ? 2 : 0)); }
  function supCost(s, p, c) {
    const pl = s.players[p];
    const red = Math.max(evKey(s) === 'praia' ? 1 : 0, pl.nextSupRedT === s.turn ? 1 : 0, D(c).kind === 'imm' && fieldChars(pl).some((x) => D(x).fx === 'jonesPets') ? 1 : 0); // descontos não se acumulam
    return Math.max(1, D(c).cost - red);
  }
  function actCost(s, p, c) {
    let k = D(c).ecost;
    if (evKey(s) === 'semLuz') k += 1;
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
  // opções da próxima partida: a série continua e quem começa alterna; se a série acabou (ou não existe), começa outra
  G.nextGameOpts = function (prev) {
    if (!prev || !prev.series || prev.series.champ != null || prev.winner == null) return {};
    return { series: prev.series, first: 1 - prev.first };
  };
  G.newGame = function (o) {
    o = o || {};
    const s = {
      v: 1, rng: (o.seed != null ? o.seed : Math.floor(Math.random() * 2 ** 31)) | 0, uidN: 0, logN: 0, fxN: 0,
      turn: 0, active: 0, first: 0, phase: 'setup',
      players: [mkPlayer(o.names ? o.names[0] : 'Jogador 1'), mkPlayer(o.names ? o.names[1] : 'Jogador 2')],
      charDeck: [], supDeck: [], evDeck: [], evDiscard: [], event: null,
      queue: [], pending: null, log: [], fx: [], winner: null,
      defeated: 0, lastPlayed: null, resolving: null,
      series: o.series ? JSON.parse(JSON.stringify(o.series)) : { res: [], w: [0, 0], champ: null },
    };
    const mk = (id) => ({ uid: 'u' + ++s.uidN, id });
    s.charDeck = shuffle(s, G.CHAR_IDS.map(mk));
    s.supDeck = shuffle(s, G.SUP_IDS.map(mk));
    s.evDeck = shuffle(s, G.EV_IDS.map(mk));
    s.first = o.first != null ? o.first : rnd(s) < 0.5 ? 0 : 1;
    s.active = s.first;
    if (G.RULES.secondLife) { const q = s.players[opp(s.first)]; q.life += G.RULES.secondLife; q.maxLife = q.life; }
    log(s, `🎲 ${pn(s, s.first)} começa a partida.`);
    // mão inicial: 4 Personagens e 2 Suportes, todos baratos (custo até ⚡3) e com pelo menos 1 Personagem de ⚡1,
    // para que nenhuma carta inicial fique parada; ninguém escolhe nem devolve cartas
    for (const p of [s.first, opp(s.first)]) {
      const h = s.players[p].hand;
      for (let i = 0; i < 2; i++) h.push(takePlayable(s, s.charDeck, 1)); // pelo menos 2 Personagens de ⚡1
      for (let i = 0; i < 2; i++) h.push(takePlayable(s, s.charDeck, 3)); // os outros: custo até ⚡3
      for (let i = 0; i < 2; i++) h.push(takePlayable(s, s.supDeck, 3));
    }
    if (G.RULES.secondBonus === 'sentinela') {
      // compensação do 2º jogador: começa com 1 Personagem de custo ⚡1 já na Defesa
      const si = s.charDeck.findIndex((c) => G.CARDS[c.id].cost <= 1);
      if (si >= 0) {
        const sc = s.charDeck.splice(si, 1)[0];
        sc.enteredT = 0;
        s.players[opp(s.first)].def.push(sc);
        log(s, `${pn(s, opp(s.first))} começa com ${G.CARDS[sc.id].name} já na Defesa (compensação por jogar em 2º).`, 'good');
      }
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
    s.evTurns = 0;
    fx(s, { t: 'event', id: e.id });
    log(s, `🌟 Novo Evento: ${C[e.id].name}.`, 'event');
    const f = C[e.id].fx;
    const order = [s.active, opp(s.active)];
    if (f === 'flamengo') order.forEach((p) => { if (s.players[p].hand.some((c) => D(c).flamengo) && drawChar(s, p)) log(s, `${pn(s, p)} tem um rubro-negro na mão e comprou 1 Personagem.`, 'good'); });
    if (f === 'churrasco') order.forEach((p) => drawChar(s, p));
    if (f === 'billSolto') order.forEach((p) => {
      const pl = s.players[p];
      if (pl.def.length >= 2 && pl.hand.length < 7) {
        const low = pl.def.slice().sort((a, b) => D(a).def - D(b).def)[0];
        removeFromField(s, low.uid);
        pl.hand.push(clean(low));
        fx(s, { t: 'bounce', uid: low.uid });
        log(s, `🐶 Bill Solto! ${nm(low)} voltou para a mão de ${pn(s, p)}.`);
      }
    });
    if (f === 'bronca') push(s, ...order.map((p) => ({ k: 'bronca', p })));
    if (f === 'granizo') {
      order.forEach((p) => s.players[p].atk.slice().forEach((c) => {
        c.dmg = (c.dmg || 0) + 2;
        fx(s, { t: 'hit', uid: c.uid, n: 2 });
        log(s, `🌩️ Granizo na Laje: ${nm(c)} sofreu 2 de dano.`, 'warn');
        if (c.dmg >= D(c).def) defeat(s, c.uid, {});
      }));
    }
    if (f === 'filaChurrasco') {
      const n0 = fieldChars(s.players[0]).length, n1 = fieldChars(s.players[1]).length;
      if (n0 === n1) log(s, '🍖 Fila do Churrasco: empate, ninguém compra.');
      else { const p = n0 < n1 ? 0 : 1; if (drawChar(s, p)) log(s, `🍖 Fila do Churrasco: ${pn(s, p)} tem menos Personagens em campo e comprou 1 Personagem.`, 'good'); }
    }
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
      c.protStun = false;
      c.protMove = false;
      if (c.stunned && c.stunT < s.turn && D(c).fx === 'earlyRecover') unstun(s, c);
    });
    if (G.RULES.catchupHeal && pl.life < s.players[opp(p)].life) heal(s, p, G.RULES.catchupHeal);
    if (G.RULES.fatigueTurn && s.turn >= G.RULES.fatigueTurn) {
      log(s, `⏳ Cansaço: a partida se arrasta (turno ${s.turn}).`, 'warn');
      loseLife(s, p, G.RULES.fatigueDmg, 'Cansaço');
      if (s.winner != null) return;
    }
    if (s.turn === 1) log(s, `${pn(s, p)} é o primeiro jogador e não compra no primeiro turno.`);
    else drawChar(s, p, true);
    if (hasPerm(s, p, 'bill') && s.turn > 1) { if (drawChar(s, p, true)) log(s, '🐕 Bill, o Fiscal do Portão: compra extra.', 'good'); }
    if (hasPerm(s, p, 'cristal')) {
      fieldChars(pl).forEach((c) => { if (c.dmg > 0) { c.dmg = Math.max(0, c.dmg - 2); log(s, `🔮 Cristal do Gato de Luz: ${nm(c)} curou 2 de dano.`, 'good'); } });
    }
    pl.turns = (pl.turns || 0) + 1;
    ['atk', 'def', 'apoio'].forEach((z) => pl[z].forEach((c) => { // curas de posição
      const f = D(c).fx;
      if (f === 'cureRight1' || f === 'cureRight2') {
        const t = cardAt(s, p, z, c.slot + 1);
        if (t && t.dmg > 0) { const n = f === 'cureRight1' ? 1 : 2; t.dmg = Math.max(0, t.dmg - n); log(s, `💚 ${nm(c)} curou ${n} de dano de ${nm(t)}.`, 'good'); }
      }
      if (f === 'apoioCureDef2' && z === 'apoio') pl.def.forEach((t) => { if (t.dmg > 0) { t.dmg = Math.max(0, t.dmg - 2); log(s, `💚 ${nm(c)} curou 2 de dano de ${nm(t)}.`, 'good'); } });
    }));
    fieldChars(pl).forEach((c) => { // regeneração de algumas cartas
      if (D(c).fx === 'regen3' && c.dmg > 0) { c.dmg = Math.max(0, c.dmg - 3); log(s, `${nm(c)} curou 3 de dano.`, 'good'); }
      if (D(c).fx === 'regenAll' && c.dmg > 0) { c.dmg = 0; log(s, `${nm(c)} curou todo o dano.`, 'good'); }
    });
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
    pl.maxE = Math.min(G.ENERGY_MAX, (pl.maxE || 0) + 1 + (pl.turns === 1 && p !== s.first ? (G.RULES.secondEnergy || 0) : 0));
    pl.energy = pl.maxE + (p !== s.first && pl.turns <= (G.RULES.secondEnergyTurns || 0) ? 1 : 0);
    if (p !== s.first && pl.turns === 1 && G.RULES.secondEnergyTurns) log(s, `⚡ ${pn(s, p)} joga em 2º: tem ⚡+1 de energia nos ${G.RULES.secondEnergyTurns} primeiros turnos.`, 'good');
    fx(s, { t: 'energy', p, n: pl.energy });
    if (pl.pendingCoin) { gainE(s, p, pl.pendingCoin); log(s, `${pn(s, p)} jogou em 2º e ganhou ⚡+${pl.pendingCoin} neste turno.`, 'good'); pl.pendingCoin = 0; }
    if (pl.turns === 1 && p !== s.first && G.RULES.secondBonus === 'coin') { gainE(s, p, 1); log(s, `${pn(s, p)} jogou em 2º e ganhou uma moeda: ⚡+1 neste turno.`, 'good'); }
    {
      const e = evKey(s);
      if (e === 'caiuPix') { gainE(s, p, 1); log(s, 'Caiu o PIX: ⚡+1 extra neste turno.', 'good'); }
      if (e === 'naoCaiuPix') { pl.energy = Math.max(1, pl.energy - 1); log(s, 'O PIX Não Caiu: ⚡-1 neste turno.', 'warn'); }
      if (e === 'noite') fieldChars(pl).forEach((c) => { if (c.dmg > 0) { c.dmg = Math.max(0, c.dmg - 2); log(s, `🌙 Noite Tranquila: ${nm(c)} curou 2 de dano.`, 'good'); } });
    }
    if (G.RULES.supDrawEvery && pl.turns > 1 && pl.turns % G.RULES.supDrawEvery === 0) {
      if (drawSup(s, p)) log(s, `${pn(s, p)} comprou 1 Suporte (compra automática).`, 'good');
    }
  };
  // quem joga no turno t. 'snake': A B B A A B B A… | 'tm': A B B A B A A B… (Thue-Morse) | 'normal': A B A B…
  function turnOwner(s, t) {
    const a = s.first;
    if (/^[AB]+$/.test(G.RULES.turnOrder)) return G.RULES.turnOrder[(t - 1) % G.RULES.turnOrder.length] === 'A' ? a : opp(a); // padrão repetido, ex.: 'ABBA'
    if (G.RULES.turnOrder === 'tm') { let n = t - 1, c = 0; while (n) { c += n & 1; n >>= 1; } return c % 2 === 0 ? a : opp(a); }
    return Math.floor(t / 2) % 2 === 0 ? a : opp(a);
  }
  STEP.endTurn = (s, st) => {
    const p = s.active, pl = s.players[p];
    // perks: efeitos de fim de turno e contagem de duração
    if (hasPerm(s, p, 'soneca') && !fieldChars(pl).some((c) => c.attackedT === s.turn)) { log(s, '😴 Soneca Estratégica: você não atacou e recuperou vida.', 'good'); heal(s, p, 2); }
    pl.perms.slice().forEach((c) => {
      if (!c.left) return;
      if (!c.extra && fieldChars(pl).some((x) => D(x).fx === 'perksLast')) { c.extra = true; return; } // Leco, o Pedreiro: +1 turno
      c.left--;
      if (c.left <= 0) { discardPerm(s, p, c); log(s, `⏳ ${D(c).name} chegou ao fim da duração e foi descartado.`, 'warn'); }
    });
    fieldChars(pl).forEach((c) => {
      if (c.stunned && c.stunT < s.turn && D(c).fx !== 'earlyRecover') unstun(s, c);
    });
    s.phase = 'end';
    const steps = [];
    if (G.RULES.autoEvent) {
      if (G.RULES.turnOrder === 'normal') {
        if (p !== s.first) { s.evRound = (s.evRound || 0) + 1; if (s.evRound >= G.RULES.autoEvent) steps.push({ k: 'revealEvent' }); }
      } else {
        s.evTurns = (s.evTurns || 0) + 1; // com a ordem alternada, o Evento troca a cada 2×N turnos
        if (s.evTurns >= G.RULES.autoEvent * 2) steps.push({ k: 'revealEvent' });
      }
    }
    s.turn++;
    s.active = G.RULES.turnOrder === 'normal' ? opp(p) : turnOwner(s, s.turn);
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
    if (pl.nextRedT === s.turn) pl.nextRedT = 0;
    const inst = { uid: c.uid, id: c.id, enteredT: s.turn };
    placeIn(s, p, zone, inst, o.slot);
    if (evKey(s) === 'sono' && D(c).fx !== 'ligeiro') { stun(s, inst, p); }
    if (o.lig) inst.ligT = s.turn;
    s.lastPlayed = { uid: c.uid, id: c.id, p };
    fx(s, { t: 'play', uid: c.uid, p, zone });
    log(s, `${pn(s, p)} jogou ${nm(c)} em ${ZI[zone]} ${ZN[zone]} (⚡${cost}).`);
    if (D(c).fx === 'zeroEnergy' && pl.energy === 0) { gainE(s, p, 1); log(s, `${D(c).name} ficou com ⚡0 e ganhou ⚡1.`, 'good'); }
    const steps = [];
    if (AE.has(D(c).fx)) steps.push({ k: 'aeCheck', p, uid: c.uid });
    if (pl.verT !== s.turn && pl.apoio.some((x) => x.uid !== c.uid && D(x).fx === 'vereador')) steps.push({ k: 'vereador', p });
    push(s, ...steps);
  }
  STEP.aeCheck = (s, st, v) => {
    const o = opp(st.p);
    const L = locate(s, st.uid);
    if (hasPerm(s, o, 'naovaleu') && L) {
      log(s, `🚫 Manual do "Não Valeu!": o efeito Ao Entrar de ${nm(L.card)} não funciona.`, 'warn');
      return;
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
      if (!changed && !pd) { // nada aconteceria (condição não cumprida ou bloqueado por um Evento)
        log(s, evKey(s) === 'discussao' && /recupere/.test(C[st.id].text) ? `${C[st.id].name}: o Evento Discussão Generalizada impede recuperar vida.` : `${C[st.id].name}: o efeito não teve resultado agora (condição não cumprida).`, 'warn');
        return;
      }
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
    log(s, '🗳️ Rogerinho, o Vereador: você recupera vida.', 'good');
    heal(s, st.p, 1);
  };
  // ---------------------------------------------------------------- efeitos Ao Entrar
  function ownOthers(s, p, uid, zones) {
    const pl = s.players[p];
    return zones.flatMap((z) => pl[z]).filter((c) => c.uid !== uid);
  }
  function cureAll(s, p, src) {
    const hurt = fieldChars(s.players[p]).filter((c) => c.dmg > 0);
    if (hurt.length) { hurt.forEach((c) => { c.dmg = 0; }); log(s, `${src}: todo o dano dos Personagens de ${pn(s, p)} sumiu.`, 'good'); }
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
      case 'cureIfBehind': if (pl.life < op.life) cureAll(s, p, src); return;
      case 'cureAllHeal1': cureAll(s, p, src); heal(s, p, 1); return;
      case 'cure5Each': {
        let any = false;
        fieldChars(pl).forEach((c) => { if (c.dmg > 0) { c.dmg = Math.max(0, c.dmg - 5); any = true; } });
        if (any) log(s, `${src}: cada Personagem de ${pn(s, p)} curou 5 de dano.`, 'good');
        return;
      }
      case 'cureHaste': {
        const opts = fieldChars(pl).filter((c) => c.uid !== st.uid);
        const c = pickOne(s, st, v, { player: p, options: opts, optional: true, title: T('curar e liberar ataque'), text: 'Escolha 1 Personagem seu: ele cura todo o dano e pode atacar neste turno.', purpose: 'cureHaste' });
        if (c) { c.dmg = 0; c.canAtkT = s.turn; c.movedT = 0; fx(s, { t: 'shield', uid: c.uid }); log(s, `${nm(c)} foi curado e pode atacar neste turno!`, 'good'); }
        return;
      }
      case 'cureProtect': {
        const opts = ownOthers(s, p, st.uid, ['atk', 'def', 'apoio']);
        const c = pickOne(s, st, v, { player: p, options: opts, title: T('curar aliado'), text: 'Escolha outro Personagem seu: ele cura todo o dano e não pode ser movido por efeitos adversários até o início do seu próximo turno.', purpose: 'cureProtect' });
        if (c) { c.dmg = 0; c.protMove = true; fx(s, { t: 'shield', uid: c.uid }); log(s, `${nm(c)} foi curado e está protegido até o próximo turno de ${pn(s, p)}.`, 'good'); }
        return;
      }
      case 'healBoard': {
        const hurt = fieldChars(pl).filter((c) => c.dmg > 0);
        if (hurt.length) { hurt.forEach((c) => { c.dmg = 0; }); log(s, `${src}: todo o dano dos Personagens de ${pn(s, p)} sumiu.`, 'good'); }
        return;
      }
      case 'drawIfFew': if (pl.hand.length < 5 && drawChar(s, p)) log(s, `${src}: ${pn(s, p)} comprou 1 Personagem.`, 'good'); return;
      case 'heal2': heal(s, p, 2); return;
      case 'nextCharRed': pl.nextRedT = s.turn; log(s, `${src}: o próximo Personagem de ${pn(s, p)} neste turno custa ⚡1 a menos.`, 'good'); return;
      case 'nextSupRed': pl.nextSupRedT = s.turn; log(s, `${src}: o próximo Suporte de ${pn(s, p)} neste turno custa ⚡1 a menos.`, 'good'); return;
      case 'heal1': heal(s, p, 1); return;
      case 'cure3Def': {
        if (zone !== 'def') return;
        const hurt = fieldChars(pl).filter((c) => c.dmg > 0);
        const c = pickOne(s, st, v, { player: p, options: hurt, title: T('curar Personagem'), text: 'Escolha 1 Personagem seu para curar 3 de dano.', purpose: 'cureOne', auto: true });
        if (c) { c.dmg = Math.max(0, c.dmg - 3); fx(s, { t: 'shield', uid: c.uid }); log(s, `${nm(c)} curou 3 de dano.`, 'good'); }
        return;
      }
      case 'heal1cure3': {
        if (!st.h) { st.h = true; heal(s, p, 1); }
        const hurt = fieldChars(pl).filter((c) => c.dmg > 0);
        const c = pickOne(s, st, v, { player: p, options: hurt, title: T('curar Personagem'), text: 'Escolha 1 Personagem seu para curar 3 de dano.', purpose: 'cureOne', auto: true });
        if (c) { c.dmg = Math.max(0, c.dmg - 3); fx(s, { t: 'shield', uid: c.uid }); log(s, `${nm(c)} curou 3 de dano.`, 'good'); }
        return;
      }
      case 'ping2': case 'ping3': case 'ping4': {
        const n = +d.fx.slice(4);
        const opts = pingTargets(s, p);
        const c = pickOne(s, st, v, { player: p, options: opts, title: T(`${n} de dano`), text: `Escolha 1 Personagem inimigo: ele sofre ${n} de dano.`, purpose: 'pingTarget', dmg: n });
        if (c) hurtChar(s, c, n, src);
        return;
      }
      case 'pingAtk2': { op.atk.slice().forEach((c) => hurtChar(s, c, 2, src)); return; }
      case 'giveLig2': {
        const opts = fieldChars(pl).filter((c) => c.uid !== st.uid && !c.stunned);
        if (v === undefined) {
          if (!opts.length) return;
          return ask(s, st, { player: p, kind: 'pick', title: T('dar Ligeiro'), text: 'Escolha até 2 outros Personagens seus: eles ganham Ligeiro neste turno.', options: opts.map((c) => ({ v: c.uid, id: c.id })), min: 0, max: 2, purpose: 'ligPick' });
        }
        (v || []).forEach((u) => { const Lx = locate(s, u); if (Lx) Lx.card.ligT = s.turn; });
        return;
      }
      case 'drawSup1': if (drawSup(s, p)) log(s, `${src}: ${pn(s, p)} comprou 1 Suporte.`, 'good'); return;
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
      case 'healIfLow': if (pl.life <= 2 * G.RULES.heartPts) heal(s, p, 2); return;
      case 'adeniSanta': heal(s, p, pl.life <= G.RULES.heartPts ? 3 : 2); return;
      case 'energyIfLessLife': if (pl.life < op.life) { gainE(s, p, 1); log(s, `${src}: ganhou ⚡1.`, 'good'); } return;
      case 'helsoCoco': heal(s, p, 1); fieldChars(pl).forEach((c) => { c.dmg = 0; }); log(s, `${src}: o dano dos Personagens de ${pn(s, p)} sumiu.`, 'good'); return;
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
      case 'brunor': if (pl.life < op.life) heal(s, p, 3); return;
      case 'jonesRei': { let n = 0; if (drawSup(s, p)) n++; if (drawSup(s, p)) n++; log(s, `${src}: ${pn(s, p)} comprou ${n} Suporte(s).`, 'good'); return; }
      case 'fredOraculo': { let n = 0; if (drawChar(s, p)) n++; if (drawChar(s, p)) n++; log(s, `${src}: ${pn(s, p)} comprou ${n} Personagem(ns).`, 'good'); return; }
      case 'donJones': {
        if (pl.hand.length >= 7) { log(s, `${src}: mão cheia, nenhum Personagem voltou.`, 'warn'); return; }
        const opts = ownOthers(s, p, st.uid, ['atk', 'def', 'apoio']).filter((c) => c.dmg > 0);
        const c = pickOne(s, st, v, { player: p, options: opts, optional: true, title: T('resgatar ferido'), text: 'Você pode devolver à mão 1 Personagem seu com dano (o dano some).', purpose: 'rescue' });
        if (c) { removeFromField(s, c.uid); pl.hand.push(clean(c)); fx(s, { t: 'bounce', uid: c.uid }); log(s, `${nm(c)} voltou para a mão.`); }
        return;
      }
      case 'lecoDeus': {
        const opts = pl.discard.filter((c) => D(c).type === 'sup' && D(c).kind !== 'imm' && D(c).cost <= 3 && D(c).fx !== 'gambiarra');
        const c = pickOne(s, st, v, { player: p, options: opts, title: T('recuperar Suporte'), text: 'Escolha 1 Suporte Permanente de custo ⚡3 ou menos do seu descarte' + (st.n ? ' (o segundo).' : ' (você pode recuperar até 2).'), purpose: 'recoverSup' });
        if (c) {
          pl.discard.splice(pl.discard.indexOf(c), 1); pl.hand.push(c);
          log(s, `${pn(s, p)} recuperou ${nm(c)} do descarte.`, 'good');
          if (!st.n && pl.hand.length < 7) push(s, { k: 'ae', p, uid: st.uid, id: st.id, n: 1 });
        }
        return;
      }
      case 'gabrielSerio': {
        const opts = fieldChars(pl).filter((c) => c.dmg > 0);
        if (!opts.length) { log(s, `${src}: nenhum Personagem de ${pn(s, p)} tem dano para curar.`, 'warn'); return; }
        const c = pickOne(s, st, v, { player: p, options: opts, title: T('curar Personagem'), text: 'Escolha um Personagem seu para curar todo o dano.', purpose: 'cureOne', auto: true });
        if (c) { c.dmg = 0; fx(s, { t: 'shield', uid: c.uid }); log(s, `${nm(c)} foi curado.`, 'good'); }
        return;
      }
      case 'lookHand': {
        const sups = op.hand.filter((c) => D(c).type === 'sup');
        if (!sups.length) { log(s, `👀 ${pn(s, p)} olhou a mão de ${pn(s, o)}: sem Suportes.`); return; }
        const c = pickOne(s, st, v, { player: p, options: sups, title: T('descartar Suporte do adversário'), text: `Veja a mão de ${pn(s, o)} e escolha 1 Suporte dela: ela o descarta.`, purpose: 'xerifeDiscard' });
        if (c) { op.hand.splice(op.hand.indexOf(c), 1); op.discard.push(clean(c)); log(s, `👀 ${pn(s, p)} viu a mão de ${pn(s, o)} e fez descartar ${nm(c)}.`, 'warn'); }
        return;
      }
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
    const c = pickOne(s, st, v, { player: st.p, options: opts, title: 'Luar, Deusa da Lua — bênção lunar', text: 'Escolha 1 que foi para 🛡️: ele cura todo o dano.', purpose: 'protect', auto: true });
    if (c) { c.dmg = 0; fx(s, { t: 'shield', uid: c.uid }); log(s, `🌙 ${nm(c)} foi curado pela bênção lunar.`, 'good'); }
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
    if (pl.nextSupRedT === s.turn) pl.nextSupRedT = 0;
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
    if (drawChar(s, st.p)) log(s, `Kevin, Mestre da Engenharia Mística: ${pn(s, st.p)} comprou 1 Personagem.`, 'good');
  };
  STEP.permIn = (s, st, v) => {
    const pl = s.players[st.p];
    if (pl.perms.length >= 2) {
      const c = pickOne(s, st, v, { player: st.p, options: pl.perms.slice(), title: 'Vagas de Suporte cheias', text: `Descarte 1 Suporte Permanente para abrir espaço para ${nm(st.card)}.`, purpose: 'replacePerm' });
      if (c === undefined) return;
      if (c) discardPerm(s, st.p, c);
    }
    if (D(st.card).dur) st.card.left = D(st.card).dur; // perk: dura N turnos do dono
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
      case 'fifinha': { let n = 0; if (drawChar(s, p)) n++; if (drawChar(s, p)) n++; log(s, `${pn(s, p)} comprou ${n} Personagem(ns).`, 'good'); return; }
      case 'cafezinho': gainE(s, p, 2); return;
      case 'agua': {
        const opts = s.charDeck.filter((c) => D(c).cost <= 3);
        if (!opts.length) { log(s, '💧 Água Gelada: nenhum Personagem de custo ⚡3 ou menos no baralho.', 'warn'); return; }
        const c = pickOne(s, st, v, { player: p, options: opts, title: 'Água Gelada — procurar no baralho', text: 'Escolha 1 Personagem de custo ⚡3 ou menos do baralho para a sua mão.', purpose: 'tutor' });
        if (c) {
          if (pl.hand.length < 7) { s.charDeck.splice(s.charDeck.indexOf(c), 1); pl.hand.push(c); fx(s, { t: 'draw', p }); log(s, `${pn(s, p)} procurou no baralho e pegou ${nm(c)}.`, 'good'); }
          else log(s, 'Mão cheia: nada foi para a mão.', 'warn');
          shuffle(s, s.charDeck);
        }
        return;
      }
      case 'pf': {
        if (!st.h) { st.h = true; heal(s, p, 1); }
        const hurt = fieldChars(pl).filter((c) => c.dmg > 0);
        const c = pickOne(s, st, v, { player: p, options: hurt, title: 'PF Reforçado — curar Personagem', text: 'Escolha 1 Personagem seu para curar todo o dano.', purpose: 'cureOne', auto: true });
        if (c) { c.dmg = 0; fx(s, { t: 'shield', uid: c.uid }); log(s, `${nm(c)} foi curado.`, 'good'); }
        return;
      }
      case 'bola': {
        const opts = pl.atk.filter((c) => !c.stunned && c.attackedT !== s.turn);
        if (!opts.length) { log(s, '⚽ Bola: nenhum Personagem em ⚔️ pode atacar agora.', 'warn'); return; }
        const c = pickOne(s, st, v, { player: p, options: opts, title: 'Bola: Quem Perder Paga a Coca', text: 'Escolha 1 Personagem em ⚔️: Ligeiro e +3 de ataque neste turno; se derrotar um Personagem, você compra 1.', purpose: 'bolaTarget' });
        if (c) { c.ligT = s.turn; c.bonusT = s.turn; c.drawKillT = s.turn; fx(s, { t: 'shield', uid: c.uid }); log(s, `⚽ ${nm(c)} ganhou Ligeiro e +3 de ataque neste turno!`, 'good'); }
        return;
      }
      case 'porta': {
        if (pl.hand.length >= 7) { log(s, '🚪 Porta dos Fundos: mão cheia, ninguém voltou.', 'warn'); return; }
        const opts = fieldChars(pl).filter(bounceable);
        const c = pickOne(s, st, v, { player: p, options: opts, title: 'Porta dos Fundos Dimensional', text: 'Escolha 1 Personagem seu para voltar à mão, curado. Neste turno ele custa ⚡2 a menos.', purpose: 'porta' });
        if (c) {
          removeFromField(s, c.uid);
          pl.hand.push(clean(c));
          pl.discUid = c.uid; pl.discT = s.turn;
          fx(s, { t: 'bounce', uid: c.uid });
          log(s, `🚪 ${nm(c)} saiu pela Porta dos Fundos: voltou curado para a mão e custa ⚡2 a menos neste turno.`, 'good');
        }
        return;
      }
      case 'caixa': {
        const opts = pl.discard.filter((c) => D(c).type === 'sup' && D(c).kind !== 'imm' && D(c).cost <= 3);
        const c = pickOne(s, st, v, { player: p, options: opts, title: 'Caixa de Ferramentas — recuperar Suporte', text: 'Escolha 1 Suporte Permanente de custo ⚡3 ou menos do descarte.', purpose: 'recoverSup' });
        if (c) { pl.discard.splice(pl.discard.indexOf(c), 1); pl.hand.push(c); log(s, `${pn(s, p)} recuperou ${nm(c)}.`, 'good'); }
        return;
      }
      case 'grupo': {
        if (!op.hand.length) { log(s, `👀 ${pn(s, p)} olhou a mão de ${pn(s, o)}: está vazia.`); return; }
        const c = pickOne(s, st, v, { player: p, options: op.hand.slice(), title: 'Grupo da Família Sem Privacidade', text: `Veja a mão de ${pn(s, o)} e escolha 1 carta: ela será descartada.`, purpose: 'grupoDiscard' });
        if (c) { op.hand.splice(op.hand.indexOf(c), 1); op.discard.push(clean(c)); log(s, `👀 ${pn(s, p)} viu a mão de ${pn(s, o)} e fez descartar ${nm(c)}.`, 'warn'); }
        return;
      }
      case 'van': {
        const opts = fieldChars(pl).filter((c) => !c.stunned);
        if (v === undefined) {
          if (!opts.length) return;
          return ask(s, st, { player: p, kind: 'pick', title: 'Van do Bruno — Cabe Mais Um!', text: 'Escolha até 2 Personagens seus para mudar de área.', options: opts.map((c) => ({ v: c.uid, id: c.id })), min: 0, max: 2, purpose: 'van' });
        }
        push(s, ...(v || []).flatMap((u) => [{ k: 'zoneMove', p, uid: u }, { k: 'setLig', uid: u }]));
        return;
      }
      case 'espelho': {
        const opts = fieldChars(pl).filter((c) => AE.has(D(c).fx) && D(c).cost <= 5);
        if (!opts.length) { log(s, 'Espelho: nenhum Personagem seu em campo (custo ⚡5 ou menos) tem efeito Ao Entrar para copiar.', 'warn'); return; }
        const c = pickOne(s, st, v, { player: p, options: opts, title: 'Espelho do "Faz Igual!"', text: 'Escolha 1 Personagem seu: o efeito Ao Entrar dele será copiado.', purpose: 'espelho' });
        if (c) { log(s, `🪞 Espelho copiou o efeito de ${nm(c)}!`, 'good'); push(s, { k: 'ae', p, uid: c.uid, id: c.id }); }
        return;
      }
      case 'garrafada': {
        heal(s, p, 3);
        fieldChars(pl).forEach((c) => { c.dmg = 0; });
        log(s, `${pn(s, p)} bebeu a garrafada: todo o dano dos seus Personagens sumiu.`, 'good');
        return;
      }
      case 'poltrona': {
        if (v === undefined) {
          return ask(s, st, { player: p, kind: 'option', title: C[st.id].name, text: 'Escolha 1:', purpose: 'poltrona',
            options: [{ v: 'h', label: 'Curar todo o dano dos Personagens e recuperar ❤️2' }, { v: 'd', label: 'Comprar até 2 Personagens' }] });
        }
        if (v === 'h') { cureAll(s, p, 'Poltrona'); heal(s, p, 2); }
        else { let n = 0; if (drawChar(s, p)) n++; if (drawChar(s, p)) n++; log(s, `${pn(s, p)} comprou ${n} Personagem(ns).`); }
        return;
      }
      case 'churrasco': { let n = 0; for (let i = 0; i < 3; i++) if (drawChar(s, p)) n++; log(s, `${pn(s, p)} comprou ${n} Personagem(ns).`, 'good'); return; }
      case 'g220': {
        const opts = pl.hand.filter((c) => D(c).type === 'char' && canPlayCharAnywhere(s, p, c, 2));
        const c = pickOne(s, st, v, { player: p, options: opts, title: 'Gambiarra 220V no 110V', text: 'Escolha 1 Personagem da mão para jogar agora pagando ⚡2 a menos; ele ganha Ligeiro neste turno.', purpose: 'g220' });
        if (c) push(s, { k: 'zonePlay', p, uid: c.uid, red: 2, lig: true });
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
  STEP.setLig = (s, st) => { const L = locate(s, st.uid); if (L && LIM[L.z]) L.card.ligT = s.turn; };
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
    if (LIM[v]) playChar(s, st.p, c.uid, v, { red: st.red, lig: st.lig });
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
      case 'actCure': return fieldChars(pl).filter((x) => x.uid !== c.uid && x.dmg > 0);
      case 'actCureDef': return pl.def.filter((x) => x.uid !== c.uid && x.dmg > 0);
      case 'actUnstun': return fieldChars(pl).filter((x) => x.uid !== c.uid && x.stunned);
      case 'actUnstunDef': return pl.def.filter((x) => x.uid !== c.uid && x.stunned);
      case 'actDraw': return deckN(s, 'char') && s.players[p].hand.length < 7 ? [true] : [];
      default: return [];
    }
  }
  STEP.act = (s, st, v) => {
    const L = locate(s, st.uid);
    if (!L) return;
    const f = D(L.card).fx;
    if (f === 'actDraw') { if (drawChar(s, st.p)) log(s, `${pn(s, st.p)} comprou 1 Personagem.`, 'good'); return; }
    const opts = actTargets(s, st.p, L.card);
    if (f === 'actCure' || f === 'actCureDef') {
      const t = pickOne(s, st, v, { player: st.p, options: opts, title: `${D(L.card).name} — curar aliado`, text: 'Escolha o aliado que vai curar todo o dano.', purpose: 'cureOne', auto: true });
      if (t) { t.dmg = 0; fx(s, { t: 'shield', uid: t.uid }); log(s, `${nm(t)} foi curado.`, 'good'); }
      return;
    }
    const c = pickOne(s, st, v, { player: st.p, options: opts, title: `${D(L.card).name} — retirar Atordoamento`, text: 'Escolha o aliado que vai se recuperar.', purpose: 'unstun', auto: true });
    if (c) unstun(s, c);
  };
  // ---------------------------------------------------------------- Passar
  STEP.afterPass = (s, st) => {
    const p = st.p, pl = s.players[p];
    if (st.what !== 'jardim' || !hasPerm(s, p, 'jardim')) return;
    pl.apoio.concat(pl.def).forEach((c) => {
      if (c.dmg > 0) { c.dmg = Math.max(0, c.dmg - 3); log(s, `🌷 Jardim Milagroso: ${nm(c)} curou 3 de dano.`, 'good'); }
    });
  };

  // ---------------------------------------------------------------- Combate
  function canAttack(s, p, c) {
    const pl = s.players[p];
    if (s.turn < G.RULES.noAttackUntil) return false;
    return pl.atk.includes(c) && !c.stunned && c.attackedT !== s.turn && c.movedT !== s.turn && (c.enteredT !== s.turn || c.canAtkT === s.turn || D(c).fx === 'ligeiro' || c.ligT === s.turn || evKey(s) === 'alvoroco');
  }
  function attackTargets(s, p) {
    const o = s.players[opp(p)];
    const t = o.def.map((c) => c.uid).concat(o.atk.map((c) => c.uid));
    if (!o.def.length) o.apoio.forEach((c) => t.push(c.uid)); // sem Defensores, o Apoio também pode ser atacado
    if (!o.def.length && evKey(s) !== 'almoco') t.push('life');
    return t;
  }
  // Ligeiro (da carta, de efeito ou do Evento Alvoroço): no turno em que entra só ataca Personagens; depois ataca o herói normalmente
  function heroBlocked(s, c) {
    return c.enteredT === s.turn && c.canAtkT !== s.turn && (D(c).fx === 'ligeiro' || c.ligT === s.turn || evKey(s) === 'alvoroco');
  }
  function heroDmg(s, p, A) {
    return effAtk(s, p, A) + (hasPerm(s, p, 'boleto') ? 2 : 0);
  }
  STEP.peAsk = (s, st, v) => {
    const A = locate(s, st.uid), o = opp(st.p), pe = hasPerm(s, o, 'pe');
    if (!A) return;
    const dmg = heroDmg(s, st.p, A.card);
    if (!pe) { resolveAttack(s, st.p, A.card, 'life'); return; }
    if (v === undefined) return ask(s, st, { player: o, kind: 'confirm', title: 'Pé de Benção da Vó', text: `${nm(A.card)} vai atacar o seu herói (${dmg} de dano). Descartar o Pé de Benção para cancelar o ataque?`, options: [{ v: 0, id: pe.id }], purpose: 'peCancel', dmg });
    if (v) {
      discardPerm(s, o, pe);
      A.card.attackedT = s.turn;
      fx(s, { t: 'shield', uid: A.card.uid });
      log(s, `🙏 Pé de Benção da Vó cancelou o ataque de ${nm(A.card)}!`, 'good');
    } else resolveAttack(s, st.p, A.card, 'life');
  };
  G.heroBlocked = heroBlocked;
  G.canAttack = canAttack;
  G.attackTargets = attackTargets;
  // ataque efetivo: base + perks/eventos/auras (vizinho, frente, líder)
  function auraAtk(s, p, c) {
    const pl = s.players[p];
    let n = 0;
    if (pl.atk.includes(c)) {
      pl.atk.forEach((x) => { if (x !== c && D(x).fx === 'auraAtk') n++; });
      const l = cardAt(s, p, 'atk', c.slot - 1);
      if (l && D(l).fx === 'auraRightAtk') n++;
      const f = cardAt(s, p, 'def', c.slot);
      if (f && (D(f).fx === 'auraFrontAtk' || D(f).fx === 'guardiaFront')) n++;
    }
    return n;
  }
  function effAtk(s, p, c) {
    return D(c).atk + (hasPerm(s, p, 'torcida') ? 1 : 0) + (c.bonusT === s.turn ? 3 : 0) + (evKey(s) === 'jogoDecisivo' && s.players[p].atk.includes(c) ? 1 : 0) + auraAtk(s, p, c);
  }
  // dano a menos que a carta sofre em cada ataque (Resistente, Sofá, auras)
  function incomingRed(s, o, T) {
    const O = s.players[o];
    const f = D(T).fx;
    let r = 0;
    if (O.def.includes(T) && hasPerm(s, o, 'sofa')) r += 2;
    if (O.def.includes(T)) r += G.RULES.defResist || 0;
    if (f === 'resist1') r += 1;
    if (f === 'resist2') r += 2;
    const z = O.atk.includes(T) ? 'atk' : O.def.includes(T) ? 'def' : O.apoio.includes(T) ? 'apoio' : null;
    if (z === 'atk') { const b = cardAt(s, o, 'def', T.slot); if (b && (D(b).fx === 'frontResist' || D(b).fx === 'guardiaFront')) r += 1; }
    if (z && z !== 'apoio' && [T.slot - 1, T.slot + 1].some((k) => { const n = cardAt(s, o, z, k); return n && D(n).fx === 'auraNeighborsResist'; })) r += 1;
    if (z === 'def' && O.apoio.some((x) => D(x).fx === 'apoioDefResist')) r += 1;
    return r;
  }
  G.effAtk = effAtk; G.incomingRed = incomingRed;
  // dano de efeito (não é combate)
  function hurtChar(s, T, n, src) {
    T.dmg = (T.dmg || 0) + n;
    fx(s, { t: 'hit', uid: T.uid, n });
    log(s, `💥 ${src}: ${nm(T)} sofreu ${n} de dano.`, 'warn');
    if (T.dmg >= D(T).def) defeat(s, T.uid, {});
  }
  function pingTargets(s, p) {
    const O = s.players[opp(p)];
    return O.def.concat(O.atk, O.def.length ? [] : O.apoio);
  }
  // Combate: o atacante causa o próprio ATK; um Personagem atacado contra-ataca com o ATK dele (ao mesmo tempo).
  // O dano fica na carta até o início do turno do dono dela (a carta cai quando o dano chega à DEF).
  // Ataque ao herói tira vida igual ao ATK do atacante e não sofre contra-ataque.
  function resolveAttack(s, p, A, target) {
    const o = opp(p), O = s.players[o];
    A.attackedT = s.turn;
    if (target === 'life') {
      const dmg = heroDmg(s, p, A);
      fx(s, { t: 'attack', uid: A.uid, target: 'life', p: o, a: dmg });
      log(s, `⚔️ ${nm(A)} atacou ${pn(s, o)} diretamente!`, 'warn');
      loseLife(s, o, dmg, nm(A));
      return;
    }
    const T = O.def.concat(O.atk, O.apoio).find((c) => c.uid === target);
    const challenge = O.atk.includes(T);
    let a = effAtk(s, p, A) + (D(A).fx === 'executor' && T.dmg > 0 ? 2 : 0); // Executor: +2 contra quem já tem dano
    a = Math.max(1, a - incomingRed(s, o, T)); // Resistente / Sofá / auras
    const t = D(T).atk + auraAtk(s, o, T) + (D(T).fx === 'quebraManta' && challenge ? 2 : 0) + (O.def.includes(T) ? G.RULES.defCounter : 0) + (evKey(s) === 'jogoDecisivo' && O.atk.includes(T) ? 1 : 0); // contra-ataque
    fx(s, { t: 'attack', uid: A.uid, target: T.uid, a, d: t });
    log(s, `⚔️ ${nm(A)} (${a} de ataque) ${challenge ? 'desafiou' : 'atacou'} ${nm(T)}, que contra-atacou com ${t}.`);
    const lastDef = !challenge && O.def.length === 1;
    T.dmg = (T.dmg || 0) + a;
    A.dmg = (A.dmg || 0) + t;
    fx(s, { t: 'hit', uid: T.uid, n: a });
    fx(s, { t: 'hit', uid: A.uid, n: t });
    let tDown = T.dmg >= D(T).def + (O.def.includes(T) ? G.RULES.defHp : 0);
    let aDown = A.dmg >= D(A).def;
    const both = tDown && aDown;
    if (both && challenge && D(A).fx === 'paladino') { aDown = false; A.dmg = D(A).def - 1; log(s, 'Paladino Nervoso: no empate do Desafio, só o inimigo cai!'); }
    // Gambiarra do Leco: o Personagem que cairia fica com 1 de vida
    const savers = [[aDown, p, A], [tDown, o, T]];
    savers.forEach(([down, who, card], k) => {
      if (!down) return;
      const gb = hasPerm(s, who, 'gambiarra');
      if (!gb) return;
      discardPerm(s, who, gb);
      card.dmg = D(card).def - 1;
      if (k === 0) aDown = false; else tDown = false;
      log(s, `🔧 Gambiarra do Leco: ${nm(card)} aguentou e ficou com 1 de vida!`, 'good');
    });
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
      if (D(T).fx === 'julianaDama') { log(s, 'Juliana, Dama da Paciência Infinita: a última Defesa cai, mas a vida volta!', 'good'); heal(s, o, 2); }
    }
    if (tDown && D(A).fx === 'drawOnKill' && drawChar(s, p)) log(s, `${nm(A)}: ${pn(s, p)} derrotou um Personagem e comprou 1 Personagem.`, 'good');
    if (tDown && A.drawKillT === s.turn && drawChar(s, p)) log(s, `⚽ Bola: ${pn(s, p)} derrotou um Personagem e comprou 1 Personagem.`, 'good');
    // perks de combate: Fofoca do Churrasco (compra ao perder) e Fiscal da Cerveja (tira vida ao derrotar)
    if (aDown && hasPerm(s, p, 'fofoca') && drawChar(s, p)) log(s, `🗣️ Fofoca do Churrasco: ${pn(s, p)} comprou 1 Personagem.`, 'good');
    if (tDown && hasPerm(s, o, 'fofoca') && drawChar(s, o)) log(s, `🗣️ Fofoca do Churrasco: ${pn(s, o)} comprou 1 Personagem.`, 'good');
    if (tDown && hasPerm(s, p, 'fiscal') && s.winner == null) loseLife(s, o, G.RULES.heartPts, 'Fiscal da Cerveja');
    if (aDown && hasPerm(s, o, 'fiscal') && s.winner == null) loseLife(s, p, G.RULES.heartPts, 'Fiscal da Cerveja');
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
    ensureSlots(s);
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
        if (a.slot != null && !freeSlots(s, p, a.zone).includes(a.slot)) return err('Esse espaço está ocupado.');
        if (pl.noReplay && pl.noReplay.uid === c.uid && pl.noReplay.t === s.turn) return err('Esse Personagem não pode ser jogado de novo neste turno.');
        if (pl.energy < charCost(s, p, c)) return err('Energia insuficiente.');
        playChar(s, p, c.uid, a.zone, { slot: a.slot });
        break;
      }
      case 'playSup': {
        const c = pl.hand.find((x) => x.uid === a.uid);
        if (!c || D(c).type !== 'sup') return err('Carta inválida.');
        if (pl.energy < supCost(s, p, c)) return err('Energia insuficiente.');
        if (D(c).fx === 'cafezinho' && pl.turns <= 1) return err('No primeiro turno ninguém ganha energia extra: o Cafezinho não teria efeito.');
        playSup(s, p, c.uid);
        break;
      }
      case 'buySup': {
        if (pl.hand.length >= 7) return err('Mão cheia (7 cartas).');
        if (pl.buyT === s.turn) return err('Você já comprou um Suporte neste turno.');
        if (pl.energy < G.RULES.buyCost) return err(`Comprar um Suporte custa ⚡${G.RULES.buyCost}.`);
        if (!s.supDeck.length) refillSup(s);
        if (!s.supDeck.length) return err('Não há Suportes para comprar.');
        pl.energy -= G.RULES.buyCost;
        pl.buyT = s.turn;
        log(s, `${pn(s, p)} comprou 1 Suporte (⚡${G.RULES.buyCost}).`);
        drawSup(s, p);
        break;
      }
      case 'cycle': {
        const c = pl.hand.find((x) => x.uid === a.uid);
        if (!c) return err('Carta inválida.');
        if (pl.cycleT === s.turn) return err('Você já descartou e comprou uma carta neste turno.');
        if (pl.energy < G.RULES.cycleCost) return err(`Descartar e comprar custa ⚡${G.RULES.cycleCost}.`);
        const isSup = D(c).type === 'sup';
        if (isSup ? !(s.supDeck.length || (s.players.some((x) => x.discard.some((y) => D(y).type === 'sup')))) : !s.charDeck.length) return err('O baralho está vazio.');
        pl.energy -= G.RULES.cycleCost;
        pl.cycleT = s.turn;
        pl.hand.splice(pl.hand.indexOf(c), 1);
        pl.discard.push(clean(c));
        log(s, `♻️ ${pn(s, p)} descartou ${D(c).name} (⚡${G.RULES.cycleCost}) e comprou outra carta.`);
        if (isSup) drawSup(s, p); else drawChar(s, p);
        break;
      }
      case 'move': {
        const L = locate(s, a.uid);
        if (!L || L.p !== p || !LIM[L.z]) return err('Carta inválida.');
        if (L.card.stunned) return err('Personagem Atordoado não pode se mover.');
        if (L.card.movedT === s.turn) return err('Esse Personagem já foi movido neste turno.');
        if (!LIM[a.zone]) return err('Zona inválida.');
        const fr = freeSlots(s, p, a.zone);
        if (!fr.length) return err('Sem espaço nessa zona.');
        if (a.zone === L.z && (a.slot == null || a.slot === L.card.slot)) return err('Escolha outro espaço.');
        if (a.slot != null && !fr.includes(a.slot)) return err('Esse espaço está ocupado.');
        if (pl.energy < G.RULES.moveCost) return err(`Mover custa ⚡${G.RULES.moveCost}.`);
        pl.energy -= G.RULES.moveCost;
        if (a.zone === L.z) { L.card.slot = a.slot; fx(s, { t: 'move', uid: a.uid, z: a.zone }); log(s, `${nm(L.card)} mudou de lugar em ${ZI[L.z]} ${ZN[L.z]}.`); }
        else moveTo(s, a.uid, a.zone, a.slot);
        L.card.movedT = s.turn;
        break;
      }
      case 'swap': {
        const A = locate(s, a.a), B = locate(s, a.b);
        if (!A || !B || A.p !== p || B.p !== p || !LIM[A.z] || !LIM[B.z] || a.a === a.b) return err('Cartas inválidas.');
        if (A.card.stunned || B.card.stunned) return err('Personagem Atordoado não pode trocar de lugar.');
        if (A.card.movedT === s.turn || B.card.movedT === s.turn) return err('Um deles já foi movido neste turno.');
        if (pl.swapT === s.turn) return err('Você já trocou Personagens de lugar neste turno.');
        if (pl.energy < G.RULES.swapCost) return err(`Trocar de lugar custa ⚡${G.RULES.swapCost}.`);
        pl.energy -= G.RULES.swapCost;
        pl.swapT = s.turn;
        const za = A.z, zb = B.z, sa = A.card.slot, sb = B.card.slot;
        pl[za].splice(pl[za].indexOf(A.card), 1);
        pl[zb].splice(pl[zb].indexOf(B.card), 1);
        A.card.slot = sb; B.card.slot = sa;
        pl[zb].push(A.card); pl[za].push(B.card);
        A.card.movedT = s.turn; B.card.movedT = s.turn;
        fx(s, { t: 'move', uid: A.card.uid, z: zb }); fx(s, { t: 'move', uid: B.card.uid, z: za });
        log(s, `🔁 ${pn(s, p)} trocou ${nm(A.card)} e ${nm(B.card)} de lugar (⚡${G.RULES.swapCost}).`);
        break;
      }
      case 'activate': {
        const L = locate(s, a.uid);
        if (!L || L.p !== p || !LIM[L.z] || !D(L.card).activatable) return err('Carta inválida.');
        if (L.card.stunned) return err('Personagem Atordoado não pode usar habilidades.');
        if (L.card.actT === s.turn) return err('Essa habilidade já foi usada neste turno.');
        const cost = actCost(s, p, L.card);
        if (pl.energy < cost) return err('Energia insuficiente.');
        if (!actTargets(s, p, L.card).length) return err('Não há alvo válido para essa habilidade.');
        pl.energy -= cost;
        L.card.actT = s.turn;
        log(s, `✨ ${pn(s, p)} ativou ${nm(L.card)} (⚡${cost}).`);
        fx(s, { t: 'activate', uid: L.card.uid });
        push(s, { k: 'act', p, uid: L.card.uid });
        break;
      }
      case 'attack': {
        const A = pl.atk.find((x) => x.uid === a.uid);
        if (!A || !canAttack(s, p, A)) return err('Esse Personagem não pode atacar agora.');
        if (!attackTargets(s, p).includes(a.target)) return err('Alvo inválido.');
        if (a.target === 'life' && heroBlocked(s, A)) return err('Ligeiro, no turno em que entra, só pode atacar Personagens.');
        if (a.target === 'life' && hasPerm(s, opp(p), 'pe')) { push(s, { k: 'peAsk', p, uid: A.uid }); break; }
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
  // opts.allSlots: gera uma ação para cada espaço livre e as trocas de lugar (a tela usa); sem isso só gera quando há cartas de posição
  G.needSlots = (s, p) => { const pl = s.players[p]; return fieldChars(pl).some((c) => POS_FX.has(D(c).fx)) || pl.hand.some((c) => D(c).type === 'char' && POS_FX.has(D(c).fx)); };
  G.legal = function (s, p, opts) {
    const out = [];
    if (s.winner == null && !s.pending) ensureSlots(s);
    const all = !!(opts && opts.allSlots) || (s.players[p] && G.needSlots(s, p));
    if (s.winner != null || s.pending || p !== s.active || s.phase !== 'main') return out;
    const pl = s.players[p];
    pl.hand.forEach((c) => {
      const d = D(c);
      if (d.type === 'char') {
        if (pl.noReplay && pl.noReplay.uid === c.uid && pl.noReplay.t === s.turn) return;
        if (pl.energy < charCost(s, p, c)) return;
        ['atk', 'def', 'apoio'].forEach((z) => { if (space(s, p, z)) { if (all) freeSlots(s, p, z).forEach((k) => out.push({ t: 'playChar', uid: c.uid, zone: z, slot: k })); else out.push({ t: 'playChar', uid: c.uid, zone: z }); } });
      } else if (pl.energy >= supCost(s, p, c) && !(D(c).fx === 'cafezinho' && pl.turns <= 1)) out.push({ t: 'playSup', uid: c.uid });
    });
    if (pl.hand.length < 7 && pl.buyT !== s.turn && pl.energy >= G.RULES.buyCost && (deckN(s, 'sup') || (s.players.some((x) => x.discard.some((c) => D(c).type === 'sup'))))) out.push({ t: 'buySup' });
    if (pl.cycleT !== s.turn && pl.energy >= G.RULES.cycleCost) pl.hand.forEach((c) => { if (D(c).type === 'char' ? deckN(s, 'char') : (deckN(s, 'sup') || (s.players.some((x) => x.discard.some((y) => D(y).type === 'sup'))))) out.push({ t: 'cycle', uid: c.uid }); });
    if (pl.energy >= G.RULES.moveCost) {
      ['atk', 'def', 'apoio'].forEach((z) => pl[z].forEach((c) => {
        if (c.stunned || c.movedT === s.turn) return;
        ['atk', 'def', 'apoio'].forEach((z2) => {
          if (all) freeSlots(s, p, z2).forEach((k) => { if (z2 !== z || k !== c.slot) out.push({ t: 'move', uid: c.uid, zone: z2, slot: k }); });
          else if (z2 !== z && space(s, p, z2)) out.push({ t: 'move', uid: c.uid, zone: z2 });
        });
      }));
    }
    fieldChars(pl).forEach((c) => {
      if (D(c).activatable && !c.stunned && c.actT !== s.turn && pl.energy >= actCost(s, p, c) && actTargets(s, p, c).length) out.push({ t: 'activate', uid: c.uid });
    });
    if (all && pl.swapT !== s.turn && pl.energy >= G.RULES.swapCost) {
      const fc = fieldChars(pl).filter((c) => !c.stunned && c.movedT !== s.turn);
      for (let i = 0; i < fc.length; i++) for (let j = i + 1; j < fc.length; j++) out.push({ t: 'swap', a: fc[i].uid, b: fc[j].uid });
    }
    const tg = attackTargets(s, p);
    pl.atk.forEach((c) => { if (canAttack(s, p, c)) tg.forEach((t) => { if (t === 'life' && heroBlocked(s, c)) return; out.push({ t: 'attack', uid: c.uid, target: t }); }); });
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
