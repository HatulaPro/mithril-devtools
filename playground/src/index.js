import * as m from 'mithril';

let count = 0;
const Child = () => ({
	view: () => m('div', { onclick: () => count++ }, `Child: ${count}`),
});

const Child2 = () => ({
	view: () => m('div', { style: 'color: red;' }, m('b', 'Child'), ' ', [[[m('u', '2'), 'hello']], m(Child, { text: 'child props' })]),
});

const App = () => {
	return {
		view: (attrs) => {
			return m('div', 'Hello, Mithril with Webpack!', m(Child2, { text: 'child2 props' }));
		},
	};
};

const DevToolsWrapper = {
	view() {
		if (window.__mithril_devtools) {
			return m(window.__mithril_devtools.attach(() => m(App)));
		}
		return m(App);
	},
};

m.mount(document.getElementById('app'), DevToolsWrapper);
