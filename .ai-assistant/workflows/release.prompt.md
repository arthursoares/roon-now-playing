---
workflow: release
priority: high
---

# Workflow: Release

> **Purpose:** Prepare and publish a release with version bump, changelog, and tagging
> **Phases:** Prepare → Version → Validate → Tag → Notes
> **Command:** `/release [scope flags] [version]`
> **Scope:** See [scope.md](../scope.md)

## Scope Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview changes without committing or tagging |
| `--no-tag` | Skip git tag creation |
| `--no-push` | Create tag locally but don't push |
| `--prerelease=<id>` | Create prerelease (alpha, beta, rc) |

**Version argument:**
- `major` - Breaking changes (1.0.0 → 2.0.0)
- `minor` - New features (1.0.0 → 1.1.0)
- `patch` - Bug fixes (1.0.0 → 1.0.1)
- `X.Y.Z` - Explicit version number

**Examples:**
```bash
/release patch                    # Bug fix release
/release minor                    # Feature release
/release major                    # Breaking change release
/release 2.0.0-beta.1            # Explicit prerelease
/release --dry-run minor         # Preview minor release
/release --prerelease=rc minor   # Release candidate
```

## Task Composition

```
┌─────────────────────────────────────────────────────────────────┐
│ PREPARE PHASE (Explorer)                                        │
├─────────────────────────────────────────────────────────────────┤
│ release/check-status → release/gather-changes                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User confirms release scope
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ VERSION PHASE (Developer)                                       │
├─────────────────────────────────────────────────────────────────┤
│ release/bump-version → release/update-changelog                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User approves version changes
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ VALIDATE PHASE (Tester)                                         │
├─────────────────────────────────────────────────────────────────┤
│ verify/run-typecheck → verify/run-lint → test/run-tests         │
│                      → verify/run-build                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: All validations pass
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ DOCS PHASE (Developer) - OPTIONAL                                │
├─────────────────────────────────────────────────────────────────┤
│ docs/update-docs                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⏸️ OPTIONAL: User chooses to document
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ TAG PHASE (Committer)                                           │
├─────────────────────────────────────────────────────────────────┤
│ commit/create-commit → release/create-tag → release/push-tag    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ⛔ GATE: User confirms push
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ NOTES PHASE (Developer)                                         │
├─────────────────────────────────────────────────────────────────┤
│ release/generate-notes → release/create-github-release          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Prepare (Explorer)

**Chatmode:** 🔍 Explorer
**Tasks:** `release/check-status`, `release/gather-changes`

### Step 1.1: Check Release Readiness

```bash
# Get current state
CURRENT_BRANCH=$(git branch --show-current)
MAIN_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

# Check we're on main/release branch
git status --porcelain

# Get current version
cat package.json | grep '"version"'

# Get last tag
git describe --tags --abbrev=0 2>/dev/null || echo "No tags found"
```

**Display status:**

```markdown
## Release Status

| Check | Status |
|-------|--------|
| Branch | `main` ✓ / ⚠️ Not on main |
| Uncommitted changes | None ✓ / ⚠️ Has changes |
| Current version | `X.Y.Z` |
| Last tag | `vX.Y.Z` |
| Commits since tag | N |
```

**If not on main branch:**

```markdown
> **WARNING:**
> You are on branch `[branch]`, not `main`.
> Releases should typically be made from the main branch.
>
> **Continue anyway?** (yes / switch to main / abort)
```

**⏸️ Wait if on wrong branch.**

### Step 1.2: Gather Changes Since Last Release

```bash
# Get commits since last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null)
if [ -n "$LAST_TAG" ]; then
  git log ${LAST_TAG}..HEAD --oneline --no-merges
else
  git log --oneline --no-merges -20
fi
```

**Categorize changes:**

```markdown
## Changes Since Last Release

### Breaking Changes 💥
- [commit] description

### Features ✨
- [commit] description

### Bug Fixes 🐛
- [commit] description

### Other
- [commit] description

