#!/usr/bin/env tsx
/**
 * Deploy GSV Gateway using Alchemy
 * 
 * Usage: 
 *   bun run deploy:alchemy              # Deploy gateway only
 *   bun run deploy:alchemy --whatsapp   # Deploy gateway + WhatsApp channel
 *   bun run deploy:alchemy --templates  # Deploy + upload workspace templates
 *   bun run deploy:alchemy --destroy    # Tear down resources
 */
import alchemy from "alchemy";
import { createGsvInfra, uploadWorkspaceTemplates } from "./infra.ts";

const STACK_NAME = "gsv";
const WORKER_NAME = "gateway";

const withWhatsApp = process.argv.includes("--whatsapp");
const withTemplates = process.argv.includes("--templates") || process.argv.includes("--whatsapp");
const isDestroy = process.argv.includes("--destroy");

console.log(`\n🚀 GSV Deployment`);
console.log(`   Stack: ${STACK_NAME}`);
console.log(`   WhatsApp: ${withWhatsApp ? "yes" : "no"}`);
console.log(`   Templates: ${withTemplates ? "yes" : "no"}`);
console.log("");

const app = await alchemy(STACK_NAME, {
  phase: isDestroy ? "destroy" : "up",
  stateDir: ".alchemy",
});

const { gateway, storage, whatsappChannel } = await createGsvInfra({
  name: WORKER_NAME,
  entrypoint: "src/index.ts",
  url: true,
  withWhatsApp,
});

if (!isDestroy) {
  console.log("\n✅ Deployed successfully!\n");
  console.log(`   Gateway:  ${gateway.url}`);
  console.log(`   Storage:  ${storage.name}`);
  
  if (whatsappChannel) {
    console.log(`   WhatsApp: ${whatsappChannel.url}`);
  }

  // Upload workspace templates if requested
  if (withTemplates) {
    console.log("\n📁 Uploading workspace templates...");
    try {
      await uploadWorkspaceTemplates(storage);
      console.log("   Done!");
    } catch (err) {
      console.error("   Failed:", err);
    }
  }

  // Print next steps
  console.log("\n📋 Next steps:");
  console.log("");
  console.log("   1. Set secrets:");
  console.log(`      bunx wrangler secret put AUTH_TOKEN --name ${WORKER_NAME}`);
  console.log(`      bunx wrangler secret put ANTHROPIC_API_KEY --name ${WORKER_NAME}`);
  
  if (whatsappChannel) {
    console.log(`      bunx wrangler secret put AUTH_TOKEN --name ${WORKER_NAME}-channel-whatsapp`);
  }
  
  console.log("");
  console.log("   2. Configure CLI:");
  console.log(`      gsv init`);
  console.log(`      gsv local-config set gateway.url ${gateway.url?.replace("https://", "wss://")}/ws`);
  console.log(`      gsv local-config set gateway.token <your-auth-token>`);
  
  if (whatsappChannel) {
    console.log(`      gsv local-config set channels.whatsapp.url ${whatsappChannel.url}`);
    console.log(`      gsv local-config set channels.whatsapp.token <your-whatsapp-token>`);
    console.log("");
    console.log("   3. Login to WhatsApp:");
    console.log(`      gsv channel whatsapp login`);
  }
  
  console.log("");
} else {
  console.log("\n✅ Resources destroyed!");
}
