// [INTERNAL MAINTENANCE ONLY]
// Requires local .env
// MUST NOT be run in production without founder approval
const fs = require('fs');
let c = fs.readFileSync('.env.local', 'utf8');
c += '\nUPSTASH_REDIS_EMAIL_REST_URL="https://outgoing-ringtail-144042.upstash.io"\nUPSTASH_REDIS_EMAIL_REST_TOKEN="gQAAAAAAAjKqAAIgcDIwMDBkYTNjYzA5ODE0MTdjODI2NmM0NjM1ZTc4ZDc4NA"\n';
fs.writeFileSync('.env.local', c);
