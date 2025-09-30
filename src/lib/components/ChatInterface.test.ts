import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { test, expect, describe } from 'vitest';
import ChatInterface from './ChatInterface.svelte';
import type { ChatMessage } from '$lib/types/chat';

describe('ChatInterface', () => {
	test('renders empty chat state correctly', () => {
		const { getByText } = render(ChatInterface, {
			props: {
				messages: [],
				isStreaming: false,
				connectionStatus: 'connected'
			}
		});

		expect(getByText('Start a conversation')).toBeInTheDocument();
		expect(
			getByText('Ask me about your requirements, tasks, or project architecture.')
		).toBeInTheDocument();
	});

	test('displays messages correctly', () => {
		const messages: ChatMessage[] = [
			{
				id: '1',
				role: 'user',
				content: 'Hello',
				timestamp: new Date().toISOString()
			},
			{
				id: '2',
				role: 'assistant',
				content: 'Hi! How can I help you today?',
				timestamp: new Date().toISOString()
			}
		];

		const { getByText } = render(ChatInterface, {
			props: {
				messages,
				isStreaming: false,
				connectionStatus: 'connected'
			}
		});

		expect(getByText('Hello')).toBeInTheDocument();
		expect(getByText('Hi! How can I help you today?')).toBeInTheDocument();
	});

	test('shows connection status correctly', () => {
		const { getByText } = render(ChatInterface, {
			props: {
				messages: [],
				isStreaming: false,
				connectionStatus: 'disconnected'
			}
		});

		expect(getByText('Disconnected')).toBeInTheDocument();
	});

	test('enables send button when input has content and connected', async () => {
		const { getByPlaceholderText, getByLabelText } = render(ChatInterface, {
			props: {
				messages: [],
				isStreaming: false,
				connectionStatus: 'connected'
			}
		});

		const input = getByPlaceholderText('Ask about your project...');
		const sendButton = getByLabelText('Send message');

		// Button should be disabled initially
		expect(sendButton).toBeDisabled();

		// Button should be enabled after typing
		await fireEvent.input(input, { target: { value: 'Test message' } });
		expect(sendButton).not.toBeDisabled();

		// Button should be disabled again when input is cleared
		await fireEvent.input(input, { target: { value: '' } });
		expect(sendButton).toBeDisabled();
	});

	test('disables input when not connected', () => {
		const { getByPlaceholderText, getByLabelText } = render(ChatInterface, {
			props: {
				messages: [],
				isStreaming: false,
				connectionStatus: 'disconnected'
			}
		});

		const input = getByPlaceholderText('Ask about your project...');
		const sendButton = getByLabelText('Send message');

		expect(input).toBeDisabled();
		expect(sendButton).toBeDisabled();
	});

	test('shows streaming indicator for assistant messages', () => {
		const messages: ChatMessage[] = [
			{
				id: '1',
				role: 'assistant',
				content: 'Thinking...',
				timestamp: new Date().toISOString(),
				isStreaming: true
			}
		];

		const { getByText } = render(ChatInterface, {
			props: {
				messages,
				isStreaming: true,
				connectionStatus: 'connected'
			}
		});

		expect(getByText('Assistant is typing...')).toBeInTheDocument();
	});

	test('shows error state for failed messages', () => {
		const messages: ChatMessage[] = [
			{
				id: '1',
				role: 'assistant',
				content: 'Sorry, I encountered an error.',
				timestamp: new Date().toISOString(),
				error: 'Network connection failed'
			}
		];

		const { getByText } = render(ChatInterface, {
			props: {
				messages,
				isStreaming: false,
				connectionStatus: 'connected'
			}
		});

		expect(getByText('Error: Network connection failed')).toBeInTheDocument();
		expect(getByText('Retry')).toBeInTheDocument();
	});
});
