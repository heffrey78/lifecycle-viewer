import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage, ToolCall, StreamingOptions } from '$lib/types/chat';
import type { MCPTool } from '$lib/types/mcp-tools';
import { mcpToolDiscovery } from './mcp-tool-discovery';
import { mcpClient } from './mcp-client';
import { usageTracker } from './usage-tracker';
import { apiKeyManager } from './api-key-manager';
import { browser } from '$app/environment';

interface ClaudeApiConfig {
	apiKey: string;
	model?: string;
	maxTokens?: number;
	temperature?: number;
	systemPrompt?: string;
}

export class ClaudeApiService {
	private anthropic: Anthropic | null = null;
	private config: ClaudeApiConfig | null = null;
	private availableTools: MCPTool[] = [];

	constructor() {
		if (!browser) {
			// Server-side initialization if needed
			this.initializeFromEnv();
		} else {
			// Browser-side initialization with secure storage
			this.initializeFromSecureStorage();
		}
	}

	// Get available Claude models
	getAvailableModels() {
		return [
			{
				id: 'claude-3-7-sonnet-latest',
				name: 'Claude 3.7 Sonnet',
				description: 'Best overall performance'
			},
			{ id: 'claude-sonnet-4-0', name: 'Claude 4 Sonnet', description: 'Advanced reasoning' },
			{
				id: 'claude-3-5-haiku-latest',
				name: 'Claude 3.5 Haiku',
				description: 'Fast and efficient'
			},
			{ id: 'claude-opus-4-1', name: 'Claude 4 Opus', description: 'Most capable model' }
		];
	}

	private initializeFromEnv() {
		// For development, we can use environment variables
		// In production, this should be configured through the UI
		const apiKey = process.env.ANTHROPIC_API_KEY;
		if (apiKey) {
			this.configure({ apiKey });
		}
	}

	private async initializeFromSecureStorage() {
		try {
			// Check if API key is configured
			const configResponse = await fetch('/api/config');
			if (configResponse.ok) {
				const configData = await configResponse.json();
				if (configData.data?.isApiKeyConfigured) {
					// Retrieve the decrypted API key
					const keyResponse = await fetch('/api/config/key');
					if (keyResponse.ok) {
						const keyData = await keyResponse.json();
						if (keyData.apiKey) {
							console.log('Claude API: Successfully loaded API key from configuration');
							this.configure({ apiKey: keyData.apiKey });
							return;
						}
					}
				} else {
					console.log('Claude API: No API key configured');
				}
			}
		} catch (error) {
			console.warn('Claude API: Failed to initialize from secure storage:', error);
		}
	}

	configure(config: ClaudeApiConfig) {
		this.config = {
			model: 'claude-3-7-sonnet-latest',
			maxTokens: 4000,
			temperature: 0.7,
			systemPrompt: `You are a helpful assistant for project management and software development lifecycle tasks.

You can analyze uploaded files and documents. When users upload files with content between ===BEGIN FILE CONTENT=== and ===END FILE CONTENT=== markers, read and analyze that content directly.

You have access to MCP tools for managing project lifecycle data. When using tools:

CRITICAL: Always provide the correct parameters when calling tools. Examples:

TASK QUERIES:
- "query not started tasks" → query_tasks with {"status": "Not Started"}
- "show completed tasks" → query_tasks with {"status": "Complete"}
- "find high priority tasks" → query_tasks with {"priority": "P0"}
- "get all tasks" → query_tasks with {} (no filters)

SPECIFIC ITEM LOOKUPS:
- get_task_details requires task_id (e.g., {"task_id": "TASK-0047-00-00"})
- get_requirement_details requires requirement_id (e.g., {"requirement_id": "REQ-0001-FUNC-00"})

STATUS UPDATES:
- update_task_status requires task_id and new_status (e.g., {"task_id": "TASK-0047-00-00", "new_status": "In Progress"})

Valid task statuses: "Not Started", "In Progress", "Blocked", "Complete", "Abandoned"
Valid priorities: "P0", "P1", "P2", "P3"

When users mention status, priority, or specific IDs, extract those exact values and use them as parameters. Always call tools with the appropriate filters based on what the user is asking for.

Be precise with parameter names and values - they must match exactly what the tools expect.`,
			...config
		};

		this.anthropic = new Anthropic({
			apiKey: config.apiKey,
			dangerouslyAllowBrowser: browser // Allow browser usage for development
		});

		// Load available tools
		this.loadAvailableTools();
	}

