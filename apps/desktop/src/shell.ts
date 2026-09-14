import './shell.css';

type ConnectionState = 'checking' | 'offline' | 'online';
type ConnectionSnapshot = {
  state: ConnectionState;
  attempt: number;
  retryAt: number | null;
};

const isTurkish = navigator.language.toLocaleLowerCase().startsWith('tr');
const copy = isTurkish
  ? {
      checkingTitle: 'Wapve hazırlanıyor',
      offlineTitle: 'Dalgaya ulaşamıyoruz',
      offlineBody: 'İnternet bağlantını kontrol et. Wapve çevrimdışı çalışmaz.',
      retry: 'Yeniden dene',
      retryLabel: 'Bağlantıyı yeniden dene',
      retrying: 'Bağlantı yeniden deneniyor…',
      retryIn: '{seconds} saniye sonra otomatik denenecek',
      attempt: 'Bağlantı denemesi {attempt}',
      hints: [
        'Dalgalar bazen geri çekilir; bağlantın gelince kaldığın yerden devam edeceğiz.',
        'Mesajların güvende. Wapve bağlantıyı arka planda yeniden kuruyor.',
        'Modemini veya Wi-Fi bağlantını kontrol edebilirsin.',
        'Bağlantı geri geldiğinde sohbetlerin otomatik olarak yeniden yüklenecek.',
      ],
    }
  : {
      checkingTitle: 'Wapve is getting ready',
      offlineTitle: 'We cannot reach the wave',
      offlineBody: 'Check your internet connection. Wapve does not work offline.',
      retry: 'Try again',
      retryLabel: 'Retry connection',
      retrying: 'Trying to reconnect…',
      retryIn: 'Automatic retry in {seconds} seconds',
      attempt: 'Connection attempt {attempt}',
      hints: [
        'Waves sometimes pull back; we will continue where you left off when they return.',
        'Your messages are safe. Wapve is rebuilding the connection in the background.',
        'You can check your modem or Wi-Fi connection.',
        'Your conversations will reload automatically when the connection returns.',
      ],
    };

const title = document.querySelector<HTMLElement>('#status-title');
const body = document.querySelector<HTMLElement>('#status-copy');
const loader = document.querySelector<HTMLElement>('#loader');
const retry = document.querySelector<HTMLButtonElement>('#retry');
const hint = document.querySelector<HTMLElement>('#connection-hint');
const retryStatus = document.querySelector<HTMLElement>('#retry-status');
let currentSnapshot: ConnectionSnapshot = { state: 'checking', attempt: 1, retryAt: null };
let hintIndex = Math.floor(Math.random() * copy.hints.length);
let countdownTimer: number | null = null;
let hintTimer: number | null = null;

function render(snapshot: ConnectionSnapshot): void {
  currentSnapshot = snapshot;
  const offline = snapshot.state === 'offline';
  document.body.dataset.state = snapshot.state;
  if (title) title.textContent = offline ? copy.offlineTitle : copy.checkingTitle;
  if (body) {
    body.hidden = !offline;
    body.textContent = offline ? copy.offlineBody : '';
  }
  if (loader) loader.hidden = offline;
  if (hint) {
    hint.hidden = !offline;
    hint.textContent = copy.hints[hintIndex] ?? copy.hints[0];
  }
  if (retryStatus) retryStatus.hidden = !offline;
  if (retry) {
    retry.hidden = !offline;
    retry.disabled = !offline;
  }
  stopOfflineTimers();
  if (offline) startOfflineTimers();
}

function startOfflineTimers(): void {
  updateRetryStatus();
  countdownTimer = window.setInterval(updateRetryStatus, 250);
  hintTimer = window.setInterval(() => {
    const offset =
      copy.hints.length > 1 ? 1 + Math.floor(Math.random() * (copy.hints.length - 1)) : 0;
    hintIndex = (hintIndex + offset) % copy.hints.length;
    if (hint) {
      hint.textContent = copy.hints[hintIndex] ?? copy.hints[0];
      hint.animate(
        [
          { opacity: 0, transform: 'translateY(5px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 260, easing: 'ease-out' },
      );
    }
  }, 6_500);
}

function stopOfflineTimers(): void {
  if (countdownTimer !== null) window.clearInterval(countdownTimer);
  if (hintTimer !== null) window.clearInterval(hintTimer);
  countdownTimer = null;
  hintTimer = null;
}

function updateRetryStatus(): void {
  if (!retryStatus) return;
  const seconds = currentSnapshot.retryAt
    ? Math.max(0, Math.ceil((currentSnapshot.retryAt - Date.now()) / 1_000))
    : 0;
  const status = seconds > 0 ? copy.retryIn.replace('{seconds}', String(seconds)) : copy.retrying;
  retryStatus.textContent = `${status} · ${copy.attempt.replace('{attempt}', String(currentSnapshot.attempt))}`;
}

async function requestRetry(): Promise<void> {
  render({ state: 'checking', attempt: currentSnapshot.attempt, retryAt: null });
  await window.wapveShell.retryConnection();
}

if (retry) {
  retry.textContent = copy.retry;
  retry.title = copy.retryLabel;
  retry.setAttribute('aria-label', copy.retryLabel);
  retry.addEventListener('click', () => void requestRetry());
}

const removeConnectionListener = window.wapveShell.onConnectionState((snapshot) =>
  render(snapshot),
);
window.addEventListener(
  'beforeunload',
  () => {
    stopOfflineTimers();
    removeConnectionListener();
  },
  { once: true },
);
render(currentSnapshot);
