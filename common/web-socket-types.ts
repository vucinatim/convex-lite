export const MessageType = {
  QUERY: "QUERY",
  MUTATION: "MUTATION",
  DATA_UPDATE: "DATA_UPDATE",
  REQUERY: "REQUERY",
  ERROR: "ERROR",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export interface BaseMessage {
  type: MessageType;
  id?: string; // Optional: for correlating requests and responses
}

export interface QueryRequestMessage extends BaseMessage {
  type: typeof MessageType.QUERY;
  queryKey: string;
  params?: unknown;
}

export interface MutationRequestMessage extends BaseMessage {
  type: typeof MessageType.MUTATION;
  mutationKey: string;
  args?: unknown;
}

export interface DataResponseMessage<T = unknown> extends BaseMessage {
  type: typeof MessageType.DATA_UPDATE;
  queryKey?: string; // To identify which query this data is for
  id?: string; // Ensure responses can carry the request ID back
  data: T;
}

export interface RequeryMessage extends BaseMessage {
  type: typeof MessageType.REQUERY;
  queryKey: string;
}

export interface ErrorResponseMessage extends BaseMessage {
  type: typeof MessageType.ERROR;
  queryKey?: string;
  mutationKey?: string;
  id?: string; // Ensure errors can carry the request ID back
  message: string;
  error?: unknown;
}

export type WebSocketMessage =
  | QueryRequestMessage
  | MutationRequestMessage
  | DataResponseMessage // This generic can now be used with specific types like DataResponseMessage<Counter> or DataResponseMessage<TextEntry[]>
  | RequeryMessage
  | ErrorResponseMessage;
