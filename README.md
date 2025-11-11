# jupyterlab_markdown_viewer_toc_fix

[![GitHub Actions](https://github.com/stellarshenson/jupyterlab_markdown_viewer_toc_fix/actions/workflows/build.yml/badge.svg)](https://github.com/stellarshenson/jupyterlab_markdown_viewer_toc_fix/actions/workflows/build.yml)
[![npm version](https://img.shields.io/npm/v/jupyterlab_markdown_viewer_toc_fix.svg)](https://www.npmjs.com/package/jupyterlab_markdown_viewer_toc_fix)
[![PyPI version](https://img.shields.io/pypi/v/jupyterlab_markdown_viewer_toc_fix.svg)](https://pypi.org/project/jupyterlab_markdown_viewer_toc_fix/)
[![Total PyPI downloads](https://static.pepy.tech/badge/jupyterlab_markdown_viewer_toc_fix)](https://pepy.tech/project/jupyterlab_markdown_viewer_toc_fix)
[![JupyterLab 4](https://img.shields.io/badge/JupyterLab-4-orange.svg)](https://jupyterlab.readthedocs.io/en/stable/)

JupyterLab 4.x extension that fixes broken Table of Contents (TOC) navigation and anchor links in the Markdown Viewer.

<div class="alert alert-block alert-warning">
<b>Extension will be deprecated: </b> This extension is meant to be a temporary fix for a known issue in Jupyterlab, where neither TOC nor in-markdown hyperlinks to markdown sections allow document to be scrolled. Once this is fixed in Jupyterlab - this extension will be obsolete and should not be installed.<br><br>Jupyterlab Versions affected: <code>4.0 - 4.4.10</code>
</div>

## Problem

JupyterLab's markdown viewer has broken TOC navigation and anchor links. Clicking TOC items or in-document links produces no scrolling.

**Root cause**: JupyterLab's HTML sanitizer uses `data-jupyter-id` attributes (default security setting) but navigation code queries for `id` attributes that don't exist. The fix was applied to notebooks in August 2025 but not to the markdown viewer.

**Secondary issue**: URL fragments are lowercase (`#section`) but attributes preserve Title-Case (`data-jupyter-id="Section"`), requiring case-insensitive matching.

## Solution

Extension applies runtime patches:

**TOC Navigation** - Connects to `activeHeadingChanged` signal, uses correct attribute selector based on sanitizer settings

**Fragment Navigation** - Patches `setFragment()` to query both `#id` and `[data-jupyter-id]` selectors

**Case-Insensitive Fallback** - Loops through headings comparing lowercase versions when direct selectors fail

All patches include graceful fallbacks to original implementations.

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
