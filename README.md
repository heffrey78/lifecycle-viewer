# Lifecycle Viewer

A modern Svelte/TypeScript web application for interacting with the [Lifecycle MCP Server](https://github.com/heffrey78/lifecycle-mcp). This UI provides comprehensive management of software requirements, tasks, and architecture decisions through an intuitive web interface.

## 🚀 Features

- **Dashboard Overview**: Real-time project metrics and health indicators
- **Requirements Management**: Full lifecycle tracking from Draft to Validated
- **Task Management**: Implementation tracking with GitHub integration
- **Architecture Decisions**: ADR management and review workflows
- **Real-time Updates**: WebSocket connection to MCP server
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## 📋 Prerequisites

### Required

- **Node.js** (v18+ recommended)
- **Lifecycle MCP Server** - [Installation Guide](https://github.com/heffrey78/lifecycle-mcp)

### MCP Server Setup

Before running the Lifecycle Viewer, you need to have the Lifecycle MCP server running:

```bash
# Clone and set up the MCP server
git clone https://github.com/heffrey78/lifecycle-mcp.git
cd lifecycle-mcp

# Install with uv (recommended)
uv sync
uv run server.py

# OR install with pip
pip install -e .
lifecycle-mcp
```

The MCP server should be running on `ws://localhost:3000/mcp` (or configure the URL in the client).

## 🛠️ Installation & Setup

1. **Clone this repository**

   ```bash
   git clone https://github.com/heffrey78/lifecycle-viewer.git
   cd lifecycle-viewer
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure MCP Connection** (optional)
   Edit `src/lib/services/mcp-client.ts` to modify the server URL:

   ```typescript
   constructor(private serverUrl: string = 'ws://localhost:3000/mcp')
   ```

4. **Start the MCP bridge server** (in a separate terminal)

   ```bash
   npm run mcp-bridge
   ```

   This starts the WebSocket bridge that connects the web UI to the MCP server.

5. **Start the development server** (in another terminal)

   ```bash
   npm run dev
   ```

6. **Open the application**
   Navigate to http://localhost:5173/

## 🔌 Connecting to Real Data

### Current Status

The application currently shows **mock/dummy data** when the MCP server is not connected. This is intentional to allow development and demonstration without requiring a running MCP server.

### Getting Real Data

To see real project data:

1. **Ensure MCP Server is Running**

   ```bash
   cd /path/to/lifecycle-mcp
   uv run server.py  # or lifecycle-mcp
   ```

2. **Start the MCP Bridge** (in the lifecycle-viewer directory)

   ```bash
   npm run mcp-bridge
   ```

   This bridge is **required** - it converts WebSocket connections from the browser into stdio communication with the MCP server.

3. **Verify Connection**
   - Open the Lifecycle Viewer at http://localhost:5173/
   - The project name should show your actual database name in the header
   - If showing "No Project" or "Database Error", the UI will fall back to mock data

4. **Create Real Data**
   Use the MCP server tools through Claude Code or directly via MCP protocol:

   ```bash
   # Add the server to Claude Code
   claude mcp add lifecycle lifecycle-mcp -e LIFECYCLE_DB=./lifecycle.db
   ```

5. **Interact Through Claude**
   Once connected to Claude, you can use MCP tools to create real data:
   - `create_requirement` - Add project requirements
   - `create_task` - Add implementation tasks
   - `create_architecture_decision` - Document architecture choices

### Mock vs Real Data

- **Mock Data**: Used when MCP server is unavailable (development/demo)
- **Real Data**: Loaded from your actual Lifecycle database when MCP server is connected
- **Seamless Fallback**: Application automatically detects connection status

## 🏗️ Architecture

### Project Structure

```
lifecycle-viewer/
├── src/
│   ├── lib/
│   │   ├── types/lifecycle.ts          # TypeScript definitions
│   │   └── services/mcp-client.ts      # MCP communication
│   ├── routes/
│   │   ├── +layout.svelte              # Main layout with navigation
│   │   ├── +page.svelte                # Dashboard
│   │   ├── requirements/+page.svelte    # Requirements management
│   │   └── tasks/+page.svelte          # Task management
│   └── app.html                        # Base HTML template
├── static/                             # Static assets
└── tailwind.config.js                  # Styling configuration
```

### Key Components

#### MCP Client (`src/lib/services/mcp-client.ts`)

- WebSocket-based communication with Lifecycle MCP server
- Async/await API matching MCP tool signatures
- Automatic fallback to mock data when server unavailable
- Error handling and connection management

#### Type Definitions (`src/lib/types/lifecycle.ts`)

- Complete TypeScript interfaces matching database schema
- Type-safe API responses and data structures
- Enums for status, priority, and type values

#### UI Components

- **Dashboard**: Project overview with metrics and quick actions
- **Requirements**: Filterable table with status tracking
- **Tasks**: Implementation tracking with GitHub integration
- **Layout**: Navigation sidebar with connection status

## 🎨 Customization

### Styling

The application uses Tailwind CSS with custom color definitions for lifecycle states:

- **Requirements**: Draft (red) → Under Review (orange) → Approved (blue) → Ready (green) → Implemented (dark green)
- **Tasks**: Not Started (red) → In Progress (orange) → Complete (green)
- **Priorities**: P0 (red) → P1 (orange) → P2 (blue) → P3 (gray)

### Configuration

Edit configuration in:

- `tailwind.config.js` - Styling and colors
- `src/lib/services/mcp-client.ts` - Server connection settings
- Individual page components for UI behavior

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run test:unit    # Run unit tests
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

### Development Workflow

1. **Start MCP Server** (for real data): `uv run server.py`
2. **Start MCP Bridge**: `npm run mcp-bridge`
3. **Start Dev Server**: `npm run dev`
4. **Make Changes**: Hot reload enabled
5. **Test**: Application works with both real and mock data
6. **Build**: `npm run build` for production

### Adding New Features

1. **Define Types**: Add interfaces to `src/lib/types/lifecycle.ts`
2. **Extend MCP Client**: Add methods to `src/lib/services/mcp-client.ts`
3. **Create UI**: Build Svelte components with TypeScript
4. **Add Routes**: Create new pages in `src/routes/`

## 📡 MCP Integration

### Real-time Connection

- **WebSocket**: Persistent connection to MCP server
- **Connection Status**: Visual indicator in sidebar
- **Automatic Reconnection**: Handles temporary disconnections
- **Fallback Mode**: Seamless transition to mock data

### MCP Tools Used

- `query_requirements` - Get requirements list
- `get_requirement_details` - Get single requirement
- `query_tasks` - Get tasks list
- `get_task_details` - Get single task
- `get_project_status` - Get dashboard metrics
- `create_requirement` - Add new requirements
- `create_task` - Add new tasks
- `update_requirement_status` - Update lifecycle states

## 🚀 Production Deployment

### Build for Production

```bash
npm run build
```

### Deploy Options

- **Static Hosting**: Vercel, Netlify, GitHub Pages
- **Node.js Hosting**: Any Node.js hosting provider
- **Docker**: Containerize with included Dockerfile (if added)

### Environment Configuration

Set environment variables for production:

- `MCP_SERVER_URL` - URL of your MCP server
- `PUBLIC_APP_NAME` - Application name/title

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes with proper TypeScript typing
4. Test with both mock and real MCP data
5. Submit a pull request

## 📄 License

[Add your license information here]

## 🔗 Related Projects

- [Lifecycle MCP Server](https://github.com/heffrey78/lifecycle-mcp) - The backend MCP server
- [Model Context Protocol](https://github.com/anthropics/mcp) - MCP specification

## 💡 Next Steps

To get the most out of Lifecycle Viewer:

1. **Set up the MCP Server** following the [installation guide](https://github.com/heffrey78/lifecycle-mcp)
2. **Connect to Claude Code** to populate real project data
3. **Create your first requirement** using MCP tools
4. **Watch the UI update** with real project information
5. **Explore advanced features** like GitHub integration and architecture tracking

The current mock data is just a preview - the real power comes from connecting to your actual project lifecycle data!
