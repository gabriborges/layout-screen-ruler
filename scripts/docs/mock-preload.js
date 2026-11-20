'use strict';

/*
 * Preload usado SOMENTE pelo gerador de imagens da documentação.
 * Substitui o "rulerAPI" real por uma versão falsa, para renderizar a barra
 * de ferramentas verdadeira (toolbar.html) com o estado que quisermos, sem
 * abrir janelas na tela do usuário.
 */

const path = require('node:path');
const { contextBridge, ipcRenderer } = require('electron');

const SRC = path.join(__dirname, '..', '..', 'src');
const {
  DEFAULTS,
  LIMITS,
  SPACING_PRESETS,
  COLOR_PRESETS,
  formatShortcuts,
} = require(path.join(SRC, 'shared', 'config.js'));
const { getStrings } = require(path.join(SRC, 'shared', 'i18n.js'));

const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'en' ? 'en' : 'pt';
const openPanel = params.get('open');
const platform = params.get('platform') || 'win32';

let state = {
  ...DEFAULTS,
  spacing: Number(params.get('spacing')) || DEFAULTS.spacing,
  color: params.get('color') || DEFAULTS.color,
  showDistance: params.get('distance') === '1',
  rulerVisible: params.get('ruler') !== '0',
};

const listeners = [];
let lastSize = null;
let timer = null;
let opened = false;

function rectOf(selector) {
  const node = document.querySelector(selector);
  if (!node || node.hidden) return null;
  const r = node.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

function collectRects() {
  return {
    bar: rectOf('.bar'),
    grip: rectOf('#grip'),
    spacing: rectOf('#btn-spacing'),
    color: rectOf('#btn-color'),
    distance: rectOf('#btn-distance'),
    badge: rectOf('#distance-badge'),
    ruler: rectOf('#btn-ruler'),
    minimize: rectOf('#btn-minimize'),
    close: rectOf('#btn-close'),
  };
}

// Espera o layout "assentar"; abre o painel pedido; então avisa o gerador.
function settle() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (openPanel && !opened) {
      opened = true;
      document.getElementById(`btn-${openPanel}`).click();
      return; // o painel muda o tamanho -> resize() -> settle() de novo
    }
    ipcRenderer.send('mock:ready', { size: lastSize, rects: collectRects() });
  }, 250);
}

contextBridge.exposeInMainWorld('rulerAPI', {
  init: async () => ({
    lang,
    strings: getStrings(lang),
    state,
    limits: LIMITS,
    defaults: DEFAULTS,
    spacingPresets: SPACING_PRESETS,
    colorPresets: COLOR_PRESETS,
    shortcuts: formatShortcuts(platform),
    platform,
    version: '0.0.0',
    scaleFactor: 1,
  }),
  update: (patch) => {
    state = { ...state, ...patch };
    for (const callback of listeners) callback(state);
  },
  onState: (callback) => {
    listeners.push(callback);
    return () => {};
  },
  onEnv: () => () => {},
  resize: (size) => {
    lastSize = size;
    settle();
  },
  getPlacement: async () => 'down',
  minimizeToTray: () => {},
  quit: () => {},
});
