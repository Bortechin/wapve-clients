import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  Menu,
  nativeImage,
  net,
  protocol,
  screen,
  session,
  shell,
  Tray,
  WebContentsView,
  type DesktopCapturerSource,
  type Rectangle,
  type Session,
} from 'electron';
import { readRunningGame } from './game-detection.js';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyNavigation,
  classifyNewWindow,
  desktopBootstrapUrl,
  findDeepLink,
  isCaptureSourceId,
  isCloudflareOrServerErrorTitle,
  isDevToolsShortcut,
  isServerErrorStatusCode,
  isTrustedContentUrl,
  mapToContentOrigin,
  resolveContentHome,
} from './security.js';

const TITLEBAR_HEIGHT = 38;
const MIN_WIDTH = 1_024;
const MIN_HEIGHT = 600;
const HEALTH_TIMEOUT_MS = 12_000;
const HEALTH_MONITOR_INTERVAL_MS = app.isPackaged
  ? 30_000
  : readDevelopmentDuration('WAPVE_DESKTOP_MONITOR_INTERVAL_MS', 30_000);
const RETRY_DELAYS_MS = [3_000, 8_000, 15_000, 30_000] as const;
const OFFLINE_TRANSITION_GRACE_MS = 8_000;
const DEVELOPMENT_RETRY_DELAY_MS = app.isPackaged
  ? null
  : readDevelopmentDuration('WAPVE_DESKTOP_RETRY_DELAY_MS', 0);
const CONNECTION_CONFIRMATION_DELAY_MS =
  DEVELOPMENT_RETRY_DELAY_MS && DEVELOPMENT_RETRY_DELAY_MS > 0 ? DEVELOPMENT_RETRY_DELAY_MS : 2_000;
const MAX_CAPTURE_SOURCES = 100;
const CAPTURE_SOURCES_CACHE_MS = 15_000;
const CAPTURE_SELECTION_TTL_MS = 8_000;
const CONTENT_PARTITION = 'persist:wapve';
const LOCAL_UI_SCHEME = 'wapve-local';
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

type ConnectionState = 'checking' | 'online' | 'offline';
type ConnectionSnapshot = {
  state: ConnectionState;
  attempt: number;
  retryAt: number | null;
};
type StoredWindowState = Rectangle & { maximized?: boolean };
type CapturePickerSelection = {
  sourceId: string;
  quality: 'balanced' | 'high';
};

let runningGame: string | null = null;
let gamePollBusy = false;
let gameTimer: NodeJS.Timeout | undefined;
let mainWindow: BrowserWindow | null = null;
let contentView: WebContentsView | null = null;
let shellView: WebContentsView | null = null;
let capturePickerView: WebContentsView | null = null;
let tray: Tray | null = null;
let quitting = false;
let healthReady = false;
let contentLoaded = false;
let connectionCheck: Promise<void> | null = null;
let connectionTimer: NodeJS.Timeout | null = null;
let offlineTransitionTimer: NodeJS.Timeout | null = null;
let failedConnectionAttempts = 0;
let connectionSnapshot: ConnectionSnapshot = { state: 'checking', attempt: 1, retryAt: null };
let stateSaveTimer: NodeJS.Timeout | null = null;
let capturePickerResolver: ((selection: CapturePickerSelection | null) => void) | null = null;
let lastCaptureSettings: { quality: 'balanced' | 'high' } | null = null;
let captureSelectionPromise: Promise<CapturePickerSelection | null> | null = null;
let pendingCaptureSelection: { selection: CapturePickerSelection; expiresAt: number } | null = null;
let captureSourcesPromise: Promise<DesktopCapturerSource[]> | null = null;
let captureSourcesCache: {
  sources: DesktopCapturerSource[];
  expiresAt: number;
} | null = null;
let contentLoadPromise: Promise<void> | null = null;

const contentHome = resolveContentHome(process.env.WAPVE_DESKTOP_URL, app.isPackaged);
const healthUrl = createHealthUrl(contentHome);
const coldStartDestination = findDeepLink(process.argv);
const initialContentUrl = desktopBootstrapUrl(contentHome, coldStartDestination);

