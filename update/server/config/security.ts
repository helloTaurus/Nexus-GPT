export const securityConfig = {
  cookieName: 'nexus_session',
  sessionRollingInactivityMs: 30 * 60 * 1000, // 30 minutes
  sessionAbsoluteExpiryMs: 8 * 60 * 60 * 1000, // 8 hours
  cookieMaxAgeSeconds: 86400, // 24 hours
  corsAllowedOrigins: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001'
  ]
};
