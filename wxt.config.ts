import { defineConfig } from "wxt";

/**
 * Bias Noticer — WXT configuration
 *
 * Permissions stay minimal and justifiable:
 * - storage: API key, settings, local feedback/cache
 * - activeTab: user-initiated analysis of the current tab
 * - scripting: inject content script on demand when needed
 * - sidePanel: rich analysis UX without blocking the page
 * - contextMenus: Analyze page / selection
 *
 * Host access to http(s) pages is required to extract text and inject
 * non-destructive highlights. api.x.ai is used only for BYOK model calls.
 */
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Bias Noticer",
    description:
      "See through the propaganda. AI-assisted critical reading that highlights bias signals — never censors content.",
    // version comes from package.json via WXT
    permissions: [
      "storage",
      "activeTab",
      "scripting",
      "sidePanel",
      "contextMenus",
    ],
    host_permissions: [
      "https://api.x.ai/*",
      "http://*/*",
      "https://*/*",
    ],
    action: {
      default_title: "Bias Noticer — See through the propaganda",
      default_icon: {
        "16": "icon/16.png",
        "32": "icon/32.png",
        "48": "icon/48.png",
        "128": "icon/128.png",
      },
    },
    side_panel: {
      default_path: "sidepanel.html",
    },
    commands: {
      "toggle-analysis": {
        suggested_key: {
          default: "Ctrl+Shift+B",
          mac: "Command+Shift+B",
        },
        description: "Activate / deactivate Bias Noticer shades",
      },
      "open-side-panel": {
        suggested_key: {
          default: "Ctrl+Shift+Y",
          mac: "Command+Shift+Y",
        },
        description: "Open Bias Noticer side panel",
      },
    },
    icons: {
      "16": "icon/16.png",
      "32": "icon/32.png",
      "48": "icon/48.png",
      "128": "icon/128.png",
    },
  },
});
