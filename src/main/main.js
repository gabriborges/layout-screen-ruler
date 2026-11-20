'use strict';

/**
 * Layout Screen Ruler — processo principal.
 *
 * Janelas:
 *  - uma "overlay" por monitor: transparente, sem moldura, sempre no topo e
 *    que deixa os cliques passarem (click-through). Desenha a grade.
 *  - a barra de ferramentas: pequena janela flutuante no topo da tela.
 * Além disso: ícone na bandeja do sistema e atalhos globais de teclado.
 */

const path = require('node:path');
const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
} = require('electron');
const { SettingsStore } = require('./settings');
const {
  DEFAULTS,
  LIMITS,
  SPACING_PRESETS,
  COLOR_PRESETS,
  SHORTCUTS,
  formatShortcuts,
} = require('../shared/config');
const { getStrings, resolveLanguage } = require('../shared/i18n');

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';
const IS_LINUX = process.platform === 'linux';

const APP_ID = 'io.github.gabriborges.layoutscreenruler';
const SRC_DIR = path.join(__dirname, '..');
const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');

const TOOLBAR_TOP_MARGIN = 8;
const PANEL_HEIGHT_ESTIMATE = 280;

const SECURE_WEB_PREFERENCES = Object.freeze({
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  spellcheck: false,
});

if (IS_LINUX) {
  // Janelas transparentes no X11 precisam de um visual ARGB.
  app.commandLine.appendSwitch('enable-transparent-visuals');
  // No Wayland nativo, "sempre no topo", click-through e atalhos globais não
  // são confiáveis; via X11/XWayland funcionam. LSR_WAYLAND=1 desativa isso.
  if (process.env.LSR_WAYLAND !== '1') app.commandLine.appendSwitch('ozone-platform', 'x11');
}
if (IS_WIN) app.setAppUserModelId(APP_ID);

let store;
let lang;
let strings;
let tray = null;
let toolbarWin = null;
let toolbarRevealed = false;
let toolbarPanelOpen = false;
let toolbarAnchor = 'top';
let toolbarClosedHeight = 0;
let ignoreToolbarMovesUntil = 0;
let isQuitting = false;
const overlays = new Map(); // display.id -> BrowserWindow

const alive = (win) => Boolean(win) && !win.isDestroyed();

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function clampInt(value, min, max) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
}

/* ------------------------------------------------------------------ estado */

function publicState() {
  const { spacing, color, opacity, rulerVisible, showDistance } = store.get();
  return { spacing, color, opacity, rulerVisible, showDistance };
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function setState(patch) {
  const before = store.get();
  const after = store.update(patch);
  broadcast('state', publicState());
  if (before.rulerVisible !== after.rulerVisible) {
    for (const win of overlays.values()) applyOverlayVisibility(win);
    updateTrayMenu();
  }
}

/* ---------------------------------------------------------------- overlays */

function createOverlay(display) {
  const win = new BrowserWindow({
    ...display.bounds,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    enableLargerThanScreen: true,
    roundedCorners: false,
    title: 'Layout Screen Ruler overlay',
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: path.join(SRC_DIR, 'preload', 'overlay.js'),
      backgroundThrottling: false,
    },
  });

  win.setIgnoreMouseEvents(true); // os cliques atravessam a grade
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  if (IS_MAC && typeof win.setHiddenInMissionControl === 'function') {
    win.setHiddenInMissionControl(true);
  }
  win.setBounds(display.bounds); // no macOS, garante que cubra também a barra de menus
  win.loadFile(path.join(SRC_DIR, 'renderer', 'overlay.html'));
  win.once('ready-to-show', () => applyOverlayVisibility(win));

  overlays.set(display.id, win);
  return win;
}

function applyOverlayVisibility(win) {
  if (!alive(win)) return;
  if (store.get().rulerVisible) {
    if (!win.isVisible()) win.showInactive();
  } else if (win.isVisible()) {
    win.hide();
  }
  raiseToolbar();
}

/** Cria/atualiza/remove overlays conforme os monitores conectados. */
function syncOverlays() {
  const displays = screen.getAllDisplays();
  const ids = new Set(displays.map((d) => d.id));

  for (const [id, win] of overlays) {
    if (!ids.has(id)) {
      overlays.delete(id);
      if (alive(win)) win.destroy();
    }
  }
  for (const display of displays) {
    const win = overlays.get(display.id);
    if (alive(win)) win.setBounds(display.bounds);
    else createOverlay(display);
  }

  ensureToolbarOnScreen();
  raiseToolbar();
}

