/**
 * main.tsx - Application Entry Point
 * ===================================
 * 
 * PURPOSE:
 * This is the entry point for the React application. It sets up the React Query
 * client for server state management and renders the root App component.
 * 
 * ARCHITECTURE:
 * - Uses React 18's createRoot API for concurrent rendering
 * - Wraps the app in QueryClientProvider for global data fetching state
 * - Uses StrictMode for development warnings and double-rendering checks
 * 
 * REACT QUERY CONFIGURATION:
 * - refetchOnWindowFocus: false - Prevents automatic refetching when window gains focus
 *   (useful for reducing unnecessary API calls in a support dashboard)
 * - retry: 1 - Only retry failed requests once (prevents excessive API calls on errors)
 * 
 * TROUBLESHOOTING:
 * - If app doesn't load: Check browser console for JavaScript errors
 * - If data isn't updating: Check React Query DevTools or network tab
 * - If styles are missing: Ensure index.css is imported correctly
 * - White screen: Check if #root element exists in index.html
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
