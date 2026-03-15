window.addEventListener('message', (event) => {
	if (event.source != window) return;

	if (event.data.type && event.data.type === 'mithril_devtools_to') {
		chrome.runtime.sendMessage(event.data.content);
	}
});

chrome.runtime.onMessage.addListener((message) => {
	if (message.type === 'mithril_devtools_from') {
		window.postMessage(message);
	}
});
