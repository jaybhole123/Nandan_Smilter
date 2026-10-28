const fs = require('fs');
const path = 'c:/Users/acer/Desktop/traders/trader/src/pages/MisReport.jsx';
let content = fs.readFileSync(path, 'utf8');

// Replace all `<td ` with `<td contentEditable suppressContentEditableWarning `
content = content.replace(/<td /g, '<td contentEditable suppressContentEditableWarning ');
// Replace all `<th ` with `<th contentEditable suppressContentEditableWarning `
content = content.replace(/<th /g, '<th contentEditable suppressContentEditableWarning ');

fs.writeFileSync(path, content, 'utf8');
console.log('MisReport made editable!');
