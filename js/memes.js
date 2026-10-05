/* Sons de meme: um "canal" único. Se um som tocar enquanto outro estiver tocando, o anterior é cortado.
   No online o anfitrião decide a ordem: todos ouvem o mesmo som, na mesma ordem. */
(function () {
  const G = window.G;
  const abs = (p) => new URL(p, document.baseURI).href;
  const LIST = [
    ['angustia-brasileira', 'Angústia Brasileira', '😩'], ['brasil', 'BRASIL!', '🇧🇷'], ['conversa-mole', 'Conversa mole', '🙄'],
    ['denise', 'Denise', '📞'], ['em-setembro', 'Em setembro', '🍂'], ['eu-nao-jogo-mais', 'Eu não jogo mais', '🏳️'],
    ['feijao-puro', 'Feijão puro', '🍲'], ['fi-da-peste', 'Fi da peste', '😠'], ['happy-birthday', 'Happy birthday', '🎂'],
    ['infernizam', 'Infernizam', '😈'], ['ja-expliquei', 'Já expliquei', '🗣️'], ['lembre-do-lula', 'Lembre do Lula', '🦐'],
    ['meu-telefone', 'Meu telefone', '☎️'], ['miranha', 'Miranha', '🕷️'], ['nao-vai-dar', 'Não vai dar', '🙅'],
    ['oh-neymar', 'Oh Neymar', '⚽'], ['outro-patamar', 'Outro patamar', '🚀'], ['pia-cheia-de-prato', 'Pia cheia de prato', '🍽️'],
    ['popcorn-and-ice-cream', 'Popcorn and Ice cream', '🍿'], ['que-delicia', 'Que delícia', '😋'], ['risada-kiko', 'Risada do Kiko', '😂'],
    ['todo-mundo-perdeu', 'Todo mundo perdeu', '💀'], ['vai-comer-abobora', 'Vai comer abóbora', '🎃'], ['ze-da-manga', 'Zé da manga', '🥭'],
  ].map(([id, label, emoji]) => ({ id, label, emoji, url: abs('assets/music/memes/' + id + '.mp3') }));

  let cur = null, now = null, muted = false;
  try { muted = localStorage.getItem('jf-memes-muted') === '1'; } catch (e) { /* sem storage */ }

  let el = null, unlocked = false;
  const chan = () => (el || (el = new Audio()));
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    try { const a = chan(); a.muted = true; a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='; const pr = a.play(); const done = () => { a.pause(); a.muted = false; }; if (pr && pr.then) pr.then(done, () => { unlocked = false; a.muted = false; }); else done(); } catch (e) { unlocked = false; }
  };
  ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => document.addEventListener(ev, unlock, { passive: true }));

  const Memes = (G.Memes = {
    list: LIST,
    onChange: null,
    isMuted: () => muted,
    now: () => now,
  });
  const changed = () => { if (Memes.onChange) Memes.onChange(now); };

  Memes.stop = function () {
    if (cur) { cur.onended = null; cur.pause(); cur = null; }
    if (now) { now = null; if (G.Music && G.Music.duck) G.Music.duck(false, 'meme'); changed(); }
  };
  // toca o som `id`, cortando o que estiver tocando; `who` = nome de quem apertou
  Memes.play = function (id, who) {
    const m = LIST.find((x) => x.id === id);
    if (!m || muted) return false;
    if (cur) { cur.onended = null; cur.pause(); cur = null; }
    const a = chan(); // elemento único, destravado por um toque do usuário (celulares bloqueiam áudio vindo da rede)
    a.src = m.url;
    a.volume = 1;
    cur = a;
    now = m;
    if (G.Music && G.Music.duck) G.Music.duck(true, 'meme');
    a.onended = () => { if (cur === a) { cur = null; now = null; if (G.Music && G.Music.duck) G.Music.duck(false, 'meme'); changed(); } };
    a.onerror = a.onended;
    a.play().catch(() => a.onended());
    changed();
    if (G.UI && G.UI.toast && who) G.UI.toast(`${m.emoji} <b>${String(who).replace(/[<>&]/g, '')}</b>: ${m.label}`, '', 2200);
    return true;
  };
  Memes.setMuted = function (v) {
    muted = !!v;
    try { localStorage.setItem('jf-memes-muted', muted ? '1' : '0'); } catch (e) { /* sem storage */ }
    if (muted) Memes.stop();
  };
})();
