let blockOtherErrorToasts = false;
let networkErrorToastActive = false;

export function setBlockOtherErrorToasts(block: boolean) {
  blockOtherErrorToasts = block;
}

export function shouldBlockOtherErrorToasts(): boolean {
  return blockOtherErrorToasts;
}

export function shouldSuppressNetworkErrorToast(): boolean {
  return networkErrorToastActive;
}

export function beginNetworkErrorToastSuppress(): void {
  networkErrorToastActive = true;
}

export function endNetworkErrorToastSuppress(): void {
  networkErrorToastActive = false;
}
