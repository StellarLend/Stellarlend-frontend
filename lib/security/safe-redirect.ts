const ALLOWED_PATH_PREFIXES = ['/dashboard', '/lending', '/account'];

export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '/';

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw).trim();
  } catch {
    return '/';
  }

  if (!decoded) return '/';

  // Reject dangerous protocol schemes — check before any whitespace-stripping regex
  // so that whitespace-padded payloads like " javascript:" are caught
  const lower = decoded.toLowerCase();
  if (/javascript\s*:/i.test(lower)) return '/';
  if (/data\s*:/i.test(lower)) return '/';
  if (/vbscript\s*:/i.test(lower)) return '/';

  // Reject absolute URLs (any protocol://)
  if (/^[a-z][a-z0-9+\-.]*:/i.test(decoded)) return '/';

  // Reject protocol-relative URLs (//evil.com)
  if (/^\/\//.test(decoded)) return '/';

  // Must be an internal path — reject anything that doesn't start with /
  if (!decoded.startsWith('/')) return '/';

  // Root is always allowed
  if (decoded === '/') return '/';

  // Extract the path portion (before query string or hash fragment)
  const queryOrHash = decoded.indexOf('?');
  const hashIdx = decoded.indexOf('#');
  let cut = queryOrHash;
  if (hashIdx !== -1 && (cut === -1 || hashIdx < cut)) {
    cut = hashIdx;
  }
  const pathOnly = cut === -1 ? decoded : decoded.slice(0, cut);

  // Reject paths that only contain a query string or hash (e.g. "?foo" or "#bar")
  if (pathOnly === '/') return '/';

  for (const allowed of ALLOWED_PATH_PREFIXES) {
    if (pathOnly === allowed || pathOnly.startsWith(allowed + '/')) {
      return decoded;
    }
  }

  return '/';
}
