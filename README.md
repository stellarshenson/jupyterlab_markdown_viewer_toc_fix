# jupyterlab_markdown_viewer_toc_fix

[![JupyterLab 4](https://img.shields.io/badge/JupyterLab-4-orange.svg)](https://jupyterlab.readthedocs.io/en/stable/)
[![npm version](https://img.shields.io/npm/v/jupyterlab_markdown_viewer_toc_fix.svg)](https://www.npmjs.com/package/jupyterlab_markdown_viewer_toc_fix)
[![PyPI version](https://img.shields.io/pypi/v/jupyterlab_markdown_viewer_toc_fix.svg)](https://pypi.org/project/jupyterlab_markdown_viewer_toc_fix/)

JupyterLab 4.x extension that fixes broken Table of Contents (TOC) navigation and anchor links in the Markdown Viewer.

## The Problem

JupyterLab's markdown viewer has completely non-functional TOC navigation and anchor links. Clicking TOC items or in-document links like `[Section](#section)` produces no scrolling. Console shows "Heading element not found" errors.

**Root cause**: Attribute selector mismatch between security sanitizer (uses `data-jupyter-id`) and navigation code (queries `id`). The fix was applied to notebooks in August 2025 but not to the markdown viewer.

See [MARKDOWN_VIEWER_TOC_ISSUE_RCA.md](MARKDOWN_VIEWER_TOC_ISSUE_RCA.md) for detailed root cause analysis.

## The Fix

Patch 1 - Fragment Navigation (src/index.ts:14-55):
- Intercepts RenderedHTMLCommon.setFragment() prototype method
- Queries both #id and [data-jupyter-id] selectors with fallback
- Fixes in-document links, deep-links, and anchor hover navigation

Patch 2 - TOC Navigation (src/index.ts:57-140):
- Monitors markdown viewer widget creation via tracker
- Patches TOC model's onActiveHeadingChanged handler per widget
- Uses conditional attribute selection: id when allowNamedProperties = true, data-jupyter-id when false
- Properly awaits async heading ID resolution

**Technical Approach**: Runtime patching strategy - zero core modifications, automatic application, graceful fallback on error. Mirrors working notebook implementation from August 2025 fix.

**Build Status**:
- TypeScript compilation: Clean
- ESLint validation: Passing
- Prettier formatting: Compliant
- Webpack bundle: 26.6 KB (production-ready)

## Install

```bash
pip install jupyterlab_markdown_viewer_toc_fix
```

## Uninstall

```bash
pip uninstall jupyterlab_markdown_viewer_toc_fix
```

## Development

```bash
# Clone and install dependencies
jlpm install

# Set up virtual environment
python -m venv .venv
source .venv/bin/activate
pip install -e .

# Link extension
jupyter labextension develop . --overwrite

# Build
jlpm build

# Watch mode (auto-rebuild on changes)
jlpm watch
```

## Requirements

- JupyterLab >= 4.0.0
