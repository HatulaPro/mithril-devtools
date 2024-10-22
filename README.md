# Mithril Devtools

This is a chrome extension made for debugging mithril.js more easily. It is still very unstable and a lot of work has to be done.

## How To Use

The extension is attached using `window.__mithril_devtools`. So you'll have to add the callback in your development environment.
Make sure not to rely on it in prod, as it is only added by the extension.

```js
const DevToolsWrapper = {
	view() {
		if (window.__mithril_devtools) {
			return m(window.__mithril_devtools.attach(() => m(App)));
		}
		return m(App);
	},
};

m.mount(document.getElementById('app'), DevToolsWrapper);
```