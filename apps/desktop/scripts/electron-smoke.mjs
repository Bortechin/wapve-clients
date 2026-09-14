import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const desktopDirectory = path.resolve(scriptDirectory, '..');
const repositoryRoot = path.resolve(desktopDirectory, '..', '..');
const artifactDirectory = path.join(repositoryRoot, '.tmp', 'desktop-electron-smoke');
const profileDirectory = path.join(artifactDirectory, 'profile');
const electronExecutable = path.join(
  desktopDirectory,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron',
);

await mkdir(artifactDirectory, { recursive: true });
await mkdir(profileDirectory, { recursive: true });
await writeFile(
  path.join(profileDirectory, 'window-state-v1.json'),
  JSON.stringify({ x: 120, y: 80, width: 1280, height: 800, maximized: true }),
  'utf8',
);

const fixtureHtml = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Wapve Electron Smoke</title></head>
  <body data-result="idle">
    <button id="share" type="button">Share</button>
    <script>
      document.querySelector('#share').addEventListener('click', async () => {
        document.body.dataset.runtime = window.wapveDesktop?.runtime || 'missing';
        document.body.dataset.result = 'pending';
        try {
          window.__wapveTestStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
          document.body.dataset.result = 'resolved';
        } catch (error) {
          document.body.dataset.result = 'rejected';
          document.body.dataset.error = error instanceof Error ? error.name : 'unknown';
        }
      });
    </script>
  </body>
