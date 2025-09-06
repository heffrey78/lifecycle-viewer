# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev          # Start development server at http://localhost:5173
npm run mcp-bridge   # Start MCP stdio-to-WebSocket bridge server

# Building & Testing  
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run unit tests (vitest --run)
npm run test:unit    # Run unit tests in watch mode

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
- Client tests: Run in Playwright/Chromium for Svelte components
- Server tests: Run in Node.js environment
- Browser testing is enabled for full UI component testing

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