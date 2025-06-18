import { useState, useEffect, useRef } from "react";
import {
  sendMessage,
  subscribeToMessages,
  // MessageType, // Will import MessageType value from the common path now
} from "../lib/websocket";
import type {
  QueryRequestMessage,
  DataResponseMessage,
  ErrorResponseMessage,
  WebSocketMessage,
  MutationRequestMessage,
} from "../../common/web-socket-types"; // Corrected path for types
import { MessageType } from "../../common/web-socket-types"; // Added import for MessageType value

// Type guards
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

// Helper to generate simple unique IDs
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substr(2);

export interface UseQueryResult<TData> {
  data: TData | undefined;
  isLoading: boolean;
  error: ErrorResponseMessage | null;
}

export const useQuery = <TData = unknown, TParams = unknown>(
  queryKey: string | null | undefined,
  params?: TParams
): UseQueryResult<TData> => {
  const [data, setData] = useState<TData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ErrorResponseMessage | null>(null);

  // Use a ref to store the current queryKey and params to avoid stale closures in the subscription
  const queryDetailsRef = useRef({ queryKey, params });
  useEffect(() => {
    queryDetailsRef.current = { queryKey, params };
  }, [queryKey, params]);

  useEffect(() => {
    if (!queryKey) {
      setIsLoading(false);
      setData(undefined);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    // Not setting data to undefined here, to keep previous data while loading new, if desired.
    // Or, could set to undefined: setData(undefined);

    const requestId = generateId();

    const queryMessage: QueryRequestMessage = {
      type: MessageType.QUERY,
      id: requestId,
      queryKey,
      params,
    };

    sendMessage(queryMessage);

    const unsubscribePromise = subscribeToMessages(
      (message: WebSocketMessage) => {
        const { queryKey: currentQueryKey, params: currentParamsUntyped } =
          queryDetailsRef.current;

        if (isDataResponseMessage(message)) {
          if (message.queryKey !== currentQueryKey) {
            return;
          }

          if (currentQueryKey === "get_admin_table_data") {
            const currentParams = currentParamsUntyped as
              | { tableNameString?: string }
              | undefined;

            if (message.id === requestId) {
              setData(message.data as TData);
              setIsLoading(false);
              setError(null);
            } else {
              const broadcastPayload = message.data as {
                table: string;
                data: TData;
              };

              if (
                broadcastPayload &&
                typeof broadcastPayload.table === "string" &&
                currentParams?.tableNameString === broadcastPayload.table
              ) {
                setData(broadcastPayload.data);
                setError(null);
              }
            }
          } else {
            setData(message.data as TData);
            setError(null);
            if (message.id === requestId) {
              setIsLoading(false);
            }
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
      unsubscribePromise
        .then((unsub) => unsub())
        .catch((err) =>
          console.error("Error unsubscribing from messages:", err)
        );
      // Optionally, send a message to the backend to clean up the subscription for this queryKey if no other client uses it.
    };
  }, [queryKey, params]); // Re-run effect if queryKey or params change

  return { data, isLoading, error };
};

export interface UseMutationResult<TArgs, TResponse> {
  mutate: (args: TArgs) => Promise<TResponse | undefined>; // Promise resolves with response data or undefined on error
  isLoading: boolean;
  error: ErrorResponseMessage | null;
}

export const useMutation = <TResponse = unknown, TArgs = unknown>(
  mutationKey: string | null | undefined
): UseMutationResult<TArgs, TResponse> => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ErrorResponseMessage | null>(null);

  const mutate = (args: TArgs): Promise<TResponse | undefined> => {
    return new Promise((resolve, reject) => {
      if (!mutationKey) {
        const err = {
          message: "mutationKey is not provided",
        } as ErrorResponseMessage;
        setError(err);
        reject(err);
        return;
      }

      setIsLoading(true);
      setError(null);

      const requestId = generateId();
      const mutationMessage: MutationRequestMessage = {
        type: MessageType.MUTATION,
        id: requestId,
        mutationKey,
        args: args as unknown, // Cast to unknown, backend will validate
      };

      sendMessage(mutationMessage);

      const unsubscribePromise = subscribeToMessages(
        (message: WebSocketMessage) => {
          if (message.id !== requestId) return; // Only interested in responses to this specific mutation

          if (isDataResponseMessage<TResponse>(message)) {
            setIsLoading(false);
            setError(null);
            resolve(message.data);
            unsubscribePromise
              .then((unsub) => unsub())
              .catch((err) =>
                console.error(
                  "Error unsubscribing from mutation response:",
                  err
                )
              );
          } else if (isErrorResponseMessage(message)) {
            setIsLoading(false);
            setError(message);
            reject(message); // Reject promise with the error message
            unsubscribePromise
              .then((unsub) => unsub())
              .catch((err) =>
                console.error("Error unsubscribing from mutation error:", err)
              );
          }
        }
      );

      // Optional: Add a timeout for mutations
      // setTimeout(() => {
      //   const timeoutError = { message: "Mutation timed out", type: MessageType.ERROR, id: requestId, mutationKey } as ErrorResponseMessage;
      //   setError(timeoutError);
      //   reject(timeoutError);
      //   unsubscribePromise.then(unsub => unsub());
      // }, 10000); // 10-second timeout
    });
  };

  return { mutate, isLoading, error };
};