</html>`;

const webServer = createServer((request, response) => {
  if (request.url?.startsWith('/desktop')) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(fixtureHtml);
    return;
  }
  response.writeHead(404).end();
});
const healthServer = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end('{"status":"ok"}');
});

await Promise.all([listen(webServer, 3000), listen(healthServer, 4000)]);

let electronApp;
try {
  electronApp = await electron.launch({
    executablePath: electronExecutable,
    args: [desktopDirectory, `--user-data-dir=${profileDirectory}`],
    env: {
      ...process.env,
      WAPVE_DESKTOP_URL: 'http://127.0.0.1:3000/desktop',
      WAPVE_DESKTOP_SKIP_PROTOCOL: '1',
      WAPVE_DESKTOP_MONITOR_INTERVAL_MS: '250',
      WAPVE_DESKTOP_RETRY_DELAY_MS: '250',
    },
    timeout: 45_000,
  });

  await poll(async () =>
    electronApp.evaluate(({ webContents }) =>
      webContents
        .getAllWebContents()
        .some((contents) => contents.getURL().startsWith('http://127.0.0.1:3000/desktop')),
    ),
  );

  await poll(async () => {
    return electronApp.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (!window || !window.isMaximized()) return false;
      const [width, height] = window.getContentSize();
      const childBounds = window.contentView.children
        .filter((child) => 'webContents' in child)
        .map((child) => child.getBounds());
      return childBounds.every(
        (bounds) =>
          bounds.x === 0 &&
          bounds.y === 38 &&
          bounds.width === width &&
          bounds.height === height - 38,
      );
    });
  });

  await electronApp.evaluate(async ({ webContents }) => {
    const content = webContents
      .getAllWebContents()
      .find((contents) => contents.getURL().startsWith('http://127.0.0.1:3000/desktop'));
    if (!content) throw new Error('Fixture content view not found.');
    await content.executeJavaScript("document.querySelector('#share').click()", true);
  });

  await poll(async () =>
    electronApp.evaluate(async ({ webContents }) => {
      const picker = webContents
        .getAllWebContents()
        .find((contents) => contents.getURL().endsWith('/picker.html'));
      if (!picker) return false;
      return picker.executeJavaScript("document.querySelectorAll('.source-card').length > 0");
    }),
  );

  const pickerState = await electronApp.evaluate(async ({ webContents }) => {
    const picker = webContents
      .getAllWebContents()
      .find((contents) => contents.getURL().endsWith('/picker.html'));
    if (!picker) throw new Error('Capture picker view not found.');
    const state = await picker.executeJavaScript(`({
      title: document.querySelector('#picker-title')?.textContent,
      sourceCount: document.querySelectorAll('.source-card').length,
      selectedCount: document.querySelectorAll('.source-card.active').length,
      shareDisabled: document.querySelector('#picker-share')?.disabled
    })`);
    const image = await picker.capturePage();
    return { state, screenshot: image.toPNG().toString('base64') };
  });

  assert.equal(pickerState.state.title, 'Ekranını paylaş');
  assert.ok(pickerState.state.sourceCount > 0);
  assert.equal(pickerState.state.selectedCount, 1);
  assert.equal(pickerState.state.shareDisabled, false);
  await writeFile(
    path.join(artifactDirectory, 'capture-picker.png'),
    pickerState.screenshot,
    'base64',
  );

  const responsiveState = await electronApp.evaluate(async ({ BrowserWindow, webContents }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window?.unmaximize();
    window?.setSize(1024, 600);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const picker = webContents
      .getAllWebContents()
      .find((contents) => contents.getURL().endsWith('/picker.html'));
    if (!picker) throw new Error('Capture picker view not found.');
    const state = await picker.executeJavaScript(`(() => {
      document.querySelector('#screens-tab').click();
      const screenCount = document.querySelectorAll('.source-card').length;
      document.querySelector('#windows-tab').click();
      const footer = document.querySelector('.picker-dialog > footer').getBoundingClientRect();
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        footerVisible: footer.bottom <= window.innerHeight && footer.top >= 0,
        screenCount
      };
    })()`);
    const image = await picker.capturePage();
    return { state, screenshot: image.toPNG().toString('base64') };
  });
  assert.equal(responsiveState.state.width, 1024);
  assert.equal(responsiveState.state.height, 562);
  assert.equal(responsiveState.state.horizontalOverflow, false);
  assert.equal(responsiveState.state.footerVisible, true);
  assert.ok(responsiveState.state.screenCount > 0);
  await writeFile(
    path.join(artifactDirectory, 'capture-picker-1024x600.png'),
    responsiveState.screenshot,
    'base64',
  );

  await electronApp.evaluate(async ({ webContents }) => {
    const picker = webContents
      .getAllWebContents()
      .find((contents) => contents.getURL().endsWith('/picker.html'));
    if (!picker) throw new Error('Capture picker view not found.');
    await picker.executeJavaScript("document.querySelector('#picker-share').click()", true);
  });

  await poll(async () =>
    electronApp.evaluate(async ({ webContents }) => {
      const content = webContents
        .getAllWebContents()
        .find((contents) => contents.getURL().startsWith('http://127.0.0.1:3000/desktop'));
      if (!content) return false;
      return content.executeJavaScript("document.body.dataset.result === 'resolved'");
    }),
  );

  const result = await electronApp.evaluate(async ({ webContents }) => {
    const content = webContents
      .getAllWebContents()
      .find((contents) => contents.getURL().startsWith('http://127.0.0.1:3000/desktop'));
    if (!content) throw new Error('Fixture content view not found.');
    return content.executeJavaScript(`(() => {
      const state = {
        runtime: document.body.dataset.runtime,
        result: document.body.dataset.result,
        videoTracks: window.__wapveTestStream?.getVideoTracks().length || 0,
        sourceListingExposed: typeof window.wapveDesktop?.listCaptureSources
      };
      for (const track of window.__wapveTestStream?.getTracks() || []) track.stop();
      return state;
    })()`);
  });
  assert.deepEqual(result, {
    runtime: 'electron',
    result: 'resolved',
    videoTracks: 1,
    sourceListingExposed: 'undefined',
  });

  // A brief health endpoint interruption must be recovered in the background
  // without ever replacing the loaded application with the offline shell.
  await closeServer(healthServer);
  const transientObservation = observeOfflineState(electronApp, 9_500);
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  await listen(healthServer, 4000);
  assert.equal(await transientObservation, false);

  await closeServer(healthServer);
  await poll(
    async () =>
      electronApp.evaluate(async ({ webContents }) => {
        const shell = webContents
          .getAllWebContents()
          .find((contents) => contents.getURL().endsWith('/shell.html'));
        if (!shell) return false;
        return shell.executeJavaScript("document.body.dataset.state === 'offline'");
      }),
    25_000,
  );

  const offlineState = await electronApp.evaluate(async ({ BrowserWindow, webContents }) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) throw new Error('Main desktop window not found.');
    const shell = webContents
      .getAllWebContents()
      .find((contents) => contents.getURL().endsWith('/shell.html'));
    if (!shell) throw new Error('Connection shell not found.');
    const shellState = await shell.executeJavaScript(`({
      state: document.body.dataset.state,
      title: document.querySelector('#status-title')?.textContent,
      hint: document.querySelector('#connection-hint')?.textContent,
      retryStatus: document.querySelector('#retry-status')?.textContent
    })`);
    const childViews = window.contentView.children
      .filter((child) => 'webContents' in child)
      .map((child) => ({
        url: child.webContents.getURL(),
        visible: child.getVisible(),
      }));
    const image = await shell.capturePage();
    return { shellState, childViews, screenshot: image.toPNG().toString('base64') };
  });
  assert.equal(offlineState.shellState.state, 'offline');
  assert.equal(offlineState.shellState.title, 'Dalgaya ulaşamıyoruz');
  assert.ok(offlineState.shellState.hint.length > 20);
  assert.match(offlineState.shellState.retryStatus, /Bağlantı denemesi/);
  assert.equal(offlineState.childViews.at(-1)?.url.endsWith('/shell.html'), true);
  assert.equal(offlineState.childViews.at(-1)?.visible, true);
  assert.equal(
    offlineState.childViews.find((view) => view.url.startsWith('http://127.0.0.1:3000/desktop'))
      ?.visible,
    false,
  );
  await writeFile(
    path.join(artifactDirectory, 'connection-offline.png'),
    offlineState.screenshot,
    'base64',
  );

  await listen(healthServer, 4000);
  await poll(
    async () =>
      electronApp.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        if (!window) return false;
        const views = window.contentView.children.filter((child) => 'webContents' in child);
        const top = views.at(-1);
        return (
          top?.getVisible() === true &&
          top.webContents.getURL().startsWith('http://127.0.0.1:3000/desktop')
        );
      }),
    10_000,
  );

  console.log(
    `Electron capture smoke passed with ${pickerState.state.sourceCount} visible sources.`,
  );
  console.log(`Screenshot: ${path.join(artifactDirectory, 'capture-picker.png')}`);
  console.log(`Minimum viewport: ${path.join(artifactDirectory, 'capture-picker-1024x600.png')}`);
  console.log(`Offline fallback: ${path.join(artifactDirectory, 'connection-offline.png')}`);
} finally {
  await electronApp?.close().catch(() => undefined);
  await Promise.all([closeServer(webServer), closeServer(healthServer)]);
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
}

function closeServer(server) {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections?.();
  });
}

async function observeOfflineState(electronApp, durationMs) {
  const deadline = Date.now() + durationMs;
  let sawOffline = false;
  while (Date.now() < deadline) {
    sawOffline ||= await electronApp.evaluate(async ({ webContents }) => {
      const shell = webContents
        .getAllWebContents()
        .find((contents) => contents.getURL().endsWith('/shell.html'));
      if (!shell) return false;
      return shell.executeJavaScript("document.body.dataset.state === 'offline'");
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return sawOffline;
}

async function poll(check, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out after ${timeoutMs}ms.`);
}
