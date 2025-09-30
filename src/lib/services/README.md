# Services Directory

This directory contains the **MCP client architecture** for communicating with the lifecycle-mcp server.

## Architecture Overview

### 3-Layer Design (✅ WORKING)

```
┌─────────────────────────────────────────────────────┐
│                 Business Layer                      │
│  lifecycle-mcp-client.ts (67 lines)                │
│  Clean facade with organized service access         │
└─────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────┐
│                Service Layer                        │
│  requirement-service.ts, task-service.ts, etc.     │
│  Domain-specific operations (~50 lines each)        │
└─────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────┐
│               Protocol Layer                        │
│  mcp-client.ts (875 lines)                          │
│  Complete MCP/JSON-RPC/WebSocket implementation     │
│  connection-manager.ts, protocol-handler.ts         │
└─────────────────────────────────────────────────────┘
```

## Key Files

### Facade Layer

- **`lifecycle-mcp-client.ts`** - Clean business API, exports singleton `mcpClient`

### Service Layer

- **`requirement-service.ts`** - Requirement CRUD operations
- **`task-service.ts`** - Task management
- **`architecture-service.ts`** - Architecture decision handling
- **`database-service.ts`** - Database operations
- **`project-service.ts`** - Project metrics

### Protocol Layer

- **`mcp-client.ts`** - Complete MCP client (875 lines, comprehensive)
- **`connection-manager.ts`** - WebSocket connection handling
- **`protocol-handler.ts`** - MCP protocol + JSON-RPC implementation

## Important Notes

### 🚨 Before Making Changes

**This architecture is WORKING and well-designed.** Before making changes:

1. **Understand why `mcp-client.ts` is 875 lines**: Protocol implementations need comprehensive coverage
2. **The service layer is already clean**: Small, focused classes with single responsibilities
3. **Dynamic tool discovery is working**: Don't create hardcoded tool lists
4. **Don't duplicate functionality**: The current services are the clean abstraction layer

### ✅ Safe Changes

- Add new methods to existing services
- Create new service classes for new entities
- Extend error handling in protocol layer
- Add integration tests

### ❌ Risky Changes

- Splitting `mcp-client.ts` without clear problems
- Creating "generic" MCP clients (current one already uses dynamic discovery)
- Adding hardcoded tool definitions (defeats MCP purpose)
- Major architectural overhauls without specific issues

## Usage Patterns

### Basic Usage

```typescript
import { mcpClient } from './lifecycle-mcp-client.js';

await mcpClient.connect();
const result = await mcpClient.requirements.getRequirements();
```

### Service Testing

```typescript
import { RequirementService } from './requirement-service.js';
const service = new RequirementService(mockProtocolHandler);
```

## References

- **Working Implementation**: See `mcp-client.ts` for comprehensive protocol handling
- **Clean APIs**: See individual `*-service.ts` files for business logic patterns
- **MCP Protocol**: Uses JSON-RPC 2.0 over WebSocket with dynamic tool discovery
