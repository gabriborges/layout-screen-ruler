'use strict';

/**
 * Gera os ícones do app e as imagens da documentação, renderizando a
 * interface REAL (src/renderer) em janelas invisíveis (offscreen).
 * Nada é capturado da sua tela.
 *
 *   npm run assets              -> tudo
 *   npm run assets -- --icons   -> só ícones (build/ e assets/)
 *   npm run assets -- --docs    -> só imagens de docs/images
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');

const { formatShortcuts } = require('../src/shared/config');
const { getStrings } = require('../src/shared/i18n');

// Renderização determinística (software), independente do monitor e da GPU.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('hide-scrollbars');

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const ASSETS = path.join(ROOT, 'assets');
const DOCS_IMAGES = path.join(ROOT, 'docs', 'images');
const TOOLBAR_HTML = path.join(ROOT, 'src', 'renderer', 'toolbar.html');
const SCENE_HTML = path.join(__dirname, 'docs', 'scene.html');
const MOCK_PRELOAD = path.join(__dirname, 'docs', 'mock-preload.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lsr-assets-'));

const argv = new Set(process.argv.slice(2));
const ONLY_ICONS = argv.has('--icons');
const ONLY_DOCS = argv.has('--docs');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function writePng(file, image) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, image.toPNG());
  const { width, height } = image.getSize();
  console.log(`  ✓ ${path.relative(ROOT, file)} (${width}×${height})`);
}

/**
 * Abre `file` numa janela invisível com um viewport EMULADO de width×height
 * pixels CSS e densidade `scale` (via protocolo DevTools) e captura a área
 * `clip`. Assim a imagem pode ser maior que o monitor de quem roda o script.
 *
 * Espera ficar pronto por uma mensagem IPC (`waitForIpc`) ou pelo resultado
 * de um script (`waitScript`).
 */
async function renderPage({ file, query, width, height, scale = 1, preload, waitForIpc, waitScript, clip }) {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      offscreen: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: !preload,
      // Sessão só em memória: nenhum zoom/cache salvo influencia as imagens.
      partition: 'lsr-assets',
      zoomFactor: 1,
      ...(preload ? { preload } : {}),
    },
  });
  const dbg = win.webContents.debugger;
  try {
    // Os comandos do DevTools só respondem depois que existe uma página.
    await win.loadURL('about:blank');
    dbg.attach('1.3');
    await dbg.sendCommand('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: scale,
      mobile: false,
    });
    await dbg.sendCommand('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 0, g: 0, b: 0, a: 0 },
    });

    let ipcReady = null;
    if (waitForIpc) {
      ipcReady = new Promise((resolve) => {
        const handler = (event, payload) => {
          if (event.sender !== win.webContents) return;
          ipcMain.removeListener(waitForIpc, handler);
          resolve(payload);
        };
        ipcMain.on(waitForIpc, handler);
      });
    }
    await win.loadFile(file, query ? { query } : undefined);
    const info = ipcReady ? await ipcReady : await win.webContents.executeJavaScript(waitScript || 'true');
    await delay(300);

    const area = typeof clip === 'function' ? clip(info) : clip || { x: 0, y: 0, width, height };
    const { data } = await dbg.sendCommand('Page.captureScreenshot', {
      format: 'png',
      clip: { ...area, scale: 1 },
    });
    return { image: nativeImage.createFromBuffer(Buffer.from(data, 'base64')), info };
  } finally {
    if (dbg.isAttached()) dbg.detach();
    win.destroy();
  }
}

/* ------------------------------------------------------------------ ícones */

