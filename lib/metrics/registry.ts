// Lightweight Prometheus-style metrics registry used for tests and exposition.
type Labels = Record<string, string> | undefined;

function labelKey(labels?: Labels) {
  if (!labels) return '{}';
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}="${labels[k]}"`)
    .join(',');
}

class Counter {
  private values = new Map<string, number>();
  constructor(private name: string, private help: string) {}
  inc(labels?: Labels, v = 1) {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) || 0) + v);
  }
  collect(): string {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} counter\n`;
    for (const [lbl, val] of this.values) {
      const labelPart = lbl === '{}' ? '' : `{${lbl}}`;
      out += `${this.name}${labelPart} ${val}\n`;
    }
    return out;
  }
}

class Histogram {
  private buckets = new Map<string, number>();
  private sum = 0;
  private count = 0;
  constructor(private name: string, private help: string, private bucketBounds = [0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2.5,5,10]) {
    // initialize per-label buckets lazily
  }
  observe(value: number, labels?: Labels) {
    const base = labelKey(labels);
    for (const b of this.bucketBounds) {
      const key = `${base}|le=${b}`;
      this.buckets.set(key, (this.buckets.get(key) || 0) + (value <= b ? 1 : 0));
    }
    // +Inf bucket
    const infKey = `${base}|le=+Inf`;
    this.buckets.set(infKey, (this.buckets.get(infKey) || 0) + 1);

    this.sum += value;
    this.count++;
  }
  collect(): string {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} histogram\n`;
    // group by label base
    const groups = new Map<string, { buckets: [string, number][]; sum: number; count: number }>();
    for (const [key, val] of this.buckets) {
      const [base, lePart] = key.split('|le=');
      if (!groups.has(base)) groups.set(base, { buckets: [], sum: 0, count: 0 });
      groups.get(base)!.buckets.push([lePart, val]);
    }
    for (const [base, grp] of groups) {
      const labelPart = base === '{}' ? '' : `{${base}}`;
      // buckets in ascending order
      grp.buckets.sort((a,b) => parseFloat(a[0]) - parseFloat(b[0]));
      for (const [le, val] of grp.buckets) {
        out += `${this.name}_bucket${labelPart},le="${le}" ${val}\n`;
      }
      out += `${this.name}_sum${labelPart} ${this.sum}\n`;
      out += `${this.name}_count${labelPart} ${this.count}\n`;
    }
    return out;
  }
}

class Gauge {
  private values = new Map<string, number>();
  constructor(private name: string, private help: string) {}
  set(labels: Labels, v: number) {
    const key = labelKey(labels);
    this.values.set(key, v);
  }
  collect(): string {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} gauge\n`;
    for (const [lbl, val] of this.values) {
      const labelPart = lbl === '{}' ? '' : `{${lbl}}`;
      out += `${this.name}${labelPart} ${val}\n`;
    }
    return out;
  }
}

class Registry {
  httpRequests = new Counter('http_requests_total', 'Total HTTP requests');
  httpRequestDuration = new Histogram('http_request_duration_seconds', 'HTTP request duration in seconds');
  httpErrors = new Counter('http_errors_total', 'HTTP error count');

  sorobanSubmissions = new Counter('soroban_submissions_total', 'Soroban transaction submissions');
  sorobanSubmitDuration = new Histogram('soroban_submit_duration_seconds', 'Soroban submit duration seconds');

  outboundRequests = new Counter('outbound_http_requests_total', 'Outbound HTTP requests');
  outboundRequestDuration = new Histogram('outbound_http_request_duration_seconds', 'Outbound HTTP request duration seconds');
  horizonSelections = new Counter('horizon_selection_total', 'Horizon endpoint selections');

  // gauge for circuit breaker state per host (0=closed,1=open,2=half_open)
  circuitState = new Gauge('circuit_state', 'Circuit breaker state per host');

  collect(): string {
    let out = '';
    out += this.httpRequests.collect();
    out += this.httpRequestDuration.collect();
    out += this.httpErrors.collect();
    out += this.sorobanSubmissions.collect();
    out += this.sorobanSubmitDuration.collect();
    out += this.outboundRequests.collect();
    out += this.outboundRequestDuration.collect();
    out += this.horizonSelections.collect();
    out += this.circuitState.collect();
    return out;
  }
}
}

export const metrics = new Registry();

export default metrics;
