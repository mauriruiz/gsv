/**
 * GSV Discord Channel Worker
 * 
 * Implements ChannelWorkerInterface for Discord integration.
 * Uses a Durable Object (DiscordGateway) to maintain persistent WebSocket
 * connection to Discord's Gateway API.
 */

import { WorkerEntrypoint } from "cloudflare:workers";
import type {
  ChannelWorkerInterface,
  ChannelCapabilities,
  ChannelAccountStatus,
  ChannelOutboundMessage,
  ChannelPeer,
  StartResult,
  StopResult,
  SendResult,
  GatewayChannelInterface,
} from "./types";

export { DiscordGateway } from "./discord-gateway";

// Re-export interface types for consumers
export type * from "./types";

interface Env {
  DISCORD_GATEWAY: DurableObjectNamespace;
  GATEWAY: GatewayChannelInterface;
  // Secrets
  DISCORD_BOT_TOKEN?: string;
}

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Discord Channel Entrypoint
 * 
 * Gateway calls these methods via Service Binding.
 */
export default class DiscordChannel extends WorkerEntrypoint<Env> implements ChannelWorkerInterface {
  readonly channelId = "discord";
  
  readonly capabilities: ChannelCapabilities = {
    chatTypes: ["dm", "group", "channel", "thread"],
    media: true,
    reactions: true,
    threads: true,
    typing: true,
    editing: true,
    deletion: true,
  };

  /**
   * Start Discord Gateway connection for an account.
   */
  async start(accountId: string, config: Record<string, unknown>): Promise<StartResult> {
    const botToken = (config.botToken as string) || this.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      return { ok: false, error: "No bot token provided" };
    }

    try {
      const gateway = this.getGatewayDO(accountId);
      await gateway.start(botToken);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Stop Discord Gateway connection.
   */
  async stop(accountId: string): Promise<StopResult> {
    try {
      const gateway = this.getGatewayDO(accountId);
      await gateway.stop();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Get status of Discord connection(s).
   */
  async status(accountId?: string): Promise<ChannelAccountStatus[]> {
    if (accountId) {
      const gateway = this.getGatewayDO(accountId);
      const state = await gateway.getStatus();
      return [state];
    }
    // TODO: Track all active accounts and return their statuses
    return [];
  }

  /**
   * Send a message to a Discord channel.
   */
  async send(accountId: string, message: ChannelOutboundMessage): Promise<SendResult> {
    const botToken = this.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      return { ok: false, error: "No bot token configured" };
    }

    try {
      const channelId = message.peer.id;
      const body: Record<string, unknown> = {
        content: message.text,
      };

      if (message.replyToId) {
        body.message_reference = {
          message_id: message.replyToId,
        };
      }

      // TODO: Handle media attachments

      const response = await this.discordFetch(`/channels/${channelId}/messages`, {
        method: "POST",
        botToken,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        return { ok: false, error: `Discord API error: ${response.status} ${error}` };
      }

      const data = await response.json<{ id: string }>();
      return { ok: true, messageId: data.id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Send typing indicator.
   */
  async setTyping(accountId: string, peer: ChannelPeer, typing: boolean): Promise<void> {
    if (!typing) return; // Discord doesn't have "stop typing"

    const botToken = this.env.DISCORD_BOT_TOKEN;
    if (!botToken) return;

    await this.discordFetch(`/channels/${peer.id}/typing`, {
      method: "POST",
      botToken,
    });
  }

  // ─────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────

  private getGatewayDO(accountId: string) {
    const id = this.env.DISCORD_GATEWAY.idFromName(accountId);
    return this.env.DISCORD_GATEWAY.get(id) as unknown as DiscordGatewayStub;
  }

  private async discordFetch(
    path: string,
    init: RequestInit & { botToken: string }
  ): Promise<Response> {
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bot ${init.botToken}`);
    if (!headers.has("Content-Type") && init.body) {
      headers.set("Content-Type", "application/json; charset=utf-8");
    }

    const response = await fetch(`${DISCORD_API}${path}`, { ...init, headers });

    // Handle rate limiting
    if (response.status === 429) {
      const data = await response.json<{ retry_after?: number }>();
      const retryAfterMs = Math.ceil((data.retry_after ?? 1) * 1000);
      await new Promise((r) => setTimeout(r, retryAfterMs));
      return fetch(`${DISCORD_API}${path}`, { ...init, headers });
    }

    return response;
  }
}

// Type for DO stub methods
interface DiscordGatewayStub {
  start(botToken: string): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<ChannelAccountStatus>;
}
