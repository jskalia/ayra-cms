---
schema: websiteops.page/v1
id: page:demo/products-widget
template: product
route: /products/widget
product: product:widget
blocks:
  - id: capability-trio
    props: {items: [{icon: zap, title: Fast, text: Answers quickly, claim: "claim:widget-speed-001"}]}
seo: {title: Widget, description: Widget sorts requests., canonical: "https://demo.example/products/widget", og: auto, jsonld: [Product], sitemap: true, llms_txt: true, noindex: false}
visibility: public
gate: none
owner: marketing.web
review_by: "2027-01-01"
status: approved
approved: {by: marketing.head, at: "2026-10-15", version: "1"}
---
