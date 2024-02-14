export interface Module {
  getPackageName(): string;
  isBuiltIn(): boolean;
  setup(): boolean;
}
