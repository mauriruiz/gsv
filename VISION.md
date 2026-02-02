# GSV Architecture

## Overview

GSV is a distributed AI agent platform:
- **Gateway** (Cloudflare): Routes messages, manages sessions, calls LLMs
- **Nodes** (local machines): Provide tools (Bash, Read, Write, etc.)
- **R2 bucket**: Stores agent config (SOUL.md) and session archives

## Tool Namespacing

Tools are namespaced by node ID: `{nodeId}:{toolName}`

```
macbook:Bash        # Bash on laptop
linux-server:Bash   # Bash on server
macbook:Read        # Read files on laptop
linux-server:Read   # Read files on server
```

This allows the LLM to choose which machine to run tools on based on context.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Cloudflare (Remote)                          │
├─────────────────────────────────────────────────────────────────────┤
│  Gateway DO                          R2 Bucket (gsv-storage)        │
│  ┌─────────────────┐                 ┌─────────────────────┐        │
│  │ Routes messages │◄────────────────│ agents/{agentId}/   │        │
│  │ Calls LLM       │                 │   SOUL.md           │        │
│  │ Tool registry   │                 │   HEARTBEAT.md      │        │
│  └────────┬────────┘                 │   sessions/         │        │
│           │ WebSocket                └─────────────────────┘        │
└───────────┼─────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────┐
│                        Local Machines                              │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌────────────────────┐        ┌────────────────────┐             │
│  │ Node: "macbook"    │        │ Node: "server"     │             │
│  │ gsv node --id mac  │        │ gsv node --id srv  │             │
│  │ --workspace ~/work │        │ --workspace /app   │             │
│  │                    │        │                    │             │
│  │ Tools:             │        │ Tools:             │             │
│  │   macbook:Bash     │        │   server:Bash      │             │
│  │   macbook:Read     │        │   server:Read      │             │
│  │   macbook:Write    │        │   server:Write     │             │
│  └────────────────────┘        └────────────────────┘             │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

## CLI Configuration

```toml
# ~/.config/gsv/config.toml

[gateway]
url = "wss://gsv-gateway.xxx.workers.dev/ws"
token = "gsv_xxx"

[r2]
# For mounting R2 bucket locally (optional, for editing agent config)
account_id = "xxx"
access_key_id = "xxx"
secret_access_key = "xxx"
bucket = "gsv-storage"

[session]
default_key = "main"
```

## CLI Commands

### Node Operation

```bash
# Run a node (tools will be namespaced as "hostname:ToolName")
gsv node

# Run with custom ID and workspace
gsv node --id macbook --workspace ~/projects

# The LLM will see tools like:
#   macbook:Bash, macbook:Read, macbook:Write, etc.
```

### Mount R2 (Optional)

For editing agent config files locally:

```bash
# Setup rclone with R2 credentials
gsv mount setup

# Start FUSE mount at ~/.gsv/r2
gsv mount start

# Now you can edit:
#   ~/.gsv/r2/agents/main/SOUL.md
#   ~/.gsv/r2/agents/main/HEARTBEAT.md
```

## R2 Bucket Structure

```
gsv-storage/
├── agents/
│   └── {agentId}/
│       ├── SOUL.md           # Agent personality/instructions
│       ├── HEARTBEAT.md      # Proactive prompt config
│       ├── USER.md           # User info
│       └── sessions/
│           └── *.jsonl.gz    # Archived transcripts
└── skills/
    └── {skillName}/
        └── SKILL.md          # Skill definitions
```

## Multi-Node Setup

Run nodes on different machines, each provides its own namespaced tools:

```bash
# On laptop
gsv node --id laptop --workspace ~/code

# On server  
gsv node --id server --workspace /var/app

# On raspberry pi
gsv node --id pi --workspace /home/pi
```

The LLM can then say:
- "Check the logs on the server" → uses `server:Bash`
- "Edit the code on my laptop" → uses `laptop:Write`
- "Read the sensor data from the pi" → uses `pi:Read`
