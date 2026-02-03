/**
 * Discord Gateway Durable Object
 * 
 * Maintains persistent WebSocket connection to Discord's Gateway API.
 * Handles IDENTIFY, HEARTBEAT, RESUME, and dispatches events to GSV Gateway.
 * 
 * Based on: https://discord.com/developers/docs/topics/gateway
 */

import { DurableObject } from "cloudflare:workers";
import type {
  ChannelAccountStatus,
  ChannelInboundMessage,
  GatewayChannelInterface,
} from "./types";

const DISCORD_GATEWAY_URL = "https://discord.com/api/v10/gateway";

// Discord Gateway Opcodes
const OP = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  PRESENCE_UPDATE: 3,
  VOICE_STATE_UPDATE: 4,
  RESUME: 6,
  RECONNECT: 7,
  REQUEST_GUILD_MEMBERS: 8,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
} as const;

// Discord Gateway Intents
const INTENTS = {
  GUILDS: 1 << 0,
  GUILD_MESSAGES: 1 << 9,
  GUILD_MESSAGE_REACTIONS: 1 << 10,
  DIRECT_MESSAGES: 1 << 12,
  DIRECT_MESSAGE_REACTIONS: 1 << 13,
  MESSAGE_CONTENT: 1 << 15,
} as const;

type GatewayState = {
  botToken: string | null;
  sessionId: string | null;
  resumeGatewayUrl: string | null;
  seq: number | null;
  connected: boolean;
  lastHeartbeatAck: number | null;
  lastError: string | null;
};

interface Env {
  GATEWAY: GatewayChannelInterface;
}

