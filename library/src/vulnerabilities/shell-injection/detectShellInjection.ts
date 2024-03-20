export function detectShellInjection(
  command: string,
  userInput: string,
  shell: string
): boolean {
  console.log(command, userInput, shell);
  return false;
}
