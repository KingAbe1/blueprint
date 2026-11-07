# Changelog

All notable changes to blueprint studio are documented here.

## [1.1.5] - 2026-11-07

### Added
- **Agent fix prompts**: turn scan findings into ready-to-paste prompts for your coding agent, or export them all as `FIXES.md`
- **Changed-files scope** for agent fixes: only uncommitted files, or only files changed on the current branch
- **Scan history** with a since-last-scan diff
- CVE scanning for **pnpm, yarn, and bun** lockfiles (not only npm)

### Fixed
- Deleted files no longer counted in the changed-files scope
- Stopped tracking `src-tauri/target/` build output in git, which bloated clones

## [1.1.4] - 2026-10-23

### Added
- Architecture map **Simple / Detailed** views (cache, edge, async jobs, gateway when relevant)
- Conditional map nodes from product decisions: domain modules, admins/operators, payments, realtime, search/media, secrets, analytics, and multi-region/DR
- Identity & access as a separate map node only when answers imply managed/external identity
- Soft gate so short product briefs nudge **Polish with AI** before build questions
- **Updates** in System settings: check GitHub Releases and open the download page
- `CHANGELOG.md`

### Fixed
- Architecture map nodes overlapping when the visible set grew (stale saved positions)
- Design decisions panel collapsed by default on the architecture map
- Overly permissive bullet-marker regex ranges flagged by code scanning

## [1.1.3] - prior

See GitHub Releases for earlier notes.
