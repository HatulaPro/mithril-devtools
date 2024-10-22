const copyTree = (tree, location = []) => {
	if (!tree) return null;
	let tag = null;
	if (typeof tree.tag === 'string') {
		tag = tree.tag + (tree.tag === '#' ? 'text: ' + JSON.stringify(tree.children) : '');
	} else if (typeof tree.tag === 'function') {
		tag = tree.tag.name;
	} else if (typeof tree.tag === 'object') {
		tag = 'unknown component';
	}

	let children = [];
	let pushed = 0;
	if (tree.instance) {
		children.push(copyTree(tree.instance, location));
		pushed++;
	}

	if (Array.isArray(tree.children)) {
		const pushChild = (child) => {
			if (child.tag === '[') {
				child.children.forEach(pushChild);
			} else {
				children.push(copyTree(child, [...location, pushed]));
				pushed++;
			}
		};
		tree.children.forEach(pushChild);
	}

	return { tag, children, location };
};

const TreeViewer = (view) => {
	let dom = null;

	function onchange(args) {
		console.log(args);
		dom = args.dom;
		const tree = copyTree(args);
		window.postMessage({ type: 'mithril_devtools_to', content: JSON.stringify(tree) });
	}

	const getNodeFromLocation = (location) => {
		let current = dom;

		for (const index of location) {
			current = current.childNodes[index];
		}

		return current;
	};

	let highlightEl = null;
	const highlight = (el) => {
		const rect = el.getBoundingClientRect();
		const div = highlightEl || document.createElement('div');
		div.style.outline = '2px solid purple';
		div.style.background = '#7834de';
		div.style.opacity = '0.2';
		div.style.pointerEvents = 'none';
		div.style.width = `${rect.width}px`;
		div.style.height = `${rect.height}px`;
		div.style.left = `${rect.left}px`;
		div.style.top = `${rect.top}px`;
		div.style.position = 'fixed';

		document.body.appendChild(div);
		highlightEl = div;
	};

	const handleMessage = (message) => {
		if (message.data.type === 'mithril_devtools_from') {
			const { action, payload } = message.data;

			if (action === 'hover') {
				const node = getNodeFromLocation(payload);
				if (node instanceof HTMLElement) {
					highlight(node);
				} else if (node instanceof Text) {
					const range = document.createRange(node);
					range.selectNode(node);
					highlight(range);
					range.detach();
				}
			} else if (action === 'mouseout') {
				if (highlightEl) {
					highlightEl.remove();
				}
			}
		}
	};
	return {
		oninit() {
			window.addEventListener('message', handleMessage);
		},
		onremove() {
			window.removeEventListener('message', handleMessage);
		},
		oncreate: onchange,
		onupdate: onchange,
		view,
	};
};

window.__mithril_devtools = {
	attach: (view) => {
		const res = TreeViewer(view);
		return res;
	},
};
