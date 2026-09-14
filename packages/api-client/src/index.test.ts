/* eslint-disable @typescript-eslint/unbound-method -- Vitest verifies storage mock methods by reference. */
import { describe, expect, it, vi } from 'vitest';
import { ApiError, WapveApiClient, type MobileTokens, type TokenStorage } from './index.js';

const initial: MobileTokens = {
  sessionId: 'session-1',
  accessToken: 'access-old',
  accessExpiresAt: '2026-08-25T00:15:00.000Z',
  refreshToken: 'refresh-old',
  refreshExpiresAt: '2026-09-24T00:00:00.000Z',
};
const rotated: MobileTokens = {
  ...initial,
  accessToken: 'access-new',
  refreshToken: 'refresh-new',
};

function storage(value: MobileTokens | null = initial) {
  let current = value;
  const tokenStorage: TokenStorage = {
    load: vi.fn(() => Promise.resolve(current)),
    save: vi.fn((next: MobileTokens) => {
      current = next;
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      current = null;
      return Promise.resolve();
    }),
  };
  return tokenStorage;
}

function requestUrl(input: string | URL | Request): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

describe('WapveApiClient', () => {
  it('uses bearer auth, rotates once on 401 and retries with the new access token', async () => {
    const tokens = storage();
    const seen: string[] = [];
    const fetcher = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = requestUrl(input);
      seen.push(`${url}:${new Headers(init?.headers).get('Authorization') ?? ''}`);
      if (url.endsWith('/auth/mobile/token/refresh'))
        return Promise.resolve(
          new Response(JSON.stringify(rotated), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      if (new Headers(init?.headers).get('Authorization') === 'Bearer access-old')
        return Promise.resolve(
          new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } }),
        );
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    const client = new WapveApiClient(
      'https://wapve.com/api/v1',
      'ANDROID',
      tokens,
      fetcher as typeof fetch,
    );
    await expect(client.request('/users/me')).resolves.toEqual({ ok: true });
    expect(seen).toEqual([
      'https://wapve.com/api/v1/users/me:Bearer access-old',
      'https://wapve.com/api/v1/auth/mobile/token/refresh:',
      'https://wapve.com/api/v1/users/me:Bearer access-new',
    ]);
    expect(tokens.save).toHaveBeenCalledWith(rotated);
  });

  it('does not JSON encode FormData or set its multipart boundary manually', async () => {
    const tokens = storage();
    let captured: RequestInit | undefined;
    const fetcher = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      captured = init;
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    const form = new FormData();
    form.append('file', new Blob(['wave']), 'wave.txt');
    const client = new WapveApiClient(
      'https://wapve.com/api/v1',
      'ANDROID',
      tokens,
      fetcher as typeof fetch,
    );
    await client.request('/upload', { method: 'POST', body: form });
    expect(captured?.body).toBe(form);
    expect(new Headers(captured?.headers).has('Content-Type')).toBe(false);
  });

  it('clears stored credentials when refresh is rejected', async () => {
    const tokens = storage();
    const fetcher = vi.fn((input: string | URL | Request) =>
      Promise.resolve(
        requestUrl(input).endsWith('/token/refresh')
          ? new Response(
              JSON.stringify({ code: 'INVALID_REFRESH_TOKEN', messageKey: 'errors.unauthorized' }),
              { status: 401, headers: { 'Content-Type': 'application/json' } },
            )
          : new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } }),
      ),
    );
    const client = new WapveApiClient(
      'https://wapve.com/api/v1',
      'ANDROID',
      tokens,
      fetcher as typeof fetch,
    );
    await expect(client.request('/users/me')).rejects.toBeInstanceOf(ApiError);
    expect(tokens.clear).toHaveBeenCalledOnce();
  });
});