app.setName('Wapve');
app.setAppUserModelId('com.wapve.desktop');
protocol.registerSchemesAsPrivileged([
  {
    scheme: LOCAL_UI_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);
registerProtocolClient();

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const destination = findDeepLink(commandLine);
    if (destination) navigateToDestination(destination);
    showMainWindow();
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    const destination = findDeepLink([url]);
    if (destination) navigateToDestination(destination);
    showMainWindow();
  });

  app
    .whenReady()
    .then(startApplication)
    .catch(async (error: unknown) => {
      console.error('Failed to start Wapve desktop:', error);
      await writeFile(
        path.join(app.getPath('userData'), 'startup-error.log'),
        `${new Date().toISOString()}\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
        'utf8',
      ).catch(() => undefined);
      app.exit(1);
    });
}

app.on('window-all-closed', () => {
  // Wapve intentionally remains available from the tray.
});

app.on('before-quit', () => {
  quitting = true;
  clearConnectionTimer();
  clearOfflineTransitionTimer();
  void persistWindowState();
});

async function startApplication(): Promise<void> {
  Menu.setApplicationMenu(null);
  registerLocalUiProtocol();
  configureContentSession(session.fromPartition(CONTENT_PARTITION));
  registerIpcHandlers();
  const pollGame = async () => {
    if (gamePollBusy) return;
    gamePollBusy = true;
    try { runningGame = await readRunningGame(runningGame); }
    catch { runningGame = null; }
    finally { gamePollBusy = false; }
  };
  void pollGame();
  gameTimer = setInterval(() => void pollGame(), 15_000);
  app.once('will-quit', () => clearInterval(gameTimer));
  await createMainWindow();
  createTray();
  showMainWindow();
  void checkConnection();
}

async function createMainWindow(): Promise<void> {
  const storedState = await readWindowState();
  const bounds = restoreBounds(storedState);
  const iconPath = runtimeResourcePath('wapve-icon.ico', 'src-tauri/icons/icon.ico');

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    frame: false,
    backgroundColor: '#050713',
    darkTheme: true,
    hasShadow: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(moduleDirectory, 'preload-shell.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
    },
  });

  const remoteSession = session.fromPartition(CONTENT_PARTITION);
  contentView = new WebContentsView({
    webPreferences: {
      partition: CONTENT_PARTITION,
      preload: path.join(moduleDirectory, 'preload-content.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      backgroundThrottling: false,
      devTools: !app.isPackaged,
      spellcheck: true,
    },
  });
  shellView = new WebContentsView({
    webPreferences: {
      preload: path.join(moduleDirectory, 'preload-shell.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
    },
  });
  capturePickerView = new WebContentsView({
    webPreferences: {
      preload: path.join(moduleDirectory, 'preload-picker.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.contentView.addChildView(contentView);
  mainWindow.contentView.addChildView(shellView);
  mainWindow.contentView.addChildView(capturePickerView);
  contentView.setVisible(false);
  shellView.setVisible(true);
  capturePickerView.setVisible(false);
  capturePickerView.setBackgroundColor('#00000000');
  resizeChildViews();

  configureContentWebContents(remoteSession);
  configureLocalWebContents(mainWindow.webContents);
  configureLocalWebContents(shellView.webContents);
  configureLocalWebContents(capturePickerView.webContents);
  shellView.webContents.on('did-finish-load', () => publishConnectionState(connectionSnapshot));

  // Register geometry listeners before restoring a maximized window. Electron
  // can emit the initial maximize/resize events synchronously, and missing
  // them leaves WebContentsView children at the stored normal-window size.
  mainWindow.on('resize', handleWindowGeometryChange);
  mainWindow.on('maximize', handleWindowGeometryChange);
  mainWindow.on('unmaximize', handleWindowGeometryChange);
  mainWindow.on('restore', handleWindowGeometryChange);
  mainWindow.on('enter-full-screen', handleWindowGeometryChange);
  mainWindow.on('leave-full-screen', handleWindowGeometryChange);
  mainWindow.on('show', resizeChildViews);
  mainWindow.on('move', scheduleWindowStateSave);

  await Promise.all([
    mainWindow.loadURL(`${LOCAL_UI_SCHEME}://ui/index.html`),
    shellView.webContents.loadURL(`${LOCAL_UI_SCHEME}://ui/shell.html`),
    capturePickerView.webContents.loadURL(`${LOCAL_UI_SCHEME}://ui/picker.html`),
  ]);
  // Enumerate capture sources while the app is starting so the first user click
  // can render the picker from a warm cache instead of blocking on thumbnails.
  void getCaptureSources();
  void loadContentUrl(initialContentUrl.href);

  if (storedState?.maximized) mainWindow.maximize();
  resizeChildViews();
  setImmediate(resizeChildViews);
  mainWindow.once('ready-to-show', showMainWindow);
  mainWindow.on('focus', () => mainWindow?.flashFrame(false));
  mainWindow.on('blur', () => {
    // No unread badge/attention request is emitted by Wapve. Explicitly clear
    // both Windows attention state and any stale overlay icon so a background
    // socket event can never make the taskbar flash forever.
    mainWindow?.flashFrame(false);
    mainWindow?.setOverlayIcon(null, '');
  });
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      finishCapturePicker(null);
      mainWindow?.hide();
      scheduleWindowStateSave();
    }
  });
  mainWindow.on('closed', () => {
    clearConnectionTimer();
    clearOfflineTransitionTimer();
    contentView?.webContents.close();
    shellView?.webContents.close();
    capturePickerView?.webContents.close();
    contentView = null;
    shellView = null;
    capturePickerView = null;
    mainWindow = null;
  });
}

