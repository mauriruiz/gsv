/**
 * GSV WhatsApp Channel Worker
 * 
 * This worker manages WhatsApp accounts as channel connections to GSV Gateway.
 * Each WhatsApp account is a separate Durable Object instance.
 */

// Polyfill for Node.js timer methods not available in Workers
// Baileys uses setInterval(...).unref() which doesn't exist in workerd
// In workerd, timers return numbers, but Node.js returns objects with unref/ref methods

// Wrap timer IDs in objects with unref/ref methods
class TimerRef {
  constructor(public id: number) {}
  unref() { return this; }
  ref() { return this; }
  [Symbol.toPrimitive]() { return this.id; }
}

// Store originals before patching
const _setInterval = globalThis.setInterval;
const _setTimeout = globalThis.setTimeout;
const _clearInterval = globalThis.clearInterval;
const _clearTimeout = globalThis.clearTimeout;

(globalThis as any).setInterval = function(callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) {
  const id = _setInterval(callback as any, ms, ...args);
  return new TimerRef(id as unknown as number);
};

(globalThis as any).setTimeout = function(callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) {
  const id = _setTimeout(callback as any, ms, ...args);
  return new TimerRef(id as unknown as number);
};

(globalThis as any).clearInterval = function(id: unknown) {
  const actualId = id instanceof TimerRef ? id.id : id;
  return _clearInterval(actualId as any);
};

(globalThis as any).clearTimeout = function(id: unknown) {
  const actualId = id instanceof TimerRef ? id.id : id;
  return _clearTimeout(actualId as any);
};

// The 'ws' package used by Baileys isn't compatible with Workers.
// We need to patch Baileys to use native WebSocket instead.
// This is done via wrangler.jsonc alias configuration.

export { WhatsAppAccount } from "./whatsapp-account";

interface Env {
  WHATSAPP_ACCOUNT: DurableObjectNamespace;
  AUTH_TOKEN?: string;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

function checkAuth(request: Request, env: Env): Response | null {
  // If no token configured, skip auth (development mode)
  if (!env.AUTH_TOKEN) {
    return null;
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return Response.json(
      { error: "Missing Authorization header" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
    );
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return Response.json(
      { error: "Invalid Authorization header format. Use: Bearer <token>" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
    );
  }

  const token = match[1];
  if (!timingSafeEqual(token, env.AUTH_TOKEN)) {
    return Response.json(
      { error: "Invalid token" },
      { status: 403 }
    );
  }

  return null; // Auth passed
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check - no auth required
    if (path === "/" || path === "/health") {
      return Response.json({
        service: "gsv-channel-whatsapp",
        status: "ok",
        authRequired: !!env.AUTH_TOKEN,
        usage: {
          login: "POST /account/:accountId/login?format=html",
          logout: "POST /account/:accountId/logout",
          stop: "POST /account/:accountId/stop",
          wake: "POST /account/:accountId/wake",
          status: "GET /account/:accountId/status",
        },
      });
    }

    // All other routes require auth
    const authError = checkAuth(request, env);
    if (authError) return authError;

    // Route: /account/:accountId/...
    const accountMatch = path.match(/^\/account\/([^\/]+)(\/.*)?$/);
    if (accountMatch) {
      const accountId = accountMatch[1];
      const subPath = accountMatch[2] || "/status";
      
      // Get or create the DO for this account
      const id = env.WHATSAPP_ACCOUNT.idFromName(accountId);
      const stub = env.WHATSAPP_ACCOUNT.get(id);
      
      // Forward request to DO with adjusted path
      const doUrl = new URL(request.url);
      doUrl.pathname = subPath;
      
      return stub.fetch(new Request(doUrl.toString(), request));
    }

    // List accounts (would need separate tracking)
    if (path === "/accounts") {
      return Response.json({
        message: "Account listing not yet implemented. Use /account/:accountId/status to check a specific account.",
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
