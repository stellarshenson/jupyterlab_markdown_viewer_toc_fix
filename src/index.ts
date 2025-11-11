import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the jupyterlab_markdown_viewer_toc_fix extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_markdown_viewer_toc_fix:plugin',
  description: 'Jupyterlab extension to fix issues with TOC navigation in Markdown Viewer in Jupyterlab',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyterlab_markdown_viewer_toc_fix is activated!');
  }
};

export default plugin;
