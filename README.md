# Convex-Lite

![Convex-Lite Banner](https://placehold.co/1200x300/7c3aed/ffffff?text=Convex-Lite)

A lightweight, self-hostable, open-source framework inspired by [Convex](https://convex.dev), designed to bring a typesafe, real-time backend experience to your React projects.

Convex-Lite provides end-to-end typesafety from your database schema to your React components, complete with real-time updates via WebSockets and an elegant, explicit API for defining queries and mutations.

---

## Core Features

-   **🚀 End-to-End Typesafety:** Automatically generate types from your server-side API functions and use them directly in your client-side hooks. "Go to Definition" works out of the box, taking you straight to your backend implementation.
-   **⚡️ Real-time Reactivity:** Mutations automatically invalidate query data, triggering a lightweight refetch on all connected clients. Your UI stays effortlessly in sync with your database.
-   **🛡️ Runtime Validation:** Define argument schemas for your API endpoints using Zod. The server automatically validates incoming requests, making your handlers cleaner and more secure.
-   **📦 Database Agnostic:** Built on top of Drizzle ORM, allowing you to easily switch between databases like SQLite, PostgreSQL, or MySQL with minimal code changes.
-   **🏠 Self-Hostable:** Full control over your infrastructure. Deploy the Node.js server and your database wherever you want.

---

## Getting Started

This project is set up as a monorepo with a Vite client and a Node.js server.

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd convex-lite-project
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Run the development server:**
    This command starts the Vite client and the Node.js backend server concurrently. It will also watch your `convex/` directory for changes.
    ```bash
    pnpm dev
    ```

4.  **Generate API types:**
    After defining or changing any function in your `convex/api/` or `convex/admin/` directories, your server will restart and automatically run the script to generate the necessary types in `convex/_generated/`.

---

## Defining API Endpoints

All your backend logic lives in the `convex/` directory. You define your API using explicit `query` and `mutation` helper functions.

### Queries

A query is a read-only function that fetches data from your database.

**Example: `convex/api/counter_api.ts`**
```typescript
import { eq } from "drizzle-orm";
import { countersTable } from "convex/schema";
import { query } from "convex/server";

export const getCounter = query({
  handler: async ({ db }) => {
    // Your Drizzle logic here
    const fetchedCounter = db
      .select()
      .from(countersTable)
      .where(eq(countersTable._id, "the_one_and_only_counter"))
      .get();

    if (!fetchedCounter) {
      throw new Error("Counter not found!");
    }
    return fetchedCounter;
  },
});
````

### Mutations

A mutation is a function that can write to the database. It can also invalidate queries to trigger real-time updates on the client.

**Example: `convex/api/counter_api.ts`**

```typescript
import { mutation, query } from "convex/server";
import { z } from "zod/v4"; // IMPORTANT to use v4!

// ... getCounter query defined above

export const incrementCounter = mutation({
  args: z.object({
    amount: z.number().positive(),
  }),
  handler: async ({ db, scheduler }, { amount }) => {
    // Zod validation is handled automatically by the server.
    // ... your logic to update the counter by `amount` ...

    // Invalidate the getCounter query to notify clients.
    // This is typesafe and uses the actual function reference.
    await scheduler.invalidate(getCounter);

    return { success: true };
  },
});
```

-----

## Using the Hooks

Convex-Lite provides React hooks to interact with your backend API from your components. These hooks are fully typesafe.

### `useQuery`

Subscribes a component to a query. It will automatically re-render when the data is invalidated by a mutation.

**Example: `src/App.tsx`**

```tsx
import { useQuery } from "./hooks/use-convex-lite";
import { api } from "convex/_generated/api";

function CounterDisplay() {
  // `useQuery` for a function with no arguments.
  const { data: counter, isLoading } = useQuery(api.counter.getCounter);

  if (isLoading) return <div>Loading...</div>;

  return <div>Count: {counter?.value}</div>;
}
```

### `useMutation`

Gives you a function to call a mutation from your component.

**Example: `src/App.tsx`**

```tsx
import { useMutation } from "./hooks/use-convex-lite";
import { api } from "convex/_generated/api";

function IncrementButton() {
  // `useMutation` returns a mutate function and its loading state.
  const { mutate: increment, isLoading } = useMutation(api.counter.incrementCounter);

  const handleClick = () => {
    // The arguments are fully typed based on your Zod schema.
    increment({ amount: 1 });
  };

  return (
    <button onClick={handleClick} disabled={isLoading}>
      {isLoading ? "Incrementing..." : "Increment"}
    </button>
  );
}
```

-----

## Architecture FAQ

Here are some answers to common architectural questions about how Convex-Lite works.

#### Q: How does "Go to Definition" work without any special editor plugins?

This is achieved through advanced TypeScript generics. The code generation script creates a declaration file (`api.d.ts`) that uses a special `ApiFromModules` type helper. This helper constructs the final `api` object's type in a way that preserves the original source location of every function, allowing the TypeScript server to trace it back correctly.

#### Q: Is the framework tied to a specific database?

**No, it is highly database agnostic.** Thanks to Drizzle ORM, your application logic is decoupled from the database's SQL dialect. The only file you need to change to switch from SQLite to PostgreSQL (or another Drizzle-supported DB) is `server/lib/database.ts`, where the initial connection is created. The rest of your application, including all your query and mutation handlers, remains unchanged.

#### Q: How scalable is this setup?

The scalability of your application depends on the architecture you choose. Here is a roadmap of different tiers and what they can handle.

### Scalability Tiers & Estimates

This table provides a ballpark estimate for supporting concurrently connected, active users on different architectures. The actual performance will depend heavily on your specific code efficiency and database schema design.

| Architecture Tier | App Server Setup | Database | Real-time Messaging | Est. Concurrent Users (Chat App) | Primary Bottleneck | Next Step to Scale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Hobbyist**\<br/\>*(The default setup)* | 1x Single Instance | SQLite | In-Memory `Set` | **50 - 200** | SQLite write contention & I/O. | Migrate to a client-server database. |
| **Tier 2: Professional Single-Node**\<br/\>*(The first big leap)* | 1x Single Instance | PostgreSQL (local) | In-Memory `Set` | **500 - 2,000** | Single Node.js CPU core & memory. | Implement external messaging service. |
| **Tier 3: Scalable App Layer**\<br/\>*(Ready for growth)* | 3x+ App Cluster | PostgreSQL (local) | **Redis Pub/Sub** | **2,000 - 10,000** | Database connection limits & CPU. | Move the database to a dedicated server. |
| **Tier 4: Dedicated DB**\<br/\>*(Production Grade)* | 3x+ App Cluster | **Dedicated PostgreSQL Server** | Redis Pub/Sub | **10,000 - 50,000+** | Database performance (CPU/RAM/Disk I/O). | Implement read replicas for the database. |
| **Tier 5: Enterprise Scale**\<br/\>*(High Availability)* | Auto-scaling Cluster | **Managed / Clustered PostgreSQL** | Managed Redis | **50,000++** | Cost, network latency, application logic complexity. | Database sharding, regional distribution. |

-----

## Future Work

Convex-Lite is a starting point. Here are some ideas for future improvements:

  - Implement optimistic updates on the client.
  - Add support for file storage.
  - Build out a more comprehensive authentication system.
  - Add support for scheduled functions (crons).
