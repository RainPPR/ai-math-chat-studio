import katex from 'katex';
import fs from 'fs';

const mhchemSource = fs.readFileSync('node_modules/katex/dist/contrib/mhchem.js', 'utf8');

// In 0.17+, the contrib script expects global 'katex' to be defined
// OR it expects to be in a environment where 'require("katex")' works.
(globalThis as any).katex = katex;

// Execute the contrib script
eval(mhchemSource);

const html = katex.renderToString('\\ce{H2O}', { throwOnError: false });
console.log("H2O contains \\ce:", html.includes('\\ce'));
if (!html.includes('\\ce')) {
    console.log("SUCCESS: mhchem registered!");
}
