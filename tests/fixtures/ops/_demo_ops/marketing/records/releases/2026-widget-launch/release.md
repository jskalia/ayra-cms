---
schema: websiteops.release-record/v1
id: release:demo/2026-widget-launch
kind: product-release
org: demo
sites: [demo]
product: product:widget
version: "1.0"
released_at: "2026-10-10"
source: {type: manual, ref: changelog.md, sha256: null}
tier: T1
features:
  - {name: Urgency sorting, state: ga, claim: "claim:widget-overview-001"}
  - {name: Mobile app, state: internal}
outputs: []
audiences: []
what_shipped: ["claim:widget-overview-001"]
regulated: []
withheld: [{fact: "a speed number", reason: "needs-owner"}]
visibility: public
canonical_url: https://demo.example/whats-new/widget-launch
entry: records/channels/web/demo/pages/whats-new/widget-launch.md
assets: []
channels: [{id: linkedin, draft: work/demo-whatsnew/widget-launch/linkedin.md, owner: marketing.web, posted: null}]
approvals: {facts: {by: product.owner, at: "2026-10-10"}, entry: {by: marketing.head, at: "2026-10-11", version: "1"}, production: {by: null, at: null}}
status: approved
receipts: {sync: null, indexnow: null, feed: null, og: null}
---

## Summary

Widget 1.0 sorts requests by urgency.
