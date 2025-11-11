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
    console.warn(
      'jupyterlab_markdown_viewer_toc_fix: Unable to find setFragment method to patch'
    );
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
      console.warn('Unable to set URI fragment identifier.', error);
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

    // console.log(
    //   'jupyterlab_markdown_viewer_toc_fix: scrollToFragment called with:',
    //   fragment,
    //   'cleaned:',
    //   cleanFragment,
    //   'escaped:',
    //   escaped
    // );

    // Get sanitizer settings
    const sanitizer = renderMimeRegistry.sanitizer;
    const allowNamedProperties = sanitizer?.allowNamedProperties ?? false;

    // console.log(
    //   'jupyterlab_markdown_viewer_toc_fix: allowNamedProperties:',
    //   allowNamedProperties
    // );

    // Try correct attribute first based on sanitizer settings
    const primarySelector = allowNamedProperties
      ? `#${escaped}`
      : `[data-jupyter-id="${escaped}"]`;
    // console.log(
    //   'jupyterlab_markdown_viewer_toc_fix: Trying primary selector:',
    //   primarySelector
    // );
    el = contentNode.querySelector(primarySelector);

    // Try fallback selector
    if (!el) {
      const fallbackSelector = allowNamedProperties
        ? `[data-jupyter-id="${escaped}"]`
        : `#${escaped}`;
      // console.log(
      //   'jupyterlab_markdown_viewer_toc_fix: Primary failed, trying fallback:',
      //   fallbackSelector
      // );
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
          // console.log(
          //   'jupyterlab_markdown_viewer_toc_fix: Found via case-insensitive match:',
          //   headingId
          // );
          break;
        }
      }
    }
  } catch (error) {
    console.warn('jupyterlab_markdown_viewer_toc_fix: Fragment error', error);
    return false;
  }

  if (el) {
    // console.log(
    //   'jupyterlab_markdown_viewer_toc_fix: Element found! Scrolling...',
    //   el
    // );
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // console.log(
    //   'jupyterlab_markdown_viewer_toc_fix: Navigation successful to',
    //   fragment
    // );
    return true;
  }

  // console.warn(
  //   'jupyterlab_markdown_viewer_toc_fix: Element NOT found for fragment:',
  //   fragment
  // );
  return false;
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
    // console.warn(
    //   'jupyterlab_markdown_viewer_toc_fix: No setFragment on content'
    // );
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
      // console.warn(
      //   'jupyterlab_markdown_viewer_toc_fix: Element not found, trying original'
      // );
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

  // console.log(
  //   'jupyterlab_markdown_viewer_toc_fix: Patched setFragment and hashchange for widget:',
  //   widget.id
  // );
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
      // console.warn(
      //   'jupyterlab_markdown_viewer_toc_fix: No TOC model for widget',
      //   widget.id
      // );
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
          // console.warn(
          //   'jupyterlab_markdown_viewer_toc_fix: Parser not available'
          // );
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
            // console.log(
            //   `jupyterlab_markdown_viewer_toc_fix: Navigated to heading using ${attribute}`
            // );
          } else {
            // console.warn(
            //   `jupyterlab_markdown_viewer_toc_fix: Heading not found - selector: ${selector}`
            // );
          }
        } catch (error) {
          console.error(
            'jupyterlab_markdown_viewer_toc_fix: Error in heading navigation',
            error
          );
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
      // console.log('jupyterlab_markdown_viewer_toc_fix: Router available, connecting to routed signal');
      router.routed.connect(() => {
        const hash = window.location.hash;
        // console.log(
        //   'jupyterlab_markdown_viewer_toc_fix: Router routed event, hash:',
        //   hash
        // );

        if (hash) {
          const currentWidget = markdownViewerTracker.currentWidget;
          if (currentWidget && currentWidget.content) {
            // console.log(
            //   'jupyterlab_markdown_viewer_toc_fix: Scrolling via router event'
            // );
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
    } else {
      // console.log('jupyterlab_markdown_viewer_toc_fix: Router not available');
    }

    // Add global hashchange listener as fallback
    window.addEventListener('hashchange', () => {
      // console.log(
      //   'jupyterlab_markdown_viewer_toc_fix: GLOBAL hashchange detected:',
      //   window.location.hash
      // );

      const currentWidget = markdownViewerTracker.currentWidget;
      if (currentWidget && currentWidget.content) {
        // console.log(
        //   'jupyterlab_markdown_viewer_toc_fix: Current widget found, attempting scroll'
        // );
        setTimeout(() => {
          scrollToFragment(
            window.location.hash,
            currentWidget.content.node,
            renderMimeRegistry
          );
        }, 100);
      } else {
        // console.log(
        //   'jupyterlab_markdown_viewer_toc_fix: No current widget found'
        // );
      }
    });

    // console.log(
    //   'jupyterlab_markdown_viewer_toc_fix: All patches applied successfully'
    // );
  }
};

export default plugin;
