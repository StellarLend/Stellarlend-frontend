export type DbSslConfig = false | {
  ca?: string;
  rejectUnauthorized: boolean;
};

const INSECURE_SSL_WARNING =
  'DATABASE_SSL_INSECURE=true disables PostgreSQL TLS certificate verification. Use only as a temporary escape hatch.';

function normalizeCaCert(value?: string) {
  const cert = value?.trim();
  return cert ? cert.replace(/\\n/g, '\n') : undefined;
}

export function resolveDbSslConfig(env: NodeJS.ProcessEnv = process.env): DbSslConfig {
  if (env.NODE_ENV !== 'production') {
    return false;
  }

  if (env.DATABASE_SSL_INSECURE?.toLowerCase() === 'true') {
    console.warn(INSECURE_SSL_WARNING);
    return { rejectUnauthorized: false };
  }

  const ca = normalizeCaCert(env.DATABASE_CA_CERT);

  return ca
    ? { rejectUnauthorized: true, ca }
    : { rejectUnauthorized: true };
}
