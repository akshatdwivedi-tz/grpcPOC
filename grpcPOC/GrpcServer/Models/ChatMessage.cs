namespace GrpcServer.Models;

public class ChatMessage
{
    public int      Id         { get; set; }
    public string   SenderId   { get; set; } = string.Empty;
    public string   SenderName { get; set; } = string.Empty;
    public string   Content    { get; set; } = string.Empty;
    public long     Timestamp  { get; set; }
    public DateTime CreatedAt  { get; set; } = DateTime.UtcNow;
}
