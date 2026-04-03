// Shared types between injection.ts (page context) and main.ts (devtools context)
// These types describe the serialized data exchanged between the two contexts.

export interface TreeNode {
	tag: string | null;
	attrs: string;
	isComponent: boolean;
	children: (TreeNode | null)[];
	location: number[];
}

export interface MountInfo {
	mountId: string;
	mountName: string;
}

export type TreeMessage = {
	type: 'tree';
	value: string;
} & MountInfo;

export type MountAddedMessage = {
	type: 'mount_added';
} & MountInfo;

export type MountRemovedMessage = {
	type: 'mount_removed';
	mountId: string;
};

export type ContextMenuTargetMessage = {
	type: 'contextmenu_target';
	location: number[];
	mountId: string;
};

export type InjectionToDevToolsMessage = TreeMessage | MountAddedMessage | MountRemovedMessage | ContextMenuTargetMessage;

export type DevToolsAction = 'hover' | 'mouseout' | 'open';

export type DevToolsToInjectionMessage =
	| { type: 'mithril_devtools_from'; action: 'hover'; mountId: string; payload: number[] }
	| { type: 'mithril_devtools_from'; action: 'mouseout'; mountId: string; payload: null }
	| { type: 'mithril_devtools_from'; action: 'open' };

export type SerializedAttrValue =
	| string
	| number
	| boolean
	| null
	| { __type_internal: 'function'; name: string }
	| { __type_internal: 'object'; name: string };

export type DevToolsMessage =
	| { type: 'mithril_devtools_to'; content: InjectionToDevToolsMessage }
	| { type: 'mithril_devtools_from'; content: DevToolsToInjectionMessage };
