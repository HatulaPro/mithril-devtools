# Mithril Devtools Project

## What is this?

A Chrome extension for debugging and developing [Mithril.js](https://mithril.js.org) applications. The extension integrates with the browser's developer tools to help inspect Mithril components and their state. It's still in early/unstable stages with planned features for multi-mount support and improved DOM inspection.

## Building

**Extension (`core` folder):**

- Build for production: `npm run build`
- Build for development: `npm run dev`
- Watch mode for development: `npm run watch`
- `core/src/scripts`:
    - `main.ts` - runs the devtools tab. Uses mithril.
    - `injection.ts` - injected to the user's window. Adds the callback that parses the mithril tree.
    - `communicator.ts` - passes data between the two.

**Playground app (`playground` folder):**

- Start dev server: `npm start`
- Build for production: `npm run build`
