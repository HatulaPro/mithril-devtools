var s = document.createElement('script');
s.src = chrome.runtime.getURL('scripts/attacher.js');
s.onload = function () {
	this.remove();
};
(document.head || document.documentElement).appendChild(s);

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
