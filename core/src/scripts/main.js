chrome.devtools.panels.create('Mithril Devtools', 'icon.png', 'panel.html', function (panel) {
	let tree = null;
	let panelWindow = null;
	let tabId = null;
	let inspecting = null;
	chrome.runtime.onMessage.addListener((message, { tab }) => {
		tree = JSON.parse(message);
		tabId = tab.id;
		if (panelWindow && tree) {
			render(tree, panelWindow.document.querySelector('#content'));
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
		return m(
			'li',
			{
				className: 'node',
			},
			m(
				'p',
				{
					onmouseover: () => {
						chrome.tabs.sendMessage(tabId, { type: 'mithril_devtools_from', action: 'hover', payload: treeNode.location });
					},
					onmouseout: () => {
						chrome.tabs.sendMessage(tabId, { type: 'mithril_devtools_from', action: 'mouseout', payload: null });
					},
				},
				treeNode.children.length > 0 &&
					m('span', {
						className: 'flipper',
						onclick: (e) => {
							if (treeNode.children.length > 0) {
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
					treeNode.tag
				),
				treeNode.isComponent &&
					m(
						'button',
						{
							className: 'button',
							onclick: (e) => {
								e.stopPropagation();
								chrome.devtools.inspectedWindow.eval(`inspect(window.__mithril_devtools.components['${JSON.stringify(treeNode.location)}'])`);
							},
						},
						'inspect'
					)
			),
			treeNode.children.length > 0 && m('ul', {}, ...treeNode.children.map((child) => buildTreePart(child, tabId)))
		);
	}
	function inspectingPart() {
		if (!inspecting) return null;

		return m('p', {}, `tag: ${inspecting.tag}`, m('br', {}), 'attrs: ', m('br', {}), inspecting.attrs);
	}
	function render(tree, content) {
		content.innerHTML = '';

		if (!tree || !tree.tag) {
			content.innerText = 'can not parse tree';
			return;
		}

		content.appendChild(m('div', {}, m('ul', {}, buildTreePart(tree, tabId)), inspectingPart()));
	}
	panel.onShown.addListener((extPanelWindow) => {
		panelWindow = extPanelWindow;
		if (tabId) {
			render(tree, panelWindow.document.querySelector('#content'), tabId);
		}
	});
	panel.onHidden.addListener(() => {
		panelWindow = null;
	});
});
