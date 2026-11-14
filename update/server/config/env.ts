export const envConfig = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  HOST: process.env.HOST || '127.0.0.1',
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '',
  DISABLE_RATE_LIMIT: process.env.DISABLE_RATE_LIMIT === 'true' || process.env.NODE_ENV === 'test'
};

export const superadminConfig = {
  EMAIL: (process.env.SUPERADMIN_EMAIL || 'admin@nexusfinance.ng').trim().toLowerCase(),
  PASSWORD: process.env.SUPERADMIN_PASSWORD || 'AdminPassword123!',
  NAME: process.env.SUPERADMIN_NAME || 'Super Administrator',
  STAFF_ID: process.env.SUPERADMIN_STAFF_ID || 'NX-ADM-0001'
};

