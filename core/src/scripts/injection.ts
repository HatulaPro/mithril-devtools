import m, { Vnode, Component, Attributes, VnodeDOM, Children } from 'mithril';
import type { TreeNode, InjectionToDevToolsMessage, DevToolsToInjectionMessage, SerializedAttrValue } from './types';

interface InternalVnode extends Vnode<Attributes, {}> {
	instance?: InternalVnode;
	dom?: HTMLElement | Text;
}

interface Mount {
	id: string;
	name: string;
	components: Record<string, Function>;
	dom_nodes: Record<string, HTMLElement | Text | null>;
}

interface AttachResult {
	component: Component<{}, {}>;
	detach: () => void;
}

interface DevToolsGlobal {
	mounts: Map<string, Mount>;
	attach: (view: (vnode: Vnode<Attributes, {}>) => VnodeDOM<Attributes, {}> | null, name?: string) => AttachResult;
}

declare global {
	interface Window {
		__mithril_devtools: DevToolsGlobal;
	}
}

export {};

let mountIdCounter = 0;
const generateMountId = (): string => `mount-${++mountIdCounter}`;

const postToDevTools = (content: InjectionToDevToolsMessage): void => {
	window.postMessage({ type: 'mithril_devtools_to', content });
};

const serializeAttrs = (obj: Record<string, unknown>, maxDepth = 10): string => {
	const seen = new WeakSet<object>();

	const visit = (value: unknown, depth: number): SerializedAttrValue => {
		if (depth > maxDepth) {
			return { __type_internal: 'max_depth_exceeded' };
		}

		if (typeof value === 'function') {
			return { __type_internal: 'function', name: (value as (...args: never[]) => unknown).name };
		}

		if (value === null || value === undefined) {
			return null;
		}

		if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
			return value;
		}

		if (seen.has(value)) {
			return { __type_internal: 'circular' };
		}
		seen.add(value);

		if (value instanceof Date) {
			return { __type_internal: 'date', value: value.toISOString() };
		}

		if (Array.isArray(value)) {
			return { __type_internal: 'array', items: value.map((item) => visit(item, depth + 1)) };
		}

		if (typeof value === 'object') {
			const result: Record<string, SerializedAttrValue> = {};
			for (const [key, val] of Object.entries(value)) {
				result[key] = visit(val, depth + 1);
			}

			return { __type_internal: 'object', name: value.constructor.name, value: result };
		}

		return JSON.stringify(value);
	};

	const sanitized = visit(obj, 0);
	return JSON.stringify(sanitized, null, 4);
};

