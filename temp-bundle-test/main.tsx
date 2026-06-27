import katex from 'katex';
import 'katex/dist/contrib/mhchem.mjs';

console.log("KaTeX version:", katex.version);
const html = katex.renderToString('\\ce{H2O}');
console.log("H2O contains \\ce:", html.includes('\\ce'));
