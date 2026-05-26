import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../utils/errorMessage";

type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };

type UseAsyncDataResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * Runs an async data-fetching function, managing loading/error/data state
 * and preventing stale state updates on unmount.
 *
 * @param fetchFn - async function that returns the data. Should be stable (useCallback or defined outside component).
 * @param enabled - when false the fetch is skipped (useful for user-dependent fetches)
 */
export const useAsyncData = <T>(
  fetchFn: () => Promise<T>,
  enabled = true,
  fallbackMessage = "Failed to load data"
): UseAsyncDataResult<T> => {
  const [state, setState] = useState<AsyncState<T>>({ status: "idle" });
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle" });
      return;
    }

    let isMounted = true;
    setState({ status: "loading" });

    void (async () => {
      try {
        const data = await fetchFnRef.current();
        if (!isMounted) return;
        setState({ status: "success", data });
      } catch (err) {
        if (!isMounted) return;
        setState({ status: "error", error: getErrorMessage(err, fallbackMessage) });
      }
    })();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  return {
    data: state.status === "success" ? state.data : null,
    loading: state.status === "loading" || state.status === "idle",
    error: state.status === "error" ? state.error : null,
    reload,
  };
};
