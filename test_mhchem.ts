import katex from 'katex';
import 'katex/dist/contrib/mhchem.mjs';

const html = katex.renderToString('\\ce{H2O}', { throwOnError: false });
console.log("HTML:", html);
