# jupyterlab_markdown_viewer_toc_fix

[![JupyterLab 4](https://img.shields.io/badge/JupyterLab-4-orange.svg)](https://jupyterlab.readthedocs.io/en/stable/)
[![npm version](https://img.shields.io/npm/v/jupyterlab_markdown_viewer_toc_fix.svg)](https://www.npmjs.com/package/jupyterlab_markdown_viewer_toc_fix)
[![PyPI version](https://img.shields.io/pypi/v/jupyterlab_markdown_viewer_toc_fix.svg)](https://pypi.org/project/jupyterlab_markdown_viewer_toc_fix/)

JupyterLab 4.x extension that fixes broken Table of Contents (TOC) navigation and anchor links in the Markdown Viewer.

## Problem

JupyterLab's markdown viewer has completely non-functional TOC navigation and anchor links. Clicking TOC items or in-document links like `[Section](#section)` produces no scrolling. Console shows "Heading element not found" errors.

**Root cause**: Attribute selector mismatch between security sanitizer (uses `data-jupyter-id`) and navigation code (queries `id`). The fix was applied to notebooks in August 2025 but not to the markdown viewer.

See [MARKDOWN_VIEWER_TOC_ISSUE_RCA.md](MARKDOWN_VIEWER_TOC_ISSUE_RCA.md) for detailed root cause analysis.

## Solution

The extension applies three runtime patches addressing the core defects:

**TOC Navigation Patch** - Connects to markdown viewer TOC model's `activeHeadingChanged` signal, uses conditional attribute selector (`data-jupyter-id` vs `id`) based on sanitizer settings, properly awaits async heading ID resolution

**Fragment Navigation Patch** - Intercepts `RenderedHTMLCommon.setFragment()` prototype method, queries both `#id` and `[data-jupyter-id]` selectors with fallback strategy

**Case-Insensitive Matching** - Performs case-insensitive attribute search when direct selectors fail, handles URL fragment lowercase conversion (e.g., `#performance-optimization` matches `data-jupyter-id="Performance-Optimization"`)

**Hash Change Handling** - Listens to both JupyterLab router's `routed` signal and global `hashchange` events, ensures scroll behavior triggers regardless of navigation method

All patches include graceful fallbacks to original implementations if patching fails.

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
