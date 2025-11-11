# jupyterlab_markdown_viewer_toc_fix

[![GitHub Actions](https://github.com/stellarshenson/jupyterlab_markdown_viewer_toc_fix/actions/workflows/build.yml/badge.svg)](https://github.com/stellarshenson/jupyterlab_markdown_viewer_toc_fix/actions/workflows/build.yml)
[![npm version](https://img.shields.io/npm/v/jupyterlab_markdown_viewer_toc_fix.svg)](https://www.npmjs.com/package/jupyterlab_markdown_viewer_toc_fix)
[![PyPI version](https://img.shields.io/pypi/v/jupyterlab_markdown_viewer_toc_fix.svg)](https://pypi.org/project/jupyterlab_markdown_viewer_toc_fix/)
[![Total PyPI downloads](https://static.pepy.tech/badge/jupyterlab_markdown_viewer_toc_fix)](https://pepy.tech/project/jupyterlab_markdown_viewer_toc_fix)
[![JupyterLab 4](https://img.shields.io/badge/JupyterLab-4-orange.svg)](https://jupyterlab.readthedocs.io/en/stable/)

JupyterLab 4.x extension that fixes broken Table of Contents (TOC) navigation and anchor links in the Markdown Viewer.

> [!WARNING]
> **Extension will be deprecated**: This extension is a temporary fix for a known issue in JupyterLab 4.0 - 4.4.10, where neither TOC nor in-markdown hyperlinks to markdown sections allow document to be scrolled. Once this is fixed in JupyterLab core, this extension will be obsolete and should not be installed.

## Problem

JupyterLab's markdown viewer has broken TOC navigation and anchor links. Affects JupyterLab 4.0 through 4.4.10.

**Symptoms**:
- Clicking TOC panel items produces no scrolling
- In-document links like `[Go to Section](#section)` don't navigate
- URL navigation `file.md#section` fails to scroll to target
- Console shows "Heading element not found" errors

**Root Cause - Attribute Selector Mismatch**:
- JupyterLab's HTML sanitizer removes `id` attributes for XSS protection
- Headings get `data-jupyter-id` attributes instead (default setting `allowNamedProperties = false`)
- Navigation code queries for `id` attributes that don't exist
- `querySelector()` returns `null` and scroll attempts fail silently
- Example: `## Introduction` renders as `<h2 data-jupyter-id="Introduction">` but TOC queries `[id="Introduction"]`

**Why Notebooks Work But Markdown Viewer Doesn't**:
- Notebooks were fixed in August 2025 (commit c94607d591) with conditional attribute selectors
- Markdown viewer was not updated with the same fix

**Secondary Issue - Case Mismatch**:
- URL fragments are lowercase: `#performance-optimization`
- Attributes preserve Title-Case from headings: `data-jupyter-id="Performance-Optimization"`
- Direct string matching fails without case-insensitive comparison

## Solution

Extension applies runtime patches to fix navigation without modifying JupyterLab core:

**TOC Navigation Patch**:
- Connects to markdown viewer's `activeHeadingChanged` signal
- Uses conditional attribute selector (`data-jupyter-id` vs `id`) based on `sanitizer.allowNamedProperties` setting
- Properly awaits async heading ID resolution from markdown parser
- Scrolls to correct heading element with `scrollIntoView()`

**Fragment Navigation Patch**:
- Intercepts `RenderedHTMLCommon.setFragment()` prototype method
- Queries both `#id` and `[data-jupyter-id]` selectors with fallback chain
- Handles JupyterLab router `routed` signal for in-app navigation
- Listens to global `hashchange` events for URL-based navigation

**Case-Insensitive Fallback**:
- Loops through all headings with `data-jupyter-id` or `id` attributes
- Compares lowercase versions of search term and attribute values
- Returns first match when direct selectors fail
- Resolves mismatch between lowercase URL fragments and Title-Case attributes

All patches include graceful fallbacks to original implementations if patching fails or elements cannot be found.

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



