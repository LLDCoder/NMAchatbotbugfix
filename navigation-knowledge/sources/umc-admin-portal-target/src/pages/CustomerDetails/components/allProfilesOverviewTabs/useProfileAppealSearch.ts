import { useEffect, useState } from "react";

const PROFILE_APPEAL_SEARCH_DELAY = 500;

export const useProfileAppealSearch = (value: string) => {
  const normalizedValue = value.trim();
  const [debouncedValue, setDebouncedValue] = useState(normalizedValue);

  useEffect(() => {
    if (!normalizedValue) {
      setDebouncedValue("");
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setDebouncedValue(normalizedValue);
    }, PROFILE_APPEAL_SEARCH_DELAY);

    return () => {
      window.clearTimeout(timer);
    };
  }, [normalizedValue]);

  return debouncedValue;
};
