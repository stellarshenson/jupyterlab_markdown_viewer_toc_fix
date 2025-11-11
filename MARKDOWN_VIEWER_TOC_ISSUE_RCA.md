# Markdown Viewer TOC Scrolling Issue - Root Cause Analysis

## Executive Summary

Table of Contents (TOC) navigation and in-document anchor links fail completely in JupyterLab's markdown viewer. Clicking TOC items or in-document links like `[Introduction](#introduction)` produces no scrolling behavior. Console logs show "Heading element not found" errors. This issue stems from three interconnected bugs introduced when the TOC logic was revamped (July 2025) and anchor navigation was fixed for notebooks (August 2025), but the markdown viewer was not updated to match.

**Key Facts**:

- Affects JupyterLab markdown viewer only (notebooks work correctly)
- Both built-in TOC panel and in-document markdown links fail
- Root cause: attribute selector mismatch (`id` vs `data-jupyter-id`)
- Fix was applied to notebooks but not markdown viewer
- Default security setting `allowNamedProperties = false` triggers the issue

## Technical Background

### HTML ID Attribute Security Model

JupyterLab sanitizes rendered HTML to prevent XSS attacks. By default (`allowNamedProperties = false`), the sanitizer removes `id` attributes and replaces them with `data-jupyter-id` attributes. This prevents malicious markdown from creating conflicting IDs or targeting specific page elements.

**Rendering Flow**:

1. Markdown parser converts `## Introduction` to `<h2>Introduction</h2>`
2. `renderMarkdown()` calls `headerAnchors()` which creates heading IDs
3. When `allowNamedProperties = false`: heading gets `data-jupyter-id="Introduction"` (no `id` attribute)
4. Sanitizer's transform function at `sanitizer.ts:1178-1189` strips any `id` attributes
5. Anchor links get `href="#Introduction"` pointing to non-existent IDs

### Recent Changes

**Commit 4a80e2d527** (July 2025) - "Enhancing the TOC logic":

- Revamped TOC implementation across packages
- Changed markdown viewer from sync `getHeadings()` to async `parseHeadings()`
- Introduced async race condition in heading-to-element mapping

**Commit c94607d591** (August 2025) - "Fix anchor navigation on sanitized HTML":

- Fixed notebooks to use correct attribute selector based on `allowNamedProperties`
- Updated notebook TOC to query `[data-jupyter-id="..."]` when needed
- **Did not update markdown viewer** `packages/markdownviewer/src/toc.ts`
- **Did not update** `RenderedHTMLCommon.setFragment()` in `packages/rendermime/src/widgets.ts`

## Root Causes

### Bug 1: TOC Uses Wrong Attribute Selector (Primary)

**Location**: `packages/markdownviewer/src/toc.ts:177`

**Current Code**:

```typescript
const selector = `h${heading.level}[id="${CSS.escape(elementId)}"]`;
```

**Problem**: The selector hardcodes `[id="..."]` but when `allowNamedProperties = false` (the default), headings have `data-jupyter-id` attributes instead. The `querySelector()` returns `null`, causing "Heading element not found" console errors and preventing TOC scrolling.

**Expected Behavior**: Should mirror notebook implementation at `packages/notebook/src/widget.ts:2695-2699`:

```typescript
const attribute =
  (this.rendermime.sanitizer.allowNamedProperties ?? false)
    ? 'id'
    : 'data-jupyter-id';
const element = this.node.querySelector(
  `h${heading.level}[${attribute}="${CSS.escape(id)}"]`
);
```

### Bug 2: Fragment Navigation Uses Wrong Selector (Primary)

**Location**: `packages/rendermime/src/widgets.ts:151-154`

**Current Code**:

```typescript
el = this.node.querySelector(
  fragment.startsWith('#') ? `#${CSS.escape(fragment.slice(1))}` : fragment
);
```

**Problem**: Fragment navigation (used for in-document anchor links and external deep-links) queries for `#id` selector. When headings have `data-jupyter-id` instead of `id`, the query returns `null` and scrolling fails. Browser's native anchor navigation also fails because `<a href="#Introduction">` requires actual `id` attributes.

**Impact**: Both programmatic navigation (TOC clicks) and user-created markdown links `[Section](#section)` fail to scroll.

### Bug 3: Async Race Condition (Contributing)

**Location**: `packages/markdownviewer/src/toc.ts:166-187`

**Current Code**:

```typescript
model.headings.forEach(async heading => {
  const elementId = await TableOfContentsUtils.Markdown.getHeadingId(
    this.parser!,
    heading.raw,
    heading.level,
    this.sanitizer
  );

  if (!elementId) {
    return;
  }
  const selector = `h${heading.level}[id="${CSS.escape(elementId)}"]`;

  headingToElement.set(
    heading,
    TableOfContentsUtils.addPrefix(
      widget.content.node,
      selector,
      heading.prefix ?? ''
    )
  );
});
```

**Problem**: The `forEach` with async callback creates fire-and-forget promises. When users click TOC items immediately after document load, `onActiveHeadingChanged` executes before the async `getHeadingId()` calls complete. The `headingToElement` WeakMap is still empty, causing `headingToElement.get(heading)` to return `undefined` at line 133.

**Why This Matters**: Even if the attribute selector were fixed, early clicks would still fail due to timing. The proper pattern is `for...of` with `await` or `Promise.all()`.

## Why Notebooks Work But Markdown Viewer Doesn't

