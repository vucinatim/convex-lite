/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import { sendMessage, subscribeToMessages } from "../lib/websocket";
import type {
  QueryRequestMessage,
  DataResponseMessage,
  ErrorResponseMessage,
  WebSocketMessage,
  MutationRequestMessage,
} from "../../common/web-socket-types";
import { MessageType } from "../../common/web-socket-types";
import { v4 as uuidv4 } from "uuid";

// Import the core type from our server definition!
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

// --- NEW, Simpler Type Helpers ---

// Extracts the `Args` generic type from a WrappedApiFunction.
type ArgsType<T extends WrappedApiFunction<any, any>> =
  T extends WrappedApiFunction<infer A, any> ? A : never;

// Extracts the `Ret` generic type from a WrappedApiFunction.
type RetType<T extends WrappedApiFunction<any, any>> =
  T extends WrappedApiFunction<any, infer R> ? R : never;

// Conditionally defines the arguments tuple for the useQuery hook.
// If the function's `Args` type is `void`, the hook takes no extra parameters.
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

  const queryDetailsRef = useRef({
    queryKey: queryKeyString,
    params: queryParams,
  });

  useEffect(() => {
    queryDetailsRef.current = { queryKey: queryKeyString, params: queryParams };
  }, [queryKeyString, queryParams]);

  useEffect(() => {
    if (!queryKeyString) {
      setIsLoading(false);
      setData(undefined);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    const requestId = uuidv4();
    const queryMessage: QueryRequestMessage = {
      type: MessageType.QUERY,
      id: requestId,
      queryKey: queryKeyString,
      params: queryParams,
    };
    sendMessage(queryMessage);
    const unsubscribePromise = subscribeToMessages(
      (message: WebSocketMessage) => {
        const { queryKey: currentQueryKey } = queryDetailsRef.current;
        if (isDataResponseMessage<RetType<T>>(message)) {
          if (message.queryKey === currentQueryKey) {
            setData(message.data);
            if (message.id === requestId) setIsLoading(false);
          }
        } else if (
          isErrorResponseMessage(message) &&
          message.id === requestId
        ) {
          setIsLoading(false);
          setError(message);
          setData(undefined);
        }
      }
    );
    return () => {
      unsubscribePromise.then((unsub) => unsub()).catch(console.error);
    };
  }, [queryKeyString, queryParams]);

  return { data, isLoading, error };
}

// --- useMutation ---

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
