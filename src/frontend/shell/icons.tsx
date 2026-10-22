import { CircleCheckBig, Globe, House, KeyRound, Newspaper, ReceiptText, Search } from 'lucide-react'

import type { IconName } from './nav'

export const ICONS: Record<IconName, typeof House> = {
  home: House,
  blogs: Newspaper,
  search: Search,
  receipts: ReceiptText,
  checks: CircleCheckBig,
  site: Globe,
  admin: KeyRound,
}