/**
 * No Windows, a barra de tarefas (e outras janelas "sempre no topo") pode
 * passar por cima da grade quando clicada. Reafirmamos a ordem de tempos em
 * tempos — é barato e mantém a grade e a barra visíveis.
 */
function startTopmostKeeper() {
  if (!IS_WIN) return;
  setInterval(() => {
    if (!store.get().rulerVisible) return;
    for (const win of overlays.values()) {
      if (alive(win) && win.isVisible()) win.setAlwaysOnTop(true, 'screen-saver');
    }
    raiseToolbar();
  }, 1500).unref?.();
}

/* -------------------------------------------------------- barra de ferramentas */

function isVisibleOnSomeDisplay(bounds) {
  return screen.getAllDisplays().some(({ workArea: wa }) => {
    const w = Math.min(bounds.x + bounds.width, wa.x + wa.width) - Math.max(bounds.x, wa.x);
    const h = Math.min(bounds.y + bounds.height, wa.y + wa.height) - Math.max(bounds.y, wa.y);
    return w >= 80 && h >= 24;
  });
}

function centeredToolbarPosition(width) {
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: wa.x + Math.round((wa.width - width) / 2), y: wa.y + TOOLBAR_TOP_MARGIN };
}

function createToolbar() {
  let saved = store.get().toolbarPosition;
  if (saved && !isVisibleOnSomeDisplay({ ...saved, width: 400, height: 56 })) saved = null;

  toolbarWin = new BrowserWindow({
    width: 640,
    height: 72,
    ...(saved || centeredToolbarPosition(640)),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    roundedCorners: false,
    title: 'Layout Screen Ruler',
    ...(IS_LINUX ? { icon: path.join(ASSETS_DIR, 'icon.png') } : {}),
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: path.join(SRC_DIR, 'preload', 'toolbar.js'),
    },
  });

  toolbarWin.setAlwaysOnTop(true, 'screen-saver', 1);
  toolbarWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  toolbarWin.loadFile(path.join(SRC_DIR, 'renderer', 'toolbar.html'));

  toolbarWin.on('move', debounce(onToolbarMoved, 250));
  toolbarWin.on('show', updateTrayMenu);
  toolbarWin.on('hide', updateTrayMenu);
  toolbarWin.on('restore', () => alive(toolbarWin) && toolbarWin.setSkipTaskbar(true));
  toolbarWin.on('closed', () => {
    toolbarWin = null;
    if (!isQuitting) quitApp();
  });

  // Normalmente a barra aparece assim que informa o próprio tamanho;
  // isto é só uma rede de segurança.
  setTimeout(revealToolbar, 3000);
}

function setToolbarBounds(bounds) {
  if (!alive(toolbarWin)) return;
  const b = toolbarWin.getBounds();
  if (b.x === bounds.x && b.y === bounds.y && b.width === bounds.width && b.height === bounds.height) return;
  ignoreToolbarMovesUntil = Date.now() + 500;
  toolbarWin.setBounds(bounds);
}

function onToolbarMoved() {
  if (!alive(toolbarWin)) return;
  sendToolbarEnv();
  if (Date.now() < ignoreToolbarMovesUntil) return; // movimento feito pelo próprio app
  const b = toolbarWin.getBounds();
  let { y } = b;
  if (toolbarPanelOpen && toolbarAnchor === 'bottom' && toolbarClosedHeight) {
    y = b.y + b.height - toolbarClosedHeight;
  }
  store.update({ toolbarPosition: { x: b.x, y } });
}

function ensureToolbarOnScreen() {
  if (!alive(toolbarWin)) return;
  const b = toolbarWin.getBounds();
  if (isVisibleOnSomeDisplay(b)) return;
  setToolbarBounds({ ...b, ...centeredToolbarPosition(b.width) });
  store.update({ toolbarPosition: null });
}

function toolbarEnv() {
  const display = alive(toolbarWin)
    ? screen.getDisplayMatching(toolbarWin.getBounds())
    : screen.getPrimaryDisplay();
  return { scaleFactor: display.scaleFactor };
}

function sendToolbarEnv() {
  if (alive(toolbarWin)) toolbarWin.webContents.send('toolbar:env', toolbarEnv());
}

function raiseToolbar() {
  if (alive(toolbarWin) && toolbarWin.isVisible()) {
    toolbarWin.setAlwaysOnTop(true, 'screen-saver', 1);
    toolbarWin.moveTop();
  }
}

