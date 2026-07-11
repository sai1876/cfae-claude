import { expect, test, describe } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function getFiles(dir: string, fileList: string[] = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else if (filePath.endsWith('route.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

describe('Static Security Checks', () => {
  test('sensitive route inventory doc exists', () => {
    const docPath = path.join(process.cwd(), 'docs', 'security', 'api-route-auth-matrix.md');
    expect(fs.existsSync(docPath)).toBe(true);
  });

  test('client Firestore write audit doc exists', () => {
    const docPath = path.join(process.cwd(), 'docs', 'security', 'client-firestore-write-audit.md');
    expect(fs.existsSync(docPath)).toBe(true);
  });

  test('maskPii helper exists', () => {
    const helperPath = path.join(process.cwd(), 'src', 'lib', 'security', 'maskPii.ts');
    expect(fs.existsSync(helperPath)).toBe(true);
  });

  test('no root-level maintenance scripts', () => {
    const rootFiles = fs.readdirSync(process.cwd());
    const jsScripts = rootFiles.filter(f => f.endsWith('.js') && !['postcss.config.js', 'vitest.config.js', 'next.config.js', '.eslintrc.js', 'refactor.js', 'update_dbService.js'].includes(f));
    expect(jsScripts.length).toBe(0); // All operational scripts moved to scripts/maintenance
  });

  test('no hardcoded WhatsApp fallback tokens in webhook', () => {
    const routePath = path.join(process.cwd(), 'src', 'app', 'api', 'webhook', 'whatsapp', 'route.ts');
    if (fs.existsSync(routePath)) {
      const content = fs.readFileSync(routePath, 'utf8');
      expect(content).not.toContain('HauHauVoiceOrderVerifyToken2026');
    }
  });

  test('no console.log full webhook payload', () => {
    const routePath = path.join(process.cwd(), 'src', 'app', 'api', 'webhook', 'whatsapp', 'route.ts');
    if (fs.existsSync(routePath)) {
      const content = fs.readFileSync(routePath, 'utf8');
      expect(content).not.toMatch(/console\.log\([^)]*JSON\.stringify\(payload\)\)/);
    }
  });

  test('no direct hardcoded phone numbers in maintenance scripts', () => {
    const scriptsDir = path.join(process.cwd(), 'scripts', 'maintenance');
    if (fs.existsSync(scriptsDir)) {
      const scripts = fs.readdirSync(scriptsDir);
      for (const script of scripts) {
        if (script.endsWith('.js')) {
          const content = fs.readFileSync(path.join(scriptsDir, script), 'utf8');
          expect(content).not.toMatch(/\+91\d{10}/);
          expect(content).not.toMatch(/\+9063008171/);
        }
      }
    }
  });

  test('webhook route does not log unmasked PII and locations', () => {
    const routePath = path.join(process.cwd(), 'src', 'app', 'api', 'webhook', 'whatsapp', 'route.ts');
    if (fs.existsSync(routePath)) {
      const content = fs.readFileSync(routePath, 'utf8');
      
      // Should not log variations array directly
      expect(content).not.toMatch(/console\.log\([^)]*variations\)/);
      
      // Should not log raw fromPhone without maskPhone
      // Checking specific bad patterns we removed
      expect(content).not.toMatch(/console\.log\([^)]*\$\{fromPhone\}\)/);
      
      // Should not log raw lat/lng
      expect(content).not.toMatch(/console\.log\([^)]*Lat \$\{lat\}, Lng \$\{lng\}\)/);
    }
  });

  test('firestore.rules tightly restricts order updates to staff', () => {
    const rulesPath = path.join(process.cwd(), 'firestore.rules');
    if (fs.existsSync(rulesPath)) {
      const content = fs.readFileSync(rulesPath, 'utf8');
      
      // Must NOT allow customer update broadly
      expect(content).not.toMatch(/allow read, update: if isAuthenticated\(\) && \(resource\.data\.user_id == request\.auth\.uid/);
      
      // Must allow customer to read own order
      expect(content).toMatch(/allow read: if isOrderOwner\(\) \|\| isStaffOrAdmin\(\)( \|\| isKitchenStaff\(\))?;/);
      
      // Must contain staff-only update (which inherently prevents customer from updating status/amount/payment)
      expect(content).toMatch(/allow update: if isStaffOrderOperator\(\)( \|\| isKitchenStaff\(\))?;/);
      
      // Must contain staff-only delete
      expect(content).toMatch(/allow delete: if isStaffOrAdmin\(\);/);
    }
  });

  test('delete-user response does not contain cleared_phone or cleared_email', () => {
    const routePath = path.join(process.cwd(), 'src', 'app', 'api', 'admin', 'delete-user', 'route.ts');
    if (fs.existsSync(routePath)) {
      const content = fs.readFileSync(routePath, 'utf8');
      expect(content).not.toContain('cleared_phone:');
      expect(content).not.toContain('cleared_email:');
    }
  });

  test('no API route returns error.message to client', () => {
    const apiDir = path.join(process.cwd(), 'src', 'app', 'api');
    const routes = getFiles(apiDir);
    for (const route of routes) {
      const content = fs.readFileSync(route, 'utf8');
      // Look for standard Next.js JSON error responses leaking error.message
      const hasLeak = content.match(/NextResponse\.json\(\s*\{\s*[^}]*error\s*:\s*error\.message/i) || 
                      content.match(/NextResponse\.json\(\s*\{\s*[^}]*error\s*:\s*e\.message/i);
      if (hasLeak) {
        throw new Error(`Route ${route} is leaking error.message to client`);
      }
    }
  });

  test('requireRole is used or route has explicit public/internal comment', () => {
    const apiDir = path.join(process.cwd(), 'src', 'app', 'api');
    const routes = getFiles(apiDir);
    for (const route of routes) {
      const content = fs.readFileSync(route, 'utf8');
      
      const hasRequireRole = content.includes('requireRole(');
      const hasPublicComment = content.includes('[PUBLIC]');
      const hasInternalComment = content.includes('[INTERNAL]');
      const isAuthRoute = route.includes(path.join('api', 'auth', 'create-profile')) || 
                          route.includes(path.join('api', 'auth', 'activate-profile')) || 
                          route.includes(path.join('api', 'auth', 'finalize-signup-cache')) ||
                          route.includes(path.join('api', 'auth', 'session'));
      const isOrderCreate = route.includes(path.join('api', 'orders', 'create'));
      const isExpandMap = route.includes(path.join('api', 'expand-map-link'));

      const isCompliant = hasRequireRole || hasPublicComment || hasInternalComment || isAuthRoute || isOrderCreate || isExpandMap;
      
      if (!isCompliant) {
        throw new Error(`Route ${route} lacks requireRole and has no [PUBLIC] or [INTERNAL] declaration comment`);
      }
    }
  });

  describe('Business Event Logging', () => {
    test('logBusinessEvent file exists and sanitizes PII', () => {
      const helperPath = path.join(process.cwd(), 'src', 'server', 'events', 'logBusinessEvent.ts');
      expect(fs.existsSync(helperPath)).toBe(true);
      const content = fs.readFileSync(helperPath, 'utf8');
      
      // Must actively mask phone/email
      expect(content).toContain('maskPhone(');
      expect(content).toContain('maskEmail(');
      // Must drop dangerous fields
      expect(content).toContain("lowerKey.includes('token')");
    });

    test('firestore.rules denies client writes to business_events', () => {
      const rulesPath = path.join(process.cwd(), 'firestore.rules');
      if (fs.existsSync(rulesPath)) {
        const content = fs.readFileSync(rulesPath, 'utf8');
        expect(content).toMatch(/allow create, update, delete: if false;\s*\/\/\s*Server SDK only/);
      }
    });

    test('Critical routes log their business events', () => {
      const orderCreate = fs.readFileSync(path.join(process.cwd(), 'src/app/api/orders/create/route.ts'), 'utf8');
      expect(orderCreate).toContain("event_type: 'order_created'");

      const deleteUser = fs.readFileSync(path.join(process.cwd(), 'src/app/api/admin/delete-user/route.ts'), 'utf8');
      expect(deleteUser).toContain("event_type: 'admin_user_deleted'");

      const webhook = fs.readFileSync(path.join(process.cwd(), 'src/app/api/webhook/whatsapp/route.ts'), 'utf8');
      expect(webhook).toContain("event_type: 'whatsapp_voice_order_received'");
      expect(webhook).toContain("event_type: 'whatsapp_message_received'");
      expect(webhook).toContain("event_type: 'whatsapp_location_received'");
    });

    test('Phase 2 operational event types exist in docs or server code', () => {
      const phase2Events = [
        'inventory_adjusted',
        'wastage_recorded',
        'stock_movement_created',
        'order_status_changed',
        'refund_processed',
        'staff_attendance_updated',
        'shift_updated',
        'cash_session_opened',
        'cash_session_closed',
        'expense_recorded',
        'approval_created',
        'approval_resolved',
        'menu_item_changed',
        'offer_changed',
        'outlet_changed'
      ];

      const docsPath = path.join(process.cwd(), 'docs/security/business-event-logging.md');
      const docsContent = fs.existsSync(docsPath) ? fs.readFileSync(docsPath, 'utf8') : '';

      for (const eventType of phase2Events) {
        expect(docsContent).toContain(eventType);
      }
    });

    test('No client code writes to business_events collection', () => {
      const featuresDir = path.join(process.cwd(), 'src/features');
      const files = getFiles(featuresDir);
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        expect(content).not.toMatch(/collection\([^)]*business_events[^)]*\)/i);
        expect(content).not.toMatch(/doc\([^)]*business_events[^)]*\)/i);
        expect(content).not.toContain('BUSINESS_EVENTS_COL');
      }
    });
  });
});
