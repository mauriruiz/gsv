/**
 * Verification Step
 * 
 * Verifies the Gateway deployment is working correctly.
 */

import type { Prompter } from "../prompter";
import type { WizardState } from "../types";
import pc from "picocolors";

export interface VerificationResult {
  gatewayOk: boolean;
}

export async function verifyStep(
  p: Prompter,
  state: WizardState
): Promise<VerificationResult> {
  const result: VerificationResult = {
    gatewayOk: false,
  };

  if (!state.deployment?.gatewayUrl) {
    p.error("No deployment URL found");
    return result;
  }

  const spinner = p.spinner("Verifying deployment...");

  // Test Gateway health
  try {
    spinner.message("Checking Gateway...");
    const response = await fetch(`${state.deployment.gatewayUrl}/health`);
    if (response.ok) {
      result.gatewayOk = true;
    }
  } catch (error) {
    // Health endpoint might not exist, that's ok
    result.gatewayOk = false;
  }

  spinner.stop("Verification complete");

  // Display results
  p.log(`  Gateway: ${result.gatewayOk ? pc.green("OK") : pc.yellow("Could not verify")}`);

  return result;
}
