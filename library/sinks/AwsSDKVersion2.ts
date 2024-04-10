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
  }
}
