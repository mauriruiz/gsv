import { GsvConfig, AgentConfig } from ".";

/**
 * Parse a duration string like "30m", "1h", "2h30m" into milliseconds
 */
export function parseDuration(duration: string): number {
  if (!duration || duration === "0" || duration === "0m") return 0;
  
  let ms = 0;
  const hourMatch = duration.match(/(\d+)h/);
  const minMatch = duration.match(/(\d+)m/);
  const secMatch = duration.match(/(\d+)s/);
  
  if (hourMatch) ms += parseInt(hourMatch[1]) * 60 * 60 * 1000;
  if (minMatch) ms += parseInt(minMatch[1]) * 60 * 1000;
  if (secMatch) ms += parseInt(secMatch[1]) * 1000;
  
  return ms;
}

/**
 * Get agent config by ID, with defaults merged
 */
export function getAgentConfig(config: GsvConfig, agentId: string): AgentConfig {
  const found = config.agents.list.find(a => a.id === agentId);
  
  if (found) {
    return found;
  }
  
  // Return a default agent config for the requested ID
  return {
    id: agentId,
    default: agentId === "main",
  };
}

/**
 * Get the default agent ID
 */
export function getDefaultAgentId(config: GsvConfig): string {
  const defaultAgent = config.agents.list.find(a => a.default);
  return defaultAgent?.id ?? "main";
}

/**
 * Normalize a phone number to E.164 format (e.g., "+1234567890")
 * Handles WhatsApp JIDs like "1234567890@s.whatsapp.net"
 */
export function normalizeE164(raw: string): string {
  if (!raw) return "";
  
  // Strip WhatsApp JID suffix
  let cleaned = raw.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "");
  
  // Strip device suffix (e.g., "1234567890:13" -> "1234567890")
  cleaned = cleaned.replace(/:\d+$/, "");
  
  // Strip non-digit characters except leading +
  const hasPlus = cleaned.startsWith("+");
  cleaned = cleaned.replace(/\D/g, "");
  
  if (!cleaned) return "";
  
  return hasPlus || cleaned.length >= 10 ? `+${cleaned}` : cleaned;
}

/**
 * Check if a sender is allowed based on channel config
 * Returns: { allowed, needsPairing, reason }
 */
export function isAllowedSender(
  config: GsvConfig,
  channel: string,
  senderId: string,
  peerId?: string,
): { allowed: boolean; needsPairing?: boolean; reason?: string } {
  const channelConfig = config.channels[channel];
  if (!channelConfig) { // allow on unset
    return { allowed: true };
  }
  
  const policy = channelConfig.dmPolicy;
  
  if (policy === "open") {
    return { allowed: true };
  }
  
  const allowFrom = channelConfig.allowFrom;
  
  // Check for wildcard
  if (allowFrom.includes("*")) {
    return { allowed: true };
  }
  
  // Normalize the sender ID
  const normalizedSender = normalizeE164(senderId);
  
  // Check if sender is in allowlist
  for (const entry of allowFrom) {
    const normalizedEntry = normalizeE164(entry);
    if (normalizedEntry && normalizedSender === normalizedEntry) {
      return { allowed: true };
    }
    
    // Also check against the raw peerId (for groups)
    if (peerId && entry === peerId) {
      return { allowed: true };
    }
  }
  
  // Sender not in allowlist
  if (policy === "pairing") {
    // Pairing mode: mark as needing pairing approval
    return { 
      allowed: false, 
      needsPairing: true,
      reason: `Sender ${normalizedSender} needs pairing approval` 
    };
  }
  
  // Allowlist mode: just block
  return { 
    allowed: false, 
    reason: `Sender ${normalizedSender} not in allowFrom list` 
  };
}

/**
 * Resolve agent ID from a channel/peer match
 */
export function resolveAgentIdFromBinding(
  config: GsvConfig,
  channel: string,
  accountId?: string,
  peer?: { kind: string; id: string },
): string {
  const bindings = config.agents.bindings;
  
  for (const binding of bindings) {
    const match = binding.match;
    
    // Check channel match
    if (match.channel && match.channel !== channel) continue;
    
    // Check account match
    if (match.accountId && match.accountId !== accountId) continue;
    
    // Check peer match
    if (match.peer) {
      if (!peer) continue;
      if (match.peer.kind && match.peer.kind !== peer.kind) continue;
      if (match.peer.id && match.peer.id !== peer.id) continue;
    }
    
    // All conditions matched
    return binding.agentId;
  }
  
  // No binding matched, return default agent
  return getDefaultAgentId(config);
}

/**
 * Resolve linked identity for session routing.
 * 
 * Identity links allow multiple channel identities (WhatsApp number, Telegram ID, etc.)
 * to route to a single session using a canonical name.
 * 
 * Config example:
 * ```
 * session:
 *   identityLinks:
 *     steve:
 *       - "+31628552611"           # WhatsApp number (E.164)
 *       - "telegram:123456789"     # Telegram user ID
 *       - "whatsapp:+34675706329"  # Explicit channel prefix
 * ```
 * 
 * @param config - GsvConfig containing identity links
 * @param channel - Channel name (e.g., "whatsapp", "telegram", "cli")
 * @param senderId - Sender ID (phone number, user ID, etc.)
 * @returns Canonical name if found, null otherwise
 */
export function resolveLinkedIdentity(
  config: GsvConfig,
  channel: string,
  senderId: string,
): string | null {
  const links = config.session.identityLinks;
  
  // Normalize sender ID for matching
  const normalizedSender = normalizeE164(senderId);
  
  for (const [canonicalName, identities] of Object.entries(links)) {
    for (const identity of identities) {
      // Check for channel-prefixed format: "whatsapp:+123" or "telegram:456"
      if (identity.includes(":")) {
        const [idChannel, idValue] = identity.split(":", 2);
        if (idChannel.toLowerCase() === channel.toLowerCase()) {
          const normalizedIdValue = normalizeE164(idValue);
          if (normalizedIdValue === normalizedSender) {
            return canonicalName;
          }
        }
        continue;
      }
      
      // No prefix - assume it's a phone number (matches any channel)
      const normalizedIdentity = normalizeE164(identity);
      if (normalizedIdentity && normalizedIdentity === normalizedSender) {
        return canonicalName;
      }
    }
  }
  
  return null;
}