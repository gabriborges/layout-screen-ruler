/*
 * Monta as cenas ilustrativas da documentação. A grade usa o mesmo código
 * do app (src/renderer/grid.js) e a barra é uma captura da barra real.
 */
(function () {
  'use strict';

  const spec = JSON.parse(new URLSearchParams(location.search).get('spec'));
  const L = spec.labels;
  const S = spec.strings;
  const K = spec.shortcuts;
  const W = spec.width;
  const H = spec.height;
  const root = document.getElementById('scene');
  const waits = [document.fonts.ready];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  root.style.width = `${W}px`;
  root.style.height = `${H}px`;
  if (spec.mode !== 'social') root.classList.add('rounded');

  /* ---------------------------------------------------------- utilitários */

  function node(tag, className, parent = root) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    parent.appendChild(n);
    return n;
  }

  function place(n, x, y, w, h) {
    n.style.left = `${x}px`;
    n.style.top = `${y}px`;
    if (w != null) n.style.width = `${w}px`;
    if (h != null) n.style.height = `${h}px`;
    return n;
  }

  function text(n, value) {
    n.textContent = value;
    return n;
  }

  function image(parent, src, x, y, w, h, className = 'abs') {
    const img = node('img', className, parent);
    img.src = src;
    place(img, x, y, w, h);
    waits.push(img.decode().catch(() => {}));
    return img;
  }

  function wallpaper(parent = root, variant = '') {
    return node('div', `wallpaper ${variant}`, parent);
  }

  function grid(parent, o) {
    const canvas = node('canvas', 'grid', parent);
    place(canvas, o.x || 0, o.y || 0);
    window.ScreenRulerGrid.draw(canvas, {
      width: o.w,
      height: o.h,
      dpr: window.devicePixelRatio || 1,
      spacing: o.spacing,
      color: o.color || '#ff0000',
      opacity: o.opacity ?? 1,
    });
    return canvas;
  }

  /** Barra capturada do app real. (x, y) = canto da janela da barra. */
  function toolbar(x, y, scale = 1, parent = root) {
    const tb = spec.toolbar;
    image(parent, tb.src, x, y, tb.width * scale, tb.height * scale);
    // Converte um retângulo da barra para coordenadas da cena.
    return (name) => {
      const r = tb.rects[name];
      return r && { x: x + r.x * scale, y: y + r.y * scale, w: r.width * scale, h: r.height * scale };
    };
  }

  function annotations(parent = root, w = W, h = H) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'annotations');
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    parent.appendChild(svg);
    return {
      path(d, attrs = {}) {
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', attrs.stroke || '#fff');
        p.setAttribute('stroke-width', attrs.width || 2);
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        if (attrs.dash) p.setAttribute('stroke-dasharray', attrs.dash);
        if (attrs.opacity) p.setAttribute('opacity', attrs.opacity);
        svg.appendChild(p);
        return p;
      },
      /** Seta dupla de medida entre (x1,y1) e (x2,y2). */
      measure(x1, y1, x2, y2, color = '#fff') {
        const horizontal = y1 === y2;
        const a = 6;
        this.path(`M${x1} ${y1}L${x2} ${y2}`, { stroke: color, width: 2.5 });
        if (horizontal) {
          this.path(`M${x1 + a} ${y1 - a}L${x1} ${y1}L${x1 + a} ${y1 + a}`, { stroke: color, width: 2.5 });
          this.path(`M${x2 - a} ${y2 - a}L${x2} ${y2}L${x2 - a} ${y2 + a}`, { stroke: color, width: 2.5 });
        } else {
          this.path(`M${x1 - a} ${y1 + a}L${x1} ${y1}L${x1 + a} ${y1 + a}`, { stroke: color, width: 2.5 });
          this.path(`M${x2 - a} ${y2 - a}L${x2} ${y2}L${x2 + a} ${y2 - a}`, { stroke: color, width: 2.5 });
        }
      },
    };
  }

  /** Janela de navegador genérica com uma página de exemplo. */
  function browser(parent, b, o = {}) {
    const win = place(node('div', 'window', parent), b.x, b.y, b.w, b.h);
    const bar = node('div', 'titlebar', win);
    for (let i = 0; i < 3; i++) node('span', 'dot', bar);
    text(node('div', 'address', bar), L.url);
    const page = node('div', 'page', win);
    const el = (cls, x, y, w, h) => place(node('div', `el ${cls}`, page), x, y, w, h);
    const inner = b.w - 80;

    el('logo-sq', 40, 10, 20, 20);
    el('bar-gray', 70, 16, 70, 8);
    for (let i = 0; i < (b.w > 600 ? 4 : 2); i++) el('bar-gray', b.w - 40 - 52 - i * 68, 16, 52, 8);
    el('divider', 0, 40, b.w, 1);

    text(el(`heading${o.compact ? ' compact' : ''}`, 40, 80, null, 40), L.heading);
    el('bar-gray', 40, 140, Math.min(360, inner - 40), 10);
    el('bar-gray', 40, 160, Math.min(300, inner - 80), 10);
    text(el('btn-primary', 40, 200, 160, 40), L.button);
    if (inner - 440 >= 120) el('hero-img', 480, 80, inner - 440, 160);

    const cards = o.cards ?? 3;
    if (cards > 0 && b.h - 40 >= 440) {
      const cw = (inner - 40 * (cards - 1)) / cards;
      for (let i = 0; i < cards; i++) {
        const card = el('card', 40 + i * (cw + 40), 280, cw, 160);
        node('div', 'img', card);
        const body = node('div', 'body', card);
        place(node('div', 'bar-gray', body), 0, 0, cw * 0.55);
        place(node('div', 'bar-gray', body), 0, 0, cw * 0.8);
      }
    }
    return win;
  }

  const ICONS = {
    chevron: '<path d="M4 10l4-4 4 4"/>',
    wifi: '<path d="M2 6.5a9 9 0 0 1 12 0M4.3 9a5.6 5.6 0 0 1 7.4 0M6.6 11.4a2.2 2.2 0 0 1 2.8 0"/>',
    volume: '<path d="M2.5 6h2.5l3.5-3v10l-3.5-3H2.5zM11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.6a6.2 6.2 0 0 1 0 8.8"/>',
    battery: '<rect x="1.5" y="4.5" width="11" height="7" rx="1.5"/><path d="M14.5 7v2"/><path d="M3.5 6.5h5v3h-5z" fill="currentColor"/>',
  };

  function icon(parent, name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.innerHTML = ICONS[name];
    parent.appendChild(svg);
    return svg;
  }

  /** Barra de tarefas genérica com a bandeja do sistema à direita. */
  function taskbar(parent, o = {}) {
    const bar = node('div', 'taskbar', parent);
    const apps = node('div', 'apps', bar);
    for (const color of ['#4f8cff', '#f59e0b', '#22c55e', '#ef4444', '#a855f7', '#14b8a6']) {
      node('span', 'app', apps).style.background = color;
    }
    const tray = node('div', 'tray', bar);
    icon(tray, 'chevron');
    const wrap = node('span', `tray-icon-wrap${o.hot ? ' hot' : ''}`, tray);
    const img = node('img', 'tray-icon', wrap);
    img.src = spec.trayIcon;
    waits.push(img.decode().catch(() => {}));
    icon(tray, 'wifi');
    icon(tray, 'volume');
    icon(tray, 'battery');
    const clock = node('div', 'clock', tray);
    clock.innerHTML = '14:32<br>20/11/2026';
    return { bar, trayIcon: wrap };
  }

  function rectIn(el, container = root) {
    const a = el.getBoundingClientRect();
    const b = container.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
  }

  function pill(parent, x, y, html, className = 'pill') {
    const p = place(node('div', className, parent), x, y);
    p.innerHTML = html;
    return p;
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function centerToolbarX(scale = 1) {
    return Math.round((W - spec.toolbar.width * scale) / 2);
  }

  /* --------------------------------------------------------------- cenas */

  const scenes = {
    hero() {
      wallpaper();
      browser(root, { x: 200, y: 120, w: 880, h: 520 });
      taskbar(root);
      grid(root, { w: W, h: H, spacing: 40 });
      toolbar(centerToolbarX(), 8);
    },

    guide() {
      wallpaper(root, 'dark');
      grid(root, { w: W, h: H, spacing: 20, opacity: 0.13 });
      const scale = 1.55;
      const tx = centerToolbarX(scale);
      const ty = Math.round((H - spec.toolbar.height * scale) / 2) - 4;
      const at = toolbar(tx, ty, scale);
      const svg = annotations();
      const items = ['grip', 'spacing', 'color', 'distance', 'ruler', 'minimize', 'close'];
      items.forEach((name, i) => {
        const r = at(name);
        const cx = r.x + r.w / 2;
        const above = i % 2 === 0;
        const edge = above ? r.y - 4 : r.y + r.h + 4;
        const my = above ? edge - 56 : edge + 56;
        svg.path(`M${cx} ${edge}L${cx} ${my}`, { stroke: '#ff5a5a', width: 2, dash: '3 4' });
        text(place(node('div', 'marker'), cx, my), String(i + 1));
        const cap = text(node('div', 'caption'), L.guide[i]);
        place(cap, cx, above ? my - 58 : my + 22);
      });
    },

    spacing() {
      wallpaper();
      browser(root, { x: 120, y: 250, w: 720, h: 400 }, { cards: 0 });
      grid(root, { w: W, h: H, spacing: 24 });
      toolbar(centerToolbarX(), 8);
    },

    color() {
      wallpaper();
      browser(root, { x: 120, y: 250, w: 720, h: 400 }, { cards: 0 });
      grid(root, { w: W, h: H, spacing: 40, color: '#00e5ff' });
      toolbar(centerToolbarX(), 8);
    },

    distance() {
      wallpaper();
      browser(root, { x: 40, y: 160, w: 480, h: 360 }, { cards: 0, compact: true });
      const highlight = place(node('div', 'abs'), 640, 240, 40, 120);
      highlight.style.background = 'rgba(255,255,255,0.14)';
      const highlight2 = place(node('div', 'abs'), 760, 280, 120, 40);
      highlight2.style.background = 'rgba(255,255,255,0.14)';
      grid(root, { w: W, h: H, spacing: 40 });
      const at = toolbar(centerToolbarX(), 8);
      const svg = annotations();
      const badge = at('badge');

      // Distância entre duas linhas verticais...
      const y = 300;
      svg.path(`M643 ${y}L678 ${y}`, { stroke: 'rgba(0,0,0,0.55)', width: 7 });
      svg.measure(643, y, 678, y, '#fff');
      pill(root, 600, 372, '40 px', 'pill red');
      // ...e entre duas linhas horizontais.
      const x = 820;
      svg.path(`M${x} 283L${x} 318`, { stroke: 'rgba(0,0,0,0.55)', width: 7 });
      svg.measure(x, 283, x, 318, '#fff');
      pill(root, 780, 332, '40 px', 'pill red');

      // Liga o "40 px" da barra às medidas na tela.
      const bx = badge.x + badge.w / 2;
      const by = badge.y + badge.h + 8;
      svg.path(`M${bx} ${by} C ${bx} ${by + 60}, 660 140, 660 228`, {
        stroke: '#fff',
        width: 2,
        dash: '4 5',
        opacity: 0.9,
      });
      svg.path(`M${bx} ${by} C ${bx} ${by + 60}, 820 170, 820 268`, {
        stroke: '#fff',
        width: 2,
        dash: '4 5',
        opacity: 0.9,
      });
    },

    toggle() {
      wallpaper(root, 'dark');
      const panelW = (W - 60) / 2;
      const panelH = H - 100;
      [true, false].forEach((on, i) => {
        const x = 20 + i * (panelW + 20);
        const frame = place(node('div', 'panel-frame'), x, 80, panelW, panelH);
        wallpaper(frame);
        browser(frame, { x: 40, y: 40, w: panelW - 80, h: panelH - 20 }, { cards: 0, compact: true });
        if (on) grid(frame, { w: panelW, h: panelH, spacing: 20 });
        const label = on ? L.on : L.off;
        const p = pill(root, 0, 24, `<span class="dot${on ? '' : ' off'}"></span>${esc(label)} <kbd>${esc(K.toggleRuler)}</kbd>`);
        const r = rectIn(p);
        place(p, x + (panelW - r.w) / 2, 24);
      });
    },

    tray() {
      wallpaper();
      browser(root, { x: 40, y: 40, w: 520, h: 280 }, { cards: 0, compact: true });
      grid(root, { w: W, h: H - 48, spacing: 40 });
      const { trayIcon } = taskbar(root, { hot: true });

      const icon = rectIn(trayIcon);
      const menu = node('div', 'menu');
      const items = [
        { label: S.trayShowToolbar, accel: K.toggleToolbar, hover: true },
        { label: S.trayRuler, accel: K.toggleRuler, check: true },
        { label: S.trayLanguage, accel: '›' },
        { sep: true },
        { label: S.trayQuit },
      ];
      for (const item of items) {
        if (item.sep) {
          node('div', 'sep', menu);
          continue;
        }
        const row = node('div', `item${item.hover ? ' hover' : ''}`, menu);
        text(node('span', 'check', row), item.check ? '✓' : '');
        text(node('span', 'label', row), item.label);
        if (item.accel) text(node('span', 'accel', row), item.accel);
      }
      const m = rectIn(menu);
      place(menu, Math.min(W - m.w - 12, icon.x + icon.w / 2 - m.w + 40), icon.y - m.h - 14);

      // Explicação à esquerda do menu, com uma seta curta até ele.
      const callout = text(node('div', 'callout'), L.trayCallout);
      callout.style.width = '360px';
      const menuRect = rectIn(menu);
      const c = rectIn(callout);
      const cx = menuRect.x - 70 - c.w;
      const cy = menuRect.y + menuRect.h / 2 - c.h / 2;
      place(callout, cx, cy);
      const svg = annotations();
      const sx = cx + c.w + 8;
      const sy = cy + c.h / 2;
      const ex = menuRect.x - 10;
      svg.path(`M${sx} ${sy}L${ex} ${sy}`, { stroke: '#fff', width: 2, dash: '4 5', opacity: 0.9 });
      svg.path(`M${ex - 7} ${sy - 6}L${ex} ${sy}L${ex - 7} ${sy + 6}`, { stroke: '#fff', width: 2 });
    },

    layers() {
      wallpaper(root, 'dark');
      const cx = 330;
      const tops = [80, 225, 370];
      const layerW = 440;
      const layerH = 270;

      // Camada de baixo: área de trabalho.
      const desktop = place(node('div', 'layer desktop'), cx - layerW / 2, tops[2] + 10 - layerH / 2 + 60, layerW, layerH);
      wallpaper(desktop);
      browser(desktop, { x: 40, y: 34, w: 360, h: 230 }, { cards: 0, compact: true });

      // Meio: grade transparente.
      const glass = place(node('div', 'layer glass'), cx - layerW / 2, tops[1] + 10 - layerH / 2 + 60, layerW, layerH);
      grid(glass, { w: layerW, h: layerH, spacing: 22 });

      // Topo: barra de ferramentas.
      const top = place(node('div', 'layer top'), cx - layerW / 2, tops[0] + 10 - layerH / 2 + 60, layerW, layerH);
      const scale = (layerW - 40) / spec.toolbar.width;
      image(top, spec.toolbar.src, 20, 16, spec.toolbar.width * scale, spec.toolbar.height * scale);

      const svg = annotations();
      L.layers.forEach(([title, desc], i) => {
        const y = tops[i] + 70;
        const label = place(node('div', 'layer-label'), 650, y - 22, 420);
        label.innerHTML = `<div class="title"><span class="num">${i + 1}</span>${esc(title)}</div><div class="text">${esc(desc)}</div>`;
        svg.path(`M${cx + 150} ${y}L${635} ${y}`, { stroke: '#ff5a5a', width: 2, dash: '3 5' });
      });
    },

    social() {
      wallpaper(root, 'dark');
      grid(root, { w: W, h: H, spacing: 40, opacity: 0.35 });
      image(root, spec.logo, W / 2 - 64, 70, 128, 128);
      const title = text(node('div', 'abs social-title'), 'Layout Screen Ruler');
      const t = rectIn(title);
      place(title, (W - t.w) / 2, 210);
      const tagline = text(node('div', 'abs social-tagline'), L.tagline);
      place(tagline, 140, 300, W - 280);
      toolbar(centerToolbarX(1.3), 372, 1.3);
      const p = pill(root, 0, 540, esc(L.platforms));
      const r = rectIn(p);
      place(p, (W - r.w) / 2, 540);
    },
  };

  scenes[spec.mode]();

  window.sceneReady = Promise.all(waits).then(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))),
  );
})();
