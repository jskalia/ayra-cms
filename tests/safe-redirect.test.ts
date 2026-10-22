/** After signing in, only a path on this site is followed (no open redirect). */
import { describe, expect, it } from 'vitest'

import { safeRedirect } from '../src/frontend/safe-redirect'

describe('where sign-in sends you next', () => {
  it.each(['/', '/sites/junaidkalia?tab=posts', '/records/posts/1'])('keeps a path on this site: %s', (p) => {
    expect(safeRedirect(p)).toBe(p)
  })
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '', undefined, 42, '/x\ny'])('refuses %s', (p) => {
    expect(safeRedirect(p)).toBe('/')
  })
})
