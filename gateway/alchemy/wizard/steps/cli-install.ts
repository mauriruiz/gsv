/**
 * CLI Installation Step
 * 
 * Installs the GSV CLI using cargo install --path.
 */

import type { Prompter } from "../prompter";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import pc from "picocolors";

/**
 * Find the CLI directory relative to the wizard
 */
function findCliPath(): string | null {
  // Wizard is at gateway/alchemy/wizard/steps/
  // CLI is at cli/
  const wizardDir = dirname(import.meta.url.replace("file://", ""));
  
  // Try relative path from wizard location
  const candidates = [
    join(wizardDir, "../../../../cli"),  // From steps/
    join(wizardDir, "../../../cli"),     // From wizard/
    join(process.cwd(), "cli"),          // From project root
    join(process.cwd(), "../cli"),       // From gateway/
  ];
  
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "Cargo.toml"))) {
      return candidate;
    }
  }
  
  return null;
}

/**
 * Check if gsv CLI is already installed
 */
async function isCliInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("gsv", ["--version"], {
      stdio: "pipe",
      shell: true,
    });
    
    proc.on("close", (code) => {
      resolve(code === 0);
    });
    
    proc.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Install CLI using cargo install --path
 */
async function installCli(cliPath: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn("cargo", ["install", "--path", cliPath], {
      stdio: "pipe",
      shell: true,
    });
    
    let stderr = "";
    
    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    
    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || `Exit code: ${code}` });
      }
    });
    
    proc.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Check if cargo is available
 */
async function hasRust(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("cargo", ["--version"], {
      stdio: "pipe",
      shell: true,
    });
    
    proc.on("close", (code) => {
      resolve(code === 0);
    });
    
    proc.on("error", () => {
      resolve(false);
    });
  });
}

export interface CliInstallResult {
  installed: boolean;
  skipped: boolean;
  error?: string;
}

/**
 * Install the GSV CLI
 */
export async function installCliStep(p: Prompter): Promise<CliInstallResult> {
  // Check if already installed
  if (await isCliInstalled()) {
    p.success("GSV CLI already installed");
    return { installed: true, skipped: false };
  }

  // Check for Rust
  if (!await hasRust()) {
    p.warn("Rust not found. Install from https://rustup.rs");
    p.note(
      "After installing Rust, run:\n" +
      "  cargo install --path cli",
      "Manual CLI Installation"
    );
    return { installed: false, skipped: true, error: "Rust not installed" };
  }

  // Find CLI path
  const cliPath = findCliPath();
  if (!cliPath) {
    p.warn("Could not find CLI directory");
    return { installed: false, skipped: true, error: "CLI path not found" };
  }

  const spinner = p.spinner("Installing GSV CLI...");
  
  const result = await installCli(cliPath);
  
  if (result.success) {
    spinner.stop(pc.green("GSV CLI installed!"));
    return { installed: true, skipped: false };
  } else {
    spinner.stop(pc.yellow("CLI installation failed"));
    p.warn(`Installation failed: ${result.error}`);
    p.note(
      `Run this command to install manually:\n` +
      `  cargo install --path ${cliPath}`,
      "Manual CLI Installation"
    );
    return { installed: false, skipped: false, error: result.error };
  }
}
