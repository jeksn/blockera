import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Annoime - Site Blocker',
    description: 'Block distracting sites with a dismissible blur overlay',
    permissions: ['storage', 'webNavigation', 'scripting', 'tabs'],
    host_permissions: ['<all_urls>'],
  },
});
