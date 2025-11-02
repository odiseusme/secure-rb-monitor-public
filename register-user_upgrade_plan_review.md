Filename: register-user_upgrade_plan_review.md

Contents:
### Review: register-user.sh Upgrade Plan (Right-Sized Corrections and Enhancements)

Last reviewed: 2025-10-31

Audience: Maintainer/Reviewer
Scope: Keep the script simple, portable, and aligned with RBMonitor’s security and UX goals without overkill.

1) Overall assessment
- Strengths:
  - Clear goals: eliminate silent failures, pre-validate passphrases, add generation path, and offer a “Start monitoring now?” step.
  - Minimal dependencies and good operator ergonomics.
  - Sensible proposal to avoid policy drift (single source of truth via Node helper).
- Risks:
  - Potential logic drift if two validators exist (shell fallback vs Node helper).
  - Overprompting can annoy CI and automation if defaults aren’t carefully chosen.
  - Clipboard helpers, if added, can introduce platform variance.

Verdict: The plan is solid and appropriately scoped. With a few targeted corrections and clarifications below, it can be shipped as a small, high-impact improvement.

2) Priority corrections
- Make Node helper the only policy source (no duplicated logic)
  - Mandate the Node helper (scripts/passphrase-validate.js) as the single validator.
  - Shell fallback should be “fail closed” with a crisp message telling the user to install Node or run with --generated and accept policy risks in dev only.
  - Rationale: Security policy drift is the top class of bug here; avoid dual implementations.

- Align passphrase minimum with RBMonitor docs
  - RBMonitor currently documents 8-character minimum. Your plan proposes >= 16 with 3-of-4 classes. Since this script runs on operator machines and targets “secure but not Fort Knox,” aim for:
    - Default policy: >= 12 chars, at least 3-of-4 classes, no whitespace.
    - Keep uploader and UI hints consistent (RBMonitor docs mention raising PBKDF2 and recommending 12+ chars without breaking older data).
  - If the uploader currently enforces a different rule, adopt the uploader’s rule verbatim and reflect that in user-facing help text.

- Consistent non-interactive behavior
  - Ensure --generated implies non-interactive acceptance (no hidden prompts).
  - Add --passphrase-file <path> to read passphrase from a file for CI secrets.
  - Exit codes should be deterministic in non-TTY contexts.

3) Right-sized enhancements (keep or adopt)
- Flags and defaults
  - --no-start: keep (useful in automation).
  - --generated: keep; make it non-interactive and success-only if validation passes.
  - --show-policy: keep; content should be emitted from the Node helper to guarantee consistency.
  - Add --passphrase-file <path>: optional but valuable for CI and reproducibility.

- Passphrase generator
  - Keep OpenSSL-based generator. Ensure it always satisfies validator classes to prevent “generate → reject” loops.
  - Display once clearly with SAVE THIS NOW guidance. Do not auto-copy; instead, offer “Copy to clipboard?” only if xclip or wl-copy is present and user opts in. Default: no.

- Error UX and exit codes
  - Never silent-exit on mismatch; loop with a bounded retry (e.g., 5 attempts), then exit 2 with a helpful message.
  - Registration failures: exit 3 and show the last response snippet (redacted).
  - Missing prerequisites (node/openssl/monitor_control.sh): exit 4 with install hint or path hint.

- Start monitoring prompt
  - Keep “Start monitoring now? [Y/n]”.
  - If user says yes, call ./scripts/monitor_control.sh start and:
    - On success: show the dashboard URL and “uploader running” note.
    - On failure: print the exact recovery command and exit 3.

4) Security hygiene alignment with project roadmap
- No secrets in logs
  - Ensure the script never echoes the passphrase back except in the explicit “generated” path where showing once is intentional.
  - Mask passphrases in error output, environment export, or subprocess logs.

- Encourage better passphrases without breakage
  - Keep minimum consistent with uploader policy.
  - In help output, recommend 12+ characters even if uploader minimum is 8 to nudge users.

