import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from '../proxy';
import { DESKTOP_PRESENTATION_COOKIE } from './desktop-route';

describe('desktop presentation proxy', () => {
  it('sets a secure, HttpOnly presentation cookie on the desktop gateway', () => {
    const response = proxy(
      new NextRequest('https://wapve.com/desktop', {
        headers: { 'accept-language': 'tr-TR,tr;q=0.9' },
      }),
    );
    const cookie = response.cookies.get(DESKTOP_PRESENTATION_COOKIE);
    expect(cookie?.value).toBe('1');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('lax');
    expect(cookie?.secure).toBe(true);
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://wapve.com/tr/desktop');
  });

  it('does not mark ordinary browser routes as desktop', () => {
    const response = proxy(
      new NextRequest('https://wapve.com/login', {
        headers: { 'accept-language': 'en-US,en;q=0.9' },
      }),
    );
    expect(response.cookies.get(DESKTOP_PRESENTATION_COOKIE)).toBeUndefined();
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://wapve.com/en/login');
  });
});
