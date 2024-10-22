chrome.devtools.panels.create('Mithril Devtools', 'icon.png', 'panel.html', function (panel) {
	let tree = null;
	let panelWindow = null;
	let tabId = null;
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
	function buildTreePart(tree) {
		return m(
			'li',
			{
				className: `node ${tree.children.length === 0 && 'childless'}`,
			},
			m(
				'p',
				{
					onmouseover: () => {
						chrome.tabs.sendMessage(tabId, { type: 'mithril_devtools_from', action: 'hover', payload: tree.location });
					},
					onmouseout: () => {
						chrome.tabs.sendMessage(tabId, { type: 'mithril_devtools_from', action: 'mouseout', payload: null });
					},
					onclick: (e) => {
						if (tree.children.length > 0) {
							e.currentTarget.parentElement.classList.toggle('closed');
						}
					},
				},
				tree.tag
			),
			tree.children.length > 0 && m('ul', {}, ...tree.children.map((child) => buildTreePart(child, tabId)))
		);
	}
	function render(tree, content) {
		content.innerHTML = '';

		if (!tree || !tree.tag) {
			content.innerText = 'can not parse tree';
			return;
		}

		content.appendChild(m('ul', {}, buildTreePart(tree, tabId)));
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
