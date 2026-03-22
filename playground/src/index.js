import * as m from 'mithril';

function Counter() {
	let count = 0;

	return {
		view() {
			return m('.counter', [
				m('button', { onclick: () => count-- }, '-'),
				m('span', { style: 'margin: 0 10px' }, count),
				m('button', { onclick: () => count++ }, '+'),
			]);
		},
	};
}

class Toggle {
	oninit() {
		this.enabled = false;
	}

	view() {
		return m(
			'button',
			{
				onclick: () => (this.enabled = !this.enabled),
			},
			this.enabled ? 'ON' : 'OFF',
		);
	}
}

class OtherClass {
	constructor() {
		this.g = 7;
	}
}

class MyTestClass {
	constructor() {
		this.x = 1;
		this.y = 2;
		this.otherElement = new OtherClass();
	}

	getWowza() {
		return 4;
	}
}

let count = 0;
const Child = () => ({
	view: () => m('div', { onclick: () => count++ }, `Child: ${count}`),
});

function ManyDataTypes() {
	return {
		view(vnode) {
			return m('div', { style: 'color: red;' }, m('b', 'Child'), ' ', [
				[[m('u', '2'), 'hello']],
				m(Child, { text: 'child props', number: 4, boolean: true, func: () => 132, a: 1, b: 2, c: 3, test: new MyTestClass() }),
			]);
		},
	};
}

const InlineDemo = {
	view() {
		return m('.inline-demo', [
			m({
				view() {
					return m('div', 'Inline component');
				},
			}),
		]);
	},
};

function Card() {
	return {
		view(vnode) {
			return m('.card', [m('h3', vnode.attrs.title), m('.content', vnode.children)]);
		},
	};
}

function Layout() {
	return {
		view() {
			return m('.app', [
				m('h1', 'Mithril Debug Playground'),
				m(Card, { title: 'Counter (closure component)' }, m(Counter)),
				m(Card, { title: 'Toggle (class component)' }, m(Toggle)),
				m(Card, { title: 'Many data types' }, m(ManyDataTypes)),
				m(Card, { title: 'Inline component' }, m(InlineDemo)),
			]);
		},
	};
}

m.mount(
	document.getElementById('app'),
	window.__mithril_devtools.attach(() => m(Layout)),
);

const containerId = 'many-mounts';
const buttonId = 'add-mount';
let createCounter = 0;
const mounts = [];

function addMount() {
	createCounter += 1;
	const createdIndex = createCounter;
	const node = document.createElement('div');
	node.className = 'dynamic-mount';
	node.style.border = '1px solid #ccc';
	node.style.padding = '6px';
	node.style.margin = '4px';
	node.style.display = 'inline-block';
	node.style.cursor = 'pointer';
	node.dataset.createdIndex = createdIndex;
	node.addEventListener('click', () => removeMount(node));
	document.getElementById(containerId).appendChild(node);

	const component = {
		view() {
			return m('div', `${createdIndex}`);
		},
	};

	m.mount(node, component);
	mounts.push({ node, createdIndex });
}

function removeMount(node) {
	const idx = mounts.findIndex((r) => r.node === node);
	if (idx === -1) return;
	m.mount(node, null);
	node.remove();
	mounts.splice(idx, 1);
}

document.getElementById(buttonId).addEventListener('click', addMount);