const copyTree = (tree: InternalVnode, mount: Mount, location: number[] = []): TreeNode | null => {
	if (!tree) return null;
	let tag: string | null = null;
	let isComponent = false;

	if (typeof tree.tag === 'string') {
		tag = tree.tag + (tree.tag === '#' ? 'text: ' + JSON.stringify(tree.children) : '');
	} else if (typeof tree.tag === 'function') {
		tag = (tree.tag as { displayName?: string }).displayName || tree.tag.name || 'Anonymous';
		const locationStr = JSON.stringify(location);
		mount.components[locationStr] = tree.tag;
		mount.dom_nodes[locationStr] = tree.dom || null;
		isComponent = true;
	} else if (typeof tree.tag === 'object' && tree.tag !== null) {
		tag = 'unknown component';
		const locationStr = JSON.stringify(location);
		mount.components[locationStr] = (tree.tag as { view: Function }).view;
		mount.dom_nodes[locationStr] = tree.dom || null;
		isComponent = true;
	}

	const children: (TreeNode | null)[] = [];
	let pushed = 0;
	if (tree.instance) {
		children.push(copyTree(tree.instance, mount, location));
		pushed++;
	}

	if (!isComponent && Array.isArray(tree.children)) {
		const pushChild = (child: Children): void => {
			if (child === null || child === undefined) return;
			if (Array.isArray(child)) {
				child.forEach(pushChild);
				return;
			}
			if (typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean') return;
			if (typeof child === 'object' && 'tag' in child) {
				if (child.tag === '[') {
					const arrChild = child;
					if (Array.isArray(arrChild.children)) {
						arrChild.children.forEach(pushChild);
					}
				} else {
					children.push(copyTree(child as InternalVnode, mount, [...location, pushed]));
					pushed++;
				}
			}
		};
		tree.children.forEach(pushChild);
	}

	const attrs = serializeAttrs(tree.attrs ?? {});

	return { tag, attrs, isComponent, children, location };
};

type LifecycleCallback = (args: VnodeDOM<Attributes, {}>) => void;

const TreeViewer = (view: (vnode: Vnode<Attributes, {}>) => VnodeDOM<Attributes, {}> | null, mount: Mount) => {
	let dom: HTMLElement | Text | null = null;
	let lastChange: VnodeDOM<Attributes, {}> | null = null;

	const onchange: LifecycleCallback = (args) => {
		dom = args.dom as HTMLElement | Text | null;
		lastChange = args;
		mount.components = {};
		mount.dom_nodes = {};
		const tree = copyTree(args as InternalVnode, mount);
		postToDevTools({
			type: 'tree',
			mountId: mount.id,
			mountName: mount.name,
			value: JSON.stringify(tree),
		});
	};

	const getNodeFromLocation = (location: number[]): ChildNode | null => {
		let current: ChildNode | null = dom;

		for (const index of location) {
			if (!current || !('childNodes' in current)) return null;
			current = current.childNodes[index];
		}

		return current || null;
	};

	const removeHighlight = (): void => {
		document.getElementById('mithril_devtools_highlighter')?.remove();
	};

	const highlight = (el: HTMLElement | Range): void => {
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

	const handleContextMenu = (e: MouseEvent): void => {
		const target = e.target as HTMLElement;
		let best: string | null = null;
		for (const [locationStr, node] of Object.entries(mount.dom_nodes)) {
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
		if (best) {
			postToDevTools({
				type: 'contextmenu_target',
				mountId: mount.id,
				location: JSON.parse(best),
			});
		}
	};

	const handleMessage = (message: MessageEvent): void => {
		if (message.data.type === 'mithril_devtools_from') {
			const data = message.data as DevToolsToInjectionMessage;

			if (data.action === 'hover') {
				if (data.mountId !== mount.id) return;
				const node = getNodeFromLocation(data.payload);
				if (node instanceof HTMLElement) {
					highlight(node);
				} else if (node instanceof Text) {
					const range = document.createRange();
					range.selectNode(node);
					highlight(range);
					range.detach();
				}
			} else if (data.action === 'mouseout') {
				if (data.mountId !== mount.id) return;
				removeHighlight();
			} else if (data.action === 'open') {
				if (lastChange) {
					onchange(lastChange);
				}
			}
		}
	};

	let contextMenuHandler: ((e: MouseEvent) => void) | null = null;
	let messageHandler: ((e: MessageEvent) => void) | null = null;

	const component: Component<{}, {}> = {
		oninit() {
			contextMenuHandler = handleContextMenu;
			messageHandler = handleMessage;
			window.addEventListener('message', messageHandler);
			window.addEventListener('contextmenu', contextMenuHandler, true);
		},
		onremove() {
			if (messageHandler) window.removeEventListener('message', messageHandler);
			if (contextMenuHandler) window.removeEventListener('contextmenu', contextMenuHandler, true);
			postToDevTools({
				type: 'mount_removed',
				mountId: mount.id,
			});
			window.__mithril_devtools.mounts.delete(mount.id);
		},
		oncreate: onchange,
		onupdate: onchange,
		view,
	};

	return component;
};

window.__mithril_devtools = {
	mounts: new Map(),
	attach: (view: (vnode: Vnode<Attributes, {}>) => VnodeDOM<Attributes, {}> | null, name?: string): AttachResult => {
		const id = generateMountId();
		const mount: Mount = {
			id,
			name: name || `Mount ${id}`,
			components: {},
			dom_nodes: {},
		};
		window.__mithril_devtools.mounts.set(id, mount);

		postToDevTools({
			type: 'mount_added',
			mountId: id,
			mountName: mount.name,
		});

		const component = TreeViewer(view, mount);

		return {
			component,
			detach: () => {
				window.__mithril_devtools.mounts.delete(id);
				postToDevTools({
					type: 'mount_removed',
					mountId: id,
				});
			},
		};
	},
};
