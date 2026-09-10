import { QueryClient } from '@tanstack/react-query';

// In production runtime, enable window focus refetching and 1000ms stale time for responsive SSOT disk sync,
// while enforcing zero-stall background isolation (refetchIntervalInBackground: false) and preserving test isolation.
const isTestEnv = process.env.NODE_ENV === 'test';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: isTestEnv ? 5 * 60 * 1000 : 1000, // 1000ms for active operational queries, 5m for test isolation
      gcTime: 30 * 60 * 1000,   // 30 minutes garbage collection (formerly cacheTime)
      retry: (failureCount, error: unknown) => {
        // Stop retrying if the error is related to auth (401/403) or we've retried 2 times already
        const errStatus = (error as { status?: number })?.status;
        if (errStatus === 401 || errStatus === 403) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      refetchOnWindowFocus: isTestEnv ? false : true, // Pick up external/background disk writes on window focus
      refetchOnReconnect: false,   // Prevent automatic refetch on network reconnect
      refetchIntervalInBackground: false, // Zero-stall: disable polling in background tabs
    },
    mutations: {
      retry: 1, // Minimize retry on mutation to prevent duplicate records
    }
  },
});
