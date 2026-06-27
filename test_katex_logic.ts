import katex from 'katex';
import 'katex/dist/contrib/mhchem.mjs';

console.log("KaTeX version:", katex.version);
const html = katex.renderToString('\\ce{H2O}', { throwOnError: false });
if (html.includes('\\ce')) {
    console.log("FAIL: mhchem not registered");
    // console.log(html);
} else {
    console.log("SUCCESS: mhchem works!");
}
