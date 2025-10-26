# Security Headers Implementation Plan

**Date:** October 26, 2025  
**Priority:** Critical (Missing security feature documented as implemented)  
**Estimated Time:** 3-5 hours  
**Status:** Ready for implementation  

---

## 🎯 Objective

Implement comprehensive security headers in the Cloudflare Worker to protect against XSS, clickjacking, MIME sniffing, and other web vulnerabilities. This addresses the critical gap identified in our security verification where headers were documented as implemented but found to be completely missing.

---

## 📋 Implementation Steps

### Step 1: Create Security Headers Helper Module (5 minutes)

**File:** `worker/mute-mouse-2cd2/src/security.ts`

```typescript
/**
 * Security headers for all responses
 */
export const SECURITY_HEADERS = {
  // Content Security Policy - prevents XSS
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'", // Allow inline styles for dashboard
    "script-src 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Control referrer information
  'Referrer-Policy': 'no-referrer',
  
  // HTTPS enforcement (only in production)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Disable unnecessary features
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
};

/**
 * Add security headers to any Response
 */
export function addSecurityHeaders(response: Response): Response {
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
  
  // Add all security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    newResponse.headers.set(key, value);
  });
  
  return newResponse;
}

/**
 * Create a new Response with security headers
 */
export function secureResponse(body: any, init?: ResponseInit): Response {
  const response = new Response(body, init);
  return addSecurityHeaders(response);
}
```

**Command to create:**
```bash
cd worker/mute-mouse-2cd2/src
# Create the file with the content above
```

---

### Step 2: Update Main Worker File (20 minutes)

**File:** `worker/mute-mouse-2cd2/src/index.ts`

**2a. Add import at the top:**
```typescript
import { addSecurityHeaders, secureResponse } from "./security";
```

**2b. Add middleware for automatic header injection (add after app creation, before routes):**
```typescript
// Add security headers to all responses
app.use('*', async (c, next) => {
  await next();
  // Add security headers to all responses
  if (c.res) {
    const newResponse = addSecurityHeaders(c.res);
    c.res = newResponse;
  }
});
```

**2c. Update specific routes that need special handling:**

**Health check route (line ~30):**
```typescript
// BEFORE:
app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() })
);

// AFTER:
app.get("/health", (c) => {
  const response = c.json({ status: "ok", timestamp: new Date().toISOString() });
  return addSecurityHeaders(response);
});
```

**CSS route (line ~80):**
```typescript
// BEFORE:
app.get("/style.css", (c) =>
  c.text(STYLE_CSS, 200, { "Content-Type": "text/css; charset=utf-8" })
);

// AFTER:
app.get("/style.css", (c) => {
  return secureResponse(STYLE_CSS, {
    status: 200,
    headers: { "Content-Type": "text/css; charset=utf-8" }
  });
});
```

**Favicon route (line ~85):**
```typescript
// BEFORE:
app.get("/favicon.ico", (c) => {
  const binaryString = atob(FAVICON_ICO_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return c.body(bytes, 200, {
    "Content-Type": "image/x-icon",
    "Cache-Control": "public, max-age=86400"
  });
});

// AFTER:
app.get("/favicon.ico", (c) => {
  const binaryString = atob(FAVICON_ICO_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return secureResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "image/x-icon",
      "Cache-Control": "public, max-age=86400"
    }
  });
});
```

**Icon routes (lines ~95-105):**
```typescript
// BEFORE:
app.get("/icons/owlHeadA_180.png", (c) =>
  c.body(Uint8Array.from(atob(OWL_ICON_180_BASE64), c => c.charCodeAt(0)), 200, {
    "Content-Type": "image/png"
  })
);

// AFTER:
app.get("/icons/owlHeadA_180.png", (c) => {
  return secureResponse(
    Uint8Array.from(atob(OWL_ICON_180_BASE64), c => c.charCodeAt(0)), 
    {
      status: 200,
      headers: { "Content-Type": "image/png" }
    }
  );
});
```

**Web manifest route (line ~115):**
```typescript
// BEFORE:
app.get("/site.webmanifest", (c) =>
  c.text(MANIFEST_JSON, 200, { "Content-Type": "application/manifest+json; charset=utf-8" })
);

// AFTER:
app.get("/site.webmanifest", (c) => {
  return secureResponse(MANIFEST_JSON, {
    status: 200,
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" }
  });
});
```

---

### Step 3: Backup Original File (1 minute)

```bash
cp worker/mute-mouse-2cd2/src/index.ts worker/mute-mouse-2cd2/src/index.ts.backup
```

---

### Step 4: Validate Endpoint Classes (60-90 minutes)

**Files to check:** `worker/mute-mouse-2cd2/src/endpoints/`
- `adminStats.ts`
- `createInvite.ts` 
- `createUser.ts`
- `deleteUser.ts`
- `getBlob.ts`
- `registerUser.ts`
- `serveDashboard.ts`
- `updateData.ts`

