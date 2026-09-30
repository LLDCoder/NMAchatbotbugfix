import { useEffect, useMemo } from "react";
import create from "zustand";
import {
  getAdminUserAsync,
  type IGetAdminUserAsyncResposne,
} from "@/services/userManagement";

interface CurrentAdminUserState {
  userId: string;
  data: IGetAdminUserAsyncResposne | null;
  loading: boolean;
  error: unknown;
  pendingPromise: Promise<IGetAdminUserAsyncResposne | null> | null;
}

interface CurrentAdminUserSnapshot {
  data: IGetAdminUserAsyncResposne | null;
  loading: boolean;
  error: unknown;
}

const initialCurrentAdminUserState: CurrentAdminUserState = {
  userId: "",
  data: null,
  loading: false,
  error: null,
  pendingPromise: null,
};

export const useCurrentAdminUserStore = create<CurrentAdminUserState>(() => ({
  ...initialCurrentAdminUserState,
}));

export function invalidateCurrentAdminUser(userId?: string) {
  const normalizedUserId = userId?.trim();
  const currentState = useCurrentAdminUserStore.getState();

  if (normalizedUserId && currentState.userId !== normalizedUserId) {
    return;
  }

  useCurrentAdminUserStore.setState({
    ...initialCurrentAdminUserState,
  });
}

export function loadCurrentAdminUser(userId: string) {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    invalidateCurrentAdminUser();
    return Promise.resolve(null);
  }

  const currentState = useCurrentAdminUserStore.getState();

  if (currentState.userId === normalizedUserId && currentState.data) {
    return Promise.resolve(currentState.data);
  }

  if (
    currentState.userId === normalizedUserId &&
    currentState.pendingPromise
  ) {
    return currentState.pendingPromise;
  }

  let requestPromise: Promise<IGetAdminUserAsyncResposne | null>;
  requestPromise = getAdminUserAsync(normalizedUserId)
    .then((response) => response?.data ?? null)
    .then((data) => {
      const latestState = useCurrentAdminUserStore.getState();

      if (
        latestState.userId === normalizedUserId &&
        latestState.pendingPromise === requestPromise
      ) {
        useCurrentAdminUserStore.setState({
          userId: normalizedUserId,
          data,
          loading: false,
          error: null,
          pendingPromise: null,
        });
      }

      return data;
    })
    .catch((error) => {
      const latestState = useCurrentAdminUserStore.getState();

      if (
        latestState.userId === normalizedUserId &&
        latestState.pendingPromise === requestPromise
      ) {
        useCurrentAdminUserStore.setState({
          userId: normalizedUserId,
          data: null,
          loading: false,
          error,
          pendingPromise: null,
        });
      }

      throw error;
    });

  useCurrentAdminUserStore.setState({
    userId: normalizedUserId,
    data: null,
    loading: true,
    error: null,
    pendingPromise: requestPromise,
  });

  return requestPromise;
}

export function useCurrentAdminUser(userId?: string, enabled = true) {
  const normalizedUserId = userId?.trim() || "";
  const currentState = useCurrentAdminUserStore();

  useEffect(() => {
    if (!enabled || !normalizedUserId) {
      return;
    }

    void loadCurrentAdminUser(normalizedUserId).catch(() => undefined);
  }, [enabled, normalizedUserId]);

  return useMemo<CurrentAdminUserSnapshot>(() => {
    if (!enabled || !normalizedUserId) {
      return {
        data: null,
        loading: false,
        error: null,
      };
    }

    if (currentState.userId !== normalizedUserId) {
      return {
        data: null,
        loading: true,
        error: null,
      };
    }

    return {
      data: currentState.data,
      loading: currentState.loading,
      error: currentState.error,
    };
  }, [
    currentState.data,
    currentState.error,
    currentState.loading,
    currentState.userId,
    enabled,
    normalizedUserId,
  ]);
}
