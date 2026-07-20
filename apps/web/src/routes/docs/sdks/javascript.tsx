import { createFileRoute } from '@tanstack/react-router';
import JavaScriptSDKPage from '@/pages/docs-sdks-javascript';

export const Route = createFileRoute('/docs/sdks/javascript')({
  component: JavaScriptSDKPage,
});
