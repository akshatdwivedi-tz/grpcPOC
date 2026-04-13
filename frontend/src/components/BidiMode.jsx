import { useState, useRef, useEffect } from 'react'

function ts() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export default function BidiMode() {
  const [name, setName]         = useState('')
  const [content, setContent]   = useState('')
  const [messages, setMessages] = useState([])
  const [status, setStatus]     = useState('off') // 'off' | 'connecting' | 'on'
  const esRef    = useRef(null)
  const chatRef  = useRef(null)
  const nameRef  = useRef(name)
  nameRef.current = name

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  // Cleanup on unmount
  useEffect(() => {
    return () => esRef.current?.close()
  }, [])

  function connect() {
    if (!name.trim()) return
    if (esRef.current) esRef.current.close()

    setStatus('connecting')
    setMessages([])

    const es = new EventSource('/api/chat/live-stream')
    esRef.current = es

    es.onopen = () => {
      setStatus('on')
      setMessages([
        {
          _system: true,
          content: `Connected as ${nameRef.current} — live stream open`,
          time: ts(),
        },
      ])
    }

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      setMessages((prev) => [
        ...prev,
        { ...msg, time: ts(), _system: false },
      ])
    }

    es.onerror = () => {
      setStatus('off')
      setMessages((prev) => [
        ...prev,
        { _system: true, content: 'Stream closed by server.', time: ts() },
      ])
      es.close()
      esRef.current = null
    }
  }

  function disconnect() {
    esRef.current?.close()
    esRef.current = null
    setStatus('off')
    setMessages((prev) => [
      ...prev,
      { _system: true, content: 'Disconnected.', time: ts() },
    ])
  }

  async function send() {
    const text = content.trim()
    if (!text || status !== 'on') return
    setContent('')

    try {
      await fetch('/api/chat/live-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId:   `user-${nameRef.current.toLowerCase().replace(/\s+/g, '-')}`,
          senderName: nameRef.current,
          content:    text,
        }),
      })
      // The SSE stream will echo the message back (server → client direction)
    } catch {
      setMessages((prev) => [
        ...prev,
        { _system: true, content: 'Failed to send message.', time: ts() },
      ])
    }
  }

  const statusText = {
    off:        'Disconnected — enter your name and click Connect',
    connecting: 'Connecting…',
    on:         `Connected as ${name} — stream is live`,
  }[status]

  return (
    <>
      <div className="mode-header mint">
        <div className="mode-badge">gRPC · Mode 4</div>
        <h2>Bidirectional Streaming RPC</h2>
        <p>
          Client and server stream simultaneously — messages flow in both
          directions at the same time over a single HTTP/2 connection.
        </p>
        <code className="proto-code">
          rpc LiveChat(stream MessageRequest) returns (stream MessageResponse)
        </code>
      </div>

      <div className="mode-body">
        {/* Status bar */}
        <div className="chat-status">
          <div className={`status-dot ${status}`} />
          <span>{statusText}</span>
        </div>

        {/* Chat window */}
        <div className="chat-box" ref={chatRef}>
          {messages.length === 0 ? (
            <div className="chat-empty">
              <span>⇆</span>
              Connect to open the live bidirectional stream
            </div>
          ) : (
            messages.map((msg, i) => {
              if (msg._system) {
                return (
                  <div
                    key={i}
                    style={{
                      textAlign: 'center',
                      fontSize: '0.72rem',
                      color: 'var(--text-light)',
                      fontWeight: 600,
                      padding: '4px 0',
                    }}
                  >
                    {msg.content} · {msg.time}
                  </div>
                )
              }

              const isMe = msg.senderName === name
              return (
                <div className={`chat-msg ${isMe ? 'me' : 'other'}`} key={i}>
                  <div className="chat-bubble">{msg.content}</div>
                  <div className="chat-meta">
                    {isMe ? 'You' : msg.senderName} · {msg.time}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Controls */}
        <div className="chat-input-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            disabled={status !== 'off'}
            style={{ maxWidth: 160 }}
          />
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={status === 'on' ? 'Type a message…' : 'Connect first'}
            disabled={status !== 'on'}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            style={{ flex: 1 }}
          />

          {status === 'off' && (
            <button
              className="btn btn-mint"
              onClick={connect}
              disabled={!name.trim()}
            >
              Connect
            </button>
          )}

          {status === 'connecting' && (
            <button className="btn btn-mint" disabled>
              Connecting…
            </button>
          )}

          {status === 'on' && (
            <>
              <button
                className="btn btn-mint"
                onClick={send}
                disabled={!content.trim()}
              >
                Send
              </button>
              <button className="btn btn-danger" onClick={disconnect}>
                Disconnect
              </button>
            </>
          )}
        </div>

        <p
          style={{
            marginTop: 12,
            fontSize: '0.75rem',
            color: 'var(--text-light)',
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          Tip: open this page in two browser tabs with different names to see
          real-time bidirectional messages flow between them.
        </p>
      </div>
    </>
  )
}
