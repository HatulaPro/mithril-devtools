import * as m from 'mithril';

const Clock = {
	oninit(vnode) {
		vnode.state.time = new Date().toLocaleTimeString();
	},

	view(vnode) {
		return m('.clock', 'Time: ' + vnode.state.time);
	},
};

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

const Greeting = {
	view(vnode) {
		return m('p', 'Hello ' + vnode.attrs.name);
	},
};

const List = {
	oninit(vnode) {
		vnode.state.items = [
			{ id: 1, name: 'Apple' },
			{ id: 2, name: 'Banana' },
			{ id: 3, name: 'Orange' },
		];
	},

	view(vnode) {
		return m(
			'ul',
			vnode.state.items.map((item) => m('li', { key: item.id }, item.name)),
		);
	},
};

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

const ManyDataTypes = {
	view(vnode) {
		return m('div', { style: 'color: red;' }, m('b', 'Child'), ' ', [
			[[m('u', '2'), 'hello']],
			m(Child, { text: 'child props', number: 4, boolean: true, func: () => 132, a: 1, b: 2, c: 3, test: new MyTestClass() }),
		]);
	},
};

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

const Conditional = {
	oninit(vnode) {
		vnode.state.visible = true;
	},

	view(vnode) {
		return m('.conditional', [
			m(
				'button',
				{
					onclick: () => (vnode.state.visible = !vnode.state.visible),
				},
				'Toggle',
			),

			vnode.state.visible ? m('.box', 'Visible content') : m('.box.hidden', 'Hidden state'),
		]);
	},
};

const FragmentDemo = {
	view() {
		return [m('span', 'Fragment item 1 '), m('span', 'Fragment item 2 ')];
	},
};

const Card = {
	view(vnode) {
		return m('.card', [m('h3', vnode.attrs.title), m('.content', vnode.children)]);
	},
};

const Layout = {
	view() {
		return m('.app', [
			m('h1', 'Mithril Debug Playground'),
			m(Card, { title: 'Clock' }, m(Clock)),
			m(Card, { title: 'Counter (closure component)' }, m(Counter)),
			m(Card, { title: 'Toggle (class component)' }, m(Toggle)),
			m(Card, { title: 'Attrs demo' }, m(Greeting, { name: 'Alice' }), m(Greeting, { name: 'Bob' })),
			m(Card, { title: 'List rendering' }, m(List)),
			m(Card, { title: 'Many data types' }, m(ManyDataTypes)),
			m(Card, { title: 'Inline component' }, m(InlineDemo)),
			m(Card, { title: 'Conditional rendering' }, m(Conditional)),
			m(Card, { title: 'Fragment return' }, m(FragmentDemo)),
		]);
	},
};

m.mount(
	document.getElementById('app'),
	window.__mithril_devtools.attach(() => m(Layout)),
);
