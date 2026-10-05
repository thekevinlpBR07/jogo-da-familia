/* Saída de som (alto-falante/fone), microfone e volumes de cada tipo de som.
   Carregado antes dos outros: troca o "new Audio()" por uma versão que já nasce na saída escolhida. */
(function () {
  const G = (window.G = window.G || {});
  const get = (k, d) => { try { const v = localStorage.getItem('jf-' + k); return v == null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem('jf-' + k, String(v)); } catch (e) { /* sem storage */ } };
  const num = (k, d) => { const v = parseFloat(get(k, d)); return isFinite(v) ? Math.min(1, Math.max(0, v)) : d; };
  const O = (G.Out = {
    sink: get('sink', ''),
    mic: get('mic', ''),
    vol: { sfx: num('vol-sfx', 0.8), meme: num('vol-meme', 0.8), voice: num('vol-voice', 1) },
    canSink: typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype,
    curve: (v) => v * v, // 0..1 do controle -> ganho real (o ouvido percebe volume de forma logarítmica)
    onVol: {},
  });
  const live = new Set();
  const NA = window.Audio;
  const apply = (a) => { if (O.sink && a.setSinkId) a.setSinkId(O.sink).catch(() => {}); };
  window.Audio = function (src) {
    const a = src === undefined ? new NA() : new NA(src);
    live.add(new WeakRef(a));
    apply(a);
    return a;
  };
  window.Audio.prototype = NA.prototype;

  O.applyCtx = function (c) { if (c && c.setSinkId) c.setSinkId(O.sink || '').catch(() => {}); };
  O.setSink = function (id) {
    O.sink = id || '';
    put('sink', O.sink);
    live.forEach((r) => { const a = r.deref(); if (!a) live.delete(r); else apply(a); });
    O.applyCtx(G.sfx && G.sfx.ctx && G.sfx.ctx());
  };
  O.setMic = function (id) {
    O.mic = id || '';
    put('mic', O.mic);
    if (G.Voice && G.Voice.micOn) { G.Voice.disableMic(); G.Voice.enableMic(); }
  };
  O.setVol = function (kind, v) {
    O.vol[kind] = Math.min(1, Math.max(0, v));
    put('vol-' + kind, O.vol[kind]);
    if (O.onVol[kind]) O.onVol[kind](O.vol[kind]);
  };
  // lista de dispositivos (os nomes só aparecem depois que o navegador liberou o microfone)
  O.devices = async function () {
    const res = { out: [], mic: [] };
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      all.forEach((d, i) => {
        if (d.kind === 'audiooutput') res.out.push({ id: d.deviceId, label: d.label || 'Saída ' + (res.out.length + 1) });
        if (d.kind === 'audioinput') res.mic.push({ id: d.deviceId, label: d.label || 'Microfone ' + (res.mic.length + 1) });
      });
    } catch (e) { /* sem acesso */ }
    return res;
  };
})();
