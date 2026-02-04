/**
 * Security Acknowledgment Step
 */

import type { Prompter } from "../prompter";
import { isCancelled, handleCancel } from "../prompter";
import pc from "picocolors";

export async function securityStep(p: Prompter): Promise<boolean> {
  p.note(
    `${pc.yellow("Security Notice")}\n\n` +
    `GSV gives AI agents the ability to execute shell commands,\n` +
    `read/write files, and access external services on your behalf.\n\n` +
    `This is ${pc.bold("powerful")} but also ${pc.bold("inherently risky")}.\n\n` +
    `Before proceeding, please understand:\n` +
    `  - The AI can run any command your user can run\n` +
    `  - Secrets and API keys will be stored in Cloudflare\n` +
    `  - Channel integrations may expose the agent to external users\n\n` +
    `${pc.dim("Read more: https://github.com/deathbyknowledge/gsv#security")}`,
    "Important"
  );

  const accepted = await p.confirm({
    message: "I understand the risks and want to proceed",
    initialValue: false,
  });

  if (isCancelled(accepted)) {
    handleCancel();
  }

  return accepted;
}