- Future-proofing without overkill
  - If you later adopt Trusted Types or tighter CSP, nothing in this script needs to change. Just keep the help/README aligned.

5) Minimal code sketches (safe to drop in)
- Node helper as single source of truth
```javascript
#!/usr/bin/env node
// scripts/passphrase-validate.js
// Exit 0 if valid, 1 if invalid with reason to stderr.
// IMPORTANT: import or literally reuse uploader's validator to avoid drift.
const pass = process.argv[2] ?? '';
// Replace this function by importing your uploader validator:
function validate(p) {
  const reasons = [];
  if (p.length < 12) reasons.push('length < 12');
  if (/\s/.test(p)) reasons.push('contains whitespace');
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/]
    .reduce((n, re) => n + (re.test(p) ? 1 : 0), 0);
  if (classes < 3) reasons.push('needs 3 of: lower/upper/digit/symbol');
  return { ok: reasons.length === 0, reasons };
}
const { ok, reasons } = validate(pass);
if (!ok) {
  console.error('Invalid passphrase:', reasons.join(', '));
  process.exit(1);
}
process.exit(0);
```

- Shell generator and validation invocation
```bash
gen_pw() {
  local p
  if command -v openssl >/dev/null 2>&1; then
    p="$(openssl rand -base64 24 2>/dev/null | tr -d '\n' | sed 's/=//g')"
  else
    # Poorer fallback; prompt to install openssl
    p="$(head -c 24 /dev/urandom | base64 | tr -d '\n' | sed 's/=//g')"
  fi
  [[ "$p" =~ [0-9] ]] || p="${p}7"
  [[ "$p" =~ [A-Z] ]] || p="${p}A"
  [[ "$p" =~ [^A-Za-z0-9] ]] || p="${p}#"
  echo "$p"
}

validate_pw() {
  if command -v node >/dev/null 2>&1 && [[ -f scripts/passphrase-validate.js ]]; then
    node scripts/passphrase-validate.js "$1"
    return $?
  fi
  echo "Passphrase policy validator unavailable (Node/helper missing)." >&2
  echo "Install Node.js or run with --generated (dev only), or provide --passphrase-file." >&2
  return 1
}
```

- Non-interactive inputs
```bash
# Parse --passphrase-file and --generated first
if [[ -n "$PASSPHRASE_FILE" ]]; then
  PASS="$(cat "$PASSPHRASE_FILE")"
elif [[ "$FORCE_GENERATED" == "1" ]]; then
  PASS="$(gen_pw)"
else
  # interactive prompts...
fi

if ! validate_pw "$PASS"; then
  echo "Passphrase failed policy. Aborting." >&2
  exit 2
fi
```

6) Documentation deltas (concise)
- README/register section
  - Document new flags: --no-start, --generated, --passphrase-file, --show-policy.
  - Add one block showing non-interactive CI usage:
    - Example: `./scripts/register-user.sh --generated --no-start`
    - Example: `./scripts/register-user.sh --passphrase-file ./secret.txt --no-start`
  - State policy once, and mention “exact validator shared with uploader.”

7) Testing checklist (lean)
- Interactive mismatch loops (bounded retries).
- Generated passphrase always validates.
- --generated and --passphrase-file paths are non-interactive and stable.
- Missing Node/helper causes clean exit 1 with guidance; does not proceed.
- Start monitoring success/failure paths show correct commands.

8) What to defer (avoid overkill)
- Clipboard auto-copy as default: keep opt-in or defer.
- Fancy strength meters or zxcvbn-like libs: not needed in shell.
- Complex entropy checks or online breach lookups: out of scope for an offline CLI.
- Telemetry or logging of inputs: do not add.

9) Acceptance criteria (updated)
- Single source of truth validator via Node helper; no parallel Bash policy.
- Consistent minimum and classes with the uploader; help text matches.
- Non-interactive flags behave deterministically (CI-friendly).
- Never echo secrets except the one-time generated output, clearly warned.
- Start prompt works and failures provide actionable commands.


