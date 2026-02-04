#!/usr/bin/env bun
/**
 * Destroy GSV resources using Alchemy
 * 
 * Usage: 
 *   ALCHEMY_PASSWORD=xxx bun alchemy/destroy.ts
 *   ALCHEMY_PASSWORD=xxx bun alchemy/destroy.ts --name my-stack
 */
import alchemy from "alchemy";
import { createGsvInfra } from "./infra";

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  let stackName = "gsv";
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--name" && args[i + 1]) {
      stackName = args[++i];
    }
  }

  if (!process.env.ALCHEMY_PASSWORD) {
    console.error("Error: ALCHEMY_PASSWORD environment variable required");
    console.error("Usage: ALCHEMY_PASSWORD=xxx bun alchemy/destroy.ts");
    process.exit(1);
  }

  console.log(`🗑️  Destroying GSV resources (stack: ${stackName})...\n`);

  const app = await alchemy(stackName, {
    stage: process.env.USER || "default",
    phase: "destroy",
    password: process.env.ALCHEMY_PASSWORD,
  });

  try {
    // Need to "create" resources so alchemy knows what to destroy
    // Match the options used during deployment
    await createGsvInfra({
      name: stackName,
      url: true,
      withWhatsApp: true,
      withDiscord: true,
      withTemplates: true,
    });

    await app.finalize();
    console.log("\n✅ Resources destroyed!");
  } catch (err) {
    console.error("Destroy failed:", err);
    process.exit(1);
  }
}

main();
