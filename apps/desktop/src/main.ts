import './styles.css';

const isTurkish = navigator.language.toLocaleLowerCase().startsWith('tr');

const labels = isTurkish
  ? {
      controls: 'Pencere kontrolleri',
      minimize: 'Küçült',
      maximize: 'Büyüt veya geri yükle',
      close: 'Kapat',
    }
  : {
      controls: 'Window controls',
      minimize: 'Minimize',
      maximize: 'Maximize or restore',
      close: 'Close',
    };

const controls = document.querySelector<HTMLElement>('.window-controls');
controls?.setAttribute('aria-label', labels.controls);

function bindButton(id: string, label: string, action: () => Promise<unknown>): void {
  const button = document.querySelector<HTMLButtonElement>(`#${id}`);
  if (!button) return;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', () => void action());
}

bindButton('minimize', labels.minimize, () => window.wapveShell.minimize());
bindButton('maximize', labels.maximize, () => window.wapveShell.toggleMaximize());
bindButton('close', labels.close, () => window.wapveShell.close());

document.querySelector<HTMLElement>('.titlebar')?.addEventListener('dblclick', (event) => {
  if (!(event.target instanceof Element) || !event.target.closest('button')) {
    void window.wapveShell.toggleMaximize();
  }
});
