import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api';

describe('apiRequest CSRF lifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches a fresh CSRF token after logout clears the session cookies', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'before-logout' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'after-logout' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ challenge: 'fresh' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/auth/logout', { method: 'POST', body: '{}' });
    await apiRequest('/auth/passkeys/login/options', { method: 'POST', body: '{}' });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:4000/api/v1/auth/csrf',
      'http://localhost:4000/api/v1/auth/logout',
      'http://localhost:4000/api/v1/auth/csrf',
      'http://localhost:4000/api/v1/auth/passkeys/login/options',
    ]);
    expect(new Headers(fetchMock.mock.calls[3]?.[1]?.headers).get('X-CSRF-Token')).toBe(
      'after-logout',
    );
  });
});
