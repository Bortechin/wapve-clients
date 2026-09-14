export type MobilePlatform = 'ANDROID' | 'IOS';

export type MobileTokens = {
  sessionId: string;
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
};

export type MobileSession<User = unknown> = MobileTokens & { user: User };

export interface TokenStorage {
  load(): Promise<MobileTokens | null>;
  save(tokens: MobileTokens): Promise<void>;
  clear(): Promise<void>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly messageKey: string,
    readonly details?: unknown,
  ) {
    super(messageKey);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  authenticated?: boolean;
  retryAfterRefresh?: boolean;
};

export class WapveApiClient {
  private refreshPromise: Promise<MobileTokens> | null = null;

  constructor(
    readonly baseUrl: string,
    readonly platform: MobilePlatform,
    private readonly tokenStorage: TokenStorage,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, authenticated = true, retryAfterRefresh = true, ...fetchOptions } = options;
    const tokens = authenticated ? await this.tokenStorage.load() : null;
    const headers = new Headers(fetchOptions.headers);
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    headers.set('Accept', 'application/json');
    headers.set('X-Wapve-Client', 'mobile');
    if (body !== undefined && !isFormData) headers.set('Content-Type', 'application/json');
    if (tokens?.accessToken) headers.set('Authorization', `Bearer ${tokens.accessToken}`);

    const init: RequestInit = {
      ...fetchOptions,
      headers,
      ...(body === undefined ? {} : { body: isFormData ? body : JSON.stringify(body) }),
    };
    const response = await this.fetcher(`${this.baseUrl}${path}`, init);
    if (response.status === 401 && authenticated && retryAfterRefresh) {
      await this.refresh();
      return this.request<T>(path, { ...options, retryAfterRefresh: false });
    }
    if (!response.ok) throw await this.toError(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async login<User>(identifier: string, password: string, deviceId?: string) {
    const result = await this.request<
      | MobileSession<User>
      | { requiresTwoFactor: true; challengeToken: string }
      | { requiresEmailApproval: true; expiresAt: string }
    >('/auth/mobile/login', {
      method: 'POST',
      authenticated: false,
      body: { identifier, password, platform: this.platform, deviceId },
    });
    if (!('requiresTwoFactor' in result) && !('requiresEmailApproval' in result))
      await this.tokenStorage.save(result);
    return result;
  }

  async completeTwoFactor<User>(challengeToken: string, code: string, deviceId?: string) {
    const result = await this.request<MobileSession<User>>('/auth/mobile/login/2fa', {
      method: 'POST',
      authenticated: false,
      body: { challengeToken, code, platform: this.platform, deviceId },
    });
    await this.tokenStorage.save(result);
    return result;
  }

  async loginWithPasskey<User>(challengeId: string, response: unknown) {
    const result = await this.request<MobileSession<User>>('/auth/mobile/passkeys/login/verify', {
      method: 'POST',
      authenticated: false,
      body: { challengeId, response, platform: this.platform },
    });
    await this.tokenStorage.save(result);
    return result;
  }

  async register<User>(input: Record<string, unknown>) {
    const result = await this.request<MobileSession<User> & { emailSent: boolean }>(
      '/auth/mobile/register',
      { method: 'POST', authenticated: false, body: { ...input, platform: this.platform } },
    );
    await this.tokenStorage.save(result);
    return result;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/mobile/logout', { method: 'POST', retryAfterRefresh: false });
    } finally {
      await this.tokenStorage.clear();
    }
  }

  async refresh(): Promise<MobileTokens> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<MobileTokens> {
    const current = await this.tokenStorage.load();
    if (!current?.refreshToken)
      throw new ApiError(401, 'NO_REFRESH_TOKEN', 'errors.sessionExpired');
    const response = await this.fetcher(`${this.baseUrl}/auth/mobile/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Wapve-Client': 'mobile' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    if (!response.ok) {
      await this.tokenStorage.clear();
      throw await this.toError(response);
    }
    const next = (await response.json()) as MobileSession;
    await this.tokenStorage.save(next);
    return next;
  }

  private async toError(response: Response): Promise<ApiError> {
    let payload: { code?: string; messageKey?: string } & Record<string, unknown> = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      // A proxy error may not be JSON; retain the HTTP status without exposing HTML.
    }
    return new ApiError(
      response.status,
      payload.code ?? 'REQUEST_FAILED',
      payload.messageKey ?? 'errors.requestFailed',
      payload,
    );
  }
}
