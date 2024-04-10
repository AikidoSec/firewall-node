import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";

export class AwsSDKVersion2 implements Wrapper {
  private inspectS3Operation(
    args: unknown[],
    operation: string
  ): InterceptorResult {
    console.log(args, operation);
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

    /*const { S3Client } = require("@aws-sdk/client-s3");
    console.log(S3Client.prototype.send);
    wrap(S3Client.prototype, "send", function (original) {
      return function (params) {
        console.log(params);
        return original.apply(this, arguments);
      };
    });*/

    /*hooks
      .addPackage("@aws-sdk/client-s3")
      .withVersion("^3.0.0")
      .addSubject((exports) => {
        console.log(exports.S3Client.prototype);
        return exports.S3Client.prototype;
      })
      .inspect("send", (args, subject, agent, context) => {
        console.log(args);
      });*/
  }
}