function registerLocalUiProtocol(): void {
  const uiRoot = path.resolve(app.getAppPath(), 'dist');
  session.defaultSession.protocol.handle(LOCAL_UI_SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'ui' || url.search || url.hash) return localUiNotFound();
      const relativePath = decodeURIComponent(url.pathname.slice(1));
      if (!relativePath || relativePath.includes('\\') || relativePath.includes('\0')) {
        return localUiNotFound();
      }
      const filePath = path.resolve(uiRoot, relativePath);
      if (!filePath.startsWith(`${uiRoot}${path.sep}`)) return localUiNotFound();
      const extension = path.extname(filePath).toLocaleLowerCase();
      const contentType = new Map([
        ['.html', 'text/html; charset=utf-8'],
        ['.js', 'text/javascript; charset=utf-8'],
        ['.css', 'text/css; charset=utf-8'],
        ['.png', 'image/png'],
        ['.webp', 'image/webp'],
        ['.svg', 'image/svg+xml'],
        ['.woff2', 'font/woff2'],
      ]).get(extension);
      if (!contentType) return localUiNotFound();
      const body = await readFile(filePath);
      return new Response(new Uint8Array(body), {
        status: 200,
        headers: {
          'content-type': contentType,
          'cache-control': app.isPackaged ? 'public, max-age=31536000, immutable' : 'no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    } catch {
      return localUiNotFound();
    }
  });
}

function localUiNotFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' },
  });
}

