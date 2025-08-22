export function shouldReturnEarly(query: string, userInput: string) {
  // User input too small or larger than query
  if (userInput.length <= 1 || query.length < userInput.length) {
    return true;
  }

  // Lowercase versions of query and user input
  const queryLowercase = query.toLowerCase();
  const userInputLowercase = userInput.toLowerCase();

  // User input not in query
  if (!queryLowercase.includes(userInputLowercase)) {
    return true;
  }

  // User input is alphanumerical (with underscores allowed)
  if (userInputLowercase.match(/^[a-z0-9_]+$/i)) {
    return true;
  }

  // Don't run the following checks on large inputs
  if (userInput.length > 10_000) {
    return false;
  }

  // Check if user input is a valid comma-separated list of numbers
  const cleanedInputForList = userInputLowercase
    .replace(/ /g, "")
    .replace(/,/g, "");

  // Allow numbers and decimals / numbers with multiple dots
  if (/^\d+(?:\.\d+)*$/.test(cleanedInputForList)) {
    return true;
  }

  // Return false if none of the conditions are met
  return false;
}
