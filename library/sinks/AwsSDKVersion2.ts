import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";

export class AwsSDKVersion2 implements Wrapper {
  private inspectS3Operation(
    args: unknown[],
    operation: string
  ): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (args.length > 0 && isPlainObject(args[0])) {
      if (typeof args[0].Key === "string" && args[0].Key.length > 0) {
        const result = checkContextForPathTraversal({
          filename: args[0].Key,
          operation: `S3.${operation}`,
          context: context,
        });

        if (result) {
          return result;
        }
      }
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("aws-sdk")
      .withVersion("^2.0.0")
      .addSubject((exports) => exports)
      .inspectNewInstance("S3")
      .addSubject((exports) => exports)
      .inspect("putObject", (args) =>
        this.inspectS3Operation(args, "putObject")
      );
  }
}
