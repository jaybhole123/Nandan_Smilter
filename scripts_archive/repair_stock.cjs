const fs = require('fs');
let code = fs.readFileSync('src/pages/Stock.jsx', 'utf8');

const lines = code.split('\n').map(l => l.replace('\r', ''));
const startIdx = lines.findIndex(l => l.includes("setToast({ type: 'success', message: 'Stock entry added successfully.' })"));

// the first occurrence is at line 374
if (startIdx !== -1) {
    // let's verify line 375 is currentCategory = columns[0]
    if (lines[startIdx + 1].includes('currentCategory = columns[0]')) {
        // the duplicate block goes until the FIRST handleEdit
        const endIdx = lines.findIndex(l => l.includes('const handleEdit = (item) => {'));
        if (endIdx !== -1) {
            console.log('Found corrupted block from line', startIdx, 'to', endIdx);
            
            // Delete lines from startIdx + 1 to endIdx - 1
            const prefix = lines.slice(0, startIdx + 1);
            // Add the missing closing bracket and resetForm
            const fix = [
                "    }",
                "",
                "    resetForm()",
                "  }",
                ""
            ];
            const suffix = lines.slice(endIdx);
            
            const newLines = [...prefix, ...fix, ...suffix];
            fs.writeFileSync('src/pages/Stock.jsx', newLines.join('\r\n'));
            console.log('Fixed successfully!');
        } else {
            console.log('Could not find handleEdit');
        }
    } else {
        console.log('Next line is not currentCategory, but:', lines[startIdx + 1]);
    }
}