**Suggested version bump:** `[patch/minor/major]` based on changes above
```

### Step 1.3: Confirm Release Scope

```markdown
## Release Confirmation

**Current version:** `X.Y.Z`
**Requested bump:** `[patch/minor/major]`
**New version:** `X.Y.Z`

**Changes included:** N commits
- X breaking changes
- Y features
- Z bug fixes

**Proceed with release?** (yes / change version / abort)
```

**⛔ GATE: Do NOT proceed without explicit approval.**

---

## Phase 2: Version (Developer)

**Chatmode:** 👨‍💻 Developer
**Tasks:** `release/bump-version`, `release/update-changelog`

### Step 2.1: Bump Version

**Update package.json:**

```bash
# Using npm version (doesn't commit or tag)
npm version [major|minor|patch] --no-git-tag-version
```

**Or manually edit if npm version not appropriate.**

### Step 2.2: Update Changelog

**If CHANGELOG.md exists, update it:**

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Breaking Changes
- Description ([commit])

### Added
- Description ([commit])

### Fixed
- Description ([commit])

### Changed
- Description ([commit])
```

**If no CHANGELOG.md:**

```markdown
> **INFO:**
> No CHANGELOG.md found. Release notes will be generated from commits.
```

### Step 2.3: Review Version Changes

```markdown
## Version Changes

**Files modified:**
- `package.json` - version bumped to `X.Y.Z`
- `CHANGELOG.md` - added release entry (if exists)

**Preview:**
```diff
- "version": "1.0.0"
+ "version": "1.1.0"
```

**Approve version changes?** (yes / edit / abort)
```

**⛔ GATE: Do NOT proceed without approval.**

---

## Phase 3: Validate (Tester)

**Chatmode:** 🧪 Tester
**Tasks:** `verify/run-typecheck`, `verify/run-lint`, `test/run-tests`, `verify/run-build`

### Step 3.1: Run Full Validation

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Full test suite (releases need full coverage)
npm run test

# Build
npm run build
```

### Step 3.2: Report Validation Results

```markdown
## Validation Results

| Check | Status | Details |
|-------|--------|---------|
| Type check | ✓ Pass / ✗ Fail | [errors if any] |
| Lint | ✓ Pass / ✗ Fail | [errors if any] |
| Tests | ✓ Pass / ✗ Fail | X passed, Y failed |
| Build | ✓ Pass / ✗ Fail | [errors if any] |

**All checks passed?** [Yes/No]
```

**If any failures:**

```markdown
> **ACTION REQUIRED:**
> Release blocked due to validation failures.
>
> **Options:**
> 1. Fix issues and re-run validation
> 2. Abort release
>
> **How to proceed?**
```

**⛔ GATE: All validations must pass.**

---

## Phase 4: Docs (Developer) - Optional

**Chatmode:** 👨‍💻 Developer
**Tasks:** `docs/update-docs`

Before creating the release commit, prompt for documentation:

```markdown
## Documentation (Optional)

**Release version:** vX.Y.Z

**Consider documenting:**

| Type | When Relevant | Action |
|------|---------------|--------|
| AI context | Architecture changes in release | Update `.ai-project/` |
| User docs | New features, API changes | Update `docs/` |
| README | Version-specific info, migration notes | Update `README.md` |

**What would you like to document?**
- `ai` - Update AI assistant context
- `user` - Add/update user documentation
- `readme` - Update README (e.g., badge versions, migration notes)
- `skip` - No documentation needed
```

**⏸️ Wait for user response. If `skip`, proceed to tag.**

See [docs/update-docs.task.md](../tasks/docs/update-docs.task.md) for templates.

---

## Phase 5: Tag (Committer)

**Chatmode:** 💾 Committer
**Tasks:** `commit/create-commit`, `release/create-tag`, `release/push-tag`

### Step 5.1: Create Release Commit

```markdown
## Release Commit

**Files to commit:**
- `package.json`
- `CHANGELOG.md` (if updated)
- `package-lock.json` (if updated)

