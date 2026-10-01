/* Multijogador online via PeerJS (WebRTC ponto a ponto).
   O anfitrião roda o motor e manda para o convidado apenas a visão dele (mão do anfitrião fica escondida). */
(function () {
  const G = window.G;
  const PREFIX = 'jogodafamilia-v1-';
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  // Servidores STUN públicos para furar o NAT (vários, para o caso de algum estar fora do ar).
  // Obs.: sem servidor TURN, em redes muito restritas (algumas empresas/4G) a conexão direta pode falhar.
  const ICE = { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:global.stun.twilio.com:3478' },
  ] };

  const Net = (G.Net = { peer: null, conn: null, role: null });

  function code() {
    let s = '';
    for (let i = 0; i < 4; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    return s;
  }
  function ready() {
    return new Promise((res, rej) => {
      if (window.Peer) return res();
      let n = 0;
      const t = setInterval(() => {
        if (window.Peer) { clearInterval(t); res(); }
        else if (++n > 50) { clearInterval(t); rej(new Error('Não foi possível carregar o módulo online. Verifique a internet.')); }
      }, 100);
    });
  }

  Net.close = function () {
    try { if (Net.conn) Net.conn.close(); } catch (e) { /* ignora */ }
    try { if (Net.peer) Net.peer.destroy(); } catch (e) { /* ignora */ }
    Net.peer = null;
    Net.conn = null;
    Net.role = null;
  };

  Net.send = function (msg) {
    if (Net.conn && Net.conn.open) Net.conn.send(msg);
  };

  function wire(conn, h) {
    Net.conn = conn;
    conn.on('data', (m) => h.onMessage && h.onMessage(m));
    conn.on('close', () => h.onClose && h.onClose());
    conn.on('error', (e) => h.onError && h.onError(e));
  }

  // h: { onCode(code), onConnect(conn), onMessage(msg), onClose(), onError(err) }
  Net.host = async function (h, tries) {
    tries = tries || 0;
    Net.close();
    await ready();
    const c = code();
    const peer = new window.Peer(PREFIX + c, { debug: 1, config: ICE });
    Net.peer = peer;
    Net.role = 'host';
    peer.on('open', () => h.onCode && h.onCode(c));
    peer.on('connection', (conn) => {
      if (Net.conn && Net.conn.open) { conn.on('open', () => { conn.send({ type: 'full' }); setTimeout(() => conn.close(), 300); }); return; }
      conn.on('open', () => { wire(conn, h); h.onConnect && h.onConnect(conn); });
    });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && tries < 5) return Net.host(h, tries + 1);
      h.onError && h.onError(e);
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignora */ } });
  };

  Net.join = async function (roomCode, h) {
    Net.close();
    await ready();
    const peer = new window.Peer({ debug: 1, config: ICE });
    Net.peer = peer;
    Net.role = 'guest';
    let opened = false;
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + roomCode.toUpperCase(), { reliable: true });
      const timer = setTimeout(() => { if (!opened) h.onError && h.onError({ type: 'timeout' }); }, 12000);
      conn.on('open', () => { opened = true; clearTimeout(timer); wire(conn, h); h.onConnect && h.onConnect(conn); });
    });
    peer.on('error', (e) => h.onError && h.onError(e));
  };

  Net.errorText = function (e) {
    const t = e && e.type;
    if (t === 'peer-unavailable' || t === 'timeout') return 'Sala não encontrada. Confira o código (e se o anfitrião ainda está com a sala aberta).';
    if (t === 'network' || t === 'server-error' || t === 'socket-error') return 'Sem conexão com o servidor. Verifique a internet.';
    if (t === 'browser-incompatible') return 'Este navegador não suporta jogo online.';
    return (e && e.message) || 'Erro de conexão.';
  };
})();
