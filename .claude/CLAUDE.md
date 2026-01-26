<!-- @import /home/lab/workspace/.claude/CLAUDE.md -->

# Project-Specific Configuration

This file imports workspace-level configuration from `/home/lab/workspace/.claude/CLAUDE.md`.
All workspace rules apply. Project-specific rules below strengthen or extend them.

The workspace `/home/lab/workspace/.claude/` directory contains additional instruction files
(MERMAID.md, NOTEBOOK.md, DATASCIENCE.md, GIT.md, JUPYTERLAB_EXTENSION.md, and others) referenced by CLAUDE.md.
Consult workspace CLAUDE.md and the .claude directory to discover all applicable standards.

## Mandatory Bans (Reinforced)

The following workspace rules are STRICTLY ENFORCED for this project:

- **No automatic git tags** - only create tags when user explicitly requests
- **No automatic version changes** - only modify version in package.json/pyproject.toml when user explicitly requests
- **No automatic publishing** - never run `make publish`, `npm publish`, `twine upload`, or similar without explicit user request
- **No manual package installs if Makefile exists** - use `make install` or equivalent Makefile targets, not direct `pip install`/`npm install`/`jlpm install`
- **No automatic git commits or pushes** - only when user explicitly requests

## Session Rules

- Do not commit nor push without explicit request
- You may commit (not push) without request
- You must not tag code without explicit request

## Project Context

**Project:** `jupyterlab_markdown_viewer_toc_fix`

**Purpose:** JupyterLab 4.x extension that fixes Table of Contents (TOC) navigation issues in the Markdown Viewer

**Technology Stack:**

- **Frontend:** TypeScript 5.8+ with JupyterLab 4.x APIs
- **Backend:** Python 3.9+ with Hatchling build system
- **Build Tools:** jlpm (JupyterLab's yarn), npm scripts, hatch
- **Testing:** Jest (unit), Playwright/Galata (integration)
- **Linting:** ESLint, Prettier, StyleLint

**Key Components:**

- `/src/index.ts` - Main plugin entry point (JupyterFrontEndPlugin)
- `/src/__tests__/` - Jest unit tests
- `/ui-tests/` - Playwright integration tests
- `/style/` - CSS stylesheets for extension UI
- `/jupyterlab_markdown_viewer_toc_fix/` - Python package wrapper

**Naming Conventions:**

- Python package: `jupyterlab_markdown_viewer_toc_fix` (snake_case)
- npm package: `jupyterlab_markdown_viewer_toc_fix` (kebab-case maintained for consistency)
- TypeScript files: kebab-case for filenames, PascalCase for classes
- JupyterLab plugin ID: `jupyterlab_markdown_viewer_toc_fix:plugin`

**Development Workflow:**

- Build: `jlpm build` (production) or `jlpm watch` (development)
- Test: `jlpm test` (Jest unit tests)
- Lint: `jlpm lint:check` or `jlpm lint` (auto-fix)
- Install locally: `pip install -e .` and `jupyter labextension develop . --overwrite`

**Extension Architecture:**

- Dual-language project (TypeScript frontend + Python packaging)
- Compiled output goes to `/jupyterlab_markdown_viewer_toc_fix/labextension/`
- Uses JupyterLab 4.x extension system with `JupyterFrontEndPlugin`

**Documentation Standards:**

- Follow workspace modus primaris principles
- Use JupyterLab badge: `[![JupyterLab 4](https://img.shields.io/badge/JupyterLab-4-orange.svg)](https://jupyterlab.readthedocs.io/en/stable/)`
- Document TypeScript APIs with JSDoc comments
- Include inline code examples for complex extension patterns
