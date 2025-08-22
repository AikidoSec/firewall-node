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

  // Check if user input is a valid comma-separated list of numbers or just a number with dots
  const cleanedInputForList = userInputLowercase.replace(/[,. ]/g, "");

  if (/^\d+$/.test(cleanedInputForList)) {
    return true;
  }

  // Return false if none of the conditions are met
  return false;
}
