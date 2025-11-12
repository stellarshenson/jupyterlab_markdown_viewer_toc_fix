import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  IRouter
} from '@jupyterlab/application';
import { IMarkdownViewerTracker } from '@jupyterlab/markdownviewer';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ITableOfContentsTracker, TableOfContents } from '@jupyterlab/toc';
import { TableOfContentsUtils } from '@jupyterlab/toc';

/**
 * Patches the RenderedHTMLCommon.setFragment method to handle both id and data-jupyter-id attributes.
 * This fixes anchor navigation in markdown viewer when allowNamedProperties = false.
 */
function patchFragmentNavigation(
  renderMimeRegistry: IRenderMimeRegistry
): void {
  const proto = Object.getPrototypeOf(
    renderMimeRegistry.createRenderer('text/html')
  );

  if (!proto || !proto.setFragment) {
    // console.warn(
    //   'jupyterlab_markdown_viewer_toc_fix: Unable to find setFragment method to patch'
    // );
    return;
  }

  const originalSetFragment = proto.setFragment;

  proto.setFragment = function (fragment: string): void {
    let el;
    try {
      const cleanFragment = fragment.startsWith('#')
        ? fragment.slice(1)
        : fragment;
      const escaped = CSS.escape(cleanFragment);

      // Try id first (for allowNamedProperties = true), then data-jupyter-id as fallback
      el =
        this.node.querySelector(`#${escaped}`) ||
        this.node.querySelector(`[data-jupyter-id="${escaped}"]`);
    } catch (error) {
      // console.warn('Unable to set URI fragment identifier.', error);
    }

    if (el) {
      el.scrollIntoView();
    } else {
      // Fallback to original implementation if our approach fails
      originalSetFragment.call(this, fragment);
    }
  };

  // console.log(
  //   'jupyterlab_markdown_viewer_toc_fix: Patched setFragment for anchor navigation'
  // );
}

/**
 * Scrolls to element using correct attribute selector.
 */
function scrollToFragment(
  fragment: string,
  contentNode: HTMLElement,
  renderMimeRegistry: IRenderMimeRegistry
): boolean {
  let el;
  try {
    const cleanFragment = fragment.startsWith('#')
      ? fragment.slice(1)
      : fragment;
    const escaped = CSS.escape(cleanFragment);

    // Get sanitizer settings
    const sanitizer = renderMimeRegistry.sanitizer;
    const allowNamedProperties = sanitizer?.allowNamedProperties ?? false;

    // Try correct attribute first based on sanitizer settings
    const primarySelector = allowNamedProperties
      ? `#${escaped}`
      : `[data-jupyter-id="${escaped}"]`;
    el = contentNode.querySelector(primarySelector);

    // Try fallback selector
    if (!el) {
      const fallbackSelector = allowNamedProperties
        ? `[data-jupyter-id="${escaped}"]`
        : `#${escaped}`;
      el = contentNode.querySelector(fallbackSelector);
    }

    // Try case-insensitive search if still not found
    if (!el) {
      const allHeadings = contentNode.querySelectorAll(
        '[data-jupyter-id], [id]'
      );
      const cleanLower = cleanFragment.toLowerCase();

      for (const heading of Array.from(allHeadings)) {
        const headingId =
          (heading as HTMLElement).getAttribute('data-jupyter-id') ||
          (heading as HTMLElement).getAttribute('id') ||
          '';
        if (headingId.toLowerCase() === cleanLower) {
          el = heading as HTMLElement;
          break;
        }
      }
    }
  } catch (error) {
    // console.warn('jupyterlab_markdown_viewer_toc_fix: Fragment error', error);
    return false;
  }

  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  return false;
}

/**
 * Logs all header IDs in the document for debugging.
 */
function logDocumentHeaders(
  contentNode: HTMLElement,
  renderMimeRegistry: IRenderMimeRegistry
): void {
  // const sanitizer = renderMimeRegistry.sanitizer;
  // const allowNamedProperties = sanitizer?.allowNamedProperties ?? false;
  // const attribute = allowNamedProperties ? 'id' : 'data-jupyter-id';
  // const allHeadings = contentNode.querySelectorAll('h1, h2, h3, h4, h5, h6');
  // if (allHeadings.length === 0) {
  //   return;
  // }
  // console.log('=== Document Header Links ===');
  // console.log(`Attribute used: ${attribute}`);
  // console.log('Headers:');
  // allHeadings.forEach((heading) => {
  //   const level = heading.tagName.toLowerCase();
  //   const text = heading.textContent || '';
  //   const headingId = (heading as HTMLElement).getAttribute(attribute) || '(no id)';
  //   console.log(`  ${level}: "${text}" -> ${attribute}="${headingId}"`);
  // });
  // console.log('=============================');
}

/**
 * Patches markdown viewer's setFragment method for in-document anchor links.
 */
