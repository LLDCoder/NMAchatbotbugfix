type DesignablePlaygroundModule = typeof import("./main");

let designablePlaygroundPromise: Promise<DesignablePlaygroundModule> | null =
  null;

export function loadDesignablePlaygroundModule() {
  if (!designablePlaygroundPromise) {
    designablePlaygroundPromise = import("./main");
  }

  return designablePlaygroundPromise;
}

export function preloadDesignablePlayground() {
  return loadDesignablePlaygroundModule();
}
