/* Navegação, menus, coleção, partida contra a IA e partida online. */
(function () {
  const G = window.G;
  const C = G.CARDS;
  const UI = G.UI;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const FAM = ['Kevin', 'Evilyn', 'Rogerinho', 'Claudineia', 'Dolores', 'Sara', 'Bruno', 'Helso', 'Jones', 'Juliana', 'Tainan', 'Leco', 'Adeni', 'Fred', 'Gabriel', 'Neia', 'Nathalia', 'Luar'];
  const AVATARS = ['p01', 'p05', 'p09', 'p13', 'p17', 'p22', 'p25', 'p29', 'p33', 'p37', 'p41', 'p45', 'p49', 'p53', 'p57', 'p61', 'p68', 'p69'];
  const famOf = (id) => FAM[Math.floor((parseInt(id.slice(1), 10) - 1) / 4)];

  const store = {
    get(k, d) { try { const v = localStorage.getItem('jf-' + k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('jf-' + k, v); } catch (e) { /* sem storage */ } },
  };
  const myName = () => ($('#player-name').value.trim() || 'Você').slice(0, 16);
  let myAvatar = store.get('avatar', AVATARS[Math.floor(Math.random() * AVATARS.length)]);

  // ================================================================ navegação
  let screen = 'menu';
  let show = function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    screen = id;
    sparks.running = id !== 'game';
    if (id === 'tutorial') G.Tutorial.open();
    if (id === 'collection') renderCollection();
    if (id === 'solo') paintResume();
    if (id === 'game') requestAnimationFrame(() => UI.layout());
  };
  G.show = show;

  // ---- botão Voltar do navegador/celular: fecha janela aberta, volta ao menu ou abre o menu da partida (nunca sai do site sem querer)
  const layersOpen = () => $$('#modal-root .modal-bg').length > 0 || screen !== 'menu';
  const pushGuard = () => { try { if (!(history.state && history.state.g)) history.pushState({ g: 1 }, ''); } catch (e) { } };
  new MutationObserver(() => { if (layersOpen()) pushGuard(); }).observe($('#modal-root'), { childList: true });
  const showBase = show;
  show = function (id) { showBase(id); if (id !== 'menu') pushGuard(); };
  G.show = show;
  window.addEventListener('popstate', () => {
    const m = $$('#modal-root .modal-bg').pop();
    if (m) { if (!m.dataset.pending && m.close) m.close(); }
    else if (screen === 'game') { const b = $('#btn-menu'); if (b && b.offsetParent) b.click(); else $('#btn-menu2') && $('#btn-menu2').click(); }
    else if (screen !== 'menu') { if (screen === 'online') { G.Net.close(); resetHostBox(); } showBase('menu'); }
    if (layersOpen()) pushGuard();
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    G.sfx('click');
    if (b.dataset.go === 'menu') { G.Net.close(); resetHostBox(); }
    show(b.dataset.go);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const m = $$('#modal-root .modal-bg').pop();
      if (m && !m.dataset.pending && m.close) m.close();
    }
  });

  // ================================================================ menu
  function buildFan() {
    const ids = ['p23', 'p12', 'p72', 'p04', 'p56'];
    const n = ids.length;
    $('#hero-fan').innerHTML = ids.map((id, i) => {
      const r = (i - (n - 1) / 2) * 11;
      const x = (i - (n - 1) / 2) * 34;
      // começa como verso de carta; a arte entra quando a imagem terminar de carregar (com 2 novas tentativas)
      return `<div class="fc back-art" data-id="${id}" style="transform:translateX(calc(-50% + ${x}%)) rotate(${r}deg);animation-delay:${i * 0.08}s, ${i * 0.4}s;z-index:${10 - Math.abs(i - 2)}"></div>`;
    }).join('');
    $$('#hero-fan .fc').forEach((el) => {
      let tries = 0;
      const load = () => {
        const im = new Image();
        im.onload = () => { el.style.backgroundImage = `url(${im.src})`; el.classList.remove('back-art'); };
        im.onerror = () => { if (tries++ < 2) setTimeout(load, 1500 * tries); };
        im.src = C[el.dataset.id].img + (tries ? '?t=' + tries : '');
      };
      load();
    });
  }
  function paintAvatar() {
    $('#my-avatar').style.setProperty('--img', `url(${C[myAvatar].img})`);
  }
  $('#my-avatar').onclick = () => {
    const m = UI.modal(`<h3>Escolha seu avatar</h3><p class="sub">Quem da família é você?</p><div class="avatar-grid">${AVATARS.map((id) => `<button data-a="${id}" class="${id === myAvatar ? 'on' : ''}"><span class="avatar" style="--img:url(${C[id].img})"></span>${famOf(id)}</button>`).join('')}</div>`);
    $$('[data-a]', m).forEach((b) => {
      b.onclick = () => {
        myAvatar = b.dataset.a;
        store.set('avatar', myAvatar);
        if (!$('#player-name').value.trim()) { $('#player-name').value = famOf(myAvatar); store.set('name', famOf(myAvatar)); }
        paintAvatar();
        G.sfx('select');
        m.close();
      };
    });
  };
  $('#player-name').value = store.get('name', '');
  $('#player-name').addEventListener('input', (e) => store.set('name', e.target.value.trim()));
  $('#btn-rules').onclick = () => UI.rules();
  const soundLabel = () => { $('#btn-sound').textContent = G.sfx.isOn() ? '🔊 Som ligado' : '🔇 Som desligado'; };
  $('#btn-sound').onclick = () => { G.sfx.toggle(); soundLabel(); G.sfx('click'); };
  soundLabel();
  const musicLabel = () => { $('#btn-music').textContent = '🎵 ' + G.Music.label().replace(/^\S+\s/, ''); };
  $('#btn-music').onclick = () => { G.sfx('click'); UI.musicPicker(); };
  UI.onMusicChange = musicLabel;
  UI.bindMusicControls($('#mini-player'));
  $('#btn-music-m').onclick = () => { G.sfx('click'); UI.musicPicker(); };
  $('#btn-meme').onclick = $('#btn-meme-m').onclick = () => { G.sfx('click'); UI.memePanel(); };
  // voz (só online)
  const paintVoice = () => {
    const V = G.Voice;
    $$('.voice-mic').forEach((b) => { b.textContent = V.micOn ? '🎙️' : '🎤'; b.classList.toggle('live', V.micOn); b.title = V.micOn ? 'Microfone ligado (clique para desligar)' : 'Ligar microfone'; });
    $$('.voice-hear').forEach((b) => { b.textContent = V.hearOn ? '🔊' : '🔇'; b.title = V.hearOn ? 'Ouvindo o outro jogador' : 'Voz do outro silenciada'; });
  };
  const micClick = async () => {
    G.sfx('click');
    const ok = await G.Voice.toggleMic();
    if (ok === false && G.Voice.error) UI.toast('🎤 ' + G.Voice.error, 'err', 4500);
    else if (G.Voice.micOn) UI.toast('🎙️ Microfone ligado. Use fones para evitar eco.', '', 2800);
    paintVoice();
  };
  $$('.voice-mic').forEach((b) => { b.onclick = micClick; });
  $$('.voice-hear').forEach((b) => { b.onclick = () => { G.sfx('click'); G.Voice.setHear(!G.Voice.hearOn); paintVoice(); }; });
  G.Voice.onChange = paintVoice;
  UI.micClick = micClick;
  paintVoice();
  G.Music.onState = () => { UI.paintMusicControls(); musicLabel(); };
  musicLabel();
  G.Music.onTrack = (id, t) => { if (G.Music.isPlaying() && screen === 'game') UI.toast(`🎵 ${t.emoji} ${t.name}`, '', 3200); };

  // ================================================================ solo
  let game = null;
  let aiTimer = null;
  // ---- relatório de erros: guarda os últimos erros no aparelho para eu poder corrigir
  const ERR_KEY = 'jf-erros';
  G.logError = (e, ctx, extra) => {
    try {
      const list = JSON.parse(localStorage.getItem(ERR_KEY) || '[]');
      const s = game && game.s;
      list.push({ quando: new Date().toISOString(), onde: ctx, erro: String((e && e.message) || e).slice(0, 200), pilha: String((e && e.stack) || '').split(String.fromCharCode(10)).slice(0, 4).join(' | ').slice(0, 400), turno: s && s.turn, ativo: s && s.active, pendente: s && s.pending ? s.pending.purpose + '/' + s.pending.player : null, evento: s && s.event, extra: extra ? JSON.stringify(extra).slice(0, 200) : undefined, log: s ? s.log.slice(-6).map((l) => l.t) : undefined });
      localStorage.setItem(ERR_KEY, JSON.stringify(list.slice(-15)));
    } catch (x) { /* sem armazenamento */ }
  };
  G.errorReport = () => { try { const l = JSON.parse(localStorage.getItem(ERR_KEY) || '[]'); return l.length ? JSON.stringify(l, null, 1) : ''; } catch (x) { return ''; } };
  window.addEventListener('error', (e) => G.logError(e.error || e.message, 'janela', { arq: (e.filename || '').split('/').pop(), linha: e.lineno }));
  window.addEventListener('unhandledrejection', (e) => G.logError(e.reason, 'promessa'));
  // executa uma ação; se der erro, desfaz a jogada (volta ao estado de antes) em vez de travar a partida
  function safeAct(p, a) {
    const snap = JSON.stringify(game.s);
    try { return G.act(game.s, p, a); }
    catch (e) {
      console.error(e); G.logError(e, 'jogada', { p, a });
      try { game.s = JSON.parse(snap); } catch (x) { /* mantém o estado */ }
      return { ok: false, err: 'Algo deu errado nessa jogada e ela foi desfeita. Tente outra.' };
    }
  }
  const coachToggle = $('#coach-toggle');
  coachToggle.checked = store.get('coach', '1') === '1';
  coachToggle.onchange = () => store.set('coach', coachToggle.checked ? '1' : '0');
  $$('.diff').forEach((b) => { b.onclick = () => G.startSolo(b.dataset.level, coachToggle.checked); });
  $('#btn-resume').onclick = () => G.resumeSolo();

  G.debug = () => game;
  G.startSolo = function (level, coach, prevState) {
    clearTimeout(aiTimer);
    G.Net.close();
    const others = AVATARS.filter((a) => a !== myAvatar);
    const keep = prevState && G.nextGameOpts(prevState).series && game && game.avatars && game.avatars[1]; // na mesma série o adversário é o mesmo
    const aiAvatar = keep || others[Math.floor(Math.random() * others.length)];
    const aiName = famOf(aiAvatar) + (level === 'easy' ? ' 🤖' : level === 'hard' ? ' 🤖🤖🤖' : ' 🤖🤖');
    const s = G.newGame(Object.assign({ names: [myName(), aiName] }, G.nextGameOpts(prevState)));
    const token = {};
    game = { mode: 'ai', level, coach, s, token, avatars: [myAvatar, aiAvatar] };
    G.Coach.enable(coach);
    G.Music.sync.disable();
    document.body.classList.remove('online');
    show('game');
    G.Music.start();
    game.send = (a) => {
      const r = safeAct(0, a);
      if (!r.ok) { UI.toast(r.err, 'err'); G.sfx('error'); return; }
      publish();
    };
    UI.start({
      me: 0, mode: 'ai', avatars: game.avatars,
      send: game.send,
      onExit: exitGame,
      meme: (id) => G.Memes.play(id, myName()),
      onRematch: () => G.startSolo(level, coach, game && game.s),
      emote: (e) => {
        UI.showEmote(e);
        if (Math.random() < 0.6) setTimeout(() => UI.showEmote(['😎', '🤔', '😂', '🙏', '😱'][Math.floor(Math.random() * 5)]), 1300);
      },
    });
    if (s.series && s.series.res.length) UI.toast(`Série: partida ${s.series.res.length + 1} · você ${s.series.w[0]} × ${s.series.w[1]} · ${s.first === 0 ? 'você começa' : aiName + ' começa'}`, '', 3800);
    publish();
  };
  // ---- partida contra o computador fica salva no aparelho: dá para sair e continuar depois
  const SAVE_KEY = 'jf-solo', SAVE_VER = 'v5';
  function saveSolo() {
    try {
      if (!game || game.mode !== 'ai') return;
      if (game.s.winner != null) { localStorage.removeItem(SAVE_KEY); return; }
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ver: SAVE_VER, level: game.level, coach: game.coach, avatars: game.avatars, s: game.s, at: Date.now() }));
    } catch (e) { /* armazenamento indisponível: segue sem salvar */ }
  }
  function readSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!d || d.ver !== SAVE_VER || !d.s || d.s.winner != null) return null;
      return d;
    } catch (e) { return null; }
  }
  function paintResume() {
    const b = $('#btn-resume'), d = readSave();
    if (!b) return;
    b.classList.toggle('hidden', !d);
    if (d) b.innerHTML = `▶ Continuar partida salva <small>(${d.level === 'easy' ? 'Fácil' : d.level === 'hard' ? 'Difícil' : 'Médio'} · turno ${d.s.turn} · você ${d.s.players[0].life} ❤️ × ${d.s.players[1].life})</small>`;
  }
  G.resumeSolo = function () {
    const d = readSave();
    if (!d) { paintResume(); return; }
    clearTimeout(aiTimer);
    G.Net.close();
    const token = {};
    game = { mode: 'ai', level: d.level, coach: d.coach, s: d.s, token, avatars: d.avatars };
    G.Coach.enable(false);
    G.Music.sync.disable();
    document.body.classList.remove('online');
    show('game');
    G.Music.start();
    game.send = (a) => {
      const r = safeAct(0, a);
      if (!r.ok) { UI.toast(r.err, 'err'); G.sfx('error'); return; }
      publish();
    };
    UI.start({
      me: 0, mode: 'ai', avatars: game.avatars,
      send: game.send,
      onExit: exitGame,
      meme: (id) => G.Memes.play(id, myName()),
      onRematch: () => G.startSolo(d.level, d.coach, game && game.s),
      emote: (e) => UI.showEmote(e),
    });
    UI.toast('Partida retomada de onde você parou. 🎮', '', 2600);
    publish();
  };
  function publish() {
    if (!game || game.mode !== 'ai') return;
    saveSolo();
    const token = game.token;
    UI.update(G.viewFor(game.s, 0)).then(() => { if (game && game.token === token) aiTick(); });
  }
  function aiTick() {
    const s = game.s;
    if (s.winner != null) return;
    const needs = s.pending ? s.pending.player === 1 : s.active === 1;
    if (!needs) return;
    clearTimeout(aiTimer);
    const token = game.token;
    aiTimer = setTimeout(() => {
      if (!game || game.token !== token) return;
      const st = game.s;
      let a = null;
      try { a = G.AI.step(st, 1, game.level); }
      catch (e) { console.error(e); G.logError(e, 'IA', { nivel: game.level }); try { a = G.AI.step(st, 1, 'medium'); } catch (e2) { a = null; } }
      if (!a) { a = st.pending ? { t: 'choose', v: G.AI.quick(st, st.pending) } : { t: 'endTurn' }; }
      const r = safeAct(1, a);
      if (!r.ok) {
        console.warn('IA:', r.err, a);
        const cur = game.s;
        if (cur.pending && cur.pending.player === 1) safeAct(1, { t: 'choose', v: G.AI.quick(cur, cur.pending) });
        else if (!cur.pending && cur.active === 1) safeAct(1, { t: 'endTurn' });
      }
      publish();
    }, s.pending ? 700 : 1000);
  }
  function exitGame() {
    clearTimeout(aiTimer);
    G.Music.stop();
    G.Memes.stop();
    G.Voice.reset();
    clearInterval(clk.timer);
    G.Music.sync.disable();
    document.body.classList.remove('online');
    const mp = document.getElementById('meme-panel');
    if (mp) mp.remove();
    game = null;
    G.Coach.enable(false);
    G.Net.close();
    resetHostBox();
    UI.closeModals();
    $('#fx-layer').innerHTML = '';
    show('menu');
  }
  $('#btn-menu').onclick = $('#btn-menu2').onclick = () => UI.gameMenu();
  $('#btn-emote').onclick = $('#btn-emote2').onclick = () => UI.emotePicker();
  $('#btn-log').onclick = () => UI.showLog();

  // ================================================================ online
  const Net = G.Net;
  function resetHostBox() {
    $('#host-box').classList.add('hidden');
    $('#btn-host').disabled = false;
    $('#btn-join').disabled = false;
    $('#join-status').textContent = '';
  }
  function shareLink(code) { return location.href.split('#')[0] + '#sala=' + code; }
  function copy(t) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => UI.toast('Copiado! ✅')).catch(() => { prompt('Copie:', t); });
  }

  // ----- anfitrião
  $('#btn-host').onclick = () => {
    $('#btn-host').disabled = true;
    let code = null;
    Net.host({
      onCode(c) {
        code = c;
        $('#room-code').textContent = c;
        $('#host-box').classList.remove('hidden');
        $('#btn-copy-code').onclick = () => copy(c);
        $('#btn-copy-link').onclick = () => copy(shareLink(c));
        $('#btn-share').onclick = () => {
          const data = { title: 'Jogo da Família', text: `Bora jogar! Código da sala: ${c}`, url: shareLink(c) };
          if (navigator.share) navigator.share(data).catch(() => {}); else copy(shareLink(c));
        };
      },
      onConnect() { UI.toast('Alguém entrou na sala! 🎉'); },
      onMessage(m) { hostMessage(m); },
      onClose() {
        // partida em andamento: espera o outro jogador voltar com o mesmo código (a sala continua aberta)
        if (game && game.mode === 'host' && game.s && game.s.winner == null && !game.waiting) {
          game.waiting = true;
          const m = UI.modal(`<h3>Jogador saiu</h3><p class="sub">A partida está guardada. Se ele voltar com o código <b>${code || ''}</b>, ela continua de onde parou.</p><div class="btns"><button class="btn gold" data-x>Encerrar e voltar ao menu</button></div>`, { dismiss: false });
          m.dataset.pending = '1';
          game.waitModal = m;
          $('[data-x]', m).onclick = () => { m.close(); exitGame(); };
        } else onlineLost('O outro jogador saiu da partida.');
      },
      onError(e) { UI.toast(Net.errorText(e), 'err', 4000); $('#btn-host').disabled = false; },
    }).catch((e) => { UI.toast(e.message, 'err', 4000); $('#btn-host').disabled = false; });
  };
  // relógio do anfitrião (o convidado estima a diferença medindo ping/pong; usa a amostra de menor atraso)
  const clk = { samples: [], off: 0, timer: null };
  const hostNow = () => Date.now() + clk.off;
  function onPong(m) {
    const now = Date.now();
    const rtt = now - m.t0;
    clk.samples.push({ rtt, off: m.th + rtt / 2 - now });
    if (clk.samples.length > 6) clk.samples.shift();
    clk.off = clk.samples.reduce((b, s) => (s.rtt < b.rtt ? s : b)).off;
  }
  function hostMessage(m) {
    if (m.type === 'hello' && game && game.mode === 'host' && game.s && game.waiting) {
      game.waiting = false;
      if (game.waitModal) { game.waitModal.close(); game.waitModal = null; }
      game.guest = { name: String(m.name || game.guest.name).slice(0, 16), avatar: C[m.avatar] ? m.avatar : game.guest.avatar };
      UI.toast(`${game.guest.name} voltou para a partida! 🎉`);
      G.Music.sync.resend();
      hostBroadcast();
    } else if (m.type === 'hello') { game = { mode: 'host', guest: { name: String(m.name || 'Convidado').slice(0, 16), avatar: C[m.avatar] ? m.avatar : 'p05' } }; hostNewGame(); }
    else if (m.type === 'act' && game && game.s) {
      const r = safeAct(1, m.a);
      if (!r.ok) Net.send({ type: 'err', msg: r.err });
      hostBroadcast();
    } else if (m.type === 'emote') UI.showEmote(m.e, game && game.guest.name);
    else if (m.type === 'rematch' && game) hostNewGame();
    else if (m.type === 'ping') Net.send({ type: 'pong', t0: m.t0, th: Date.now() });
    else if (m.type === 'musicCmd') G.Music.sync.receive(m);
    else if (m.type === 'meme' && game) {
      // o anfitrião define a ordem: toca aqui e manda de volta para o convidado tocar também
      const who = game.guest.name;
      G.Memes.play(String(m.id), who);
      Net.send({ type: 'meme', id: String(m.id), who });
    }
  }
  function hostNewGame() {
    const s = G.newGame(Object.assign({ names: [myName(), game.guest.name] }, G.nextGameOpts(game.s)));
    game.s = s;
    game.id = Math.random().toString(36).slice(2);
    game.avatars = [myAvatar, game.guest.avatar];
    G.Coach.enable(false);
    document.body.classList.add('online');
    G.Voice.attach();
    G.Music.sync.enable('host', (x) => Net.send(x), () => Date.now());
    show('game');
    G.Music.start();
    G.Music.sync.resend();
    UI.start({
      me: 0, mode: 'online', avatars: game.avatars,
      send: (a) => {
        const r = safeAct(0, a);
        if (!r.ok) { UI.toast(r.err, 'err'); G.sfx('error'); return; }
        hostBroadcast();
      },
      onExit: exitGame,
      onRematch: hostNewGame,
      meme: (id) => { G.Memes.play(id, myName()); Net.send({ type: 'meme', id, who: myName() }); },
      emote: (e) => { UI.showEmote(e); Net.send({ type: 'emote', e }); },
    });
    hostBroadcast();
  }
  function hostBroadcast() {
    Net.send({ type: 'state', id: game.id, avatars: game.avatars, v: G.viewFor(game.s, 1) });
    UI.update(G.viewFor(game.s, 0));
  }

  // ----- convidado
  $('#btn-join').onclick = () => joinRoom($('#join-code').value);
  $('#join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(e.target.value); });
  $('#join-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
  function joinRoom(code) {
    code = (code || '').trim().toUpperCase();
    if (code.length !== 4) { UI.toast('O código tem 4 letras.', 'err'); return; }
    $('#btn-join').disabled = true;
    $('#join-status').textContent = '🔌 Conectando…';
    Net.join(code, {
      onConnect() {
        $('#join-status').textContent = '✅ Conectado! Começando a partida…';
        Net.send({ type: 'hello', name: myName(), avatar: myAvatar });
      },
      onMessage(m) { guestMessage(m); },
      onClose() { onlineLost('A conexão com o anfitrião caiu.'); },
      onError(e) { $('#join-status').textContent = '❌ ' + Net.errorText(e); $('#btn-join').disabled = false; },
    }).catch((e) => { $('#join-status').textContent = '❌ ' + e.message; $('#btn-join').disabled = false; });
  }
  function guestMessage(m) {
    if (m.type === 'full') { UI.toast('Essa sala já está cheia.', 'err'); return; }
    if (m.type === 'err') { UI.toast(m.msg, 'err'); G.sfx('error'); return; }
    if (m.type === 'emote') { UI.showEmote(m.e); return; }
    if (m.type === 'pong') { onPong(m); return; }
    if (m.type === 'music') { G.Music.sync.receive(m); return; }
    if (m.type === 'meme') { G.Memes.play(String(m.id), m.who || ''); return; }
    if (m.type === 'state') {
      if (!game || game.mode !== 'guest' || game.id !== m.id) {
        game = { mode: 'guest', id: m.id, avatars: m.avatars };
        G.Coach.enable(false);
        document.body.classList.add('online');
        G.Voice.attach();
        clk.samples = []; clk.off = 0;
        clearInterval(clk.timer);
        Net.send({ type: 'ping', t0: Date.now() });
        clk.timer = setInterval(() => Net.send({ type: 'ping', t0: Date.now() }), 3000);
        G.Music.sync.enable('guest', (x) => Net.send(x), hostNow);
        show('game');
        G.Music.start();
        UI.start({
          me: 1, mode: 'online', avatars: m.avatars,
          send: (a) => Net.send({ type: 'act', a }),
          onExit: exitGame,
          onRematch: () => Net.send({ type: 'rematch' }),
          meme: (id) => Net.send({ type: 'meme', id }),
          emote: (e) => { UI.showEmote(e); Net.send({ type: 'emote', e }); },
        });
      }
      UI.update(m.v);
    }
  }
  function onlineLost(msg) {
    if (!game || (game.mode !== 'host' && game.mode !== 'guest')) { resetHostBox(); return; }
    const m = UI.modal(`<h3>Conexão encerrada</h3><p class="sub">${msg}</p><div class="btns"><button class="btn gold" data-x>Voltar ao menu</button></div>`, { dismiss: false });
    $('[data-x]', m).onclick = () => { m.close(); exitGame(); };
  }

  // ================================================================ coleção
  let colType = 'char';
  let colFam = null;
  $$('#col-tabs .tab').forEach((t) => {
    t.onclick = () => {
      $$('#col-tabs .tab').forEach((x) => x.classList.toggle('active', x === t));
      colType = t.dataset.t;
      colFam = null;
      renderCollection();
    };
  });
  $('#col-search').addEventListener('input', () => renderCollection());
  function renderCollection() {
    const q = $('#col-search').value.trim().toLowerCase();
    const chips = $('#col-chips');
    if (colType === 'char') {
      chips.innerHTML = `<button class="chip ${!colFam ? 'on' : ''}" data-f="">Todos</button>` + FAM.map((f) => `<button class="chip ${colFam === f ? 'on' : ''}" data-f="${f}">${f}</button>`).join('');
      $$('.chip', chips).forEach((c) => { c.onclick = () => { colFam = c.dataset.f || null; renderCollection(); }; });
    } else chips.innerHTML = '';
    const list = Object.values(C).filter((d) => d.type === colType)
      .filter((d) => !colFam || famOf(d.id) === colFam)
      .filter((d) => !q || (d.name + ' ' + d.title + ' ' + d.text).toLowerCase().includes(q));
    if (colType === 'char') list.sort((a, b) => (famOf(a.id) === famOf(b.id) ? a.cost - b.cost : a.id < b.id ? -1 : 1));
    $('#col-grid').innerHTML = list.map((d, i) => `<button class="col-card" data-id="${d.id}" title="${G.fullName(d)}" style="background-image:url(${d.img});animation-delay:${Math.min(i, 30) * 0.015}s"></button>`).join('') || '<p style="color:var(--muted)">Nenhuma carta encontrada.</p>';
    $$('#col-grid .col-card').forEach((b) => { b.onclick = () => UI.zoom(b.dataset.id); });
  }

  // ================================================================ tutorial
  $('#tut-next').onclick = () => G.Tutorial.next();
  $('#tut-prev').onclick = () => G.Tutorial.prev();

  // ================================================================ partículas douradas do fundo
  const sparks = { running: true };
  (function () {
    const cv = $('#sparks');
    const ctx = cv.getContext('2d');
    let W, H, parts = [];
    function size() {
      W = cv.width = innerWidth * devicePixelRatio;
      H = cv.height = innerHeight * devicePixelRatio;
      parts = Array.from({ length: Math.round(Math.min(70, innerWidth / 18)) }, spawn);
    }
    function spawn() {
      return { x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.8 + 0.6) * devicePixelRatio, vy: (Math.random() * 0.35 + 0.1) * devicePixelRatio, vx: (Math.random() - 0.5) * 0.2, a: Math.random() * Math.PI * 2 };
    }
    function tick() {
      requestAnimationFrame(tick);
      if (!sparks.running) { ctx.clearRect(0, 0, W, H); return; }
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.y -= p.vy; p.x += p.vx + Math.sin(p.a += 0.01) * 0.2;
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        const g = 0.35 + Math.sin(p.a * 3) * 0.25;
        ctx.beginPath();
        ctx.fillStyle = `rgba(240, 204, 117, ${g})`;
        ctx.shadowColor = '#f0cc75';
        ctx.shadowBlur = 8 * devicePixelRatio;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    addEventListener('resize', size);
    size();
    tick();
  })();

  // ================================================================ início
  buildFan();
  paintAvatar();
  const m = location.hash.match(/sala=([A-Za-z]{4})/);
  if (m) { show('online'); $('#join-code').value = m[1].toUpperCase(); }
  // pré-carrega imagens das cartas em segundo plano
  setTimeout(() => Object.values(C).forEach((d, i) => setTimeout(() => { const im = new Image(); im.src = d.img; }, i * 25)), 1500);
})();
