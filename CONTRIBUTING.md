# Contributing Guide

Thank you for considering contributing!

## Workflow Overview
1. Fork or create a feature branch off `main`
2. Keep changes focused; small, reviewable PRs
3. Run local lint / build before committing
4. Open a Pull Request with a clear description & rationale

## Branch Naming
Format: `topic/short-description`
Examples:
- `feat/token-cache`
- `fix/port-collision`
- `docs/architecture-overview`

## Commit Message Style
Conventional-ish (not enforced yet):
- `feat: add balance aggregation`
- `fix: handle missing token decimals`
- `docs: clarify config bootstrap`

## Code Style
- Use existing patterns (prefer async/await)
- Avoid large refactors in unrelated PRs
- Add inline comments for non-obvious logic

## Testing
(Placeholder – future test harness TBD)
If adding complex logic, describe manual test steps in the PR.

## Security / Secrets
- Never commit real keys or sensitive endpoints
- If you suspect a leak, follow SECURITY.md

## Opening Issues
Include:
- Context / intention
- Steps to reproduce (if a bug)
- Proposed direction (if enhancement)
- Performance / security considerations (if any)

## Reviewing PRs
Reviewers should check:
- Scope & clarity
- No secrets / credentials
- Reasonable logging & error handling
- Docs updated (README / QUICKSTART / comments)

## Roadmap Ideas (Track via Issues)
- Test harness
- Plugin architecture
- Observability metrics
- TypeScript migration

Welcome aboard!
