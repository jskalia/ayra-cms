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
    <span className="ayra-graphic" style={{ display: 'inline-flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <style>{swap}</style>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <img className="on-light" src="/brand/ayraagent-mark-light.svg" alt="" style={{ height: 34, width: 34 }} />
        <img className="on-dark" src="/brand/ayraagent-mark-dark.svg" alt="" style={{ height: 34, width: 34 }} />
        <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Ayra CMS</span>
      </span>
      <span style={{ fontSize: 13, opacity: 0.65, letterSpacing: '0.02em' }}>Accounts and keys</span>
    </span>
  )
}

export function Icon() {
  return (
    <span className="ayra-graphic" style={{ display: 'block', width: 18, height: 18 }}>
      <style>{swap}</style>
      <img className="on-light" src="/brand/ayraagent-mark-light.svg" alt="" width={18} height={18} style={{ width: 18, height: 18, objectFit: 'contain' }} />
      <img className="on-dark" src="/brand/ayraagent-mark-dark.svg" alt="" width={18} height={18} style={{ width: 18, height: 18, objectFit: 'contain' }} />
    </span>
  )
}
