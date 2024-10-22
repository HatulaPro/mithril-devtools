chrome.devtools.panels.create('Mithril Devtools', 'icon.png', 'panel.html', function (panel) {
	panel.onShown.addListener((extPanelWindow) => {
		function m(tag, opts, ...children) {
			const el = extPanelWindow.document.createElement(tag);
			for (const [key, value] of Object.entries(opts)) {
				el[key] = value;
			}
			for (const child of children) {
				if (!child) continue;
				if (typeof child === 'string') {
					el.appendChild(extPanelWindow.document.createTextNode(child));
				} else {
					el.appendChild(child);
				}
			}

			return el;
		}

		const content = extPanelWindow.document.querySelector('#content');
		let tree = null;

		chrome.runtime.onMessage.addListener((message, { tab }) => {
			tree = JSON.parse(message);

			content.innerHTML = '';
			if (!tree || !tree.tag) {
				content.innerText = 'can not parse tree';
				return;
			}

			content.appendChild(m('ul', {}, buildTreePart(tree)));

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
								chrome.tabs.sendMessage(tab.id, { type: 'mithril_devtools_from', action: 'hover', payload: tree.location });
							},
							onmouseout: () => {
								chrome.tabs.sendMessage(tab.id, { type: 'mithril_devtools_from', action: 'mouseout', payload: null });
							},
							onclick: (e) => {
								if (tree.children.length > 0) {
									e.currentTarget.parentElement.classList.toggle('closed');
								}
							},
						},
						tree.tag
					),
					tree.children.length > 0 && m('ul', {}, ...tree.children.map((child) => buildTreePart(child)))
				);
			}
		});
	});
});
