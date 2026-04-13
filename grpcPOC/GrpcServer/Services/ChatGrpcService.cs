using Chat.Protos;
using Grpc.Core;
using GrpcServer.Models;

namespace GrpcServer.Services;

public class ChatGrpcService : ChatService.ChatServiceBase
{
    private readonly IMessageStore           _store;
    private readonly ILogger<ChatGrpcService> _logger;

    public ChatGrpcService(IMessageStore store, ILogger<ChatGrpcService> logger)
    {
        _store  = store;
        _logger = logger;
    }

    // ── MODE 1: UNARY ─────────────────────────────────────────────────────────
    public override async Task<MessageResponse> SendMessage(
        MessageRequest request, ServerCallContext context)
    {
        try
        {
            var saved = await _store.AddMessageAsync(new ChatMessage
            {
                SenderId   = request.SenderId,
                SenderName = request.SenderName,
                Content    = request.Content,
                Timestamp  = request.Timestamp
            });

            _logger.LogInformation("[Unary] Saved message id={Id} from {Sender}", saved.Id, saved.SenderName);

            return new MessageResponse
            {
                Success   = true,
                Message   = "Message sent successfully",
                MessageId = saved.Id
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Unary] SendMessage failed");
            return new MessageResponse { Success = false, Message = ex.Message };
        }
    }

    // ── MODE 2: SERVER STREAMING ───────────────────────────────────────────────
    public override async Task GetChatHistory(
        HistoryRequest request,
        IServerStreamWriter<MessageRequest> responseStream,
        ServerCallContext context)
    {
        try
        {
            var messages = await _store.GetMessagesAsync(request.Limit, request.Offset);

            foreach (var msg in messages)
            {
                if (context.CancellationToken.IsCancellationRequested) break;

                _logger.LogInformation("[ServerStream] Streaming message id={Id}", msg.Id);

                await responseStream.WriteAsync(new MessageRequest
                {
                    SenderId   = msg.SenderId,
                    SenderName = msg.SenderName,
                    Content    = msg.Content,
                    Timestamp  = msg.Timestamp
                });

                await Task.Delay(100, context.CancellationToken); // simulated stream drip
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ServerStream] GetChatHistory failed");
            throw new RpcException(new Status(StatusCode.Internal, ex.Message));
        }
    }

    // ── MODE 3: CLIENT STREAMING ───────────────────────────────────────────────
    public override async Task<UploadResponse> BulkUploadMessages(
        IAsyncStreamReader<MessageRequest> requestStream,
        ServerCallContext context)
    {
        var messages = new List<ChatMessage>();

        try
        {
            await foreach (var req in requestStream.ReadAllAsync(context.CancellationToken))
            {
                _logger.LogInformation("[ClientStream] Received message from {Sender}", req.SenderName);

                messages.Add(new ChatMessage
                {
                    SenderId   = req.SenderId,
                    SenderName = req.SenderName,
                    Content    = req.Content,
                    Timestamp  = req.Timestamp
                });
            }

            await _store.AddBulkMessagesAsync(messages);

            return new UploadResponse
            {
                Success          = true,
                MessagesUploaded = messages.Count,
                Message          = $"{messages.Count} messages uploaded successfully"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ClientStream] BulkUploadMessages failed");
            return new UploadResponse
            {
                Success          = false,
                MessagesUploaded = messages.Count,
                Message          = ex.Message
            };
        }
    }

    // ── MODE 4: BIDIRECTIONAL STREAMING ───────────────────────────────────────
    public override async Task LiveChat(
        IAsyncStreamReader<MessageRequest>  requestStream,
        IServerStreamWriter<MessageResponse> responseStream,
        ServerCallContext context)
    {
        try
        {
            await foreach (var req in requestStream.ReadAllAsync(context.CancellationToken))
            {
                var saved = await _store.AddMessageAsync(new ChatMessage
                {
                    SenderId   = req.SenderId,
                    SenderName = req.SenderName,
                    Content    = req.Content,
                    Timestamp  = req.Timestamp
                });

                _logger.LogInformation("[Bidi] Echo id={Id} from {Sender}", saved.Id, req.SenderName);

                await responseStream.WriteAsync(new MessageResponse
                {
                    Success   = true,
                    Message   = $"Received from {req.SenderName}",
                    MessageId = saved.Id
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Bidi] LiveChat failed");
            throw new RpcException(new Status(StatusCode.Internal, ex.Message));
        }
    }
}
