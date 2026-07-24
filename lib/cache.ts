import { InMemoryCache, globalCache, SimpleCache, DEFAULT_TTL_MS } from './cache/index';

export * from './cache/index';
export { globalCache, SimpleCache, DEFAULT_TTL_MS };
export default InMemoryCache;