using Chat.Protos;
using Grpc.Core;
using GrpcStatus = Grpc.Core.StatusCode;   // alias avoids clash with ControllerBase.StatusCode()
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace GrpcPOCApp.Controllers;

// ── DTOs ──────────────────────────────────────────────────────────────────
public record SendMessageDto(string SenderId, string SenderName, string Content, long Timestamp = 0);
public record SendResult(bool Success, int MessageId, string Message);
public record BulkUploadResult(bool Success, int MessagesUploaded, string Message);

/// <summary>
/// REST + SSE bridge that sits in front of the real gRPC service.
///
/// Flow for every request:
///   Browser  →  ChatController  →  ChatService.ChatServiceClient (gRPC)
///             (HTTP/1.1 REST)      (HTTP/2 on localhost:5062)
///                                →  ChatGrpcService  →  IMessageStore
///
/// MODE 1 – Unary RPC          POST /api/chat/send
/// MODE 2 – Server Streaming   GET  /api/chat/history   (SSE)
/// MODE 3 – Client Streaming   POST /api/chat/bulk-upload
/// MODE 4 – Bidi Streaming     GET  /api/chat/live-stream (SSE) +
///                             POST /api/chat/live-send
/// </summary>
[ApiController]
[Route("api/chat")]
public class ChatController : ControllerBase
{
    private readonly ChatService.ChatServiceClient _grpc;
    private readonly ILogger<ChatController> _logger;

