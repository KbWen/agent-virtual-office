const AGENTS = [
  { id: 'pm', name: 'PM', color: '#5B8CFF' },
  { id: 'arch', name: 'Architect', color: '#8B5CF6' },
  { id: 'dev', name: 'Developer', color: '#F97316' },
  { id: 'qa', name: 'QA', color: '#22C55E' },
  { id: 'ops', name: 'DevOps', color: '#EC4899' },
  { id: 'res', name: 'Researcher', color: '#06B6D4' },
  { id: 'gate', name: 'Gatekeeper', color: '#EAB308' },
  { id: 'designer', name: 'Designer', color: '#E8688A' },
]

const state = {}
AGENTS.forEach(a => { state[a.id] = null })

function clearActiveButtons() {
  document.querySelectorAll('.agent-btns button').forEach(b => {
    b.className = b.className.replace(/active-\w+/, '').trim()
  })
}

function createAgentCard(agent) {
  const card = document.createElement('div')
  card.className = 'agent-card'

  const name = document.createElement('div')
  name.className = 'agent-name'
  name.style.color = agent.color
  name.textContent = agent.name
  card.appendChild(name)

  const buttons = document.createElement('div')
  buttons.className = 'agent-btns'
  for (const status of ['working', 'blocked', 'done']) {
    const btn = document.createElement('button')
    btn.dataset.agent = agent.id
    btn.dataset.status = status
    btn.type = 'button'
    btn.textContent = status === 'working' ? 'work' : status === 'blocked' ? 'block' : 'done'
    btn.addEventListener('click', () => toggle(agent.id, status, btn))
    buttons.appendChild(btn)
  }
  card.appendChild(buttons)

  return card
}

function toggle(agentId, status, btn) {
  if (state[agentId] === status) {
    state[agentId] = null
    btn.className = btn.className.replace(/active-\w+/, '').trim()
  } else {
    state[agentId] = status
    btn.parentElement.querySelectorAll('button').forEach(b => {
      b.className = b.className.replace(/active-\w+/, '').trim()
    })
    btn.classList.add('active-' + status)
  }
  sendCurrent()
}

function sendCurrent() {
  const agents = []
  for (const [id, status] of Object.entries(state)) {
    if (status) agents.push({ role: id, task: null, status, label: null })
  }
  const workflow = document.getElementById('workflowInput').value || null
  const msg = { type: 'office-status', agents, workflow, activeCount: agents.length }
  window.officeBridge.send(msg)
  logMessage(msg)
}

function clearAll() {
  for (const id of Object.keys(state)) state[id] = null
  clearActiveButtons()
  document.getElementById('workflowInput').value = ''
  window.officeBridge.stop()
  setTimeout(() => { window.location.reload() }, 100)
}

function preset(name) {
  for (const id of Object.keys(state)) state[id] = null
  clearActiveButtons()

  const presets = {
    'solo-dev': { dev: 'working', workflow: 'Solo Development' },
    'full-sprint': { pm: 'working', arch: 'working', dev: 'working', qa: 'working', ops: 'working', workflow: 'Full Sprint' },
    'code-review': { dev: 'done', qa: 'working', gate: 'working', workflow: 'Code Review' },
    'deploy': { dev: 'done', qa: 'done', ops: 'working', gate: 'working', workflow: 'Deployment' },
    'blocked': { dev: 'blocked', pm: 'working', workflow: 'Bug Investigation' },
    'research': { res: 'working', arch: 'working', workflow: 'Research Phase' },
    'done': { pm: 'done', arch: 'done', dev: 'done', qa: 'done', ops: 'done', res: 'done', gate: 'done', workflow: 'Sprint Complete!' },
  }

  const p = presets[name]
  if (!p) return

  document.getElementById('workflowInput').value = p.workflow || ''
  for (const [id, status] of Object.entries(p)) {
    if (id === 'workflow') continue
    state[id] = status
    const btn = document.querySelector(`button[data-agent="${id}"][data-status="${status}"]`)
    if (btn) btn.classList.add('active-' + status)
  }
  sendCurrent()
}

function logMessage(msg) {
  const log = document.getElementById('log')
  const time = new Date().toLocaleTimeString()
  const agents = (msg.agents || []).map(a => `${a.role}=${a.status}`).join(', ')
  const entry = document.createElement('div')
  entry.className = 'entry'

  const timeNode = document.createElement('span')
  timeNode.className = 'time'
  timeNode.textContent = time
  entry.appendChild(timeNode)
  entry.appendChild(document.createTextNode(` ${agents}`))
  if (msg.workflow) entry.appendChild(document.createTextNode(` | ${msg.workflow}`))

  log.prepend(entry)
  while (log.children.length > 50) log.removeChild(log.lastChild)
}

function applyUrlParams() {
  if (!window.location.search) return

  const params = new URLSearchParams(window.location.search)
  for (const [k, v] of params.entries()) {
    if (AGENTS.find(a => a.id === k)) {
      state[k] = v
      const isStatus = ['working', 'blocked', 'done'].includes(v)
      const btn = document.querySelector(`button[data-agent="${k}"][data-status="${isStatus ? v : 'working'}"]`)
      if (btn) btn.classList.add('active-' + (isStatus ? v : 'working'))
    }
    if (k === 'workflow') document.getElementById('workflowInput').value = v
  }
}

document.getElementById('agentsGrid').append(...AGENTS.map(createAgentCard))
document.getElementById('sendBtn').addEventListener('click', sendCurrent)
document.getElementById('clearBtn').addEventListener('click', clearAll)
document.querySelectorAll('[data-preset]').forEach(btn => {
  btn.addEventListener('click', () => preset(btn.dataset.preset))
})
applyUrlParams()
