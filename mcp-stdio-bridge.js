#!/usr/bin/env node

/**
 * MCP Stdio-to-WebSocket Bridge Server
 *
 * This server creates a bridge between WebSocket clients (browsers) and
 * stdio-based MCP servers like lifecycle-mcp. It enables browser-based
 * applications to communicate with MCP servers that use stdio transport.
 *
 * Usage: node mcp-stdio-bridge.js [--mcp-command="python -m lifecycle_mcp"] [--port=3000]
 */

import WebSocket, { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import path from 'path';

class MCPStdioBridge {
	constructor(options = {}) {
		this.port = options.port || 3000;
		this.mcpCommand = options.mcpCommand || 'lifecycle-mcp';
		this.mcpArgs = this.mcpCommand.split(' ').slice(1);
		this.mcpExecutable = this.mcpCommand.split(' ')[0];
		this.currentDatabase = null; // Track current database path

		this.server = null;
		this.mcpProcess = null;
		this.clients = new Set();
		this.messageQueue = [];
		this.mcpReady = false;
		this.pendingMessages = new Map(); // messageId -> client mapping

		console.log(`🌉 MCP Stdio Bridge starting...`);
		console.log(`   WebSocket port: ${this.port}`);
		console.log(`   MCP command: ${this.mcpCommand}`);
	}

	async start() {
		try {
			await this.launchMCPServer();
			await this.startWebSocketServer();
			console.log(`✅ Bridge ready! Connect to ws://localhost:${this.port}/mcp`);
		} catch (error) {
			console.error('❌ Failed to start bridge:', error.message);
			process.exit(1);
		}
	}

	async launchMCPServer() {
		return new Promise((resolve, reject) => {
			console.log(`🚀 Launching MCP server: ${this.mcpCommand}`);

			// Set up environment with database path
			const mcpEnv = {
				...process.env,
				PYTHONUNBUFFERED: '1'
			};

			// Set the database path if we have a current database
			if (this.currentDatabase) {
				mcpEnv.LIFECYCLE_DB = this.currentDatabase;
				console.log(`🔧 Setting LIFECYCLE_DB environment variable: ${this.currentDatabase}`);
			}

			this.mcpProcess = spawn(this.mcpExecutable, this.mcpArgs, {
				stdio: ['pipe', 'pipe', 'inherit'],
				env: mcpEnv
			});

			this.mcpProcess.on('error', (error) => {
				console.error('❌ Failed to start MCP process:', error.message);
				reject(error);
			});

			this.mcpProcess.on('exit', (code, signal) => {
				console.log(`⚠️  MCP process exited: code=${code}, signal=${signal}`);
				this.mcpReady = false;
				// Notify all clients of disconnection
				this.broadcastError('MCP server process exited unexpectedly');
			});

			// Initialize chat database schema if database is available
			setTimeout(async () => {
				if (this.currentDatabase && !this.mcpProcess.killed) {
					try {
						await this.initializeChatSchema();
					} catch (error) {
						console.warn('⚠️  Failed to initialize chat schema:', error.message);
					}
				}
			}, 2000); // Wait for MCP server to fully start

			// Handle responses from MCP server
			let buffer = '';
			this.mcpProcess.stdout.on('data', (data) => {
				buffer += data.toString();
				const lines = buffer.split('\n');
				buffer = lines.pop() || ''; // Keep incomplete line in buffer

				lines.forEach((line) => {
					if (line.trim()) {
						try {
							const message = JSON.parse(line);
							this.handleMCPResponse(message);
						} catch (error) {
							console.warn('⚠️  Invalid JSON from MCP server:', line);
						}
					}
				});
			});

			// Wait a moment for process to initialize
			setTimeout(() => {
				if (!this.mcpProcess.killed) {
					this.mcpReady = true;
					console.log('✅ MCP server process started successfully');
					resolve();
				} else {
					reject(new Error('MCP process died during startup'));
				}
			}, 1000);
		});
	}

	async startWebSocketServer() {
		this.server = new WebSocketServer({
			port: this.port,
			path: '/mcp'
		});

		this.server.on('connection', (ws, req) => {
			const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
			console.log(`🔌 Client connected: ${clientId}`);

			this.clients.add(ws);

			// Send any queued messages
			this.messageQueue.forEach((message) => {
				ws.send(JSON.stringify(message));
			});

			ws.on('message', async (data) => {
				try {
					const message = JSON.parse(data.toString());
					console.log(`📨 Received from client ${clientId}:`, message);
					await this.handleWebSocketMessage(message, ws);
				} catch (error) {
					console.error('❌ Invalid JSON from client:', data.toString());
					ws.send(
						JSON.stringify({
							jsonrpc: '2.0',
							error: { code: -32700, message: 'Parse error' }
						})
					);
				}
			});

			ws.on('close', () => {
				console.log(`🔌 Client disconnected: ${clientId}`);
				this.clients.delete(ws);
			});

			ws.on('error', (error) => {
				console.error(`❌ WebSocket error from ${clientId}:`, error.message);
				this.clients.delete(ws);
			});
		});

		console.log(`🌐 WebSocket server listening on port ${this.port}`);
	}

	async handleWebSocketMessage(message, client) {
		// Handle database switching commands (check for tools/call with database methods)
		if (message.method === 'tools/call' && message.params?.name === 'database/switch') {
			try {
				const databasePath = message.params?.arguments?.database;
				if (!databasePath) {
					throw new Error('Database path is required');
				}

				console.log(`🔄 Handling database switch request: ${databasePath}`);
				await this.switchDatabase(databasePath);

				const response = {
					jsonrpc: '2.0',
					id: message.id,
					result: {
						content: [
							{
								type: 'text',
								text: JSON.stringify({ success: true, database: databasePath })
							}
						],
						isError: false
					}
				};
				this.broadcastMessage(response, client);
			} catch (error) {
				console.error(`❌ Database switch failed:`, error.message);
				const errorResponse = {
					jsonrpc: '2.0',
					id: message.id,
					result: {
						content: [
							{
								type: 'text',
								text: `Database switch failed: ${error.message}`
							}
						],
						isError: true
					}
				};
				this.broadcastMessage(errorResponse, client);
			}
			return;
		}

		// Handle get current database
		if (message.method === 'tools/call' && message.params?.name === 'database/current') {
			console.log(`📋 Handling get current database request`);
			const response = {
				jsonrpc: '2.0',
				id: message.id,
				result: {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ database: this.currentDatabase })
						}
					],
					isError: false
				}
			};
			this.broadcastMessage(response, client);
			return;
		}

		// Handle chat operations
		if (message.method === 'tools/call' && message.params?.name?.startsWith('chat/')) {
			try {
				console.log(`💬 Handling chat operation: ${message.params.name}`);
				const result = await this.handleChatOperation(
					message.params.name,
					message.params.arguments || {}
				);

				const response = {
					jsonrpc: '2.0',
					id: message.id,
					result: {
						content: [
							{
								type: 'text',
								text: JSON.stringify(result)
							}
						],
						isError: false
					}
				};
				this.broadcastMessage(response, client);
			} catch (error) {
				console.error(`❌ Chat operation failed:`, error.message);
				const errorResponse = {
					jsonrpc: '2.0',
					id: message.id,
					result: {
						content: [
							{
								type: 'text',
								text: `Chat operation failed: ${error.message}`
							}
						],
						isError: true
					}
				};
				this.broadcastMessage(errorResponse, client);
			}
			return;
		}

		// Handle file picker request
		if (message.method === 'tools/call' && message.params?.name === 'database/pick') {
			try {
				console.log(`📁 Handling database file picker request`);
				const { spawn } = await import('child_process');

				// Use zenity file picker on Linux
				const zenity = spawn('zenity', [
					'--file-selection',
					'--title=Select Lifecycle Database',
					'--file-filter=SQLite Database (*.db)|*.db',
					'--file-filter=All files|*'
				]);

				let selectedPath = '';
				zenity.stdout.on('data', (data) => {
					selectedPath += data.toString().trim();
				});

				zenity.on('close', (code) => {
					if (code === 0 && selectedPath) {
						const response = {
							jsonrpc: '2.0',
							id: message.id,
							result: {
								content: [
									{
										type: 'text',
										text: JSON.stringify({ path: selectedPath, success: true })
									}
								],
								isError: false
							}
						};
						this.broadcastMessage(response, client);
					} else {
						const response = {
							jsonrpc: '2.0',
							id: message.id,
							result: {
								content: [
									{
										type: 'text',
										text: JSON.stringify({ path: null, success: false, cancelled: true })
									}
								],
								isError: false
							}
						};
						this.broadcastMessage(response, client);
					}
				});
			} catch (error) {
				console.error(`❌ File picker failed:`, error.message);
				const errorResponse = {
					jsonrpc: '2.0',
					id: message.id,
					result: {
						content: [
							{
								type: 'text',
								text: JSON.stringify({ path: null, success: false, error: error.message })
							}
						],
						isError: true
					}
				};
				this.broadcastMessage(errorResponse, client);
			}
			return;
		}

		// Handle master password operations (before forwarding to MCP server)
		if (
			message.method === 'tools/call' &&
			message.params?.name &&
			(message.params.name.includes('master_password') ||
				message.params.name.includes('backup_code'))
		) {
			try {
				console.log(`🔐 Handling master password operation: ${message.params.name}`);
				const result = await this.handleMasterPasswordOperation(
					message.params.name,
					message.params.arguments || {}
				);
				const response = {
					jsonrpc: '2.0',
					id: message.id,
					result: {
						content: [
							{
								type: 'text',
								text: JSON.stringify(result)
							}
						],
						isError: false
					}
				};
				this.broadcastMessage(response, client);
			} catch (error) {
				console.error(`❌ Master password operation failed:`, error.message);
				const errorResponse = {
					jsonrpc: '2.0',
					id: message.id,
					result: {
						content: [
							{
								type: 'text',
								text: JSON.stringify({ success: false, error: error.message })
							}
						],
						isError: true
					}
				};
				this.broadcastMessage(errorResponse, client);
			}
			return;
		}

		if (!this.mcpReady || !this.mcpProcess) {
			const errorResponse = {
				jsonrpc: '2.0',
				id: message.id,
				error: {
					code: -32000,
					message: 'MCP server not available'
				}
			};
			this.broadcastMessage(errorResponse, client);
			return;
		}

		// Track which client sent this message
		if (message.id) {
			this.pendingMessages.set(message.id, client);
		}

		try {
			const jsonMessage = JSON.stringify(message) + '\n';
			console.log(`📤 Sending to MCP server:`, message);
			this.mcpProcess.stdin.write(jsonMessage, 'utf8');
		} catch (error) {
			console.error('❌ Error sending to MCP server:', error.message);
			const errorResponse = {
				jsonrpc: '2.0',
				id: message.id,
				error: {
					code: -32000,
					message: 'Failed to send message to MCP server'
				}
			};
			this.broadcastMessage(errorResponse, client);
		}
	}

	handleMCPResponse(message) {
		console.log(`📥 Received from MCP server:`, JSON.stringify(message, null, 2));

		// Route response back to the client that sent the request
		if (message.id && this.pendingMessages.has(message.id)) {
			const targetClient = this.pendingMessages.get(message.id);
			this.pendingMessages.delete(message.id);
			this.broadcastMessage(message, targetClient);
		} else {
			// Broadcast to all clients (for notifications, etc.)
			this.broadcastMessage(message);
		}
	}

	broadcastMessage(message, targetClient = null) {
		const messageStr = JSON.stringify(message);

		if (targetClient && targetClient.readyState === WebSocket.OPEN) {
			// Send to specific client
			targetClient.send(messageStr);
		} else {
			// Broadcast to all clients
			this.clients.forEach((client) => {
				if (client.readyState === WebSocket.OPEN) {
					client.send(messageStr);
				}
			});
		}

		// Keep recent messages for new clients (only for broadcasts)
		if (!targetClient) {
			this.messageQueue.push(message);
			if (this.messageQueue.length > 100) {
				this.messageQueue.shift();
			}
		}
	}

	broadcastError(errorMessage) {
		const error = {
			jsonrpc: '2.0',
			error: {
				code: -32000,
				message: errorMessage
			}
		};
		this.broadcastMessage(error);
	}

	async switchDatabase(databasePath) {
		console.log(`🔄 Switching database to: ${databasePath}`);

		try {
			// Validate database path exists
			const fs = await import('fs');
			if (!fs.existsSync(databasePath)) {
				throw new Error(`Database file not found: ${databasePath}`);
			}

			// Store new database path
			this.currentDatabase = databasePath;

			// Shut down current MCP process
			if (this.mcpProcess && !this.mcpProcess.killed) {
				console.log('⏹️  Stopping current MCP server...');
				this.mcpReady = false;
				this.mcpProcess.kill('SIGTERM');

				// Wait for process to exit
				await new Promise((resolve) => {
					this.mcpProcess.on('exit', resolve);
					setTimeout(resolve, 3000); // Force continue after 3 seconds
				});
			}

			// Update command with new database - don't modify the command, just set the environment
			this.mcpCommand = `lifecycle-mcp`;
			this.mcpArgs = [];
			this.mcpExecutable = this.mcpCommand;

			console.log(`📝 Updated MCP command: ${this.mcpCommand}`);

			// Launch new MCP server with new database
			await this.launchMCPServer();

			// Wait for MCP server to be fully ready before allowing requests
			await this.waitForMCPReady();

			// Notify all clients of successful database switch
			this.broadcastMessage({
				jsonrpc: '2.0',
				method: 'database/switched',
				params: {
					database: databasePath,
					success: true
				}
			});

			console.log(`✅ Database switched successfully to: ${databasePath}`);
			return true;
		} catch (error) {
			console.error(`❌ Failed to switch database:`, error.message);

			// Notify clients of failure
			this.broadcastMessage({
				jsonrpc: '2.0',
				method: 'database/switch_failed',
				params: {
					database: databasePath,
					error: error.message
				}
			});

			throw error;
		}
	}

	async waitForMCPReady() {
		if (!this.mcpProcess || this.mcpProcess.killed) {
			throw new Error('MCP process not available');
		}

		// Send initialize request to new MCP server and wait for response
		return new Promise((resolve, reject) => {
			const initMessage = {
				jsonrpc: '2.0',
				id: 999999, // Use high ID to avoid conflicts
				method: 'initialize',
				params: {
					protocolVersion: '2024-11-05',
					capabilities: { tools: {} },
					clientInfo: { name: 'lifecycle-bridge', version: '1.0.0' }
				}
			};

			// Set up temporary handler for this initialization
			const tempHandler = (message) => {
				if (message.id === 999999) {
					if (message.error) {
						console.error('❌ MCP initialization failed:', message.error);
						reject(new Error(`MCP initialization failed: ${message.error.message}`));
					} else {
						console.log('✅ MCP server fully initialized after database switch');

						// Send initialized notification
						const notifyMessage = {
							jsonrpc: '2.0',
							method: 'notifications/initialized'
						};
						this.mcpProcess.stdin.write(JSON.stringify(notifyMessage) + '\n', 'utf8');

						resolve();
					}
				}
			};

			// Temporarily listen for the init response
			const originalHandler = this.handleMCPResponse.bind(this);
			this.handleMCPResponse = (message) => {
				tempHandler(message);
				if (message.id !== 999999) {
					originalHandler(message);
				}
			};

			// Send initialization request
			try {
				this.mcpProcess.stdin.write(JSON.stringify(initMessage) + '\n', 'utf8');
				console.log('📤 Sent MCP initialization request after database switch');

				// Restore original handler after timeout
				setTimeout(() => {
					this.handleMCPResponse = originalHandler;
					reject(new Error('MCP initialization timeout after database switch'));
				}, 10000);
			} catch (error) {
				this.handleMCPResponse = originalHandler;
				reject(error);
			}
		});
	}

	getCurrentDatabase() {
		return this.currentDatabase;
	}

	/**
	 * Handle chat-related WebSocket operations
	 * Routes chat operations to appropriate database methods
	 */
	async handleChatOperation(operation, args) {
		if (!this.currentDatabase) {
			throw new Error('No database connected. Please switch to a database first.');
		}

		// Import better-sqlite3 for database operations
		const { default: Database } = await import('better-sqlite3');
		const db = new Database(this.currentDatabase);

		try {
			const result = await this.executeChatOperation(db, operation, args);
			db.close();
			return result;
		} catch (error) {
			db.close();
			throw error;
		}
	}

	/**
	 * Execute specific chat database operations
	 */
	async executeChatOperation(db, operation, args) {
		const userId = args.user_id || 'default-user';

		switch (operation) {
			case 'chat/create_thread':
				return this.createChatThread(db, userId, args);

			case 'chat/get_threads':
				return this.getChatThreads(db, userId, args);

			case 'chat/get_current_thread':
				return this.getCurrentChatThread(db, userId);

			case 'chat/switch_thread':
				return this.switchChatThread(db, userId, args.thread_id);

			case 'chat/add_message':
				return this.addChatMessage(db, userId, args);

			case 'chat/update_thread_title':
				return this.updateChatThreadTitle(db, userId, args.thread_id, args.title);

			case 'chat/delete_thread':
				return this.deleteChatThread(db, userId, args.thread_id);

			case 'chat/search_conversations':
				return this.searchChatConversations(db, userId, args);

			case 'chat/export_thread':
				return this.exportChatThread(db, userId, args.thread_id, args.format);

			case 'chat/get_storage_stats':
				return this.getChatStorageStats(db, userId);

			case 'chat/store_api_key':
				return this.storeChatApiKey(db, userId, args);

			case 'chat/get_api_key':
				return this.getChatApiKey(db, userId, args);

			case 'chat/clear_api_key':
				return this.clearChatApiKey(db, userId, args);

			// Master password operations
			case 'store_master_password_settings':
				return this.storeMasterPasswordSettings(db, userId, args);

			case 'verify_master_password':
				return this.verifyMasterPassword(db, userId, args);

			case 'get_master_password_settings':
				return this.getMasterPasswordSettings(db, userId, args);

			case 'store_backup_codes':
				return this.storeBackupCodes(db, userId, args);

			case 'validate_backup_code':
				return this.validateBackupCode(db, userId, args);

			default:
				throw new Error(`Unknown chat operation: ${operation}`);
		}
	}

	/**
	 * Create a new chat conversation thread
	 */
	async createChatThread(db, userId, args) {
		const now = new Date().toISOString();
		const threadId = this.generateUUID();
		const title = args.title || `Conversation ${new Date().toLocaleDateString()}`;

		const stmt = db.prepare(`
			INSERT INTO conversations (
				id, user_id, title, created_at, updated_at,
				is_archived, is_pinned, message_count, total_tokens_used
			) VALUES (?, ?, ?, ?, ?, false, false, 0, 0)
		`);

		stmt.run(threadId, userId, title, now, now);

		return {
			success: true,
			thread: {
				id: threadId,
				title: title,
				messages: [],
				createdAt: now,
				updatedAt: now,
				metadata: {
					totalTokens: 0,
					averageResponseTime: 0,
					tags: []
				}
			}
		};
	}

	/**
	 * Get all chat threads for a user
	 */
	async getChatThreads(db, userId, args) {
		const query = `
			SELECT * FROM conversations
			WHERE user_id = ? AND is_archived = ?
			ORDER BY updated_at DESC
			${args.limit ? `LIMIT ${parseInt(args.limit)}` : ''}
		`;

		const isArchived = args.include_archived ? [false, true] : [false];
		const threads = [];

		for (const archived of isArchived) {
			const results = db.prepare(query).all(userId, archived);
			threads.push(...results.map((conv) => this.convertToThreadSummary(conv)));
		}

		return {
			success: true,
			threads: threads.sort(
				(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
			)
		};
	}

	/**
	 * Get current active thread for user
	 */
	async getCurrentChatThread(db, userId) {
		const conversation = db
			.prepare(
				`
			SELECT * FROM conversations
			WHERE user_id = ? AND is_archived = false
			ORDER BY updated_at DESC
			LIMIT 1
		`
			)
			.get(userId);

		if (!conversation) {
			return { success: true, thread: null };
		}

		const thread = await this.convertToFullThread(db, conversation);
		return { success: true, thread };
	}

	/**
	 * Switch to a specific thread
	 */
	async switchChatThread(db, userId, threadId) {
		// Verify thread exists and belongs to user
		const conversation = db
			.prepare(
				`
			SELECT id FROM conversations
			WHERE id = ? AND user_id = ?
		`
			)
			.get(threadId, userId);

		if (!conversation) {
			throw new Error(`Thread ${threadId} not found`);
		}

		// Update last accessed time
		db.prepare(
			`
			UPDATE conversations
			SET updated_at = datetime('now')
			WHERE id = ? AND user_id = ?
		`
		).run(threadId, userId);

		return { success: true, threadId };
	}

	/**
	 * Add a message to a thread
	 */
	async addChatMessage(db, userId, args) {
		const { thread_id: threadId, message } = args;
		const now = new Date().toISOString();
		const messageId = message.id || this.generateUUID();

		// Start transaction for consistency
		const addMessageTransaction = db.transaction(() => {
			// Get current sequence number
			const sequenceResult = db
				.prepare(
					`
				SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_seq
				FROM messages WHERE conversation_id = ?
			`
				)
				.get(threadId);

			const sequenceNumber = sequenceResult.next_seq;

			// Insert message
			db.prepare(
				`
				INSERT INTO messages (
					id, conversation_id, role, content, sequence_number,
					created_at, model, input_tokens, output_tokens,
					processing_time_ms, error_message, is_streaming
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`
			).run(
				messageId,
				threadId,
				message.role,
				message.content,
				sequenceNumber,
				now,
				message.metadata?.model || null,
				message.metadata?.tokens?.input || null,
				message.metadata?.tokens?.output || null,
				message.metadata?.processingTime || null,
				message.error || null,
				message.metadata?.isStreaming || false
			);

			// Insert tool calls if present
			if (message.metadata?.toolCalls) {
				for (const toolCall of message.metadata.toolCalls) {
					db.prepare(
						`
						INSERT INTO tool_calls (
							id, message_id, tool_name, arguments, result,
							execution_time_ms, error_message, created_at
						) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
					`
					).run(
						this.generateUUID(),
						messageId,
						toolCall.name,
						JSON.stringify(toolCall.arguments),
						toolCall.result ? JSON.stringify(toolCall.result) : null,
						toolCall.executionTime || null,
						toolCall.error || null,
						now
					);
				}
			}

			// Update conversation statistics
			const tokenCount =
				(message.metadata?.tokens?.input || 0) + (message.metadata?.tokens?.output || 0);
			db.prepare(
				`
				UPDATE conversations
				SET message_count = message_count + 1,
					total_tokens_used = total_tokens_used + ?,
					updated_at = ?
				WHERE id = ?
			`
			).run(tokenCount, now, threadId);
		});

		addMessageTransaction();

		return { success: true, messageId };
	}

	/**
	 * Helper method to convert database conversation to thread summary
	 */
	convertToThreadSummary(conversation) {
		return {
			id: conversation.id,
			title: conversation.title,
			createdAt: conversation.created_at,
			updatedAt: conversation.updated_at,
			metadata: {
				totalTokens: conversation.total_tokens_used || 0,
				messageCount: conversation.message_count || 0
			}
		};
	}

	/**
	 * Helper method to convert database conversation to full thread with messages
	 */
	async convertToFullThread(db, conversation) {
		// Get messages for this conversation
		const messages = db
			.prepare(
				`
			SELECT m.*,
				   GROUP_CONCAT(tc.tool_name) as tool_names,
				   GROUP_CONCAT(tc.arguments) as tool_arguments,
				   GROUP_CONCAT(tc.result) as tool_results,
				   GROUP_CONCAT(tc.error_message) as tool_errors
			FROM messages m
			LEFT JOIN tool_calls tc ON m.id = tc.message_id
			WHERE m.conversation_id = ?
			GROUP BY m.id
			ORDER BY m.sequence_number ASC
		`
			)
			.all(conversation.id);

		const chatMessages = messages.map((msg) => {
			const toolCalls = [];

			if (msg.tool_names) {
				const names = msg.tool_names.split(',');
				const args = msg.tool_arguments ? msg.tool_arguments.split(',') : [];
				const results = msg.tool_results ? msg.tool_results.split(',') : [];
				const errors = msg.tool_errors ? msg.tool_errors.split(',') : [];

				for (let i = 0; i < names.length; i++) {
					toolCalls.push({
						name: names[i],
						arguments: args[i] ? JSON.parse(args[i]) : {},
						result: results[i] ? JSON.parse(results[i]) : null,
						error: errors[i] || null
					});
				}
			}

			return {
				id: msg.id,
				role: msg.role,
				content: msg.content,
				timestamp: msg.created_at,
				error: msg.error_message || undefined,
				metadata: {
					model: msg.model || undefined,
					tokens:
						msg.input_tokens && msg.output_tokens
							? {
									input: msg.input_tokens,
									output: msg.output_tokens
								}
							: undefined,
					processingTime: msg.processing_time_ms || undefined,
					isStreaming: msg.is_streaming || false,
					toolCalls: toolCalls.length > 0 ? toolCalls : undefined
				}
			};
		});

		return {
			id: conversation.id,
			title: conversation.title,
			messages: chatMessages,
			createdAt: conversation.created_at,
			updatedAt: conversation.updated_at,
			metadata: {
				totalTokens: conversation.total_tokens_used || 0,
				averageResponseTime: 0,
				tags: conversation.tags ? JSON.parse(conversation.tags) : []
			}
		};
	}

	/**
	 * Generate UUID for database records
	 */
	generateUUID() {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			const r = (Math.random() * 16) | 0;
			const v = c === 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	/**
	 * Initialize chat database schema
	 * Creates the necessary tables for chat conversation storage
	 */
	async initializeChatSchema() {
		if (!this.currentDatabase) {
			console.log('💬 No database set, skipping chat schema initialization');
			return;
		}

		try {
			console.log('💬 Initializing chat database schema...');
			const { default: Database } = await import('better-sqlite3');

			// Open database connection
			const db = new Database(this.currentDatabase);

			// Check if chat tables already exist
			const chatTables = [
				'conversations',
				'messages',
				'api_keys',
				'tool_calls',
				'file_attachments',
				'usage_analytics',
				'chat_settings'
			];
			const existingTables = db
				.prepare(
					`
				SELECT name FROM sqlite_master
				WHERE type='table' AND name IN (${chatTables.map(() => '?').join(',')})
			`
				)
				.all(...chatTables);

			if (existingTables.length === chatTables.length) {
				console.log('💬 Chat schema already exists, skipping initialization');
				db.close();
				return;
			}

			console.log('💬 Creating chat database tables...');

			// Create chat schema
			await this.createChatTables(db);

			db.close();
			console.log('✅ Chat database schema initialized successfully');
		} catch (error) {
			console.error('❌ Failed to initialize chat schema:', error);
			throw error;
		}
	}

	/**
	 * Create all chat-related database tables
	 */
	async createChatTables(db) {
		// Execute all chat table creation SQL
		const chatSchemaSql = this.getChatSchemaSql();

		// Execute as transaction for consistency
		const createTables = db.transaction(() => {
			for (const sql of chatSchemaSql) {
				db.exec(sql);
			}
		});

		createTables();
	}

	/**
	 * Get chat database schema SQL statements
	 * Based on the existing database-conversation-service.ts schema
	 */
	getChatSchemaSql() {
		return [
			// API Keys table for secure key storage (multi-service architecture)
			`CREATE TABLE IF NOT EXISTS api_keys (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL DEFAULT 'default-user',
				service_name TEXT NOT NULL DEFAULT 'claude',
				encrypted_key TEXT NOT NULL,
				key_hash TEXT NOT NULL,
				metadata TEXT DEFAULT '{}',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				last_used_at DATETIME,
				is_active BOOLEAN DEFAULT TRUE,
				UNIQUE(user_id, service_name, is_active)
			)`,

			// Conversations table
			`CREATE TABLE IF NOT EXISTS conversations (
				id TEXT PRIMARY KEY, -- UUID
				user_id TEXT NOT NULL DEFAULT 'default-user',
				title TEXT NOT NULL,
				description TEXT,
				model TEXT DEFAULT 'claude-3-7-sonnet-latest',
				system_prompt TEXT,
				temperature REAL DEFAULT 0.7,
				max_tokens INTEGER DEFAULT 4000,
				is_archived BOOLEAN DEFAULT FALSE,
				is_pinned BOOLEAN DEFAULT FALSE,
				tags TEXT, -- JSON array
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				last_message_at DATETIME,
				message_count INTEGER DEFAULT 0,
				total_tokens_used INTEGER DEFAULT 0,
				estimated_cost REAL DEFAULT 0.0
			)`,

			// Messages table
			`CREATE TABLE IF NOT EXISTS messages (
				id TEXT PRIMARY KEY, -- UUID
				conversation_id TEXT NOT NULL,
				role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
				content TEXT NOT NULL,
				sequence_number INTEGER NOT NULL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				model TEXT,
				input_tokens INTEGER,
				output_tokens INTEGER,
				processing_time_ms INTEGER,
				error_message TEXT,
				is_streaming BOOLEAN DEFAULT FALSE,
				FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
			)`,

			// Tool calls table
			`CREATE TABLE IF NOT EXISTS tool_calls (
				id TEXT PRIMARY KEY, -- UUID
				message_id TEXT NOT NULL,
				tool_name TEXT NOT NULL,
				arguments TEXT NOT NULL, -- JSON
				result TEXT, -- JSON
				execution_time_ms INTEGER,
				error_message TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
			)`,

			// File attachments table
			`CREATE TABLE IF NOT EXISTS file_attachments (
				id TEXT PRIMARY KEY, -- UUID
				message_id TEXT NOT NULL,
				filename TEXT NOT NULL,
				original_size INTEGER NOT NULL,
				mime_type TEXT NOT NULL,
				processed_content TEXT,
				content_summary TEXT,
				processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'success', 'error')),
				processing_error TEXT,
				is_safe BOOLEAN DEFAULT TRUE,
				security_warnings TEXT, -- JSON array
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				processed_at DATETIME,
				FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
			)`,

			// Usage analytics table
			`CREATE TABLE IF NOT EXISTS usage_analytics (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id TEXT NOT NULL DEFAULT 'default-user',
				conversation_id TEXT,
				date TEXT NOT NULL, -- YYYY-MM-DD format
				model TEXT NOT NULL,
				message_count INTEGER DEFAULT 0,
				input_tokens INTEGER DEFAULT 0,
				output_tokens INTEGER DEFAULT 0,
				total_tokens INTEGER DEFAULT 0,
				estimated_cost REAL DEFAULT 0.0,
				tool_calls_count INTEGER DEFAULT 0,
				unique_tools_used INTEGER DEFAULT 0,
				FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
			)`,

			// Chat settings table
			`CREATE TABLE IF NOT EXISTS chat_settings (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id TEXT NOT NULL DEFAULT 'default-user',
				theme TEXT DEFAULT 'system',
				language TEXT DEFAULT 'en',
				timezone TEXT DEFAULT 'UTC',
				auto_save_conversations BOOLEAN DEFAULT TRUE,
				default_model TEXT DEFAULT 'claude-3-7-sonnet-latest',
				default_temperature REAL DEFAULT 0.7,
				default_max_tokens INTEGER DEFAULT 4000,
				enable_analytics BOOLEAN DEFAULT TRUE,
				auto_delete_after_days INTEGER,
				require_confirmation_for_delete BOOLEAN DEFAULT TRUE,
				export_format TEXT DEFAULT 'markdown' CHECK (export_format IN ('markdown', 'json', 'html', 'pdf')),
				include_metadata_in_export BOOLEAN DEFAULT TRUE,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(user_id) -- Only one settings record per user
			)`,

			// Indexes for performance
			`CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC)`,
			`CREATE INDEX IF NOT EXISTS idx_conversations_user_archived ON conversations(user_id, is_archived)`,
			`CREATE INDEX IF NOT EXISTS idx_messages_conversation_sequence ON messages(conversation_id, sequence_number)`,
			`CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at)`,
			`CREATE INDEX IF NOT EXISTS idx_tool_calls_message ON tool_calls(message_id)`,
			`CREATE INDEX IF NOT EXISTS idx_file_attachments_message ON file_attachments(message_id)`,
			`CREATE INDEX IF NOT EXISTS idx_usage_analytics_user_date ON usage_analytics(user_id, date)`,
			`CREATE INDEX IF NOT EXISTS idx_usage_analytics_conversation ON usage_analytics(conversation_id)`
		];
	}

	/**
	 * Store encrypted API key for a user
	 */
	async storeChatApiKey(db, userId, args) {
		const { encrypted_key, key_hash, service_name = 'claude', metadata = {} } = args;
		const now = new Date().toISOString();

		// First, remove any existing API key for this user and service
		const deleteStmt = db.prepare(`
			DELETE FROM api_keys
			WHERE user_id = ? AND service_name = ?
		`);
		deleteStmt.run(userId, service_name);

		// Insert new API key
		const insertStmt = db.prepare(`
			INSERT INTO api_keys (
				id, user_id, service_name, encrypted_key, key_hash,
				metadata, created_at, last_used_at, is_active
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, true)
		`);

		const keyId = this.generateUUID();
		insertStmt.run(
			keyId,
			userId,
			service_name,
			encrypted_key,
			key_hash,
			JSON.stringify(metadata),
			now,
			now
		);

		return {
			success: true,
			key_id: keyId,
			message: 'API key stored successfully'
		};
	}

	/**
	 * Retrieve encrypted API key for a user
	 */
	async getChatApiKey(db, userId, args) {
		const { service_name = 'claude' } = args;

		const stmt = db.prepare(`
			SELECT id, encrypted_key, key_hash, metadata, created_at, last_used_at
			FROM api_keys
			WHERE user_id = ? AND service_name = ? AND is_active = true
			ORDER BY created_at DESC
			LIMIT 1
		`);

		const result = stmt.get(userId, service_name);

		if (result) {
			// Update last_used_at
			const updateStmt = db.prepare(`
				UPDATE api_keys
				SET last_used_at = CURRENT_TIMESTAMP
				WHERE id = ?
			`);
			updateStmt.run(result.id);

			return {
				success: true,
				api_key: {
					id: result.id,
					encrypted_key: result.encrypted_key,
					key_hash: result.key_hash,
					metadata: JSON.parse(result.metadata || '{}'),
					created_at: result.created_at,
					last_used_at: result.last_used_at
				}
			};
		} else {
			return {
				success: false,
				message: 'No API key found for this user and service'
			};
		}
	}

	/**
	 * Clear/deactivate API key for a user
	 */
	async clearChatApiKey(db, userId, args) {
		const { service_name = 'claude' } = args;

		const stmt = db.prepare(`
			UPDATE api_keys
			SET is_active = false, updated_at = CURRENT_TIMESTAMP
			WHERE user_id = ? AND service_name = ? AND is_active = true
		`);

		const result = stmt.run(userId, service_name);

		return {
			success: true,
			message: `Cleared ${result.changes} API key(s) for ${service_name}`,
			keys_cleared: result.changes
		};
	}

	/**
	 * Handle master password operations
	 */
	async handleMasterPasswordOperation(operation, args) {
		if (!this.currentDatabase) {
			throw new Error('No database connected. Please switch to a database first.');
		}

		// Import better-sqlite3 for database operations
		const { default: Database } = await import('better-sqlite3');
		const db = new Database(this.currentDatabase);

		const userId = args.user_id || 'default-user';

		try {
			switch (operation) {
				case 'store_master_password_settings':
					return this.storeMasterPasswordSettings(db, userId, args);

				case 'verify_master_password':
					return this.verifyMasterPassword(db, userId, args);

				case 'get_master_password_settings':
					return this.getMasterPasswordSettings(db, userId, args);

				case 'store_backup_codes':
					return this.storeBackupCodes(db, userId, args);

				case 'validate_backup_code':
					return this.validateBackupCode(db, userId, args);

				default:
					throw new Error(`Unknown master password operation: ${operation}`);
			}
		} finally {
			db.close();
		}
	}

	/**
	 * Store master password settings
	 */
	async storeMasterPasswordSettings(db, userId, args) {
		const { password_hash, salt, backup_codes_remaining } = args;
		const now = new Date().toISOString();

		const stmt = db.prepare(`
			INSERT OR REPLACE INTO master_password_settings (
				user_id, password_hash, salt, backup_codes_remaining, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?)
		`);

		stmt.run(userId, password_hash, JSON.stringify(salt), backup_codes_remaining || 0, now, now);

		return {
			success: true,
			message: 'Master password settings stored'
		};
	}

	/**
	 * Verify master password
	 */
	async verifyMasterPassword(db, userId, args) {
		const { password_hash } = args;

		const stmt = db.prepare(`
			SELECT password_hash FROM master_password_settings
			WHERE user_id = ?
		`);

		const result = stmt.get(userId);

		if (!result) {
			return {
				success: false,
				message: 'No master password set'
			};
		}

		return {
			success: result.password_hash === password_hash,
			message: result.password_hash === password_hash ? 'Password verified' : 'Invalid password'
		};
	}

	/**
	 * Get master password settings
	 */
	async getMasterPasswordSettings(db, userId, args) {
		const stmt = db.prepare(`
			SELECT password_hash, salt, backup_codes_remaining, created_at
			FROM master_password_settings
			WHERE user_id = ?
		`);

		const result = stmt.get(userId);

		if (!result) {
			return {
				success: false,
				message: 'No master password settings found'
			};
		}

		return {
			success: true,
			password_hash: result.password_hash,
			salt: result.salt,
			backup_codes_remaining: result.backup_codes_remaining,
			created_at: result.created_at
		};
	}

	/**
	 * Store backup codes
	 */
	async storeBackupCodes(db, userId, args) {
		const { backup_codes } = args;
		const now = new Date().toISOString();

		// Clear existing backup codes
		const clearStmt = db.prepare(`
			DELETE FROM master_password_recovery
			WHERE user_id = ? AND recovery_method = 'backup_codes'
		`);
		clearStmt.run(userId);

		// Insert new backup codes
		const insertStmt = db.prepare(`
			INSERT INTO master_password_recovery (
				id, user_id, recovery_method, code_hash, is_used, created_at
			) VALUES (?, ?, 'backup_codes', ?, false, ?)
		`);

		for (const codeData of backup_codes) {
			insertStmt.run(codeData.id, userId, codeData.code_hash, now);
		}

		return {
			success: true,
			message: `Stored ${backup_codes.length} backup codes`
		};
	}

	/**
	 * Validate and consume backup code
	 */
	async validateBackupCode(db, userId, args) {
		const { code } = args;

		// Hash the provided code (same way as storage)
		const crypto = require('crypto');
		const codeHash = crypto.createHash('sha256').update(`backup-code-${code}`).digest('hex');

		// Find unused code
		const findStmt = db.prepare(`
			SELECT id FROM master_password_recovery
			WHERE user_id = ? AND recovery_method = 'backup_codes'
			AND code_hash = ? AND is_used = false
		`);

		const result = findStmt.get(userId, codeHash);

		if (!result) {
			return {
				success: false,
				message: 'Invalid or already used backup code'
			};
		}

		// Mark code as used
		const useStmt = db.prepare(`
			UPDATE master_password_recovery
			SET is_used = true, used_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`);

		useStmt.run(result.id);

		// Get remaining codes count
		const countStmt = db.prepare(`
			SELECT COUNT(*) as remaining FROM master_password_recovery
			WHERE user_id = ? AND recovery_method = 'backup_codes' AND is_used = false
		`);

		const countResult = countStmt.get(userId);

		return {
			success: true,
			message: 'Backup code validated',
			codes_remaining: countResult.remaining
		};
	}

	async shutdown() {
		console.log('🛑 Shutting down bridge...');

		if (this.server) {
			this.server.close();
		}

		if (this.mcpProcess && !this.mcpProcess.killed) {
			this.mcpProcess.kill('SIGTERM');

			// Force kill after 5 seconds
			setTimeout(() => {
				if (!this.mcpProcess.killed) {
					console.log('⚠️  Force killing MCP process...');
					this.mcpProcess.kill('SIGKILL');
				}
			}, 5000);
		}
	}
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

args.forEach((arg) => {
	if (arg.startsWith('--port=')) {
		options.port = parseInt(arg.split('=')[1]);
	} else if (arg.startsWith('--mcp-command=')) {
		options.mcpCommand = arg.split('=')[1];
	} else if (arg === '--help' || arg === '-h') {
		console.log(`
MCP Stdio-to-WebSocket Bridge Server

Usage: node mcp-stdio-bridge.js [options]

Options:
  --port=PORT              WebSocket server port (default: 3000)
  --mcp-command="COMMAND"  Command to launch MCP server (default: "lifecycle-mcp")
  --help, -h               Show this help message

Examples:
  node mcp-stdio-bridge.js
  node mcp-stdio-bridge.js --port=8080 --mcp-command="lifecycle-mcp -e LIFECYCLE_DB=./data/lifecycle.db"
`);
		process.exit(0);
	}
});

// Start the bridge
const bridge = new MCPStdioBridge(options);

// Graceful shutdown
process.on('SIGINT', async () => {
	console.log('\n📡 Received SIGINT, shutting down gracefully...');
	await bridge.shutdown();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	console.log('\n📡 Received SIGTERM, shutting down gracefully...');
	await bridge.shutdown();
	process.exit(0);
});

// Start the bridge
bridge.start().catch((error) => {
	console.error('❌ Fatal error:', error.message);
	process.exit(1);
});
