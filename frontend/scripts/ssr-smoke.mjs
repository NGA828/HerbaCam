/**
 * Render the app's screens through Vite's SSR pipeline to surface the
 * ReferenceErrors a bundler lets slide.
 *
 * A free identifier such as `<Leaf>` with no import is NOT a module
 * resolution failure, so `vite build` succeeds and the page white-screens at
 * runtime. This harness actually executes the component bodies.
 *
 * Usage:  node frontend/scripts/ssr-smoke.mjs
 * (it must live under frontend/ so Node resolves vite/react from there)
 */
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

/** Modules to render; named exports are rendered by name. */
const cases = [
  ['Navbar', '/src/components/Navbar.jsx'],
  ['Footer', '/src/components/Footer.jsx'],
  ['LoginPage', '/src/pages/LoginPage.jsx'],
  ['RegisterPage', '/src/pages/RegisterPage.jsx'],
  ['AdminWorkspaces', '/src/pages/AdminWorkspaces.jsx'],
  ['AuthenticatedPages', '/src/pages/AuthenticatedPages.jsx'],
  ['DashboardLayout', '/src/layouts/DashboardLayout.jsx'],
  ['PublicLayout', '/src/layouts/PublicLayout.jsx'],
  ['AssistantPage', '/src/pages/AssistantPage.jsx'],
  ['FeedbackQueuePage', '/src/pages/FeedbackQueuePage.jsx'],
  ['ConsultationsPages', '/src/pages/ConsultationsPages.jsx'],
  ['LandingPage', '/src/pages/LandingPage.jsx'],
  ['PlantsPage', '/src/pages/PlantsPage.jsx'],
  ['IdentifyPage', '/src/pages/IdentifyPage.jsx'],
  ['MapPage', '/src/pages/MapPage.jsx'],
];

const server = await createServer({
  root: new URL('..', import.meta.url).pathname,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

const { MemoryRouter } = await import('react-router-dom');
const { AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx');
const { ToastProvider } = await server.ssrLoadModule('/src/contexts/ToastContext.jsx');
const { ConfirmProvider } = await server.ssrLoadModule('/src/components/ui/ConfirmDialog.jsx');
const { NotificationProvider } = await server.ssrLoadModule('/src/contexts/NotificationContext.jsx');

/** Providers every page reaches for — set up so a missing provider can't be
 *  mistaken for the reference bug we are hunting. */
function withProviders(element) {
  return React.createElement(MemoryRouter, null,
    React.createElement(AuthProvider, null,
      React.createElement(NotificationProvider, null,
        React.createElement(ToastProvider, null,
          React.createElement(ConfirmProvider, null, element)))));
}

const results = { ok: 0, crash: 0, skip: 0 };
for (const [label, path] of cases) {
  let mod;
  try {
    mod = await server.ssrLoadModule(path);
  } catch (error) {
    const message = String(error.message).split('\n')[0].trim();
    // Modules that touch a browser global at import time (leaflet does) cannot
    // be loaded by SSR at all. Not a bug — the page is fine in a browser.
    const global = (message.match(/([A-Za-z_$][\w$]*) is not defined/) || [])[1];
    if (global && /^(window|document|navigator|HTMLElement|self)$/.test(global)) {
      console.log(`skip [ssr-env]   ${label.padEnd(20)} import: ${message.slice(0, 60)}`);
      results.skip += 1;
    } else {
      console.log(`CRASH[IMPORT]  ${label.padEnd(20)} ${message.slice(0, 70)}`);
      results.crash += 1;
    }
    continue;
  }
  const names = Object.keys(mod).filter((k) => /^[A-Z]/.test(k));
  if (mod.default && !names.includes('default')) names.unshift('default');
  for (const name of names.length ? names : ['default']) {
    const Component = mod[name];
    if (typeof Component !== 'function') continue;
    try {
      renderToString(withProviders(React.createElement(Component)));
      console.log(`ok    ${(name === 'default' ? label : `${label}.${name}`).padEnd(20)}`);
      results.ok += 1;
    } catch (error) {
      const message = String(error?.message || error).split('\n')[0].trim();
      // Browser-only globals are absent under SSR (leaflet reads `window` at
      // import time). That is an artefact of this harness, not a bug, so it is
      // reported separately from the missing-identifier crashes we hunt here.
      const component = (name === 'default' ? label : `${label}.${name}`).padEnd(20);
      // Only these browser globals are legitimately absent outside a
      // browser. Anything else that is "not defined" is a real bug.
      const SSR_GLOBALS = /^(window|document|navigator|HTMLElement|HTMLImageElement|localStorage|self) is not defined$/;
      const notDefined = (message.match(/([A-Za-z_$][\w$]*) is not defined/) || [])[1];
      const marker = !notDefined
        ? 'other'
        : SSR_GLOBALS.test(`${notDefined} is not defined`)
          ? 'ssr-env'
          : 'REFERENCE';
      if (marker === 'REFERENCE') {
        console.log(`CRASH[REFERENCE] ${component} ${message.slice(0, 70)}`);
        results.crash += 1;
      } else if (marker === 'ssr-env') {
        console.log(`skip [ssr-env]   ${component} ${message.slice(0, 60)}`);
        results.skip += 1;
      } else {
        console.log(`fail [other]     ${component} ${message.slice(0, 70)}`);
        results.skip += 1;
      }
    }
  }
}

await server.close();
console.log(`\n${results.ok} render clean · ${results.crash} undefined-reference crash(es) · ${results.skip} failed for other reasons`);
process.exit(results.crash ? 1 : 0);
