/* Tutorial ilustrado + "Coach" (dicas contextuais durante a partida de treino). */
(function () {
  const G = window.G;
  const img = (id) => G.CARDS[id].img;
  const card = (id, extra) => `<div class="tcard" style="background-image:url(${img(id)});${extra || ''}"></div>`;

  const slides = [
    {
      t: 'Bem-vindo ao Jogo da Família!',
      body: `<p>Um duelo de cartas para <b>2 jogadores</b> estrelado pela própria família — cada um com versões <b>Base, Especial, Mágica e Lendária</b>.</p>
        <p>🎯 <b>Objetivo:</b> reduzir a vida do adversário de <b>25 para 0</b>.</p>
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
        <p>Palavras importantes: <b>Ao Entrar</b> (acontece quando a carta chega ao campo), <b>Ativável</b> (paga energia, 1 vez por carta por turno), e os símbolos ⚔️ 🛡️ 🤝 dizem em que zona o efeito funciona.</p>`,
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
      body: `<ul><li>Cada jogador começa com <b>25 de vida</b> (1 ❤️ nas cartas = 5 pontos). No <b>primeiro turno de cada um só existe ⚡1</b> e nenhum efeito dá energia extra.</li>
        <li>Compre <b>4 Personagens</b> e <b>2 Suportes</b> — sem escolher nem devolver, todos <b>baratos (até ⚡3)</b>. Sua mão sempre tem <b>pelo menos 1 Personagem de custo ⚡1</b>.</li>
        <li>Para compensar quem começa, o <b>segundo jogador ganha ⚡+3 no 2º turno dele</b>.</li>
        <li><b>Só recebemos cartas que dá para jogar</b>: as compras seguem a sua energia (no turno 5, só vêm cartas de custo até ⚡5, quando houver). Cartas fortes chegam conforme a energia sobe.</li>
        <li>A partida começa <b>sem Evento</b>. O sorteio decide quem começa (as duas posições são equilibradas).</li>
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
      t: 'O seu turno e a energia ⚡',
      body: `<p>No seu turno:</p>
        <ol><li><b>COMPRE</b> 1 Personagem (se tiver menos de 7 cartas).</li>
        <li><b>JOGUE</b> o que quiser com a sua energia: Personagens, Suportes, mover (⚡1), habilidades Ativáveis e comprar Suporte (⚡1). <b>Sem limite de cartas</b>, só de energia!</li>
        <li><b>ATAQUE</b> com cada Personagem pronto.</li>
        <li><b>ENCERRE</b> o turno — ou <b>pule</b> se não tiver nada para jogar (o botão vira "Pular turno").</li></ol>
        <p>⚡ <b>Energia que recarrega:</b> turno 1 = ⚡1, turno 2 = ⚡2... até ⚡10. Enche todo turno, e <b>o que sobrar se perde</b> — então vale gastar!</p>`,
      vis: () => `<div class="flow"><div class="step"><span>⚡1</span><b>Turno 1</b>1 de energia</div><span class="arrow">⬇</span><div class="step"><span>⚡5</span><b>Turno 5</b>5 de energia</div><span class="arrow">⬇</span><div class="step"><span>⚡10</span><b>Turno 10+</b>sempre 10</div></div>`,
    },
    {
      t: 'Exemplo de um turno',
      body: `<p>É o seu <b>turno 4</b>: você tem <b>⚡4</b>. Uma jogada possível:</p>
        <ol><li>Jogar um Personagem de <b>⚡2</b> na 🛡️ Defesa → sobram ⚡2.</li>
        <li>Jogar um Suporte de <b>⚡1</b> → sobra ⚡1.</li>
        <li><b>Mover</b> um Personagem de Apoio para o Ataque (⚡1) → sobra ⚡0.</li>
        <li>Atacar com quem já estava pronto no Ataque e <b>encerrar</b>.</li></ol>
        <p>Cartas fortes custam mais (até <b>⚡10</b>): guardar a mão para o fim do jogo é normal, mas <b>energia não usada nunca acumula</b>.</p>
        <p>💡 Mover custa ⚡1, só 1 vez por Personagem por turno, e <b>quem se moveu não ataca</b> naquele turno.</p>`,
      vis: () => `<div class="flow"><div class="step"><span>⚡4</span><b>Início</b>energia cheia</div><span class="arrow">➜</span><div class="step"><span>⚡2</span><b>Personagem</b>custo 2</div><span class="arrow">➜</span><div class="step"><span>⚡1</span><b>Suporte</b>custo 1</div><span class="arrow">➜</span><div class="step"><span>⚡0</span><b>Mover</b>custo 1</div></div>`,
    },
    {
      t: 'Combate: ataque e contra-ataque',
      body: `<p>O atacante causa o seu <b>⚔️ Ataque</b> de dano. O alvo <b>contra-ataca</b> com o ⚔️ dele, ao mesmo tempo.</p>
        <p>O dano fica na carta até o <b>início do turno do dono dela</b>. A carta <b>cai</b> quando o dano chega à sua <b>🛡️ Defesa</b>.</p>
        <p>Um Personagem <b>recém-jogado não ataca</b> no mesmo turno (💤), e quem foi movido também não. Dá para <b>juntar ataques</b> para derrubar um alvo forte!</p>`,
      vis: () => `<div class="duel">
        <div class="duel-row"><span class="n" style="color:#9dffc6">⚔️7 → 🛡️5</span><span class="r">O alvo tem 5 de vida: <b>cai</b>.</span></div>
        <div class="duel-row"><span class="n" style="color:#ffd58a">⚔️4 → 🛡️9</span><span class="r">Fica com 5 de vida; <b>um segundo ataque</b> termina o serviço.</span></div>
        <div class="duel-row"><span class="n" style="color:#ff9aa6">↩ contra-ataque</span><span class="r">O alvo também te dá o ⚔️ dele. Escolha bem!</span></div></div>`,
    },
    {
      t: 'Defesa, Desafio e vida',
      body: `<ul><li>Se o adversário tem <b>Defensores 🛡️</b>, o herói dele está protegido: ataque os Defensores primeiro.</li>
        <li><b>Desafio</b>: você pode atacar um Personagem do <b>Ataque</b> inimigo mesmo com Defensores.</li>
        <li><b>Sem Defensores?</b> <b>Todos</b> os seus atacantes podem atacar o herói (clique no retrato dele). Cada um tira vida igual ao seu ⚔️ — e o herói não contra-ataca.</li>
        <li>A vida começa em <b>25</b>. Nas cartas, <b>1 ❤️ = 5 pontos</b> de vida.</li></ul>`,
      vis: () => card('p48', 'transform:rotate(-6deg)') + `<div style="font-size:44px">⚔️</div>` + card('p40', 'transform:rotate(6deg)'),
    },
    {
      t: 'Atordoamento 💫',
      body: `<p>Alguns efeitos de cartas <b>Atordoam</b> um Personagem. Um Personagem Atordoado:</p>
        <ul><li>Não ataca, não usa habilidade Ativável, não se move e não pode ser movido por efeitos.</li>
        <li><b>Continua defendendo</b> se estiver na 🛡️.</li>
        <li>Se recupera no <b>fim do próximo turno</b> do dono.</li>
        <li>Se voltar para a mão, o Atordoamento some.</li></ul>`,
      vis: () => card('p27', 'filter:grayscale(.7) brightness(.8);transform:rotate(-10deg)') + `<div style="font-size:60px">💫</div>`,
    },
    {
      t: 'Limites, Suportes e Eventos',
      body: `<ul><li>Energia máxima: <b>⚡10</b>. Mão máxima: <b>7 cartas</b>. Nenhuma carta custa menos de ⚡1 e descontos <b>não se acumulam</b>.</li>
        <li><b>Suporte Imediato</b>: resolve e vai para o descarte. <b>Permanente</b>: fica numa das 2 vagas 🛠️ (uso único = descarta quando usa).</li>
        <li>A cada 2 turnos seus você <b>compra 1 Suporte automaticamente</b>.</li>
        <li><b>Evento</b>: entra <b>sozinho a cada 3 rodadas</b> e muda as regras até o próximo. Ninguém compra nem troca Eventos.</li></ul>
        <p>👑 <b>Regra de ouro:</b> se a carta contrariar a regra, vale a carta.</p>`,
      vis: () => card('s05') + card('s21') + card('e17'),
    },
    {
      t: 'Como jogar neste site',
      body: `<ul><li><b>Toque numa carta da mão</b> e depois numa <b>zona verde</b> para jogá-la.</li>
        <li>Para atacar, toque num Personagem seu <b>brilhando em laranja</b> e depois no <b>alvo 🎯</b> (ou no retrato do adversário, quando ele não tem Defensores).</li>
        <li><b>Segure o dedo</b> (ou clique com o botão direito) em qualquer carta para <b>ampliar</b> e ler o texto.</li>
        <li>No computador, deixe o mouse parado em cima de uma carta para ver ela grande.</li>
        <li>Botões no meio da mesa: <b>Comprar Suporte</b> e <b>Encerrar turno</b>.</li></ul>
        <div class="btns" style="justify-content:flex-start;margin-top:14px"><button class="btn gold" id="tut-practice">🎓 Praticar com dicas</button></div>`,
      vis: () => card('p09', 'transform:rotate(-5deg)') + card('p68') + card('p35', 'transform:rotate(5deg)'),
    },
  ];

  let idx = 0;
  function draw() {
    const s = slides[idx];
    const st = document.getElementById('tut-stage'); st.scrollTop = 0; window.scrollTo(0, 0);
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
      if (v.phase === 'main') {
        tip('act', 'Seu turno: gaste a energia!', 'Toque numa carta da mão (as que brilham em verde cabem na sua energia ⚡) e depois numa zona verde. Você pode jogar <b>quantas cartas quiser</b>. Comece colocando alguém na <b>🛡️ Defesa</b> para proteger sua vida!');
        tip('nrg', 'A energia recarrega', 'Todo turno a energia enche até o máximo (que sobe 1 por turno, até ⚡10). O que sobrar <b>se perde</b>, então use tudo!');
        if (pl.hand.some((c) => G.CARDS[c.id].type === 'sup')) tip('sup', 'Suportes', 'Suportes (verdes) também gastam energia. Os <b>Imediatos</b> fazem efeito na hora; os <b>Permanentes</b> ficam no campo, à direita.');
        if (legal.some((a) => a.t === 'attack')) {
          tip('atk', 'Hora de atacar!', 'Personagens seus <b>brilhando em laranja</b> podem atacar. Toque num deles e depois no alvo 🎯. O alvo contra-ataca com o ⚔️ dele, e o dano fica na carta até o turno do dono.');
          if (legal.some((a) => a.target === 'life')) tip('life', 'Caminho livre!', 'O adversário não tem Defensores: selecione um atacante e toque no <b>retrato do adversário</b>. <b>Todos</b> os seus atacantes podem atacar o herói!');
        }
        if (!legal.some((a) => a.t !== 'endTurn' && a.t !== 'buySup')) tip('end', 'Nada mais a fazer?', 'Quando não sobrar nada útil, toque em <b>Encerrar turno</b>. Personagens recém-jogados (💤) só atacam no próximo turno.');
      }
      if (v.turn >= 3) tip('ev', 'Eventos', 'Os Eventos entram sozinhos a cada 3 rodadas e mudam as regras da mesa. O atual aparece à direita do campo (no celular, no ícone do topo) — toque nele para ler.');
      if ([...pl.atk, ...pl.def, ...op.atk, ...op.def].some((c) => c.stunned)) tip('stun', 'Atordoado 💫', 'Uma carta inclinada e cinza está Atordoada: não ataca nem se move até se recuperar, mas continua defendendo.');
      if (pl.life <= 10) tip('low', 'Cuidado com a Vida!', 'Você está com 10 pontos ou menos (2 ❤️). Mantenha Defensores fortes. Cartas como Claudineia, Dolores e Adeni recuperam vida quando você está baixo.');
    },
  };
})();
