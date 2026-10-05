/* Dados oficiais das cartas — transcritos das imagens em assets/cards (texto das cartas prevalece sobre o manual Beta). */
(function () {
  const G = (window.G = window.G || {});

  // [num, nome, título, custo, ataque, defesa, raridade, chaveEfeito, texto, custoEfeito, flamengo]
  // raridade: b = Base, e = Especial, m = Mágica, l = Lendária
  const P = [
    [1, 'Kevin', 'o Engenheiro Mecânico', 2, 4, 5, 'b', 'healBoard', 'Ao Entrar: cure todo o dano dos seus Personagens.'],
    [2, 'Kevin', 'Craque da Bola', 3, 7, 3, 'e', 'apoioToAtk', 'Ao Entrar: você pode mover 1 Personagem seu de Apoio para Ataque.', 0, true],
    [3, 'Kevin', 'Mestre da Engenharia Mística', 5, 5, 7, 'm', 'kevinMestre', '🤝 Uma vez por seu turno, quando jogar um Suporte, compre 1 Personagem, respeitando o limite da mão.'],
    [4, 'Kevin', 'Galã Montador de Dragões', 8, 9, 7, 'l', 'moveOther', 'Ao Entrar: mova outro Personagem seu entre ⚔️ e 🛡️.'],
    [5, 'Evilyn', 'a Impaciente', 1, 3, 3, 'b', 'ligeiro', 'Ligeiro: pode atacar assim que entra em campo, mas só ataca Personagens.'],
    [6, 'Evilyn', 'Idol do K-Pop', 3, 5, 5, 'e', 'evilynIdol', 'Ao Entrar: se tiver menos cartas na mão que o adversário, compre 1 Personagem, respeitando o limite da mão.'],
    [7, 'Evilyn', 'Fada Antipet', 5, 7, 4, 'm', 'bounceSupport', 'Ao Entrar: devolva à mão 1 Suporte adversário de custo ⚡2 ou menos.'],
    [8, 'Evilyn', 'Rainha dos Baixinhos', 9, 7, 9, 'l', 'cureIfBehind', 'Ao Entrar: se tiver menos ❤️ que o adversário, cure todo o dano dos seus Personagens.'],
    [9, 'Rogerinho', 'o Empresário', 2, 5, 4, 'b', 'zeroEnergy', 'Ao jogar Rogerinho, se ficar com ⚡0, ganhe ⚡1.'],
    [10, 'Rogerinho', 'Taxista das Madrugadas', 4, 6, 5, 'e', 'moveOther', 'Ao Entrar: mova outro Personagem seu entre ⚔️ e 🛡️.'],
    [11, 'Rogerinho', 'o Vereador', 5, 5, 7, 'm', 'vereador', '🤝 Uma vez por seu turno, depois que jogar outro Personagem, recupere ❤️1.'],
    [12, 'Rogerinho', 'Rei dos Galos', 7, 10, 6, 'l', 'cure5Each', 'Ao Entrar: cada Personagem seu cura 5 de dano.'],
    [13, 'Claudineia', 'a Mãe', 2, 3, 6, 'b', 'healIfLow', 'Ao Entrar: se estiver com ❤️2 ou menos, recupere ❤️2.'],
    [14, 'Claudineia', 'Oráculo das Emoções', 4, 5, 7, 'm', 'heal2', 'Ao Entrar: recupere ❤️2.'],
    [15, 'Claudineia', 'Psicóloga da Família', 4, 4, 7, 'e', 'actCure', 'Ativável - ⚡1: cure todo o dano de outro Personagem seu.', 1],
    [16, 'Claudineia', 'Matriarca Suprema', 7, 6, 9, 'l', 'matriarca', 'Seus outros Defensores não podem ser movidos por efeitos adversários.'],
    [17, 'Dolores', 'a Vovó', 2, 3, 6, 'b', 'healIfLow', 'Ao Entrar: se estiver com ❤️2 ou menos, recupere ❤️2.'],
    [18, 'Dolores', 'Quebra-Ventos', 5, 8, 4, 'm', 'moveAny', 'Ao Entrar: mova 1 Personagem seu entre ⚔️ e 🛡️.'],
    [19, 'Dolores', 'Deusa dos Mil Ventos', 8, 9, 7, 'l', 'doloresDeusa', 'Ao Entrar: você pode mover 1 Personagem inimigo de ⚔️ para 🛡️, se houver espaço.'],
    [20, 'Dolores', 'Ladra de Plantas', 4, 5, 6, 'e', 'bounceSupport', 'Ao Entrar: devolva à mão 1 Suporte adversário de custo ⚡2 ou menos.'],
    [21, 'Sara', 'a Pregadora', 3, 4, 6, 'e', 'actCure', 'Ativável - ⚡1: cure todo o dano de outro Personagem seu.', 1],
    [22, 'Sara', 'a Falante', 1, 3, 3, 'b', 'ligeiro', 'Ligeiro: pode atacar assim que entra em campo, mas só ataca Personagens.'],
    [23, 'Sara', 'Pequena Deusa da Ira', 8, 10, 5, 'l', 'vanilla', 'Sem efeito especial.'],
    [24, 'Sara', 'Fadinha de 1,50m', 4, 6, 6, 'm', 'moveToDef', 'Ao Entrar: você pode mover outro Personagem seu para 🛡️.'],
    [25, 'Bruno', 'o Calmo', 1, 3, 4, 'b', 'energyIfLessLife', 'Ao Entrar: se tiver menos ❤️ que o adversário, ganhe ⚡1.'],
    [26, 'Bruno', 'Rei das Vans', 4, 5, 6, 'e', 'moveOther', 'Ao Entrar: mova outro Personagem seu entre ⚔️ e 🛡️.'],
    [27, 'Bruno', 'o Sofredor Vascaíno', 4, 4, 8, 'm', 'vanilla', 'Sem efeito especial.'],
    [28, 'Brunor', 'Mago da Série B', 9, 8, 8, 'l', 'brunor', 'Ao Entrar: se tiver menos ❤️ que o adversário, recupere ❤️3.'],
    [29, 'Helso', 'o Tranquilo', 1, 3, 4, 'b', 'helsoTranquilo', 'Ao Entrar em 🛡️: se for seu único Defensor, ganhe ⚡1.'],
    [30, 'Helso', 'Pé Descalibrado', 2, 6, 2, 'e', 'ligeiro', 'Ligeiro: pode atacar assim que entra em campo, mas só ataca Personagens.'],
    [31, 'Helso', 'Lançador Oficial da NASA', 6, 8, 4, 'm', 'helsoNasa', '⚔️ Quando vencer um Desafio, coloque o inimigo derrotado no fundo do Baralho de Personagens em vez do descarte.'],
    [32, 'Helso', 'Mestre do Coco', 9, 7, 9, 'l', 'helsoCoco', 'Ao Entrar: recupere ❤️1 e cure todo o dano dos seus Personagens.'],
    [33, 'Jones', 'o Galanteador', 2, 5, 4, 'b', 'nextSupRed', 'Ao Entrar: o próximo Suporte que você jogar neste turno custa ⚡1 a menos.'],
    [34, 'Jones', 'Rei dos BUROS', 8, 8, 8, 'l', 'jonesRei', 'Ao Entrar: compre 2 Suportes, respeitando o limite da mão.'],
    [35, 'Don Jones', 'Domador de Corações', 6, 7, 6, 'm', 'donJones', 'Ao Entrar: você pode devolver à mão 1 Personagem seu com dano. Ao voltar à mão, o dano desaparece.'],
    [36, 'Jones', 'Mestre dos Pets', 4, 4, 7, 'e', 'jonesPets', 'Seus Suportes Imediatos custam ⚡1 a menos (mínimo ⚡1).'],
    [37, 'Juliana', 'a Serena', 1, 3, 4, 'b', 'julianaSerena', 'Ao Entrar em 🛡️: se for sua única Defesa, não pode ser movida por efeitos adversários até o início do seu próximo turno.', 0, true],
    [38, 'Juliana', 'Guardiã da Prefeitura', 3, 4, 7, 'e', 'moveToDef', 'Ao Entrar: mova outro Personagem seu para 🛡️.'],
    [39, 'Juliana', 'Elfa Esguia', 5, 6, 6, 'm', 'regen3', 'No início do seu turno, Juliana cura 3 de dano.'],
    [40, 'Juliana', 'Dama da Paciência Infinita', 7, 6, 9, 'l', 'julianaDama', 'Se for derrotada como sua última Defesa, recupere ❤️2.'],
    [41, 'Tainan', 'o Silencioso', 2, 5, 4, 'b', 'immovable', '🛡️ Não pode ser movido por efeitos adversários.'],
    [42, 'Tainan', 'Quebra-Manta', 4, 7, 4, 'e', 'quebraManta', '⚔️ Quando for desafiado, o contra-ataque dele causa 2 de dano a mais.'],
    [43, 'Taitanos', 'o Equilíbrio do Quintal', 6, 7, 6, 'm', 'taitanos', '⚔️ Depois de vencer um Desafio, você pode mover Tainan para 🛡️.'],
    [44, 'Cacique Tainan', 'o Imóvel', 9, 7, 9, 'l', 'cacique', 'Não pode ser movido nem devolvido à mão por efeitos adversários.'],
    [45, 'Leco', 'o Pedreiro', 3, 5, 5, 'b', 'lecoPedreiro', 'Uma vez por seu turno, depois que um Suporte Imediato seu resolver e for descartado, ganhe ⚡1.'],
    [46, 'Leco', 'Troll da Construção', 6, 7, 6, 'm', 'lecoTroll', '🤝 Uma vez por turno, quando um efeito adversário fosse destruir 1 Suporte seu, você pode pagar ⚡1 para impedir.'],
    [47, 'Leco', 'Deus da Gambiarra', 10, 9, 7, 'l', 'lecoDeus', 'Ao Entrar: recupere do descarte para sua mão 1 Suporte Permanente de custo ⚡3 ou menos. Não pode escolher Gambiarra do Leco.'],
    [48, 'Leco', 'Pequeno Brutamontes', 2, 7, 3, 'e', 'afterDefToDef', '⚔️ Depois de derrotar um Defensor e sobreviver, você pode mover Leco para 🛡️.'],
    [49, 'Adeni', 'a Tranquila', 1, 3, 4, 'b', 'ligeiro', 'Ligeiro: pode atacar assim que entra em campo, mas só ataca Personagens.'],
    [50, 'Adeni', 'Fada da Calmaria', 5, 5, 7, 'm', 'healIfLow', 'Ao Entrar: se estiver com ❤️2 ou menos, recupere ❤️2.'],
    [51, 'Adeni', 'Dama da Paz', 2, 4, 6, 'e', 'regenAll', 'No início do seu turno, Adeni cura todo o dano.'],
    [52, 'Adeni', 'Santa da Paciência', 6, 5, 9, 'l', 'adeniSanta', 'Ao Entrar: recupere ❤️2. Se estava com ❤️1 ou menos, recupere ❤️3 em vez disso.'],
    [53, 'Fred', 'o Observador', 1, 3, 5, 'b', 'ligeiro', 'Ligeiro: pode atacar assim que entra em campo, mas só ataca Personagens.'],
    [54, 'Fred', 'Analista da Família', 4, 4, 7, 'e', 'actDraw', 'Ativável - ⚡1: compre 1 Personagem, respeitando o limite da mão.', 1],
    [55, 'Fred', 'Oráculo dos Detalhes', 7, 6, 6, 'm', 'fredOraculo', 'Ao Entrar: compre 2 Personagens, respeitando o limite da mão.'],
    [56, 'Fred', 'Mestre das Estratégias', 8, 7, 8, 'l', 'cureProtect', 'Ao Entrar: escolha outro Personagem seu: cure todo o dano dele. Ele não pode ser movido por efeitos adversários até o início do seu próximo turno.'],
    [57, 'Gabriel', 'o Sério', 2, 5, 4, 'b', 'gabrielSerio', 'Ao Entrar: cure todo o dano de 1 Personagem seu.'],
    [58, 'Gabriel', 'Mestre Pedagogo', 4, 4, 7, 'e', 'actCureDef', 'Ativável - ⚡1: cure todo o dano de outro Defensor seu.', 1],
    [59, 'Gabriel', 'Paladino Nervoso', 7, 7, 5, 'm', 'paladino', '⚔️ Em um Desafio, se houver empate, somente o inimigo é derrotado.'],
    [60, 'Gabriel', 'Arcanjo de Pouca Paciência', 10, 9, 7, 'l', 'cureAllHeal1', 'Ao Entrar: cure todo o dano dos seus Personagens e recupere ❤️1.'],
    [61, 'Neia', 'a Durona', 2, 5, 4, 'b', 'neiaDurona', 'Ao Entrar: se o adversário possuir mais Personagens no campo que você, ganhe ⚡1.'],
    [62, 'Neia', 'Xerife Aposentada', 4, 6, 5, 'e', 'lookHand', 'Ao Entrar: olhe a mão do adversário e escolha 1 Suporte dela: ele o descarta.'],
    [63, 'Neia', 'Amazona da Lei', 6, 7, 6, 'm', 'noBounce', 'Não pode ser devolvida à mão por efeitos adversários.'],
    [64, 'Neia', 'Presidenta do Brasil', 8, 8, 8, 'l', 'moveOther', 'Ao Entrar: mova outro Personagem seu entre ⚔️ e 🛡️.'],
    [65, 'Nathalia', 'Fiscal do Apocalipse', 3, 5, 6, 'e', 'nathaliaFiscal', 'Ao Entrar (⚡1): se o adversário tiver 2 Suportes Permanentes, devolva à mão 1 deles de custo ⚡2 ou menos.', 1],
    [66, 'Nathalia', 'Boba da Corte', 4, 7, 3, 'm', 'boba', 'Quando for derrotada, coloque Nathalia no fundo do Baralho de Personagens em vez do descarte.'],
    [67, 'Nathalia', 'Bruxa da Segurança', 9, 7, 9, 'l', 'cureHaste', 'Ao Entrar: escolha 1 Personagem seu: cure todo o dano dele e ele pode atacar neste turno.'],
    [68, 'Nathalia', 'a Técnica', 1, 4, 5, 'b', 'peekEvent', 'Ao Entrar: olhe secretamente o próximo Evento.'],
    [69, 'Luar', 'Europeia', 2, 4, 5, 'b', 'moveOther', 'Ao Entrar: você pode mover outro Personagem seu entre ⚔️ e 🛡️.'],
    [70, 'Luar', 'Técnica Rubro-Negra', 4, 6, 5, 'e', 'afterDefToDef', 'Depois de derrotar um Defensor e sobreviver: você pode mover Luar para 🛡️.', 0, true],
    [71, 'Luar', 'Fada do Luar', 6, 6, 7, 'm', 'luarFada', 'Ao Entrar: você pode mover outro Personagem seu de ⚔️ para 🛡️. Se fizer isso, ele não pode ser movido por efeitos adversários até o início do seu próximo turno.'],
    [72, 'Luar', 'Deusa da Lua', 10, 9, 7, 'l', 'luarDeusa', 'Ao Entrar: mova até 2 outros Personagens seus entre ⚔️ e 🛡️. Cure todo o dano de 1 que foi para 🛡️.'],
  ];

  // [num, nome, custo, tipo, chave, texto]  tipo: imm = Imediato, perm = Permanente, perm1 = Permanente - uso único
  const S = [
    [1, 'Bill, o Fiscal do Portão', 3, 'perm', 'bill', 'Perk (dura 3 turnos seus): no início do seu turno, compre 1 Personagem extra, respeitando o limite da mão.'],
    [2, 'Fifinha: Quem Perder Passa o Controle', 4, 'imm', 'fifinha', 'Compre 2 Personagens, respeitando o limite da mão. Depois descarte esta carta.'],
    [3, 'Cafezinho Ressuscita-Defunto', 1, 'imm', 'cafezinho', 'Ganhe ⚡2. Depois descarte esta carta.'],
    [4, 'Água Gelada pra Pensar Melhor', 3, 'imm', 'agua', 'Procure no seu baralho 1 Personagem de custo ⚡3 ou menos e coloque-o na sua mão, respeitando o limite da mão. Depois embaralhe o baralho e descarte esta carta.'],
    [5, 'Sofá do "Só Mais 5 Minutinhos"', 3, 'perm', 'sofa', 'Perk (dura 3 turnos seus): seus Defensores sofrem 2 de dano a menos em cada ataque (mínimo 1).'],
    [6, 'PF Reforçado da Dona Neia', 1, 'imm', 'pf', 'Recupere ❤️1 e cure todo o dano de 1 Personagem seu. Depois descarte esta carta.'],
    [7, 'Caixa de Ferramentas do "Eu Resolvo"', 1, 'imm', 'caixa', 'Recupere do descarte para sua mão 1 Suporte Permanente de custo ⚡3 ou menos. Depois descarte esta carta.'],
    [8, 'Grupo da Família Sem Privacidade', 2, 'imm', 'grupo', 'Olhe a mão do adversário e escolha 1 carta dela: ela é descartada. Depois descarte esta carta.'],
    [9, 'Bola: Quem Perder Paga a Coca', 2, 'imm', 'bola', 'Escolha 1 Personagem seu em ⚔️: ele ganha Ligeiro e +3 de ataque neste turno. Se derrotar um Personagem, compre 1 Personagem. Depois descarte esta carta.'],
    [10, 'Van do Bruno — Cabe Mais Um!', 3, 'imm', 'van', 'Mova até 2 Personagens seus para qualquer área; eles ganham Ligeiro neste turno. Depois descarte esta carta.'],
    [11, 'Jardim Milagroso da Dolores', 2, 'perm', 'jardim', 'Perk (dura 3 turnos seus): no fim do seu turno, cada Personagem seu em 🤝 Apoio ou 🛡️ Defesa cura 3 de dano.'],
    [12, 'Gambiarra do Leco — Agora Aguenta!', 5, 'perm1', 'gambiarra', 'Quando um Personagem seu fosse derrotado em combate, descarte esta carta: ele fica com 1 de vida e continua em campo.'],
    [13, 'Cristal do Gato de Luz', 2, 'perm', 'cristal', 'Perk (dura 3 turnos seus): no início do seu turno, cada Personagem seu cura 2 de dano.'],
    [14, 'Pé de Benção da Vó', 1, 'perm1', 'pe', 'Quando um Personagem adversário atacar o seu herói, descarte esta carta: o ataque é cancelado.'],
    [15, 'Espelho do "Faz Igual!"', 3, 'imm', 'espelho', 'Escolha 1 Personagem seu em campo de custo original ⚡5 ou menos: copie o efeito Ao Entrar dele. Depois descarte esta carta.'],
    [16, 'Garrafada de Procedência Duvidosa', 3, 'imm', 'garrafada', 'Recupere ❤️3 e cure todo o dano dos seus Personagens. Depois descarte esta carta.'],
    [17, 'Porta dos Fundos Dimensional', 1, 'imm', 'porta', 'Devolva 1 Personagem seu do campo para a sua mão, curado. Neste turno ele custa ⚡2 a menos para ser jogado. Depois descarte esta carta.'],
    [18, 'Manual Oficial do "Não Valeu!"', 3, 'perm1', 'naovaleu', 'Quando um Personagem adversário fosse resolver um efeito Ao Entrar, descarte esta carta para cancelar aquele efeito e compre 1 Personagem.'],
    [19, 'Casa da Vó — Aqui Ninguém Morre', 3, 'perm1', 'casa', 'Quando o seu herói fosse a 0 de vida, descarte esta carta: ele fica com ❤️1.'],
    [20, 'Churrasco do "Chega Mais Um!"', 6, 'imm', 'churrasco', 'Compre até 3 Personagens, respeitando o limite da mão. Depois descarte esta carta.'],
    [21, 'Rinha... Quer Dizer, Arena dos Galos', 4, 'perm1', 'arena', 'Quando um Personagem seu em ⚔️ fosse derrotado em combate, descarte esta carta para devolvê-lo à sua mão em vez do descarte.'],
    [22, 'Poltrona do Chefe da Família', 5, 'imm', 'poltrona', 'Escolha 1: cure todo o dano dos seus Personagens e recupere ❤️2; ou compre até 2 Personagens, respeitando o limite da mão. Depois descarte esta carta.'],
    [23, 'Gambiarra 220V no 110V', 2, 'imm', 'g220', 'Escolha 1 Personagem da sua mão e jogue-o agora pagando ⚡2 a menos (mínimo ⚡1); ele ganha Ligeiro neste turno. Depois descarte esta carta.'],
    [24, 'Táxi do Rogerinho — Corrida pra Outra Dimensão', 4, 'imm', 'taxi', 'Troque 1 Personagem seu no campo por 1 Personagem da sua mão. O novo Personagem custa ⚡1 a menos, resolve Ao Entrar normalmente e não pode atacar neste turno. Depois descarte esta carta.'],
    [25, 'Torcida Organizada no Grito', 3, 'perm', 'torcida', 'Perk (dura 3 turnos seus): todos os ataques dos seus Personagens causam +1 de dano.'],
    [26, 'Boleto Vencido: Quem Paga é Você', 3, 'perm', 'boleto', 'Perk (dura 3 turnos seus): ataques dos seus Personagens ao herói inimigo causam +2 de dano.'],
    [27, 'Fofoca do Churrasco', 4, 'perm', 'fofoca', 'Perk (dura 3 turnos seus): sempre que um Personagem seu for derrotado em combate, compre 1 Personagem.'],
    [28, 'Fiscal da Cerveja Gelada', 5, 'perm', 'fiscal', 'Perk (dura 3 turnos seus): sempre que um Personagem seu derrotar outro em combate, o adversário perde ❤️1.'],
    [29, 'Soneca Estratégica na Rede', 3, 'perm', 'soneca', 'Perk (dura 3 turnos seus): no fim do seu turno, se nenhum Personagem seu atacou, recupere ❤️2.'],
  ];

  // [num, nome, tipo, chave, texto]  tipo: imm = Imediato (ao revelar), cont = Contínuo
  const E = [
    [1, 'Hoje Tem Flamengo!', 'imm', 'flamengo', 'Ao revelar: cada jogador que possuir pelo menos 1 Personagem 🔴⚫ Flamengo na mão compra 1 Personagem, respeitando o limite da mão.'],
    [2, 'Granizo na Laje', 'imm', 'granizo', 'Ao revelar: todo Personagem em ⚔️ sofre 2 de dano. O dano fica na carta.'],
    [3, 'Acabou a Luz', 'cont', 'semLuz', 'Habilidades Ativáveis custam ⚡1 adicional enquanto este Evento estiver ativo.'],
    [4, 'Churrasco em Família', 'imm', 'churrasco', 'Ao revelar: cada jogador compra 1 Personagem, respeitando o limite da mão.'],
    [5, 'Domingo de Jogo Decisivo', 'cont', 'jogoDecisivo', 'Enquanto estiver ativo, todo Personagem em ⚔️ tem +1 de ataque (dos dois jogadores).'],
    [6, 'Caiu o PIX', 'cont', 'caiuPix', 'No início do turno de cada jogador, ele ganha ⚡1 extra neste turno.'],
    [7, 'O PIX Não Caiu', 'cont', 'naoCaiuPix', 'No início do turno de cada jogador, ele tem ⚡1 a menos neste turno (mínimo ⚡1).'],
    [8, 'Domingo na Praia', 'cont', 'praia', 'Suportes custam ⚡1 a menos. O custo mínimo continua ⚡1 e descontos não se acumulam.'],
    [9, 'Bill Solto', 'cont', 'billSolto', 'Ao revelar: cada jogador que possuir pelo menos 2 Defensores devolve à mão o seu Defensor de menor 🛡️.'],
    [10, 'Almoço de Domingo', 'cont', 'almoco', 'Enquanto este Evento estiver ativo, nenhum jogador pode atacar a ❤️ Vida do adversário. Personagens podem atacar normalmente outros Personagens.'],
    [12, 'Sono Depois do Almoço', 'cont', 'sono', 'Enquanto estiver ativo, todo Personagem entra em campo Atordoado (menos os Ligeiros).'],
    [13, 'Fila do Churrasco', 'imm', 'filaChurrasco', 'Ao revelar: o jogador com menos Personagens em campo compra 1 Personagem, respeitando o limite da mão. Em caso de empate, ninguém compra.'],
    [14, 'Discussão Generalizada', 'cont', 'discussao', 'Enquanto estiver ativo, nenhum jogador pode recuperar ❤️.'],
    [15, 'Noite Tranquila', 'cont', 'noite', 'No início do turno de cada jogador, cada Personagem dele cura 2 de dano.'],
    [16, 'Alvoroço', 'cont', 'alvoroco', 'Enquanto estiver ativo, todo Personagem pode atacar assim que entra em campo, mas só ataca Personagens.'],
    [17, 'Vô Deu Bronca!', 'cont', 'bronca', 'Ao revelar: cada jogador escolhe 1 Personagem adversário em ⚔️ e move-o para 🛡️, se houver espaço.'],
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
      fx, text, ecost: ecost || 0, flamengo: !!fla, updated: UPD.has(n), img: abs('assets/cards/personagens/' + pad(n) + '.webp?v=88'),
      activatable: /^act/.test(fx),
    };
  });
  // Perks: Suportes Permanentes com duração (em turnos do dono)
  const DUR = { bill: 3, sofa: 3, jardim: 3, cristal: 3, torcida: 3, boleto: 3, fofoca: 3, fiscal: 3, soneca: 3 };
  S.forEach(([n, name, cost, kind, fx, text]) => {
    CARDS['s' + pad(n)] = {
      dur: DUR[fx] || 0,
      id: 's' + pad(n), type: 'sup', name, title: kind === 'imm' ? 'Imediato' : kind === 'perm' ? (DUR[fx] ? 'Perk' : 'Permanente') : 'Permanente - uso único',
      cost, kind, fx, text, img: abs('assets/cards/suportes/' + pad(n) + '.webp?v=88'),
    };
  });
  E.forEach(([n, name, kind, fx, text]) => {
    CARDS['e' + pad(n)] = {
      id: 'e' + pad(n), type: 'ev', name, title: kind === 'imm' ? 'Evento Imediato' : 'Evento Contínuo',
      kind, fx, text, img: abs('assets/cards/eventos/' + pad(n) + '.webp?v=88'),
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
