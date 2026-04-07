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

/** Common HTTP status codes grouped by category. */
export const HTTP_STATUS_CODES = [
  { group: 'Success (2xx)', codes: [
    { code: '200', desc: 'OK' },
    { code: '201', desc: 'Created' },
    { code: '202', desc: 'Accepted' },
    { code: '204', desc: 'No Content' },
  ]},
  { group: 'Redirection (3xx)', codes: [
    { code: '301', desc: 'Moved Permanently' },
    { code: '304', desc: 'Not Modified' },
    { code: '307', desc: 'Temporary Redirect' },
  ]},
  { group: 'Client Error (4xx)', codes: [
    { code: '400', desc: 'Bad Request' },
    { code: '401', desc: 'Unauthorized' },
    { code: '403', desc: 'Forbidden' },
    { code: '404', desc: 'Not Found' },
    { code: '405', desc: 'Method Not Allowed' },
    { code: '409', desc: 'Conflict' },
    { code: '422', desc: 'Unprocessable Entity' },
    { code: '429', desc: 'Too Many Requests' },
  ]},
  { group: 'Server Error (5xx)', codes: [
    { code: '500', desc: 'Internal Server Error' },
    { code: '502', desc: 'Bad Gateway' },
    { code: '503', desc: 'Service Unavailable' },
    { code: '504', desc: 'Gateway Timeout' },
  ]},
];
