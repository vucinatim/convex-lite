/* eslint-disable @typescript-eslint/no-explicit-any */
import { z, type ZodObject } from "zod/v4";
import type { HandlerContext } from "../server/server";

// --- Core Type Definitions ---

/**
 * The final, standardized object shape that our helpers produce.
 * This is what will be stored in memory and what our hooks will receive.
 * It is generic over its actual argument and return types.
 */
export interface WrappedApiFunction<Args, Ret> {
  _type: "query" | "mutation";
  // The Zod schema for arguments is stored for runtime validation.
  args?: ZodObject<any>;
  handler: (ctx: HandlerContext, args: Args) => Promise<Ret>;
}

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
 * Wraps a query definition. TypeScript will choose the correct overload based on
 * whether you provide an `args` property in the definition object.
 */
export function query<Ret>(
  definition: HandlerDefinitionWithoutArgs<Ret>
): WrappedApiFunction<void, Ret>;
export function query<Schema extends ZodObject<any>, Ret>(
  definition: HandlerDefinitionWithArgs<Schema, Ret>
): WrappedApiFunction<z.infer<Schema>, Ret>;
export function query(definition: any): WrappedApiFunction<any, any> {
  return {
    _type: "query",
    ...definition,
  };
}

/**
 * Wraps a mutation definition. TypeScript will choose the correct overload based on
 * whether you provide an `args` property in the definition object.
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
