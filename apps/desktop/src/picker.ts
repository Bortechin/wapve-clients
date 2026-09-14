import './picker.css';

type CaptureSource = Awaited<ReturnType<Window['wapveCapturePicker']['listSources']>>[number];
type SourceKind = CaptureSource['kind'];
type CaptureQuality = 'balanced' | 'high';

const turkish = navigator.language.toLocaleLowerCase().startsWith('tr');
const copy = turkish
  ? {
      title: 'Ekranını paylaş',
      subtitle: 'Paylaşmak istediğin uygulamayı veya ekranı seç.',
      close: 'Kapat',
      windows: 'Uygulamalar',
      screens: 'Tüm ekran',
      refresh: 'Yenile',
      loading: 'Pencereler hazırlanıyor…',
      emptyWindows: 'Paylaşılabilecek bir uygulama penceresi bulunamadı.',
      emptyScreens: 'Paylaşılabilecek bir ekran bulunamadı.',
      failed: 'Kaynaklar alınamadı. Yenilemeyi dene.',
      quality: 'Yayın kalitesi',
      cancel: 'İptal',
      share: 'Paylaş',
    }
  : {
      title: 'Share your screen',
      subtitle: 'Choose the application or screen you want to share.',
      close: 'Close',
      windows: 'Applications',
      screens: 'Entire screen',
      refresh: 'Refresh',
      loading: 'Preparing windows…',
      emptyWindows: 'No application windows are available to share.',
      emptyScreens: 'No screens are available to share.',
      failed: 'Sources could not be loaded. Try refreshing.',
      quality: 'Stream quality',
      cancel: 'Cancel',
      share: 'Share',
    };

let sources: CaptureSource[] = [];
let selectedSourceId = '';
let activeKind: SourceKind = 'window';
let quality: CaptureQuality = 'high';
let busy = false;

const title = requiredElement<HTMLElement>('picker-title');
const subtitle = requiredElement<HTMLElement>('picker-subtitle');
const closeButton = requiredElement<HTMLButtonElement>('picker-close');
const cancelButton = requiredElement<HTMLButtonElement>('picker-cancel');
const shareButton = requiredElement<HTMLButtonElement>('picker-share');
const windowsTab = requiredElement<HTMLButtonElement>('windows-tab');
const screensTab = requiredElement<HTMLButtonElement>('screens-tab');
const refreshButton = requiredElement<HTMLButtonElement>('refresh-sources');
const status = requiredElement<HTMLElement>('source-status');
const grid = requiredElement<HTMLElement>('source-grid');
const highQualityButton = requiredElement<HTMLButtonElement>('quality-high');
const balancedQualityButton = requiredElement<HTMLButtonElement>('quality-balanced');
const qualityLabel = document.querySelector<HTMLElement>('.quality-picker > span');

title.textContent = copy.title;
subtitle.textContent = copy.subtitle;
closeButton.title = copy.close;
closeButton.setAttribute('aria-label', copy.close);
windowsTab.querySelector('strong')!.textContent = copy.windows;
screensTab.querySelector('strong')!.textContent = copy.screens;
refreshButton.title = copy.refresh;
refreshButton.setAttribute('aria-label', copy.refresh);
if (qualityLabel) qualityLabel.textContent = copy.quality;
cancelButton.textContent = copy.cancel;
shareButton.textContent = copy.share;

async function loadSources(forceRefresh = false): Promise<void> {
  if (busy) return;
  busy = true;
  status.hidden = false;
  status.textContent = copy.loading;
  refreshButton.classList.add('spinning');
  refreshButton.disabled = true;
  try {
    sources = await window.wapveCapturePicker.listSources(forceRefresh);
    const visible = visibleSources();
    if (!visible.some((source) => source.id === selectedSourceId)) {
      selectedSourceId = visible[0]?.id ?? '';
    }
    renderSources();
  } catch {
    sources = [];
    selectedSourceId = '';
    grid.replaceChildren();
    status.hidden = false;
    status.textContent = copy.failed;
  } finally {
    busy = false;
    refreshButton.classList.remove('spinning');
    refreshButton.disabled = false;
    updateShareButton();
  }
}

