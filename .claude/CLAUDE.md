<!-- Import workspace-level CLAUDE.md configuration -->
<!-- See /home/lab/workspace/.claude/CLAUDE.md for complete rules -->

# Project-Specific Configuration

This file extends workspace-level configuration with project-specific rules.

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
