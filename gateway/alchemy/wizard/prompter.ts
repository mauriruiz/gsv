/**
 * Wizard Prompter Abstraction
 * 
 * Provides a clean interface for interactive prompts.
 * Currently uses @clack/prompts for CLI, but could be extended
 * for remote/web-based wizard sessions.
 */

import * as clack from "@clack/prompts";
import pc from "picocolors";

export interface SelectOption<T> {
  value: T;
  label: string;
  hint?: string;
}

export interface TextOptions {
  message: string;
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string) => string | undefined;
}

export interface SelectOptions<T> {
  message: string;
  options: SelectOption<T>[];
  initialValue?: T;
}

export interface MultiSelectOptions<T> {
  message: string;
  options: SelectOption<T>[];
  initialValues?: T[];
  required?: boolean;
}

export interface ConfirmOptions {
  message: string;
  initialValue?: boolean;
}

export interface SpinnerHandle {
  stop(message?: string): void;
  message(msg: string): void;
}

export interface Prompter {
  /** Display intro banner */
  intro(title: string): void;
  
  /** Display outro message */
  outro(message: string): void;
  
  /** Display a note/info box */
  note(message: string, title?: string): void;
  
  /** Display a warning */
  warn(message: string): void;
  
  /** Display an error */
  error(message: string): void;
  
  /** Display a success message */
  success(message: string): void;
  
  /** Text input */
  text(options: TextOptions): Promise<string | symbol>;
  
  /** Password/secret input */
  password(options: TextOptions): Promise<string | symbol>;
  
  /** Single select */
  select<T>(options: SelectOptions<T>): Promise<T | symbol>;
  
  /** Multi select */
  multiselect<T>(options: MultiSelectOptions<T>): Promise<T[] | symbol>;
  
  /** Yes/no confirmation */
  confirm(options: ConfirmOptions): Promise<boolean | symbol>;
  
  /** Start a spinner */
  spinner(message: string): SpinnerHandle;
  
  /** Log a message */
  log(message: string): void;
}

/**
 * Check if user cancelled (Ctrl+C)
 */
export function isCancelled(value: unknown): value is symbol {
  return clack.isCancel(value);
}

/**
 * Handle cancellation - exit gracefully
 */
export function handleCancel(): never {
  clack.cancel("Operation cancelled.");
  process.exit(0);
}

/**
 * Create a CLI prompter using @clack/prompts
 */
export function createCliPrompter(): Prompter {
  const s = clack.spinner();
  
  return {
    intro(title: string) {
      console.log();
      clack.intro(pc.bgCyan(pc.black(` ${title} `)));
    },
    
    outro(message: string) {
      clack.outro(message);
    },
    
    note(message: string, title?: string) {
      clack.note(message, title);
    },
    
    warn(message: string) {
      clack.log.warn(message);
    },
    
    error(message: string) {
      clack.log.error(message);
    },
    
    success(message: string) {
      clack.log.success(message);
    },
    
    async text(options: TextOptions) {
      return clack.text({
        message: options.message,
        placeholder: options.placeholder,
        initialValue: options.initialValue,
        validate: options.validate,
      });
    },
    
    async password(options: TextOptions) {
      return clack.password({
        message: options.message,
        validate: options.validate,
      });
    },
    
    async select<T>(options: SelectOptions<T>) {
      return clack.select({
        message: options.message,
        options: options.options,
        initialValue: options.initialValue,
      });
    },
    
    async multiselect<T>(options: MultiSelectOptions<T>) {
      return clack.multiselect({
        message: options.message,
        options: options.options,
        initialValues: options.initialValues,
        required: options.required,
      });
    },
    
    async confirm(options: ConfirmOptions) {
      return clack.confirm({
        message: options.message,
        initialValue: options.initialValue,
      });
    },
    
    spinner(message: string): SpinnerHandle {
      s.start(message);
      return {
        stop(msg?: string) {
          s.stop(msg);
        },
        message(msg: string) {
          s.message(msg);
        },
      };
    },
    
    log(message: string) {
      clack.log.message(message);
    },
  };
}
