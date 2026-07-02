export function behaviorIndicatorIconKey(behavior) {
  switch (behavior || 'idle') {
    case 'typing': return 'keyboard'
    case 'reading-screen': return 'document'
    case 'writing-notes': return 'pencil'
    case 'research': return 'magnifier'
    case 'gantt-chart': return 'chart'
    case 'magnifier': return 'qa-magnifier'
    case 'shield-verify': return 'shield'
    case 'deploy-button': return 'deploy'
    case 'drink-coffee':
    case 'goto-coffee-machine': return 'coffee'
    case 'whiteboard': return 'whiteboard'
    case 'meeting': return 'meeting-bubbles'
    case 'chat': return 'chat-bubble'
    case 'check-phone': return 'phone'
    case 'stretch': return 'stretch'
    case 'nap': return 'sleep'
    case 'thumbs-up': return 'thumbs-up'
    case 'print': return 'printer'
    case 'scratch-head':
    case 'sigh':
    case 'desk-slam': return 'frustration'
    case 'phone-call': return 'phone-call'
    default: return null
  }
}
