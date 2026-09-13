export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeContent: 'center',
        gap: 12,
        textAlign: 'center',
        fontFamily: 'ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: '#1c1c1c',
      }}
    >
      <h1 style={{ fontSize: 22, letterSpacing: '-0.02em' }}>AyraAgent CMS</h1>
      <p style={{ color: 'rgba(28,28,28,0.56)', fontSize: 14 }}>
        Content service for ayraagent.ai and heyayra.ai.
      </p>
      <p>
        <a href="/admin" style={{ color: '#1c1c1c', fontWeight: 600 }}>
          Admin → /admin
        </a>
      </p>
    </main>
  )
}
