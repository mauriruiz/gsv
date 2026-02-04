#!/usr/bin/env bun
/**
 * GSV Deployment Wizard CLI Entry Point
 * 
 * Usage:
 *   bun gateway/alchemy/wizard/bin.ts
 *   bunx gsv-deploy (when published)
 * 
 * Options:
 *   --quick, -q       QuickStart mode (minimal prompts)
 *   --skip-security   Skip security acknowledgment
 *   --skip-cli        Skip CLI installation
 *   --skip-channels   Skip post-deploy channel setup
 *   --name <name>     Stack/deployment name (default: gsv)
 *   --destroy         Destroy existing deployment
 *   --help, -h        Show help
 */

import { runWizard, type WizardOptions } from "./index";
import pc from "picocolors";

function printHelp() {
  console.log(`
${pc.cyan("GSV Deployment Wizard")}

Deploy GSV (Gateway-Session-Vector) infrastructure to Cloudflare.

${pc.bold("Usage:")}
  bun gateway/alchemy/wizard/bin.ts [options]

${pc.bold("Options:")}
  --quick, -q       QuickStart mode (sensible defaults, minimal prompts)
  --skip-security   Skip security acknowledgment prompt
  --skip-cli        Skip CLI binary installation
  --skip-channels   Skip post-deploy channel setup (WhatsApp QR, Discord start)
  --name <name>     Stack/deployment name (default: gsv)
  --destroy         Destroy existing deployment instead of creating
  --help, -h        Show this help message

${pc.bold("Examples:")}
  ${pc.dim("# Interactive setup")}
  bun gateway/alchemy/wizard/bin.ts

  ${pc.dim("# Quick setup with defaults")}
  bun gateway/alchemy/wizard/bin.ts --quick

  ${pc.dim("# Custom stack name")}
  bun gateway/alchemy/wizard/bin.ts --name my-gsv

  ${pc.dim("# Destroy deployment")}
  bun gateway/alchemy/wizard/bin.ts --destroy

${pc.bold("Environment Variables:")}
  DISCORD_BOT_TOKEN   Discord bot token (skips prompt if set)
  ANTHROPIC_API_KEY   Anthropic API key (skips prompt if set)
  OPENAI_API_KEY      OpenAI API key (skips prompt if set)
`);
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const options: WizardOptions = {};
  let destroy = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;

      case "--quick":
      case "-q":
        options.quickstart = true;
        break;

      case "--skip-security":
        options.skipSecurity = true;
        break;

      case "--skip-cli":
        options.skipCli = true;
        break;

      case "--skip-channels":
        options.skipChannelSetup = true;
        break;

      case "--name":
        options.stackName = args[++i];
        if (!options.stackName) {
          console.error(pc.red("Error: --name requires a value"));
          process.exit(1);
        }
        break;

      case "--destroy":
        destroy = true;
        break;

      default:
        if (arg.startsWith("-")) {
          console.error(pc.red(`Unknown option: ${arg}`));
          console.log("Run with --help for usage information.");
          process.exit(1);
        }
    }
  }

  // Handle destroy mode
  if (destroy) {
    console.log(pc.yellow("Destroy mode not yet implemented."));
    console.log("Use: npx tsx alchemy/destroy.ts");
    process.exit(1);
  }

  // Run wizard
  try {
    const result = await runWizard(options);
    
    if (!result) {
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(pc.red("Wizard failed:"), error);
    process.exit(1);
  }
}

main();
