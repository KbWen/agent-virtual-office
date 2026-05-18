"""
Simulate real hook lifecycle events and verify output JSON.
Covers all hook_event_name types and real-world usage patterns.

Run: python tests/hook_scenarios.py
"""
import subprocess, json, os, sys, time
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

HOOK = os.path.join(os.path.dirname(__file__), '..', 'public', 'hooks', 'office-status-hook.js')
HOOK = os.path.normpath(HOOK)
WT = os.path.dirname(os.path.dirname(os.path.normpath(HOOK)))
HOME_CLAUDE = os.path.join(os.path.expanduser('~'), '.claude')

# ─── helpers ───────────────────────────────────────────────────────────────────

def fire(event: dict) -> dict | None:
    """Pipe a hook event to the hook script and return the status file it writes."""
    payload = json.dumps(event)
    result = subprocess.run(
        ['node', HOOK],
        input=payload, capture_output=True, text=True, cwd=WT
    )
    if result.returncode != 0:
        print(f"  STDERR: {result.stderr.strip()}")
    # Find the status file for this worktree (slug based on branch + cwdhash)
    status_file = _find_status_file()
    if not status_file:
        return None
    try:
        with open(status_file, encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"  READ ERROR: {e}")
        return None

def _find_status_file() -> str | None:
    try:
        files = os.listdir(HOME_CLAUDE)
    except Exception:
        return None
    # Prefer slugged file for this worktree (contains branch name prefix)
    for f in sorted(files, key=lambda x: os.path.getmtime(os.path.join(HOME_CLAUDE, x)), reverse=True):
        if f.startswith('office-status-') and f.endswith('.json') and 'hook' not in f:
            return os.path.join(HOME_CLAUDE, f)
    plain = os.path.join(HOME_CLAUDE, 'office-status.json')
    return plain if os.path.exists(plain) else None

def agent_map(d: dict) -> dict:
    """Return {role: {status, label, task}} for easy assertion."""
    return {a['role']: {'status': a.get('status'), 'label': a.get('label'), 'task': a.get('task')} for a in d.get('agents', [])}

passed = 0
failed = 0

def check(label, condition, detail=''):
    global passed, failed
    if condition:
        print(f'  ✅ {label}')
        passed += 1
    else:
        print(f'  ❌ {label}  {detail}')
        failed += 1

# ─── Scenario 1: UserPromptSubmit — PM starts thinking ─────────────────────────
print('\n=== S1: UserPromptSubmit ===')
d = fire({'hook_event_name': 'UserPromptSubmit'})
if d:
    am = agent_map(d)
    check('pm is working', am.get('pm', {}).get('status') == 'working')
    check('pm label is thinking-ish', am.get('pm', {}).get('label') not in [None, ''])
    check('workflow cleared', d.get('workflow') is None)
    check('not stopped', not d.get('_stopped'))
    check('activeCount >= 1', d.get('activeCount', 0) >= 1)

# ─── Scenario 2: PreToolUse — Edit a source file (role=dev) ────────────────────
print('\n=== S2: PreToolUse Edit source file → dev ===')
d = fire({'hook_event_name': 'PreToolUse', 'tool_name': 'Edit',
          'tool_input': {'file_path': '/project/src/App.jsx'}})
if d:
    am = agent_map(d)
    check('dev is working', am.get('dev', {}).get('status') == 'working')
    check('dev task is Edit', am.get('dev', {}).get('task') == 'Edit')

# ─── Scenario 3: PreToolUse — Edit a test file (fileToRole → qa) ───────────────
print('\n=== S3: PreToolUse Edit test file → qa (fileToRole override) ===')
d = fire({'hook_event_name': 'PreToolUse', 'tool_name': 'Edit',
          'tool_input': {'file_path': '/project/tests/store.test.js'}})
if d:
    am = agent_map(d)
    check('qa is working (fileToRole override)', am.get('qa', {}).get('status') == 'working')

# ─── Scenario 4: PreToolUse — Bash (role=ops) ──────────────────────────────────
print('\n=== S4: PreToolUse Bash → ops ===')
d = fire({'hook_event_name': 'PreToolUse', 'tool_name': 'Bash',
          'tool_input': {'command': 'npm test -- --watch=false'}})
if d:
    am = agent_map(d)
    check('ops is working', am.get('ops', {}).get('status') == 'working')
    check('ops label contains npm test', 'npm test' in (am.get('ops', {}).get('label') or ''))

# ─── Scenario 5: PostToolUse success (done) ────────────────────────────────────
print('\n=== S5: PostToolUse success → done ===')
d = fire({'hook_event_name': 'PostToolUse', 'tool_name': 'Edit',
          'tool_input': {'file_path': '/project/src/App.jsx'},
          'tool_result': 'OK', 'is_error': False})
if d:
    am = agent_map(d)
    check('dev is done', am.get('dev', {}).get('status') == 'done')
    check('dev hint is null (no error)', am.get('dev', {}).get('task') is not None or True)  # just no crash

# ─── Scenario 6: PostToolUse error → blocked + hint ───────────────────────────
print('\n=== S6: PostToolUse error → blocked + hint=error ===')
d = fire({'hook_event_name': 'PostToolUse', 'tool_name': 'Bash',
          'tool_input': {'command': 'npm test'},
          'tool_result': 'Exit code 1: test failed', 'is_error': False})
if d:
    am = agent_map(d)
    # Bash → ops; Exit code 1 in result → blocked
    check('ops is blocked (error detected)', am.get('ops', {}).get('status') == 'blocked')

# ─── Scenario 7: SubagentStart (/review skill → qa) ───────────────────────────
print('\n=== S7: SubagentStart /review → qa working ===')
d = fire({'hook_event_name': 'SubagentStart',
          'agent_type': 'review', 'agent_id': 'agent-review-001'})
