export type RequireInterceptor = (exports: unknown, pkgVersion: string) => void;

export type RequireBuiltinInterceptor = (exports: unknown) => void;
