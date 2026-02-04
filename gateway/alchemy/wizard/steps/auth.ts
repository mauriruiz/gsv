/**
 * Auth Token Generation Step
 */

import type { Prompter } from "../prompter";
import type { WizardMode } from "../types";
import { isCancelled, handleCancel } from "../prompter";
import { randomBytes } from "node:crypto";
import pc from "picocolors";

/**
 * Generate a secure random auth token
 */
export function generateAuthToken(): string {
  return `gsv_${randomBytes(32).toString("base64url")}`;
}

export async function authStep(p: Prompter, mode: WizardMode): Promise<string> {
  if (mode === "quickstart") {
    // Auto-generate in quickstart mode
    const token = generateAuthToken();
    p.log(`Generated auth token: ${pc.dim(token.slice(0, 20) + "...")}`);
    return token;
  }

  // Advanced mode: ask user
  const choice = await p.select<"generate" | "custom">({
    message: "Gateway authentication token",
    options: [
      {
        value: "generate",
        label: "Generate new token",
        hint: "Recommended",
      },
      {
        value: "custom",
        label: "Enter custom token",
        hint: "Use your own secret",
      },
    ],
    initialValue: "generate",
  });

  if (isCancelled(choice)) {
    handleCancel();
  }

  if (choice === "generate") {
    const token = generateAuthToken();
    p.log(`Generated: ${pc.dim(token)}`);
    return token;
  }

  const token = await p.password({
    message: "Enter your auth token",
    validate: (value) => {
      if (value.length < 16) {
        return "Token must be at least 16 characters";
      }
    },
  });

  if (isCancelled(token)) {
    handleCancel();
  }

  return token;
}
