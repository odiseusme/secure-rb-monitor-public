# RBMonitor Development Roadmap - REVISED (Genuine Gaps Only)

**Generated:** October 26, 2025  
**Status:** Post README review - removed already-implemented items  
**Focus:** Only genuine gaps and incremental improvements

---

## 🚨 URGENT - Missing Security Features (Documented but Not Implemented)

### Priority 1: Critical Implementation Gaps (Immediate Action Required)

| Task | Files | Time | Status | Description |
|------|-------|------|--------|-------------|
| **Implement security headers** | `worker/mute-mouse-2cd2/src/index.ts` | 3-5 hours | ❌ **MISSING** | NO security headers found despite README claims - implement CSP, X-Frame-Options, HSTS, X-Content-Type-Options |
| **Fix container user conflicts** | `Dockerfile`, docker configs | 2-2.5 hours | 🟡 **BROKEN** | Dockerfile has conflicting USER statements (monitor vs node) |
| **Disable passphrase storage default** | `setup-cloudflare.js`, `scripts/register-user.sh` | 30 min | ❌ **INSECURE** | Currently defaults to saving passphrase in .env - change to "n" |

**Subtotal: 5.5-8 hours**

### Priority 2: Verified Working Features (No Action Needed)

| Feature | Status | Verification |
|---------|--------|--------------|
| **Rate limiting** | ✅ **IMPLEMENTED** | 30 reads/hour per user, KV-based tracking confirmed |
| **PBKDF2 iterations** | ✅ **IMPLEMENTED** | 100,000 iterations verified in code |
| **Container capabilities** | ✅ **PARTIAL** | cap_drop: ALL, read_only: true confirmed |
| **Passphrase validation** | ✅ **IMPLEMENTED** | 8-character minimum enforced |

### Priority 3: Optional Enhancements (When Time Permits)

| Task | Files | Time | Description |
|------|-------|------|-------------|
| **Enhance rate limiting configuration** | `worker/mute-mouse-2cd2/src/config.ts` | 1-2 hours | Add explicit thresholds and Retry-After headers (current: 30/hour working) |
| **Logging hygiene audit** | `worker/mute-mouse-2cd2/src/` (all logging) | 1-2 hours | Review logs for any sensitive data leakage |
| **Strengthen passphrase recommendations** | `scripts/register-user.sh`, `public/dashboard.js`, `README.md` | 1 hour | Recommend 12+ chars (keep 8 minimum for compatibility) |

**Subtotal: 3-5 hours**

---

## 🔧 HIGH PRIORITY - Incremental Improvements

### Priority 3: Crypto and Authentication Enhancements (Day 2)

| Task | Files | Time | Description |
|------|-------|------|-------------|
| **PBKDF2 iteration increase** | `cloudflare-sync.js`, `public/dashboard.js` | 2-3 hours | 100k→300k iterations, versioned envelope, backward compatibility |
| **Strengthen passphrase recommendations** | `scripts/register-user.sh`, `public/dashboard.js`, `README.md` | 1 hour | Update guidance to recommend 12+ chars (keep 8 minimum for compatibility) |
| **Token rotation preparation** | `worker/mute-mouse-2cd2/src/` | 2-3 hours | Add metadata tracking for future rotation capability |

**Subtotal: 5-7 hours**

### Priority 4: Data Management Improvements

| Task | Files | Time | Description |
|------|-------|------|-------------|
| **KV namespace and TTL implementation** | `worker/mute-mouse-2cd2/src/` (KV ops) | 1-2 hours | Prefix keys clearly, set TTLs, prevent listing leaks |
| **User registration flow consistency** | `scripts/register-user.sh`, documentation | 1-2 hours | Resolve start-monitoring.sh vs monitor_control.sh guidance |

**Subtotal: 2-4 hours**

---

## 📚 MEDIUM PRIORITY - Documentation & UX Gaps

### Priority 5: Documentation Accuracy and User Safety

