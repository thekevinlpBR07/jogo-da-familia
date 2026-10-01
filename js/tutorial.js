/* Tutorial ilustrado + "Coach" (dicas contextuais durante a partida de treino). */
(function () {
  const G = window.G;
  const img = (id) => G.CARDS[id].img;
  const card = (id, extra) => `<div class="tcard" style="background-image:url(${img(id)});${extra || ''}"></div>`;

  const slides = [
    {
      t: 'Bem-vindo ao Jogo da Família!',
      body: `<p>Um duelo de cartas para <b>2 jogadores</b> estrelado pela própria família — cada um com versões <b>Base, Especial, Mágica e Lendária</b>.</p>
        <p>🎯 <b>Objetivo:</b> reduzir a Vida do adversário de <b>❤️5 para 0</b>.</p>
        <p>Existem 3 tipos de carta:</p>
        <ul><li><b>Personagens</b> (72): lutam no seu campo.</li><li><b>Suportes</b> (24): truques e ajudas.</li><li><b>Eventos</b> (18): mudam as regras da mesa por um tempo.</li></ul>`,
      vis: () => card('p04', 'transform:rotate(-8deg)') + card('s13', 'transform:translateY(-14px)') + card('e10', 'transform:rotate(8deg)'),
    },
    {
      t: 'Anatomia de um Personagem',
      body: `<ul><li><b>⚡ Custo</b> (canto superior): Energia para jogar a carta.</li>
        <li><b>⚔️ Ataque</b>: força quando ele ataca.</li>
        <li><b>🛡️ Defesa</b>: resistência quando é atacado.</li>
        <li><b>Efeito</b>: o poder especial da carta.</li>
        <li><b>Custo do efeito</b>: Energia extra para habilidades <b>Ativáveis</b>.</li></ul>
        <p>Palavras importantes: <b>Ao Entrar</b> (acontece quando a carta chega ao campo), <b>Ativável</b> (gasta sua Ação), e os símbolos ⚔️ 🛡️ 🤝 dizem em que zona o efeito funciona.</p>`,
      vis: () => `<div class="anatomy" style="background-image:url(${img('p01')})">
        <span class="tag l" style="right:104%;top:6%">⚡ Custo</span>
        <span class="tag r" style="left:104%;top:6%">Nome e título</span>
        <span class="tag l" style="right:104%;top:63%">⚔️ Ataque</span>
        <span class="tag r" style="left:104%;top:63%">🛡️ Defesa</span>
        <span class="tag l" style="right:104%;top:79%">Efeito</span>
        <span class="tag r" style="left:104%;top:89%">Custo do efeito</span></div>`,
    },
    {
      t: 'Preparação',
      body: `<ul><li>Cada jogador começa com <b>❤️5</b> de Vida e <b>⚡3</b> de Energia.</li>
        <li>Compre <b>4 Personagens</b> e <b>1 Suporte</b> — sem escolher nem devolver nenhuma carta.</li>
        <li>A partida começa <b>sem Evento</b>. O sorteio decide quem começa — e o <b>segundo jogador começa com ⚡4</b> (⚡1 a mais) para compensar.</li>
        <li>Quem começa <b>não compra</b> carta no seu primeiro turno.</li></ul>`,
      vis: () => card('p13') + card('p22') + card('p49') + card('p25') + card('s03', 'outline:3px solid #3fbf7f'),
    },
    {
      t: 'O campo de batalha',
      body: `<p>Seu campo tem 4 áreas:</p>
        <ul><li><b>⚔️ Ataque (3 vagas)</b>: quem pode atacar.</li>
        <li><b>🛡️ Defesa (3 vagas)</b>: protegem a sua Vida.</li>
        <li><b>🤝 Apoio (2 vagas)</b>: não atacam, não defendem e <b>não podem ser atacados</b> — ficam lá para usar efeitos 🤝.</li>
        <li><b>🛠️ Suportes (2 vagas)</b>: para Suportes Permanentes.</li></ul>
        <p>Efeitos <b>Ao Entrar</b> funcionam em qualquer zona.</p>`,
      vis: () => `<div class="mini-board">
        <div class="mini-row"><span class="mini-label">⚔️ Ataque</span><div class="mini-slot atk">⚔️</div><div class="mini-slot atk">⚔️</div><div class="mini-slot atk">⚔️</div></div>
        <div class="mini-row"><span class="mini-label">🛡️ Defesa</span><div class="mini-slot def">🛡️</div><div class="mini-slot def">🛡️</div><div class="mini-slot def">🛡️</div></div>
        <div class="mini-row"><span class="mini-label">🤝 Apoio</span><div class="mini-slot apo">🤝</div><div class="mini-slot apo">🤝</div><span class="mini-label" style="width:auto">🛠️</span><div class="mini-slot sup">🛠️</div><div class="mini-slot sup">🛠️</div></div></div>`,
    },
    {
      t: 'O seu turno',
      body: `<p>Todo turno segue esta ordem:</p>
        <ol><li><b>COMPRE</b> 1 Personagem (se tiver menos de 7 cartas na mão).</li>
        <li><b>AÇÃO</b>: faça <u>apenas uma</u> — jogar 1 Personagem, jogar 1 Suporte, comprar 1 Suporte, mover 1 Personagem de zona, usar 1 habilidade Ativável.</li>
        <li><b>Grátis:</b> jogar <b>1 Suporte por turno</b> não gasta a Ação! Além disso, a cada 2 turnos seus você compra 1 Suporte automaticamente.</li>
        <li><b>COMBATE</b>: cada Personagem pronto no ⚔️ pode atacar uma vez.</li>
        <li><b>ENERGIA</b>: ganhe ⚡1 (ou ⚡2 se derrotou alguém em combate).</li></ol>
        <p>💤 Ou então <b>PASSE</b>: não faz nada e ganha <b>⚡2</b>.</p>`,
      vis: () => `<div class="flow"><div class="step"><span>🃏</span><b>Compre</b>1 carta</div><span class="arrow">⬇</span><div class="step"><span>✨</span><b>1 Ação</b>jogar/mover…</div><span class="arrow">⬇</span><div class="step"><span>⚔️</span><b>Combate</b>atacar</div><span class="arrow">⬇</span><div class="step"><span>⚡</span><b>Energia</b>+1 ou +2</div></div>`,
    },
    {
      t: 'Combate: ⚔️ contra 🛡️',
      body: `<p>O atacante usa o seu <b>⚔️ Ataque</b>; o alvo usa a sua <b>🛡️ Defesa</b> — esteja ele no Ataque ou na Defesa.</p>
        <p>Um Personagem <b>recém-jogado não ataca</b> no mesmo turno (💤), e quem foi <b>movido</b> pela Ação também não.</p>
        <p>Você escolhe quantos ataques fazer e em que ordem.</p>`,
      vis: () => `<div class="duel">
        <div class="duel-row"><span class="n" style="color:#9dffc6">⚔️7 &gt; 🛡️5</span><span class="r">O alvo é <b>derrotado</b>.</span></div>
        <div class="duel-row"><span class="n" style="color:#ffd58a">⚔️6 = 🛡️6</span><span class="r"><b>Os dois</b> são derrotados.</span></div>
        <div class="duel-row"><span class="n" style="color:#ff9aa6">⚔️4 &lt; 🛡️7</span><span class="r">O <b>atacante cai</b> e o alvo fica <b>Atordoado 💫</b>.</span></div></div>`,
    },
    {
      t: 'Defesa, Desafio e dano à Vida',
      body: `<ul><li>Se o adversário tem <b>Defensores</b>, para chegar na Vida você precisa derrubá-los.</li>
        <li><b>Desafio</b>: você pode atacar um Personagem do <b>Ataque</b> inimigo mesmo com Defensores. Desafio nunca tira Vida.</li>
        <li><b>Ataque direto</b>: sem Defensores, o atacante tira <b>❤️1</b> (clique no retrato do adversário).</li>
        <li><b>Rompimento</b>: derrubou a <b>última Defesa</b> e sobreviveu? O adversário perde <b>❤️1</b>.</li>
        <li>Cada jogador perde no máximo <b>❤️1 por turno</b> do adversário.</li></ul>`,
      vis: () => card('p48', 'transform:rotate(-6deg)') + `<div style="font-size:44px">⚔️</div>` + card('p40', 'transform:rotate(6deg)'),
    },
    {
      t: 'Atordoamento 💫',
      body: `<p>Um Personagem <b>Atordoado</b>:</p>
        <ul><li>Não ataca, não usa habilidade Ativável, não se move e não pode ser movido por efeitos.</li>
        <li><b>Continua defendendo</b> se estiver na 🛡️.</li>
        <li>Se recupera no <b>fim do próximo turno</b> do dono.</li>
        <li>Se voltar para a mão, o Atordoamento some.</li></ul>`,
      vis: () => card('p27', 'filter:grayscale(.7) brightness(.8);transform:rotate(-10deg)') + `<div style="font-size:60px">💫</div>`,
    },
    {
      t: 'Energia, Suportes e Eventos',
      body: `<ul><li>Energia máxima: <b>⚡8</b>. Mão máxima: <b>7 cartas</b>. Vida máxima: <b>❤️5</b>.</li>
        <li>Nenhuma carta custa menos de ⚡1 e descontos <b>não se acumulam</b>.</li>
        <li><b>Suporte Imediato</b>: resolve e vai para o descarte. <b>Permanente</b>: fica numa das 2 vagas 🛠️ (uso único = descarta quando usa).</li>
        <li><b>Evento</b>: entra <b>sozinho a cada 3 rodadas</b> (o primeiro no fim da 3ª). Uma vez por turno você também pode pagar <b>⚡2</b> (sem gastar a Ação) para chamar o próximo na hora.</li></ul>
        <p>👑 <b>Regra de ouro:</b> se a carta contrariar a regra, vale a carta.</p>`,
      vis: () => card('s05') + card('s21') + card('e17'),
    },
    {
      t: 'Como jogar neste site',
      body: `<ul><li><b>Toque numa carta da mão</b> e depois numa <b>zona verde</b> para jogá-la.</li>
        <li>Para atacar, toque num Personagem seu <b>brilhando em laranja</b> e depois no <b>alvo 🎯</b> (ou no retrato do adversário para ataque direto).</li>
        <li><b>Segure o dedo</b> (ou clique com o botão direito) em qualquer carta para <b>ampliar</b> e ler o texto.</li>
        <li>No computador, deixe o mouse parado em cima de uma carta para ver ela grande.</li>
        <li>Botões no meio da mesa: <b>Comprar Suporte</b>, <b>Passar</b>, <b>Combate</b> e <b>Encerrar turno</b>.</li></ul>
        <div class="btns" style="justify-content:flex-start;margin-top:14px"><button class="btn gold" id="tut-practice">🎓 Praticar com dicas</button></div>`,
      vis: () => card('p09', 'transform:rotate(-5deg)') + card('p68') + card('p35', 'transform:rotate(5deg)'),
    },
  ];

  let idx = 0;
  function draw() {
    const s = slides[idx];
    document.getElementById('tut-stage').innerHTML = `<div class="tut-slide"><div><h3>${s.t}</h3>${s.body}</div><div class="tut-visual">${s.vis()}</div></div>`;
    document.getElementById('tut-progress').innerHTML = slides.map((_, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('');
    document.getElementById('tut-prev').disabled = idx === 0;
    const nx = document.getElementById('tut-next');
    nx.textContent = idx === slides.length - 1 ? 'Jogar agora! 🎮' : 'Próximo →';
    const pr = document.getElementById('tut-practice');
    if (pr) pr.onclick = () => G.startSolo('easy', true);
  }
  G.Tutorial = {
    open() { idx = 0; draw(); },
    next() { if (idx < slides.length - 1) { idx++; draw(); G.sfx('click'); } else G.startSolo('easy', true); },
    prev() { if (idx > 0) { idx--; draw(); G.sfx('click'); } },
  };

  // ------------------------------------------------------------------ Coach
  const seen = new Set();
  let enabled = false;
  let current = null;
  function tip(key, title, text) {
    if (!enabled || seen.has(key)) return;
    seen.add(key);
    if (current) current.kill();
    current = G.UI.toast(`<div class="who"></div><div><b class="ttl">${title}</b><p>${text}</p><button class="btn small ok">Entendi</button></div>`, 'coach', 0, '#coach-root');
    const t = current;
    t.querySelector('.ok').onclick = () => { t.kill(); if (current === t) current = null; };
  }
  G.Coach = {
    enable(on) { enabled = !!on; seen.clear(); if (current) { current.kill(); current = null; } },
    onView(v, legal) {
      if (!enabled) return;
      const me = v.me;
      const pl = v.players[me], op = v.players[1 - me];
      if (v.winner != null) return;
      if (v.pending && v.pending.player === me) {
        tip('pend', 'Uma escolha!', 'Algumas cartas pedem decisões. Toque nas cartas para escolher e confirme. Use <b>👁 Ver a mesa</b> se quiser olhar o tabuleiro antes.');
        return;
      }
      if (v.active !== me) {
        if (v.turn > 1) tip('opp', 'Vez do adversário', 'Agora o computador joga. Observe o que ele faz — o histórico fica na lateral (ou no botão 📜 no celular).');
        return;
      }
      if (v.phase === 'action' && !v.actionUsed) {
        tip('act', 'Seu turno: escolha 1 Ação', 'Toque numa carta da mão (as que brilham em verde cabem na sua Energia ⚡) e depois numa zona verde. Comece colocando alguém na <b>🛡️ Defesa</b> para proteger sua Vida!');
        if (pl.atk.length + pl.def.length >= 2) tip('pass', 'Passar também é jogada', 'Sem boas jogadas? O botão <b>Passar</b> dá ⚡2 e encerra o turno — ótimo para juntar Energia para uma Lendária.');
        if (pl.hand.some((c) => G.CARDS[c.id].type === 'sup')) tip('sup', 'Suportes são grátis!', 'Você pode jogar <b>1 Suporte por turno sem gastar a Ação</b> (até depois do combate). Os <b>Imediatos</b> fazem efeito na hora; os <b>Permanentes</b> ficam no campo, à direita.');
      }
      if (v.phase === 'combat' || (v.phase === 'action' && legal.some((a) => a.t === 'attack'))) {
        if (legal.some((a) => a.t === 'attack')) {
          tip('atk', 'Hora do combate!', 'Personagens seus <b>brilhando em laranja</b> podem atacar. Toque num deles e depois no alvo 🎯. Um ✔ verde no alvo quer dizer que você vence o duelo.');
          if (legal.some((a) => a.target === 'life')) tip('life', 'Caminho livre!', 'O adversário não tem Defensores: selecione um atacante e toque no <b>retrato do adversário</b> para tirar ❤️1!');
        } else if (v.phase === 'combat') tip('noatk', 'Sem atacantes prontos', 'Personagens recém-jogados (💤) só atacam no próximo turno. Toque em <b>Encerrar turno</b>.');
      }
      if (v.turn >= 3) tip('ev', 'Eventos', 'Os Eventos entram sozinhos a cada 3 rodadas. O botão <b>🌟 Chamar Evento</b> (⚡2, sem gastar a Ação) adianta o próximo. O atual aparece na lateral (no celular, no ícone do topo).');
      if ([...pl.atk, ...pl.def, ...op.atk, ...op.def].some((c) => c.stunned)) tip('stun', 'Atordoado 💫', 'Uma carta inclinada e cinza está Atordoada: não ataca nem se move até se recuperar, mas continua defendendo.');
      if (pl.life <= 2) tip('low', 'Cuidado com a Vida!', 'Mantenha Defensores fortes. Cartas como Claudineia, Dolores e Adeni recuperam ❤️ quando você está com 2 ou menos.');
    },
  };
})();
