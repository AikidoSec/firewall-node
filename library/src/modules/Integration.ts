export interface Integration {
  getPackageName(): string;
  setup(): boolean;
}
