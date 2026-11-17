const ALPHANUMERIC_REGEX = /^[a-z0-9_]+$/;
const NUMBER_LIST_REGEX = /^[ ,]*\d[ ,\d]*$/;

// queryLowercase must already be lowercased by the caller, so it is only done once per query
export function shouldReturnEarly(queryLowercase: string, userInput: string) {
  // User input too small or larger than query
  if (userInput.length <= 1 || queryLowercase.length < userInput.length) {
    return true;
  }

  // Lowercase version of user input
  const userInputLowercase = userInput.toLowerCase();

  // User input not in query
  if (!queryLowercase.includes(userInputLowercase)) {
    return true;
  }

  // User input is alphanumerical (with underscores allowed)
  if (ALPHANUMERIC_REGEX.test(userInputLowercase)) {
    return true;
  }

  // Check if user input is a valid comma-separated list of numbers
  if (NUMBER_LIST_REGEX.test(userInput)) {
    return true;
  }

  // Return false if none of the conditions are met
  return false;
}