function visibleSources(): CaptureSource[] {
  return sources.filter((source) => source.kind === activeKind);
}

function renderSources(): void {
  const visible = visibleSources();
  grid.replaceChildren();
  status.hidden = visible.length > 0;
  status.textContent = activeKind === 'window' ? copy.emptyWindows : copy.emptyScreens;
  for (const source of visible) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `source-card${source.id === selectedSourceId ? ' active' : ''}`;
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', String(source.id === selectedSourceId));
    card.title = source.name;

    const preview = document.createElement('span');
    preview.className = 'source-preview';
    if (source.thumbnail) {
      const image = document.createElement('img');
      image.src = source.thumbnail;
      image.alt = '';
      image.draggable = false;
      preview.append(image);
    }

    const check = document.createElement('i');
    check.textContent = '✓';
    check.setAttribute('aria-hidden', 'true');
    preview.append(check);

    const label = document.createElement('span');
    label.className = 'source-label';
    if (source.appIcon) {
      const icon = document.createElement('img');
      icon.src = source.appIcon;
      icon.alt = '';
      icon.draggable = false;
      label.append(icon);
    } else {
      const icon = document.createElement('span');
      icon.textContent = source.kind === 'screen' ? '▤' : '▣';
      icon.setAttribute('aria-hidden', 'true');
      label.append(icon);
    }
    const name = document.createElement('strong');
    name.textContent = source.name;
    label.append(name);
    card.append(preview, label);
    card.addEventListener('click', () => {
      selectedSourceId = source.id;
      renderSources();
      updateShareButton();
    });
    card.addEventListener('dblclick', () => void shareSelection());
    grid.append(card);
  }
}

function selectKind(kind: SourceKind): void {
  activeKind = kind;
  const first = visibleSources()[0];
  if (!visibleSources().some((source) => source.id === selectedSourceId)) {
    selectedSourceId = first?.id ?? '';
  }
  windowsTab.classList.toggle('active', kind === 'window');
  screensTab.classList.toggle('active', kind === 'screen');
  windowsTab.setAttribute('aria-selected', String(kind === 'window'));
  screensTab.setAttribute('aria-selected', String(kind === 'screen'));
  renderSources();
  updateShareButton();
}

function selectQuality(next: CaptureQuality): void {
  quality = next;
  highQualityButton.classList.toggle('active', next === 'high');
  balancedQualityButton.classList.toggle('active', next === 'balanced');
}

function updateShareButton(): void {
  shareButton.disabled = busy || !selectedSourceId;
}

async function shareSelection(): Promise<void> {
  if (!selectedSourceId || busy) return;
  busy = true;
  updateShareButton();
  try {
    await window.wapveCapturePicker.select({ sourceId: selectedSourceId, quality });
  } catch {
    busy = false;
    await loadSources();
  }
}

function cancel(): void {
  void window.wapveCapturePicker.cancel();
}

windowsTab.addEventListener('click', () => selectKind('window'));
screensTab.addEventListener('click', () => selectKind('screen'));
refreshButton.addEventListener('click', () => void loadSources(true));
highQualityButton.addEventListener('click', () => selectQuality('high'));
balancedQualityButton.addEventListener('click', () => selectQuality('balanced'));
shareButton.addEventListener('click', () => void shareSelection());
closeButton.addEventListener('click', cancel);
cancelButton.addEventListener('click', cancel);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') cancel();
});

window.wapveCapturePicker.onOpen(() => {
  sources = [];
  selectedSourceId = '';
  activeKind = 'window';
  quality = 'high';
  selectKind('window');
  selectQuality('high');
  void loadSources();
});

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing picker element: ${id}`);
  return element as T;
}
