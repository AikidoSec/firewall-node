import { getPackageVersion } from "../../helpers/getPackageVersion";
import { satisfiesVersion } from "../../helpers/satisfiesVersion";
import { Agent } from "../Agent";
import { wrapWithArgumentModification } from "../applyHooks";
import { addRequireInterceptor } from "../wrapRequire";
import {
  ModifyingArgumentsInterceptor,
  ModifyingArgumentsMethodInterceptor,
} from "./ModifyingArgumentsInterceptor";
import { ModifyingRequireInterceptor } from "./ModifyingRequireInterceptor";
import { VersionedPackage } from "./VersionedPackage";

export class WrappableRequireSubject {
  private methods: ModifyingArgumentsMethodInterceptor[] = [];

  constructor(private readonly versionedPackage: VersionedPackage) {
    if (!this.versionedPackage) {
      throw new Error("VerrsionedPackage is required");
    }

    const version = getPackageVersion(versionedPackage.getName());
    if (!version) {
      return;
    }

    if (!satisfiesVersion(versionedPackage.getRange(), version)) {
      return;
    }

    this.intercept = this.intercept.bind(this);
    addRequireInterceptor(
      new ModifyingRequireInterceptor(
        versionedPackage.getName(),
        this.intercept
      )
    );
  }

  modifyArguments(
    methodName: string,
    interceptor: ModifyingArgumentsInterceptor
  ) {
    const method = new ModifyingArgumentsMethodInterceptor(
      methodName,
      interceptor
    );
    this.methods.push(method);

    return this;
  }

  getName() {
    return this.versionedPackage.getName();
  }

  private intercept(
    args: unknown[],
    originalReturnValue: unknown,
    agent: Agent
  ) {
    for (const methodInterceptor of this.methods) {
      wrapWithArgumentModification(
        originalReturnValue,
        methodInterceptor,
        this.versionedPackage.getName(),
        agent
      );
    }

    return originalReturnValue;
  }
}