async function renderSvg(svgFile, size) {
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent;overflow:hidden}img{display:block}</style><img src="${pathToFileURL(svgFile).href}" width="${size}" height="${size}">`;
  const htmlFile = path.join(TMP, `svg-${path.basename(svgFile)}-${size}.html`);
  fs.writeFileSync(htmlFile, html);
  const { image } = await renderPage({
    file: htmlFile,
    width: size,
    height: size,
    waitScript: 'Promise.all([...document.images].map((i) => i.decode())).then(() => true)',
  });
  return image;
}

async function generateIcons() {
  console.log('Ícones:');
  const logo = path.join(BUILD, 'icon.svg');
  writePng(path.join(BUILD, 'icon.png'), await renderSvg(logo, 1024));
  writePng(path.join(ASSETS, 'icon.png'), await renderSvg(logo, 256));

  const tray = path.join(BUILD, 'tray.svg');
  for (const [suffix, size] of [['', 16], ['@1.25x', 20], ['@1.5x', 24], ['@2x', 32]]) {
    writePng(path.join(ASSETS, 'tray', `tray${suffix}.png`), await renderSvg(tray, size));
  }
  const template = path.join(BUILD, 'trayTemplate.svg');
  for (const [suffix, size] of [['', 16], ['@2x', 32]]) {
    writePng(path.join(ASSETS, 'tray', `trayTemplate${suffix}.png`), await renderSvg(template, size));
  }

  fs.mkdirSync(DOCS_IMAGES, { recursive: true });
  fs.copyFileSync(logo, path.join(DOCS_IMAGES, 'logo.svg'));
  console.log('  ✓ docs/images/logo.svg');
}

/* ---------------------------------------------------- barra (real) */

const ZOOM = 2; // imagens em 2x: nítidas em telas retina

async function captureToolbar(lang, query) {
  const { image, info } = await renderPage({
    file: TOOLBAR_HTML,
    query: { lang, ...query },
    width: 1000,
    height: 700,
    scale: ZOOM,
    preload: MOCK_PRELOAD,
    waitForIpc: 'mock:ready',
    clip: ({ size }) => ({ x: 0, y: 0, width: size.width, height: size.height }),
  });
  const file = path.join(TMP, `toolbar-${lang}-${Object.values(query).join('-').replace(/[^\w-]/g, '')}.png`);
  fs.writeFileSync(file, image.toPNG());
  return { src: pathToFileURL(file).href, width: info.size.width, height: info.size.height, rects: info.rects };
}

/* ---------------------------------------------------------- cenas */

async function captureScene(spec, outFile) {
  const { image } = await renderPage({
    file: SCENE_HTML,
    query: { spec: JSON.stringify(spec) },
    width: spec.width,
    height: spec.height,
    scale: spec.zoom || ZOOM,
    waitScript: 'window.sceneReady',
  });
  writePng(outFile, image);
}

const LABELS = {
  pt: {
    url: 'meusite.com.br',
    heading: 'Seu layout, alinhado ao pixel',
    button: 'Começar',
    guide: [
      'Arrastar e mover a barra',
      'Distância entre as linhas',
      'Cor das linhas',
      'Mostrar a distância em px',
      'Ligar / desligar a régua',
      'Minimizar para a bandeja',
      'Fechar o programa',
    ],
    on: 'Régua ligada',
    off: 'Régua desligada',
    shortcut: 'Atalho',
    trayCallout: 'Minimizada: a barra some, a grade continua. Clique no ícone da régua para reabrir.',
    layers: [
      ['Barra de ferramentas', 'Fica por cima de tudo e recebe os seus cliques.'],
      ['Grade da régua', 'Transparente: os cliques atravessam as linhas.'],
      ['Seus apps, sites e designs', 'Continuam funcionando normalmente embaixo da grade.'],
    ],
    tagline: 'Grade de linhas sobre a tela inteira para conferir alinhamentos de layout.',
    platforms: 'Windows · macOS · Linux · grátis e open source',
  },
  en: {
    url: 'mysite.com',
    heading: 'Your layout, pixel-aligned',
    button: 'Get started',
    guide: [
      'Drag to move the toolbar',
      'Distance between lines',
      'Line color',
      'Show the distance in px',
      'Turn the ruler on / off',
      'Minimize to the tray',
      'Quit the app',
    ],
    on: 'Ruler on',
    off: 'Ruler off',
    shortcut: 'Shortcut',
    trayCallout: 'Minimized: the toolbar hides, the grid stays. Click the ruler icon to bring it back.',
    layers: [
      ['Toolbar', 'Stays on top of everything and receives your clicks.'],
      ['Ruler grid', 'Transparent: clicks go right through the lines.'],
      ['Your apps, sites and designs', 'Keep working normally under the grid.'],
    ],
    tagline: 'A grid of lines over your whole screen to check layout alignment.',
    platforms: 'Windows · macOS · Linux · free and open source',
  },
};

async function generateDocs() {
  const trayIcon = pathToFileURL(path.join(ASSETS, 'tray', 'tray@2x.png')).href;
  const logo = pathToFileURL(path.join(BUILD, 'icon.svg')).href;

  for (const lang of ['pt', 'en']) {
    console.log(`Documentação (${lang}):`);
    const out = (name) => path.join(DOCS_IMAGES, lang, `${name}.png`);
    const base = {
      lang,
      labels: LABELS[lang],
      strings: getStrings(lang),
      shortcuts: formatShortcuts('win32'),
      trayIcon,
      logo,
    };

    const tbMain = await captureToolbar(lang, { spacing: 40, distance: 1 });
    const tbSpacing = await captureToolbar(lang, { spacing: 24, open: 'spacing' });
    const tbColor = await captureToolbar(lang, { spacing: 40, color: '#00e5ff', open: 'color' });

    await captureScene({ ...base, mode: 'hero', width: 1280, height: 720, toolbar: tbMain }, out('hero'));
    await captureScene({ ...base, mode: 'guide', width: 1100, height: 400, toolbar: tbMain }, out('toolbar-guide'));
    await captureScene({ ...base, mode: 'spacing', width: 960, height: 560, toolbar: tbSpacing }, out('spacing'));
    await captureScene({ ...base, mode: 'color', width: 960, height: 560, toolbar: tbColor }, out('color'));
    await captureScene({ ...base, mode: 'distance', width: 960, height: 420, toolbar: tbMain }, out('distance'));
    await captureScene({ ...base, mode: 'toggle', width: 1100, height: 430 }, out('toggle'));
    await captureScene({ ...base, mode: 'tray', width: 1000, height: 480 }, out('tray'));
    await captureScene({ ...base, mode: 'layers', width: 1100, height: 600, toolbar: tbMain }, out('how-it-works'));
    await captureScene(
      { ...base, mode: 'social', width: 1280, height: 640, zoom: 1, toolbar: tbMain },
      out('social-preview'),
    );
  }
}

/* ------------------------------------------------------------------- main */

app.on('window-all-closed', () => {
  /* não encerrar entre uma captura e outra */
});

app.whenReady().then(async () => {
  try {
    if (!ONLY_DOCS) await generateIcons();
    if (!ONLY_ICONS) await generateDocs();
    console.log('Pronto.');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
    app.quit();
  }
});
