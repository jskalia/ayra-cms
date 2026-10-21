/** What the control room's navigation lists (serializable, so client parts can render it too). */
export type IconName = 'home' | 'search' | 'receipts' | 'checks' | 'site' | 'admin'
export type NavItem = { href: string; label: string; icon: IconName; dot?: string; external?: boolean }
export type NavSection = { title?: string; items: NavItem[] }
export type ShellUser = { name: string; email: string; role: 'Admin' | 'Viewer'; isAdmin: boolean }
export type ShellSite = { slug: string; name: string; status?: string }