function revealToolbar() {
  if (toolbarRevealed) return;
  toolbarRevealed = true;
  showToolbar();
}

function showToolbar() {
  if (!alive(toolbarWin)) return;
  if (toolbarWin.isMinimized()) toolbarWin.restore();
  toolbarWin.show();
  raiseToolbar();
  updateTrayMenu();
}

function minimizeToTray() {
  if (!alive(toolbarWin)) return;
  if (!tray) {
    // Sem bandeja disponível: minimiza do jeito tradicional.
    toolbarWin.setSkipTaskbar(false);
    toolbarWin.minimize();
    return;
  }
  toolbarWin.hide();
  updateTrayMenu();
  showTrayHintOnce();
}

function toggleToolbar() {
  if (alive(toolbarWin) && toolbarWin.isVisible() && !toolbarWin.isMinimized()) minimizeToTray();
  else showToolbar();
}

/* ------------------------------------------------------------------ bandeja */

function createTray() {
  try {
    const file = IS_MAC ? 'trayTemplate.png' : 'tray.png';
    const image = nativeImage.createFromPath(path.join(ASSETS_DIR, 'tray', file));
    if (IS_MAC) image.setTemplateImage(true);
    tray = new Tray(image);
    tray.setToolTip(strings.trayTooltip);
    if (!IS_MAC) tray.on('click', showToolbar);
    updateTrayMenu();
  } catch (err) {
    console.error('[tray] system tray unavailable:', err);
    tray = null;
  }
}

function updateTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  const toolbarVisible = alive(toolbarWin) && toolbarWin.isVisible() && !toolbarWin.isMinimized();
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: toolbarVisible ? strings.trayHideToolbar : strings.trayShowToolbar,
        accelerator: SHORTCUTS.toggleToolbar,
        registerAccelerator: false,
        click: () => (toolbarVisible ? minimizeToTray() : showToolbar()),
      },
      {
        label: strings.trayRuler,
        type: 'checkbox',
        checked: store.get().rulerVisible,
        accelerator: SHORTCUTS.toggleRuler,
        registerAccelerator: false,
        click: (item) => setState({ rulerVisible: item.checked }),
      },
      {
        label: strings.trayLanguage,
        submenu: [
          ['auto', strings.trayLanguageAuto],
          ['pt', 'Português'],
          ['en', 'English'],
        ].map(([value, label]) => ({
          label,
          type: 'radio',
          checked: store.get().language === value,
          click: () => setLanguage(value),
        })),
      },
      { type: 'separator' },
      { label: strings.trayQuit, click: quitApp },
    ]),
  );
}

function setLanguage(language) {
  store.update({ language });
  applyLanguage();
  if (tray && !tray.isDestroyed()) tray.setToolTip(strings.trayTooltip);
  updateTrayMenu();
  // A barra lê os textos ao iniciar: recarregá-la aplica o novo idioma.
  if (alive(toolbarWin)) toolbarWin.webContents.reload();
}

function showTrayHintOnce() {
  if (store.get().trayHintShown) return;
  store.update({ trayHintShown: true });
  try {
    if (IS_WIN) {
      tray.displayBalloon({ iconType: 'info', title: strings.trayHintTitle, content: strings.trayHintText });
    } else if (IS_LINUX && Notification.isSupported()) {
      new Notification({ title: strings.trayHintTitle, body: strings.trayHintText, silent: true }).show();
    }
  } catch {
    /* aviso opcional */
  }
}

/* ------------------------------------------------------------------ atalhos */

function registerShortcuts() {
  const bindings = [
    [SHORTCUTS.toggleRuler, () => setState({ rulerVisible: !store.get().rulerVisible })],
    [SHORTCUTS.toggleToolbar, toggleToolbar],
  ];
  for (const [accelerator, handler] of bindings) {
    try {
      if (!globalShortcut.register(accelerator, handler)) {
        console.warn(`[shortcuts] ${accelerator} is already used by another app`);
      }
    } catch (err) {
      console.warn(`[shortcuts] could not register ${accelerator}:`, err.message);
    }
  }
}

/* ---------------------------------------------------------------------- IPC */

const fromToolbar = (event) => alive(toolbarWin) && event.sender === toolbarWin.webContents;

