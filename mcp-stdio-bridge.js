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
