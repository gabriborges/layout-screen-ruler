'use strict';

/**
 * Configuração compartilhada entre o processo principal, a barra de
 * ferramentas e o script que gera as imagens da documentação.
 */

const DEFAULTS = Object.freeze({
  spacing: 50, // distância entre as linhas, em pixels (lógicos)
  color: '#ff0000', // vermelho por padrão
  opacity: 1,
  rulerVisible: true,
  showDistance: false,
});

const LIMITS = Object.freeze({
  spacingMin: 4,
  spacingMax: 1000,
  sliderMax: 300, // acima disso, só pelo campo numérico
  opacityMin: 0.1,
  opacityMax: 1,
});

const SPACING_PRESETS = Object.freeze([8, 10, 16, 20, 24, 32, 40, 50, 64, 100]);

const COLOR_PRESETS = Object.freeze([
  { id: 'red', value: '#ff0000' },
  { id: 'orange', value: '#ff8a00' },
  { id: 'yellow', value: '#ffe600' },
  { id: 'green', value: '#00e676' },
  { id: 'cyan', value: '#00e5ff' },
  { id: 'blue', value: '#2979ff' },
  { id: 'magenta', value: '#ff00ff' },
  { id: 'white', value: '#ffffff' },
  { id: 'black', value: '#000000' },
]);

const SHORTCUTS = Object.freeze({
  toggleRuler: 'CommandOrControl+Alt+Shift+R',
  toggleToolbar: 'CommandOrControl+Alt+Shift+B',
});

/** Converte um acelerador do Electron em texto legível para o usuário. */
function formatAccelerator(accelerator, platform) {
  const mac = platform === 'darwin';
  const names = mac
    ? { CommandOrControl: '⌘', Alt: '⌥', Shift: '⇧' }
    : { CommandOrControl: 'Ctrl', Alt: 'Alt', Shift: 'Shift' };
  const parts = accelerator.split('+').map((part) => names[part] ?? part);
  return mac ? parts.join('') : parts.join('+');
}

function formatShortcuts(platform) {
  return {
    toggleRuler: formatAccelerator(SHORTCUTS.toggleRuler, platform),
    toggleToolbar: formatAccelerator(SHORTCUTS.toggleToolbar, platform),
  };
}

module.exports = {
  DEFAULTS,
  LIMITS,
  SPACING_PRESETS,
  COLOR_PRESETS,
  SHORTCUTS,
  formatAccelerator,
  formatShortcuts,
};
