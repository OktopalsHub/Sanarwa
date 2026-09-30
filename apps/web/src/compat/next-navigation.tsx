/**
 * Next.js compatibility shims for TanStack Router migration
 */
import {
  Link as TanStackLink,
  useNavigate,
  useParams as useTanStackParams,
  useRouterState,
} from "@tanstack/react-router";
import type { ComponentProps } from "react";

type LinkProps = Omit<ComponentProps<typeof TanStackLink>, "to"> & {
  href: string;
};

export function Link({ href, children, ...props }: LinkProps) {
  return (
    <TanStackLink to={href} {...props}>
      {children}
    </TanStackLink>
  );
}

export function useRouter() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return {
    push: (url: string) => navigate({ to: url }),
    replace: (url: string) => navigate({ to: url, replace: true }),
    back: () => window.history.back(),
    refresh: () => window.location.reload(),
    pathname,
  };
}

export function usePathname() {
  return useRouterState({ select: (s) => s.location.pathname });
}

export function useSearchParams() {
  const search = useRouterState({ select: (s) => s.location.search });
  return new URLSearchParams(search as unknown as string);
}

export function useParams<T extends Record<string, string> = Record<string, string>>(
  options: { strict?: boolean } = { strict: false },
): T {
  return useTanStackParams(options as never) as T;
}

export { redirect } from "@tanstack/react-router";
