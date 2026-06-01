const fs = require('fs');

const content = fs.readFileSync('/Users/vatsal/Documents/ApexGP/src/components/tabs/MarketTab.tsx', 'utf8');
const lines = content.split('\n');

let formStartIndex = content.indexOf('<form');
let formEndIndex = content.indexOf('</form>');

if (formStartIndex !== -1 && formEndIndex !== -1) {
  const formSub = content.substring(formStartIndex, formEndIndex + 7);
  
  // Find all JSX tags
  const tagRegex = /<\/?([a-zA-Z0-9]+)(?:\s+[^>]*?)?>/g;
  let match;
  
  while ((match = tagRegex.exec(formSub)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    const isClosing = fullTag.startsWith('</');
    const isSelfClosing = fullTag.endsWith('/>') || ['input', 'img', 'br', 'hr'].includes(tagName.toLowerCase());

    if (tagName.toLowerCase() === 'div' && !isSelfClosing) {
      // Calculate line number for this match
      let absoluteIndex = formStartIndex + match.index;
      let currentLine = 0;
      let accum = 0;
      for (let l = 0; l < lines.length; l++) {
        accum += lines[l].length + 1;
        if (accum > absoluteIndex) {
          currentLine = l + 1;
          break;
        }
      }
      console.log(`${isClosing ? 'CLOSE' : 'OPEN'} <div> at line ${currentLine}: ${fullTag.substring(0, 50)}`);
    }
  }
}
