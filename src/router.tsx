import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Warm the route chunk + data as soon as a tab is touched/hovered so
    // navigation feels instant, and keep that warm cache for a minute.
    defaultPreload: "intent",
    defaultPreloadDelay: 20,
    defaultPreloadStaleTime: 60_000,
  });

  return router;
};
