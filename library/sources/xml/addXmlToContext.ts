import { Context, updateContext } from "../../agent/Context";

/**
 * Adds the XML to the context XML array.
 */
export function addXmlToContext(xml: any, context: Context) {
  if (Array.isArray(context.xml)) {
    updateContext(context, "xml", context.xml.concat(xml));
  } else {
    updateContext(context, "xml", [xml]);
  }
}