function patchMarkdownViewerFragment(
  widget: any,
  renderMimeRegistry: IRenderMimeRegistry
): void {
  const content = widget.content;
  if (!content || !content.setFragment) {
    return;
  }

  const originalSetFragment = content.setFragment.bind(content);

  content.setFragment = function (fragment: string): void {
    const success = scrollToFragment(
      fragment,
      content.node,
      renderMimeRegistry
    );
    if (!success) {
      originalSetFragment(fragment);
    }
  };

  // Handle URL fragment changes (for in-document link clicks)
  const handleHashChange = () => {
    const hash = window.location.hash;
    if (hash && widget.isVisible) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        scrollToFragment(hash, content.node, renderMimeRegistry);
      }, 100);
    }
  };

  // Listen to rendered signal to handle fragments after content loads
  content.rendered.connect(() => {
    // Log all headers when document is rendered
    setTimeout(() => {
      logDocumentHeaders(content.node, renderMimeRegistry);
    }, 50);

    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        scrollToFragment(hash, content.node, renderMimeRegistry);
      }, 100);
    }
  });

  // Listen for hash changes (in-document link clicks)
  window.addEventListener('hashchange', handleHashChange);

  // Clean up on widget disposal
  widget.disposed.connect(() => {
    window.removeEventListener('hashchange', handleHashChange);
  });
}

/**
 * Sets up TOC navigation interceptor for markdown viewer widgets.
 * This fixes TOC navigation in markdown viewer when allowNamedProperties = false.
 */
function setupTOCNavigation(
  markdownViewerTracker: IMarkdownViewerTracker,
  tocTracker: ITableOfContentsTracker,
  renderMimeRegistry: IRenderMimeRegistry
): void {
  // Handle existing widgets
  markdownViewerTracker.forEach(widget => {
    patchWidgetTOC(widget, tocTracker, renderMimeRegistry);
    patchMarkdownViewerFragment(widget, renderMimeRegistry);
  });

  // Monitor new markdown viewer widgets
  markdownViewerTracker.widgetAdded.connect((sender, widget) => {
    patchWidgetTOC(widget, tocTracker, renderMimeRegistry);
    patchMarkdownViewerFragment(widget, renderMimeRegistry);
  });
}

/**
 * Patches TOC navigation for a specific widget.
 */
function patchWidgetTOC(
  widget: any,
  tocTracker: ITableOfContentsTracker,
  renderMimeRegistry: IRenderMimeRegistry
): void {
  // Small delay to ensure TOC model is created
  setTimeout(() => {
    const tocModel = tocTracker.get(widget);

    if (!tocModel) {
      return;
    }

    // Connect to activeHeadingChanged signal
    tocModel.activeHeadingChanged.connect(
      async (
        model: TableOfContents.IModel<TableOfContents.IHeading>,
        heading: TableOfContents.IHeading | null
      ) => {
        if (!heading) {
          return;
        }

        // Get sanitizer settings
        const sanitizer = renderMimeRegistry.sanitizer;
        const allowNamedProperties = sanitizer?.allowNamedProperties ?? false;
        const attribute = allowNamedProperties ? 'id' : 'data-jupyter-id';

        // Get parser from model
        const parser = (model as any).parser;
        if (!parser) {
          return;
        }

        try {
          // Use raw property if available (IMarkdownHeading), otherwise use text
          const headingText = (heading as any).raw || heading.text;
          const elementId = await TableOfContentsUtils.Markdown.getHeadingId(
            parser,
            headingText,
            heading.level,
            sanitizer
          );

          if (!elementId) {
            return;
          }

          // Use correct attribute selector based on sanitizer settings
          const selector = `h${heading.level}[${attribute}="${CSS.escape(elementId)}"]`;
          const element = widget.content.node.querySelector(selector);

          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } catch (error) {
          // console.error(
          //   'jupyterlab_markdown_viewer_toc_fix: Error in heading navigation',
          //   error
          // );
        }
      }
    );

    // console.log(
    //   'jupyterlab_markdown_viewer_toc_fix: Connected TOC signal for widget:',
    //   widget.id
    // );
  }, 100);
}

/**
 * Initialization data for the jupyterlab_markdown_viewer_toc_fix extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_markdown_viewer_toc_fix:plugin',
  description:
    'Fixes TOC navigation and anchor links in Markdown Viewer for JupyterLab 4.x',
  autoStart: true,
  requires: [
    IMarkdownViewerTracker,
    IRenderMimeRegistry,
    ITableOfContentsTracker
  ],
  optional: [IRouter],
  activate: (
    app: JupyterFrontEnd,
    markdownViewerTracker: IMarkdownViewerTracker,
    renderMimeRegistry: IRenderMimeRegistry,
    tocTracker: ITableOfContentsTracker,
    router: IRouter | null
  ) => {
    // console.log(
    //   'jupyterlab_markdown_viewer_toc_fix: ========== EXTENSION ACTIVATED =========='
    // );

    // Apply patches
    patchFragmentNavigation(renderMimeRegistry);
    setupTOCNavigation(markdownViewerTracker, tocTracker, renderMimeRegistry);

    // Listen to JupyterLab router for route changes
    if (router) {
      router.routed.connect(() => {
        const hash = window.location.hash;

        if (hash) {
          const currentWidget = markdownViewerTracker.currentWidget;
          if (currentWidget && currentWidget.content) {
            setTimeout(() => {
              scrollToFragment(
                hash,
                currentWidget.content.node,
                renderMimeRegistry
              );
            }, 300);
          }
        }
      });
    }

    // Add global hashchange listener as fallback
    window.addEventListener('hashchange', () => {
      const currentWidget = markdownViewerTracker.currentWidget;
      if (currentWidget && currentWidget.content) {
        setTimeout(() => {
          scrollToFragment(
            window.location.hash,
            currentWidget.content.node,
            renderMimeRegistry
          );
        }, 100);
      }
    });
  }
};

export default plugin;
