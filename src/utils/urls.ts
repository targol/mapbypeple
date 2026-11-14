// URLs that work on any static host and any sub-folder (https://barzokhouse.com/map/, a subdomain, ...).
// Everything is a query string on the page itself, so the host needs no rewrite rules.

/** Folder that contains index.html, with a trailing slash. */
export function appBaseUrl(): string {
  return `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
}

export function placeUrl(slug: string): string {
  return `${appBaseUrl()}?place=${encodeURIComponent(slug)}`;
}

export function embedUrl(lang?: string): string {
  return `${appBaseUrl()}?embed=1${lang === 'en' ? '&lang=en' : ''}`;
}

/** Slug from ?place=... (or the older /place/slug path), if any. */
export function slugFromLocation(): string | null {
  const q = new URLSearchParams(window.location.search).get('place');
  if (q) return q;
  const m = window.location.pathname.match(/\/place\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function isAdminLocation(): boolean {
  return (
    new URLSearchParams(window.location.search).get('admin') === '1' ||
    window.location.pathname.endsWith('/admin')
  );
}

/** Replace one query parameter without reloading, keeping the others (embed, lang). */
export function setQueryParam(key: string, value: string | null, push = false) {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  if (url.pathname.endsWith('/admin') || /\/place\/[^/]+\/?$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/(\/admin|\/place\/[^/]+\/?)$/, '/');
  }
  window.history[push ? 'pushState' : 'replaceState']({}, '', url.toString());
}