**Notebook Implementation** (working):

- TOC selector at `packages/notebook/src/widget.ts:2695-2699` conditionally uses `id` or `data-jupyter-id`
- Fragment handling at `packages/notebook/src/widget.ts:2747-2749` uses same conditional logic
- Scrolling uses `scrollIntoView()` directly on found elements
- Properly awaits async operations

**Markdown Viewer Implementation** (broken):

- TOC selector at `packages/markdownviewer/src/toc.ts:177` hardcoded to `[id="..."]`
- Fragment handling inherits broken `RenderedHTMLCommon.setFragment()`
- Async operations not properly awaited
- Not updated when notebook was fixed in August 2025

## Affected User Scenarios

1. **TOC Panel Navigation**: Clicking any heading in the TOC sidebar produces console error and no scroll
2. **In-Document Links**: Markdown `[Go to Section](#section)` links don't navigate
3. **External Deep-Links**: Opening `file.md#section` from file browser doesn't scroll to target
4. **Anchor Hover Links**: The `¶` anchor links next to headings don't work (they have `href="#id"` but headings have `data-jupyter-id`)

## File References

**Primary Files Requiring Fixes**:

- `packages/markdownviewer/src/toc.ts:177` - TOC attribute selector
- `packages/rendermime/src/widgets.ts:151-154` - Fragment navigation selector
- `packages/markdownviewer/src/toc.ts:166-187` - Async forEach pattern

**Reference Implementations** (working examples):

- `packages/notebook/src/widget.ts:2695-2699` - Correct attribute selector pattern
- `packages/notebook/src/widget.ts:2747-2749` - Correct fragment handling

**Related Files**:

- `packages/rendermime/src/renderers.ts:1312-1335` - `headerAnchors()` function that sets attributes
- `packages/apputils/src/sanitizer.ts:1175-1189` - Sanitizer transform that strips `id` attributes
- `packages/toc/src/utils/markdown.ts:31-64` - `getHeadingId()` that correctly returns attribute value

## Solution Approach

### Fix 1: Update TOC Attribute Selector

Replace hardcoded selector at `packages/markdownviewer/src/toc.ts:177`:

```typescript
const attribute =
  (this.sanitizer?.allowNamedProperties ?? false) ? 'id' : 'data-jupyter-id';
const selector = `h${heading.level}[${attribute}="${CSS.escape(elementId)}"]`;
```

### Fix 2: Update Fragment Navigation

Update `RenderedHTMLCommon.setFragment()` at `packages/rendermime/src/widgets.ts:148-161`:

```typescript
setFragment(fragment: string): void {
  let el;
  try {
    const cleanFragment = fragment.startsWith('#')
      ? fragment.slice(1)
      : fragment;
    const escaped = CSS.escape(cleanFragment);

    // Try id first, then data-jupyter-id as fallback
    el = this.node.querySelector(`#${escaped}`) ||
         this.node.querySelector(`[data-jupyter-id="${escaped}"]`);
  } catch (error) {
    console.warn('Unable to set URI fragment identifier.', error);
  }
  if (el) {
    el.scrollIntoView();
  }
}
```

### Fix 3: Await Async Operations

Replace `forEach` with proper async pattern at `packages/markdownviewer/src/toc.ts:166`:

```typescript
await Promise.all(
  model.headings.map(async heading => {
    const elementId = await TableOfContentsUtils.Markdown.getHeadingId(
      this.parser!,
      heading.raw,
      heading.level,
      this.sanitizer
    );

    if (!elementId) {
      return;
    }

    const attribute =
      (this.sanitizer?.allowNamedProperties ?? false)
        ? 'id'
        : 'data-jupyter-id';
    const selector = `h${heading.level}[${attribute}="${CSS.escape(elementId)}"]`;

    headingToElement.set(
      heading,
      TableOfContentsUtils.addPrefix(
        widget.content.node,
        selector,
        heading.prefix ?? ''
      )
    );
  })
);
```

## Testing Recommendations

1. **Basic TOC Navigation**: Click TOC items in markdown viewer, verify scroll occurs
2. **In-Document Links**: Create markdown with `[Link](#target)`, verify clicking scrolls
3. **External Deep-Links**: Open markdown file with URL fragment, verify auto-scroll
4. **Both Settings**: Test with `allowNamedProperties` both `true` and `false`
5. **Edge Cases**: Long documents, nested headings, special characters in heading text
6. **Timing**: Test rapid TOC clicks immediately after document load
7. **Consistency**: Compare behavior with notebook TOC (should be identical)

## Additional Notes

The documentation at `docs/source/getting_started/faq.rst` (added in commit c94607d591) explains the intended behavior: "During sanitization, the id attributes of the DOM elements are replaced with `data-jupyter-id` attributes. When resolving an URL, if a fragment exists (e.g. `#my-id`), it will find and scroll to the element with the corresponding `data-jupyter-id`." However, the markdown viewer implementation doesn't actually implement this documented behavior.

The `renderMarkdown.createHeaderId()` function at `packages/rendermime/src/renderers.ts:423-424` uses a simple algorithm: `(header.textContent ?? '').replace(/ /g, '-')`. This means "CPL-3: Business Services Technologies" becomes `"CPL-3:-Business-Services-Technologies"` with special characters preserved. The sanitizer doesn't modify the ID string content, only which attribute holds it (`id` vs `data-jupyter-id`).
