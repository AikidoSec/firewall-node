/**
 * This function is used for urls, because they can contain a TAB, carriage return or line feed that is silently removed by the URL constructor.
 *
 * The WHATWG URL spec defines the following:
 * - Remove all ASCII tab or newline from input.
 * - An ASCII tab or newline is U+0009 TAB, U+000A LF, or U+000D CR.
 *
 * Also, backslashes are converted to forward slashes by the URL constructor.
 *
 * See https://url.spec.whatwg.org/#url-parsing
 */
export function normalizeLikeURLConstructor(url: string): string {
  return url.replace(/[\t\n\r]/g, "").replace(/\\/g, "/");
}
