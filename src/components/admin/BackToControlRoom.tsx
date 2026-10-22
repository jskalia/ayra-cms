/** A way back to the control room from Payload's /admin (shown above the nav links). */
export function BackToControlRoom() {
  return (
    <a
      href="/"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '0 0 var(--base)',
        padding: '8px 10px',
        borderRadius: 6,
        border: '1px solid var(--theme-elevation-150)',
        fontSize: 13,
        fontWeight: 600,
        textDecoration: 'none',
        color: 'var(--theme-text)',
      }}
    >
      <span aria-hidden>←</span> Back to control room
    </a>
  )
}