**What to verify:**
- Ensure endpoint classes don't manually set headers that conflict with security headers
- Check that JSON responses use `c.json()` (headers will be added by middleware)
- Verify custom responses don't override security headers

**Example check command:**
```bash
grep -r "headers" worker/mute-mouse-2cd2/src/endpoints/
```

---

### Step 5: Local Testing (30-60 minutes)

**5a. Start local development server:**
```bash
cd worker/mute-mouse-2cd2
npm exec wrangler -- dev --port 38472 --local
```

**5b. Run security header tests:**
```bash
# Test script is already created: worker/mute-mouse-2cd2/test-security-headers.sh
./worker/mute-mouse-2cd2/test-security-headers.sh
```

**5c. Manual testing:**
```bash
# Test health endpoint
curl -I http://localhost:38472/health

# Test dashboard endpoint  
curl -I http://localhost:38472/d/test123

# Test static assets
curl -I http://localhost:38472/style.css
curl -I http://localhost:38472/favicon.ico
```

**Expected headers in output:**
```
Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

---

### Step 6: Production Deployment (30 minutes)

**6a. Deploy to Cloudflare:**
```bash
cd worker/mute-mouse-2cd2
wrangler deploy
```

**6b. Test production headers:**
```bash
# Replace with your actual worker URL
WORKER_URL="https://your-worker.workers.dev"

curl -I $WORKER_URL/health
curl -I $WORKER_URL/style.css
```

**6c. Verify dashboard functionality:**
- Register a test user
- Access dashboard with real passphrase
- Confirm decryption and display work correctly
- Check browser dev tools for security headers

---

## 🛡️ Security Headers Explained

| Header | Purpose | Value |
|--------|---------|--------|
| **Content-Security-Policy** | Prevents XSS attacks by controlling resource loading | Restricts to 'self' with specific exceptions for dashboard |
| **X-Frame-Options** | Prevents clickjacking | DENY - blocks all framing |
| **X-Content-Type-Options** | Prevents MIME sniffing attacks | nosniff - browsers respect declared content type |
| **Referrer-Policy** | Controls referrer information leakage | no-referrer - no referrer sent |
| **Strict-Transport-Security** | Enforces HTTPS connections | 1 year max-age with subdomains |
| **Permissions-Policy** | Disables unnecessary browser features | Blocks camera, microphone, geolocation, payment |

---

## ✅ Validation Checklist

### Pre-Deployment Testing
- [ ] `security.ts` module created successfully
- [ ] `index.ts` updated with imports and middleware
- [ ] All static routes updated to use `secureResponse()`
- [ ] Local wrangler dev server starts without errors
- [ ] Security header test script passes
- [ ] Manual curl tests show all expected headers
- [ ] Dashboard loads and functions correctly in browser
- [ ] No console errors in browser dev tools

### Post-Deployment Validation
- [ ] Production deployment successful
- [ ] Production endpoints return security headers
- [ ] Dashboard functionality unaffected
- [ ] User registration/login flow works
- [ ] Data encryption/decryption works
- [ ] No breaking changes for existing users

### Security Verification
- [ ] CSP header blocks unauthorized resources
- [ ] X-Frame-Options prevents iframe embedding
- [ ] HSTS header enforces HTTPS
- [ ] No sensitive data leaked in headers
- [ ] All endpoints protected with headers

---

## 🚨 Rollback Plan

If issues occur during deployment:

**1. Immediate rollback:**
```bash
cd worker/mute-mouse-2cd2
cp src/index.ts.backup src/index.ts
wrangler deploy
```

**2. Remove security module:**
```bash
rm src/security.ts
```

**3. Verify rollback:**
```bash
curl -I https://your-worker.workers.dev/health
# Should not show security headers
```

---

## 📝 Notes

- **CSP 'unsafe-inline' for styles:** Required for dashboard CSS to work correctly
- **HSTS header:** Only effective in production HTTPS environment
- **Middleware approach:** Ensures all responses get headers automatically
- **Backward compatibility:** No breaking changes to existing functionality
- **Performance impact:** Minimal - headers add ~500 bytes per response

---

## 🔄 Next Steps After Implementation

1. **Update documentation:** Remove "planned enhancement" status for security headers
2. **Security audit:** Run comprehensive security scan with headers enabled
3. **Monitor logs:** Check for any CSP violations or header conflicts
4. **User testing:** Confirm no functionality regressions for existing users
5. **Consider:** Additional security headers like `Cross-Origin-*` policies if needed

---

## 📞 Support

If you encounter issues during implementation:

1. Check browser dev tools console for CSP violations
2. Verify wrangler CLI is up to date: `npm update -g wrangler`
3. Test locally before production deployment
4. Use backup file to rollback if needed

**Estimated Total Time:** 3-5 hours including testing and deployment
**Risk Level:** Low (non-breaking enhancement with rollback plan)
**Impact:** High (closes critical security gap for all users)