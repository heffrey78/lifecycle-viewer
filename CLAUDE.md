# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev          # Start development server at http://localhost:5173
npm run mcp-bridge   # Start MCP stdio-to-WebSocket bridge server

# Building & Testing
npm run build               # Build for production
npm run preview             # Preview production build
npm run test                # Run unit tests (vitest --run)
npm run test:unit           # Run unit tests in watch mode
npm run test:coverage       # Run tests with code coverage report
npm run test:coverage:ui    # Run tests with interactive coverage UI
npm run test:server         # Run server-side tests only
npm run test:server:coverage # Run server tests with coverage

# Code Quality
npm run lint         # Run ESLint and Prettier checks
npm run format       # Format code with Prettier
npm run check        # TypeScript and Svelte type checking
npm run check:watch  # Type checking in watch mode

# MCP Bridge Server
npm run mcp-bridge       # Start bridge with default Python command
npm run mcp-bridge:uv    # Start bridge with uv Python package manager
```

## Architecture Overview

This is a **Svelte 5 + TypeScript + Tailwind CSS** web application that provides a UI for the [Lifecycle MCP Server](https://github.com/heffrey78/lifecycle-mcp).

### Key Components

- **MCP Client** (`src/lib/services/mcp-client.ts`): WebSocket-based client for communicating with the Lifecycle MCP server
- **Type System** (`src/lib/types/lifecycle.ts`): Complete TypeScript interfaces matching the MCP server's database schema
- **UI Routes**:
  - `src/routes/+page.svelte` - Dashboard with project metrics
  - `src/routes/requirements/+page.svelte` - Requirements management
  - `src/routes/tasks/+page.svelte` - Task tracking
  - `src/routes/+layout.svelte` - Main layout with navigation sidebar

### Data Flow & Connection

The application automatically detects MCP server connection status and falls back to mock data when the server is unavailable. Real data flows through the MCP client which uses WebSocket communication to call MCP tools like `query_requirements`, `create_task`, `update_requirement_status`, etc.

### Testing Setup

The project uses **Vitest** with both browser and Node.js environments:

- **Client tests**: Run in Playwright/Chromium for Svelte components (`.svelte.{test,spec}.{js,ts}`)
- **Server tests**: Run in Node.js environment for services and utilities (`.{test,spec}.{js,ts}`)
- **Browser testing**: Enabled for full UI component testing
- **Code coverage**: V8 coverage with 80%+ thresholds for core services

#### Enhanced Test Mocking Infrastructure

**Location:** `src/lib/test-utils/`

Comprehensive testing infrastructure for MCP client functionality:

- **Mock WebSocket** (`mock-websocket.ts`): Realistic WebSocket simulation with network conditions
- **Test Fixtures** (`test-fixtures.ts`): Comprehensive test data for Requirements, Tasks, Architecture
- **MCP Protocol Mocks** (`mcp-protocol-mocks.ts`): Full JSON-RPC 2.0 protocol simulation
- **Test Helpers** (`test-helpers.ts`): High-level testing utilities and patterns
- **Network Simulation** (`network-simulation.ts`): Realistic network condition simulation

#### Testing Patterns

**Basic MCP Client Test:**

```typescript
import { createConnectedMCPClient, REQUIREMENT_FIXTURES } from '$lib/test-utils';

