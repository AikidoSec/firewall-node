import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";

const operationsWithKey = [
  "putObject",
  "getObject",
  "deleteObject",
  "copyObject",
  "getObjectAcl",
  "putObjectAcl",
  "restoreObject",
  "headObject",
  "deleteObjectTagging",
  "getObjectTagging",
  "putObjectTagging",
  "upload",
  "createMultipartUpload",
  "uploadPart",
  "uploadPartCopy",
  "completeMultipartUpload",
  "abortMultipartUpload",
  "listParts",
  "listMultipartUploads",
  "putObjectRetention",
  "getObjectRetention",
  "putObjectLegalHold",
  "getObjectLegalHold",
  "selectObjectContent",
  "getSignedUrl",
];

export class AwsSDKVersion2 implements Wrapper {
  private inspectS3Operation(
    args: unknown[],
    operation: string
  ): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    for (const arg of args) {
      if (
        isPlainObject(arg) &&
        arg.Key &&
        typeof arg.Key === "string" &&
        arg.Key.length > 0
      ) {
        const result = checkContextForPathTraversal({
          filename: arg.Key,
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
      .onRequire((exports, pkgInfo) => {
        wrapNewInstance(exports, "S3", pkgInfo, (instance) => {
          for (const operation of operationsWithKey) {
            wrapExport(instance, operation, pkgInfo, {
              inspectArgs: (args) => this.inspectS3Operation(args, operation),
            });
          }
        });
      });
  }
}
