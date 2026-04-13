# gRPC POC — Chat Demo

A full-stack proof-of-concept demonstrating all four gRPC communication modes, with a .NET 10 backend and a React frontend.

## Architecture

```
Browser (React)
     │  HTTP / SSE  (port 3000 via Nginx in Docker)
     ▼
GrpcPOCApp  ── REST/SSE bridge  (port 5062)
     │  gRPC / HTTP2  (port 5001)
     ▼
GrpcServer  ── pure gRPC server
```

| Layer | Tech | Port |
|-------|------|------|
| Frontend | React 18 + Vite 5 | 3000 |
| REST Bridge | ASP.NET Core 10 (`GrpcPOCApp`) | 5062 |
| gRPC Server | ASP.NET Core 10 (`GrpcServer`) | 5001 |

## gRPC Modes

| # | Mode | Proto RPC | Frontend Component |
|---|------|-----------|--------------------|
| 1 | Unary | `SendMessage` | `UnaryMode.jsx` |
| 2 | Server Streaming | `GetChatHistory` | `ServerStreamMode.jsx` |
| 3 | Client Streaming | `BulkUploadMessages` | `ClientStreamMode.jsx` |
| 4 | Bidirectional Streaming | `LiveChat` | `BidiMode.jsx` |

Browsers can't speak gRPC directly, so `GrpcPOCApp` acts as a bridge — exposing REST and SSE endpoints that map to the four gRPC modes on `GrpcServer`.

## Running with Docker

```bash
docker compose up --build
```

Open **http://localhost:3000**

To stop:

```bash
docker compose down
```

## Running Locally

**Terminal 1 — gRPC server**
```bash
cd grpcPOC/GrpcServer
dotnet run
# Listening on http://localhost:5001 (HTTP/2)
```

**Terminal 2 — REST bridge**
```bash
cd grpcPOC/GrpcPOCApp
dotnet run --launch-profile http
# Listening on http://localhost:5062
```

**Terminal 3 — Frontend**
```bash
cd frontend
npm install
npm run dev
# http://localhost:3000
```

## Project Structure

```
grpcPOC/
├── GrpcServer/
│   ├── Protos/message.proto       # Service + message definitions
│   ├── Services/ChatGrpcService.cs
│   └── Program.cs
├── GrpcPOCApp/
│   ├── Controllers/ChatController.cs  # REST/SSE → gRPC bridge
│   ├── Services/ChatGrpcServices.cs
│   └── Program.cs
frontend/
├── src/
│   ├── components/
│   │   ├── UnaryMode.jsx
│   │   ├── ServerStreamMode.jsx
│   │   ├── ClientStreamMode.jsx
│   │   └── BidiMode.jsx
│   └── App.jsx
├── vite.config.js                 # Dev proxy: /api → localhost:5062
Dockerfile.grpc-server
Dockerfile.grpc-poc-app
Dockerfile.frontend
nginx.conf                         # SPA serve + /api proxy for Docker
docker-compose.yml
```

## Proto Contract

```protobuf
service ChatService {
  rpc SendMessage        (MessageRequest)        returns (MessageResponse);         // Unary
  rpc GetChatHistory     (HistoryRequest)         returns (stream MessageRequest);   // Server stream
  rpc BulkUploadMessages (stream MessageRequest)  returns (UploadResponse);         // Client stream
  rpc LiveChat           (stream MessageRequest)  returns (stream MessageResponse);  // Bidi stream
}
```
