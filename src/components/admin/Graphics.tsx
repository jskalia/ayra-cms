/**
 * 10.6 · The Ayra mark in Payload's own admin (sign-in page and nav), so /admin matches the
 * control room. Payload sets data-theme on <html>; the dark files are white, the light ones ink.
 */
const swap = `
  .ayra-graphic .on-dark { display: none; }
  html[data-theme='dark'] .ayra-graphic .on-light { display: none; }
  html[data-theme='dark'] .ayra-graphic .on-dark { display: block; }
`

export function Logo() {
  return (
    <span className="ayra-graphic" style={{ display: 'inline-flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
      <style>{swap}</style>
      <img className="on-light" src="/brand/ayraagent-logo-light.svg" alt="AyraAgent" style={{ height: 34, width: 'auto' }} />
      <img className="on-dark" src="/brand/ayraagent-logo-dark.svg" alt="AyraAgent" style={{ height: 34, width: 'auto' }} />
      <span style={{ fontSize: 13, opacity: 0.65, letterSpacing: '0.02em' }}>CMS · accounts and keys</span>
    </span>
  )
}

export function Icon() {
  return (
    <span className="ayra-graphic" style={{ display: 'inline-flex' }}>
      <style>{swap}</style>
      <img className="on-light" src="/brand/ayraagent-mark-light.svg" alt="AyraAgent" style={{ height: 26, width: 26 }} />
      <img className="on-dark" src="/brand/ayraagent-mark-dark.svg" alt="AyraAgent" style={{ height: 26, width: 26 }} />
    </span>
  )
}
