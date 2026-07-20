// Accessibility components and utilities
export {
  HighContrastMode,
  useContrastMode
} from './high-contrast-mode';
export {
  Announcement, FocusTrap, KeyboardNavigation,
  RovingTabindex
} from './keyboard-navigation';
export {
  Breadcrumb, ErrorMessage, FieldDescription, LiveRegion, LoadingAnnouncer, ProgressAnnouncer, ScreenReaderOnly, Status, useAnnouncement,
  useFieldDescription
} from './screen-reader';
export { SkipLinks, useSkipLinkTarget } from './skip-links';

// Re-export accessibility utilities
export {
  A11yTesting, AriaUtils, FocusManager, KEYBOARD_KEYS,
  LIVE_REGIONS, ScreenReaderUtils, getContrastRatio,
  meetsWCAGContrast, useHighContrast, useKeyboardNavigation,
  useReducedMotion
} from '@/lib/utils/accessibility';
