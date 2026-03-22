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

interface Mount {
	id: string;
	name: string;
	components: Record<string, any>;
	dom_nodes: Record<string, HTMLElement | Text | null>;
}

interface AttachResult {
	component: any;
	detach: () => void;
}

interface DevToolsGlobal {
	mounts: Map<string, Mount>;
	attach: (view: any, name?: string) => AttachResult;
}

declare global {
	interface Window {
		__mithril_devtools: DevToolsGlobal;
	}
}

// Make this file a module
export {};

let mountIdCounter = 0;
const generateMountId = (): string => `mount-${++mountIdCounter}`;

const copyTree = (tree: MithrilNode, mount: Mount, location: number[] = []): TreeNode | null => {
	if (!tree) return null;
	let tag = null;
	let isComponent = false;
	if (typeof tree.tag === 'string') {
		tag = tree.tag + (tree.tag === '#' ? 'text: ' + JSON.stringify(tree.children) : '');
	} else if (typeof tree.tag === 'function') {
		// Prefer displayName (set by devtools wrapper) over function name
		tag = (tree.tag as any).displayName || tree.tag.name || 'Anonymous';
		const locationStr = JSON.stringify(location);
		mount.components[locationStr] = tree.tag;
		mount.dom_nodes[locationStr] = tree.dom || null;
		isComponent = true;
	} else if (typeof tree.tag === 'object') {
		tag = 'unknown component';
		const locationStr = JSON.stringify(location);
		mount.components[locationStr] = tree.tag.view;
		mount.dom_nodes[locationStr] = tree.dom || null;

		isComponent = true;
	}

	let children: (TreeNode | null)[] = [];
	let pushed = 0;
	if (tree.instance) {
		children.push(copyTree(tree.instance, mount, location));
		pushed++;
	}

	// Only process children for non-components.
	// Component children are passed to the view function and already
	// incorporated into the instance tree via vnode.children.
	if (!isComponent && Array.isArray(tree.children)) {
		const pushChild = (child: any) => {
			if (child.tag === '[') {
				child.children.forEach(pushChild);
			} else {
				children.push(copyTree(child, mount, [...location, pushed]));
				pushed++;
			}
		};
		tree.children.forEach(pushChild);
	}
	let attrs = JSON.stringify(
		tree.attrs ?? {},
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

const TreeViewer = (view: any, mount: Mount) => {
	let dom: HTMLElement | Text | null = null;
	let lastChange: any = null;

	function onchange(args: any) {
		dom = args.dom;
		lastChange = args;
		// Clear this mount's component/dom maps before rebuilding
		mount.components = {};
		mount.dom_nodes = {};
		const tree = copyTree(args, mount);
		window.postMessage({
			type: 'mithril_devtools_to',
			content: {
				type: 'tree',
				mountId: mount.id,
				mountName: mount.name,
				value: JSON.stringify(tree),
			},
		});
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
		for (const [locationStr, node] of Object.entries(mount.dom_nodes || {})) {
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
		// Only send message if we found a matching node in this mount
		if (best) {
			window.postMessage({
				type: 'mithril_devtools_to',
				content: {
					type: 'contextmenu_target',
					mountId: mount.id,
					location: JSON.parse(best),
				},
			});
		}
	};

	const handleMessage = (message: MessageEvent) => {
		if (message.data.type === 'mithril_devtools_from') {
			const { action, payload, mountId } = message.data;

			// Only respond to messages for this mount
			if (mountId && mountId !== mount.id) return;

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

	let contextMenuHandler: ((e: MouseEvent) => void) | null = null;
	let messageHandler: ((e: MessageEvent) => void) | null = null;

	return function MithrilDevtoolsRoot() {
		return {
			oninit() {
				contextMenuHandler = handleContextMenu;
				messageHandler = handleMessage;
				window.addEventListener('message', messageHandler);
				window.addEventListener('contextmenu', contextMenuHandler, true);
			},
			onremove() {
				if (messageHandler) window.removeEventListener('message', messageHandler);
				if (contextMenuHandler) window.removeEventListener('contextmenu', contextMenuHandler, true);
				// Notify panel that this mount was removed
				window.postMessage({
					type: 'mithril_devtools_to',
					content: {
						type: 'mount_removed',
						mountId: mount.id,
					},
				});
				window.__mithril_devtools.mounts.delete(mount.id);
			},
			oncreate: onchange,
			onupdate: onchange,
			view,
		};
	};
};

window.__mithril_devtools = {
	mounts: new Map(),
	attach: (view: any, name?: string): AttachResult => {
		const id = generateMountId();
		const mount: Mount = {
			id,
			name: name || `Mount ${id}`,
			components: {},
			dom_nodes: {},
		};
		window.__mithril_devtools.mounts.set(id, mount);

		// Notify panel about new mount
		window.postMessage({
			type: 'mithril_devtools_to',
			content: {
				type: 'mount_added',
				mountId: id,
				mountName: mount.name,
			},
		});

		const component = TreeViewer(view, mount);

		return {
			component,
			detach: () => {
				window.__mithril_devtools.mounts.delete(id);
				window.postMessage({
					type: 'mithril_devtools_to',
					content: {
						type: 'mount_removed',
						mountId: id,
					},
				});
			},
		};
	},
};
