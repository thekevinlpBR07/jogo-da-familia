/* Dados oficiais das cartas — transcritos das imagens em assets/cards (texto das cartas prevalece sobre o manual Beta). */
(function () {
  const G = (window.G = window.G || {});

  // [num, nome, título, custo, ataque, defesa, raridade, chaveEfeito, texto, custoEfeito, flamengo]
  // raridade: b = Base, e = Especial, m = Mágica, l = Lendária
  const P = [
    [1, 'Kevin', 'o Engenheiro Mecânico', 2, 4, 5, 'b', 'peekReorder2', 'Ao Entrar: olhe as próximas 2 cartas de Personagem e coloque-as de volta na ordem que quiser.'],
    [2, 'Kevin', 'Craque da Bola', 3, 7, 3, 'e', 'apoioToAtk', 'Ao Entrar: você pode mover 1 Personagem seu de Apoio para Ataque.', 0, true],
    [3, 'Kevin', 'Mestre da Engenharia Mística', 5, 5, 7, 'm', 'kevinMestre', '🤝 Uma vez por seu turno, quando jogar um Suporte, olhe a próxima carta de Personagem; você pode colocá-la no fundo.'],
    [4, 'Kevin', 'Galã Montador de Dragões', 8, 9, 7, 'l', 'moveOther', 'Ao Entrar: mova outro Personagem seu entre ⚔️ e 🛡️.'],
    [5, 'Evilyn', 'a Impaciente', 1, 3, 3, 'b', 'peekCharBottom', 'Ao Entrar: olhe a próxima carta de Personagem; você pode colocá-la no fundo.'],
    [6, 'Evilyn', 'Idol do K-Pop', 3, 5, 5, 'e', 'evilynIdol', 'Ao Entrar: se tiver menos cartas na mão que o adversário, compre 1 Personagem, respeitando o limite da mão.'],
    [7, 'Evilyn', 'Fada Antipet', 5, 7, 4, 'm', 'bounceSupport', 'Ao Entrar: devolva à mão 1 Suporte adversário de custo ⚡2 ou menos.'],
    [8, 'Evilyn', 'Rainha dos Baixinhos', 9, 7, 9, 'l', 'evilynRainha', 'Ao Entrar: se tiver menos ❤️ que o adversário, Atordoe 1 Personagem inimigo em ⚔️ com 🛡️5 ou menos.'],
    [9, 'Rogerinho', 'o Empresário', 2, 5, 4, 'b', 'zeroEnergy', 'Ao jogar Rogerinho, se ficar com ⚡0, ganhe ⚡1.'],
    [10, 'Rogerinho', 'Taxista das Madrugadas', 4, 6, 5, 'e', 'moveOther', 'Ao Entrar: mova outro Personagem seu entre ⚔️ e 🛡️.'],
    [11, 'Rogerinho', 'o Vereador', 5, 5, 7, 'm', 'vereador', '🤝 Uma vez por seu turno, depois que jogar outro Personagem, olhe a próxima carta de Personagem.'],
    [12, 'Rogerinho', 'Rei dos Galos', 7, 10, 6, 'l', 'protStunOther', 'Ao Entrar: escolha outro Personagem seu. Ele não pode ser Atordoado até o início do seu próximo turno.'],
    [13, 'Claudineia', 'a Mãe', 2, 3, 6, 'b', 'healIfLow', 'Ao Entrar: se estiver com ❤️2 ou menos, recupere ❤️1.'],
    [14, 'Claudineia', 'Oráculo das Emoções', 4, 5, 7, 'm', 'peekReorder3', 'Ao Entrar: olhe as próximas 3 cartas de Personagem e coloque-as de volta na ordem que quiser.'],
    [15, 'Claudineia', 'Psicóloga da Família', 4, 4, 7, 'e', 'actUnstun', 'Ativável - ⚡1: retire o Atordoamento de outro Personagem seu.', 1],
    [16, 'Claudineia', 'Matriarca Suprema', 7, 6, 9, 'l', 'matriarca', 'Seus outros Defensores não podem ser movidos por efeitos adversários.'],
    [17, 'Dolores', 'a Vovó', 2, 3, 6, 'b', 'healIfLow', 'Ao Entrar: se estiver com ❤️2 ou menos, recupere ❤️1.'],
    [18, 'Dolores', 'Quebra-Ventos', 5, 8, 4, 'm', 'moveAny', 'Ao Entrar: mova 1 Personagem seu entre ⚔️ e 🛡️.'],
    [19, 'Dolores', 'Deusa dos Mil Ventos', 8, 9, 7, 'l', 'doloresDeusa', 'Ao Entrar: você pode mover 1 Personagem inimigo de ⚔️ para 🛡️, se houver espaço. Não pode mover Personagens Atordoados.'],
    [20, 'Dolores', 'Ladra de Plantas', 4, 5, 6, 'e', 'bounceSupport', 'Ao Entrar: devolva à mão 1 Suporte adversário de custo ⚡2 ou menos.'],
    [21, 'Sara', 'a Pregadora', 3, 4, 6, 'e', 'actUnstun', 'Ativável - ⚡1: retire o Atordoamento de outro Personagem seu.', 1],
    [22, 'Sara', 'a Falante', 1, 3, 3, 'b', 'revealTop', 'Ao Entrar: revele a próxima carta de Personagem para todos e devolva-a ao topo.'],
    [23, 'Sara', 'Pequena Deusa da Ira', 6, 10, 5, 'l', 'noStunAtk', 'Não pode ser Atordoada.'],
    [24, 'Sara', 'Fadinha de 1,50m', 4, 6, 6, 'm', 'moveToDef', 'Ao Entrar: você pode mover outro Personagem seu para 🛡️.'],
    [25, 'Bruno', 'o Calmo', 1, 3, 4, 'b', 'energyIfLessLife', 'Ao Entrar: se tiver menos ❤️ que o adversário, ganhe ⚡1.'],
    [26, 'Bruno', 'Rei das Vans', 4, 5, 6, 'e', 'moveOther', 'Ao Entrar: mova outro Personagem seu entre ⚔️ e 🛡️.'],
    [27, 'Bruno', 'o Sofredor Vascaíno', 4, 4, 8, 'm', 'vascaino', 'Na primeira vez em que Bruno ficar Atordoado enquanto estiver em campo, ganhe ⚡1.'],
    [28, 'Brunor', 'Mago da Série B', 9, 8, 8, 'l', 'brunor', 'Ao Entrar: se tiver menos ❤️ que o adversário, olhe os próximos 2 Suportes; coloque 1 na mão e o outro no fundo.'],
    [29, 'Helso', 'o Tranquilo', 1, 3, 4, 'b', 'helsoTranquilo', 'Ao Entrar em 🛡️: se for seu único Defensor, ganhe ⚡1.'],
    [30, 'Helso', 'Pé Descalibrado', 2, 6, 2, 'e', 'helsoPe', 'Quando empatar enquanto ataca, o inimigo é derrotado normalmente, mas coloque Helso no fundo do Baralho de Personagens em vez do descarte.'],
    [31, 'Helso', 'Lançador Oficial da NASA', 6, 8, 4, 'm', 'helsoNasa', '⚔️ Quando vencer um Desafio, coloque o inimigo derrotado no fundo do Baralho de Personagens em vez do descarte.'],
    [32, 'Helso', 'Mestre do Coco', 8, 7, 9, 'l', 'helsoCoco', 'Ao Entrar: se ficar com ⚡2 ou menos depois de pagar seu custo, ganhe ⚡1.'],
    [33, 'Jones', 'o Galanteador', 2, 5, 4, 'b', 'peekSupBottom', 'Ao Entrar: olhe a próxima carta de Suporte; você pode colocá-la no fundo.'],
    [34, 'Jones', 'Rei dos BUROS', 8, 8, 8, 'l', 'jonesRei', 'Ao Entrar: se não possuir Suporte na mão, olhe os próximos 2 Suportes; coloque 1 na mão e o outro no fundo.'],
    [35, 'Don Jones', 'Domador de Corações', 6, 7, 6, 'm', 'donJones', 'Ao Entrar: você pode devolver à mão 1 Personagem seu Atordoado. Ao voltar à mão, o Atordoamento desaparece.'],
    [36, 'Jones', 'Mestre dos Pets', 5, 4, 7, 'e', 'jonesPets', 'Quando usar sua Ação para comprar 1 Suporte, olhe os 2 próximos; coloque 1 na mão e o outro no fundo.'],
    [37, 'Juliana', 'a Serena', 1, 3, 4, 'b', 'julianaSerena', 'Ao Entrar em 🛡️: se for sua única Defesa, não pode ser movida por efeitos adversários até o início do seu próximo turno.', 0, true],
    [38, 'Juliana', 'Guardiã da Prefeitura', 3, 4, 7, 'e', 'moveToDef', 'Ao Entrar: mova outro Personagem seu para 🛡️.'],
    [39, 'Juliana', 'Elfa Esguia', 5, 6, 6, 'm', 'earlyRecover', 'Se ficar Atordoada, recupere-se no início do seu próximo turno em vez do final.'],
    [40, 'Juliana', 'Dama da Paciência Infinita', 7, 6, 9, 'l', 'julianaDama', 'Se for derrotada como sua última Defesa, recupere ❤️1.'],
    [41, 'Tainan', 'o Silencioso', 2, 5, 4, 'b', 'immovable', '🛡️ Não pode ser movido por efeitos adversários.'],
    [42, 'Tainan', 'Quebra-Manta', 4, 7, 4, 'e', 'quebraManta', '⚔️ Quando for desafiado, o contra-ataque dele causa 2 de dano a mais.'],
    [43, 'Taitanos', 'o Equilíbrio do Quintal', 6, 7, 6, 'm', 'taitanos', '⚔️ Depois de vencer um Desafio, você pode mover Tainan para 🛡️.'],
    [44, 'Cacique Tainan', 'o Imóvel', 9, 7, 9, 'l', 'cacique', 'Não pode ser movido nem devolvido à mão por efeitos adversários.'],
    [45, 'Leco', 'o Pedreiro', 3, 5, 5, 'b', 'lecoPedreiro', 'Uma vez por seu turno, depois que um Suporte Imediato seu resolver e for descartado, ganhe ⚡1.'],
    [46, 'Leco', 'Troll da Construção', 6, 7, 6, 'm', 'lecoTroll', '🤝 Uma vez por turno, quando um efeito adversário fosse destruir 1 Suporte seu, você pode pagar ⚡1 para impedir.'],
    [47, 'Leco', 'Deus da Gambiarra', 10, 9, 7, 'l', 'lecoDeus', 'Ao Entrar: recupere do descarte para sua mão 1 Suporte Permanente de custo ⚡3 ou menos. Não pode escolher Gambiarra do Leco.'],
    [48, 'Leco', 'Pequeno Brutamontes', 3, 7, 3, 'e', 'afterDefToDef', '⚔️ Depois de derrotar um Defensor e sobreviver, você pode mover Leco para 🛡️.'],
    [49, 'Adeni', 'a Tranquila', 1, 3, 4, 'b', 'zeroEnergy', 'Ao jogar Adeni, se ficar com ⚡0, ganhe ⚡1.'],
    [50, 'Adeni', 'Fada da Calmaria', 5, 5, 7, 'm', 'healIfLow', 'Ao Entrar: se estiver com ❤️2 ou menos, recupere ❤️1.'],
    [51, 'Adeni', 'Dama da Paz', 3, 4, 6, 'e', 'earlyRecover', 'Se ficar Atordoada, recupere-se no início do seu próximo turno em vez do final.'],
    [52, 'Adeni', 'Santa da Paciência', 6, 5, 9, 'l', 'adeniSanta', 'Ao Entrar: recupere ❤️1. Se estava exatamente com ❤️1, recupere ❤️2 em vez disso.'],
    [53, 'Fred', 'o Observador', 1, 3, 5, 'b', 'peekSupBottom', 'Ao Entrar: olhe a próxima carta de Suporte; você pode colocá-la no fundo.'],
    [54, 'Fred', 'Analista da Família', 3, 4, 7, 'e', 'actPeek', 'Ativável - ⚡1: olhe a próxima carta de Personagem; você pode colocá-la no fundo.', 1],
    [55, 'Fred', 'Oráculo dos Detalhes', 7, 6, 6, 'm', 'fredOraculo', 'Ao Entrar: olhe as próximas 3 cartas de Personagem; coloque 1 na mão e as outras no fundo.'],
    [56, 'Fred', 'Mestre das Estratégias', 8, 7, 8, 'l', 'fredMestre', 'Ao Entrar: escolha outro Personagem seu. Até o início do seu próximo turno, ele não pode ser Atordoado e não pode ser movido por efeitos adversários.'],
    [57, 'Gabriel', 'o Sério', 2, 5, 4, 'b', 'gabrielSerio', 'Ao Entrar em 🛡️: se possuir um Personagem Atordoado, retire o Atordoamento dele.'],
    [58, 'Gabriel', 'Mestre Pedagogo', 4, 4, 7, 'e', 'actUnstunDef', 'Ativável - ⚡1: retire o Atordoamento de outro Defensor seu.', 1],
    [59, 'Gabriel', 'Paladino Nervoso', 7, 7, 5, 'm', 'paladino', '⚔️ Em um Desafio, se houver empate, somente o inimigo é derrotado.'],
    [60, 'Gabriel', 'Arcanjo de Pouca Paciência', 10, 9, 7, 'l', 'arcanjo', 'Ao Entrar: se os 3 espaços ⚔️ inimigos estiverem ocupados, Atordoe 1 deles com 🛡️6 ou menos.'],
    [61, 'Neia', 'a Durona', 2, 5, 4, 'b', 'neiaDurona', 'Ao Entrar: se o adversário possuir mais Personagens no campo que você, ganhe ⚡1.'],
    [62, 'Neia', 'Xerife Aposentada', 4, 6, 5, 'e', 'lookHand', 'Ao Entrar: olhe a mão do adversário.'],
    [63, 'Neia', 'Amazona da Lei', 6, 7, 6, 'm', 'noBounce', 'Não pode ser devolvida à mão por efeitos adversários.'],
    [64, 'Neia', 'Presidenta do Brasil', 8, 8, 8, 'l', 'moveOther', 'Ao Entrar: mova outro Personagem seu entre ⚔️ e 🛡️.'],
    [65, 'Nathalia', 'Fiscal do Apocalipse', 3, 5, 6, 'e', 'nathaliaFiscal', 'Ao Entrar (⚡1): se o adversário tiver 2 Suportes Permanentes, devolva à mão 1 deles de custo ⚡2 ou menos.', 1],
    [66, 'Nathalia', 'Boba da Corte', 4, 7, 3, 'm', 'boba', 'Quando for derrotada, coloque Nathalia no fundo do Baralho de Personagens em vez do descarte.'],
    [67, 'Nathalia', 'Bruxa da Segurança', 9, 7, 9, 'l', 'nathaliaBruxa', 'Ao Entrar: Atordoe 1 Personagem inimigo em ⚔️ com 🛡️4 ou menos.'],
    [68, 'Nathalia', 'a Técnica', 1, 4, 5, 'b', 'peekEvent', 'Ao Entrar: olhe secretamente o próximo Evento.'],
    [69, 'Luar', 'Europeia', 2, 4, 5, 'b', 'moveOther', 'Ao Entrar: você pode mover outro Personagem seu entre ⚔️ e 🛡️.'],
    [70, 'Luar', 'Técnica Rubro-Negra', 4, 6, 5, 'e', 'afterDefToDef', 'Depois de derrotar um Defensor e sobreviver: você pode mover Luar para 🛡️.', 0, true],
    [71, 'Luar', 'Fada do Luar', 6, 6, 7, 'm', 'luarFada', 'Ao Entrar: você pode mover outro Personagem seu de ⚔️ para 🛡️. Se fizer isso, ele não pode ser movido por efeitos adversários até o início do seu próximo turno.'],
    [72, 'Luar', 'Deusa da Lua', 10, 9, 7, 'l', 'luarDeusa', 'Ao Entrar: você pode mover até 2 outros Personagens seus entre ⚔️ e 🛡️. Depois, escolha 1 que você moveu para 🛡️ desta forma. Ele não pode ser Atordoado até o início do seu próximo turno.'],
  ];

  // [num, nome, custo, tipo, chave, texto]  tipo: imm = Imediato, perm = Permanente, perm1 = Permanente - uso único
  const S = [
    [1, 'Bill, o Fiscal do Portão', 3, 'perm', 'bill', 'No fim do seu turno, olhe as próximas 2 cartas de Personagem e coloque-as de volta na ordem que quiser.'],
    [2, 'Fifinha: Quem Perder Passa o Controle', 6, 'imm', 'fifinha', 'Olhe os próximos 2 Personagens. Coloque 1 na mão e o outro no fundo. Respeite o limite da mão. Depois descarte esta carta.'],
    [3, 'Cafezinho Ressuscita-Defunto', 1, 'imm', 'cafezinho', 'Ganhe ⚡2. Depois descarte esta carta.'],
    [4, 'Água Gelada pra Pensar Melhor', 1, 'imm', 'agua', 'Olhe as próximas 2 cartas de Personagem e coloque-as de volta na ordem que quiser. Depois descarte esta carta.'],
    [5, 'Sofá do "Só Mais 5 Minutinhos"', 3, 'perm', 'sofa', 'Enquanto estiver ativo, no início do seu turno receba ⚡1 extra neste turno.'],
    [6, 'PF Reforçado da Dona Neia', 1, 'imm', 'pf', 'Recupere ❤️1. Depois descarte esta carta.'],
    [7, 'Caixa de Ferramentas do "Eu Resolvo"', 1, 'imm', 'caixa', 'Recupere do descarte para sua mão 1 Suporte Permanente de custo ⚡3 ou menos. Depois descarte esta carta.'],
    [8, 'Grupo da Família Sem Privacidade', 1, 'imm', 'grupo', 'Olhe a mão do adversário. Depois descarte esta carta.'],
    [9, 'Bola: Quem Perder Paga a Coca', 1, 'perm1', 'bola', 'Quando jogar 1 Personagem em ⚔️, você pode descartar esta carta para permitir que ele ataque neste turno. Isso não concede um ataque extra.'],
    [10, 'Van do Bruno — Cabe Mais Um!', 3, 'imm', 'van', 'Escolha até 2 dos seus Personagens. Mova cada um deles para qualquer área do mapa.'],
    [11, 'Jardim Milagroso da Dolores', 3, 'perm1', 'jardim', 'No fim do seu turno, se estiver com ❤️2 ou menos, você pode descartar esta carta para recuperar ❤️2.'],
    [12, 'Gambiarra do Leco — Agora Aguenta!', 1, 'perm1', 'gambiarra', 'Quando outro Suporte seu fosse destruído por um efeito adversário, descarte Gambiarra do Leco em vez dele.'],
    [13, 'Cristal do Gato de Luz', 2, 'perm', 'cristal', 'A primeira habilidade Ativável que você usar em cada turno custa ⚡1 a menos. Isso pode reduzir uma habilidade a ⚡0.'],
    [14, 'Pé de Benção da Vó', 3, 'perm1', 'pe', 'Quando sua última Defesa for destruída em combate, descarte esta carta para recuperar ❤️1.'],
    [15, 'Espelho do "Faz Igual!"', 5, 'imm', 'espelho', 'Copie o efeito Ao Entrar do último Personagem que você jogou neste turno, desde que o custo original dele seja ⚡4 ou menos. Depois descarte esta carta.'],
    [16, 'Garrafada de Procedência Duvidosa', 2, 'imm', 'garrafada', 'Escolha 1: ganhe ⚡2; ou recupere ❤️2. Depois descarte esta carta.'],
    [17, 'Porta dos Fundos Dimensional', 2, 'perm1', 'porta', 'Descarte esta carta para devolver 1 Personagem seu do campo para sua mão. Esse Personagem não pode ser jogado novamente neste turno.'],
    [18, 'Manual Oficial do "Não Valeu!"', 4, 'perm1', 'naovaleu', 'Quando um Personagem adversário fosse resolver um efeito Ao Entrar, descarte esta carta para cancelar aquele efeito.'],
    [19, 'Casa da Vó — Aqui Ninguém Morre', 4, 'perm1', 'casa', 'No início do seu turno, se estiver com ❤️1, descarte Casa da Vó para recuperar ❤️2.'],
    [20, 'Churrasco do "Chega Mais Um!"', 7, 'imm', 'churrasco', 'Olhe os próximos 3 Personagens. Coloque 1 na mão e os outros 2 no fundo. Depois ganhe ⚡1 e descarte esta carta.'],
    [21, 'Rinha... Quer Dizer, Arena dos Galos', 4, 'perm1', 'arena', 'Quando um Personagem seu em ⚔️ fosse derrotado em combate, descarte esta carta para devolvê-lo à sua mão em vez do descarte.'],
    [22, 'Poltrona do Chefe da Família', 6, 'imm', 'poltrona', 'Escolha 1: recupere ❤️2; ou compre até 2 Personagens, respeitando o limite da mão. Depois descarte esta carta.'],
    [23, 'Gambiarra 220V no 110V', 4, 'imm', 'g220', 'Ao jogar: escolha 1 Personagem da sua mão e jogue-o imediatamente pagando ⚡2 a menos. Depois descarte esta carta.'],
    [24, 'Táxi do Rogerinho — Corrida pra Outra Dimensão', 5, 'imm', 'taxi', 'Troque 1 Personagem seu no campo por 1 Personagem da sua mão. O novo Personagem custa ⚡1 a menos, resolve Ao Entrar normalmente e não pode atacar neste turno. Depois descarte esta carta.'],
  ];

  // [num, nome, tipo, chave, texto]  tipo: imm = Imediato (ao revelar), cont = Contínuo
  const E = [
    [1, 'Hoje Tem Flamengo!', 'imm', 'flamengo', 'Ao revelar: cada jogador que possuir pelo menos 1 Personagem 🔴⚫ Flamengo na mão ganha ⚡1.'],
    [2, 'Temporal de Domingo', 'cont', 'temporal', 'Enquanto estiver ativo, a Ação normal de mover 1 Personagem não pode ser escolhida. Movimentos produzidos por cartas continuam funcionando.'],
    [3, 'Acabou a Luz', 'cont', 'semLuz', 'Habilidades Ativáveis custam ⚡1 adicional enquanto este Evento estiver ativo.'],
    [4, 'Churrasco em Família', 'imm', 'churrasco', 'Ao revelar: cada jogador compra 1 Personagem, respeitando o limite da mão.'],
    [5, 'Treta no Grupo da Família', 'cont', 'treta', 'Enquanto estiver ativo, cartas não podem sair do descarte.'],
    [6, 'Caiu o PIX', 'cont', 'caiuPix', 'No início do turno de cada jogador, ele ganha ⚡1 extra neste turno.'],
    [7, 'O PIX Não Caiu', 'cont', 'naoCaiuPix', 'No início do turno de cada jogador, ele tem ⚡1 a menos neste turno (mínimo ⚡1).'],
    [8, 'Domingo na Praia', 'cont', 'praia', 'Suportes custam ⚡1 a menos. O custo mínimo continua ⚡1 e descontos não se acumulam.'],
    [9, 'Bill Solto', 'cont', 'billSolto', 'Ao revelar: cada jogador que possuir pelo menos 2 Defensores devolve à mão o seu Defensor de menor 🛡️.'],
    [10, 'Almoço de Domingo', 'cont', 'almoco', 'Enquanto este Evento estiver ativo, nenhum jogador pode atacar a ❤️ Vida do adversário. Personagens podem atacar normalmente outros Personagens.'],
    [11, 'Todo Mundo Vai Viajar', 'cont', 'viajar', 'Ao revelar: cada jogador pode colocar 1 Personagem da própria mão no fundo do Baralho de Personagens. Quem fizer isso compra 1 Personagem.'],
    [12, 'Sono Depois do Almoço', 'cont', 'sono', 'Enquanto estiver ativo, todo Personagem entra em campo Atordoado.'],
    [13, 'Festa da Família', 'cont', 'festa', 'Habilidades Ativáveis não podem ser usadas enquanto este Evento estiver ativo. Ao Entrar, passivas e outros efeitos continuam funcionando.'],
    [14, 'Discussão Generalizada', 'cont', 'discussao', 'Enquanto estiver ativo, nenhum jogador pode recuperar ❤️.'],
    [15, 'Noite Tranquila', 'cont', 'noite', 'No início do seu turno, retire o Atordoamento de todos os seus Personagens.'],
    [16, 'Virou Bagunça', 'cont', 'bagunca', 'Ao revelar: cada jogador pode embaralhar todos os Personagens de sua mão no Baralho de Personagens e comprar a mesma quantidade. Suportes permanecem na mão.'],
    [17, 'Vô Deu Bronca!', 'cont', 'bronca', 'Ao revelar: cada jogador escolhe 1 Personagem adversário em ⚔️ e move-o para 🛡️, se houver espaço.'],
    [18, 'Presente do Vô', 'cont', 'presente', 'Ao revelar: cada jogador compra 1 Suporte, respeitando o limite da mão.'],
  ];

  // Personagens cujo texto mudou na versão 2 (a imagem impressa ainda mostra o texto antigo)
  const UPD = new Set([]);
  const pad = (n) => String(n).padStart(2, '0');
  // URLs absolutas: evita que url() dentro de variáveis CSS seja resolvida a partir da pasta css/
  const abs = (p) => new URL(p, document.baseURI).href;
  const RAR = { b: 'Base', e: 'Especial', m: 'Mágica', l: 'Lendária' };
  const CARDS = {};

  P.forEach(([n, name, title, cost, atk, def, rar, fx, text, ecost, fla]) => {
    CARDS['p' + pad(n)] = {
      id: 'p' + pad(n), type: 'char', name, title, cost, atk, def, rarity: rar, rarityName: RAR[rar],
      fx, text, ecost: ecost || 0, flamengo: !!fla, updated: UPD.has(n), img: abs('assets/cards/personagens/' + pad(n) + '.webp?v=54'),
      activatable: /^act/.test(fx),
    };
  });
  S.forEach(([n, name, cost, kind, fx, text]) => {
    CARDS['s' + pad(n)] = {
      id: 's' + pad(n), type: 'sup', name, title: kind === 'imm' ? 'Imediato' : kind === 'perm' ? 'Permanente' : 'Permanente - uso único',
      cost, kind, fx, text, img: abs('assets/cards/suportes/' + pad(n) + '.webp?v=54'),
    };
  });
  E.forEach(([n, name, kind, fx, text]) => {
    CARDS['e' + pad(n)] = {
      id: 'e' + pad(n), type: 'ev', name, title: kind === 'imm' ? 'Evento Imediato' : 'Evento Contínuo',
      kind, fx, text, img: abs('assets/cards/eventos/' + pad(n) + '.webp?v=54'),
    };
  });

  // Temas musicais (arquivos em assets/music/temas). Personagens 1-4 = Kevin, 5-8 = Evilyn, e assim por diante.
  G.THEMES = [
    ['kevin', 'Kevin', '🔧'], ['evilyn', 'Evilyn', '🎤'], ['rogerinho', 'Rogerinho', '🐓'], ['claudineia', 'Claudineia', '🐶'],
    ['dolores', 'Dolores', '🌬️'], ['sara', 'Sara', '🗣️'], ['bruno', 'Bruno', '🚐'], ['helso', 'Helso', '🥥'],
    ['jones', 'Jones', '🐂'], ['juliana', 'Juliana', '💪'], ['tainan', 'Tainan', '🛡️'], ['leco', 'Leco', '🔨'],
    ['adeni', 'Adeni', '☕'], ['fred', 'Fred', '🕶️'], ['gabriel', 'Gabriel', '👼'], ['neia', 'Neia', '🤠'],
    ['nathalia', 'Nathalia', '🧙'], ['luar', 'Luar', '🌙'], ['bill', 'Bill (o cão)', '🐕'],
  ].map(([key, name, emoji]) => ({ key, name, emoji, url: abs('assets/music/temas/' + key + '.m4a') }));
  G.themeOf = (id) => {
    const d = CARDS[id];
    if (!d || d.type !== 'char') return null;
    return G.THEMES[Math.floor((parseInt(id.slice(1), 10) - 1) / 4)] || null;
  };

  G.CARDS = CARDS;
  G.CHAR_IDS = Object.keys(CARDS).filter((k) => k[0] === 'p');
  G.SUP_IDS = Object.keys(CARDS).filter((k) => k[0] === 's');
  G.EV_IDS = Object.keys(CARDS).filter((k) => k[0] === 'e');
  G.fullName = (c) => (c.type === 'char' ? c.name + ', ' + c.title : c.name);
})();
