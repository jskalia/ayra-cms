---
schema: websiteops.page/v1
id: page:demo/home
template: platform-home
route: /
blocks:
  - id: hero-statement
    props: {statement: Faster answers, lead: "Widget sorts requests by urgency.", cites: ["claim:widget-overview-001"], tile: "asset:demo/screen/widget-home@1"}
  - id: workflow-diagram
    props: {diagram: {recipe: R9, atoms: "atom:widget-flow-001"}}
  - id: proof-numbers
    props: {stats: ["claim:widget-speed-001"]}
seo: {title: Demo, description: A fictional site for testing the sync., canonical: "https://demo.example/", og: auto, jsonld: [Organization], sitemap: true, llms_txt: true, noindex: false}
visibility: public
gate: none
owner: marketing.web
review_by: "2027-01-01"
status: approved
approved: {by: marketing.head, at: "2026-10-15", version: "1"}
---
