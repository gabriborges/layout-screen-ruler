(async function () {
  'use strict';

  const api = window.rulerAPI;
  const $ = (id) => document.getElementById(id);
  const root = $('root');

  const init = await api.init();
  if (!init) return;

  const t = init.strings;
  const { limits, defaults, spacingPresets, colorPresets, shortcuts } = init;
  let state = init.state;
  let scaleFactor = init.scaleFactor || 1;
  let openPanel = null;
  let direction = 'down';

  const el = {
    btnSpacing: $('btn-spacing'),
    btnColor: $('btn-color'),
    btnDistance: $('btn-distance'),
    btnRuler: $('btn-ruler'),
    btnMinimize: $('btn-minimize'),
    btnClose: $('btn-close'),
    swatch: $('color-swatch'),
    badge: $('distance-badge'),
    rulerLabel: $('ruler-label'),
    panels: { spacing: $('panel-spacing'), color: $('panel-color') },
    spacingInput: $('spacing-input'),
    spacingRange: $('spacing-range'),
    spacingDec: $('spacing-dec'),
    spacingInc: $('spacing-inc'),
    spacingPresets: $('spacing-presets'),
    physicalNote: $('physical-note'),
    colorPresets: $('color-presets'),
    customColor: $('custom-color'),
    colorInput: $('color-input'),
    hexInput: $('hex-input'),
    opacityRange: $('opacity-range'),
    opacityValue: $('opacity-value'),
    colorReset: $('color-reset'),
  };

  const fill = (template, vars) =>
    template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));

  function setTip(node, text) {
    node.title = text;
    node.setAttribute('aria-label', text);
  }

  /* ------------------------------------------------------------ textos */

  document.documentElement.lang = init.lang;
  document.title = t.appName;
  root.querySelector('.bar').setAttribute('aria-label', t.appName);
  for (const node of document.querySelectorAll('[data-text]')) node.textContent = t[node.dataset.text] ?? '';
  for (const node of document.querySelectorAll('[data-title]')) setTip(node, t[node.dataset.title] ?? '');
  setTip(el.btnRuler, fill(t.rulerTip, { shortcut: shortcuts.toggleRuler }));
  setTip(el.btnMinimize, fill(t.minimizeTip, { shortcut: shortcuts.toggleToolbar }));

  /* ------------------------------------------------------- componentes */

  el.spacingInput.min = el.spacingRange.min = String(limits.spacingMin);
  el.spacingInput.max = String(limits.spacingMax);
  el.spacingRange.max = String(limits.sliderMax);

  for (const value of spacingPresets) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = String(value);
    chip.dataset.value = String(value);
    chip.addEventListener('click', () => update({ spacing: value }));
    el.spacingPresets.append(chip);
  }

  for (const preset of colorPresets) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swatch-btn';
    button.dataset.value = preset.value;
    button.style.setProperty('--c', preset.value);
    setTip(button, t.colorNames[preset.id] || preset.value);
    button.addEventListener('click', () => update({ color: preset.value }));
    el.colorPresets.append(button);
  }

  /* -------------------------------------------------------------- estado */

  function update(patch) {
    state = { ...state, ...patch };
    render();
    api.update(patch);
  }

  const clampSpacing = (n) => Math.min(limits.spacingMax, Math.max(limits.spacingMin, Math.round(n)));

  // Não sobrescreve o campo que o usuário está editando/arrastando agora.
  function setValue(input, value) {
    if (document.activeElement !== input) input.value = String(value);
  }

  function relativeLuminance(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function render() {
    const { spacing, color, opacity, rulerVisible, showDistance } = state;
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--line', color);
    // Cores muito escuras somem no fundo escuro: usa cinza claro no controle deslizante.
    rootStyle.setProperty('--accent', relativeLuminance(color) < 0.1 ? '#e4e4e7' : color);

    // Espaçamento
    setValue(el.spacingInput, spacing);
    setValue(el.spacingRange, Math.min(spacing, limits.sliderMax));
    for (const chip of el.spacingPresets.children) {
      chip.classList.toggle('active', Number(chip.dataset.value) === spacing);
    }
    const physical = Math.round(spacing * scaleFactor);
    const note =
      Math.abs(scaleFactor - 1) > 0.001
        ? fill(t.physicalNote, { scale: Math.round(scaleFactor * 100), physical })
        : '';
    el.physicalNote.textContent = note;
    el.physicalNote.hidden = !note;

    // Cor
    for (const button of el.colorPresets.children) {
      button.classList.toggle('active', button.dataset.value === color);
    }
    setValue(el.colorInput, color);
    setValue(el.hexInput, color.toUpperCase());
    const percent = Math.round(opacity * 100);
    setValue(el.opacityRange, percent);
    el.opacityValue.textContent = `${percent}%`;

    // Distância
    el.btnDistance.setAttribute('aria-pressed', String(showDistance));
    el.badge.hidden = !showDistance;
    el.badge.textContent = `${spacing} px`;
    setTip(el.btnDistance, [showDistance ? t.distanceTipHide : t.distanceTipShow, note].filter(Boolean).join('\n'));

    // Liga/desliga
    el.btnRuler.setAttribute('aria-pressed', String(rulerVisible));
    el.rulerLabel.textContent = rulerVisible ? t.rulerOn : t.rulerOff;
    root.classList.toggle('ruler-off', !rulerVisible);
  }

  api.onState((next) => {
    state = next;
    render();
  });

  api.onEnv((env) => {
    scaleFactor = env.scaleFactor || 1;
    render();
  });

  /* ------------------------------------------------------------- painéis */

  async function togglePanel(name) {
    if (openPanel === name) {
      closePanel();
      return;
    }
    if (!openPanel) {
      direction = (await api.getPlacement()) === 'up' ? 'up' : 'down';
      root.classList.toggle('dir-up', direction === 'up');
      root.classList.toggle('dir-down', direction !== 'up');
    }
    openPanel = name;
    syncPanels();
  }

  function closePanel() {
    if (!openPanel) return;
    openPanel = null;
    syncPanels();
  }

  function syncPanels() {
    for (const [name, panel] of Object.entries(el.panels)) panel.hidden = name !== openPanel;
    el.btnSpacing.setAttribute('aria-expanded', String(openPanel === 'spacing'));
    el.btnColor.setAttribute('aria-expanded', String(openPanel === 'color'));
  }

  /* -------------------------------------------------------------- eventos */

  el.btnSpacing.addEventListener('click', () => togglePanel('spacing'));
  el.btnColor.addEventListener('click', () => togglePanel('color'));
  el.btnDistance.addEventListener('click', () => update({ showDistance: !state.showDistance }));
  el.btnRuler.addEventListener('click', () => update({ rulerVisible: !state.rulerVisible }));
  el.btnMinimize.addEventListener('click', () => api.minimizeToTray());
  el.btnClose.addEventListener('click', () => api.quit());

  // Rodinha do mouse sobre "Espaçamento": ajuste rápido (Shift = de 10 em 10).
  el.btnSpacing.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const delta = (event.deltaY < 0 ? 1 : -1) * (event.shiftKey ? 10 : 1);
      update({ spacing: clampSpacing(state.spacing + delta) });
    },
    { passive: false },
  );

  el.spacingRange.addEventListener('input', () => update({ spacing: Number(el.spacingRange.value) }));

  el.spacingInput.addEventListener('input', () => {
    const n = Number(el.spacingInput.value);
    // Enquanto digita, só aplica valores já válidos (evita "piscar" em 1, 10...).
    if (Number.isFinite(n) && n >= limits.spacingMin && n <= limits.spacingMax) {
      update({ spacing: Math.round(n) });
    }
  });
  el.spacingInput.addEventListener('change', () => {
    const n = Number(el.spacingInput.value);
    if (Number.isFinite(n) && el.spacingInput.value !== '') update({ spacing: clampSpacing(n) });
    el.spacingInput.value = String(state.spacing);
  });
  el.spacingInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') el.spacingInput.blur();
  });

  const step = (sign) => (event) => {
    const amount = event.shiftKey ? 10 : 1;
    update({ spacing: clampSpacing(state.spacing + sign * amount) });
  };
  el.spacingDec.addEventListener('click', step(-1));
  el.spacingInc.addEventListener('click', step(+1));

  el.customColor.addEventListener('click', () => {
    try {
      el.colorInput.showPicker();
    } catch {
      el.colorInput.click();
    }
  });
  el.colorInput.addEventListener('input', () => update({ color: el.colorInput.value.toLowerCase() }));

  function parseHex(raw) {
    let hex = String(raw).trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(hex)) hex = [...hex].map((c) => c + c).join('');
    return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
  }
  el.hexInput.addEventListener('change', () => {
    const color = parseHex(el.hexInput.value);
    if (color) update({ color });
    el.hexInput.value = state.color.toUpperCase();
  });
  el.hexInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') el.hexInput.blur();
  });

  el.opacityRange.addEventListener('input', () => update({ opacity: Number(el.opacityRange.value) / 100 }));
  el.colorReset.addEventListener('click', () => update({ color: defaults.color, opacity: defaults.opacity }));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel();
  });

  /* --------------------------------------------- tamanho da janela */

  let lastSize = '';
  function reportSize() {
    const rect = root.getBoundingClientRect();
    const size = {
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
      anchor: direction === 'up' ? 'bottom' : 'top',
      panelOpen: Boolean(openPanel),
    };
    const key = JSON.stringify(size);
    if (key === lastSize) return;
    lastSize = key;
    api.resize(size);
  }

  render();
  new ResizeObserver(reportSize).observe(root);
  reportSize();
})();
