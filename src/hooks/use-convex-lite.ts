/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
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
import type { WrappedApiFunction } from "../../convex/server";
import {
  connectionManager,
  type ConnectionStatus,
} from "common/connection-manager";

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

type ArgsType<T extends WrappedApiFunction<any, any>> =
  T extends WrappedApiFunction<infer A, any> ? A : never;
type RetType<T extends WrappedApiFunction<any, any>> =
  T extends WrappedApiFunction<any, infer R> ? R : never;
type QueryHookArgs<T extends WrappedApiFunction<any, any>> =
  ArgsType<T> extends void ? [] : [ArgsType<T>];

// --- Hooks ---

export function useConnectionState(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(
    connectionManager.status
  );

  useEffect(() => {
    const unsubscribe = connectionManager.subscribeToStatus(setStatus);
    return unsubscribe;
  }, []);

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

  const [data, setData] = useState<RetType<T> | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ErrorResponseMessage | null>(null);

  const [refetchIndex, setRefetchIndex] = useState(0);
  const refetch = useCallback(() => setRefetchIndex((i) => i + 1), []);

  const connectionStatus = useConnectionState();

  // THE REFACTOR: A single, unified useEffect for data fetching that
  // is now directly aware of the connection status.
  useEffect(() => {
    if (!queryKeyString) {
      setIsLoading(false);
      return;
    }

    // If we are not connected, we should be in a loading state, but not
    // attempt to fetch. The effect will re-run when the status changes.
    if (connectionStatus !== "connected") {
      setIsLoading(true);
      return;
    }

    let isCancelled = false;
    const requestId = uuidv4();

    const doFetch = () => {
      setIsLoading(true);
      setError(null);
      const queryMessage: QueryRequestMessage = {
        type: MessageType.QUERY,
        id: requestId,
        queryKey: queryKeyString,
        params: queryParams,
      };
      connectionManager.sendMessage(queryMessage);
    };

    doFetch();

    const unsubscribe = connectionManager.subscribeToMessages(
      (message: WebSocketMessage) => {
        if (isCancelled || message.id !== requestId) return;
        if (isDataResponseMessage<RetType<T>>(message)) {
          setData(message.data);
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
    // This effect now re-runs whenever the connection status changes,
    // in addition to the other dependencies.
  }, [queryKeyString, queryParams, refetchIndex, connectionStatus]);

  // A separate effect for listening to invalidation messages (this is unchanged)
  useEffect(() => {
    const unsubscribe = connectionManager.subscribeToMessages(
      (message: WebSocketMessage) => {
        if (isRequeryMessage(message) && message.queryKey === queryKeyString) {
          console.log(
            `[Convex-Lite] Received invalidation for ${queryKeyString}, refetching...`
          );
          refetch();
        }
      }
    );

    return unsubscribe;
  }, [queryKeyString, refetch]);

  return { data, isLoading, error };
}

export interface UseMutationResult<TArgs, TResponse> {
  mutate: (args: TArgs) => Promise<TResponse | undefined>;
  isLoading: boolean;
  error: ErrorResponseMessage | null;
}

export function useMutation<T extends WrappedApiFunction<any, any>>(
  mutationFunctionReference: T
): UseMutationResult<ArgsType<T>, RetType<T>> {
  const mutationKeyString = mutationFunctionReference as unknown as string;
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ErrorResponseMessage | null>(null);

  const mutate = (mutateArgs: ArgsType<T>): Promise<RetType<T> | undefined> => {
    return new Promise((resolve, reject) => {
      if (!mutationKeyString) {
        const err = {
          message: "mutationKey is not provided",
        } as ErrorResponseMessage;
        setError(err);
        reject(err);
        return;
      }

      if (connectionManager.status === "disconnected") {
        connectionManager.connect();
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
            setError(null);
            resolve(message.data as RetType<T>);
            unsubscribe();
          } else if (isErrorResponseMessage(message)) {
            setIsLoading(false);
            setError(message);
            reject(message);
            unsubscribe();
          }
        }
      );
    });
  };

  return { mutate, isLoading, error } as any;
}
