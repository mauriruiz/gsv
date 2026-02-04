/**
 * Chat View
 */

import { html, nothing } from "lit";
import type { GsvApp } from "../app";
import type { Message, ContentBlock, ToolCallBlock } from "../types";

export function renderChat(app: GsvApp) {
  return html`
    <div class="chat-container">
      <div class="session-bar">
        <span class="session-key">${app.settings.sessionKey}</span>
        <div class="session-stats">
          <span>${app.chatMessages.length} messages</span>
        </div>
      </div>
      
      <div class="chat-messages">
        ${app.chatLoading ? html`
          <div class="thinking-indicator">
            <div class="thinking-dots">
              <span class="thinking-dot"></span>
              <span class="thinking-dot"></span>
              <span class="thinking-dot"></span>
            </div>
            <span>Loading messages...</span>
          </div>
        ` : app.chatMessages.length === 0 ? html`
          <div class="chat-empty">
            <div class="chat-empty-icon">💬</div>
            <h3 class="chat-empty-title">Start a conversation</h3>
            <p class="chat-empty-description">
              Send a message to begin chatting with your GSV agent.
            </p>
          </div>
        ` : html`
          ${app.chatMessages.map(msg => renderMessage(msg))}
          ${app.chatStream ? renderMessage(app.chatStream) : nothing}
          ${app.chatSending && !app.chatStream ? html`
            <div class="message assistant">
              <div class="thinking-indicator">
                <div class="thinking-dots">
                  <span class="thinking-dot"></span>
                  <span class="thinking-dot"></span>
                  <span class="thinking-dot"></span>
                </div>
                <span>Thinking...</span>
              </div>
            </div>
          ` : nothing}
        `}
      </div>
      
      ${renderChatInput(app)}
    </div>
  `;
}

function renderMessage(msg: Message) {
  const isUser = msg.role === "user";
  const isToolResult = msg.role === "toolResult";
  
  if (isToolResult) {
    return nothing; // Tool results are shown inline with tool calls
  }
  
  const content = typeof msg.content === "string" 
    ? msg.content 
    : extractMessageText(msg.content);
  
  const toolCalls = typeof msg.content !== "string" 
    ? (msg.content as ContentBlock[]).filter((b): b is ToolCallBlock => b.type === "toolCall")
    : [];
  
  return html`
    <div class="message ${isUser ? "user" : "assistant"}">
      <div class="message-bubble">
        <div class="message-content">${content}</div>
        ${toolCalls.length > 0 ? html`
          ${toolCalls.map(tc => renderToolCall(tc))}
        ` : nothing}
      </div>
      ${msg.timestamp ? html`
        <div class="message-meta">
          <span>${formatTime(msg.timestamp)}</span>
        </div>
      ` : nothing}
    </div>
  `;
}

function renderToolCall(tc: ToolCallBlock) {
  return html`
    <div class="tool-call">
      <div class="tool-call-header">
        <span class="tool-call-name">
          <span>🔧</span>
          <span>${tc.name}</span>
        </span>
        <span class="tool-call-status">
          <span class="pill pill-success">called</span>
        </span>
      </div>
      <div class="tool-call-body">
        <pre><code>${JSON.stringify(tc.arguments, null, 2)}</code></pre>
      </div>
    </div>
  `;
}

function renderChatInput(app: GsvApp) {
  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.querySelector("textarea") as HTMLTextAreaElement;
    const text = input.value.trim();
    if (text) {
      app.sendMessage(text);
      input.value = "";
      input.style.height = "auto";
    }
  };
  
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      (e.target as HTMLElement).closest("form")?.requestSubmit();
    }
  };
  
  const handleInput = (e: Event) => {
    const textarea = e.target as HTMLTextAreaElement;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };
  
  return html`
    <form class="chat-input-area" @submit=${handleSubmit}>
      <div class="chat-input-wrapper">
        <textarea
          class="chat-input"
          placeholder="Type a message..."
          rows="1"
          ?disabled=${app.chatSending || app.connectionState !== "connected"}
          @keydown=${handleKeydown}
          @input=${handleInput}
        ></textarea>
        <button 
          type="submit" 
          class="btn btn-primary chat-send-btn"
          ?disabled=${app.chatSending || app.connectionState !== "connected"}
        >
          ${app.chatSending ? html`<span class="spinner"></span>` : "→"}
        </button>
      </div>
    </form>
  `;
}

function extractMessageText(content: ContentBlock[]): string {
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map(b => b.text)
    .join("\n");
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
