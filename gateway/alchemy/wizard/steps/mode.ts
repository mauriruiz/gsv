/**
 * Mode Selection Step
 */

import type { Prompter } from "../prompter";
import type { WizardMode } from "../types";
import { isCancelled, handleCancel } from "../prompter";

export async function modeStep(p: Prompter): Promise<WizardMode> {
  const mode = await p.select<WizardMode>({
    message: "How would you like to set up GSV?",
    options: [
      {
        value: "quickstart",
        label: "QuickStart",
        hint: "Sensible defaults, minimal prompts",
      },
      {
        value: "advanced",
        label: "Advanced",
        hint: "Full control over all settings",
      },
    ],
    initialValue: "quickstart",
  });

  if (isCancelled(mode)) {
    handleCancel();
  }

  return mode;
}
