import { describe, expect, it } from 'vitest';
import { desktopAuthHref, sanitizeDesktopNext } from './desktop-route';

describe('sanitizeDesktopNext', () => {
  it.each([
    '/app',
    '/invite/Abcd_1-2',
    '/channels/123456789012345',
    '/channels/123456789012345/123456789012345678',
    '/waves/550e8400-e29b-41d4-a716-446655440000',
    '/waves/group:550e8400-e29b-41d4-a716-446655440000',
  ])('accepts %s', (input) => expect(sanitizeDesktopNext(input)).toBe(input));

  it.each([
    '',
    'app',
    '//evil.example/app',
    '/app?next=https://evil.example',
    '/invite/abc%2Fdef',
    '/invite/../abcdef',
    '/invite/short',
    '/channels/123/123456789012345678',
    '/channels/123456789012345/123',
    '/waves/not-a-uuid',
    '/waves/group%3A550e8400-e29b-41d4-a716-446655440000',
    'https://wapve.com/app',
    '/app#fragment',
    '/app\n',
  ])('rejects %s', (input) => expect(sanitizeDesktopNext(input)).toBeNull());

  it('rejects non-string and oversized targets', () => {
    expect(sanitizeDesktopNext(undefined)).toBeNull();
    expect(sanitizeDesktopNext(['/app'])).toBeNull();
    expect(sanitizeDesktopNext(`/invite/${'a'.repeat(600)}`)).toBeNull();
  });
});

describe('desktopAuthHref', () => {
  it('only serializes a prevalidated relative target', () => {
    expect(desktopAuthHref('/login', '/waves/group:550e8400-e29b-41d4-a716-446655440000')).toBe(
      '/login?next=%2Fwaves%2Fgroup%3A550e8400-e29b-41d4-a716-446655440000',
    );
    expect(desktopAuthHref('/register', null)).toBe('/register');
  });
});
