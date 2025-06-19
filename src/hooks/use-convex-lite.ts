/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
} from "react";
import type {
  QueryRequestMessage,
  DataResponseMessage,
  ErrorResponseMessage,
  WebSocketMessage,
  MutationRequestMessage,
  RequeryMessage,
} from "../../common/web-socket-types";
import { MessageType } from "../../common/web-socket-types";
import { v4 as uuidv4 } from "uuid";
import type { WrappedApiFunction } from "convex/_lib/server";
import {
  connectionManager,
  type ConnectionStatus,
} from "common/connection-manager";
import {
  queryCache,
  getQueryCacheKey,
  localStore,
  type OptimisticUpdate,
  type ArgsType,
  type RetType,
} from "common/query-cache"; // Import from our new utility file

// --- Type Guards & Helpers ---
function isDataResponseMessage<T>(
  msg: WebSocketMessage
): msg is DataResponseMessage<T> {
  return msg.type === MessageType.DATA_UPDATE;
}
function isErrorResponseMessage(
  msg: WebSocketMessage
): msg is ErrorResponseMessage {
  return msg.type === MessageType.ERROR;
}
function isRequeryMessage(msg: WebSocketMessage): msg is RequeryMessage {
  return msg.type === MessageType.REQUERY;
}
type QueryHookArgs<T extends WrappedApiFunction<any, any>> =
  ArgsType<T> extends void ? [] : [ArgsType<T>];

// --- Hooks ---

export function useConnectionState(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(
    connectionManager.status
  );
  useEffect(() => connectionManager.subscribeToStatus(setStatus), []);
  return status;
}

export interface UseQueryResult<TData> {
  data: TData | undefined;
  isLoading: boolean;
  error: ErrorResponseMessage | null;
}

export function useQuery<T extends WrappedApiFunction<any, any>>(
  queryFunctionReference: T,
  ...params: QueryHookArgs<T>
): UseQueryResult<RetType<T>> {
  const queryKeyString = queryFunctionReference as unknown as string;
  const queryParams = params[0];
  const cacheKey = getQueryCacheKey(queryKeyString, queryParams);

  // useQuery now uses `useSyncExternalStore` to subscribe to the central cache.
  const data = useSyncExternalStore(
    (callback) => queryCache.subscribe(cacheKey, callback),
    () => queryCache.get<RetType<T>>(cacheKey)
  );

  const [isLoading, setIsLoading] = useState<boolean>(!data); // Only loading if data isn't already in cache
  const [error, setError] = useState<ErrorResponseMessage | null>(null);

  const [refetchIndex, setRefetchIndex] = useState(0);
  const refetch = useCallback(() => setRefetchIndex((i) => i + 1), []);

  const connectionStatus = useConnectionState();

  useEffect(() => {
    if (!queryKeyString || connectionStatus !== "connected") return;

    let isCancelled = false;
    const requestId = uuidv4();

    setIsLoading(true);
    setError(null);
    const queryMessage: QueryRequestMessage = {
      type: MessageType.QUERY,
      id: requestId,
      queryKey: queryKeyString,
      params: queryParams,
    };
    connectionManager.sendMessage(queryMessage);

    const unsubscribe = connectionManager.subscribeToMessages(
      (message: WebSocketMessage) => {
        if (isCancelled || message.id !== requestId) return;
        if (isDataResponseMessage<RetType<T>>(message)) {
          // When data arrives, write it to the central cache.
          queryCache.set(cacheKey, message.data);
          setIsLoading(false);
        } else if (isErrorResponseMessage(message)) {
          setError(message);
          setIsLoading(false);
        }
      }
    );

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [queryKeyString, queryParams, refetchIndex, connectionStatus, cacheKey]);

  useEffect(() => {
    const unsubscribe = connectionManager.subscribeToMessages(
      (message: WebSocketMessage) => {
        if (isRequeryMessage(message) && message.queryKey === queryKeyString) {
          refetch();
        }
      }
    );
    return unsubscribe;
  }, [queryKeyString, refetch]);

  return { data, isLoading, error };
}

// --- useMutation with Optimistic Updates ---

// useMutation now returns an object with a `.withOptimisticUpdate` method.
export interface UseMutation<T extends WrappedApiFunction<any, any>> {
  mutate: (args: ArgsType<T>) => Promise<RetType<T> | undefined>;
  isLoading: boolean;
  error: ErrorResponseMessage | null;
  withOptimisticUpdate: (
    optimisticUpdate: OptimisticUpdate<T>
  ) => UseMutation<T>;
}

export function useMutation<T extends WrappedApiFunction<any, any>>(
  mutationFunctionReference: T
): UseMutation<T> {
  const mutationKeyString = mutationFunctionReference as unknown as string;
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ErrorResponseMessage | null>(null);

  // A ref to hold the user-provided optimistic update function.
  const optimisticUpdateRef = useRef<OptimisticUpdate<T> | null>(null);

  const mutate = (mutateArgs: ArgsType<T>): Promise<RetType<T> | undefined> => {
    return new Promise((resolve, reject) => {
      // --- Optimistic Update Execution ---
      if (optimisticUpdateRef.current) {
        try {
          console.log("[Convex-Lite] Applying optimistic update...");
          optimisticUpdateRef.current(localStore, mutateArgs);
        } catch (e) {
          console.error("[Convex-Lite] Optimistic update failed:", e);
          // In a real implementation, you might want to revert the changes.
          reject(e);
          return;
        }
      }

      setIsLoading(true);
      setError(null);
      const requestId = uuidv4();
      const mutationMessage: MutationRequestMessage = {
        type: MessageType.MUTATION,
        id: requestId,
        mutationKey: mutationKeyString,
        args: mutateArgs,
      };
      connectionManager.sendMessage(mutationMessage);

      const unsubscribe = connectionManager.subscribeToMessages(
        (message: WebSocketMessage) => {
          if (message.id !== requestId) return;
          if (isDataResponseMessage(message)) {
            setIsLoading(false);
            resolve(message.data as RetType<T>);
            unsubscribe();
          } else if (isErrorResponseMessage(message)) {
            setIsLoading(false);
            setError(message);
            // In a real implementation, you would revert the optimistic update here.
            console.error(
              "[Convex-Lite] Mutation failed. UI may be in an inconsistent state."
            );
            reject(message);
            unsubscribe();
          }
        }
      );
    });
  };

  // The function that allows the user to attach an optimistic update.
  const withOptimisticUpdate = (optimisticUpdate: OptimisticUpdate<T>) => {
    optimisticUpdateRef.current = optimisticUpdate;
    // Return the same object to allow chaining if needed.
    return { mutate, isLoading, error, withOptimisticUpdate };
  };

  return { mutate, isLoading, error, withOptimisticUpdate };
}
