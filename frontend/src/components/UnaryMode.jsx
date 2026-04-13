import { useState } from 'react'

export default function UnaryMode() {
  const [name, setName]       = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)

  async function send() {
    if (!name.trim() || !message.trim()) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId:   `user-${name.toLowerCase().replace(/\s+/g, '-')}`,
          senderName: name.trim(),
          content:    message.trim(),
        }),
      })
      const data = await res.json()
      setResult(data)
      if (data.success) setMessage('')
    } catch (err) {
      setResult({ success: false, message: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="mode-header purple">
        <div className="mode-badge">gRPC · Mode 1</div>
        <h2>Unary RPC</h2>
        <p>Send one message, receive one response — the simplest gRPC pattern.</p>
        <code className="proto-code">
          rpc SendMessage(MessageRequest) returns (MessageResponse)
        </code>
      </div>

      {/* Body */}
      <div className="mode-body">
        <div className="field-row">
          <div className="field">
            <label>Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alice"
            />
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label>Message</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type something wonderful…"
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
          </div>
        </div>

        <button
          className="btn btn-purple"
          onClick={send}
          disabled={loading || !name.trim() || !message.trim()}
        >
          {loading ? '✦ Sending…' : '✦ Send Message'}
        </button>

        {result && (
          <div className={`result-card ${result.success ? 'success' : 'error'}`}>
            <div className="result-icon">{result.success ? '✓' : '✗'}</div>
            <div>
              <strong>{result.success ? 'Message delivered!' : 'Something went wrong'}</strong>
              {result.success ? (
                <p>ID #{result.messageId} · {result.message}</p>
              ) : (
                <p>{result.message}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
