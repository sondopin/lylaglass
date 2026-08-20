"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Devtools are development-only, so they are loaded through `next/dynamic`
 * rather than imported at the top of the module.
 *
 * A static import puts the package in the module graph regardless of the
 * `NODE_ENV` check below — the check only stops it from *rendering*. The bundler
 * still emits it as an async chunk, which is what produced `ChunkLoadError:
 * Loading chunk … DevtoolsComponent … failed` whenever the build cache went
 * stale. Importing it lazily means the chunk is only ever requested when the
 * component actually renders, and it disappears from the production build
 * entirely.
 *
 * `ssr: false` is valid here because this module is itself a Client Component.
 */
const ReactQueryDevtools = dynamic(
  () => import("@tanstack/react-query-devtools").then((mod) => mod.ReactQueryDevtools),
  { ssr: false }
);

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
