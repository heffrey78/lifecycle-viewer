import { writable } from 'svelte/store';

export interface ModalState {
	isOpen: boolean;
	title: string;
	size: 'sm' | 'md' | 'lg' | 'xl' | 'full';
	closeOnBackdrop: boolean;
	closeOnEscape: boolean;
	showCloseButton: boolean;
	data?: any; // Generic data payload for the modal content
}

const defaultModalState: ModalState = {
	isOpen: false,
	title: '',
	size: 'md',
	closeOnBackdrop: true,
	closeOnEscape: true,
	showCloseButton: true,
	data: null
};

function createModalStore() {
	const { subscribe, set, update } = writable<ModalState>(defaultModalState);

	return {
		subscribe,
		
		// Open modal with configuration
		open: (config: Partial<ModalState> = {}) => {
			update(state => ({
				...state,
				...config,
				isOpen: true
			}));
		},
		
		// Close modal
		close: () => {
			update(state => ({
				...state,
				isOpen: false
			}));
		},
		
		// Reset to default state
		reset: () => {
			set(defaultModalState);
		},
		
		// Update modal configuration without closing
		updateConfig: (config: Partial<Omit<ModalState, 'isOpen'>>) => {
			update(state => ({
				...state,
				...config
			}));
		},
		
		// Set modal data
		setData: (data: any) => {
			update(state => ({
				...state,
				data
			}));
		}
	};
}

export const modalStore = createModalStore();