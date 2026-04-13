import { useState } from 'react'

export default function ClientStreamMode() {
  const [name, setName]       = useState('')
  const [content, setContent] = useState('')
  const [queue, setQueue]     = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)

  function addToQueue() {
    if (!name.trim() || !content.trim()) return
    setQueue((prev) => [
      ...prev,
      {
        senderId:   `user-${name.toLowerCase().replace(/\s+/g, '-')}`,
        senderName: name.trim(),
        content:    content.trim(),
      },
    ])
    setContent('')
    setResult(null)
  }

  function clearQueue() {
    setQueue([])
    setResult(null)
  }

  async function uploadAll() {
    if (queue.length === 0) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/chat/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queue),
      })
      const data = await res.json()
      setResult(data)
      if (data.success) setQueue([])
    } catch (err) {
      setResult({ success: false, message: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mode-header pink">
        <div className="mode-badge">gRPC · Mode 3</div>
        <h2>Client Streaming RPC</h2>
        <p>
          Queue up messages, then stream them all to the server in one call — the
          server replies with a single summary once the stream closes.
        </p>
        <code className="proto-code">
          rpc BulkUploadMessages(stream MessageRequest) returns (UploadResponse)
        </code>
      </div>

      <div className="mode-body">
        {/* Add to queue */}
        <div className="field-row">
          <div className="field">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bob"
            />
          </div>
          <div className="field" style={{ flex: 2 }}>
            <label>Message</label>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Message to queue…"
              onKeyDown={(e) => e.key === 'Enter' && addToQueue()}
            />
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={addToQueue}
            disabled={!name.trim() || !content.trim()}
            style={{ marginBottom: 14 }}
          >
            + Queue
          </button>
        </div>

        {/* Queue preview */}
        <div className="queue-meta">
          <span>Message queue</span>
          {queue.length > 0 && (
            <span className="queue-count">{queue.length} queued</span>
          )}
        </div>

        <div className="queue-box">
          {queue.length === 0 ? (
            <div className="log-placeholder" style={{ height: '60px' }}>
              <span>⇇</span>
              Add messages above to build your stream
            </div>
          ) : (
            queue.map((item, i) => (
              <div className="queue-item" key={i}>
                <div className="queue-num">{i + 1}</div>
                <span className="queue-sender">{item.senderName}</span>
                <span className="queue-text">{item.content}</span>
              </div>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="btn-row">
          <button
            className="btn btn-pink"
            onClick={uploadAll}
            disabled={loading || queue.length === 0}
          >
            {loading
              ? '⇇ Streaming…'
              : `⇇ Upload All (${queue.length})`}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={clearQueue}
            disabled={queue.length === 0}
          >
            Clear
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`result-card ${result.success ? 'success' : 'error'}`}>
            <div className="result-icon">{result.success ? '✓' : '✗'}</div>
            <div>
              <strong>
                {result.success ? 'Upload complete!' : 'Upload failed'}
              </strong>
              <p>{result.message}</p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
