/* eslint-disable @typescript-eslint/no-explicit-any */
import { z, type ZodObject } from "zod/v4";
import type { HandlerContext as BaseHandlerContext } from "../server/server";

// --- Core Type Definitions ---

/**
 * A "branded" type for a query function reference, which allows our type system
 * to distinguish it for typesafe invalidation.
 */
export type QueryReference<Args, Ret> = WrappedApiFunction<Args, Ret> & {
  _isQuery: true;
};

/**
 * The final, standardized object shape that our helpers produce.
 * This is what will be stored in memory and what our hooks will receive.
 */
export interface WrappedApiFunction<Args, Ret> {
  _type: "query" | "mutation";
  args?: ZodObject<any>;
  handler: (ctx: HandlerContext, args: Args) => Promise<Ret>;
}

// --- Handler Context with Scheduler ---

/**
 * The full HandlerContext now includes a scheduler for invalidating queries.
 * This will be passed to every query and mutation handler.
 */
export type HandlerContext = BaseHandlerContext & {
  scheduler: {
    invalidate: (queryRef: QueryReference<any, any>) => Promise<void>;
  };
};

// --- Handler Definition Interfaces for Overloads ---

/**
 * The shape of a definition for a handler that takes NO arguments.
 */
interface HandlerDefinitionWithoutArgs<Ret> {
  args?: undefined;
  handler: (ctx: HandlerContext) => Promise<Ret>;
}

/**
 * The shape of a definition for a handler that takes Zod-defined arguments.
 * The `Args` type will be automatically inferred from the provided Zod schema.
 */
interface HandlerDefinitionWithArgs<Schema extends ZodObject<any>, Ret> {
  args: Schema;
  handler: (ctx: HandlerContext, args: z.infer<Schema>) => Promise<Ret>;
}

// --- Public Helper Functions with Overloads ---

/**
 * Wraps a query definition, branding it with `_isQuery` for the invalidation system.
 * TypeScript will choose the correct overload based on whether you provide an `args`
 * property with a Zod schema.
 */
export function query<Ret>(
  definition: HandlerDefinitionWithoutArgs<Ret>
): QueryReference<void, Ret>;
export function query<Schema extends ZodObject<any>, Ret>(
  definition: HandlerDefinitionWithArgs<Schema, Ret>
): QueryReference<z.infer<Schema>, Ret>;
export function query(definition: any): QueryReference<any, any> {
  return {
    _type: "query",
    _isQuery: true, // The brand that makes it a `QueryReference`
    ...definition,
  } as any;
}

/**
 * Wraps a mutation definition. It does not get the query brand.
 */
export function mutation<Ret>(
  definition: HandlerDefinitionWithoutArgs<Ret>
): WrappedApiFunction<void, Ret>;
export function mutation<Schema extends ZodObject<any>, Ret>(
  definition: HandlerDefinitionWithArgs<Schema, Ret>
): WrappedApiFunction<z.infer<Schema>, Ret>;
export function mutation(definition: any): WrappedApiFunction<any, any> {
  return {
    _type: "mutation",
    ...definition,
  };
}
