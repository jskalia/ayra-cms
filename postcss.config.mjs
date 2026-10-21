// Tailwind for the control room only: its stylesheet is imported by the (frontend) layout,
// never by Payload's admin, so the admin's own styles are untouched.
export default { plugins: { '@tailwindcss/postcss': {} } }