	private async loadAvailableTools() {
		try {
			// Get tools from the MCP tool discovery service
			const discoverer = mcpToolDiscovery.getDiscoverers().get('lifecycle-mcp');
			if (discoverer) {
				this.availableTools = await discoverer.discoverTools();
				console.log('Loaded MCP tools:', this.availableTools.length);

				// Debug: Log tool schemas to ensure they have proper parameter definitions
				this.availableTools.forEach((tool) => {
					if (tool.inputSchema?.required?.length > 0) {
						console.log(`Tool ${tool.name} requires:`, tool.inputSchema.required);
					}
				});
			}
		} catch (error) {
			console.warn('Failed to load MCP tools:', error);
			this.availableTools = [];
		}
	}

	isConfigured(): boolean {
		return this.anthropic !== null && this.config !== null;
	}

	getConnectionStatus(): 'connected' | 'disconnected' | 'checking' {
		if (!this.config?.apiKey) return 'disconnected';
		if (!this.anthropic) return 'checking';
		return 'connected';
	}

	private convertMCPToolsToClaudeFormat(): Anthropic.Tool[] {
		const claudeTools = this.availableTools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			input_schema: tool.inputSchema
		}));

		// Debug: Log a few example tools to verify schemas
		if (claudeTools.length > 0) {
			console.log('Example tool schema for Claude:', {
				name: claudeTools[0].name,
				input_schema: claudeTools[0].input_schema
			});
		}

		return claudeTools;
	}

	async sendMessage(
		content: string,
		conversationHistory: ChatMessage[] = [],
		options: StreamingOptions = {}
	): Promise<ChatMessage> {
		if (!this.isConfigured()) {
			throw new Error('Claude API not configured. Please set up your API key.');
		}

		const { onStart, onToken, onToolCall, onComplete, onError } = options;

		try {
			onStart?.();

			// Convert conversation history to Claude format
			const messages: Anthropic.MessageParam[] = conversationHistory
				.filter((msg) => msg.role !== 'system' && msg.content && msg.content.trim().length > 0)
				.map((msg) => ({
					role: msg.role as 'user' | 'assistant',
					content: [{ type: 'text', text: msg.content.trim() }]
				}));

			// Add the current user message
			if (content && content.trim().length > 0) {
				console.log(
					'Claude API: Sending message with content length:',
					content.length,
					'characters'
				);

				messages.push({
					role: 'user',
					content: [{ type: 'text', text: content.trim() }]
				});
			}

			// Ensure we have at least one message
			if (messages.length === 0) {
				throw new Error('No valid messages to send');
			}

			// Ensure messages alternate properly (Claude requirement)
			const validatedMessages: Anthropic.MessageParam[] = [];
			let lastRole: 'user' | 'assistant' | null = null;

			for (const message of messages) {
				if (message.role !== lastRole) {
					validatedMessages.push(message);
					lastRole = message.role;
				}
				// Skip consecutive messages from same role
			}

			// Prepare tools for Claude
			const tools = this.convertMCPToolsToClaudeFormat();

			// Create the message with streaming
			const stream = await this.anthropic!.messages.create({
				model: this.config!.model!,
				max_tokens: this.config!.maxTokens!,
				temperature: this.config!.temperature!,
				system: this.config!.systemPrompt!,
				messages: validatedMessages,
				tools: tools.length > 0 ? tools : undefined,
				stream: true
			});

			let fullContent = '';
			let toolCalls: ToolCall[] = [];
			let usage: { input_tokens?: number; output_tokens?: number } = {};
			const messageId = crypto.randomUUID();
			const timestamp = new Date().toISOString();

			// Process the stream
			for await (const chunk of stream) {
				if (chunk.type === 'content_block_start') {
					if (chunk.content_block.type === 'text') {
						// Text content block started
					} else if (chunk.content_block.type === 'tool_use') {
						// Tool use block started
						console.log('Claude tool call received:', {
							name: chunk.content_block.name,
							input: chunk.content_block.input,
							inputType: typeof chunk.content_block.input,
							inputJSON: JSON.stringify(chunk.content_block.input, null, 2)
						});

						const toolCall: ToolCall = {
							id: chunk.content_block.id,
							name: chunk.content_block.name,
							arguments: (chunk.content_block.input as Record<string, any>) || {},
							executedAt: new Date().toISOString()
						};
						toolCalls.push(toolCall);
						onToolCall?.(toolCall);
					}
				} else if (chunk.type === 'content_block_delta') {
					if (chunk.delta.type === 'text_delta') {
						const token = chunk.delta.text;
						fullContent += token;
						onToken?.(token, fullContent);
					} else if (chunk.delta.type === 'input_json_delta') {
						// Tool input arguments are being streamed
						console.log('Tool input delta received:', {
							deltaType: chunk.delta.type,
							partialJson: chunk.delta.partial_json,
							index: chunk.index
						});

						// Find the tool call by index (chunk.index is 1-based, array is 0-based)
						const toolCallIndex = chunk.index - 1;
						if (toolCallIndex >= 0 && toolCallIndex < toolCalls.length) {
							const toolCall = toolCalls[toolCallIndex];
							// Accumulate the JSON string and parse when complete
							if (!toolCall.partialJsonInput) {
								toolCall.partialJsonInput = '';
							}
							toolCall.partialJsonInput += chunk.delta.partial_json;
						}
					}
				} else if (chunk.type === 'content_block_stop') {
					// Content block finished - finalize tool arguments if needed
					const toolCallIndex = chunk.index - 1;
					if (toolCallIndex >= 0 && toolCallIndex < toolCalls.length) {
						const toolCall = toolCalls[toolCallIndex];
						if (toolCall.partialJsonInput) {
							try {
								toolCall.arguments = JSON.parse(toolCall.partialJsonInput);
								console.log('Finalized tool arguments:', toolCall.arguments);
							} catch (error) {
								console.error('Failed to parse tool arguments:', error);
								toolCall.arguments = {};
							}
						}
					}
				} else if (chunk.type === 'message_delta' && chunk.usage) {
					// Track token usage from Claude API
					usage.output_tokens = chunk.usage.output_tokens;
				} else if (chunk.type === 'message_start' && chunk.message.usage) {
					// Track input tokens from Claude API
					usage.input_tokens = chunk.message.usage.input_tokens;
				}
			}

			// Execute any tool calls
			for (const toolCall of toolCalls) {
				try {
					const result = await this.executeToolCall(toolCall);
					toolCall.result = result;
				} catch (error) {
					toolCall.error = error instanceof Error ? error.message : 'Tool execution failed';
				}
			}

			// If there were tool calls, we need to send the results back to Claude
			if (toolCalls.length > 0) {
				// Add tool results to conversation and get Claude's response
				validatedMessages.push({
					role: 'assistant',
					content: [
						{ type: 'text', text: fullContent },
						...toolCalls.map((tc) => ({
							type: 'tool_use' as const,
							id: tc.id,
							name: tc.name,
							input: tc.arguments
						}))
					]
				});

				validatedMessages.push({
					role: 'user',
					content: toolCalls.map((tc) => ({
						type: 'tool_result' as const,
						tool_use_id: tc.id,
						content: tc.error ? `Error: ${tc.error}` : JSON.stringify(tc.result, null, 2)
					}))
				});

				// Get Claude's final response after tool execution
				const finalStream = await this.anthropic!.messages.create({
					model: this.config!.model!,
					max_tokens: this.config!.maxTokens!,
					temperature: this.config!.temperature!,
					system: this.config!.systemPrompt!,
					messages: validatedMessages,
					stream: true
				});

				let finalContent = '';
				for await (const chunk of finalStream) {
					if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
						const token = chunk.delta.text;
						finalContent += token;
						onToken?.(token, fullContent + '\n\n' + finalContent);
					}
				}

				fullContent += '\n\n' + finalContent;
			}

			const responseMessage: ChatMessage = {
				id: messageId,
				role: 'assistant',
				content: fullContent,
				timestamp,
				metadata: {
					toolCalls,
					model: this.config!.model!,
					tokens: {
						input: usage.input_tokens || 0,
						output: usage.output_tokens || 0
					}
				}
			};

			// Track usage for analytics
			if (usage.input_tokens || usage.output_tokens) {
				usageTracker.trackUsage({
					input: usage.input_tokens || 0,
					output: usage.output_tokens || 0,
					model: this.config!.model!,
					timestamp: timestamp
				});
			}

			onComplete?.(responseMessage);
			return responseMessage;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
			onError?.(errorMessage);
			throw new Error(errorMessage);
		}
	}

	private async executeToolCall(toolCall: ToolCall): Promise<any> {
		const { name, arguments: args } = toolCall;

		console.log(`Executing tool ${name} with arguments:`, args);

		try {
			// Ensure MCP client is connected before executing tools
			if (!mcpClient.isConnected()) {
				console.log('MCP client not connected, attempting to connect...');
				await mcpClient.connect();

				// Wait a bit for initialization
				await new Promise((resolve) => setTimeout(resolve, 1000));

				if (!mcpClient.isConnected()) {
					throw new Error('Failed to connect to MCP server for tool execution');
				}
			}

			// Use the MCP client to execute the tool call dynamically
			const result = await mcpClient.sendRequest(name, args);
			console.log(`Tool ${name} result:`, result);
			return result;
		} catch (error) {
			console.error(`Tool execution failed for ${name}:`, error);
			throw error;
		}
	}

	// Method to update API key (for UI configuration)
	async updateApiKey(apiKey: string): Promise<void> {
		try {
			// Store API key using apiKeyManager (handles database storage via MCP bridge)
			await apiKeyManager.storeApiKey(apiKey);

			// Configure the service with the new key
			if (this.config) {
				this.configure({
					...this.config,
					apiKey
				});
			} else {
				this.configure({ apiKey });
			}

			console.log('API key updated and stored securely');
		} catch (error) {
			console.error('Failed to update API key:', error);
			throw error;
		}
	}

	// Get current configuration (without exposing API key)
	getConfig(): Omit<ClaudeApiConfig, 'apiKey'> | null {
		if (!this.config) return null;

		const { apiKey, ...configWithoutKey } = this.config;
		return configWithoutKey;
	}

	// Clear stored API key
	async clearApiKey(): Promise<void> {
		try {
			await apiKeyManager.clearApiKey();
			this.anthropic = null;
			this.config = null;
			console.log('API key cleared from secure storage');
		} catch (error) {
			console.error('Failed to clear API key:', error);
			throw error;
		}
	}

	// Get API key information (without exposing the key itself)
	async getApiKeyInfo(): Promise<{
		isConfigured: boolean;
		keyFormat?: string;
		lastUsed?: Date;
		keyVersion?: number;
	}> {
		try {
			const isConfigured = await apiKeyManager.isConfigured();
			if (!isConfigured) {
				return { isConfigured: false };
			}

			const keyInfo = await apiKeyManager.getKeyInfo();
			return {
				isConfigured: true,
				keyFormat: 'anthropic', // We know it's Anthropic since it's configured
				lastUsed: keyInfo?.lastUsed,
				keyVersion: keyInfo?.keyVersion
			};
		} catch (error) {
			console.error('Failed to get API key info:', error);
			return { isConfigured: false };
		}
	}

	// Rotate API key (store new one, invalidate old)
	async rotateApiKey(newApiKey: string): Promise<void> {
		try {
			await apiKeyManager.rotateApiKey(newApiKey);

			// Update service configuration with new key
			if (this.config) {
				this.configure({
					...this.config,
					apiKey: newApiKey
				});
			} else {
				this.configure({ apiKey: newApiKey });
			}

			console.log('API key rotated successfully');
		} catch (error) {
			console.error('Failed to rotate API key:', error);
			throw error;
		}
	}
}

// Export singleton instance
export const claudeApiService = new ClaudeApiService();