function configureContentSession(contentSession: Session): void {
  const permissionAllowed = (webContentsUrl: string, requestingOrigin: string): boolean => {
    if (!contentView || contentView.webContents.isDestroyed()) return false;
    return (
      webContentsUrl === contentView.webContents.getURL() &&
      isTrustedContentUrl(webContentsUrl, contentHome) &&
      isSameSecurityOrigin(requestingOrigin, contentHome)
    );
  };

  contentSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    if (!webContents || webContents !== contentView?.webContents) return false;
    return (
      permissionAllowed(webContents.getURL(), requestingOrigin) &&
      ['media', 'clipboard-sanitized-write', 'fullscreen'].includes(permission)
    );
  });

  contentSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingOrigin =
      'securityOrigin' in details && typeof details.securityOrigin === 'string'
        ? details.securityOrigin
        : details.requestingUrl;
    const allowed =
      webContents === contentView?.webContents &&
      permissionAllowed(webContents.getURL(), requestingOrigin) &&
      ['media', 'display-capture', 'clipboard-sanitized-write', 'fullscreen'].includes(permission);
    callback(allowed);
  });

  contentSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      void (async () => {
        const frameUrl = request.frame?.url ?? '';
        const hasPendingSelection = Boolean(captureSelectionPromise || pendingCaptureSelection);
        if (
          !request.videoRequested ||
          (!request.userGesture && !hasPendingSelection) ||
          !isTrustedContentUrl(frameUrl, contentHome) ||
          !isSameSecurityOrigin(request.securityOrigin, contentHome)
        ) {
          callback({});
          return;
        }

        let selected = consumePendingCaptureSelection();
        if (!selected && captureSelectionPromise) {
          selected = await captureSelectionPromise;
          if (selected)
            pendingCaptureSelection = {
              selection: selected,
              expiresAt: Date.now() + CAPTURE_SELECTION_TTL_MS,
            };
          selected = consumePendingCaptureSelection();
        }
        // Compatibility path for older renderers/installed builds that do
        // not use chooseCaptureSource yet.
        if (!selected) selected = await openCapturePicker();
        if (!selected) {
          callback({});
          return;
        }
        let sources = await getCaptureSources();
        let source = sources.find((candidate) => candidate.id === selected.sourceId);
        if (!source) {
          sources = await getCaptureSources(true);
          source = sources.find((candidate) => candidate.id === selected.sourceId);
        }
        if (!source) {
          callback({});
          return;
        }
        lastCaptureSettings = { quality: selected.quality };
        callback({ video: source });
      })().catch(() => callback({}));
    },
    { useSystemPicker: false },
  );
}

function configureContentWebContents(contentSession: Session): void {
  const webContents = contentView?.webContents;
  if (!webContents) return;
  enforcePackagedDevToolsLock(webContents);

  contentSession.webRequest.onHeadersReceived(
    { urls: [`${contentHome.origin}/*`] },
    (details, callback) => {
      if (details.resourceType === 'mainFrame' && isServerErrorStatusCode(details.statusCode)) {
        contentLoaded = false;
        transitionConnectionOffline(true);
      }
      callback({ responseHeaders: details.responseHeaders });
    },
  );

  webContents.on('did-navigate', (_event, _url, httpResponseCode) => {
    if (isServerErrorStatusCode(httpResponseCode)) {
      contentLoaded = false;
      transitionConnectionOffline(true);
    }
  });

  webContents.on('did-finish-load', () => {
    const title = webContents.getTitle();
    if (isCloudflareOrServerErrorTitle(title)) {
      contentLoaded = false;
      transitionConnectionOffline(true);
      return;
    }
    contentLoaded = true;
    revealContentIfReady();
  });
  webContents.on('did-fail-load', (_event, errorCode, _description, _url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    contentLoaded = false;
    transitionConnectionOffline(true);
  });
  webContents.on('render-process-gone', () => {
    transitionConnectionOffline(true);
  });
  webContents.on('context-menu', (event) => event.preventDefault());
  webContents.on('will-navigate', (event, url) => handleTopLevelNavigation(event, url));
  webContents.on('will-redirect', (event, url) => handleTopLevelNavigation(event, url));
  webContents.setWindowOpenHandler(({ url }) => {
    const decision = classifyNewWindow(url, contentHome);
    if (decision.kind === 'external') void shell.openExternal(decision.url.href);
    return { action: 'deny' };
  });
  webContents.on('before-input-event', (event, input) => {
    if (app.isPackaged && isDevToolsShortcut(input)) {
      event.preventDefault();
    }
  });
}

function configureLocalWebContents(webContents: Electron.WebContents): void {
  enforcePackagedDevToolsLock(webContents);
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  webContents.on('will-navigate', (event) => event.preventDefault());
  webContents.on('before-input-event', (event, input) => {
    if (app.isPackaged && isDevToolsShortcut(input)) {
      event.preventDefault();
    }
  });
}

function enforcePackagedDevToolsLock(webContents: Electron.WebContents): void {
  if (!app.isPackaged) return;
  webContents.on('devtools-opened', () => {
    if (!webContents.isDestroyed()) webContents.closeDevTools();
  });
}

function handleTopLevelNavigation(event: Electron.Event, url: string): void {
  const decision = classifyNavigation(url, contentHome);
  if (decision.kind === 'internal') return;
  event.preventDefault();
  if (decision.kind === 'external') void shell.openExternal(decision.url.href);
}

