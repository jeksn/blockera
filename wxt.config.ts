import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Blockera',
    description: 'Block distracting sites with a dismissible blur overlay',
    action: {
      default_title: 'Blockera',
    },
    permissions: ['storage', 'webNavigation', 'scripting'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'cuboid.png',
      32: 'cuboid.png',
      48: 'cuboid.png',
      96: 'cuboid.png',
      128: 'cuboid.png',
    },
  },
});
