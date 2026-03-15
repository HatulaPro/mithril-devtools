chrome.devtools.panels.create('Mithril Devtools', 'icon.png', 'panel.html', function (panel) {
	let tree = null;
	let panelWindow = null;
	let inspecting = null;
	let pendingContextMenuLocation = null;

	chrome.contextMenus.create({ id: 'mithril_reveal', title: 'Reveal in Mithril Devtools', contexts: ['all'] });

	chrome.contextMenus.onClicked.addListener((info) => {
		if (info.menuItemId === 'mithril_reveal') {
			if (tree) {
				inspecting = findNodeByLocation(pendingContextMenuLocation, tree);
				render(tree, panelWindow.document.querySelector('#content'));

				pendingContextMenuLocation = null;
			}
		}
	});
	chrome.tabs.sendMessage(chrome.devtools.inspectedWindow.tabId, { type: 'mithril_devtools_from', action: 'open' });

	chrome.runtime.onMessage.addListener((message) => {
		if (message.type === 'tree') {
			tree = JSON.parse(message.value);
			if (panelWindow && tree) {
				render(tree, panelWindow.document.querySelector('#content'));
			}
		} else if (message.type === 'contextmenu_target') {
			pendingContextMenuLocation = message.location;
		}
	});
	function m(tag, opts, ...children) {
		const el = panelWindow.document.createElement(tag);
		for (const [key, value] of Object.entries(opts)) {
			el[key] = value;
		}
		for (const child of children) {
			if (!child) continue;
			if (typeof child === 'string') {
				el.appendChild(panelWindow.document.createTextNode(child));
			} else {
				el.appendChild(child);
			}
		}

		return el;
	}
	function buildTreePart(treeNode) {
		const treeNodeComponentChildren = [];
		const pushChildren = (node) => {
			if (!node.children) return;

			for (const child of node.children) {
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
						render(tree, panelWindow.document.querySelector('#content'));
					},
				},
				treeNodeComponentChildren.length > 0 &&
					m('span', {
						className: 'flipper',
						onclick: (e) => {
							e.stopPropagation();
							if (treeNodeComponentChildren.length > 0) {
								e.currentTarget.parentElement.parentElement.classList.toggle('closed');
								e.currentTarget.classList.toggle('closed');
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
							onclick: (e) => {
								e.stopPropagation();
								chrome.devtools.inspectedWindow.eval(`inspect(window.__mithril_devtools.components['${JSON.stringify(treeNode.location)}'])`);
							},
						},
						'see source',
					),
			),
			treeNodeComponentChildren.length > 0 && m('ul', {}, ...treeNodeComponentChildren.map((child) => buildTreePart(child))),
		);
	}
	function renderInspecting() {
		const inspectingContainer = panelWindow.document.querySelector('#inspecting');
		if (!inspecting) {
			inspectingContainer.style.display = 'none';
			return;
		}

		inspectingContainer.style.display = 'block';
		const inspectingTitle = panelWindow.document.querySelector('#inspecting-title');
		inspectingTitle.innerText = inspecting.tag;
		const inspectingAttrs = panelWindow.document.querySelector('#inspecting-attrs');
		inspectingAttrs.innerHTML = '';

		const showAttrValue = (value) => {
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

		const attrs = Object.entries(JSON.parse(inspecting.attrs));
		if (attrs.length === 0) {
			inspectingAttrs.innerText = 'This component has no attrs.';
		} else {
			for (const [key, value] of attrs) {
				inspectingAttrs.appendChild(
					m('div', {}, m('span', { className: 'property' }, key), ': ', m('span', { className: 'value' }, showAttrValue(value))),
				);
			}
		}

		const findInDom = panelWindow.document.querySelector('#find-in-dom');
		findInDom.onclick = () => {
			if (inspecting) {
				chrome.devtools.inspectedWindow.eval(`inspect(window.__mithril_devtools.dom_nodes['${JSON.stringify(inspecting.location)}'])`);
			}
		};
	}
	function compareNodes(nodeA, nodeB) {
		return (
			nodeA === nodeB ||
			(nodeA.tag === nodeB.tag && nodeA.location.length === nodeB.location.length && JSON.stringify(nodeA.location) === JSON.stringify(nodeB.location))
		);
	}
	function findNodeInTree(node, tree) {
		if (compareNodes(node, tree)) return node;
		for (const child of tree.children) {
			const result = findNodeInTree(node, child);

			if (result) return result;
		}

		return null;
	}

	function findNodeByLocation(location, tree) {
		if (!tree) return null;
		if (JSON.stringify(tree.location) === JSON.stringify(location)) return tree;
		for (const child of tree.children || []) {
			const result = findNodeByLocation(location, child);
			if (result) return result;
		}
		return null;
	}
	function render(tree, content) {
		content.innerHTML = '';

		if (!tree || !tree.tag) {
			content.innerText = 'can not parse tree';
			return;
		}

		content.appendChild(m('div', {}, m('ul', {}, buildTreePart(tree))));
		renderInspecting();
	}
	panel.onShown.addListener((extPanelWindow) => {
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
