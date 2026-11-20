'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DEFAULTS, LIMITS } = require('../shared/config');

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const STORE_DEFAULTS = Object.freeze({
  ...DEFAULTS,
  toolbarPosition: null, // { x, y } da janela da barra
  trayHintShown: false,
  language: 'auto', // 'auto' (segue o sistema) | 'pt' | 'en'
});

const LANGUAGES = ['auto', 'pt', 'en'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Aplica `patch` sobre `base`, descartando qualquer valor inválido. */
function sanitize(patch, base = STORE_DEFAULTS) {
  const out = { ...base };
  if (!patch || typeof patch !== 'object') return out;

  if ('spacing' in patch) {
    const n = Math.round(Number(patch.spacing));
    if (Number.isFinite(n)) out.spacing = clamp(n, LIMITS.spacingMin, LIMITS.spacingMax);
  }
  if (typeof patch.color === 'string' && HEX_COLOR.test(patch.color.trim())) {
    out.color = patch.color.trim().toLowerCase();
  }
  if ('opacity' in patch) {
    const n = Number(patch.opacity);
    if (Number.isFinite(n)) {
      out.opacity = Math.round(clamp(n, LIMITS.opacityMin, LIMITS.opacityMax) * 100) / 100;
    }
  }
  for (const key of ['rulerVisible', 'showDistance', 'trayHintShown']) {
    if (typeof patch[key] === 'boolean') out[key] = patch[key];
  }
  if (LANGUAGES.includes(patch.language)) out.language = patch.language;
  if ('toolbarPosition' in patch) {
    const p = patch.toolbarPosition;
    out.toolbarPosition =
      p && Number.isFinite(p.x) && Number.isFinite(p.y)
        ? { x: Math.round(p.x), y: Math.round(p.y) }
        : null;
  }
  return out;
}

/** Guarda as preferências em `<userData>/settings.json`. */
class SettingsStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'settings.json');
    this.data = this.load();
    this.timer = null;
  }

  load() {
    try {
      return sanitize(JSON.parse(fs.readFileSync(this.file, 'utf8')));
    } catch {
      return { ...STORE_DEFAULTS };
    }
  }

  get() {
    return { ...this.data };
  }

  update(patch) {
    this.data = sanitize(patch, this.data);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 400);
    return this.get();
  }

  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    try {
      fs.mkdirSync(this.directory, { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('[settings] could not save preferences:', err);
    }
  }
}

module.exports = { SettingsStore, sanitize, STORE_DEFAULTS };
