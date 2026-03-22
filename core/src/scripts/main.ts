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
				render(tree, panelWindow!.document.querySelector('#content'));

				pendingContextMenuLocation = null;
			}
		}
	});
	chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, { type: 'mithril_devtools_from', action: 'open' });

	chrome.runtime.onMessage.addListener((message: DevToolsMessage) => {
		if (message.type === 'tree') {
			tree = JSON.parse(message.value || '{}');
			if (panelWindow && tree) {
				render(tree, panelWindow!.document.querySelector('#content'));
			}
		} else if (message.type === 'contextmenu_target') {
			pendingContextMenuLocation = message.location || null;
		}
	});
	function m(tag: string, opts: Record<string, any>, ...children: (HTMLElement | string | false | null | undefined)[]): HTMLElement {
		const el = panelWindow!.document.createElement(tag);
		for (const [key, value] of Object.entries(opts)) {
			(el as any)[key] = value;
		}
		for (const child of children) {
			if (!child) continue;
			if (typeof child === 'string') {
				el.appendChild(panelWindow!.document.createTextNode(child));
			} else if (child) {
				el.appendChild(child);
			}
		}

		return el;
	}
	function buildTreePart(treeNode: TreeNode): HTMLElement {
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
			{
				className: `node ${inspecting && compareNodes(inspecting, treeNode) && 'selected'}`,
			},
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
						chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, { type: 'mithril_devtools_from', action: 'mouseout', payload: null });
					},
					onclick: () => {
						inspecting = treeNode;
						render(tree, panelWindow!.document.querySelector('#content'));
					},
				},
				treeNodeComponentChildren.length > 0 &&
					m('span', {
						className: 'flipper',
						onclick: (e: MouseEvent) => {
							e.stopPropagation();
							if (treeNodeComponentChildren.length > 0) {
								(e.currentTarget as HTMLElement).parentElement!.parentElement!.classList.toggle('closed');
								(e.currentTarget as HTMLElement).classList.toggle('closed');
							}
						},
					}),
				m(
					'span',
					{
						title: treeNode.tag,
					},
					treeNode.tag,
				),
				treeNode.isComponent &&
					m(
						'button',
						{
							className: 'inspect-button link',
							onclick: (e: Event) => {
								e.stopPropagation();
								chrome.devtools.inspectedWindow.eval(`inspect(window.__mithril_devtools.components['${JSON.stringify(treeNode.location)}'])`);
							},
						},
						'see source',
					),
			),
			treeNodeComponentChildren.length > 0 && m('ul', {}, ...treeNodeComponentChildren.filter((c) => c !== null).map((child) => buildTreePart(child))),
		);
	}
	function renderInspecting(): void {
		const inspectingContainer = panelWindow!.document.querySelector('#inspecting') as HTMLElement;
		if (!inspecting) {
			inspectingContainer.style.display = 'none';
			return;
		}

		inspectingContainer.style.display = 'block';
		const inspectingTitle = panelWindow!.document.querySelector('#inspecting-title') as HTMLElement;
		inspectingTitle.innerText = inspecting!.tag || 'Unknown';
		const inspectingAttrs = panelWindow!.document.querySelector('#inspecting-attrs') as HTMLElement;
		inspectingAttrs.innerHTML = '';

		const showAttrValue = (value: any): string => {
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
		};

		const attrs = Object.entries(JSON.parse(inspecting!.attrs));
		if (attrs.length === 0) {
			inspectingAttrs.innerText = 'This component has no attrs.';
		} else {
			for (const [key, value] of attrs) {
				inspectingAttrs.appendChild(
					m('div', {}, m('span', { className: 'property' }, key), ': ', m('span', { className: 'value' }, showAttrValue(value))),
				);
			}
		}

		const findInDom = panelWindow!.document.querySelector('#find-in-dom') as HTMLElement;
		findInDom.onclick = () => {
			if (inspecting) {
				chrome.devtools.inspectedWindow.eval(`inspect(window.__mithril_devtools.dom_nodes['${JSON.stringify(inspecting.location)}'])`);
			}
		};
	}
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
	function render(tree: TreeNode | null, content: Element | null): void {
		if (!content) return;
		content.innerHTML = '';

		if (!tree || !tree.tag) {
			(content as HTMLElement).innerText = 'can not parse tree';
			return;
		}

		content.appendChild(m('div', {}, m('ul', {}, buildTreePart(tree))));
		renderInspecting();
	}
	panel.onShown.addListener((extPanelWindow: Window) => {
		panelWindow = extPanelWindow;
		// Update inspecting node in case it was removed
		if (inspecting) {
			inspecting = findNodeInTree(inspecting, tree);
		}
		render(tree, panelWindow.document.querySelector('#content'));
	});
	panel.onHidden.addListener(() => {
		panelWindow = null;
	});
});
