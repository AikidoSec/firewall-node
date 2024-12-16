export function shouldReturnEarly(code: string, userInput: string) {
  // User input too small or larger than query
  if (userInput.length <= 1 || code.length < userInput.length) {
    return true;
  }

  // User input not in query
  if (!code.includes(userInput)) {
    return true;
  }

  // User input is alphanumerical (with underscores allowed)
  if (userInput.match(/^[a-z0-9_]+$/i)) {
    return true;
  }

  // Check if user input is a valid comma-separated list of numbers
  const cleanedInputForList = userInput.replace(/ /g, "").replace(/,/g, "");

  if (/^\d+$/.test(cleanedInputForList)) {
    return true;
  }

  // Return false if none of the conditions are met
  return false;
}
