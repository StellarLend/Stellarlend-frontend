import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<250'],
  },
};

export default function () {
  const payload = JSON.stringify({
    xdr: __ENV.TEST_TX_XDR || 'test-xdr',
  });

  const res = http.post(`${BASE_URL}/api/tx/submit`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'tx submit returns handled response': (r) => r.status >= 200 && r.status < 500,
  });
}