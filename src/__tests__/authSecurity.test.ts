import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Auth Security Static Checks', () => {
  it('login-by-phone route should exist', () => {
    const routePath = path.resolve(__dirname, '../app/api/auth/login-by-phone/route.ts');
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it('login route should not return raw email or phone', () => {
    const routePath = path.resolve(__dirname, '../app/api/auth/login-by-phone/route.ts');
    const content = fs.readFileSync(routePath, 'utf-8');
    
    // Check that we aren't returning email or phone or tokens in the success payload
    const successPayloadMatch = content.match(/return NextResponse\.json\(\{\s*success: true[\s\S]*?\}\);/);
    if (successPayloadMatch) {
      const payload = successPayloadMatch[0];
      expect(payload.includes('phone:')).toBe(false);
      expect(payload.includes('email:')).toBe(false);
      expect(payload.includes('emailAddress')).toBe(false);
      expect(payload.includes('refreshToken')).toBe(false);
      expect(payload.includes('idToken')).toBe(false);
    }
  });

  it('AuthWorkspace should use secure server route for phone login', () => {
    const authWorkspacePath = path.resolve(__dirname, '../components/auth/AuthWorkspace.tsx');
    const content = fs.readFileSync(authWorkspacePath, 'utf-8');
    
    expect(content.includes('/api/auth/login-by-phone')).toBe(true);
    
    // Extract handleLoginSubmit block to ensure it doesn't query client firestore
    const loginBlockMatch = content.match(/const handleLoginSubmit = async[\s\S]*?catch/);
    if (loginBlockMatch) {
      expect(loginBlockMatch[0].includes('getUserProfileByPhone')).toBe(false);
      expect(loginBlockMatch[0].includes('signInWithEmailAndPassword')).toBe(false);
      // Ensure we don't try to read phone from the server response
      expect(loginBlockMatch[0].includes('data.user_profile.phone')).toBe(false);
    }
  });

  it('AuthWorkspace should use secure login route and avoid client-side auth', () => {
    const authWorkspacePath = path.join(__dirname, '../components/auth/AuthWorkspace.tsx');
    const content = fs.readFileSync(authWorkspacePath, 'utf-8');

    // Must use login-by-phone route for normal login
    expect(content.includes("fetch('/api/auth/login-by-phone'")).toBe(true);
    
    // Must use passwordless-login route for whatsapp login
    expect(content.includes("fetch('/api/auth/passwordless-login'")).toBe(true);
    
    // Must contain fallback button behavior using window.open
    expect(content.includes("if (whatsappUrl) window.open(whatsappUrl")).toBe(true);
    
    // Must NOT use window.location.href directly on the data object in fallback (forces same-tab)
    expect(content.includes("window.location.href = data.whatsapp_url")).toBe(false);

    // Must initiate popup blocking via early window.open
    expect(content.includes("window.open('about:blank', '_blank')")).toBe(true);
    
    // Must NOT contain client-side profile fetch for login
    expect(content.includes('getUserProfileByPhone(phone)')).toBe(false);
    
    // Must NOT contain direct firebase client sign-in
    expect(content.includes('signInWithEmailAndPassword(auth, emailAddress, password)')).toBe(false);
    
    // Must NOT read phone from user profile directly
    expect(content.includes('data.user_profile.phone')).toBe(false);
  });

  it('login-by-phone route should exist and not leak PII', () => {
    const routePath = path.join(__dirname, '../app/api/auth/login-by-phone/route.ts');
    expect(fs.existsSync(routePath)).toBe(true);

    const content = fs.readFileSync(routePath, 'utf-8');
    
    // Ensure success payload does not return PII
    const successPayloadStr = content.split('return NextResponse.json({')[1];
    expect(successPayloadStr).toBeDefined();
    
    // Test the first 200 characters of the success payload to ensure no PII fields are mapped
    const successBlock = successPayloadStr.substring(0, 300);
    expect(successBlock.includes('phone:')).toBe(false);
    expect(successBlock.includes('email:')).toBe(false);
    expect(successBlock.includes('idToken')).toBe(false);
    expect(successBlock.includes('refreshToken')).toBe(false);
  });

  it('passwordless-login route should exist, not leak PII, and generate clean wa.me URLs', () => {
    const routePath = path.join(__dirname, '../app/api/auth/passwordless-login/route.ts');
    expect(fs.existsSync(routePath)).toBe(true);

    const content = fs.readFileSync(routePath, 'utf-8');
    
    // Ensure success payload does not return PII
    const successPayloadStr = content.split('return NextResponse.json({')[1];
    expect(successPayloadStr).toBeDefined();
    
    const successBlock = successPayloadStr.substring(0, 300);
    expect(successBlock.includes('phone:')).toBe(false);
    expect(successBlock.includes('email:')).toBe(false);
    expect(successBlock.includes('idToken')).toBe(false);
    expect(successBlock.includes('refreshToken')).toBe(false);

    // Verify WhatsApp URL generation rules
    expect(content.includes('wa.me/')).toBe(true);
    expect(content.includes('api.whatsapp.com/resolve')).toBe(false);
    expect(content.includes('replace(/\\D/g')).toBe(true);
    expect(content.includes('encodeURIComponent(redirectText)')).toBe(true);
    expect(content.includes('LOGIN Ref: ${token}')).toBe(true);
  });

  it('firestore.rules should block unauthenticated user reads and deny client business_events writes', () => {
    const rulesPath = path.resolve(__dirname, '../../firestore.rules');
    if (fs.existsSync(rulesPath)) {
      const content = fs.readFileSync(rulesPath, 'utf-8');
      
      const usersMatchBlock = content.split('match /users/{userId}')[1]?.split('match')[0] || '';
      expect(usersMatchBlock).toContain('isAuthenticated()');
      
      const eventsMatchBlock = content.split('match /business_events')[1]?.split('match')[0] || '';
      expect(eventsMatchBlock).toContain('allow create, update, delete: if false');
    }
  });

  it('auth_engine.py hardens token consumption and does not leak PII', () => {
    const routePath = path.resolve(__dirname, '../../auth_engine.py');
    expect(fs.existsSync(routePath)).toBe(true);

    const content = fs.readFileSync(routePath, 'utf-8');
    
    // Check token length is 32 uppercase hex
    expect(content.includes('secrets.token_hex(16).upper()')).toBe(true);
    
    // Check validation of 32 hex chars before DB lookup
    expect(content.includes('re.match(r"^[A-F0-9]{32}$", token)')).toBe(true);
    
    // Check reservation transaction
    expect(content.includes('@firestore.transactional')).toBe(true);
    expect(content.includes('reserve_token')).toBe(true);
    expect(content.includes('"consume_state": "consuming"')).toBe(true);
    
    // Extract the block for passwordless_login purpose
    const passwordlessBlock = content.split('if purpose == "passwordless_login":')[1].split('else:')[0];
    
    // Check 8-char rejection
    expect(passwordlessBlock.includes('len(token) != 32')).toBe(true);
    expect(passwordlessBlock.includes('Legacy 8-character tokens are not supported')).toBe(true);
    
    // Ensure custom token is created BEFORE updating 'used'
    const tokenIndex = passwordlessBlock.indexOf('auth.create_custom_token(uid)');
    const updateIndex = passwordlessBlock.indexOf('"consume_state": "consumed"');
    
    expect(tokenIndex).toBeGreaterThan(0);
    expect(updateIndex).toBeGreaterThan(tokenIndex); // Update must happen after custom token generation
    
    // Ensure PII is not leaked in the response profile
    const profileBlock = passwordlessBlock.split('response["user_profile"] = {')[1].split('}')[0];
    expect(profileBlock.includes('"phone":')).toBe(false);
    expect(profileBlock.includes('"email":')).toBe(false);
  });
  
  it('Next.js poll-status logs events securely and rejects 8-char token', () => {
    const routePath = path.resolve(__dirname, '../app/api/auth/poll-status/[token]/route.ts');
    expect(fs.existsSync(routePath)).toBe(true);

    const content = fs.readFileSync(routePath, 'utf-8');
    
    // Reject 8 char
    expect(content.includes('token.length !== 32')).toBe(true);
    expect(content.includes('Legacy 8-character tokens are not supported')).toBe(true);
    
    // Business events
    expect(content.includes('passwordless_login_consumed')).toBe(true);
    expect(content.includes('suspicious_activity_detected')).toBe(true);
    expect(content.includes('passwordless_login_consume_failed')).toBe(true);
    
    // Mask token
    expect(content.includes('token.substring(0, 4) + "****"')).toBe(false); // Because it uses template string
    expect(content.includes('${token.substring(0, 4)}****')).toBe(true);
  });
  
  it('webhook verifies sender match and redacts PII', () => {
    const routePath = path.resolve(__dirname, '../app/api/webhook/whatsapp/route.ts');
    expect(fs.existsSync(routePath)).toBe(true);

    const content = fs.readFileSync(routePath, 'utf-8');
    
    // Check webhook rejects mismatch before verifying
    expect(content.includes('passwordless_login_failed')).toBe(true);
    expect(content.includes('reason: "sender_mismatch"')).toBe(true);
    
    // Check token masking in logs
    expect(content.includes('token.substring(0, 4)')).toBe(true);
    
    // Check event types
    expect(content.includes('passwordless_login_verified')).toBe(true);
  });
  
  it('passwordless-login route generates strong token and does not store raw phone', () => {
    const routePath = path.resolve(__dirname, '../app/api/auth/passwordless-login/route.ts');
    expect(fs.existsSync(routePath)).toBe(true);

    const content = fs.readFileSync(routePath, 'utf-8');
    
    // Ensure 32 hex generation
    expect(content.includes("crypto.randomBytes(16).toString('hex').toUpperCase()")).toBe(true);
    
    // Ensure raw phone is not stored in auth_handshakes
    const handshakeSetBlock = content.split("adminDb.collection('auth_handshakes').doc(token);")[1].split("});")[0];
    expect(handshakeSetBlock.includes('masked_phone: maskedPhone')).toBe(true);
    expect(handshakeSetBlock.includes('phone: phone')).toBe(false); // Shouldn't store raw phone
  });

  it('rateLimit notes Redis requirement', () => {
    const routePath = path.resolve(__dirname, '../lib/rateLimit.ts');
    expect(fs.existsSync(routePath)).toBe(true);
    const content = fs.readFileSync(routePath, 'utf-8');
    expect(content.includes('Redis')).toBe(true);
    expect(content.includes('NOT suitable for production')).toBe(true);
  });

  it('profile page handles missing userProfile.user_id and correctly queries ledger', () => {
    const profilePath = path.resolve(__dirname, '../app/(customer)/profile/page.tsx');
    expect(fs.existsSync(profilePath)).toBe(true);

    const content = fs.readFileSync(profilePath, 'utf-8');
    
    expect(content.includes('user?.uid || (userProfile as any)?.uid || userProfile?.user_id')).toBe(true);
    expect(content.includes('where(\'user_id\', \'==\', profileUserId)')).toBe(true);
    expect(content.includes('Hau Hau Rewards')).toBe(true);
    expect(content.includes('Oasis Rewards')).toBe(false);
  });
});
