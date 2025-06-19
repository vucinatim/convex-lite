import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="h-screen flex flex-col dark:bg-zinc-900">
      {/* Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="container flex h-16 items-center px-4 sm:px-6">
          <div className="mr-4 flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 text-primary"
              >
                <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
                <path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4" />
              </svg>
              <span className="hidden font-bold sm:inline-block">
                Convex Kanban
              </span>
            </Link>
          </div>
          <nav className="flex items-center space-x-4 lg:space-x-6 mx-6">
            <Link
              to="/"
              className="text-sm font-medium transition-colors hover:text-primary [&.active]:text-primary [&.active]:font-medium"
              activeProps={{ className: "active" }}
            >
              Home
            </Link>
            <Link
              to="/kanban"
              className="text-sm font-medium transition-colors hover:text-primary [&.active]:text-primary [&.active]:font-medium"
              activeProps={{ className: "active" }}
            >
              Kanban
            </Link>
            <Link
              to="/admin"
              className="text-sm font-medium transition-colors hover:text-primary [&.active]:text-primary [&.active]:font-medium"
              activeProps={{ className: "active" }}
            >
              Admin
            </Link>
          </nav>
          <div className="ml-auto flex items-center space-x-4">
            {/* Add user menu or other controls here if needed */}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            &copy; {new Date().getFullYear()} Convex Kanban. All rights
            reserved.
          </p>
        </div>
      </footer>

      {/* Router Devtools */}
      <TanStackRouterDevtools />
    </div>
  );
}
