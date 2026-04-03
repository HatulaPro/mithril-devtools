import m, { Component } from 'mithril';
import type { InjectionToDevToolsMessage, SerializedAttrValue, TreeNode } from './types';

function showAttrValue(value: SerializedAttrValue): m.Children {
	if (value === null) return 'null';
	if (typeof value === 'number' && Number.isNaN(value)) return 'NaN';
	if (value === Infinity) return 'Infinity';
	if (value === -Infinity) return '-Infinity';
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return JSON.stringify(value);
	}
	if ('__type_internal' in value) {
		if (value.__type_internal === 'function') {
			return `function ${value.name || 'anonymous_func'}() {}`;
		} else if (value.__type_internal === 'object') {
			return `${value.name} {}`;
		}
	}
	return JSON.stringify(value);
}

interface MountState {
	id: string;
	name: string;
	tree: TreeNode;
}

chrome.devtools.panels.create('Mithril Devtools', 'icon.png', 'panel.html', function (panel) {
	const mounts: Map<string, MountState> = new Map();
	let activeMountId: string = '';
	let panelWindow: Window | null = null;
	let inspecting: TreeNode | null = null;
	let pendingContextMenuLocation: { mountId: string; location: number[] } | null = null;

	const getActiveTree = (): TreeNode | null => {
		if (!activeMountId) return null;
		return mounts.get(activeMountId)?.tree || null;
	};

	try {
		chrome.contextMenus.create({ id: 'mithril_reveal', title: 'Reveal in Mithril Devtools', contexts: ['all'] });
	} catch {}

	chrome.contextMenus.onClicked.addListener((info) => {
		if (info.menuItemId === 'mithril_reveal') {
			if (pendingContextMenuLocation) {
				activeMountId = pendingContextMenuLocation.mountId;
				const tree = getActiveTree();
				if (tree) {
					inspecting = findNodeByLocation(pendingContextMenuLocation.location, tree);
				}
				pendingContextMenuLocation = null;
				m.redraw();
			}
		}
	});
	chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, { type: 'mithril_devtools_from', action: 'open' });

	chrome.runtime.onMessage.addListener((message: InjectionToDevToolsMessage) => {
		if (message.type === 'tree') {
			const tree = JSON.parse(message.value) as TreeNode;
			const existing = mounts.get(message.mountId);
			if (existing) {
				existing.tree = tree;
			} else {
				mounts.set(message.mountId, {
					id: message.mountId,
					name: message.mountName,
					tree,
				});
			}
			if (!activeMountId) {
				activeMountId = message.mountId;
			}
			if (panelWindow) {
				m.redraw();
			}
		} else if (message.type === 'mount_added') {
			if (!mounts.has(message.mountId)) {
				mounts.set(message.mountId, {
					id: message.mountId,
					name: message.mountName,
					tree: { tag: null, attrs: '{}', isComponent: false, children: [], location: [] },
				});
			}
			if (!activeMountId) {
				activeMountId = message.mountId;
			}
			if (panelWindow) {
				m.redraw();
			}
		} else if (message.type === 'mount_removed') {
			mounts.delete(message.mountId);
			if (activeMountId === message.mountId) {
				const remaining = Array.from(mounts.keys());
				if (remaining.length > 0) {
					activeMountId = remaining[0];
				} else {
					activeMountId = '';
					inspecting = null;
				}
			}
			if (panelWindow) {
				m.redraw();
			}
		} else if (message.type === 'contextmenu_target') {
			pendingContextMenuLocation = {
				mountId: message.mountId,
				location: message.location,
			};
		}
	});

	function compareNodes(nodeA: TreeNode, nodeB: TreeNode): boolean {
		return (
			nodeA === nodeB ||
			(nodeA.tag === nodeB.tag && nodeA.location.length === nodeB.location.length && JSON.stringify(nodeA.location) === JSON.stringify(nodeB.location))
		);
	}

	function findNodeInTree(node: TreeNode, tree: TreeNode): TreeNode | null {
		if (compareNodes(node, tree)) return node;
		for (const child of tree.children) {
			if (!child) continue;
			const result = findNodeInTree(node, child);
			if (result) return result;
		}
		return null;
	}

	function findNodeByLocation(location: number[], tree: TreeNode): TreeNode | null {
		if (JSON.stringify(tree.location) === JSON.stringify(location)) return tree;
		for (const child of tree.children) {
			if (!child) continue;
			const result = findNodeByLocation(location, child);
			if (result) return result;
		}
		return null;
	}

	const TreeNodeView: Component<{ node: TreeNode }> = {
		view(vnode) {
			const treeNode = vnode.attrs.node;
			const treeNodeComponentChildren: TreeNode[] = [];

			const pushChildren = (node: TreeNode): void => {
				if (!node.children) return;
				for (const child of node.children) {
					if (!child) continue;
					if (child.isComponent) {
						treeNodeComponentChildren.push(child);
					} else {
						pushChildren(child);
					}
				}
			};
			pushChildren(treeNode);

			return m(
				'li',
				{ class: `node ${inspecting && compareNodes(inspecting, treeNode) ? 'selected' : ''}` },
				m(
					'p',
					{
						onmouseover: () => {
							chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, {
								type: 'mithril_devtools_from',
								action: 'hover',
								mountId: activeMountId,
								payload: treeNode.location,
							});
						},
						onmouseout: () => {
							chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, {
								type: 'mithril_devtools_from',
								action: 'mouseout',
								mountId: activeMountId,
								payload: null,
							});
						},
						onclick: () => {
							inspecting = treeNode;
						},
					},
					treeNodeComponentChildren.length > 0 &&
						m('span', {
							class: 'flipper',
							onclick: (e: MouseEvent) => {
								e.stopPropagation();
								const target = e.currentTarget as HTMLElement;
								target.parentElement!.parentElement!.classList.toggle('closed');
								target.classList.toggle('closed');
							},
						}),
					m('span', { title: treeNode.tag }, treeNode.tag),
					treeNode.isComponent &&
						treeNode.tag !== 'MithrilDevtoolsRoot' &&
						m(
							'button',
							{
								class: 'inspect-button link',
								onclick: (e: Event) => {
									e.stopPropagation();
									chrome.devtools.inspectedWindow.eval(
										`inspect(window.__mithril_devtools.mounts.get('${activeMountId}').components['${JSON.stringify(treeNode.location)}'])`,
									);
									chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, {
										type: 'mithril_devtools_from',
										action: 'mouseout',
										mountId: activeMountId,
										payload: null,
									});
								},
							},
							'see source',
						),
				),
				treeNodeComponentChildren.length > 0 &&
					m(
						'ul',
						treeNodeComponentChildren.map((child) => m(TreeNodeView, { node: child })),
					),
			);
		},
	};

	const MountSelector: Component = {
		view() {
			const mountList = Array.from(mounts.values());
			if (mountList.length === 0) {
				return null;
			}
			if (mountList.length === 1) {
				return m('span.single-mount-label', mountList[0].name);
			}

			return m(
				'select.mount-selector',
				{
					value: activeMountId,
					onchange: (e: Event) => {
						activeMountId = (e.target as HTMLSelectElement).value;
						inspecting = null;
					},
				},
				mountList.map((mount) => m('option', { value: mount.id }, mount.name)),
			);
		},
	};

	const ContentView: Component = {
		view() {
			if (mounts.size === 0) {
				return m('div.no-mounts', 'No Mithril mounts detected. Use window.__mithril_devtools.attach() to register a mount.');
			}
			if (!activeMountId || !mounts.has(activeMountId)) {
				return m('div.no-tree', 'Waiting for tree data...');
			}
			const tree = getActiveTree();
			if (!tree) {
				return m('div.no-tree', 'Waiting for tree data...');
			}
			return m('div', m('ul', m(TreeNodeView, { node: tree })));
		},
	};

	const InspectingView: Component = {
		view() {
			if (!inspecting) {
				return m('div');
			}

			const attrs: [string, SerializedAttrValue][] = Object.entries(JSON.parse(inspecting.attrs));

			return m(
				'div',
				{ style: { display: 'block' } },
				m('h3#inspecting-title', inspecting.tag || 'Unknown'),
				m('hr'),
				m('b', 'Attrs'),
				m(
					'div#inspecting-attrs',
					attrs.length === 0
						? 'This component has no attrs.'
						: attrs.map(([key, value]) => m('div', m('span.property', key), ': ', m('span.value', showAttrValue(value)))),
				),
				m(
					'span#find-in-dom.link',
					{
						onclick: () => {
							if (inspecting && activeMountId) {
								chrome.devtools.inspectedWindow.eval(
									`inspect(window.__mithril_devtools.mounts.get('${activeMountId}').dom_nodes['${JSON.stringify(inspecting.location)}'])`,
								);
							}
						},
					},
					'find in DOM',
				),
			);
		},
	};

	function mount(): void {
		if (!panelWindow) return;

		const content = panelWindow.document.querySelector('#content');
		const inspectingEl = panelWindow.document.querySelector('#inspecting');
		const mountSelectorEl = panelWindow.document.querySelector('#mount-selector');

		if (content) {
			m.mount(content, ContentView);
		}
		if (inspectingEl) {
			m.mount(inspectingEl, InspectingView);
		}
		if (mountSelectorEl) {
			m.mount(mountSelectorEl, MountSelector);
		}
	}

	function unmount(): void {
		if (!panelWindow) return;

		const content = panelWindow.document.querySelector('#content');
		const inspectingEl = panelWindow.document.querySelector('#inspecting');
		const mountSelectorEl = panelWindow.document.querySelector('#mount-selector');

		if (content) {
			m.mount(content, null);
		}
		if (inspectingEl) {
			m.mount(inspectingEl, null);
		}
		if (mountSelectorEl) {
			m.mount(mountSelectorEl, null);
		}
	}

	panel.onShown.addListener((extPanelWindow: Window) => {
		panelWindow = extPanelWindow;
		if (inspecting) {
			const tree = getActiveTree();
			if (tree) {
				const found = findNodeInTree(inspecting, tree);
				if (found) {
					inspecting = found;
				} else {
					inspecting = null;
				}
			}
		}
		mount();
	});

	panel.onHidden.addListener(() => {
		unmount();
		panelWindow = null;
	});
});