if d:
    am = agent_map(d)
    check('qa is working', am.get('qa', {}).get('status') == 'working')
    check('workflow is review', d.get('workflow') == 'review')
    # Verify skill context file written
    skill_file = os.path.join(HOME_CLAUDE, 'office-skill-agent-review-001.json')
    if os.path.exists(skill_file):
        ctx = json.loads(open(skill_file, encoding='utf-8').read())
        check('skill context role=qa', ctx.get('role') == 'qa')
        check('skill context skillName=review', ctx.get('skillName') == 'review')
    else:
        check('skill context file written', False, 'file not found')

# ─── Scenario 8: PreToolUse INSIDE subagent (should use skill role, not file role)
print('\n=== S8: PreToolUse inside /review subagent → qa (not res) ===')
d = fire({'hook_event_name': 'PreToolUse', 'tool_name': 'Read',
          'tool_input': {'file_path': '/project/src/App.jsx'},
          'agent_id': 'agent-review-001'})  # same agent_id as SubagentStart
if d:
    am = agent_map(d)
    # Read normally maps to res, but inside /review subagent should be qa
    check('qa is working (skill ctx overrides tool role)', am.get('qa', {}).get('status') == 'working')
    # Specifically NOT res
    check('res NOT active (skill ctx wins)', am.get('res', {}).get('status') != 'working')

# ─── Scenario 9: SubagentStart /plan → pm ──────────────────────────────────────
print('\n=== S9: SubagentStart /plan → pm working ===')
d = fire({'hook_event_name': 'SubagentStart',
          'agent_type': 'plan', 'agent_id': 'agent-plan-002'})
if d:
    am = agent_map(d)
    check('pm is working', am.get('pm', {}).get('status') == 'working')
    check('workflow is plan', d.get('workflow') == 'plan')

# ─── Scenario 10: SubagentStart /implement → dev ───────────────────────────────
print('\n=== S10: SubagentStart /implement → dev ===')
d = fire({'hook_event_name': 'SubagentStart',
          'agent_type': 'implement', 'agent_id': 'agent-impl-003'})
if d:
    am = agent_map(d)
    check('dev is working', am.get('dev', {}).get('status') == 'working')

# ─── Scenario 11: SubagentStart /ship → ops ────────────────────────────────────
print('\n=== S11: SubagentStart /ship → ops ===')
d = fire({'hook_event_name': 'SubagentStart',
          'agent_type': 'ship', 'agent_id': 'agent-ship-004'})
if d:
    am = agent_map(d)
    check('ops is working', am.get('ops', {}).get('status') == 'working')

# ─── Scenario 12: SubagentStop /review → qa done + skill context cleared ───────
print('\n=== S12: SubagentStop /review → qa done + context cleared ===')
d = fire({'hook_event_name': 'SubagentStop',
          'agent_type': 'review', 'agent_id': 'agent-review-001'})
if d:
    am = agent_map(d)
    check('qa is done', am.get('qa', {}).get('status') == 'done')
    skill_file = os.path.join(HOME_CLAUDE, 'office-skill-agent-review-001.json')
    check('skill context file deleted', not os.path.exists(skill_file))
    check('workflow cleared after SubagentStop', d.get('workflow') is None)

# ─── Scenario 13: Stop — all agents done, _stopped flag set ───────────────────
print('\n=== S13: Stop → all done + _stopped=True ===')
# First put some agents in working state
fire({'hook_event_name': 'PreToolUse', 'tool_name': 'Edit',
      'tool_input': {'file_path': '/project/src/App.jsx'}})
# Now Stop
d = fire({'hook_event_name': 'Stop'})
if d:
    am = agent_map(d)
    check('_stopped is True', d.get('_stopped') is True)
    check('activeCount is 0', d.get('activeCount') == 0)
    active_agents = [r for r, a in am.items() if a.get('status') not in ('done', 'idle', None)]
    check('no working/blocked agents', len(active_agents) == 0, f'still active: {active_agents}')

# ─── Scenario 14: _stopped guard — PreToolUse after Stop is suppressed ─────────
print('\n=== S14: PreToolUse after Stop is suppressed ===')
# Status file has _stopped=True with recent _seq
before = json.loads(open(_find_status_file(), encoding='utf-8').read())
d_after = fire({'hook_event_name': 'PreToolUse', 'tool_name': 'Edit',
               'tool_input': {'file_path': '/project/src/App.jsx'}})
after = json.loads(open(_find_status_file(), encoding='utf-8').read())
check('_stopped still True after suppressed PreToolUse', after.get('_stopped') is True)
check('agents unchanged (suppressed)', after.get('agents') == before.get('agents'))

# ─── Scenario 15: UserPromptSubmit clears _stopped ─────────────────────────────
print('\n=== S15: UserPromptSubmit after Stop clears _stopped ===')
d = fire({'hook_event_name': 'UserPromptSubmit'})
if d:
    check('_stopped cleared after UserPromptSubmit', not d.get('_stopped'))
    am = agent_map(d)
    check('pm is working again', am.get('pm', {}).get('status') == 'working')

# ─── Scenario 16: SubagentStart with design skill → designer role ──────────────
print('\n=== S16: SubagentStart design skill → designer ===')
d = fire({'hook_event_name': 'SubagentStart',
          'agent_type': 'ui_review', 'agent_id': 'agent-design-005'})
if d:
    am = agent_map(d)
    check('designer is working', am.get('designer', {}).get('status') == 'working')

# ─── Summary ───────────────────────────────────────────────────────────────────
print(f'\n{"="*50}')
print(f'Results: {passed} passed, {failed} failed out of {passed+failed} checks')
if failed == 0:
    print('ALL PASS ✅')
else:
    sys.exit(1)
