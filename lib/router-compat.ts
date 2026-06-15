'use client';
// ─── Pages-Router-shaped useRouter() backed by next/navigation ───
// After the App Router migration, `next/router` no longer works in components.
// This shim exposes the small slice of the Pages Router API the app actually
// uses (push/replace/query/pathname/isReady) on top of next/navigation, so the
// existing components migrate with a single import swap instead of a rewrite.
import {
  useRouter as useNavRouter,
  usePathname,
  useSearchParams,
  useParams,
} from 'next/navigation';
import { useCallback, useMemo } from 'react';

type Query = Record<string, string | undefined>;
type UrlObject = { pathname?: string; query?: Record<string, string | number | null | undefined> };
type Url = string | UrlObject;

function toHref(url: Url, currentPath: string, routeParamKeys?: Set<string>): string {
  if (typeof url === 'string') return url;
  const path = url.pathname ?? currentPath;
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(url.query ?? {})) {
    // Skip dynamic route-segment keys (from useParams). App Router's pathname is
    // already the RESOLVED path (/notes/123, not /notes/[id]), so re-emitting e.g.
    // `id` would pollute the URL as ?id=123. Route params belong in the path. This
    // matters for call sites that spread router.query into a {pathname,query}
    // object (e.g. EditorPane stripping ?upload).
    if (routeParamKeys?.has(k)) continue;
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Drop-in replacement for next/router's useRouter in App Router client
 * components. `query` merges dynamic route params (useParams) with the URL
 * search params (useSearchParams) exactly like the Pages Router did. `pathname`
 * is the real path (e.g. /notes/123), which the app's `=== '/notes'` /
 * `.startsWith('/notes/')` checks already handle correctly. `isReady` is always
 * true (App Router params/search are available synchronously on the client).
 */
export function useRouter() {
  const nav = useNavRouter();
  const pathname = usePathname() || '/';
  const search = useSearchParams();
  const params = useParams();

  const query = useMemo<Query>(() => {
    const out: Query = {};
    search?.forEach((v, k) => { out[k] = v; });
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) out[k] = Array.isArray(v) ? v[0] : (v as string);
      }
    }
    return out;
  }, [search, params]);

  // Accept (and ignore) the legacy Pages-Router (url, as, options) signature —
  // e.g. router.replace({pathname, query}, undefined, { shallow: true }) — so
  // existing call sites need no change. App Router search-param updates are
  // already shallow (no full reload), preserving the original intent.
  const routeParamKeys = useMemo(() => new Set(Object.keys(params ?? {})), [params]);
  const push = useCallback((url: Url, _as?: unknown, _opts?: unknown) => { nav.push(toHref(url, pathname, routeParamKeys)); }, [nav, pathname, routeParamKeys]);
  const replace = useCallback((url: Url, _as?: unknown, _opts?: unknown) => { nav.replace(toHref(url, pathname, routeParamKeys)); }, [nav, pathname, routeParamKeys]);

  return useMemo(() => ({
    pathname,
    query,
    isReady: true,
    push,
    replace,
    back: () => nav.back(),
    forward: () => nav.forward(),
    refresh: () => nav.refresh(),
    prefetch: (href: string) => { try { nav.prefetch(href); } catch { /* noop */ } },
  }), [pathname, query, push, replace, nav]);
}
