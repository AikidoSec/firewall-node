let active = false;

export function setAINetworkCaptureActive(value: boolean): void {
  active = value;
}

export function isAINetworkCaptureActive(): boolean {
  return active;
}
