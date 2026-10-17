/**
 * FUN Core SDK v1.0 — Vanilla JS client for the FUN Ecosystem
 * Reads the OpenAPI spec at /openapi/fun-core-v1.json and exposes
 * typed-ish helpers for every endpoint (Identity, PPLP, Wallet, Game, AI, Admin).
 *
 * Usage (browser):
 *   <script src="https://angel-funrich.lovable.app/sdk/fun-core-sdk.js"></script>
 *   <script>
 *     const fun = await FunCore.init({ token: 'eyJ...' });
 *     const me = await fun.profile.get('camly');
 *     const balance = await fun.wallet.balance(userId);
 *   </script>
 *
 * Usage (ES module):
 *   import FunCore from 'https://angel-funrich.lovable.app/sdk/fun-core-sdk.js';
 *
 * License: FUN Charter v1
 */
(function (global) {
  'use strict';

  const DEFAULT_SPEC = 'https://angel-funrich.lovable.app/openapi/fun-core-v1.json';
  const DEFAULT_BASE = 'https://ssjoetiitctqzapymtzl.supabase.co/functions/v1';
  const SUPABASE_ANON =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzam9ldGlpdGN0cXphcHltdHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3ODA4NDAsImV4cCI6MjA4NDM1Njg0MH0.3fToeDf0bFqC4w730LiTOirFUexWlpOSdirS6wwsQgk';

  function joinUrl(base, path) {
    return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
  }

  function fillPath(template, params) {
    return template.replace(/\{(\w+)\}/g, function (_, k) {
      if (!params || params[k] === undefined) {
        throw new Error('FunCore: missing path param "' + k + '" for ' + template);
      }
      return encodeURIComponent(params[k]);
    });
  }

  /**
   * Create a FUN Core client.
   * @param {object} opts
   * @param {string} [opts.token]    Supabase user JWT (bearerAuth)
   * @param {string} [opts.apiKey]   Service ingest key (apiKeyAuth)
   * @param {string} [opts.baseUrl]  Override server (defaults to edge functions)
   * @param {string} [opts.specUrl]  Override OpenAPI spec URL
   * @returns {Promise<FunCoreClient>}
   */
  async function init(opts = {}) {
    const specUrl = opts.specUrl || DEFAULT_SPEC;
    const baseUrl = opts.baseUrl || DEFAULT_BASE;

    const res = await fetch(specUrl, { cache: 'force-cache' });
    if (!res.ok) throw new Error('FunCore: cannot load spec ' + specUrl);
    const spec = await res.json();

    return new FunCoreClient({ spec, baseUrl, token: opts.token, apiKey: opts.apiKey });
  }

  class FunCoreClient {
    constructor({ spec, baseUrl, token, apiKey }) {
      this.spec = spec;
      this.baseUrl = baseUrl;
      this.token = token || null;
      this.apiKey = apiKey || null;
      this.endpoints = this._indexEndpoints(spec);
      this._buildNamespaces();
    }

    setToken(token) { this.token = token; }
    setApiKey(key) { this.apiKey = key; }

    _indexEndpoints(spec) {
      const out = [];
      for (const [path, methods] of Object.entries(spec.paths || {})) {
        for (const [method, def] of Object.entries(methods)) {
          if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
          out.push({
            method: method.toUpperCase(),
            path,
            tag: (def.tags && def.tags[0]) || 'Misc',
            summary: def.summary || '',
            security: def.security || [],
          });
        }
      }
      return out;
    }

    _buildNamespaces() {
      // Map endpoints to a friendly nested API: fun.<group>.<action>(...)
      const map = {
        'GET /profile/{funId}': ['profile', 'get', ['funId']],
        'GET /identity/trust/{userId}': ['identity', 'trust', ['userId']],
        'POST /auth/login': ['auth', 'login', []],
        'POST /auth/oauth': ['auth', 'oauth', []],
        'POST /pplp/score': ['pplp', 'score', []],
        'GET /pplp/preview/{userId}': ['pplp', 'preview', ['userId']],
        'GET /pplp/light/{userId}': ['pplp', 'light', ['userId']],
        'POST /pplp/claim': ['pplp', 'claim', []],
        'GET /wallet/balance/{userId}': ['wallet', 'balance', ['userId']],
        'POST /wallet/withdraw': ['wallet', 'withdraw', []],
        'POST /wallet/gift': ['wallet', 'gift', []],
        'GET /game/quest/today': ['game', 'questToday', []],
        'POST /game/quest/claim': ['game', 'claimQuest', []],
        'GET /game/lantern/{userId}': ['game', 'lantern', ['userId']],
        'POST /ai/chat': ['ai', 'chat', []],
        'POST /ai/embed': ['ai', 'embed', []],
        'POST /admin/mint-cycle/run': ['admin', 'runMintCycle', []],
        'POST /admin/fraud/resolve': ['admin', 'resolveFraud', []],
      };

      for (const ep of this.endpoints) {
        const key = ep.method + ' ' + ep.path;
        const target = map[key];
        if (!target) continue;
        const [ns, fn, pathParams] = target;
        if (!this[ns]) this[ns] = {};
        this[ns][fn] = (...args) => {
          // Convention: first N args = path params, last arg = body/query options
          const params = {};
          pathParams.forEach((name, i) => { params[name] = args[i]; });
          const opts = args[pathParams.length] || {};
          return this.request(ep.method, ep.path, { params, body: opts.body, query: opts.query });
        };
      }
    }

    /**
     * Low-level request — use this for endpoints not yet wrapped.
     */
    async request(method, path, { params, body, query } = {}) {
      const filled = fillPath(path, params);
      let url = joinUrl(this.baseUrl, filled);
      if (query) {
        const q = new URLSearchParams(query).toString();
        if (q) url += (url.includes('?') ? '&' : '?') + q;
      }

      const headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
      };
      if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
      if (this.apiKey) headers['x-angel-ingest-key'] = this.apiKey;

      const res = await fetch(url, {
        method,
        headers,
        body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
      });

      const ct = res.headers.get('content-type') || '';
      const payload = ct.includes('application/json') ? await res.json().catch(() => null) : await res.text();

      if (!res.ok) {
        const err = new Error('FunCore ' + res.status + ': ' + (payload?.message || payload?.error || res.statusText));
        err.status = res.status;
        err.payload = payload;
        throw err;
      }
      return payload;
    }

    listEndpoints() { return this.endpoints.slice(); }
    info() { return this.spec.info; }
  }

  const FunCore = { init, FunCoreClient, version: '1.0.0' };

  if (typeof module !== 'undefined' && module.exports) module.exports = FunCore;
  global.FunCore = FunCore;
})(typeof window !== 'undefined' ? window : globalThis);