function registerIpcHandlers(): void {
  ipcMain.handle('activity:current-game', (event) => {
    assertContentSender(event.sender, event.senderFrame?.url ?? '');
    if (event.senderFrame !== event.sender.mainFrame) throw new Error('Untrusted activity frame.');
    return runningGame;
  });
  ipcMain.handle('window:minimize', (event) => {
    if (isLocalSender(event.sender)) mainWindow?.minimize();
  });
  ipcMain.handle('window:toggle-maximize', (event) => {
    if (!isLocalSender(event.sender) || !mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window:close', (event) => {
    if (isLocalSender(event.sender)) mainWindow?.close();
  });
  ipcMain.handle('shell:retry-connection', (event) => {
    if (isLocalSender(event.sender)) return checkConnection(true);
    return undefined;
  });
  ipcMain.on('content:connectivity-change', (event, online: unknown) => {
    if (event.sender !== contentView?.webContents || typeof online !== 'boolean') return;
    if (!online) {
      transitionConnectionOffline();
      return;
    }
    void checkConnection(false);
  });
  ipcMain.handle('capture-picker:list-sources', async (event, forceRefresh: unknown) => {
    assertCapturePickerSender(event.sender);
    const sources = await getCaptureSources(forceRefresh === true);
    return sources.slice(0, MAX_CAPTURE_SOURCES).map((source) => ({
      id: source.id,
      name: source.name.slice(0, 160),
      kind: source.id.startsWith('screen:') ? ('screen' as const) : ('window' as const),
      thumbnail: source.thumbnail.isEmpty() ? null : source.thumbnail.toDataURL(),
      appIcon: source.appIcon?.isEmpty() === false ? source.appIcon.toDataURL() : null,
    }));
  });
  ipcMain.handle('capture-picker:select', async (event, input: unknown) => {
    assertCapturePickerSender(event.sender);
    if (!isCapturePickerSelection(input)) throw new Error('Invalid capture selection.');
    let sources = await getCaptureSources();
    if (!sources.some((source) => source.id === input.sourceId)) {
      sources = await getCaptureSources(true);
    }
    if (!sources.some((source) => source.id === input.sourceId)) {
      throw new Error('Capture source is no longer available.');
    }
    finishCapturePicker(input);
  });
  ipcMain.handle('capture-picker:cancel', (event) => {
    assertCapturePickerSender(event.sender);
    finishCapturePicker(null);
  });
  ipcMain.handle('capture:choose-source', async (event) => {
    assertContentSender(event.sender, event.senderFrame?.url ?? '');
    if (captureSelectionPromise || capturePickerResolver) return null;
    const selectionPromise = openCapturePicker();
    captureSelectionPromise = selectionPromise;
    try {
      const selection = await selectionPromise;
      if (!selection) return null;
      pendingCaptureSelection = { selection, expiresAt: Date.now() + CAPTURE_SELECTION_TTL_MS };
      return { quality: selection.quality };
    } finally {
      if (captureSelectionPromise === selectionPromise) captureSelectionPromise = null;
    }
  });
  ipcMain.handle('capture:take-settings', (event) => {
    assertContentSender(event.sender, event.senderFrame?.url ?? '');
    const settings = lastCaptureSettings;
    lastCaptureSettings = null;
    return settings;
  });
}

async function getCaptureSources(forceRefresh = false): Promise<DesktopCapturerSource[]> {
  const now = Date.now();
  if (!forceRefresh && captureSourcesCache && captureSourcesCache.expiresAt > now) {
    return captureSourcesCache.sources;
  }
  if (captureSourcesPromise) return captureSourcesPromise;
  captureSourcesPromise = desktopCapturer
    .getSources({
      types: ['window', 'screen'],
      // Large thumbnails and native window icons make Chromium enumerate and
      // rasterize every source before the picker can render. Small previews
      // are sufficient for choosing a source and make the picker responsive.
      thumbnailSize: { width: 240, height: 135 },
      fetchWindowIcons: false,
    })
    .then((sources) => {
      captureSourcesCache = { sources, expiresAt: Date.now() + CAPTURE_SOURCES_CACHE_MS };
      return sources;
    })
    .finally(() => {
      captureSourcesPromise = null;
    });
  return captureSourcesPromise;
}

function openCapturePicker(): Promise<CapturePickerSelection | null> {
  if (
    capturePickerResolver ||
    !capturePickerView ||
    capturePickerView.webContents.isDestroyed() ||
    !mainWindow ||
    mainWindow.isDestroyed()
  ) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    capturePickerResolver = resolve;
    capturePickerView?.setVisible(true);
    if (mainWindow?.isFocused()) capturePickerView?.webContents.focus();
    capturePickerView?.webContents.send('capture-picker:open');
  });
}

