import { useState, useRef } from 'react'

function initials(name) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function ServerStreamMode() {
  const [limit, setLimit]       = useState(10)
  const [offset, setOffset]     = useState(0)
  const [messages, setMessages] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [done, setDone]         = useState(false)
  const esRef = useRef(null)

  function fetchHistory() {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    setMessages([])
    setDone(false)
    setStreaming(true)

    const url = `/api/chat/history?limit=${limit}&offset=${offset}`
    const es  = new EventSource(url)
    esRef.current = es

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      setMessages((prev) => [...prev, msg])
    }

    es.addEventListener('done', () => {
      setStreaming(false)
      setDone(true)
      es.close()
      esRef.current = null
    })

    es.onerror = () => {
      setStreaming(false)
      es.close()
      esRef.current = null
    }
  }

  return (
    <>
      <div className="mode-header blue">
        <div className="mode-badge">gRPC · Mode 2</div>
        <h2>Server Streaming RPC</h2>
        <p>
          One request — the server streams messages back one by one over a single
          HTTP/2 connection.
        </p>
        <code className="proto-code">
          rpc GetChatHistory(HistoryRequest) returns (stream MessageRequest)
        </code>
      </div>

      <div className="mode-body">
        <div className="field-row" style={{ alignItems: 'flex-end' }}>
          <div className="field">
            <label>Limit</label>
            <input
              type="number"
              value={limit}
              min={1}
              max={100}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Offset</label>
            <input
              type="number"
              value={offset}
              min={0}
              onChange={(e) => setOffset(Number(e.target.value))}
            />
          </div>
          <button
            className="btn btn-blue"
            onClick={fetchHistory}
            disabled={streaming}
            style={{ marginBottom: 14 }}
          >
            {streaming ? '⇉ Streaming…' : '⇉ Fetch History'}
          </button>
        </div>

        {streaming && (
          <div className="stream-bar">
            <div className="stream-indicator" />
            Receiving stream · {messages.length} message{messages.length !== 1 ? 's' : ''} so far
          </div>
        )}

        {done && messages.length === 0 && (
          <div className="result-card error" style={{ marginTop: 12 }}>
            <div className="result-icon">!</div>
            <div>
              <strong>No messages found</strong>
              <p>Send some messages in Mode 1 first, then come back here.</p>
            </div>
          </div>
        )}

        {done && messages.length > 0 && (
          <div className="result-card success" style={{ marginTop: 12 }}>
            <div className="result-icon">✓</div>
            <div>
              <strong>Stream complete</strong>
              <p>{messages.length} message{messages.length !== 1 ? 's' : ''} received</p>
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="log-box" style={{ marginTop: 14 }}>
            {messages.map((msg, i) => (
              <div className="log-item blue" key={i}>
                <div className="log-item-avatar">{initials(msg.senderName)}</div>
                <div className="log-item-body">
                  <div className="log-item-sender">{msg.senderName}</div>
                  <div className="log-item-text">{msg.content}</div>
                  <div className="log-item-id">#{msg.id}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {messages.length === 0 && !streaming && !done && (
          <div className="log-box">
            <div className="log-placeholder">
              <span>⇉</span>
              Click "Fetch History" to watch messages stream in one by one
            </div>
          </div>
        )}
      </div>
    </>
  )
}
