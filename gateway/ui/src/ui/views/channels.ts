/**
 * Channels View
 */

import { html } from "lit";
import type { GsvApp } from "../app";
import type { ChannelRegistryEntry } from "../types";

export function renderChannels(app: GsvApp) {
  return html`
    <div class="view-container">
      <div class="section-header">
        <h2 class="section-title">Connected Channels</h2>
        <button 
          class="btn btn-secondary btn-sm"
          @click=${() => app["loadChannels"]()}
          ?disabled=${app.channelsLoading}
        >
          ${app.channelsLoading ? html`<span class="spinner"></span>` : "Refresh"}
        </button>
      </div>
      
      ${app.channelsLoading && app.channels.length === 0 ? html`
        <div class="card">
          <div class="card-body">
            <div class="thinking-indicator">
              <span class="spinner"></span>
              <span>Loading channels...</span>
            </div>
          </div>
        </div>
      ` : app.channels.length === 0 ? html`
        <div class="empty-state">
          <div class="empty-state-icon">📱</div>
          <h3 class="empty-state-title">No channels connected</h3>
          <p class="empty-state-description">
            Connect WhatsApp, Discord, or other messaging channels to interact with your agent.
          </p>
        </div>
      ` : html`
        <div class="cards-grid">
          ${app.channels.map(ch => renderChannelCard(ch))}
        </div>
      `}
      
      <!-- Available Channels -->
      <div class="section-header" style="margin-top: var(--space-8)">
        <h2 class="section-title">Available Channels</h2>
      </div>
      
      <div class="cards-grid">
        ${renderAvailableChannel("whatsapp", "WhatsApp", "📱", "Personal WhatsApp messaging")}
        ${renderAvailableChannel("discord", "Discord", "🎮", "Discord server integration")}
      </div>
    </div>
  `;
}

function renderChannelCard(channel: ChannelRegistryEntry) {
  const icon = channel.channel === "whatsapp" ? "📱" : 
               channel.channel === "discord" ? "🎮" : "💬";
  
  return html`
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">
          <span style="margin-right: var(--space-2)">${icon}</span>
          ${channel.channel}
        </h3>
        <span class="pill pill-success">Connected</span>
      </div>
      <div class="card-body">
        <div class="kv-list">
          <div class="kv-row">
            <span class="kv-key">Account</span>
            <span class="kv-value">${channel.accountId}</span>
          </div>
          <div class="kv-row">
            <span class="kv-key">Connected</span>
            <span class="kv-value">${formatTime(channel.connectedAt)}</span>
          </div>
          ${channel.lastMessageAt ? html`
            <div class="kv-row">
              <span class="kv-key">Last Message</span>
              <span class="kv-value">${formatTime(channel.lastMessageAt)}</span>
            </div>
          ` : ""}
        </div>
      </div>
    </div>
  `;
}

function renderAvailableChannel(id: string, name: string, icon: string, description: string) {
  return html`
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">
          <span style="margin-right: var(--space-2)">${icon}</span>
          ${name}
        </h3>
      </div>
      <div class="card-body">
        <p class="text-secondary" style="font-size: var(--font-size-sm); margin-bottom: var(--space-3)">
          ${description}
        </p>
        <p class="muted" style="font-size: var(--font-size-xs)">
          Use CLI: <code>gsv channel ${id} login</code>
        </p>
      </div>
    </div>
  `;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}
