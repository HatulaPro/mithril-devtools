# Mithril Devtools

https://github.com/user-attachments/assets/903ab10a-dfbc-4a6c-bc0d-6f54a16d7b54

This is a chrome extension made for debugging mithril.js more easily. It is still very unstable and a lot of work has to be done.

## How To Use

The extension is attached using `window.__mithril_devtools`. So you'll have to add the callback in your development environment.
Make sure not to rely on it in prod, as it is only added by the extension.

```js
const { component, detach } = window.__mithril_devtools.attach(() => m(Layout), 'Main App');
// Mounting
m.mount(document.getElementById('app'), component);

// Unmounting
m.mount(document.getElementById('app'), null);
detach();
```

I've not yet uploaded it to the chrome store, so you'll have to add it yourself:

```bash
git clone https://github.com/HatulaPro/mithril-devtools.git
cd mithril-devtools/core
npm install
npm run build
```

Then load the unpacked extension from the `core/dist` folder. Follow [this](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) for more information.

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

- [x] Multi mounts support
- [x] Removing mounted elements
- [ ] Improved viewing of attributes in the devtools panel
- [ ] Viewing DOM nodes in the devtools panel
- [x] Right click -> See in devtools for DOM elements
