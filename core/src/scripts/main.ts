import m from 'mithril';

interface TreeNode {
	tag: string | null;
	attrs: string;
	isComponent: boolean;
	children: (TreeNode | null)[];
	location: number[];
}

interface MountState {
	id: string;
	name: string;
	tree: TreeNode | null;
}

interface DevToolsMessage {
	type: string;
	value?: string;
	action?: string;
	payload?: any;
	location?: number[];
	mountId?: string;
	mountName?: string;
}

chrome.devtools.panels.create('Mithril Devtools', 'icon.png', 'panel.html', function (panel) {
	const mounts: Map<string, MountState> = new Map();
	let activeMountId: string | null = null;
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
				// Switch to the mount that contains the context menu target
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

	chrome.runtime.onMessage.addListener((message: DevToolsMessage) => {
		if (message.type === 'tree' && message.mountId) {
			const tree = JSON.parse(message.value || '{}');
			const existing = mounts.get(message.mountId);
			if (existing) {
				existing.tree = tree;
			} else {
				mounts.set(message.mountId, {
					id: message.mountId,
					name: message.mountName || message.mountId,
					tree,
				});
			}
			// Auto-select first mount
			if (!activeMountId) {
				activeMountId = message.mountId;
			}
			if (panelWindow) {
				m.redraw();
			}
		} else if (message.type === 'mount_added' && message.mountId) {
			if (!mounts.has(message.mountId)) {
				mounts.set(message.mountId, {
					id: message.mountId,
					name: message.mountName || message.mountId,
					tree: null,
				});
			}
			// Auto-select first mount
			if (!activeMountId) {
				activeMountId = message.mountId;
			}
			if (panelWindow) {
				m.redraw();
			}
		} else if (message.type === 'mount_removed' && message.mountId) {
			mounts.delete(message.mountId);
			// If active mount was removed, select another
			if (activeMountId === message.mountId) {
				const remaining = Array.from(mounts.keys());
				activeMountId = remaining.length > 0 ? remaining[0] : null;
				inspecting = null;
			}
			if (panelWindow) {
				m.redraw();
			}
		} else if (message.type === 'contextmenu_target' && message.mountId) {
			pendingContextMenuLocation = {
				mountId: message.mountId,
				location: message.location || [],
			};
		}
	});

	function compareNodes(nodeA: TreeNode, nodeB: TreeNode): boolean {
		return (
			nodeA === nodeB ||
			(nodeA.tag === nodeB.tag && nodeA.location.length === nodeB.location.length && JSON.stringify(nodeA.location) === JSON.stringify(nodeB.location))
		);
	}

	function findNodeInTree(node: TreeNode, tree: TreeNode | null): TreeNode | null {
		if (!tree) return null;
		if (compareNodes(node, tree)) return node;
		for (const child of tree.children) {
			if (!child) continue;
			const result = findNodeInTree(node, child);
			if (result) return result;
		}
		return null;
	}

	function findNodeByLocation(location: number[] | null, tree: TreeNode | null): TreeNode | null {
		if (!tree) return null;
		if (JSON.stringify(tree.location) === JSON.stringify(location)) return tree;
		for (const child of tree.children || []) {
			const result = findNodeByLocation(location, child);
			if (result) return result;
		}
		return null;
	}

	function showAttrValue(value: any): string {
		if (value === null) return 'null';
		if (value === undefined) return 'undefined';
		if (Number.isNaN(value)) return 'NaN';
		if (value === Infinity) return 'Infinity';
		if (value === -Infinity) return '-Infinity';
		if (typeof value === 'bigint') return `${value.toString()}n`;
		if (['string', 'number', 'boolean'].includes(typeof value)) {
			return JSON.stringify(value);
		}
		if (value.__type_internal) {
			if (value.__type_internal === 'function') {
				return `function ${value.name || 'anonymous_func'}() {}`;
			} else {
				return `${value.__type_internal} {}`;
			}
		}
		return JSON.stringify(value);
	}

	const TreeNodeView: m.Component<{ node: TreeNode }> = {
		view(vnode) {
			const treeNode = vnode.attrs.node;
			const treeNodeComponentChildren: TreeNode[] = [];

			const pushChildren = (node: TreeNode | null) => {
				if (!node || !node.children) return;
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

	const MountSelector: m.Component = {
		view() {
			const mountList = Array.from(mounts.values());
			if (mountList.length === 0) {
				return null;
			}
			if (mountList.length === 1) {
				// Show mount name but no selector when only one mount
				return m('span.single-mount-label', mountList[0].name);
			}

			return m(
				'select.mount-selector',
				{
					value: activeMountId,
					onchange: (e: Event) => {
						activeMountId = (e.target as HTMLSelectElement).value;
						inspecting = null; // Clear selection when switching mounts
					},
				},
				mountList.map((mount) => m('option', { value: mount.id }, mount.name)),
			);
		},
	};

	const ContentView: m.Component = {
		view() {
			const tree = getActiveTree();
			if (mounts.size === 0) {
				return m('div.no-mounts', 'No Mithril mounts detected. Use window.__mithril_devtools.attach() to register a mount.');
			}
			if (!tree) {
				return m('div.no-tree', 'Waiting for tree data...');
			}
			return m('div', m('ul', m(TreeNodeView, { node: tree })));
		},
	};

	const InspectingView: m.Component = {
		view() {
			if (!inspecting) {
				return m('div');
			}

			const attrs = Object.entries(JSON.parse(inspecting.attrs));

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
		// Update inspecting node in case it was removed
		if (inspecting) {
			inspecting = findNodeInTree(inspecting, getActiveTree());
		}
		mount();
	});

	panel.onHidden.addListener(() => {
		unmount();
		panelWindow = null;
	});
});
