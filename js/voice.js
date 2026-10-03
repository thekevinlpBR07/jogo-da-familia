/* Conversa por voz entre os dois jogadores (WebRTC via PeerJS), só no modo online.
   Cada um liga o próprio microfone; quem liga "liga" para o outro e o outro já ouve automaticamente.
   Precisa de HTTPS (ou localhost) para o navegador liberar o microfone. */
(function () {
  const G = window.G;
  const V = (G.Voice = { micOn: false, hearOn: true, error: '', onChange: null });
  let stream = null, outCall = null, inAudio = null, attached = null;
  const meters = {}; // medidores de volume (quem está falando)
  let meterTimer = null;
  const speaking = { me: false, other: false };
  let lastSpeech = -1e9, voiceDuck = false;

  const changed = () => { if (V.onChange) V.onChange(); };
  const peer = () => G.Net && G.Net.peer;
  const remoteId = () => G.Net && G.Net.conn && G.Net.conn.peer;

  // ---------- indicador de "falando" (anel verde na placa do jogador)
  function meter(key, s) {
    stopMeter(key);
    try {
      const ctx = G.sfx.ctx();
      const src = ctx.createMediaStreamSource(s);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      meters[key] = { an, src, buf: new Uint8Array(an.fftSize) };
    } catch (e) { /* sem medidor */ }
    if (!meterTimer) meterTimer = setInterval(poll, 150);
  }
  function stopMeter(key) {
    const m = meters[key];
    if (m) { try { m.src.disconnect(); } catch (e) { /* ignora */ } delete meters[key]; }
    speaking[key] = false;
    paint();
  }
  function poll() {
    Object.entries(meters).forEach(([key, m]) => {
      m.an.getByteTimeDomainData(m.buf);
      let peak = 0;
      for (let i = 0; i < m.buf.length; i++) peak = Math.max(peak, Math.abs(m.buf[i] - 128));
      speaking[key] = peak > 9;
    });
    // conversando? a música fica baixinha e volta ~1,5 s depois que todos calam
    const now = performance.now();
    if (speaking.me || speaking.other) lastSpeech = now;
    const talking = now - lastSpeech < 1500;
    if (talking !== voiceDuck) { voiceDuck = talking; if (G.Music && G.Music.duck) G.Music.duck(talking, 'voice'); }
    paint();
  }
  function paint() {
    const v = G.UI && G.UI.view && G.UI.view();
    if (!v) return;
    [['me', v.me], ['other', 1 - v.me]].forEach(([key, p]) => {
      document.querySelectorAll(`.plate[data-plate="${p}"]`).forEach((el) => el.classList.toggle('speaking', !!speaking[key]));
    });
  }

  // ---------- receber voz
  function play(s) {
    if (!inAudio) { inAudio = new Audio(); inAudio.autoplay = true; }
    inAudio.srcObject = s;
    inAudio.muted = !V.hearOn;
    inAudio.play().catch(() => {});
    meter('other', s);
    changed();
  }
  V.attach = function () {
    const p = peer();
    if (!p || attached === p) return;
    attached = p;
    p.on('call', (call) => {
      call.answer(); // só escuta; o microfone próprio vai numa ligação separada
      call.on('stream', play);
      call.on('close', () => { stopMeter('other'); changed(); });
    });
  };

  // ---------- microfone próprio
  V.enableMic = async function (customStream) {
    V.error = '';
    if (!peer() || !remoteId()) { V.error = 'Entre numa partida online primeiro.'; changed(); return false; }
    try {
      if (customStream) stream = customStream;
      else {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('secure');
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      }
    } catch (e) {
      V.error = e && e.message === 'secure' ? 'O microfone só funciona em site com HTTPS (cadeado).'
        : e && e.name === 'NotAllowedError' ? 'Permissão do microfone negada. Libere no cadeado ao lado do endereço.'
        : e && e.name === 'NotFoundError' ? 'Nenhum microfone encontrado.' : 'Não foi possível abrir o microfone.';
      changed();
      return false;
    }
    outCall = peer().call(remoteId(), stream);
    outCall.on('close', () => { if (V.micOn) V.disableMic(); });
    V.micOn = true;
    meter('me', stream);
    changed();
    return true;
  };
  V.disableMic = function () {
    if (outCall) { try { outCall.close(); } catch (e) { /* ignora */ } outCall = null; }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    stopMeter('me');
    V.micOn = false;
    changed();
  };
  V.toggleMic = function () { return V.micOn ? (V.disableMic(), true) : V.enableMic(); };
  V.setHear = function (on) {
    V.hearOn = !!on;
    if (inAudio) inAudio.muted = !V.hearOn;
    changed();
  };
  V.reset = function () {
    V.disableMic();
    if (inAudio) { inAudio.pause(); inAudio.srcObject = null; inAudio = null; }
    stopMeter('other');
    clearInterval(meterTimer);
    meterTimer = null;
    if (voiceDuck) { voiceDuck = false; if (G.Music && G.Music.duck) G.Music.duck(false, 'voice'); }
    attached = null;
    changed();
  };
})();
