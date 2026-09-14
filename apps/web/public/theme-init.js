(function () {
  try {
    var theme = localStorage.getItem('wapve:theme:v1');
    if (['dark', 'purple', 'blue', 'green', 'burgundy'].indexOf(theme) !== -1) document.documentElement.dataset.theme = theme;
    window.addEventListener('storage', function (event) {
      if (event.key === 'wapve:theme:v1') document.documentElement.dataset.theme = ['dark', 'purple', 'blue', 'green', 'burgundy'].indexOf(event.newValue) !== -1 ? event.newValue : 'dark';
    });
  } catch {
    // Storage can be unavailable; keep the default palette.
  }
})();
