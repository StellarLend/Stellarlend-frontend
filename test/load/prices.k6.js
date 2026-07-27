import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<250'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/prices?assets=XLM,USDC`);
  check(res, {
    'prices status is 200': (r) => r.status === 200,
  });
}