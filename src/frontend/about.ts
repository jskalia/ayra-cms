/** What each tab on a site's page holds, in plain words (shown above its list and in its empty state). */
export type About = { what: string; from: string; link?: { href: (site: string) => string; label: string } }

export const SITE_INTRO =
  'Everything this site’s content is made of. Blogs are read and approved in the Blogs inbox; the rest comes from the ops folder through the sync, and is shown here read-only.'

export const ABOUT: Record<string, About> = {
  pages: {
    what: 'The pages of the website (home, product, pricing…). Each page has a route, a template and the blocks it is built from, and records who approved it.',
    from: 'From the ops folder, by the sync.',
  },
  posts: {
    what: 'Blog posts. Each shows its status: a draft waiting for approval, approved (public), or retired (hidden).',
    from: 'Written by AyraAgent, or synced from the ops folder.',
    link: { href: (site) => `/?site=${site}`, label: 'Review and approve blogs' },
  },
  claims: {
    what: 'Single facts the website is allowed to state, each with its source, an exact quote and who approved it. Pages cite claims instead of writing facts freehand.',
    from: 'From the ops folder, by the sync.',
  },
  atoms: {
    what: 'The data behind diagrams and cards: a workflow, a table, an FAQ, a metric or a quote. Pages place them as blocks.',
    from: 'From the ops folder, by the sync.',
  },
  media: {
    what: 'Approved images, each with alt text, licence and attribution. Only public, website-safe images belong here.',
    from: 'From the ops folder, by the sync.',
  },
  products: {
    what: 'The products the site talks about, and whether each one is released. A website only shows released products.',
    from: 'From the ops folder, by the sync.',
  },
  'whats-new': {
    what: 'Release notes: what shipped in each release of a product. Each entry cites the claims it relies on.',
    from: 'From the ops folder, by the sync.',
  },
  legal: {
    what: 'Legal pages such as terms and privacy, one row per version. A published version never changes; a newer one supersedes it and the old text stays readable.',
    from: 'From the ops folder, by the sync.',
  },
  decks: {
    what: 'Web slide decks (house and investor decks). The CMS holds the deck’s record: where it lives, its cover and whether it is gated.',
    from: 'Built in the ops folder, recorded by the sync.',
  },
  'trust-documents': {
    what: 'Security and compliance papers shared on request. Never shown to websites; the files themselves wait for private storage.',
    from: 'From the ops folder, by the sync.',
  },
  audiences: {
    what: 'The groups of readers a site writes solution pages for (for example clinicians or hospital leaders).',
    from: 'From the ops folder, by the sync.',
  },
  workflows: {
    what: 'The workflows a site writes solution pages for.',
    from: 'From the ops folder, by the sync.',
  },
  'consent-records': {
    what: 'Cookie-consent choices recorded by the website, with no personal data. People can read them; nobody edits them.',
    from: 'Written by the website itself.',
  },
}
