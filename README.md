# Mithril Devtools

This is a chrome extension made for debugging mithril.js more easily. It is still very unstable and a lot of work has to be done.

## How To Use

The extension is attached using `window.__mithril_devtools`. So you'll have to add the callback in your development environment.
Make sure not to rely on it in prod, as it is only added by the extension.

```js
m.mount(
	document.getElementById('app'),
	window.__mithril_devtools.attach(() => m(Layout)),
);
```

I've not yet uploaded it to the chrome store, so you'll have to add it yourself:

```bash
git clone https://github.com/HatulaPro/mithril-devtools.git
cd mithril-devtools/core/src # <- This directory contains all the files needed. There is no build step.
```

Load the unpacked extension. Follow [this](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) for more information.

### Limitations

Due to the limitations of JavaScript, some components syntax cannot be fully supported.
When using components such as:

```js
const Component = {
	view() {
		return m('span', 'Some text');
	},
};
```

The extension can not infer the component's name, which will be shown as "unknown component" in the devtools panel.

Instead, it is recommended to use function or class components:

```js
// Class component
class Component {
	view() {
		return m('span', 'Some text');
	}
}

// Function component
function Component() {
	return {
		view() {
			return m('span', 'Some text');
		},
	};
}
```

## Contributing

Please do.

## TODOs

- [ ] Multi mounts support
- [ ] Removing mounted elements
- [ ] Improved viewing of attributes in the devtools panel
- [ ] Viewing DOM nodes in the devtools panel
- [ ] Right click -> See in devtools for DOM elements
