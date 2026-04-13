using Chat.Protos;

// Allow the gRPC HttpClient to speak HTTP/2 over plain HTTP (no TLS).
// Required when the target address is http:// instead of https://
AppContext.SetSwitch("System.Net.Http.SocketsHttpHandler.Http2UnencryptedSupport", true);

var builder = WebApplication.CreateBuilder(args);

// ── Services ──────────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddGrpcClient<ChatService.ChatServiceClient>(o =>
{
    o.Address = new Uri(builder.Configuration["GrpcServer:Address"] ?? "http://localhost:5001");
});

// CORS for the React dev server (port 3000 → port 5062)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseCors("AllowAll");
app.UseAuthorization();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();   // REST / SSE bridge

app.Run();
