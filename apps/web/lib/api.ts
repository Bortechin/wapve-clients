import type { ApiError } from '@wapve/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
let csrfToken: string | null = null;

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly details: ApiError,
  ) {
    super(details.messageKey);
  }
}

export function setCsrfToken(token: string): void {
  csrfToken = token;
}

async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_URL}/auth/csrf`, { credentials: 'include' });
  if (!response.ok) throw new Error('Unable to initialize request security');
  const body = (await response.json()) as { csrfToken: string };
  csrfToken = body.csrfToken;
  return body.csrfToken;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CSRF-Token', await ensureCsrf());
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    method,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });
  if (response.ok && path === '/auth/logout') csrfToken = null;
  if (!response.ok) {
    let details: ApiError;
    try {
      details = (await response.json()) as ApiError;
    } catch {
      details = { code: 'NETWORK_ERROR', messageKey: 'errors.requestFailed' };
    }
    if (response.status === 401) csrfToken = null;
    throw new ApiClientError(response.status, details);
  }
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as T;
  if (typeof body === 'object' && body && 'csrfToken' in body) {
    const token = (body as { csrfToken?: unknown }).csrfToken;
    if (typeof token === 'string' && token) csrfToken = token;
  }
  return body;
}

export async function apiUpload<T>(
  path: string,
  body: FormData,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  const token = await ensureCsrf();
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_URL}${path}`);
    request.withCredentials = true;
    request.setRequestHeader('X-CSRF-Token', token);
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve(request.responseText ? (JSON.parse(request.responseText) as T) : (undefined as T));
        return;
      }
      let details: ApiError;
      try {
        details = JSON.parse(request.responseText) as ApiError;
      } catch {
        details = { code: 'NETWORK_ERROR', messageKey: 'errors.requestFailed' };
      }
      reject(new ApiClientError(request.status, details));
    });
    request.addEventListener('error', () =>
      reject(
        new ApiClientError(0, { code: 'NETWORK_ERROR', messageKey: 'errors.requestFailed' }),
      ),
    );
    request.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    signal?.addEventListener('abort', () => request.abort(), { once: true });
    request.send(body);
  });
}
