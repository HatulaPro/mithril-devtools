interface MithrilNode {
	tag?: string | Function | { view: Function };
	children?: any[];
	attrs?: Record<string, any>;
	dom?: HTMLElement | Text;
	instance?: MithrilNode;
}

interface TreeNode {
	tag: string | null;
	attrs: string;
	isComponent: boolean;
	children: (TreeNode | null)[];
	location: number[];
}

interface DevToolsGlobal {
	components: Record<string, any>;
	dom_nodes: Record<string, HTMLElement | Text | null>;
	attach: (view: any) => any;
}

declare global {
	interface Window {
		__mithril_devtools: DevToolsGlobal;
	}
}

// Make this file a module
export {};

const copyTree = (tree: MithrilNode, location: number[] = []): TreeNode | null => {
	if (!tree) return null;
	let tag = null;
	let isComponent = false;
	if (typeof tree.tag === 'string') {
		tag = tree.tag + (tree.tag === '#' ? 'text: ' + JSON.stringify(tree.children) : '');
	} else if (typeof tree.tag === 'function') {
		tag = tree.tag.name;
		const locationStr = JSON.stringify(location);
		window.__mithril_devtools.components[locationStr] = tree.tag;
		window.__mithril_devtools.dom_nodes[locationStr] = tree.dom || null;
		isComponent = true;
	} else if (typeof tree.tag === 'object') {
		tag = 'unknown component';
		const locationStr = JSON.stringify(location);
		window.__mithril_devtools.components[locationStr] = tree.tag.view;
		window.__mithril_devtools.dom_nodes[locationStr] = tree.dom || null;

		isComponent = true;
	}

	let children: (TreeNode | null)[] = [];
	let pushed = 0;
	if (tree.instance) {
		children.push(copyTree(tree.instance, location));
		pushed++;
	}

	if (Array.isArray(tree.children)) {
		const pushChild = (child: any) => {
			if (child.tag === '[') {
				child.children.forEach(pushChild);
			} else {
				children.push(copyTree(child, [...location, pushed]));
				pushed++;
			}
		};
		tree.children.forEach(pushChild);
	}
	let attrs = JSON.stringify(
		tree.attrs,
		(key, value) => {
			if (typeof value === 'function') {
				return { __type_internal: 'function', name: value.name };
			} else if (value && typeof value === 'object') {
				if (value.constructor.name === 'Object') {
					return value;
				}

				return { __type_internal: value.constructor.name };
			} else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' || value === null || value === undefined) {
				return value;
			} else {
				return 'Value Unknown';
			}
		},
		4,
	);

	return { tag, attrs, isComponent, children, location };
};

const TreeViewer = (view: any) => {
	let dom: HTMLElement | Text | null = null;
	let lastChange: any = null;

	function onchange(args: any) {
		dom = args.dom;
		lastChange = args;
		window.__mithril_devtools.components = {};
		window.__mithril_devtools.dom_nodes = {};
		const tree = copyTree(args);
		window.postMessage({ type: 'mithril_devtools_to', content: { type: 'tree', value: JSON.stringify(tree) } });
	}

	const getNodeFromLocation = (location: number[]): ChildNode | null => {
		let current: ChildNode | HTMLElement | Text | null = dom;

		for (const index of location) {
			if (!current || !('childNodes' in current)) return null;
			current = current.childNodes[index];
		}

		return current || null;
	};

	const removeHighlight = () => {
		const highlightElement = document.getElementById('mithril_devtools_highlighter');
		highlightElement?.remove();
	};

	const highlight = (el: HTMLElement | Range) => {
		removeHighlight();
		const rect = el.getBoundingClientRect();
		const div = document.createElement('div');
		div.id = 'mithril_devtools_highlighter';
		div.style.outline = '2px solid purple';
		div.style.background = '#7834de';
		div.style.opacity = '0.2';
		div.style.pointerEvents = 'none';
		div.style.width = `${rect.width}px`;
		div.style.height = `${rect.height}px`;
		div.style.left = `${rect.left}px`;
		div.style.top = `${rect.top}px`;
		div.style.zIndex = '99999999';
		div.style.position = 'fixed';

		document.body.appendChild(div);
	};

	const handleContextMenu = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		let best = null;
		for (const [locationStr, node] of Object.entries(window.__mithril_devtools.dom_nodes || {})) {
			if (!node) continue;
			if (node === target || (node.contains && node.contains(target))) {
				if (!best) best = locationStr;
				else {
					const prevLen = JSON.parse(best).length;
					const curLen = JSON.parse(locationStr).length;
					if (curLen > prevLen) best = locationStr;
				}
			}
		}
		window.postMessage({ type: 'mithril_devtools_to', content: { type: 'contextmenu_target', location: best && JSON.parse(best) } });
	};

	const handleMessage = (message: MessageEvent) => {
		if (message.data.type === 'mithril_devtools_from') {
			const { action, payload } = message.data;

			if (action === 'hover') {
				const node = getNodeFromLocation(payload);
				if (node && node instanceof HTMLElement) {
					highlight(node);
				} else if (node && node instanceof Text) {
					const range = document.createRange();
					range.selectNode(node);
					highlight(range);
					range.detach();
				}
			} else if (action === 'mouseout') {
				removeHighlight();
			} else if (action === 'open') {
				if (lastChange) {
					onchange(lastChange);
				}
			}
		}
	};
	return function MithrilDevtoolsRoot() {
		return {
			oninit() {
				window.addEventListener('message', handleMessage);
				window.addEventListener('contextmenu', handleContextMenu, true);
			},
			onremove() {
				window.removeEventListener('message', handleMessage);
				window.removeEventListener('contextmenu', handleContextMenu, true);
			},
			oncreate: onchange,
			onupdate: onchange,
			view,
		};
	};
};

window.__mithril_devtools = {
	components: {},
	dom_nodes: {},
	attach: (view) => {
		return TreeViewer(view);
	},
};
