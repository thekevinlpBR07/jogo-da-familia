/* Interface do jogo: renderização do tabuleiro, interação, animações e modais. */
(function () {
  const G = window.G;
  const C = G.CARDS;
  const UI = (G.UI = {});
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const isTouch = matchMedia('(hover: none)').matches;

  let V = null;
  let me = 0;
  let ctl = {};
  let sel = null;
  let lastFx = 0;
  let lastLog = 0;
  let chain = Promise.resolve();
  let animating = false;
  let pendingKey = null;
  let endShown = false;

  // ================================================================ helpers visuais
  UI.toast = function (msg, cls, ms, root) {
    const t = document.createElement('div');
    t.className = 'toast ' + (cls || '');
    t.innerHTML = msg;
    $(root || '#toast-root').appendChild(t);
    const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
    if (ms !== 0) setTimeout(kill, ms || 2600);
    t.kill = kill;
    return t;
  };
  UI.modal = function (html, o) {
    o = o || {};
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal glass ${o.cls || ''}">${html}</div>`;
    $('#modal-root').appendChild(bg);
    const close = () => { bg.remove(); if (o.onClose) o.onClose(); };
    if (o.dismiss !== false) bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
    bg.close = close;
    return bg;
  };
  UI.closeModals = () => $$('#modal-root .modal-bg').forEach((m) => m.remove());

  UI.zoom = function (id, inst) {
    const d = C[id];
    if (!d) return;
    const status = [];
    if (inst) {
      if (inst.stunned) status.push('💫 Atordoado');
      if (inst.protStun) status.push('🛡️ Não pode ser Atordoado até o próximo turno do dono');
      if (inst.protMove) status.push('🔒 Não pode ser movido por efeitos adversários');
      if (V && inst.enteredT === V.turn && inst.canAtkT !== V.turn) status.push('💤 Recém-jogado: ainda não pode atacar');
    }
    const kv = d.type === 'char'
      ? `<span>⚡ ${d.cost}</span><span>⚔️ ${d.atk}</span><span>🛡️ ${d.def}</span><span class="rar-${d.rarity}">★ ${d.rarityName}</span>${d.ecost ? `<span>Custo do efeito ⚡${d.ecost}</span>` : ''}${d.flamengo ? '<span>🔴⚫ Flamengo</span>' : ''}${d.updated ? '<span title="A imagem impressa ainda mostra o texto antigo">🔄 Texto atualizado</span>' : ''}`
      : d.type === 'sup' ? `<span>⚡ ${d.cost}</span><span>${d.title}</span>` : `<span>${d.title}</span>`;
    UI.modal(`<div class="zoom-wrap">
      <div class="zoom-card" style="background-image:url(${d.img})"></div>
      <div class="zoom-info">
        <h3>${esc(d.name)}</h3><div class="ttl">${d.type === 'char' ? esc(d.title) : d.type === 'sup' ? 'Suporte' : 'Evento'}</div>
        <div class="kv">${kv}</div>
        <div class="txt">${esc(d.text)}</div>
        ${status.length ? `<div class="status">${status.join('<br>')}</div>` : ''}
        <div class="btns" style="margin-top:16px;justify-content:flex-start">${G.themeOf && G.themeOf(id) ? `<button class="btn small gold" data-theme>▶ Ouvir tema de ${esc(G.themeOf(id).name)}</button>` : ''}<button class="btn small" data-x>Fechar</button></div>
      </div></div>`, { cls: 'zoom' });
    const zm = $('#modal-root .modal-bg:last-child');
    $('[data-x]', zm).onclick = () => zm.close();
    const tb = $('[data-theme]', zm);
    if (tb) {
      const th = G.themeOf(id);
      let a = null;
      const stop = () => { if (a) { a.pause(); a = null; } tb.textContent = '▶ Ouvir tema de ' + th.name; };
      tb.onclick = () => {
        if (a) return stop();
        a = new Audio(th.url);
        a.volume = Math.min(1, G.Music.vol);
        a.play().catch(() => {});
        a.onended = stop;
        tb.textContent = '⏹ Parar tema';
      };
      zm.close = ((orig) => () => { stop(); orig(); })(zm.close);
    }
  };

  // pré-visualização ao passar o mouse (desktop)
  let pvTimer = null;
  function bindPreview(el, id) {
    if (isTouch) return;
    el.addEventListener('mouseenter', () => {
      clearTimeout(pvTimer);
      pvTimer = setTimeout(() => {
        const pv = $('#preview');
        const r = el.getBoundingClientRect();
        const w = Math.min(255, innerHeight * 0.62 / 1.4);
        pv.style.width = w + 'px';
        const side = $('.g-side');
        let left;
        if (side && side.offsetParent && document.getElementById('game').classList.contains('active')) left = Math.max(8, (side.offsetWidth - w) / 2);
        else left = r.left + r.width / 2 < innerWidth / 2 ? Math.min(innerWidth - w - 16, r.right + 16) : Math.max(16, r.left - w - 16);
        pv.style.left = left + 'px';
        pv.style.top = Math.max(12, Math.min(innerHeight - w * 1.4 - 12, r.top + r.height / 2 - w * 0.7)) + 'px';
        pv.style.backgroundImage = `url(${C[id].img})`;
        pv.classList.add('on');
      }, 380);
    });
    el.addEventListener('mouseleave', hidePreview);
  }
  function hidePreview() { clearTimeout(pvTimer); $('#preview').classList.remove('on'); }
  // toque longo / botão direito = ampliar
  function bindZoom(el, id, inst) {
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); hidePreview(); UI.zoom(id, inst); });
    let t = null;
    el.addEventListener('touchstart', () => { t = setTimeout(() => { el.dataset.lp = '1'; UI.zoom(id, inst); }, 450); }, { passive: true });
    const cancel = () => clearTimeout(t);
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchmove', cancel, { passive: true });
  }
  function longPressed(el) {
    if (el.dataset.lp) { delete el.dataset.lp; return true; }
    return false;
  }

  function avatarStyle(id) { return `--img:url(${C[id] ? C[id].img : ''})`; }

  // ================================================================ tamanho das cartas
  function layout() {
    const board = $('#board');
    if (!board || !board.offsetParent) return;
    const W = board.clientWidth - 12;
    const H = board.clientHeight;
    const mobile = getComputedStyle($('.m-top')).display !== 'none';
    const gap = W < 520 ? 5 : 8;
    const extra = mobile ? $('.m-top').offsetHeight + $('.m-bottom').offsetHeight + 10 : 0;
    const fixed = extra + (mobile ? 20 : 34) + (mobile ? 44 : 54) + gap * 10 + 12;
    let cw = (H - fixed) / (5.6 + 1.22 * 1.4 * 0.74);
    cw = Math.min(cw, (W - gap * 9) / 5, 150);
    cw = Math.max(cw, 44);
    const root = document.documentElement.style;
    root.setProperty('--cw', cw.toFixed(1) + 'px');
    root.setProperty('--gap', gap + 'px');
    // a mão usa todo o espaço vertical que sobrar
    const used = ['.m-top', '#opp-hand', '#field-1', '#midline', '#field-0', '.m-bottom']
      .map((q) => { const el = $(q, board); return el && el.offsetParent ? el.offsetHeight : 0; })
      .reduce((a, b) => a + b, 0);
    const avail = H - used - 10;
    const hw = Math.max(cw, Math.min(avail / 1.4 / 0.86, W / (mobile ? 3.3 : 5.5), 190));
    root.setProperty('--hw', hw.toFixed(1) + 'px');
    if (V) { layoutHand(); placeEventBig(); }
  }
  addEventListener('resize', () => { layout(); });

  // ================================================================ API
  UI.start = function (opts) {
    ctl = opts;
    me = opts.me;
    V = null;
    sel = null;
    lastFx = 0;
    lastLog = 0;
    pendingKey = null;
    endShown = false;
    chain = Promise.resolve();
    $('#log').innerHTML = '';
    UI.closeModals();
    $('#fx-layer').innerHTML = '';
    const oldPanel = $('#meme-panel');
    if (oldPanel) oldPanel.remove();
    requestAnimationFrame(layout);
  };
  UI.update = function (view) {
    chain = chain.then(() => apply(view)).catch((e) => console.error(e));
    return chain;
  };
  UI.isAnimating = () => animating;
  UI.send = (a) => ctl.send && ctl.send(a);
  UI.view = () => V;

  // ================================================================ aplicação de estado + animações
  const elOf = (uid) => $(`#game [data-uid="${uid}"]`);
  const plateOf = (p) => {
    const side = V && p === V.me ? 0 : 1; // as placas ficam por lado da mesa (eu embaixo), não pelo número do jogador
    const a = $(`#plate-${side} .plate`), b = $(`#mplate-${side} .plate`);
    return a && a.offsetParent ? a : b && b.offsetParent ? b : a || b;
  };

  async function apply(v) {
    const first = !V;
    let fresh = v.fx.filter((f) => f.seq > lastFx);
    if (v.fx.length) lastFx = Math.max(lastFx, v.fx[v.fx.length - 1].seq);
    if (first) fresh = fresh.filter((f) => f.t === 'event' || f.t === 'turn');
    animating = true;
    if (!first && fresh.length) {
      // tira destaques de seleção enquanto as animações rodam
      $$('#game .drop, #game .target, #game .sel, #game .can-attack, #game .playable, #game .selectable, #game .good-target').forEach((el) => el.classList.remove('drop', 'target', 'sel', 'can-attack', 'playable', 'selectable', 'good-target'));
      $$('#midline .btn').forEach((b) => { b.disabled = true; });
    }
    if (!first) {
      for (let i = 0; i < fresh.length; i++) {
        const f = fresh[i];
        try {
        if (f.t === 'attack') await animAttack(f);
        else if (f.t === 'defeat') {
          const grp = [f];
          while (fresh[i + 1] && fresh[i + 1].t === 'defeat') grp.push(fresh[++i]);
          await Promise.all(grp.map(animDefeat));
        } else if (f.t === 'sup' && f.p !== v.me) await showcase(f.id, `${esc(v.players[f.p].name)} jogou`, 1900);
        } catch (e) { console.error(e); }
      }
    }
    const rects = first ? null : snapshot();
    V = v;
    me = v.me;
    if (sel && !stillValid()) sel = null;
    render();
    if (first) layout();
    if (rects) flip(rects);
    let energyShown = {};
    for (const f of fresh) {
      try {
      switch (f.t) {
        case 'play': {
          const el = elOf(f.uid);
          if (el) el.classList.add('flash');
          G.sfx('play');
          const L = G.locate(v, f.uid);
          if (L && C[L.card.id].rarity === 'l') G.Music.sting(L.card.id);
          break;
        }
        case 'sup': if (f.p === v.me) G.sfx('sup'); break;
        case 'stun': { const el = elOf(f.uid); if (el) el.animate([{ translate: '0 0' }, { translate: '-6px 0' }, { translate: '6px 0' }, { translate: '0 0' }], { duration: 300, iterations: 2 }); G.sfx('stun'); break; }
        case 'shield': case 'activate': case 'unstun': { const el = elOf(f.uid); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } G.sfx('select'); break; }
        case 'damage': damageFx(f.p, f.n); break;
        case 'hit': { const el = elOf(f.uid); if (el && f.n > 0) { floatAt(el, `-${f.n}`, 'dmg'); el.animate([{ filter: 'brightness(2.2)' }, { filter: 'none' }], { duration: 350 }); } break; }
        case 'heal': floatAt(plateOf(f.p), `+${f.n} ❤️`, 'heal'); G.sfx('heal'); break;
        case 'energy': if (!energyShown[f.p]) { energyShown[f.p] = 1; floatAt(plateOf(f.p), `+${f.n} ⚡`, 'nrg'); G.sfx('energy'); } break;
        case 'event': G.sfx('event'); await showcase(f.id, '🌟 Novo Evento', 2600, true); break;
        case 'reveal': await showcase(f.id, '🗣️ Carta revelada', 2000); break;
        case 'turn': if (!v.winner && v.winner !== 0) await banner(f.p === v.me ? 'Seu turno' : `Turno de ${v.players[f.p].name}`, f.p !== v.me); break;
        default:
      }
      } catch (e) { console.error(e); }
    }
    animating = false;
    render();
    if (v.winner != null) {
      if (!endShown) { endShown = true; await wait(600); showEnd(); }
    } else if (v.pending && v.pending.player === me) showPending(v.pending);
    else closePending();
    if (G.Coach) G.Coach.onView(v, legalNow());
  }

  function snapshot() {
    const m = {};
    $$('#game [data-uid]').forEach((el) => { m[el.dataset.uid] = el.getBoundingClientRect(); });
    return m;
  }
  function flip(prev) {
    const deck = $('#decks .deck') && $('#decks .deck').offsetParent ? $('#decks .deck').getBoundingClientRect() : null;
    $$('#game [data-uid]').forEach((el) => {
      const r = el.getBoundingClientRect();
      const p = prev[el.dataset.uid];
      if (p) {
        const dx = p.left + p.width / 2 - (r.left + r.width / 2);
        const dy = p.top + p.height / 2 - (r.top + r.height / 2);
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && Math.abs(p.width - r.width) < 2) return;
        const sc = p.width / Math.max(1, r.width);
        el.animate([{ translate: `${dx}px ${dy}px`, scale: sc, zIndex: 40 }, { translate: '0 0', scale: 1, zIndex: 40 }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' });
      } else if (el.closest('#hand, #opp-hand')) {
        const fromX = deck ? deck.left + deck.width / 2 : innerWidth - 40;
        const fromY = deck ? deck.top + deck.height / 2 : innerHeight / 2;
        const dx = fromX - (r.left + r.width / 2), dy = fromY - (r.top + r.height / 2);
        el.animate([{ translate: `${dx}px ${dy}px`, scale: 0.4, opacity: 0.2 }, { translate: '0 0', scale: 1, opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    });
  }
  function center(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
  }
  async function animAttack(f) {
    const a = elOf(f.uid);
    const t = f.target === 'life' ? plateOf(f.p) : elOf(f.target);
    if (!a || !t) return;
    G.sfx('attack');
    const ca = center(a), ct = center(t);
    const dx = ct.x - ca.x, dy = ct.y - ca.y;
    a.style.zIndex = 60;
    const anim = a.animate([
      { translate: '0 0', scale: 1 },
      { translate: `${-dx * 0.08}px ${-dy * 0.08}px`, scale: 1.12, offset: 0.28 },
      { translate: `${dx * 0.8}px ${dy * 0.8}px`, scale: 1.08, offset: 0.55 },
      { translate: '0 0', scale: 1 },
    ], { duration: 760, easing: 'ease-in-out' });
    setTimeout(() => {
      impact(ct.x, ct.y);
      t.animate([{ translate: '0 0' }, { translate: '-9px 3px' }, { translate: '8px -2px' }, { translate: '-4px 0' }, { translate: '0 0' }], { duration: 380 });
      G.sfx('hit');
      if (f.a != null && f.d != null) {
        const tag = document.createElement('div');
        tag.className = 'vs-tag';
        tag.innerHTML = `<span class="a">⚔️ ${f.a}</span> ⇄ <span class="d">↩ ${f.d}</span>`;
        tag.style.left = (ca.x + ct.x) / 2 + 'px';
        tag.style.top = (ca.y + ct.y) / 2 + 'px';
        $('#fx-layer').appendChild(tag);
        setTimeout(() => tag.remove(), 1100);
      }
    }, 420);
    // corrida com um timer: se a aba estiver oculta a animação pode não terminar nunca
    await Promise.race([anim.finished.catch(() => {}), wait(900)]);
    a.style.zIndex = '';
    await wait(f.a != null ? 380 : 120);
  }
  function impact(x, y) {
    const L = $('#fx-layer');
    for (let i = 0; i < 2; i++) {
      const s = document.createElement('div');
      s.className = 'slash';
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      s.style.setProperty('--a', (i ? -35 : 35) + Math.random() * 20 + 'deg');
      L.appendChild(s);
      setTimeout(() => s.remove(), 400);
    }
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('div');
      p.className = 'spark';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      L.appendChild(p);
      const ang = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 70;
      p.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(ang) * dist - 4}px, ${Math.sin(ang) * dist - 4}px) scale(0.2)`, opacity: 0 }], { duration: 500 + Math.random() * 300, easing: 'cubic-bezier(.1,.8,.3,1)' }).onfinish = () => p.remove();
    }
  }
  async function animDefeat(f) {
    const el = elOf(f.uid);
    if (!el) return;
    G.sfx('defeat');
    const r = el.getBoundingClientRect();
    const img = $('img', el);
    const L = $('#fx-layer');
    const hw = r.width / 2, hh = r.height / 2;
    for (let i = 0; i < 4; i++) {
      const s = document.createElement('div');
      s.className = 'shatter';
      const qx = i % 2, qy = Math.floor(i / 2);
      Object.assign(s.style, { left: r.left + qx * hw + 'px', top: r.top + qy * hh + 'px', width: hw + 'px', height: hh + 'px', backgroundImage: img ? `url(${img.src})` : 'none', backgroundSize: `${r.width}px ${r.height}px`, backgroundPosition: `${-qx * hw}px ${-qy * hh}px` });
      s.style.setProperty('--dx', (qx ? 1 : -1) * (30 + Math.random() * 40) + 'px');
      s.style.setProperty('--dy', (qy ? 1 : -1) * (30 + Math.random() * 40) + 'px');
      s.style.setProperty('--rot', (Math.random() * 60 - 30) + 'deg');
      L.appendChild(s);
      setTimeout(() => s.remove(), 650);
    }
    el.style.visibility = 'hidden';
    await wait(560);
  }
  function floatAt(el, txt, cls) {
    if (!el) return;
    const c = center(el);
    const d = document.createElement('div');
    d.className = 'float-num ' + cls;
    d.textContent = txt;
    d.style.left = c.x + 'px';
    d.style.top = c.y - 10 + 'px';
    $('#fx-layer').appendChild(d);
    setTimeout(() => d.remove(), 1350);
  }
  function damageFx(p, n) {
    const pl = plateOf(p);
    if (pl) { pl.classList.remove('hit'); void pl.offsetWidth; pl.classList.add('hit'); }
    floatAt(pl, `-${n} ❤️`, 'dmg');
    G.sfx('damage');
    if (p === me) {
      const f = document.createElement('div');
      f.className = 'screen-flash';
      $('#fx-layer').appendChild(f);
      setTimeout(() => f.remove(), 750);
    }
  }
  async function showcase(id, title, ms, long) {
    const d = document.createElement('div');
    d.className = 'showcase' + (long ? ' long' : '');
    d.innerHTML = `<div class="sc-card" style="background-image:url(${C[id].img})"></div><div class="sc-title">${title}: ${esc(C[id].name)}</div>`;
    $('#fx-layer').appendChild(d);
    await wait(ms || 2000);
    d.remove();
  }
  async function banner(txt, theirs) {
    G.sfx('turn');
    const b = document.createElement('div');
    b.className = 'banner' + (theirs ? ' theirs' : '');
    b.innerHTML = `<b>${esc(txt)}</b>`;
    $('#fx-layer').appendChild(b);
    await wait(1000);
    setTimeout(() => b.remove(), 400);
  }

  // ================================================================ legalidade / seleção
  function myTurnFree() { return V && !animating && V.winner == null && !V.pending && V.active === me; }
  function legalNow() { return myTurnFree() ? G.legal(V, me) : []; }
  function stillValid() {
    const L = legalNow();
    return L.some((a) => a.uid === sel.uid);
  }

  // ================================================================ render
  function render() {
    if (!V) return;
    const L = legalNow();
    renderPlate(0); renderPlate(1);
    renderEvent();
    renderEventBig();
    renderDecks();
    renderLog();
    renderField(me, L);
    renderField(1 - me, L);
    renderOppHand();
    renderHand(L);
    renderMid(L);
  }

  function renderPlate(p) {
    const pl = V.players[p];
    const side = p === me ? 0 : 1;
    const turn = V.active === p && V.winner == null;
    const K = G.RULES.heartPts, hn = Math.round(G.RULES.lifeStart / K);
    const hearts = Array.from({ length: hn }, (_, i) => {
      const f = Math.max(0, Math.min(1, (pl.life - i * K) / K));
      return `<i><s>❤️</s><b style="width:${Math.round(f * 100)}%">❤️</b></i>`;
    }).join('') + `<em class="lifenum">${pl.life}</em>`;
    const nrg = Array.from({ length: G.ENERGY_MAX }, (_, i) => `<i class="${i < pl.energy ? 'on' : i < pl.maxE ? 'spent' : 'lock'}"></i>`).join('') + `<b>${pl.energy}/${Math.max(pl.maxE, pl.energy)}</b>`;
    const avatar = (ctl.avatars && ctl.avatars[p]) || 'p01';
    const html = `<div class="plate ${turn ? 'turn' : ''}" data-plate="${p}">
      <div class="avatar" style="${avatarStyle(avatar)}"></div>
      <div class="pname">${esc(pl.name)}${p === me ? '<em>(você)</em>' : ''}</div>
      <div class="hearts" title="Vida">${hearts}</div>
      <div class="energy" title="Energia: o máximo sobe 1 por turno (até ${G.ENERGY_MAX}) e recarrega todo turno">${nrg}</div>
      <div class="meta"><span title="Cartas na mão">🂠 ${pl.hand.length}</span><span title="Descarte">🗑️ ${pl.discard.length}</span></div>
    </div>`;
    const compactHtml = `<div class="plate ${turn ? 'turn' : ''}" data-plate="${p}">
      <div class="avatar" style="${avatarStyle(avatar)}"></div>
      <div class="pname">${esc(pl.name)}</div>
      <div class="hearts">${hearts}</div>
      <div class="nrg-num">⚡<b>${pl.energy}/${Math.max(pl.maxE, pl.energy)}</b></div>
      <div class="hand-num">🂠${pl.hand.length}</div>
    </div>`;
    const put = (sel2) => {
      const box = $(sel2);
      box.innerHTML = box.classList.contains('compact') ? compactHtml : html;
      const plate = $('.plate', box);
      plate.onclick = () => onPlateClick(p);
    };
    put(side === 0 ? '#plate-0' : '#plate-1');
    put(side === 0 ? '#mplate-0' : '#mplate-1');
  }

  // quantas rodadas faltam para o próximo Evento entrar sozinho
  function evCountdown() {
    const N = G.RULES.autoEvent;
    if (!N) return '';
    const left = Math.max(1, N - (V.evRound || 0));
    return `Próximo Evento em ${left} ${left === 1 ? 'rodada' : 'rodadas'}.`;
  }
  // Evento ativo em tamanho de carta, ao lado direito do campo (perto dos botões de combate)
  function renderEventBig() {
    const box = $('#event-big');
    if (!box) return;
    if (!V.event) {
      box.innerHTML = `<div class="evb-slot"><span>🌟</span><small>Sem Evento</small></div><div class="evb-note">${esc(evCountdown())}</div>`;
      box.onclick = null;
      box.classList.remove('active');
    } else {
      const d = C[V.event];
      box.innerHTML = `<div class="evb-title">🌟 ${esc(d.name)}</div><div class="evb-card" style="background-image:url(${d.img})"></div><div class="evb-note">${esc(evCountdown())}</div>`;
      box.onclick = () => UI.zoom(V.event);
      box.classList.add('active');
    }
    placeEventBig();
  }
  function placeEventBig() {
    const box = $('#event-big');
    const board = $('#board');
    const mid = $('#midline');
    if (!box || !board || !mid || !mid.offsetParent) return;
    const field = $('#field-0');
    const cw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cw')) || 96;
    // espaço livre à direita do campo
    const free = board.clientWidth - (field.offsetLeft + field.offsetWidth) - 10;
    const w = Math.min(free, cw * 1.65);
    const side = $('#event-box');
    if (w < cw * 1.05) { box.style.display = 'none'; mid.style.paddingRight = ''; if (side) side.style.display = ''; return; }
    if (side) side.style.display = 'none'; // evita mostrar o mesmo Evento duas vezes
    box.style.display = 'flex';
    box.style.width = w + 'px';
    const right = Math.max(6, Math.min(free - w, 18));
    box.style.right = right + 'px';
    mid.style.paddingRight = (w + right + 10) + 'px'; // os botões não passam por baixo do card
    const h = box.offsetHeight;
    box.style.top = Math.max(0, mid.offsetTop + mid.offsetHeight / 2 - h / 2) + 'px';
  }
  function renderEvent() {
    const box = $('#event-box');
    const eb = $('#btn-event');
    if (!V.event) {
      box.innerHTML = `<div class="ev-card back-art ev" style="position:relative;--bw:74px"></div><div><h4>Nenhum Evento ativo</h4><p>${evCountdown()}</p></div>`;
      box.onclick = null;
      eb.style.backgroundImage = '';
      eb.textContent = '🌟';
      eb.onclick = () => UI.toast(`Nenhum Evento ativo. ${evCountdown()}`);
      eb.title = 'Nenhum Evento ativo';
      return;
    }
    const d = C[V.event];
    box.innerHTML = `<div class="ev-card" style="background-image:url(${d.img})"></div><div><h4>${esc(d.name)}</h4><p>${esc(d.text)}</p><p class="ev-next">${evCountdown()}</p></div>`;
    box.onclick = () => UI.zoom(V.event);
    eb.textContent = '';
    eb.style.backgroundImage = `url(${d.img})`;
    eb.onclick = () => UI.zoom(V.event);
    eb.title = `Evento: ${d.name}`;
  }


  function renderDecks() {
    const pile = (n, cls) => `<div class="pile">${n > 0 ? `<span class="back-art ${cls}" style="--bw:44px;transform:translate(3px,3px)"></span><span class="back-art ${cls}" style="--bw:44px;transform:translate(1.5px,1.5px)"></span><span class="back-art ${cls}" style="--bw:44px"></span>` : ''}<div class="n">${n}</div></div>`;
    const my = V.players[me], op = V.players[1 - me];
    $('#decks').innerHTML = `
      <button class="deck" title="Baralho de Personagens">${pile(V.charDeckN, '')}Personagens</button>
      <button class="deck" title="Baralho de Suportes">${pile(V.supDeckN, 'sup')}Suportes</button>
      <button class="deck" data-disc="${me}" title="Seu descarte">${pile(my.discard.length, 'ev')}Seu descarte</button>
      <button class="deck" data-disc="${1 - me}" title="Descarte do adversário">${pile(op.discard.length, 'ev')}Descarte dele</button>`;
    $$('#decks [data-disc]').forEach((b) => { b.onclick = () => showDiscard(+b.dataset.disc); });
  }
  function showDiscard(p) {
    const pl = V.players[p];
    const cards = pl.discard.slice().reverse();
    const m = UI.modal(`<h3>Descarte de ${esc(pl.name)}</h3><p class="sub">${cards.length ? cards.length + ' carta(s)' : 'Vazio'}</p><div class="choices">${cards.map((c) => `<button class="choice" data-id="${c.id}" style="background-image:url(${C[c.id].img})"></button>`).join('')}</div><div class="btns"><button class="btn" data-x>Fechar</button></div>`);
    $$('.choice', m).forEach((b) => { b.onclick = () => UI.zoom(b.dataset.id); });
    $('[data-x]', m).onclick = () => m.close();
  }
  UI.showLog = function () {
    const m = UI.modal(`<h3>Histórico</h3><div class="log" style="max-height:60vh;text-align:left">${V.log.map((l) => `<div class="${l.c}">${esc(l.t)}</div>`).join('')}</div><div class="btns" style="margin-top:12px"><button class="btn" data-x>Fechar</button></div>`);
    $('[data-x]', m).onclick = () => m.close();
    const lg = $('.log', m);
    lg.scrollTop = lg.scrollHeight;
  };

  function renderLog() {
    const box = $('#log');
    const items = V.log.filter((l) => l.n > lastLog);
    if (V.log.length && V.log[0].n > lastLog + 400) box.innerHTML = '';
    items.forEach((l) => {
      const d = document.createElement('div');
      d.className = l.c;
      d.textContent = l.t;
      box.appendChild(d);
      lastLog = l.n;
    });
    while (box.children.length > 160) box.firstChild.remove();
    if (items.length) box.scrollTop = box.scrollHeight;
  }

  function cardEl(c, opts) {
    opts = opts || {};
    const d = C[c.id];
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.uid = c.uid;
    let badges = '';
    if (c.protStun) badges += '<b title="Não pode ser Atordoado">🛡️</b>';
    if (c.protMove) badges += '<b title="Não pode ser movido por efeitos adversários">🔒</b>';
    if (c.canAtkT === V.turn) badges += '<b title="Pode atacar neste turno">⚽</b>';
    el.innerHTML = `<img src="${d.img}" alt="${esc(G.fullName(d))}" draggable="false">` +
      (d.type === 'char' && !opts.noStats ? `<div class="stats"><span class="a">⚔️${d.atk}</span><span class="d ${c.dmg ? 'hurt' : ''}">🛡️${d.def - (c.dmg || 0)}</span></div>` : '') +
      (badges ? `<div class="badges">${badges}</div>` : '');
    if (c.stunned) el.classList.add('stunned');
    if (c.protStun || c.protMove) el.classList.add('protected');
    if (opts.field && c.enteredT === V.turn && c.canAtkT !== V.turn && V.active === opts.owner) el.classList.add('fresh');
    bindPreview(el, c.id);
    bindZoom(el, c.id, c);
    return el;
  }

  function renderField(p, L) {
    const pl = V.players[p];
    const box = $(p === me ? '#field-0' : '#field-1');
    box.innerHTML = '';
    const mine = p === me;
    const zoneIcon = { atk: '⚔️', def: '🛡️', apoio: '🤝', perms: '🛠️' };
    const zoneLabel = { atk: 'Ataque', def: 'Defesa', apoio: 'Apoio', perms: 'Suporte' };
    const makeSlot = (z, card, idx) => {
      const s = document.createElement('div');
      s.className = 'slot z-' + (z === 'perms' ? 'perm' : z);
      s.dataset.zone = z;
      s.dataset.p = p;
      if (card) {
        const el = cardEl(card, { field: true, owner: p, noStats: z === 'perms' });
        decorateFieldCard(el, card, p, z, L);
        s.appendChild(el);
      } else {
        s.classList.add('empty');
        s.innerHTML = `<span class="zicon">${zoneIcon[z]}</span><span class="zlabel">${zoneLabel[z]}</span>`;
        if (mine && z !== 'perms') decorateSlot(s, z, L);
      }
      return s;
    };
    const col = (z, n) => {
      const c = document.createElement('div');
      c.className = 'col';
      for (let i = 0; i < n; i++) c.appendChild(makeSlot(z, pl[z][i], i));
      return c;
    };
    const row = (z) => {
      const r = document.createElement('div');
      r.className = 'row';
      for (let i = 0; i < 3; i++) r.appendChild(makeSlot(z, pl[z][i], i));
      return r;
    };
    const rows = document.createElement('div');
    rows.className = 'rows';
    if (mine) { rows.appendChild(row('atk')); rows.appendChild(row('def')); }
    else { rows.appendChild(row('def')); rows.appendChild(row('atk')); }
    box.appendChild(col('apoio', 2));
    box.appendChild(rows);
    box.appendChild(col('perms', 2));
  }

  function decorateSlot(s, z, L) {
    if (!sel) return;
    let a = null;
    if (sel.kind === 'hand') a = L.find((x) => x.t === 'playChar' && x.uid === sel.uid && x.zone === z);
    if (sel.kind === 'field') a = L.find((x) => x.t === 'move' && x.uid === sel.uid && x.zone === z);
    if (!a) return;
    s.classList.add('drop');
    if (a.t === 'playChar') {
      const c = V.players[me].hand.find((x) => x.uid === sel.uid);
      s.dataset.cost = `Jogar ⚡${G.charCost(V, me, c)}`;
    } else s.dataset.cost = 'Mover ⚡' + G.RULES.moveCost;
    s.onclick = () => { G.sfx('click'); const act = a; sel = null; ctl.send(act); };
  }

  function decorateFieldCard(el, c, p, z, L) {
    const mine = p === me;
    if (mine) {
      const acts = L.filter((a) => a.uid === c.uid);
      const canAtk = acts.some((a) => a.t === 'attack');
      if (canAtk) el.classList.add('can-attack');
      const hasAbility = C[c.id].activatable && myTurnFree();
      if ((acts.length || hasAbility) && !canAtk) el.classList.add('selectable');
      if (sel && sel.kind === 'field' && sel.uid === c.uid) el.classList.add('sel');
      el.onclick = () => {
        if (longPressed(el)) return;
        hidePreview();
        if (!acts.length && !hasAbility) { UI.zoom(c.id, c); return; }
        if (acts.length === 1 && acts[0].t === 'usePerm') { sel = { kind: 'field', uid: c.uid }; render(); return; }
        sel = sel && sel.uid === c.uid ? null : { kind: 'field', uid: c.uid };
        G.sfx('select');
        render();
      };
    } else {
      let atk = null;
      if (sel && sel.kind === 'field') atk = L.find((a) => a.t === 'attack' && a.uid === sel.uid && a.target === c.uid);
      if (atk) {
        el.classList.add('target');
        const A = V.players[me].atk.find((x) => x.uid === sel.uid);
        const av = C[A.id].atk, dv = C[c.id].def;
        el.classList.add(av > dv ? 'good-target' : av < dv ? 'bad-target' : 'x');
        el.title = `Atacar: ⚔️${av} contra 🛡️${dv} — ${av > dv ? 'você vence' : av === dv ? 'os dois caem' : 'seu atacante cai e o alvo fica Atordoado'}`;
      }
      el.onclick = () => {
        if (longPressed(el)) return;
        hidePreview();
        if (atk) { const a = atk; sel = null; ctl.send(a); return; }
        UI.zoom(c.id, c);
      };
    }
  }

  function onPlateClick(p) {
    if (p === me || !sel || sel.kind !== 'field') return;
    const a = legalNow().find((x) => x.t === 'attack' && x.uid === sel.uid && x.target === 'life');
    if (a) { sel = null; ctl.send(a); }
  }

  function renderOppHand() {
    const op = V.players[1 - me];
    const n = op.hand.length;
    $('#opp-hand').innerHTML = op.hand.map((c, i) => `<span class="bk back-art ${c.back === 'sup' ? 'sup' : ''}" data-uid="${c.uid}" style="--r:${(i - (n - 1) / 2) * 5}deg"></span>`).join('') + `<span class="cnt">${n} na mão</span>`;
  }

  function renderHand(L) {
    const box = $('#hand');
    box.innerHTML = '';
    const pl = V.players[me];
    if (!pl.hand.length) { box.innerHTML = '<div class="hand-empty">Sua mão está vazia</div>'; return; }
    pl.hand.forEach((c) => {
      const d = C[c.id];
      const el = cardEl(c, {});
      const cost = d.type === 'char' ? G.charCost(V, me, c) : G.supCost(V, me, c);
      const playable = L.some((a) => a.uid === c.uid);
      if (playable) el.classList.add('playable');
      else if (pl.energy < cost) el.classList.add('unaffordable');
      if (sel && sel.kind === 'hand' && sel.uid === c.uid) el.classList.add('sel');
      el.onclick = () => {
        if (longPressed(el)) return;
        hidePreview();
        if (!playable) {
          if (V.active === me && pl.energy < cost && !V.pending) UI.toast(`Energia insuficiente: custa ⚡${cost} e você tem ⚡${pl.energy}.`, 'err', 2200);
          else UI.zoom(c.id);
          return;
        }
        sel = sel && sel.uid === c.uid ? null : { kind: 'hand', uid: c.uid };
        G.sfx('select');
        render();
      };
      box.appendChild(el);
    });
    layoutHand();
  }
  function layoutHand() {
    const box = $('#hand');
    const cards = $$('.card', box);
    const n = cards.length;
    if (!n) return;
    const W = box.clientWidth;
    const hw = cards[0].offsetWidth;
    const step = n > 1 ? Math.min(hw * 0.9, (W - hw - 16) / (n - 1)) : 0;
    const total = hw + step * (n - 1);
    const start = (W - total) / 2;
    cards.forEach((el, i) => {
      const mid = (n - 1) / 2;
      el.style.left = start + i * step + 'px';
      el.style.zIndex = 10 + i;
      el.style.setProperty('--r', (i - mid) * (n > 5 ? 2.5 : 3.5) + 'deg');
      el.style.setProperty('--y', Math.abs(i - mid) ** 2 * 1.6 + 'px');
    });
  }

  // explica por que uma habilidade Ativável não pode ser usada agora
  function abilityBlock(c) {
    const d = C[c.id];
    const pl = V.players[me];
    if (c.actT === V.turn) return 'essa habilidade já foi usada neste turno (1 vez por turno).';
    if (V.event && C[V.event].fx === 'festa') return 'o Evento Festa da Família bloqueia habilidades Ativáveis.';
    if (c.stunned) return 'este Personagem está Atordoado.';
    const cost = G.actCost(V, me, c);
    if (pl.energy < cost) return `custa ⚡${cost} e você tem ⚡${pl.energy}.`;
    if (d.fx === 'actUnstun') return 'precisa ter outro Personagem seu Atordoado para recuperar.';
    if (d.fx === 'actUnstunDef') return 'precisa ter outro Defensor seu (🛡️) Atordoado para recuperar.';
    if (d.fx === 'actPeek') return 'o baralho de Personagens está vazio.';
    return 'não há alvo válido.';
  }

  function renderMid(L) {
    const box = $('#midline');
    const opName = esc(V.players[1 - me].name);
    let html = '';
    if (V.winner != null) {
      html = `<div class="phase-pill">🏁 Fim de jogo</div>`;
      box.innerHTML = html;
      return;
    }
    if (V.pending && V.pending.player !== me) {
      box.innerHTML = `<div class="phase-pill theirs">⏳ ${opName} está escolhendo…</div><div class="hint">${esc(V.pending.title || '')}</div>`;
      return;
    }
    if (V.active !== me) {
      box.innerHTML = `<div class="phase-pill theirs">🕰️ Turno de ${opName}</div><div class="hint">${ctl.mode === 'ai' ? 'O computador está pensando…' : 'Aguarde a jogada do adversário'}</div>`;
      return;
    }
    const mp = V.players[me];
    html += `<div class="phase-pill mine">⭐ <span class="lbl">Seu turno</span> <span class="steps"><i class="on">⚡ ${mp.energy}/${Math.max(mp.maxE, mp.energy)}</i></span></div>`;
    const btn = (label, cls, fn, dis) => ({ label, cls, fn, dis });
    const btns = [];
    let hint = '';
    if (sel) {
      const c = G.locate(V, sel.uid);
      const d = c ? C[c.card.id] : null;
      const acts = L.filter((a) => a.uid === sel.uid);
      if (d && sel.kind === 'hand' && d.type === 'sup') {
        const a = acts.find((x) => x.t === 'playSup');
        hint = `${esc(d.name)}`;
        if (a) btns.push(btn(`✨ Jogar<span class="lg"> Suporte</span> (⚡${G.supCost(V, me, c.card)})`, 'gold', () => { sel = null; ctl.send(a); }));
      } else if (d && sel.kind === 'hand') {
        hint = `Escolha uma zona brilhante para <b>${esc(d.name)}</b>`;
      } else if (d) {
        const act = acts.find((x) => x.t === 'activate');
        const perm = acts.find((x) => x.t === 'usePerm');
        const hasAtk = acts.some((x) => x.t === 'attack');
        const hasMove = acts.some((x) => x.t === 'move');
        const parts = [];
        if (hasAtk) parts.push('clique num alvo 🎯' + (acts.some((x) => x.target === 'life') ? ' ou no retrato do adversário' : ''));
        if (hasMove) parts.push('ou numa zona verde para mover');
        hint = `<b>${esc(d.name)}</b>: ${parts.join(' ') || ''}`;
        if (act) btns.push(btn(`✨ <span class="lg">Usar </span>habilidade (⚡${G.actCost(V, me, c.card)})`, 'gold', () => { sel = null; ctl.send(act); }));
        else if (d.activatable) {
          const why = abilityBlock(c.card);
          hint = `<b>${esc(d.name)}</b>: habilidade indisponível — ${why}`;
          btns.push(btn(`✨ <span class="lg">Usar </span>habilidade`, '', () => { UI.toast(`Não dá para usar agora: ${why}`, 'err', 3200); G.sfx('error'); }));
        }
        if (perm) btns.push(btn('🚪 Usar Porta dos Fundos', 'gold', () => { sel = null; ctl.send(perm); }));
      }
      btns.push(btn('✖ Cancelar', '', () => { sel = null; render(); }));
    } else {
      const canMore = L.some((a) => a.t !== 'endTurn' && a.t !== 'buySup');
      const canAtk = L.some((a) => a.t === 'attack');
      hint = canAtk ? 'Jogue cartas com a sua energia ⚡ e ataque com os Personagens brilhando' : 'Jogue cartas com a sua energia ⚡ (Personagens novos atacam no próximo turno)';
      const buy = L.find((a) => a.t === 'buySup');
      btns.push(btn(`🛒 <span class="lg">Comprar </span>Suporte <small>⚡${G.RULES.buyCost}</small>`, '', () => ctl.send({ t: 'buySup' }), !buy));
      btns.push(btn('✅ Encerrar<span class="lg"> turno</span>', canMore ? '' : 'gold', () => ctl.send({ t: 'endTurn' })));
    }
    if (hint) html += `<div class="hint ${sel ? '' : 'idle'}">${hint}</div>`;
    box.innerHTML = html;
    btns.forEach((b) => {
      const el = document.createElement('button');
      el.className = 'btn ' + b.cls;
      el.innerHTML = b.label;
      el.disabled = !!b.dis;
      el.onclick = () => { G.sfx('click'); b.fn(); };
      box.appendChild(el);
    });
  }

  // ================================================================ escolhas pendentes
  function closePending() {
    if (!pendingKey) return;
    pendingKey = null;
    const m = $('#modal-root .modal-bg[data-pending]');
    if (m) m.remove();
    const pk = $('#peek-btn');
    if (pk) pk.remove();
  }
  function showPending(pd) {
    const key = JSON.stringify([pd.title, pd.kind, pd.options, pd.text]);
    if (key === pendingKey && $('#modal-root .modal-bg[data-pending]')) return;
    closePending();
    pendingKey = key;
    const opts = pd.options || [];
    let body = '';
    const cardBtn = (o, i) => `<button class="choice" data-i="${i}" style="background-image:url(${C[o.id].img})"><span class="zoom" data-z="${o.id}">🔍</span></button>`;
    if (pd.kind === 'info') {
      body = `<div class="choices">${opts.map(cardBtn).join('')}</div><div class="btns"><button class="btn gold" data-ok>Entendi</button></div>`;
    } else if (pd.kind === 'confirm') {
      body = (opts.length ? `<div class="choices">${opts.map(cardBtn).join('')}</div>` : '') + `<div class="btns"><button class="btn gold" data-yes>Sim</button><button class="btn" data-no>Não</button></div>`;
    } else if (pd.kind === 'option') {
      body = (pd.cardId ? `<div class="choices"><button class="choice" style="background-image:url(${C[pd.cardId].img})"></button></div>` : '') + `<div class="opt-list">${opts.map((o, i) => `<button class="btn ${i === 0 ? 'gold' : ''}" data-opt="${i}">${esc(o.label)}</button>`).join('')}</div>`;
    } else if (pd.kind === 'pick' || pd.kind === 'order') {
      const skip = pd.kind === 'pick' && pd.min === 0;
      body = `<div class="choices">${opts.map(cardBtn).join('')}</div><div class="btns">${pd.kind === 'order' ? '<button class="btn" data-reset>Recomeçar</button>' : ''}${skip ? '<button class="btn" data-skip>Pular</button>' : ''}<button class="btn gold" data-ok disabled>Confirmar</button></div>`;
    }
    const m = UI.modal(`<h3>${esc(pd.title || 'Escolha')}</h3>${pd.text ? `<p class="sub">${esc(pd.text)}</p>` : ''}${body}<div class="btns" style="margin-top:10px"><button class="link" data-peek>👁 Ver a mesa</button></div>`, { dismiss: false, cls: 'pending' });
    m.dataset.pending = '1';
    const choose = (v) => { closePending(); G.sfx('click'); ctl.send({ t: 'choose', v }); };
    $$('[data-z]', m).forEach((z) => { z.onclick = (e) => { e.stopPropagation(); UI.zoom(z.dataset.z); }; });
    $('[data-peek]', m).onclick = () => {
      m.style.display = 'none';
      const b = document.createElement('button');
      b.id = 'peek-btn';
      b.className = 'btn gold';
      b.textContent = '↩ Voltar para a escolha';
      Object.assign(b.style, { position: 'fixed', left: '50%', bottom: '18px', transform: 'translateX(-50%)', zIndex: 120 });
      b.onclick = () => { m.style.display = ''; b.remove(); };
      document.body.appendChild(b);
    };
    if (pd.kind === 'info') $('[data-ok]', m).onclick = () => choose(true);
    if (pd.kind === 'confirm') { $('[data-yes]', m).onclick = () => choose(true); $('[data-no]', m).onclick = () => choose(false); }
    if (pd.kind === 'option') $$('[data-opt]', m).forEach((b) => { b.onclick = () => choose(opts[+b.dataset.opt].v); });
    if (pd.kind === 'pick') {
      const chosen = new Set();
      const ok = $('[data-ok]', m);
      const upd = () => {
        $$('.choice', m).forEach((b) => b.classList.toggle('on', chosen.has(+b.dataset.i)));
        ok.disabled = !(chosen.size >= Math.max(1, pd.min) && chosen.size <= pd.max);
      };
      $$('.choice', m).forEach((b) => {
        b.onclick = () => {
          const i = +b.dataset.i;
          if (chosen.has(i)) chosen.delete(i);
          else { if (pd.max === 1) chosen.clear(); if (chosen.size < pd.max) chosen.add(i); }
          G.sfx('select');
          upd();
        };
        b.ondblclick = () => { if (pd.max === 1) choose([opts[+b.dataset.i].v]); };
      });
      ok.onclick = () => choose([...chosen].map((i) => opts[i].v));
      const sk = $('[data-skip]', m);
      if (sk) sk.onclick = () => choose([]);
    }
    if (pd.kind === 'order') {
      const order = [];
      const ok = $('[data-ok]', m);
      const upd = () => {
        $$('.choice', m).forEach((b) => {
          const k = order.indexOf(+b.dataset.i);
          b.classList.toggle('on', k >= 0);
          const old = $('.num', b);
          if (old) old.remove();
          if (k >= 0) b.insertAdjacentHTML('beforeend', `<span class="num">${k + 1}</span>`);
        });
        ok.disabled = order.length !== opts.length;
      };
      $$('.choice', m).forEach((b) => { b.onclick = () => { const i = +b.dataset.i; if (!order.includes(i)) order.push(i); if (order.length === opts.length - 1) opts.forEach((o, j) => { if (!order.includes(j)) order.push(j); }); G.sfx('select'); upd(); }; });
      $('[data-reset]', m).onclick = () => { order.length = 0; upd(); };
      ok.onclick = () => choose(order.map((i) => opts[i].v));
    }
  }

  // ================================================================ fim de jogo / menus
  function showEnd() {
    const win = V.winner === me;
    if (!G.Music.jingle(win ? 'vitoria' : 'derrota')) G.sfx(win ? 'win' : 'lose');
    const w = V.players[V.winner];
    const m = UI.modal(`<div class="end-screen ${win ? '' : 'lose'}">
      <div class="crown">${win ? '👑' : '🥈'}</div>
      <h2>${win ? 'Vitória!' : 'Derrota'}</h2>
      <p class="sub">${win ? 'A família se curva diante de você!' : `${esc(w.name)} venceu desta vez. Revanche?`}</p>
      <p class="sub">Partida decidida no turno ${V.turn}.</p>
      <div class="btns">${ctl.onRematch ? '<button class="btn gold" data-re>🔁 Jogar de novo</button>' : ''}<button class="btn" data-board>Ver a mesa</button><button class="btn" data-menu>Menu principal</button></div>
    </div>`, { dismiss: false });
    const re = $('[data-re]', m);
    if (re) re.onclick = () => { m.close(); ctl.onRematch(); };
    $('[data-menu]', m).onclick = () => { m.close(); ctl.onExit(); };
    $('[data-board]', m).onclick = () => {
      m.close();
      const b = document.createElement('button');
      b.className = 'btn gold';
      b.textContent = '🏁 Resultado';
      Object.assign(b.style, { position: 'fixed', left: '50%', bottom: '18px', transform: 'translateX(-50%)', zIndex: 120 });
      b.onclick = () => { b.remove(); showEnd(); };
      document.body.appendChild(b);
    };
  }
  UI.gameMenu = function () {
    const m = UI.modal(`<h3>Menu</h3><div class="opt-list">
      <button class="btn" data-rules>📜 Regras rápidas</button>
      <button class="btn" data-log>🧾 Histórico da partida</button>
      <button class="btn" data-sound>${G.sfx.isOn() ? '🔊 Efeitos ligados' : '🔇 Efeitos desligados'}</button>
      ${document.body.classList.contains('online') ? `<button class="btn" data-mic>${G.Voice.micOn ? '🎙️ Microfone: ligado' : '🎤 Microfone: desligado'}</button><button class="btn" data-hear>${G.Voice.hearOn ? '🔊 Ouvindo o outro jogador' : '🔇 Voz do outro: silenciada'}</button>` : ''}
      <button class="btn" data-music>🎵 Música: ${G.Music.label().replace(/^\S+\s/, '')}</button>
      <button class="btn wine" data-quit>🏳️ Sair da partida</button>
      <button class="btn gold" data-x>Continuar jogando</button></div>`);
    $('[data-x]', m).onclick = () => m.close();
    $('[data-log]', m).onclick = () => { m.close(); UI.showLog(); };
    $('[data-rules]', m).onclick = () => { m.close(); UI.rules(); };
    $('[data-sound]', m).onclick = (e) => { const on = G.sfx.toggle(); e.target.textContent = on ? '🔊 Efeitos ligados' : '🔇 Efeitos desligados'; };
    $('[data-music]', m).onclick = () => { m.close(); UI.musicPicker(); };
    const mic = $('[data-mic]', m), hear = $('[data-hear]', m);
    if (mic) mic.onclick = async () => { await UI.micClick(); mic.textContent = G.Voice.micOn ? '🎙️ Microfone: ligado' : '🎤 Microfone: desligado'; };
    if (hear) hear.onclick = () => { G.Voice.setHear(!G.Voice.hearOn); hear.textContent = G.Voice.hearOn ? '🔊 Ouvindo o outro jogador' : '🔇 Voz do outro: silenciada'; };
    $('[data-quit]', m).onclick = () => {
      m.close();
      const c = UI.modal('<h3>Sair da partida?</h3><p class="sub">O progresso desta partida será perdido.</p><div class="btns"><button class="btn wine" data-y>Sair</button><button class="btn" data-n>Ficar</button></div>');
      $('[data-y]', c).onclick = () => { c.close(); ctl.onExit(); };
      $('[data-n]', c).onclick = () => c.close();
    };
  };
  // botões ⏮ ⏯ ⏭ (mini player e seletor)
  UI.bindMusicControls = function (root) {
    $$('[data-mp]', root).forEach((b) => {
      b.onclick = () => {
        const M = G.Music;
        const a = b.dataset.mp;
        if (a === 'prev') M.skip(-1); else if (a === 'next') M.skip(1); else M.toggle();
        G.sfx('click');
        setTimeout(UI.paintMusicControls, 120);
      };
    });
  };
  UI.paintMusicControls = function () {
    const M = G.Music;
    const on = M.isPlaying() && !M.isPaused();
    $$('[data-mp="toggle"]').forEach((b) => { b.textContent = on ? '⏸' : '▶'; b.title = on ? 'Pausar' : 'Tocar'; });
    const name = M.now ? `${M.now.emoji} ${M.now.name}` : 'Nada tocando';
    $$('[data-np]').forEach((e) => { e.textContent = (M.isPaused() ? '⏸ ' : '') + name; });
    const mp = $('#mini-player');
    if (mp) mp.title = name;
  };
  // painel de sons de meme (não bloqueia a mesa)
  UI.memePanel = function (force) {
    let pn = $('#meme-panel');
    if (pn) { if (force !== true) pn.remove(); return; }
    const MM = G.Memes;
    pn = document.createElement('div');
    pn.id = 'meme-panel';
    pn.innerHTML = `<div class="mm-head"><b>🎭 Sons de meme</b><span class="mm-now" data-now></span><button class="mm-x" data-close title="Fechar">✕</button></div>
      <div class="mm-grid">${MM.list.map((m) => `<button class="mm-btn" data-id="${m.id}"><span>${m.emoji}</span>${m.label}</button>`).join('')}</div>
      <div class="mm-foot"><button class="btn small" data-stop>⏹ Parar som</button><label class="mm-mute"><input type="checkbox" data-mute ${MM.isMuted() ? 'checked' : ''}> Silenciar memes</label></div>`;
    document.body.appendChild(pn);
    const paint = (now) => {
      $$('.mm-btn', pn).forEach((b) => b.classList.toggle('on', !!now && b.dataset.id === now.id));
      $('[data-now]', pn).textContent = now ? now.emoji + ' ' + now.label : '';
    };
    MM.onChange = paint;
    paint(MM.now());
    $$('.mm-btn', pn).forEach((b) => { b.onclick = () => { if (ctl.meme) ctl.meme(b.dataset.id); }; });
    $('[data-stop]', pn).onclick = () => MM.stop();
    $('[data-mute]', pn).onchange = (e) => MM.setMuted(e.target.checked);
    $('[data-close]', pn).onclick = () => { pn.remove(); MM.onChange = null; };
  };
  UI.musicPicker = function () {
    const M = G.Music;
    const groups = {};
    M.options().forEach((o) => { (groups[o.group] = groups[o.group] || []).push(o); });
    const html = Object.entries(groups).map(([g, list]) => `${g ? `<h4 class="mp-group">${g}</h4>` : ''}<div class="mp-list">${list.map((o) => `<button class="mp-item ${(o.id === 'off' ? M.isMuted() : o.id === M.mode) ? 'on' : ''}" data-m="${o.id}"><span>${o.label}</span>${o.hint ? `<small>${o.hint}</small>` : ''}</button>`).join('')}</div>`).join('');
    const m = UI.modal(`<h3>🎵 Música</h3>
      <div class="np"><div class="np-title" data-np></div><div class="np-ctl"><button data-mp="prev" title="Anterior">⏮</button><button data-mp="toggle" title="Pausar / tocar">⏸</button><button data-mp="next" title="Próxima">⏭</button></div></div>
      ${document.body.classList.contains('online') ? '<p class="sub sync-note">🔗 Online: vocês dois ouvem a <b>mesma música ao mesmo tempo</b>. Qualquer um pode trocar, pular ou pausar.</p>' : ''}
      <label class="vol"><span>🔊 Volume</span><input type="range" min="0" max="100" value="${Math.round(M.vol * 100)}" data-vol></label>
      <label class="toggle inline"><input type="checkbox" data-ent ${M.entrance ? 'checked' : ''}><span></span> Tema do personagem quando uma <b>Lendária</b> entra em campo</label>
      <div class="mp">${html}</div>
      <div class="btns" style="margin-top:12px"><button class="btn gold" data-x>Pronto</button></div>`, { cls: 'musicpick' });
    $$('.mp-item', m).forEach((b) => {
      b.onclick = () => {
        M.setMode(b.dataset.m);
        setTimeout(() => $$('.mp-item', m).forEach((x) => x.classList.toggle('on', x.dataset.m === 'off' ? M.isMuted() : x.dataset.m === M.mode && !M.isMuted())), 80);
        G.sfx('select');
        if (UI.onMusicChange) UI.onMusicChange();
      };
    });
    UI.bindMusicControls(m);
    const refresh = () => UI.paintMusicControls();
    refresh();
    $('[data-vol]', m).oninput = (e) => M.setVol(e.target.value / 100);
    $('[data-ent]', m).onchange = (e) => M.setEntrance(e.target.checked);
    $('[data-x]', m).onclick = () => m.close();
  };
  UI.emotePicker = function () {
    const list = ['😂', '👏', '😱', '😡', '🤔', '😎', '❤️', '🙏', '🐓', '⚽'];
    const m = UI.modal(`<h3>Reações</h3><div class="emote-bar">${list.map((e) => `<button>${e}</button>`).join('')}</div>`);
    $$('.emote-bar button', m).forEach((b) => { b.onclick = () => { m.close(); if (ctl.emote) ctl.emote(b.textContent); }; });
  };
  UI.showEmote = function (e, who) {
    G.sfx('emote');
    UI.toast(`<span title="${esc(who || '')}">${esc(e)}</span>`, 'emote', 2200);
  };

  UI.rules = function () {
    const m = UI.modal(`<h3>Regras rápidas</h3><div class="rules-doc">
      <h4>Objetivo</h4><p>Reduza a vida do adversário de <b>25 para 0</b>. (Nas cartas, 1 ❤️ = 5 pontos de vida: "recupere ❤️1" cura 5.)</p>
      <h4>Início</h4><p>Cada jogador começa com 25 de vida, 4 Personagens e 1 Suporte na mão (ninguém escolhe nem devolve cartas). A partida começa sem Evento. Quem começa não compra no primeiro turno. O segundo jogador ganha uma <b>moeda</b>: ⚡+1 só no primeiro turno dele.</p>
      <h4>Energia ⚡</h4><p>No 1º turno você tem <b>⚡1</b>, no 2º <b>⚡2</b>, e assim por diante até <b>⚡10</b>. A energia <b>enche de novo todo turno</b>; o que sobrar se perde. Gastando energia você joga <b>quantas cartas quiser</b>. Energia extra de efeitos vale só no turno e nunca passa de 10.</p>
      <h4>Campo</h4><table><tr><th>Zona</th><th>Limite</th><th>Função</th></tr>
      <tr><td>⚔️ Ataque</td><td>3</td><td>Podem atacar (a partir do turno seguinte ao que entraram).</td></tr>
      <tr><td>🛡️ Defesa</td><td>3</td><td>Protegem a sua vida: enquanto existir um Defensor, o herói não pode ser atacado.</td></tr>
      <tr><td>🤝 Apoio</td><td>2</td><td>Não atacam, não defendem e não podem ser atacados. Ativam efeitos 🤝.</td></tr>
      <tr><td>🛠️ Suportes</td><td>2</td><td>Suportes Permanentes ficam aqui.</td></tr></table>
      <h4>Turno</h4><p><b>COMPRE</b> 1 Personagem (se tiver menos de 7 cartas) → faça o que quiser com sua energia, em qualquer ordem: <b>jogar Personagens e Suportes</b>, <b>comprar 1 Suporte</b> (⚡1), <b>mover</b> um Personagem (⚡1, uma vez por Personagem), usar <b>habilidades Ativáveis</b> (uma vez por turno cada), e <b>atacar</b> com cada Personagem pronto → <b>ENCERRE</b> o turno. A cada 2 turnos seus você também compra 1 Suporte automaticamente.</p>
      <h4>Combate</h4><p>O atacante causa o próprio ⚔️ de dano. Um Personagem atacado <b>contra-ataca</b> com o ⚔️ dele, ao mesmo tempo. O dano fica na carta até o <b>início do turno do dono dela</b>, e a carta cai quando o dano chega à sua 🛡️. Dá para combinar vários ataques para derrubar um alvo.</p>
      <p>Contra um herói com Defensores, ataque os Defensores. <b>Desafio</b>: atacar um Personagem do Ataque inimigo. Sem Defensores, <b>todos os seus atacantes podem atacar o herói</b>, cada um tirando vida igual ao seu ⚔️ (sem contra-ataque).</p>
      <h4>Dicas de energia e custo</h4><p>As cartas custam de <b>⚡1 a ⚡10</b> (o número no selo dourado). Jogar cartas baratas cedo e guardar as fortes para depois é normal. Mover custa ⚡1, só vale uma vez por Personagem por turno, e <b>quem se moveu não ataca</b> naquele turno. Personagem recém-jogado também só ataca no turno seguinte. O dano que uma carta sofreu aparece em vermelho na defesa dela.</p>
      <h4>Atordoado</h4><p>Efeitos de cartas podem Atordoar: não ataca, não usa Ativável, não se move. Continua defendendo. Recupera no fim do próximo turno do dono.</p>
      <h4>Limites</h4><p>Mão: 7 cartas · Energia: ⚡10 · Vida: 25 · Custo mínimo: ⚡1 · Descontos não se acumulam.</p>
      <h4>Eventos</h4><p>No máximo 1 Evento fica ativo e ele <b>troca sozinho a cada 3 rodadas</b> (o primeiro entra no fim da 3ª). Ninguém compra nem troca Eventos.</p>
      <h4>Cansaço</h4><p>Se a partida passar do <b>turno 80</b> (cerca de 40 rodadas), quem começa o turno perde <b>3 de vida</b> — assim nenhum empate dura para sempre.</p>
      <h4>Regra de ouro</h4><p>Se o texto de uma carta contrariar uma regra, vale o que a carta diz.</p>
    </div><div class="btns" style="margin-top:14px"><button class="btn gold" data-x>Fechar</button></div>`);
    $('[data-x]', m).onclick = () => m.close();
  };

  UI.layout = layout;
})();
