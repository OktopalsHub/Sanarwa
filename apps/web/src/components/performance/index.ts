// Performance optimization components and utilities
export {
  ChartSkeleton,
  ComponentSkeleton,
  DashboardSkeleton,
  FormSkeleton,
  LazyAnalyticsDashboard,
  LazyAnalyticsDashboardWrapper,
  LazyBrandingConfigurator,
  LazyBrandingConfiguratorWrapper,
  LazyCampaignBuilder,
  LazyCampaignBuilderWrapper,
  LazyTeamManagement,
  LazyTeamManagementWrapper,
  LazyWorkflowCanvas,
  LazyWorkflowCanvasWrapper,
  LazyWrapper,
  TableSkeleton,
} from "./lazy-components";

export {
  PerformanceDebugger,
  PerformanceMonitorComponent,
  useAsyncPerformance,
  useComponentPerformance,
} from "./performance-monitor";

export { LazyLoad, OptimizedList, useVirtualScroll, VirtualScroll } from "./virtual-scroll";

export { ServiceWorkerRegistration } from "./service-worker-registration";

// Re-export performance utilities
export {
  addResourceHints,
  calculateVisibleItems,
  createImageLoader,
  createLazyComponent,
  debounce,
  dynamicImport,
  getOptimizedImageProps,
  loadNonCriticalCSS,
  MemoryManager,
  PerformanceMonitor,
  preloadComponent,
  preloadRoute,
  registerServiceWorker,
  reportWebVitals,
  throttle,
} from "@/lib/utils/performance";
