const ALLOWED_SHELLS = ["sh", "/bin/sh"];

/**
 * Returns true if the shell is not /bin/sh (the POSIX default).
 * In strict mode, only /bin/sh is allowed because the WASM tokenizer targets POSIX shell.
 * `true` means Node.js will use /bin/sh by default, so that's fine.
 */
export function isUnsupportedShell(shell: string | true): boolean {
  if (shell === true) {
    return false;
  }

  return !ALLOWED_SHELLS.includes(shell);
}