function finishCapturePicker(selection: CapturePickerSelection | null): void {
  const resolve = capturePickerResolver;
  capturePickerResolver = null;
  const shouldFocus = mainWindow?.isFocused() === true;
  capturePickerView?.setVisible(false);
  if (shouldFocus) contentView?.webContents.focus();
  resolve?.(selection);
}

function consumePendingCaptureSelection(): CapturePickerSelection | null {
  const pending = pendingCaptureSelection;
  pendingCaptureSelection = null;
  if (!pending || pending.expiresAt < Date.now()) return null;
  return pending.selection;
}

function isCapturePickerSelection(value: unknown): value is CapturePickerSelection {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    isCaptureSourceId(candidate.sourceId) &&
    (candidate.quality === 'balanced' || candidate.quality === 'high')
  );
}

function assertCapturePickerSender(sender: Electron.WebContents): void {
  if (sender !== capturePickerView?.webContents) {
    throw new Error('Untrusted capture picker IPC sender.');
  }
}

function assertContentSender(sender: Electron.WebContents, frameUrl: string): void {
  if (sender !== contentView?.webContents || !isTrustedContentUrl(frameUrl, contentHome)) {
    throw new Error('Untrusted desktop IPC sender.');
  }
}

function isLocalSender(sender: Electron.WebContents): boolean {
  return sender === mainWindow?.webContents || sender === shellView?.webContents;
}

async function checkConnection(announceChecking = false): Promise<void> {
  if (connectionCheck) return connectionCheck;
  clearConnectionTimer();
  if (announceChecking || connectionSnapshot.state === 'checking') {
    clearOfflineTransitionTimer();
    showConnectionShell({
      state: 'checking',
      attempt: Math.max(1, failedConnectionAttempts + 1),
      retryAt: null,
    });
  }
  connectionCheck = (async () => {
    try {
      if (!net.isOnline()) throw new Error('Chromium reports that the network is offline.');
      const probeUrl = new URL(healthUrl);
      probeUrl.searchParams.set('connection_probe', String(Date.now()));
      const response = await net.fetch(probeUrl.href, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) throw new Error(`Health check returned ${response.status}.`);
      clearOfflineTransitionTimer();
      healthReady = true;
      failedConnectionAttempts = 0;
      publishConnectionState({ state: 'online', attempt: 1, retryAt: null });
      if (!contentLoaded) void loadContentUrl(recoverableContentUrl());
      revealContentIfReady();
      scheduleConnectionCheck(HEALTH_MONITOR_INTERVAL_MS);
    } catch {
      transitionConnectionOffline();
    }
  })().finally(() => {
    connectionCheck = null;
  });
  return connectionCheck;
}

function transitionConnectionOffline(immediate = false): void {
  if (connectionSnapshot.state === 'offline') {
    scheduleOfflineRetry();
    return;
  }
  if (immediate || !contentLoaded) {
    clearOfflineTransitionTimer();
    healthReady = false;
    finishCapturePicker(null);
    scheduleOfflineRetry();
    return;
  }
  if (!offlineTransitionTimer) {
    offlineTransitionTimer = setTimeout(() => {
      offlineTransitionTimer = null;
      healthReady = false;
      finishCapturePicker(null);
      scheduleOfflineRetry();
    }, OFFLINE_TRANSITION_GRACE_MS);
  }

  // A single Cloudflare/origin timeout or a momentary Chromium `offline`
  // event must not replace a healthy, already loaded app with the connection
  // shell. Keep the content visible during the grace period and actively
  // confirm connectivity; a successful probe cancels the pending transition.
  scheduleConnectionCheck(CONNECTION_CONFIRMATION_DELAY_MS);
}

