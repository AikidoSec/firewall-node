/* eslint-disable prefer-rest-params */
import { getContext, updateContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";

/**
 * Wrapper for xml-js package.
 */
export class XmlMinusJs implements Wrapper {
  private inspectParse(args: unknown[], result: unknown, jsonStr: boolean) {
    if (!args.length || typeof args[0] !== "string") {
      return;
    }

    const context = getContext();
    if (!context) {
      // We expect the context to be set by the wrapped http server
      return;
    }

    const xmlString = args[0] as string;

    if (typeof context.body !== "string" || context.body !== xmlString) {
      // We only want to set the parsed XML result as context.xml
      // When xml2js(req.body) or xml2json(req.body) is called
      return args;
    }

    const parsed = jsonStr ? JSON.parse(result as string) : result;

    // Replace the body in the context with the parsed result
    if (parsed && isPlainObject(parsed)) {
      updateContext(context, "xml", parsed);
    }
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("xml-js")
      .withVersion("^1.0.0")
      .onRequire((exports, pkgInfo) => {
        wrapExport(exports, "xml2js", pkgInfo, {
          modifyReturnValue: (args, result) => {
            this.inspectParse(args, result, false);
            return result;
          },
        });
        wrapExport(exports, "xml2json", pkgInfo, {
          modifyReturnValue: (args, result) => {
            this.inspectParse(args, result, true);
            return result;
          },
        });
      });
  }
}
