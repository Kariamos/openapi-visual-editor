import type { HttpMethod } from '../App';

/** Ordered list of all HTTP methods (conventional display order). */
export const HTTP_METHODS: HttpMethod[] = [
  'get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace',
];

/** Swagger-UI-inspired colour per HTTP method. */
export const METHOD_COLORS: Record<string, string> = {
  get: '#61affe',
  post: '#49cc90',
  put: '#fca130',
  delete: '#f93e3e',
  patch: '#50e3c2',
  head: '#9012fe',
  options: '#0d5aa7',
  trace: '#666',
};
