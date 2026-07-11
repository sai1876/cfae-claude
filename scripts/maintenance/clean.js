// [INTERNAL MAINTENANCE ONLY]
// Requires local .env
// MUST NOT be run in production without founder approval
const fs = require('fs');
let c = fs.readFileSync('.env.local', 'utf8');
const lines = c.split('\n').filter(line => {
  if (line.trim().startsWith('UPSTASH_REDIS_REST_URL=" https')) return false;
  if (line.trim().startsWith('UPSTASH_REDIS_REST_TOKEN=gQAAAAAAAefSAAIgcDFkMzhiNGEwNWFiMWI0Yjg5YTI3MjlhY2IwYjM0MTFjYQ"')) return false;
  return true;
});
fs.writeFileSync('.env.local', lines.join('\n'));
