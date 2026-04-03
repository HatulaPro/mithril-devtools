import type { InjectionToDevToolsMessage, DevToolsToInjectionMessage, DevToolsMessage } from './types';

window.addEventListener('message', (event: MessageEvent) => {
	if (event.source !== window) return;

	if (event.data.type === 'mithril_devtools_to') {
		chrome.runtime.sendMessage(event.data.content as InjectionToDevToolsMessage);
	}
});

chrome.runtime.onMessage.addListener((message: DevToolsMessage) => {
	if (message.type === 'mithril_devtools_from') {
		window.postMessage(message as { type: 'mithril_devtools_from'; content: DevToolsToInjectionMessage });
	}
});
