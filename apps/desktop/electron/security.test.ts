import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyNavigation,
  classifyNewWindow,
  desktopBootstrapUrl,
  isCaptureSourceId,
  isDevToolsShortcut,
  parseDeepLink,
  resolveContentHome,
  validateDevelopmentHome,
} from './security.js';

test('recognizes every standard developer-tools shortcut without blocking normal input', () => {
  for (const input of [
    { key: 'F12' },
    { key: 'i', control: true, shift: true },
    { key: 'J', control: true, shift: true },
    { key: 'c', control: true, shift: true },
    { key: 'I', meta: true, alt: true },
    { key: 'j', meta: true, alt: true },
    { key: 'C', meta: true, alt: true },
  ]) {
    assert.equal(isDevToolsShortcut(input), true, JSON.stringify(input));
  }
  for (const input of [
    { key: 'i', control: true },
    { key: 'c', shift: true },
    { key: 'F11' },
    { key: 'k', control: true, shift: true },
  ]) {
    assert.equal(isDevToolsShortcut(input), false, JSON.stringify(input));
  }
});

test('accepts supported Wapve deep links', () => {
  const cases = new Map([
    ['wapve://open', 'https://wapve.com/app'],
    ['wapve://invite/Abcd_1-2', 'https://wapve.com/invite/Abcd_1-2'],
    [
      'wapve://channels/123456789012345/123456789012345678',
      'https://wapve.com/channels/123456789012345/123456789012345678',
    ],
    [
      'wapve://waves/group:550e8400-e29b-41d4-a716-446655440000',
      'https://wapve.com/waves/group:550e8400-e29b-41d4-a716-446655440000',
    ],
  ]);
  for (const [input, expected] of cases) assert.equal(parseDeepLink(input)?.href, expected);
});

test('rejects encoded, redirect, credential and malformed deep links', () => {
  for (const input of [
    'wapve://open/extra',
    'wapve://invite/short',
    'wapve://invite/abcdef?next=https://evil.example',
    'wapve://invite/abc%2Fdef',
    'wapve://user@invite/abcdef',
    'wapve://channels/123/123456789012345678',
    'wapve://waves/not-a-uuid',
    `wapve://invite/${'a'.repeat(2_100)}`,
    'https://wapve.com/app',
  ]) {
    assert.equal(parseDeepLink(input), null, input);
  }
});

test('uses only verified development origins outside packaged builds', () => {
  assert.equal(
    validateDevelopmentHome('http://127.0.0.1:3000/desktop')?.href,
    'http://127.0.0.1:3000/desktop',
  );
  assert.equal(validateDevelopmentHome('http://evil.example:3000/desktop'), null);
  assert.equal(validateDevelopmentHome('http://localhost:3001/desktop'), null);
  assert.equal(
    resolveContentHome('http://localhost:3000/desktop', false).href,
    'http://localhost:3000/desktop',
  );
  assert.equal(
    resolveContentHome('http://localhost:3000/desktop', true).href,
    'https://wapve.com/desktop',
  );
});

test('locks in-app navigation to product and auth routes', () => {
  const home = new URL('https://wapve.com/desktop');
  assert.equal(classifyNavigation('https://wapve.com/app', home).kind, 'internal');
  assert.equal(classifyNavigation('https://wapve.com/tr/login', home).kind, 'internal');
  assert.equal(classifyNavigation('https://wapve.com/legal/privacy', home).kind, 'blocked');
  assert.equal(classifyNavigation('https://example.com/docs', home).kind, 'external');
  assert.equal(classifyNavigation('javascript:alert(1)', home).kind, 'blocked');
  assert.equal(classifyNewWindow('https://wapve.com/legal/privacy', home).kind, 'external');
});

test('builds strict cold-start URLs and validates capture source IDs', () => {
  const target = parseDeepLink('wapve://invite/Abcd_1-2');
  assert.equal(
    desktopBootstrapUrl(new URL('https://wapve.com/desktop'), target).href,
    'https://wapve.com/desktop?next=%2Finvite%2FAbcd_1-2',
  );
  assert.equal(isCaptureSourceId('window:12345:0'), true);
  assert.equal(isCaptureSourceId('screen:0:0'), true);
  assert.equal(isCaptureSourceId('file:///C:/Windows/System32'), false);
  assert.equal(isCaptureSourceId(`window:${'1'.repeat(300)}:0`), false);
});

test('identifies server error status codes and Cloudflare error page signatures', async () => {
  const { isServerErrorStatusCode, isCloudflareOrServerErrorTitle } = await import('./security.js');
  assert.equal(isServerErrorStatusCode(521), true);
  assert.equal(isServerErrorStatusCode(502), true);
  assert.equal(isServerErrorStatusCode(500), true);
  assert.equal(isServerErrorStatusCode(200), false);
  assert.equal(isServerErrorStatusCode(404), false);

  assert.equal(isCloudflareOrServerErrorTitle('Web server is down | wapve.com | Cloudflare'), true);
  assert.equal(isCloudflareOrServerErrorTitle('Error code 521'), true);
  assert.equal(isCloudflareOrServerErrorTitle('502 Bad Gateway'), true);
  assert.equal(isCloudflareOrServerErrorTitle('Attention Required! | Cloudflare'), true);
  assert.equal(isCloudflareOrServerErrorTitle('Wapve'), false);
  assert.equal(isCloudflareOrServerErrorTitle(''), false);
  assert.equal(isCloudflareOrServerErrorTitle(null), false);
});
