import { WrapPackageInfo } from "./WrapPackageInfo";

export type RequireInterceptor = (
  exports: any,
  pkgInfo: WrapPackageInfo
) => void | unknown;
