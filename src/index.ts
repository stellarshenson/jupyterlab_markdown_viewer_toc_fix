import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
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

  console.log(
    'jupyterlab_markdown_viewer_toc_fix: Patched setFragment for anchor navigation'
  );
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
  });

  // Monitor new markdown viewer widgets
  markdownViewerTracker.widgetAdded.connect((sender, widget) => {
    patchWidgetTOC(widget, tocTracker, renderMimeRegistry);
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
      console.warn(
        'jupyterlab_markdown_viewer_toc_fix: No TOC model for widget',
        widget.id
      );
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
          console.warn(
            'jupyterlab_markdown_viewer_toc_fix: Parser not available'
          );
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
            console.log(
              `jupyterlab_markdown_viewer_toc_fix: Navigated to heading using ${attribute}`
            );
          } else {
            console.warn(
              `jupyterlab_markdown_viewer_toc_fix: Heading not found - selector: ${selector}`
            );
          }
        } catch (error) {
          console.error(
            'jupyterlab_markdown_viewer_toc_fix: Error in heading navigation',
            error
          );
        }
      }
    );

    console.log(
      'jupyterlab_markdown_viewer_toc_fix: Connected TOC signal for widget:',
      widget.id
    );
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
  activate: (
    app: JupyterFrontEnd,
    markdownViewerTracker: IMarkdownViewerTracker,
    renderMimeRegistry: IRenderMimeRegistry,
    tocTracker: ITableOfContentsTracker
  ) => {
    console.log(
      'JupyterLab extension jupyterlab_markdown_viewer_toc_fix is activated!'
    );

    // Apply patches
    patchFragmentNavigation(renderMimeRegistry);
    setupTOCNavigation(markdownViewerTracker, tocTracker, renderMimeRegistry);

    console.log(
      'jupyterlab_markdown_viewer_toc_fix: All patches applied successfully'
    );
  }
};

export default plugin;
