# Changelog
All notable changes to this project will be documented in this file.

The format loosely follows Keep a Changelog and uses semantic version hints (pre-1.0: minor may include breaking changes).

## [0.1.1] - 2025-09-02
### Added
- `docker-entrypoint.sh` enabling non-root execution and dynamic docker socket group access.
- HEALTHCHECK in Dockerfile.

### Changed
- README restructured to promote docker-compose as the primary path.
- Clarified restart policy options (`always` vs `unless-stopped`).
- Expanded Docker and security notes (non-root user, socket implications).
- Port selection guidance emphasized earlier in Quick Start.

### Fixed
- Inconsistent ordering between local / container instructions.
- Minor wording inconsistencies in Quick Start.

## [0.1.0] - 2025-09-02
Initial public baseline (un-tagged textual reference).
- Basic static server + status updater + manual writer scripts.
- Initial Dockerfile and helper scripts.