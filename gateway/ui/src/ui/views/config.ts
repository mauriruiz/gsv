/**
 * Config View
 */

import { html } from "lit";
import type { GsvApp } from "../app";

export function renderConfig(app: GsvApp) {
  return html`
    <div class="view-container">
      <div class="section-header">
        <h2 class="section-title">Configuration</h2>
        <button 
          class="btn btn-secondary btn-sm"
          @click=${() => app["loadConfig"]()}
          ?disabled=${app.configLoading}
        >
          ${app.configLoading ? html`<span class="spinner"></span>` : "Refresh"}
        </button>
      </div>
      
      <div class="cards-grid">
        <!-- Gateway Connection -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Gateway Connection</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Gateway URL</label>
              <input 
                type="text" 
                class="form-input"
                .value=${app.settings.gatewayUrl}
                @change=${(e: Event) => {
                  const input = e.target as HTMLInputElement;
                  app.updateSettings({ gatewayUrl: input.value });
                }}
              />
              <p class="form-hint">WebSocket URL of your GSV Gateway</p>
            </div>
            
            <div class="form-group">
              <label class="form-label">Auth Token</label>
              <input 
                type="password" 
                class="form-input"
                .value=${app.settings.token}
                placeholder="Leave empty if not required"
                @change=${(e: Event) => {
                  const input = e.target as HTMLInputElement;
                  app.updateSettings({ token: input.value });
                }}
              />
              <p class="form-hint">Authentication token (if configured)</p>
            </div>
          </div>
        </div>
        
        <!-- Session -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Session</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Session Key</label>
              <input 
                type="text" 
                class="form-input mono"
                .value=${app.settings.sessionKey}
                @change=${(e: Event) => {
                  const input = e.target as HTMLInputElement;
                  app.updateSettings({ sessionKey: input.value });
                }}
              />
              <p class="form-hint">Format: agent:{agentId}:{channel}:{peerKind}:{peerId}</p>
            </div>
          </div>
        </div>
        
        <!-- Theme -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Appearance</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Theme</label>
              <select 
                class="form-select"
                .value=${app.settings.theme}
                @change=${(e: Event) => {
                  const select = e.target as HTMLSelectElement;
                  app.updateSettings({ theme: select.value as "dark" | "light" | "system" });
                }}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Gateway Config -->
      ${app.config ? html`
        <div class="section-header" style="margin-top: var(--space-8)">
          <h2 class="section-title">Gateway Config</h2>
        </div>
        
        <div class="card">
          <div class="card-body">
            <pre style="margin: 0; font-size: var(--font-size-sm)"><code>${JSON.stringify(app.config, null, 2)}</code></pre>
          </div>
        </div>
      ` : ""}
    </div>
  `;
}
