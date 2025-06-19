/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import { sendMessage, subscribeToMessages } from "../lib/websocket";
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

// --- Type Guards ---
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

// A new type guard to identify invalidation messages from the server.
function isRequeryMessage(msg: WebSocketMessage): msg is RequeryMessage {
  return msg.type === MessageType.REQUERY;
}

// --- Type Helpers (Unchanged) ---
type ArgsType<T extends WrappedApiFunction<any, any>> =
  T extends WrappedApiFunction<infer A, any> ? A : never;
type RetType<T extends WrappedApiFunction<any, any>> =
  T extends WrappedApiFunction<any, infer R> ? R : never;
type QueryHookArgs<T extends WrappedApiFunction<any, any>> =
  ArgsType<T> extends void ? [] : [ArgsType<T>];

// --- useQuery ---

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

  // This state is the key to triggering a refetch.
  const [refetchIndex, setRefetchIndex] = useState(0);

  // A stable refetch function that can be called from anywhere.
  const refetch = useCallback(() => {
    setRefetchIndex((i) => i + 1);
  }, []);

  // Effect for handling the initial fetch and subsequent refetches.
  useEffect(() => {
    if (!queryKeyString) {
      setIsLoading(false);
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
      sendMessage(queryMessage);
    };

    doFetch();

    // This subscription only cares about the response to this specific request.
    const unsubscribe = subscribeToMessages((message: WebSocketMessage) => {
      if (isCancelled || message.id !== requestId) return;

      if (isDataResponseMessage<RetType<T>>(message)) {
        setData(message.data);
        setIsLoading(false);
      } else if (isErrorResponseMessage(message)) {
        setError(message);
        setIsLoading(false);
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe.then((unsub) => unsub()).catch(console.error);
    };
    // This effect now runs on initial load AND whenever refetchIndex changes.
  }, [queryKeyString, queryParams, refetchIndex]);

  // A separate, single effect for listening to invalidation messages.
  useEffect(() => {
    // This subscription listens to ALL messages to check for invalidations.
    const unsubscribe = subscribeToMessages((message: WebSocketMessage) => {
      if (isRequeryMessage(message) && message.queryKey === queryKeyString) {
        console.log(
          `Received invalidation for ${queryKeyString}, refetching...`
        );
        refetch();
      }
    });

    return () => {
      unsubscribe.then((unsub) => unsub()).catch(console.error);
    };
  }, [queryKeyString, refetch]); // `refetch` is stable due to useCallback

  return { data, isLoading, error };
}

// --- useMutation (No changes needed) ---

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
      setIsLoading(true);
      setError(null);
      const requestId = uuidv4();
      const mutationMessage: MutationRequestMessage = {
        type: MessageType.MUTATION,
        id: requestId,
        mutationKey: mutationKeyString,
        args: mutateArgs,
      };
      sendMessage(mutationMessage);
      const unsubscribePromise = subscribeToMessages(
        (message: WebSocketMessage) => {
          if (message.id !== requestId) return;
          if (isDataResponseMessage(message)) {
            setIsLoading(false);
            setError(null);
            resolve(message.data as RetType<T>);
            unsubscribePromise.then((unsub) => unsub()).catch(console.error);
          } else if (isErrorResponseMessage(message)) {
            setIsLoading(false);
            setError(message);
            reject(message);
            unsubscribePromise.then((unsub) => unsub()).catch(console.error);
          }
        }
      );
    });
  };

  return { mutate, isLoading, error } as any;
}
