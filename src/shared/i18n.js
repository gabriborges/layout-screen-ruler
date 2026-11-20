'use strict';

/**
 * Textos da interface. Por padrão o idioma segue o sistema: português para
 * qualquer variante "pt", inglês para os demais. O usuário pode fixar um
 * idioma no menu da bandeja; a variável de ambiente LSR_LANG=pt|en tem
 * prioridade sobre tudo (útil para testes).
 */

const STRINGS = {
  pt: {
    appName: 'Layout Screen Ruler',
    dragHandle: 'Arraste para mover a barra',
    spacing: 'Espaçamento',
    spacingTip: 'Alterar a distância entre as linhas (role a rodinha do mouse aqui para ajuste rápido)',
    color: 'Cor',
    colorTip: 'Mudar a cor das linhas',
    distance: 'Distância',
    distanceTipShow: 'Mostrar a distância atual entre as linhas, em pixels',
    distanceTipHide: 'Ocultar a distância',
    rulerOn: 'Régua ligada',
    rulerOff: 'Régua desligada',
    rulerTip: 'Ligar ou desligar a régua na tela ({shortcut})',
    minimizeTip: 'Minimizar para a bandeja ({shortcut} reabre a barra)',
    closeTip: 'Fechar o programa',
    spacingTitle: 'Distância entre as linhas',
    spacingHelp: 'Vale para as linhas horizontais e verticais. Shift + clique em −/+ muda de 10 em 10.',
    decrease: 'Diminuir',
    increase: 'Aumentar',
    presets: 'Valores rápidos',
    colorTitle: 'Cor das linhas',
    customColor: 'Outra cor…',
    hexLabel: 'Código hexadecimal da cor',
    opacity: 'Opacidade',
    resetColor: 'Voltar ao vermelho padrão',
    physicalNote: 'Com a escala de tela em {scale}%, isso equivale a {physical} px físicos.',
    colorNames: {
      red: 'Vermelho',
      orange: 'Laranja',
      yellow: 'Amarelo',
      green: 'Verde',
      cyan: 'Ciano',
      blue: 'Azul',
      magenta: 'Magenta',
      white: 'Branco',
      black: 'Preto',
    },
    trayTooltip: 'Layout Screen Ruler',
    trayShowToolbar: 'Mostrar barra de ferramentas',
    trayHideToolbar: 'Ocultar barra de ferramentas',
    trayRuler: 'Régua visível',
    trayLanguage: 'Idioma',
    trayLanguageAuto: 'Automático (sistema)',
    trayQuit: 'Sair',
    trayHintTitle: 'Continua rodando na bandeja',
    trayHintText: 'Clique no ícone da régua para reabrir a barra de ferramentas.',
  },
  en: {
    appName: 'Layout Screen Ruler',
    dragHandle: 'Drag to move the toolbar',
    spacing: 'Spacing',
    spacingTip: 'Change the distance between lines (scroll the mouse wheel here for quick changes)',
    color: 'Color',
    colorTip: 'Change the line color',
    distance: 'Distance',
    distanceTipShow: 'Show the current distance between lines, in pixels',
    distanceTipHide: 'Hide the distance',
    rulerOn: 'Ruler on',
    rulerOff: 'Ruler off',
    rulerTip: 'Turn the on-screen ruler on or off ({shortcut})',
    minimizeTip: 'Minimize to the system tray ({shortcut} brings the toolbar back)',
    closeTip: 'Quit the app',
    spacingTitle: 'Distance between lines',
    spacingHelp: 'Applies to horizontal and vertical lines. Shift + click on −/+ changes it by 10.',
    decrease: 'Decrease',
    increase: 'Increase',
    presets: 'Quick values',
    colorTitle: 'Line color',
    customColor: 'Other color…',
    hexLabel: 'Hex color code',
    opacity: 'Opacity',
    resetColor: 'Back to default red',
    physicalNote: 'At {scale}% display scaling, this equals {physical} physical px.',
    colorNames: {
      red: 'Red',
      orange: 'Orange',
      yellow: 'Yellow',
      green: 'Green',
      cyan: 'Cyan',
      blue: 'Blue',
      magenta: 'Magenta',
      white: 'White',
      black: 'Black',
    },
    trayTooltip: 'Layout Screen Ruler',
    trayShowToolbar: 'Show toolbar',
    trayHideToolbar: 'Hide toolbar',
    trayRuler: 'Ruler visible',
    trayLanguage: 'Language',
    trayLanguageAuto: 'Automatic (system)',
    trayQuit: 'Quit',
    trayHintTitle: 'Still running in the tray',
    trayHintText: 'Click the ruler icon to bring the toolbar back.',
  },
};

function resolveLanguage(candidates) {
  for (const candidate of candidates) {
    const code = String(candidate || '').toLowerCase();
    if (code.startsWith('pt')) return 'pt';
    if (code.startsWith('en')) return 'en';
  }
  return 'en';
}

function getStrings(lang) {
  return STRINGS[lang] || STRINGS.en;
}

module.exports = { STRINGS, resolveLanguage, getStrings };