function registerIpc() {
  ipcMain.handle('overlay:init', () => publicState());

  ipcMain.handle('toolbar:init', (event) => {
    if (!fromToolbar(event)) return null;
    return {
      lang,
      strings,
      state: publicState(),
      limits: LIMITS,
      defaults: DEFAULTS,
      spacingPresets: SPACING_PRESETS,
      colorPresets: COLOR_PRESETS,
      shortcuts: formatShortcuts(process.platform),
      platform: process.platform,
      version: app.getVersion(),
      ...toolbarEnv(),
    };
  });

  ipcMain.on('state:update', (event, patch) => {
    if (!fromToolbar(event) || !patch || typeof patch !== 'object') return;
    const allowed = {};
    for (const key of ['spacing', 'color', 'opacity', 'rulerVisible', 'showDistance']) {
      if (key in patch) allowed[key] = patch[key];
    }
    setState(allowed);
  });

  ipcMain.on('toolbar:resize', (event, size) => {
    if (!fromToolbar(event) || !size) return;
    const width = clampInt(size.width, 100, 1600);
    const height = clampInt(size.height, 30, 1200);
    if (!width || !height) return;

    toolbarPanelOpen = Boolean(size.panelOpen);
    toolbarAnchor = size.anchor === 'bottom' ? 'bottom' : 'top';
    if (!toolbarPanelOpen) toolbarClosedHeight = height;

    const b = toolbarWin.getBounds();
    let x = b.x;
    let y = toolbarAnchor === 'bottom' ? b.y + b.height - height : b.y;
    if (!toolbarRevealed && !store.get().toolbarPosition) {
      ({ x, y } = centeredToolbarPosition(width));
    }
    setToolbarBounds({ x, y, width, height });
    revealToolbar();
  });

  // Abre os painéis para cima quando a barra está perto da base da tela.
  ipcMain.handle('toolbar:placement', (event) => {
    if (!fromToolbar(event)) return 'down';
    const b = toolbarWin.getBounds();
    const wa = screen.getDisplayMatching(b).workArea;
    const below = wa.y + wa.height - (b.y + b.height);
    const above = b.y - wa.y;
    return below < PANEL_HEIGHT_ESTIMATE && above > below ? 'up' : 'down';
  });

  ipcMain.on('app:minimize-to-tray', (event) => fromToolbar(event) && minimizeToTray());
  ipcMain.on('app:quit', (event) => fromToolbar(event) && quitApp());
}

/* ------------------------------------------------------------------- ciclo */

function quitApp() {
  isQuitting = true;
  app.quit();
}

function preferredLanguages() {
  try {
    return app.getPreferredSystemLanguages();
  } catch {
    return [];
  }
}

/** Prioridade: LSR_LANG > escolha no menu da bandeja > idioma do sistema. */
function applyLanguage() {
  const chosen = store.get().language;
  lang = resolveLanguage([
    process.env.LSR_LANG,
    chosen !== 'auto' ? chosen : null,
    ...preferredLanguages(),
    app.getLocale(),
  ]);
  strings = getStrings(lang);
}

function start() {
  if (IS_MAC) app.dock?.hide(); // utilitário de barra de menus, sem ícone no Dock

  store = new SettingsStore(app.getPath('userData'));
  applyLanguage();

  Menu.setApplicationMenu(
    IS_MAC ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }]) : null,
  );

  registerIpc();
  syncOverlays();
  createToolbar();
  createTray();
  registerShortcuts();
  startTopmostKeeper();

  const onDisplaysChanged = debounce(() => {
    syncOverlays();
    sendToolbarEnv();
  }, 300);
  screen.on('display-added', onDisplaysChanged);
  screen.on('display-removed', onDisplaysChanged);
  screen.on('display-metrics-changed', onDisplaysChanged);
}

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event) => event.preventDefault());

  // Em desenvolvimento (npm start), mostra no terminal os erros das janelas.
  if (!app.isPackaged) {
    contents.on('console-message', (event) => {
      if (event.level === 'warning' || event.level === 'error') {
        console.log(`[renderer:${event.level}] ${event.message} (${event.sourceId}:${event.lineNumber})`);
      }
    });
    contents.on('preload-error', (_e, preloadPath, error) => {
      console.error(`[preload] ${preloadPath}:`, error);
    });
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  store?.flush();
});

app.on('will-quit', () => globalShortcut.unregisterAll());

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showToolbar);
  app
    .whenReady()
    // No Linux, criar janelas transparentes logo no "ready" às vezes falha.
    .then(() => (IS_LINUX ? new Promise((resolve) => setTimeout(resolve, 300)) : null))
    .then(start);
}
