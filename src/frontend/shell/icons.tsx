import { CircleCheckBig, Globe, House, KeyRound, ReceiptText, Search } from 'lucide-react'

import type { IconName } from './nav'

export const ICONS: Record<IconName, typeof House> = {
  home: House,
  search: Search,
  receipts: ReceiptText,
  checks: CircleCheckBig,
  site: Globe,
  admin: KeyRound,
}
