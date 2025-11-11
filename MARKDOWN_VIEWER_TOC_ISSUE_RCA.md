# Markdown Viewer TOC Scrolling Issue - Root Cause Analysis

## Executive Summary

Table of Contents (TOC) navigation and in-document anchor links fail completely in JupyterLab's markdown viewer. Clicking TOC items or in-document links produces no scrolling behavior. Console logs show "Heading element not found" errors.

**Key Facts**:

- Affects JupyterLab markdown viewer only (notebooks work correctly)
- Both built-in TOC panel and in-document markdown links fail
- Root cause: attribute selector mismatch (`id` vs `data-jupyter-id`)
- Fix was applied to notebooks (August 2025) but not markdown viewer
- Default security setting `allowNamedProperties = false` triggers the issue

## Technical Background

JupyterLab sanitizes rendered HTML to prevent XSS attacks. By default (`allowNamedProperties = false`), the sanitizer removes `id` attributes and replaces them with `data-jupyter-id` attributes.

**Rendering Flow**:

1. Markdown parser converts `## Introduction` to `<h2>Introduction</h2>`
2. When `allowNamedProperties = false`: heading gets `data-jupyter-id="Introduction"` (no `id` attribute)
3. Sanitizer strips any `id` attributes
4. Anchor links get `href="#Introduction"` pointing to non-existent IDs

**Recent Changes**:

- **Commit 4a80e2d527** (July 2025) - Revamped TOC implementation, introduced async race condition
- **Commit c94607d591** (August 2025) - Fixed notebooks to use correct attribute selector, did not update markdown viewer

## Root Causes

### Bug 1: TOC Uses Wrong Attribute Selector

**Location**: `packages/markdownviewer/src/toc.ts:177`

**Problem**: Selector hardcodes `[id="..."]` but headings have `data-jupyter-id` attributes. The `querySelector()` returns `null`, causing scrolling failure.

**Expected**: Should mirror notebook implementation with conditional attribute selection based on `allowNamedProperties`.

### Bug 2: Fragment Navigation Uses Wrong Selector

**Location**: `packages/rendermime/src/widgets.ts:151-154`

**Problem**: Fragment navigation queries for `#id` selector. When headings have `data-jupyter-id`, the query returns `null` and scrolling fails.

**Impact**: Both TOC clicks and markdown links `[Section](#section)` fail to scroll.

### Bug 3: Async Race Condition

**Location**: `packages/markdownviewer/src/toc.ts:166-187`

**Problem**: `forEach` with async callback creates fire-and-forget promises. Early clicks execute before `headingToElement` WeakMap is populated.

### Bug 4: Case Mismatch

**Problem**: URL fragments are lowercase (`#performance-optimization`) but `data-jupyter-id` attributes preserve Title-Case (`Performance-Optimization`). Direct string matching fails.

**Impact**: Even with correct attribute selector, case sensitivity prevents element discovery.

## Why Notebooks Work But Markdown Viewer Doesn't

**Notebook Implementation** (working):

- Conditional attribute selector using `allowNamedProperties` check
- Fragment handling uses same conditional logic
- Properly awaits async operations

**Markdown Viewer Implementation** (broken):

- Hardcoded `[id="..."]` selector
- No case-insensitive fallback
- Async operations not properly awaited
- Not updated when notebook was fixed

## Affected User Scenarios

1. **TOC Panel Navigation** - Clicking headings in TOC sidebar produces no scroll
2. **In-Document Links** - Markdown `[Go to Section](#section)` links don't navigate
3. **External Deep-Links** - Opening `file.md#section` from file browser doesn't scroll
4. **Anchor Hover Links** - The `¶` anchor links next to headings don't work

## Solution Implementation

**Extension-Based Fix** (implemented in `jupyterlab_markdown_viewer_toc_fix`):

Runtime patches applied via JupyterLab extension without core modifications:

1. **TOC Signal Connection** - Connects to `activeHeadingChanged` signal, uses conditional attribute selector based on `sanitizer.allowNamedProperties`

2. **Fragment Navigation Patch** - Intercepts `RenderedHTMLCommon.setFragment()`, queries both `#id` and `[data-jupyter-id]` with fallback

3. **Case-Insensitive Matching** - Performs lowercase comparison when direct selectors fail, handles URL fragment case conversion

4. **Event Coverage** - Listens to both JupyterLab router `routed` signal and global `hashchange` events

All patches include graceful fallbacks to original implementations.

## Testing Results

Extension v1.0.1 verified operational:

- TOC panel navigation works correctly
- In-document anchor links scroll properly
- Case mismatch resolved via case-insensitive fallback
- Both router and hashchange events trigger scroll behavior

## File References

**Primary Files** (upstream fixes would target):

- `packages/markdownviewer/src/toc.ts:177` - TOC attribute selector
- `packages/rendermime/src/widgets.ts:151-154` - Fragment navigation selector
- `packages/markdownviewer/src/toc.ts:166-187` - Async forEach pattern

**Reference Implementations**:

- `packages/notebook/src/widget.ts:2695-2699` - Correct attribute selector pattern
- `packages/notebook/src/widget.ts:2747-2749` - Correct fragment handling
