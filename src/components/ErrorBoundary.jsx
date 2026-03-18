import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: '100%', background: '#1a1814', color: '#ccc',
          fontFamily: 'monospace', flexDirection: 'column', gap: '12px',
        }}>
          <div style={{ fontSize: '16px', color: '#E24B4A' }}>Something went wrong</div>
          <div style={{ fontSize: '11px', color: '#888', maxWidth: '400px', textAlign: 'center' }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '6px 16px', borderRadius: '4px', border: '1px solid #555',
              background: '#333', color: '#ccc', cursor: 'pointer', fontSize: '12px',
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