| Task | Files | Time | Description |
|------|-------|------|-------------|
| **Security quick start docs** | `README.md`, `SECURITY.md` (create) | 1 hour | Add security quick start box, clarify existing vs. new features |
| **Update feature claims accuracy** | `README.md`, project docs | 30 min | Ensure documented features match implementation reality |

**Subtotal: 1.5 hours**

---

## 🎯 LOWER PRIORITY - Optional Enhancements

### Priority 6: Registration Script Quality of Life

| Task | Files | Time | Description |
|------|-------|------|-------------|
| **Passphrase strength indicator** | `scripts/register-user.sh` | 1-2 hours | Optional strength meter with override capability |
| **Invite code format validation** | `scripts/register-user.sh` | 30 min | Client-side validation before server call |
| **Network retry logic** | `scripts/register-user.sh` | 1 hour | Exponential backoff for transient failures |
| **Verbose/debug mode** | `scripts/register-user.sh` | 30 min | --verbose flag for troubleshooting |

**Subtotal: 3-4 hours**

---

## 📊 REVISED SUMMARY BY URGENCY

### Immediate (Must Do - Genuine Security Gaps)
- **Total Time:** 5.5-8.5 hours
- **Focus:** Actual missing security features
- **Risk if delayed:** Real security vulnerabilities

### High Priority (Should Do - Incremental Improvements)
- **Total Time:** 7-11 hours  
- **Focus:** Enhance existing good foundations
- **Risk if delayed:** Missed optimization opportunities

### Medium Priority (Documentation Accuracy)
- **Total Time:** 1.5 hours
- **Focus:** Ensure claims match reality
- **Risk if delayed:** User confusion

### Lower Priority (Quality of Life)
- **Total Time:** 3-4 hours
- **Focus:** Nice-to-have enhancements
- **Risk if delayed:** Minimal

---

## 🔄 REVISED GROUPING RECOMMENDATIONS

### Cross-File Coordination Groups:

**Group A: Passphrase Policy Updates (Do Together)**
- Disable .env storage default
- Strengthen passphrase recommendations
- Update documentation
- **Reason:** Consistent passphrase policy across all touchpoints

**Group B: Worker Security Enhancements (Do Together)**
- Complete security headers
- Enhance rate limiting
- Audit logging hygiene
- **Reason:** Single Worker deployment, coordinated security improvements

**Group C: Crypto Policy Evolution (Do Together)**
- PBKDF2 iteration increase
- Token rotation preparation
- Clear error handling
- **Reason:** Coordinated crypto policy, maintain backward compatibility

---

## 📋 KEY CHANGES FROM ORIGINAL ROADMAP

### ❌ **REMOVED (Already Implemented):**
- Container security defaults (non-root, read-only, capabilities) ✅ **DONE**
- Basic rate limiting ✅ **DONE** 
- Basic security headers (CSP) ✅ **DONE**
- Passphrase minimum validation (8 chars) ✅ **DONE**
- Container hardening fundamentals ✅ **DONE**

### ✅ **KEPT (Genuine Gaps):**
- Passphrase storage default behavior
- Complete security header set
- PBKDF2 iteration increase
- Logging hygiene improvements
- Token rotation preparation

### 🔄 **REFINED (Incremental Improvements):**
- Rate limiting → Enhanced configuration
- Security headers → Complete implementation
- Passphrase rules → Better recommendations

---

## 📅 REALISTIC IMPLEMENTATION SCHEDULE

### Week 1 (Security Gaps)
- **Day 1:** Groups A + B (8.5 hours max, can parallelize)
- **Day 2:** Group C (5-7 hours)

### Week 2 (Polish & Documentation)
- **Day 1:** Documentation accuracy (1.5 hours)
- **Day 2-3:** Optional enhancements as time allows

**Total Realistic Completion:** 5-7 working days

---

*This revised roadmap focuses only on genuine gaps and improvements, acknowledging that RBMonitor already has excellent security foundations. The goal is incremental enhancement, not fundamental rebuilding.*