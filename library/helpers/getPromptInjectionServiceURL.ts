export function getPromptInjectionServiceURL(): URL {
  if (process.env.PROMPT_INJECTION_SERVICE_URL) {
    return new URL(process.env.PROMPT_INJECTION_SERVICE_URL);
  }

  // Todo add default URL when deployed
  return new URL("http://localhost:8123");
}