test('should fetch requirements', async () => {
	const { testEnv, client } = await createConnectedMCPClient();

	const result = await client.getRequirements();
	expect(result.success).toBe(true);

	testEnv.cleanup(); // Always cleanup
});
```

**Network Simulation:**

```typescript
const { client, mockWebSocket } = await setupMCPClient({
	networkPreset: 'mobile', // or 'poor', 'typical', 'perfect'
	mcpScenario: 'unreliable', // Simulate server errors
	enableLogging: true // Debug network activity
});
```

**Performance Testing:**

```typescript
const results = await testEnv.stressTestConnection(100, 10); // 100 ops, 10 concurrent
expect(results.successRate).toBeGreaterThan(0.95);
```

#### Coverage Requirements

- **Global threshold**: 80% (branches, functions, lines, statements)
- **Core services**: 85% (`src/lib/services/mcp-client.ts`)
- **Coverage reports**: HTML and JSON formats in `./coverage/`
- **Excluded**: Test utilities (`src/lib/test-utils/`) and test files

#### Test Data Management

**Fixtures provide:**

- Requirements in all lifecycle states (Draft → Validated)
- Tasks with various statuses and effort sizes
- Architecture decisions (ADR, TDD formats)
- Realistic project metrics and relationships
- Bulk data generation for performance testing

## Code Style & Configuration

- **Prettier**: Uses tabs, single quotes, 100 char width, svelte plugin
- **ESLint**: TypeScript + Svelte rules, browser + node globals
- **Tailwind**: Custom lifecycle status colors (draft=red, approved=blue, complete=green, etc.)

## MCP Integration Notes

- **Transport**: Uses WebSocket at `ws://localhost:3000/mcp` by default
- **Bridge Server**: `mcp-stdio-bridge.js` converts WebSocket ↔ stdio for lifecycle-mcp
- **Connection Status**: Visible in sidebar with retry functionality
- **Protocol**: Uses JSON-RPC 2.0 over WebSocket
- **Error Handling**: Comprehensive error messages with troubleshooting steps

### MCP Server Setup

1. **Start Bridge Server**: `npm run mcp-bridge` (launches lifecycle-mcp subprocess)
2. **Start UI**: `npm run dev`
3. **Alternative**: Use `npm run mcp-bridge:uv` if using uv package manager

### Architecture

```
[Browser] --WebSocket--> [Bridge Server] --stdio--> [lifecycle-mcp]
```

The bridge enables browser communication with stdio-based MCP servers by:

- Converting WebSocket messages to stdio JSON-RPC
- Managing lifecycle-mcp subprocess lifecycle
- Providing connection status and error handling

## Debugging Complex Systems

### Critical Lesson: Always Check Backend Logs First

When debugging complex multi-component systems (browser ↔ bridge ↔ MCP server), **ALWAYS examine backend logs before making assumptions**.

**Key debugging approach:**

1. **Check bridge server logs first** - they show the actual data flow and errors
2. **Create integration tests** to isolate the problem (like `test-db-switch.js`)
3. **Don't guess at root causes** - logs reveal the truth
4. **Frontend success ≠ backend success** - verify end-to-end functionality

**Example from database switching bug:**

- **Frontend showed**: "Success" response
- **User experienced**: Same data after "successful" switch
- **Root cause found in logs**: Environment variable syntax was wrong (`-e LIFECYCLE_DB=path` vs proper env var setting)
- **Solution**: Proper environment variable handling in spawn() call

**Database Switching Architecture:**

- **Bridge intercepts** `database/switch` requests (not forwarded to MCP)
- **Environment variable** `LIFECYCLE_DB` must be set in spawn environment
- **Process restart** required for MCP to use new database
- **Server-side file picker** using `zenity` solves browser path limitations

## Lifecycle-MCP State Management

### Critical Lesson: Understanding Requirement Lifecycle States

The lifecycle-mcp system enforces strict state transitions for requirements. **Tasks can only be created for requirements in approved states**.

**Valid states for task creation:**

- `Approved` - Requirement has been reviewed and approved
- `Architecture` - Architectural decisions are being made
- `Ready` - Ready for implementation
- `Implemented` - Implementation is complete
- `Validated` - Implementation has been validated

**Invalid states for task creation:**

- `Draft` - Initial state, not yet reviewed
- `Under Review` - Currently being reviewed

**Required state progression:**

1. `Draft` → `Under Review` → `Approved` (minimum path to enable task creation)
2. Full path: `Draft` → `Under Review` → `Approved` → `Architecture` → `Ready` → `Implemented` → `Validated`

**Key takeaway:** Always ensure requirements are moved through proper lifecycle states before attempting to create associated tasks. The system will reject task creation attempts for unapproved requirements.
