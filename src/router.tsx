import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // SPA mode: disable SSR for GitHub Pages static deployment.
    // The app is a pure client-side chart builder with no server data dependencies.
    ssr: false,
  });

  return router;
};
