using GrpcServer.Models;

namespace GrpcServer.Services;

public class InMemoryMessageStore : IMessageStore
{
    private static readonly List<ChatMessage> _messages = new();
    private static int                        _nextId   = 1;
    private static readonly object            _lock     = new();

    public Task<ChatMessage> AddMessageAsync(ChatMessage message)
    {
        lock (_lock)
        {
            message.Id        = _nextId++;
            message.CreatedAt = DateTime.UtcNow;
            _messages.Add(message);
            return Task.FromResult(message);
        }
    }

    public Task AddBulkMessagesAsync(IEnumerable<ChatMessage> messages)
    {
        lock (_lock)
        {
            foreach (var msg in messages)
            {
                msg.Id        = _nextId++;
                msg.CreatedAt = DateTime.UtcNow;
                _messages.Add(msg);
            }
            return Task.CompletedTask;
        }
    }

    public Task<IEnumerable<ChatMessage>> GetMessagesAsync(int limit = 10, int offset = 0)
    {
        lock (_lock)
        {
            var result = _messages.Skip(offset).Take(limit).ToList();
            return Task.FromResult<IEnumerable<ChatMessage>>(result);
        }
    }

    public Task<int> GetMessageCountAsync()
    {
        lock (_lock) { return Task.FromResult(_messages.Count); }
    }
}
