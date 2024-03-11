/**
 * This function is the first step to determine if an SQL Injection is happening,
 * If the sql statement contains user input, this function returns true (case-insensitive)
 * @param query The SQL Statement you want to check it against
 * @param userInput The user input you want to check
 * @returns True when the sql statement contains the input
 */
export function queryContainsUserInput(query: string, userInput: string) {
  const lowercaseSql = query.toLowerCase();
  const lowercaseInput = userInput.toLowerCase();

  return lowercaseSql.includes(lowercaseInput);
}
