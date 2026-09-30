type ProgressiveDetailOptions<T extends object> = {
  loadCore: () => Promise<T | null>;
  loadOptional: (core: T) => Promise<Partial<T>>;
  publishCore: (detail: T | null) => void;
  publishOptional: (detail: Partial<T>) => void;
};

export const loadProgressiveDetail = async <T extends object>({
  loadCore,
  loadOptional,
  publishCore,
  publishOptional,
}: ProgressiveDetailOptions<T>): Promise<T | null> => {
  const core = await loadCore();
  publishCore(core);

  if (!core) return null;

  void loadOptional(core)
    .then(publishOptional)
    .catch(() => undefined);

  return core;
};
