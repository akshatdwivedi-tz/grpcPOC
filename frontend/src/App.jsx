import { useState } from 'react'
import UnaryMode from './components/UnaryMode'
import ServerStreamMode from './components/ServerStreamMode'
import ClientStreamMode from './components/ClientStreamMode'
import BidiMode from './components/BidiMode'

const MODES = [
  {
    id: 'unary',
    icon: '→',
    name: 'Unary',
    hint: '1 req · 1 res',
    color: 'purple',
    activeClass: 'active-purple',
  },
  {
    id: 'server-stream',
    icon: '⇉',
    name: 'Server Stream',
    hint: '1 req · many res',
    color: 'blue',
    activeClass: 'active-blue',
  },
  {
    id: 'client-stream',
    icon: '⇇',
    name: 'Client Stream',
    hint: 'many req · 1 res',
    color: 'pink',
    activeClass: 'active-pink',
  },
  {
    id: 'bidi',
    icon: '⇆',
    name: 'Bidirectional',
    hint: 'many ↔ many',
    color: 'mint',
    activeClass: 'active-mint',
  },
]

export default function App() {
  const [active, setActive] = useState('unary')

  const activeMode = MODES.find((m) => m.id === active)

  return (
    <div className="app">
      <header className="header">
        <div className="header-pill">✦ gRPC POC</div>
        <h1>Chat Demo</h1>
        <p className="header-sub">
          Explore all four gRPC communication patterns — beautifully.
        </p>
      </header>

      <main className="main">
        {/* Tab selector */}
        <div className="tabs">
          {MODES.map((mode, i) => (
            <button
              key={mode.id}
              className={`tab-btn ${active === mode.id ? `active ${mode.activeClass}` : ''}`}
              onClick={() => setActive(mode.id)}
            >
              <span className="tab-num">Mode {i + 1}</span>
              <span className="tab-icon">{mode.icon}</span>
              <span className="tab-name">{mode.name}</span>
              <span className="tab-hint">{mode.hint}</span>
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="panel" key={active}>
          {active === 'unary'         && <UnaryMode />}
          {active === 'server-stream' && <ServerStreamMode />}
          {active === 'client-stream' && <ClientStreamMode />}
          {active === 'bidi'          && <BidiMode />}
        </div>
      </main>
    </div>
  )
}
