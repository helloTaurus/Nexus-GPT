import type { ReferenceServer } from '../fixtures/referenceServer.ts';

export interface ApiResponse<T = any> {
  status: number;
  headers: Headers;
  rawText: string;
  body: T;
  cookies: Map<string, string>;
}

export class TestClient {
  public baseUrl: string;
  public refServer: ReferenceServer | null = null;
  public cookieJar: Map<string, string> = new Map();
  public defaultHeaders: Record<string, string> = {};

  constructor(baseUrl: string = '', refServer: ReferenceServer | null = null) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.refServer = refServer;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public clearCookies() {
    this.cookieJar.clear();
  }

  public setCookie(name: string, value: string) {
    this.cookieJar.set(name, value);
  }

  private buildCookieHeader(): string {
    const pairs: string[] = [];
    for (const [k, v] of this.cookieJar.entries()) {
      pairs.push(`${k}=${v}`);
    }
    return pairs.join('; ');
  }

  private extractCookies(setCookieHeader?: string | string[]) {
    if (!setCookieHeader) return;
    const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    for (const header of headers) {
      const parts = header.split(';')[0].trim();
      const eqIdx = parts.indexOf('=');
      if (eqIdx !== -1) {
        const name = parts.slice(0, eqIdx).trim();
        const val = parts.slice(eqIdx + 1).trim();
        if (val) {
          this.cookieJar.set(name, val);
        } else {
          this.cookieJar.delete(name);
        }
      }
    }
  }

  public async request<T = any>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      headers?: Record<string, string>;
      rawBuffer?: Buffer;
      contentType?: string;
    } = {}
  ): Promise<ApiResponse<T>> {
    const headersObj: Record<string, string> = {
      ...this.defaultHeaders,
      ...options.headers
    };

    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) {
      headersObj['Cookie'] = cookieHeader;
    }

    // Direct in-process execution via referenceServer
    if (this.refServer) {
      let dispatchBody: any = options.body;
      if (options.rawBuffer) {
        dispatchBody = options.rawBuffer;
        if (options.contentType) {
          headersObj['Content-Type'] = options.contentType;
        }
      }
      const directRes = await this.refServer.handleDirect(method, path, headersObj, dispatchBody);

      if (directRes.headers['Set-Cookie']) {
        this.extractCookies(directRes.headers['Set-Cookie']);
      }

      return {
        status: directRes.status,
        headers: new Headers(directRes.headers),
        rawText: typeof directRes.body === 'string' ? directRes.body : JSON.stringify(directRes.body),
        body: directRes.body,
        cookies: new Map(this.cookieJar)
      };
    }

    // Live HTTP execution via fetch
    const fullUrl = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const fetchHeaders = new Headers(headersObj);

    let reqBody: any = undefined;
    if (options.rawBuffer) {
      reqBody = options.rawBuffer;
      if (options.contentType) {
        fetchHeaders.set('Content-Type', options.contentType);
      }
    } else if (options.body !== undefined) {
      reqBody = JSON.stringify(options.body);
      if (!fetchHeaders.has('Content-Type')) {
        fetchHeaders.set('Content-Type', 'application/json');
      }
    }

    const response = await fetch(fullUrl, {
      method,
      headers: fetchHeaders,
      body: reqBody
    });

    const getSetCookie = (response.headers as any).getSetCookie;
    if (typeof getSetCookie === 'function') {
      this.extractCookies(getSetCookie.call(response.headers));
    } else {
      const single = response.headers.get('set-cookie');
      if (single) this.extractCookies(single);
    }

    const rawText = await response.text();
    let body: any = null;
    try {
      body = JSON.parse(rawText);
    } catch {
      body = rawText;
    }

    return {
      status: response.status,
      headers: response.headers,
      rawText,
      body,
      cookies: new Map(this.cookieJar)
    };
  }

  public async get<T = any>(path: string, headers: Record<string, string> = {}) {
    return this.request<T>('GET', path, { headers });
  }

  public async post<T = any>(path: string, body?: unknown, headers: Record<string, string> = {}) {
    return this.request<T>('POST', path, { body, headers });
  }

  public async put<T = any>(path: string, body?: unknown, headers: Record<string, string> = {}) {
    return this.request<T>('PUT', path, { body, headers });
  }

  public async patch<T = any>(path: string, body?: unknown, headers: Record<string, string> = {}) {
    return this.request<T>('PATCH', path, { body, headers });
  }

  public async delete<T = any>(path: string, headers: Record<string, string> = {}) {
    return this.request<T>('DELETE', path, { headers });
  }

  public async upload<T = any>(path: string, buffer: Buffer, contentType: string = 'application/octet-stream', headers: Record<string, string> = {}) {
    return this.request<T>('POST', path, { rawBuffer: buffer, contentType, headers });
  }

  public async login(email: string, password: string): Promise<ApiResponse> {
    return this.post('/api/v1/auth/login', { email, password });
  }

  public async logout(): Promise<ApiResponse> {
    return this.post('/api/v1/auth/logout');
  }
}
