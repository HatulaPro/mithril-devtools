import m from 'mithril';

interface TreeNode {
	tag: string | null;
	attrs: string;
	isComponent: boolean;
	children: (TreeNode | null)[];
	location: number[];
}

interface DevToolsMessage {
	type: string;
	value?: string;
	action?: string;
	payload?: any;
	location?: number[];
}

chrome.devtools.panels.create('Mithril Devtools', 'icon.png', 'panel.html', function (panel) {
	let tree: TreeNode | null = null;
	let panelWindow: Window | null = null;
	let inspecting: TreeNode | null = null;
	let pendingContextMenuLocation: number[] | null = null;

	chrome.contextMenus.create({ id: 'mithril_reveal', title: 'Reveal in Mithril Devtools', contexts: ['all'] });

	chrome.contextMenus.onClicked.addListener((info) => {
		if (info.menuItemId === 'mithril_reveal') {
			if (tree) {
				inspecting = findNodeByLocation(pendingContextMenuLocation, tree);
				pendingContextMenuLocation = null;
				m.redraw();
			}
		}
	});
	chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, { type: 'mithril_devtools_from', action: 'open' });

	chrome.runtime.onMessage.addListener((message: DevToolsMessage) => {
		if (message.type === 'tree') {
			tree = JSON.parse(message.value || '{}');
			console.log(tree);
			if (panelWindow && tree) {
				m.redraw();
			}
		} else if (message.type === 'contextmenu_target') {
			pendingContextMenuLocation = message.location || null;
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
								payload: treeNode.location,
							});
						},
						onmouseout: () => {
							chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, {
								type: 'mithril_devtools_from',
								action: 'mouseout',
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
						m(
							'button',
							{
								class: 'inspect-button link',
								onclick: (e: Event) => {
									e.stopPropagation();
									chrome.devtools.inspectedWindow.eval(
										`inspect(window.__mithril_devtools.components['${JSON.stringify(treeNode.location)}'])`,
									);
									chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, {
										type: 'mithril_devtools_from',
										action: 'mouseout',
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

	const ContentView: m.Component = {
		view() {
			if (!tree) {
				return 'can not parse tree';
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
							if (inspecting) {
								chrome.devtools.inspectedWindow.eval(`inspect(window.__mithril_devtools.dom_nodes['${JSON.stringify(inspecting.location)}'])`);
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

		if (content) {
			m.mount(content, ContentView);
		}
		if (inspectingEl) {
			m.mount(inspectingEl, InspectingView);
		}
	}

	function unmount(): void {
		if (!panelWindow) return;

		const content = panelWindow.document.querySelector('#content');
		const inspectingEl = panelWindow.document.querySelector('#inspecting');

		if (content) {
			m.mount(content, null);
		}
		if (inspectingEl) {
			m.mount(inspectingEl, null);
		}
	}

	panel.onShown.addListener((extPanelWindow: Window) => {
		panelWindow = extPanelWindow;
		// Update inspecting node in case it was removed
		if (inspecting) {
			inspecting = findNodeInTree(inspecting, tree);
		}
		mount();
	});

	panel.onHidden.addListener(() => {
		unmount();
		panelWindow = null;
	});
});
