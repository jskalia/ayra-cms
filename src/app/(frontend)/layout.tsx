import type { Metadata } from 'next'
import React from 'react'

import '../globals.css'
import './control-room.css'

export const metadata: Metadata = {
  title: {
    default: 'Ayra CMS',
    template: '%s · Ayra CMS',
  },
  description: 'The control room for every site’s content: what each site holds, where it came from, and what needs attention.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
