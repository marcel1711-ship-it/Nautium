import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Show cached data immediately, refresh in background
      staleTime: 1000 * 60 * 2,        // Data is fresh for 2 minutes
      gcTime: 1000 * 60 * 10,          // Keep in cache for 10 minutes
      retry: 2,                          // Retry failed requests twice
      retryDelay: 1000,                  // Wait 1 second between retries
      refetchOnWindowFocus: true,        // Refresh when user comes back to tab
      refetchOnReconnect: true,          // Refresh when internet comes back
    },
    mutations: {
      retry: 1,
    },
  },
});
