// spec_ref: docs/specs/cozy-interactions.md C6 — actual scene activation handlers.
import { expect, it, vi } from 'vitest'
vi.mock('../src/i18n', () => ({ useLocale: () => {}, t: (_key, fallback) => fallback }))
import ScenePostcard from '../src/components/ScenePostcard.jsx'

it('pointer and keyboard pick up the same card and own only their activation keys', () => {
  const onOpen = vi.fn()
  const root = ScenePostcard({ onOpen })
  const event = { currentTarget: { focus: vi.fn() }, stopPropagation: vi.fn(), preventDefault: vi.fn() }
  root.props.onClick(event)
  for (const key of [' ', 'Enter']) root.props.onKeyDown({ ...event, key, repeat: false })
  expect(onOpen).toHaveBeenCalledTimes(3)
  expect(event.currentTarget.focus).toHaveBeenCalledTimes(3)
  expect(event.stopPropagation).toHaveBeenCalledTimes(3)
  expect(event.preventDefault).toHaveBeenCalledTimes(2)
  root.props.onKeyDown({ ...event, key: 'Enter', repeat: true })
  root.props.onKeyDown({ ...event, key: 'l', repeat: false })
  expect(onOpen).toHaveBeenCalledTimes(3)
})
