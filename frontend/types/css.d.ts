// TypeScript 6 (bundled with VS Code) checks side-effect imports such as
// `import "./globals.css"`. Next.js bundles the CSS; this tells TypeScript it exists.
declare module "*.css" {}