export class DiscordGateway extends DurableObject<Env> {
  private ws: WebSocket | null = null;
  private heartbeatInterval: number = 0;
  private state: GatewayState = {
    botToken: null,
    sessionId: null,
    resumeGatewayUrl: null,
    seq: null,
    connected: false,
    lastHeartbeatAck: null,
    lastError: null,
  };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.loadState();
  }

  private async loadState() {
    const stored = await this.ctx.storage.get<GatewayState>("state");
    if (stored) {
      this.state = { ...this.state, ...stored };
    }
  }

  private async saveState() {
    await this.ctx.storage.put("state", this.state);
  }

  // ─────────────────────────────────────────────────────────
  // Public RPC Methods (called by WorkerEntrypoint)
  // ─────────────────────────────────────────────────────────

  async start(botToken: string): Promise<void> {
    if (this.ws && this.state.connected) {
      console.log("[DiscordGateway] Already connected");
      return;
    }

    this.state.botToken = botToken;
    await this.saveState();
    await this.connect();
  }

  async stop(): Promise<void> {
    if (this.ws) {
      this.ws.close(1000, "Stopped by user");
      this.ws = null;
    }
    this.state.connected = false;
    await this.saveState();
    await this.ctx.storage.deleteAlarm();
  }

  async getStatus(): Promise<ChannelAccountStatus> {
    return {
      accountId: this.ctx.id.toString(),
      connected: this.state.connected,
      authenticated: !!this.state.sessionId,
      mode: "gateway",
      lastActivity: this.state.lastHeartbeatAck ?? undefined,
      error: this.state.lastError ?? undefined,
      extra: {
        sessionId: this.state.sessionId,
        seq: this.state.seq,
      },
    };
  }

  // ─────────────────────────────────────────────────────────
  // Alarm Handler (for heartbeats)
  // ─────────────────────────────────────────────────────────

  async alarm() {
    await this.sendHeartbeat();
  }

  // ─────────────────────────────────────────────────────────
  // WebSocket Connection
  // ─────────────────────────────────────────────────────────

  private async connect() {
    console.log("[DiscordGateway] Connecting...");

    // Get gateway URL
    let gatewayUrl = this.state.resumeGatewayUrl;
    if (!gatewayUrl) {
      const response = await fetch(DISCORD_GATEWAY_URL);
      const data = await response.json<{ url: string }>();
      gatewayUrl = data.url;
    }

    // Parse and modify URL for WebSocket
    const url = new URL(gatewayUrl);
    url.searchParams.set("v", "10");
    url.searchParams.set("encoding", "json");

    // Open WebSocket connection
    const response = await fetch(url.toString().replace("wss://", "https://"), {
      headers: {
        Upgrade: "websocket",
      },
    });

    const ws = response.webSocket;
    if (!ws) {
      this.state.lastError = "Failed to establish WebSocket connection";
      await this.saveState();
      throw new Error(this.state.lastError);
    }

    ws.accept();
    this.ws = ws;

    // Set up event handlers
    ws.addEventListener("message", (event) => this.handleMessage(event.data as string));
    ws.addEventListener("close", (event) => this.handleClose(event));
    ws.addEventListener("error", (event) => this.handleError(event));
  }

  private async handleMessage(rawData: string) {
    const payload = JSON.parse(rawData);
    const { op, t, d, s } = payload;

    // Track sequence number
    if (s !== null) {
      this.state.seq = s;
    }

    switch (op) {
      case OP.HELLO:
        this.heartbeatInterval = d.heartbeat_interval;
        await this.scheduleHeartbeat();
        
        // IDENTIFY or RESUME
        if (this.state.sessionId && this.state.seq !== null) {
          await this.resume();
        } else {
          await this.identify();
        }
        break;

      case OP.HEARTBEAT_ACK:
        this.state.lastHeartbeatAck = Date.now();
        break;

      case OP.DISPATCH:
        await this.handleDispatch(t, d);
        break;

      case OP.RECONNECT:
        console.log("[DiscordGateway] Received RECONNECT, reconnecting...");
        this.ws?.close(4000, "Reconnect requested");
        break;

      case OP.INVALID_SESSION:
        console.log("[DiscordGateway] Invalid session, re-identifying...");
        this.state.sessionId = null;
        this.state.seq = null;
        await this.saveState();
        
        // Wait a bit before re-identifying (Discord docs recommend 1-5 seconds)
        await new Promise((r) => setTimeout(r, 2000));
        await this.identify();
        break;
    }

    await this.saveState();
  }

  private async handleDispatch(eventType: string, data: unknown) {
    const d = data as Record<string, unknown>;

    switch (eventType) {
      case "READY":
        this.state.sessionId = d.session_id as string;
        this.state.resumeGatewayUrl = d.resume_gateway_url as string;
        this.state.connected = true;
        this.state.lastError = null;
        console.log(`[DiscordGateway] Connected as ${(d.user as { username: string })?.username}`);
        await this.saveState();
        break;

      case "RESUMED":
        this.state.connected = true;
        this.state.lastError = null;
        console.log("[DiscordGateway] Session resumed");
        await this.saveState();
        break;

      case "MESSAGE_CREATE":
        await this.handleMessageCreate(d);
        break;

      // Add more event handlers as needed
    }
  }

  private async handleMessageCreate(data: Record<string, unknown>) {
    const author = data.author as { id: string; username: string; bot?: boolean } | undefined;
    
    // Ignore bot messages
    if (author?.bot) return;

    // Ignore messages without content
    const content = data.content as string;
    if (!content) return;

    const guildId = data.guild_id as string | undefined;
    const channelId = data.channel_id as string;
    const messageId = data.id as string;

    // Build inbound message
    const message: ChannelInboundMessage = {
      messageId,
      peer: {
        kind: guildId ? "group" : "dm",
        id: channelId,
        name: undefined, // Could fetch channel name
      },
      sender: author ? {
        id: author.id,
        name: author.username,
        handle: author.username,
      } : undefined,
      text: content,
      timestamp: data.timestamp ? new Date(data.timestamp as string).getTime() : Date.now(),
      // TODO: Handle mentions, attachments, embeds
    };

    // Forward to GSV Gateway
    try {
      const accountId = this.ctx.id.toString();
      await this.env.GATEWAY.channelInbound("discord", accountId, message);
    } catch (e) {
      console.error("[DiscordGateway] Failed to forward message to gateway:", e);
    }
  }

  private async identify() {
    if (!this.state.botToken) {
      throw new Error("No bot token set");
    }

    const intents = 
      INTENTS.GUILDS |
      INTENTS.GUILD_MESSAGES |
      INTENTS.DIRECT_MESSAGES |
      INTENTS.MESSAGE_CONTENT;

    this.ws?.send(JSON.stringify({
      op: OP.IDENTIFY,
      d: {
        token: this.state.botToken,
        intents,
        properties: {
          os: "cloudflare",
          browser: "gsv",
          device: "gsv",
        },
      },
    }));
  }

  private async resume() {
    if (!this.state.botToken || !this.state.sessionId) {
      return this.identify();
    }

    this.ws?.send(JSON.stringify({
      op: OP.RESUME,
      d: {
        token: this.state.botToken,
        session_id: this.state.sessionId,
        seq: this.state.seq,
      },
    }));
  }

  private async sendHeartbeat() {
    if (!this.ws) return;

    this.ws.send(JSON.stringify({
      op: OP.HEARTBEAT,
      d: this.state.seq,
    }));

    await this.scheduleHeartbeat();
  }

  private async scheduleHeartbeat() {
    if (this.heartbeatInterval > 0) {
      // Add jitter as recommended by Discord
      const jitter = Math.random();
      const delay = Math.floor(this.heartbeatInterval * jitter);
      await this.ctx.storage.setAlarm(Date.now() + this.heartbeatInterval + delay);
    }
  }

  private handleClose(event: CloseEvent) {
    console.log(`[DiscordGateway] WebSocket closed: ${event.code} ${event.reason}`);
    this.ws = null;
    this.state.connected = false;

    // Attempt to reconnect for recoverable close codes
    const recoverableCodes = [4000, 4001, 4002, 4003, 4005, 4007, 4008, 4009];
    if (recoverableCodes.includes(event.code) && this.state.botToken) {
      console.log("[DiscordGateway] Attempting to reconnect...");
      this.ctx.waitUntil(this.connect());
    }
  }

  private handleError(event: Event) {
    console.error("[DiscordGateway] WebSocket error:", event);
    this.state.lastError = "WebSocket error";
  }
}
