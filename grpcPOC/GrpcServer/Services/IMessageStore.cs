using GrpcServer.Models;

namespace GrpcServer.Services;

public interface IMessageStore
{
    Task<ChatMessage>              AddMessageAsync(ChatMessage message);
    Task<IEnumerable<ChatMessage>> GetMessagesAsync(int limit = 10, int offset = 0);
    Task                           AddBulkMessagesAsync(IEnumerable<ChatMessage> messages);
    Task<int>                      GetMessageCountAsync();
}