**Commit message:**
```
chore(release): vX.Y.Z

- Bump version to X.Y.Z
- Update changelog
```

**Create commit?** (yes / edit message / abort)
```

**⏸️ Wait for confirmation.**

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): vX.Y.Z"
```

### Step 5.2: Create Git Tag

```bash
# Create annotated tag
git tag -a vX.Y.Z -m "Release vX.Y.Z"
```

### Step 5.3: Push Release

**If `--dry-run` flag:**

```markdown
## Dry Run Complete

**Would have:**
- Created commit: `chore(release): vX.Y.Z`
- Created tag: `vX.Y.Z`
- Pushed to origin

**No changes made.** Run without `--dry-run` to execute.
```

**Otherwise:**

```markdown
## Ready to Push

**Branch:** `main`
**Commit:** `chore(release): vX.Y.Z`
**Tag:** `vX.Y.Z`

**Push to origin?** (yes / no)

> **WARNING:**
> This will push the release commit and tag to the remote repository.
```

**⛔ GATE: Never push without explicit "yes".**

```bash
git push origin main
git push origin vX.Y.Z
```

---

## Phase 6: Notes (Developer)

**Chatmode:** 👨‍💻 Developer
**Tasks:** `release/generate-notes`, `release/create-github-release`

### Step 5.1: Generate Release Notes

```markdown
## Release Notes for vX.Y.Z

### Highlights
[Brief summary of most important changes]

### Breaking Changes 💥
- **[Feature]**: Description of breaking change and migration path

### New Features ✨
- **[Feature]**: Description (#PR)

### Bug Fixes 🐛
- **[Fix]**: Description (#PR)

### Other Changes
- Description (#PR)

### Contributors
@contributor1, @contributor2

**Full Changelog:** [compare link]
```

### Step 5.2: Create GitHub Release (Optional)

```markdown
> **ACTION REQUIRED:**
> Create GitHub release?
>
> This will create a release on GitHub with the generated notes.
>
> **Options:**
> - `yes` - Create release now
> - `draft` - Create as draft for editing
> - `skip` - Skip GitHub release
```

**⏸️ Wait for response.**

**If yes or draft:**

```bash
# Create GitHub release
gh release create vX.Y.Z \
  --title "vX.Y.Z" \
  --notes-file release-notes.md \
  [--draft]
```

---

## Release Complete

```markdown
## Release Summary

| Item | Value |
|------|-------|
| Version | `X.Y.Z` |
| Tag | `vX.Y.Z` |
| Commit | `[sha]` |
| GitHub Release | [URL] |

**Release complete!** 🎉
```

---

## Quick Reference

| Phase | Chatmode | Tasks | Gate |
|-------|----------|-------|------|
| Prepare | 🔍 Explorer | check-status, gather-changes | User confirms scope |
| Version | 👨‍💻 Developer | bump-version, update-changelog | **User approves** |
| Validate | 🧪 Tester | typecheck, lint, test, build | **All pass** |
| Docs | 👨‍💻 Developer | update-docs | *Optional* |
| Tag | 💾 Committer | create-commit, create-tag, push | **User confirms push** |
| Notes | 👨‍💻 Developer | generate-notes, github-release | User choice |

---

## Rules

### Prohibited
- ❌ Releasing from non-main branches without explicit approval
- ❌ Skipping validation phase
- ❌ Force pushing tags
- ❌ Releasing with uncommitted changes
- ❌ Pushing without user confirmation

### Required
- ✓ Full validation (typecheck, lint, test, build) before release
- ✓ User confirmation at each major gate
- ✓ Annotated git tags with version message
- ✓ Semantic versioning (semver)

### Recommended
- 💡 Update CHANGELOG.md with categorized changes
- 💡 Create GitHub release with notes
- 💡 Use conventional commit format for release commit
- 💡 Include breaking change migration notes

---

**See Also:**
- [Workflow: Validate](./validate.prompt.md)
- [Workflow: Commit](./commit.prompt.md)
- [Tasks: docs/](../tasks/docs/)
