# RealScratch WebSocket Server

This is the WebSocket server component for the RealScratch Chrome extension, enabling real-time collaboration on Scratch projects.

## Features

- Real-time synchronization of Scratch project changes
- Session management for multiple collaboration rooms
- User presence tracking
- Error handling and reconnection support
- Health monitoring endpoint

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following content:
   ```
   PORT=3000
   WS_PORT=8080
   NODE_ENV=development
   ```

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## API Endpoints

### WebSocket Connection
- URL: `ws://localhost:8080`
- Protocol: WebSocket

### HTTP Endpoints
- Health Check: `GET http://localhost:3000/health`

## WebSocket Message Types

### Join Session
```json
{
  "type": "join",
  "sessionId": "your-session-id"
}
```

### Sync Changes
```json
{
  "type": "sync",
  "sessionId": "your-session-id",
  "changes": {
    // Project changes data
  }
}
```

### Leave Session
```json
{
  "type": "leave"
}
```

## Error Handling

The server will send error messages in the following format:
```json
{
  "type": "error",
  "message": "Error description"
}
```

## Security Considerations

1. The server uses CORS to restrict access
2. Each session is isolated
3. Messages are validated before processing
4. User IDs are randomly generated

## Monitoring

The `/health` endpoint provides basic server statistics:
- Number of active sessions
- Total number of connected clients
- Server status

## Deployment

For production deployment:

1. Set `NODE_ENV=production` in your `.env` file
2. Use a process manager like PM2
3. Set up SSL/TLS for secure WebSocket connections
4. Configure proper firewall rules
5. Set up monitoring and logging 