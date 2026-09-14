// The real HTTPS origin is supplied as the WebView base URL; server token verification is unchanged.
export function supportVerificationHtml(siteKey: string, locale: string): string {
  if (!/^[a-zA-Z0-9_-]{1,256}$/.test(siteKey)) throw new Error('Invalid Turnstile site key');
  const language = locale === 'tr' ? 'tr' : 'en';
  return `<!doctype html><html lang="${language}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;background:transparent}body{display:flex;justify-content:center;padding:8px 0}</style></head><body><div id="challenge"></div><script>
  function send(token, failed) { window.ReactNativeWebView.postMessage(JSON.stringify({type:'wapve-support-verification',token:token,failed:!!failed})); }
  function ready() { turnstile.render('#challenge',{sitekey:'${siteKey}',theme:'dark',size:'flexible',language:'${language}',callback:function(token){send(token,false)},'expired-callback':function(){send('',false)},'error-callback':function(){send('',true)}}); }
  </script><script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=ready&amp;render=explicit" onerror="send('',true)"></script></body></html>`;
}
