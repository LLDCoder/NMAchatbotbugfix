import { useContext, useEffect, useRef } from "react";
import { parseLocationKey, type ParsedLocationKey } from "./utils";
import { KeepAliveContext, KeepAliveItemContext } from "./context";

type ActivationPayload = {
  from: string;
  fromPath: string;
  fromQuery: ParsedLocationKey["query"];
  fromParsed: ParsedLocationKey;
};

type KeepAliveActivatedOptions = {
  onActivated?: (payload: ActivationPayload) => void;
  onDeactivated?: () => void;
  fireOnFirstMount?: boolean;
};

export default function useKeepAliveActivated({
  onActivated,
  onDeactivated,
  fireOnFirstMount = false,
}: KeepAliveActivatedOptions = {}) {
  const { activeKey, prevActiveLocationKey } = useContext(KeepAliveContext);
  const { cacheKey } = useContext(KeepAliveItemContext);

  const activated = activeKey === cacheKey;
  const previousActivatedRef = useRef(activated);
  const firstActivationFiredRef = useRef(false);

  useEffect(() => {
    const fromParsed = parseLocationKey(prevActiveLocationKey);

    // Keep activation callbacks aligned with route switches inside the same cache group.
    const fireActivated = () => {
      onActivated?.({
        from: prevActiveLocationKey,
        fromPath: fromParsed.path,
        fromQuery: fromParsed.query,
        fromParsed,
      });
    };

    if (previousActivatedRef.current !== activated) {
      if (activated) {
        fireActivated();
        firstActivationFiredRef.current = true;
      } else {
        onDeactivated?.();
      }

      previousActivatedRef.current = activated;
      return;
    }

    if (fireOnFirstMount && activated && !firstActivationFiredRef.current) {
      fireActivated();
      firstActivationFiredRef.current = true;
    }
  }, [
    activated,
    fireOnFirstMount,
    onActivated,
    onDeactivated,
    prevActiveLocationKey,
  ]);

  return activated;
}
