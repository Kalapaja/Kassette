// .mjs, not .js: package.json has no "type": "module", so Node loads a bare
// .js as CommonJS and this `export default` never becomes the config. commitlint
// <=20 papered over that with its own loader; 21 dropped it for Node built-ins
// and instead resolves zero rules, then exits 9 on every message — valid ones
// included, which takes the commit-msg hook down with it. Keep the extension.
export default { extends: ['@commitlint/config-conventional'] };
