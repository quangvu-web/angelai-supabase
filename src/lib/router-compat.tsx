// Compatibility layer: exposes the react-router-dom API used by the copied
// ANGEL AI code on top of TanStack Router.
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  Link as TLink,
  useNavigate as useTNavigate,
  useLocation as useTLocation,
  useParams as useTParams,
  useRouter,
} from "@tanstack/react-router";

type To = string | { pathname?: string; search?: string; hash?: string };

function toHref(to: To): string {
  if (typeof to === "string") return to;
  return `${to.pathname ?? ""}${to.search ?? ""}${to.hash ?? ""}`;
}

export type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: To;
  replace?: boolean;
  state?: unknown;
};

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace, state, ...rest },
  ref,
) {
  const href = toHref(to);
  if (/^(https?:|mailto:|tel:)/.test(href)) return <a ref={ref} href={href} {...rest} />;
  return <TLink ref={ref} {...(rest as any)} {...({ href, to: href } as any)} replace={replace} state={state as any} />;
});

export type NavLinkProps = Omit<LinkProps, "className" | "children" | "style"> & {
  className?: string | ((s: { isActive: boolean; isPending: boolean }) => string | undefined);
  style?: React.CSSProperties | ((s: { isActive: boolean }) => React.CSSProperties | undefined);
  children?: React.ReactNode | ((s: { isActive: boolean }) => React.ReactNode);
  end?: boolean;
};

export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { className, style, children, end, to, ...rest },
  ref,
) {
  const { pathname } = useLocation();
  const target = toHref(to).split(/[?#]/)[0] ?? "";
  const isActive = end ? pathname === target : pathname === target || pathname.startsWith(target.endsWith("/") ? target : target + "/");
  const s = { isActive, isPending: false };
  return (
    <Link
      ref={ref}
      to={to}
      {...rest}
      className={typeof className === "function" ? className(s) : className}
      style={typeof style === "function" ? style(s) : style}
    >
      {typeof children === "function" ? children(s) : children}
    </Link>
  );
});

export function useNavigate() {
  const navigate = useTNavigate();
  const router = useRouter();
  return React.useCallback(
    (to: To | number, opts?: { replace?: boolean; state?: unknown }) => {
      if (typeof to === "number") {
        if (to < 0) router.history.go(to);
        else router.history.go(to);
        return;
      }
      const href = toHref(to);
      if (/^https?:/.test(href)) {
        window.location.href = href;
        return;
      }
      navigate({ href, replace: opts?.replace, state: opts?.state as any } as any);
    },
    [navigate, router],
  );
}

export function useLocation() {
  const loc = useTLocation();
  return {
    pathname: loc.pathname,
    search: loc.searchStr ?? "",
    hash: loc.hash ? `#${loc.hash}` : "",
    state: (loc.state as any) ?? null,
    key: (loc.state as any)?.__TSR_key ?? "default",
  };
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  return useTParams({ strict: false }) as T;
}

export function useSearchParams(): [URLSearchParams, (next: any, opts?: { replace?: boolean }) => void] {
  const loc = useLocation();
  const navigate = useNavigate();
  const params = React.useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const set = React.useCallback(
    (next: any, opts?: { replace?: boolean }) => {
      const value = typeof next === "function" ? next(new URLSearchParams(loc.search)) : next;
      const sp = value instanceof URLSearchParams ? value : new URLSearchParams(value);
      const qs = sp.toString();
      navigate(`${loc.pathname}${qs ? `?${qs}` : ""}${loc.hash}`, opts);
    },
    [loc.pathname, loc.search, loc.hash, navigate],
  );
  return [params, set];
}

export function Navigate({ to, replace }: { to: To; replace?: boolean }) {
  const navigate = useNavigate();
  React.useEffect(() => {
    navigate(to, { replace });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
