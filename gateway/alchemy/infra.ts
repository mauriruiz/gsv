/**
 * GSV Gateway Infrastructure Definition
 * 
 * This file defines the Cloudflare resources for GSV using Alchemy.
 * Can be used for both deployments and e2e testing.
 */
import {
  Worker,
  DurableObjectNamespace,
  R2Bucket,
  BucketObject,
} from "alchemy/cloudflare";
import * as fs from "node:fs";
import * as path from "node:path";

export type GsvInfraOptions = {
  /** Unique name prefix (use random suffix for tests) */
  name: string;
  /** Worker entrypoint */
  entrypoint?: string;
  /** Enable public URL (for testing) */
  url?: boolean;
  /** Deploy test channel alongside Gateway */
  withTestChannel?: boolean;
  /** Deploy WhatsApp channel */
  withWhatsApp?: boolean;
};

export async function createGsvInfra(opts: GsvInfraOptions) {
  const { 
    name, 
    entrypoint = "src/index.ts", 
    url = false, 
    withTestChannel = false,
    withWhatsApp = false,
  } = opts;

  // R2 bucket for storage (sessions, skills, media)
  const storage = await R2Bucket(`${name}-storage`, {
    name: `${name}-storage`,
    adopt: true,
  });

  // Build service bindings for channels
  const serviceBindings: Record<string, any> = {};
  
  if (withWhatsApp) {
    serviceBindings.CHANNEL_WHATSAPP = {
      type: "service" as const,
      service: `${name}-channel-whatsapp`,
      __entrypoint__: "WhatsAppChannel",
    };
  }

  // Main gateway worker
  const gateway = await Worker(`${name}-worker`, {
    name,
    entrypoint,
    adopt: true,
    bindings: {
      GATEWAY: DurableObjectNamespace("gateway", {
        className: "Gateway",
        sqlite: true,
      }),
      SESSION: DurableObjectNamespace("session", {
        className: "Session",
        sqlite: true,
      }),
      STORAGE: storage,
      ...serviceBindings,
    },
    url,
    compatibilityDate: "2026-01-28",
    compatibilityFlags: ["nodejs_compat"],
    bundle: {
      format: "esm",
      target: "es2022",
    },
  });

  // Optional WhatsApp channel
  let whatsappChannel: Awaited<ReturnType<typeof Worker>> | undefined;
  
  if (withWhatsApp) {
    whatsappChannel = await Worker(`${name}-channel-whatsapp`, {
      name: `${name}-channel-whatsapp`,
      entrypoint: "../channels/whatsapp/src/index.ts",
      adopt: true,
      bindings: {
        WHATSAPP_ACCOUNT: DurableObjectNamespace("whatsapp-account", {
          className: "WhatsAppAccount",
          sqlite: true,
        }),
        // Service binding to Gateway's entrypoint
        GATEWAY: {
          type: "service" as const,
          service: name,
          __entrypoint__: "GatewayEntrypoint",
        },
      },
      url: true,
      compatibilityDate: "2025-09-21",
      compatibilityFlags: ["nodejs_compat"],
      bundle: {
        format: "esm",
        target: "es2022",
        // Alias packages to shims
        alias: {
          "ws": "../channels/whatsapp/src/ws-shim.ts",
          "axios": "../channels/whatsapp/src/axios-shim.ts",
        },
      },
    });
  }

  // Optional test channel for e2e testing
  let testChannel: Awaited<ReturnType<typeof Worker>> | undefined;
  
  if (withTestChannel) {
    testChannel = await Worker(`${name}-test-channel`, {
      name: `${name}-test-channel`,
      entrypoint: "../channels/test/src/index.ts",
      adopt: true,
      bindings: {
        // Service binding to Gateway's entrypoint
        GATEWAY: {
          type: "service" as const,
          service: name, // Gateway's worker name
          __entrypoint__: "GatewayEntrypoint",
        },
      },
      url: true,
      compatibilityDate: "2026-01-28",
      compatibilityFlags: ["nodejs_compat"],
      bundle: {
        format: "esm",
        target: "es2022",
      },
    });
  }

  return { gateway, storage, whatsappChannel, testChannel };
}

/**
 * Upload workspace templates to R2 bucket using Alchemy BucketObject
 */
export async function uploadWorkspaceTemplates(
  bucket: Awaited<ReturnType<typeof R2Bucket>>,
  templatesDir: string = "../templates/workspace",
  agentId: string = "main"
): Promise<void> {
  const files = ["SOUL.md", "USER.md", "MEMORY.md", "AGENTS.md", "HEARTBEAT.md"];
  const basePath = path.resolve(__dirname, templatesDir);

  for (const file of files) {
    const filePath = path.join(basePath, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`   Template not found: ${file}`);
      continue;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const key = `agents/${agentId}/${file}`;

    await BucketObject(`template-${agentId}-${file}`, {
      bucket,
      key,
      content,
      contentType: "text/markdown",
    });

    console.log(`   Uploaded ${key}`);
  }
}
