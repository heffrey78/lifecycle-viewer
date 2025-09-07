# MCP Stdio Bridge Implementation Plan

## Current State

- lifecycle-viewer uses WebSocket transport expecting `ws://localhost:3000/mcp`
- lifecycle-mcp server is designed for stdio transport
- Browser cannot directly communicate with stdio processes

## Proposed Solution: Server-Side Stdio-to-WebSocket Bridge

### Architecture

```
[Browser] --WebSocket--> [Bridge Server] --stdio--> [lifecycle-mcp]
```

### Bridge Server Requirements

1. **WebSocket Server**: Accept connections from browser on port 3000
2. **Process Management**: Launch lifecycle-mcp as subprocess
3. **Protocol Translation**: Convert WebSocket messages to/from stdio JSON-RPC
4. **Error Handling**: Manage process lifecycle, crashes, restarts

### Implementation Options

#### Option 1: Node.js Bridge Server

Create a dedicated bridge server using Node.js:

```javascript
// bridge-server.js
const WebSocket = require('ws');
const { spawn } = require('child_process');

class MCPStdioBridge {
	constructor() {
		this.server = new WebSocket.Server({ port: 3000 });
		this.mcpProcess = null;
		this.setupWebSocketServer();
	}

	launchMCPServer() {
		this.mcpProcess = spawn('python', ['-m', 'lifecycle_mcp'], {
			stdio: ['pipe', 'pipe', 'inherit']
		});

		// Handle stdio communication
		this.mcpProcess.stdout.on('data', this.handleStdioResponse.bind(this));
	}

	// Handle WebSocket -> stdio
	handleWebSocketMessage(ws, data) {
		const message = JSON.parse(data);
		this.mcpProcess.stdin.write(JSON.stringify(message) + '\n');
	}

	// Handle stdio -> WebSocket
	handleStdioResponse(data) {
		const lines = data
			.toString()
			.split('\n')
			.filter((line) => line.trim());
		lines.forEach((line) => {
			const message = JSON.parse(line);
			this.clients.forEach((ws) => ws.send(JSON.stringify(message)));
		});
	}
}
```

#### Option 2: Extend lifecycle-mcp Server

Add WebSocket transport support directly to lifecycle-mcp:

```python
# In lifecycle-mcp server
import asyncio
import websockets
import json
from contextlib import asynccontextmanager

class WebSocketTransport:
    async def start_server(self):
        return await websockets.serve(
            self.handle_websocket,
            "localhost",
            3000
        )

    async def handle_websocket(self, websocket, path):
        async for message in websocket:
            request = json.loads(message)
            response = await self.handle_mcp_request(request)
            await websocket.send(json.dumps(response))
```

### Integration Steps

1. **Create Bridge Server** (Option 1 recommended for separation of concerns)
   - Implement WebSocket server on port 3000
   - Launch lifecycle-mcp as subprocess with stdio pipes
   - Handle bidirectional message translation
   - Add process lifecycle management

2. **Update lifecycle-viewer Configuration**
   - Keep existing WebSocket client code
   - Update error messages to reference bridge server
   - Add bridge server startup instructions

3. **Development Workflow**
   - Start bridge server: `node bridge-server.js`
   - Bridge automatically launches lifecycle-mcp subprocess
   - Browser connects to bridge via WebSocket

### Benefits

- ✅ Maintains compatibility with existing WebSocket client code
- ✅ Leverages lifecycle-mcp's native stdio design
- ✅ Enables browser-based UI access to stdio MCP servers
- ✅ Provides process isolation and management
- ✅ Can be extended to support multiple MCP servers

### Alternative: Direct HTTP Transport

Instead of stdio bridge, implement HTTP transport in lifecycle-mcp:

- Add Flask/FastAPI HTTP endpoints
- Support MCP over HTTP POST + SSE
- More aligned with MCP spec for remote servers

### Recommendation

Implement Option 1 (Node.js Bridge) as it:

- Preserves lifecycle-mcp's stdio design
- Minimizes changes to existing codebase
- Provides a reusable pattern for other stdio MCP servers
- Maintains clear separation between transport and logic layers