function scheduleOfflineRetry(): void {
  healthReady = false;
  const delay = connectionRetryDelay(failedConnectionAttempts);
  failedConnectionAttempts += 1;
  const retryAt = Date.now() + delay;
  showConnectionShell({ state: 'offline', attempt: failedConnectionAttempts, retryAt });
  scheduleConnectionCheck(delay);
}

function connectionRetryDelay(failedAttempts: number): number {
  if (DEVELOPMENT_RETRY_DELAY_MS && DEVELOPMENT_RETRY_DELAY_MS > 0) {
    return DEVELOPMENT_RETRY_DELAY_MS;
  }
  const index = Math.min(Math.max(0, failedAttempts), RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index] ?? 30_000;
}

function scheduleConnectionCheck(delay: number): void {
  clearConnectionTimer();
  connectionTimer = setTimeout(() => {
    connectionTimer = null;
    void checkConnection(false);
  }, delay);
}

function clearConnectionTimer(): void {
  if (!connectionTimer) return;
  clearTimeout(connectionTimer);
  connectionTimer = null;
}

function clearOfflineTransitionTimer(): void {
  if (!offlineTransitionTimer) return;
  clearTimeout(offlineTransitionTimer);
  offlineTransitionTimer = null;
}

function showConnectionShell(snapshot: ConnectionSnapshot): void {
  publishConnectionState(snapshot);
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    !shellView ||
    shellView.webContents.isDestroyed()
  ) {
    return;
  }
  contentView?.setVisible(false);
  shellView.setVisible(true);
  mainWindow.contentView.addChildView(shellView);
  if (mainWindow.isFocused()) shellView.webContents.focus();
}

function publishConnectionState(snapshot: ConnectionSnapshot): void {
  connectionSnapshot = snapshot;
  if (shellView && !shellView.webContents.isDestroyed()) {
    shellView.webContents.send('shell:connection-state', snapshot);
  }
}

function revealContentIfReady(): void {
  if (!healthReady || !contentLoaded) return;
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    !contentView ||
    contentView.webContents.isDestroyed()
  ) {
    return;
  }
  const shellWasVisible = shellView?.getVisible() === true;
  const shouldFocus = mainWindow.isFocused();
  shellView?.setVisible(false);
  contentView.setVisible(true);
  if (shellWasVisible) mainWindow.contentView.addChildView(contentView);
  if (capturePickerResolver && capturePickerView?.getVisible()) {
    mainWindow.contentView.addChildView(capturePickerView);
    if (shouldFocus) capturePickerView.webContents.focus();
  } else if (shouldFocus) {
    contentView.webContents.focus();
  }
}

function resizeChildViews(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const size = mainWindow.getContentSize();
  const width = size[0] ?? MIN_WIDTH;
  const height = size[1] ?? MIN_HEIGHT;
  const bounds = { x: 0, y: TITLEBAR_HEIGHT, width, height: Math.max(0, height - TITLEBAR_HEIGHT) };
  contentView?.setBounds(bounds);
  shellView?.setBounds(bounds);
  capturePickerView?.setBounds(bounds);
}

function handleWindowGeometryChange(): void {
  resizeChildViews();
  scheduleWindowStateSave();
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  resizeChildViews();
  setImmediate(resizeChildViews);
  mainWindow.focus();
  mainWindow.flashFrame(false);
}

function createTray(): void {
  const icon = nativeImage.createFromPath(
    runtimeResourcePath('wapve-tray.png', 'src-tauri/icons/32x32.png'),
  );
  tray = new Tray(icon.resize({ width: 20, height: 20 }));
  tray.setToolTip('Wapve');
  const turkish = app.getLocale().toLocaleLowerCase().startsWith('tr');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: turkish ? "Wapve'yi Aç" : 'Open Wapve', click: showMainWindow },
      { type: 'separator' },
      {
        label: turkish ? 'Çıkış' : 'Quit',
        click: () => {
          quitting = true;
          void persistWindowState().finally(() => app.quit());
        },
      },
    ]),
  );
  tray.on('double-click', showMainWindow);
}

