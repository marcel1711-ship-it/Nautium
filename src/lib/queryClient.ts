import { QueryClient, onlineManager } from '@tanstack/react-query';

onlineManager.setOnline(navigator.onLine);
window.addEventListener('online', () => onlineManager.setOnline(true));
window.addEventListener('offline', () => onlineManager.setOnline(false));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 60 * 24,
      retry: (failureCount) => navigator.onLine && failureCount < 2,
      retryDelay: 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});