    public ChatController(ChatService.ChatServiceClient grpc, ILogger<ChatController> logger)
    {
        _grpc = grpc;
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────────────────────
    // MODE 1: UNARY RPC
    // One request in → one response out.
    // Browser calls POST, controller calls gRPC SendMessage (Unary).
    // ─────────────────────────────────────────────────────────────────────
    [HttpPost("send")]
    public async Task<ActionResult<SendResult>> Send([FromBody] SendMessageDto dto)
    {
        try
        {
            // ► Real gRPC Unary call ◄
            var reply = await _grpc.SendMessageAsync(new MessageRequest
            {
                SenderId   = dto.SenderId,
                SenderName = dto.SenderName,
                Content    = dto.Content,
                Timestamp  = dto.Timestamp == 0
                    ? DateTimeOffset.UtcNow.ToUnixTimeSeconds()
                    : dto.Timestamp
            });

            _logger.LogInformation("[gRPC Unary] SendMessage → id={Id}", reply.MessageId);
            return Ok(new SendResult(reply.Success, reply.MessageId, reply.Message));
        }
        catch (RpcException ex)
        {
            _logger.LogError(ex, "[gRPC Unary] SendMessage failed");
            return StatusCode(500, new SendResult(false, 0, ex.Status.Detail));
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // MODE 2: SERVER STREAMING RPC
    // One request in → server streams many responses.
    // Browser opens an EventSource; we open a gRPC server-streaming call
    // and forward each streamed message as an SSE event.
    // ─────────────────────────────────────────────────────────────────────
    [HttpGet("history")]
    public async Task GetHistory(
        [FromQuery] int limit  = 10,
        [FromQuery] int offset = 0,
        CancellationToken ct   = default)
    {
        Response.Headers.Append("Content-Type",      "text/event-stream");
        Response.Headers.Append("Cache-Control",     "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        try
        {
            // ► Real gRPC Server-Streaming call ◄
            using var call = _grpc.GetChatHistory(
                new HistoryRequest { Limit = limit, Offset = offset },
                cancellationToken: ct);

            int displayId = offset;

            // Each message arrives one-by-one from the gRPC stream;
            // forward it immediately as an SSE event — same drip effect.
            await foreach (var msg in call.ResponseStream.ReadAllAsync(ct))
            {
                displayId++;
                _logger.LogInformation("[gRPC ServerStream] received msg #{Id}", displayId);

                var json = JsonSerializer.Serialize(new
                {
                    id         = displayId,
                    senderId   = msg.SenderId,
                    senderName = msg.SenderName,
                    content    = msg.Content,
                    timestamp  = msg.Timestamp
                });

                await Response.WriteAsync($"data: {json}\n\n", ct);
                await Response.Body.FlushAsync(ct);
            }
        }
        catch (RpcException ex) when (ex.StatusCode == GrpcStatus.Cancelled) { /* client disconnected */ }
        catch (RpcException ex)
        {
            _logger.LogError(ex, "[gRPC ServerStream] GetChatHistory failed");
        }

        // Signal the EventSource that the stream is done
        if (!ct.IsCancellationRequested)
        {
            await Response.WriteAsync("event: done\ndata: {}\n\n", ct);
            await Response.Body.FlushAsync(ct);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // MODE 3: CLIENT STREAMING RPC
    // Client streams many requests → server replies once.
    // The HTTP body carries the "stream" as a JSON array; we open a gRPC
    // client-streaming call and write each item one at a time before
    // completing the stream.
    // ─────────────────────────────────────────────────────────────────────
    [HttpPost("bulk-upload")]
    public async Task<ActionResult<BulkUploadResult>> BulkUpload(
        [FromBody] List<SendMessageDto> dtos)
    {
        try
        {
            // ► Real gRPC Client-Streaming call ◄
            using var call = _grpc.BulkUploadMessages();

            foreach (var dto in dtos)
            {
                _logger.LogInformation("[gRPC ClientStream] streaming msg from {Sender}", dto.SenderName);

                await call.RequestStream.WriteAsync(new MessageRequest
                {
                    SenderId   = dto.SenderId,
                    SenderName = dto.SenderName,
                    Content    = dto.Content,
                    Timestamp  = dto.Timestamp == 0
                        ? DateTimeOffset.UtcNow.ToUnixTimeSeconds()
                        : dto.Timestamp
                });
            }

            // Signal end of client stream → server sends its single response
            await call.RequestStream.CompleteAsync();
            var reply = await call;

            _logger.LogInformation("[gRPC ClientStream] BulkUpload complete → {Count} saved", reply.MessagesUploaded);
            return Ok(new BulkUploadResult(reply.Success, reply.MessagesUploaded, reply.Message));
        }
        catch (RpcException ex)
        {
            _logger.LogError(ex, "[gRPC ClientStream] BulkUploadMessages failed");
            return StatusCode(500, new BulkUploadResult(false, 0, ex.Status.Detail));
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // MODE 4: BIDIRECTIONAL STREAMING RPC
    //
    // A browser cannot hold a true bidi stream, so we split it into two
    // HTTP endpoints that together replicate the two-direction behaviour:
    //
    //   live-stream (SSE GET)  = server → client direction
    //     Polls for new messages using the gRPC Server-Streaming RPC
    //     (GetChatHistory) in a loop, forwarding each arrival as an SSE event.
    //
    //   live-send (POST)       = client → server direction
    //     Calls the gRPC Unary RPC (SendMessage) so the message is stored
    //     by the real gRPC service; the SSE loop picks it up moments later.
    //
    // The gRPC BidirectionalStreaming RPC (LiveChat) is available for native
    // gRPC clients (grpcurl, Postman, .NET, etc.) on the same port.
    // ─────────────────────────────────────────────────────────────────────
    [HttpGet("live-stream")]
    public async Task LiveStream(CancellationToken ct)
    {
        Response.Headers.Append("Content-Type",      "text/event-stream");
        Response.Headers.Append("Cache-Control",     "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        // Heartbeat — tells the browser the connection is open
        await Response.WriteAsync(": connected\n\n", ct);
        await Response.Body.FlushAsync(ct);

        int seenOffset = 0;

        while (!ct.IsCancellationRequested)
        {
            try
            {
                // ► Real gRPC Server-Streaming call (used as a poll) ◄
                using var call = _grpc.GetChatHistory(
                    new HistoryRequest { Limit = 50, Offset = seenOffset },
                    cancellationToken: ct);

                await foreach (var msg in call.ResponseStream.ReadAllAsync(ct))
                {
                    if (ct.IsCancellationRequested) break;
                    seenOffset++;

                    _logger.LogInformation("[gRPC Bidi/poll] new msg #{Offset} from {Sender}", seenOffset, msg.SenderName);

                    var json = JsonSerializer.Serialize(new
                    {
                        id         = seenOffset,
                        senderId   = msg.SenderId,
                        senderName = msg.SenderName,
                        content    = msg.Content,
                        timestamp  = msg.Timestamp
                    });

                    await Response.WriteAsync($"data: {json}\n\n", ct);
                    await Response.Body.FlushAsync(ct);
                }

                // Brief pause between polls
                await Task.Delay(400, ct);
            }
            catch (OperationCanceledException) { break; }
            catch (RpcException ex) when (
                ct.IsCancellationRequested ||
                ex.StatusCode == GrpcStatus.Cancelled) { break; }
            catch (RpcException ex)
            {
                _logger.LogError(ex, "[gRPC Bidi/poll] stream error");
                break;
            }
        }
    }

    [HttpPost("live-send")]
    public async Task<ActionResult<SendResult>> LiveSend([FromBody] SendMessageDto dto)
    {
        // ► Real gRPC Unary call — same path as Mode 1 ◄
        return await Send(dto);
    }
}