function navigateToDestination(destination: URL): void {
  if (!contentView || contentView.webContents.isDestroyed()) return;
  const mapped = mapToContentOrigin(contentHome, destination);
  void loadContentUrl(mapped.href);
}

function recoverableContentUrl(): string {
  const currentUrl = contentView?.webContents.getURL() ?? '';
  return isTrustedContentUrl(currentUrl, contentHome) ? currentUrl : initialContentUrl.href;
}

function loadContentUrl(url: string): Promise<void> {
  if (!contentView || contentView.webContents.isDestroyed()) return Promise.resolve();
  if (contentLoadPromise) return contentLoadPromise;
  contentLoaded = false;
  contentLoadPromise = contentView.webContents
    .loadURL(url)
    .then(() => undefined)
    .catch(() => {
      transitionConnectionOffline();
    })
    .finally(() => {
      contentLoadPromise = null;
    });
  return contentLoadPromise;
}

function registerProtocolClient(): void {
  if (!app.isPackaged && process.env.WAPVE_DESKTOP_SKIP_PROTOCOL === '1') return;
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient('wapve', process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient('wapve');
  }
}

function createHealthUrl(home: URL): string {
  const health = new URL(home);
  health.pathname = '/api/v1/health';
  health.search = '';
  health.hash = '';
  if (health.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(health.hostname)) {
    health.port = '4000';
  }
  return health.href;
}

function isSameSecurityOrigin(input: string, home: URL): boolean {
  try {
    return new URL(input).origin === home.origin;
  } catch {
    return false;
  }
}

function runtimeResourcePath(packagedName: string, developmentRelativePath: string): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, packagedName)
    : path.join(app.getAppPath(), developmentRelativePath);
}

function readDevelopmentDuration(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 100 ? parsed : fallback;
}

function windowStatePath(): string {
  return path.join(app.getPath('userData'), 'window-state-v1.json');
}

async function readWindowState(): Promise<StoredWindowState | null> {
  try {
    const raw = await readFile(windowStatePath(), 'utf8');
    if (raw.length > 8_192) return null;
    const value = JSON.parse(raw) as Partial<StoredWindowState>;
    if (![value.x, value.y, value.width, value.height].every(Number.isFinite)) return null;
    if ((value.width ?? 0) < MIN_WIDTH || (value.height ?? 0) < MIN_HEIGHT) return null;
    return {
      x: Math.round(value.x ?? 0),
      y: Math.round(value.y ?? 0),
      width: Math.round(value.width ?? MIN_WIDTH),
      height: Math.round(value.height ?? MIN_HEIGHT),
      maximized: value.maximized === true,
    };
  } catch {
    return null;
  }
}

function restoreBounds(stored: StoredWindowState | null): Rectangle {
  if (!stored) {
    const workArea = screen.getPrimaryDisplay().workArea;
    return {
      x: Math.round(workArea.x + (workArea.width - 1_280) / 2),
      y: Math.round(workArea.y + (workArea.height - 800) / 2),
      width: Math.min(1_280, workArea.width),
      height: Math.min(800, workArea.height),
    };
  }
  const workArea = screen.getDisplayMatching(stored).workArea;
  const width = Math.min(Math.max(stored.width, MIN_WIDTH), workArea.width);
  const height = Math.min(Math.max(stored.height, MIN_HEIGHT), workArea.height);
  return {
    x: Math.min(Math.max(stored.x, workArea.x), workArea.x + workArea.width - width),
    y: Math.min(Math.max(stored.y, workArea.y), workArea.y + workArea.height - height),
    width,
    height,
  };
}

function scheduleWindowStateSave(): void {
  if (stateSaveTimer) clearTimeout(stateSaveTimer);
  stateSaveTimer = setTimeout(() => void persistWindowState(), 250);
}

async function persistWindowState(): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.isMaximized() ? mainWindow.getNormalBounds() : mainWindow.getBounds();
  await writeFile(
    windowStatePath(),
    JSON.stringify({ ...bounds, maximized: mainWindow.isMaximized() }),
    { encoding: 'utf8', mode: 0o600 },
  ).catch(() => undefined);
}
