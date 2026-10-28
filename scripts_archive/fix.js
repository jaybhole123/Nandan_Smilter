const fs = require('fs');
const path = 'c:/Users/acer/Desktop/traders/trader/src/pages/Stock.jsx';
let content = fs.readFileSync(path, 'utf8');

// Normalize line endings to LF for easier processing
content = content.replace(/\r\n/g, '\n');

// 1. Remove `<>` from raw_material condition (line 457)
content = content.replace("{activeTab === 'raw_material' ? (\n        <>\n          {/* Top Form Section - Premium Theme */}", "{activeTab === 'raw_material' ? (\n          {/* Top Form Section - Premium Theme */}");

// 2. Extract Coal form block (starts at the bottom)
const coalFormStartRegex = /      <\/>\n      \) : \(\n        <div className="bg-white border border-slate-200\/80 rounded-\[1\.5rem\] p-5 sm:p-7 shadow-sm relative overflow-hidden">/;
const coalFormEndRegex = /        <\/div>\n      \)}\n\n      {\/\* Toast Notification \*\/}/;

const startMatch = content.match(coalFormStartRegex);
const endMatch = content.match(coalFormEndRegex);

if (!startMatch || !endMatch) {
  console.log('Error: Could not find boundaries for extraction.');
  process.exit(1);
}

const startIdx = startMatch.index;
const endIdx = endMatch.index;

const extractStart = content.indexOf('      ) : (', startIdx);
const extractEnd = endIdx + 15; // length of '        </div>\n      )}'
const coalFormBlock = content.substring(extractStart, extractEnd);

// 3. Remove the Coal form block from the bottom (including the `</>` just before it)
content = content.substring(0, startIdx) + '      </div>\n\n      {/* Toast Notification */}' + content.substring(extractEnd + 34);

// 4. Insert the Coal form block right before the Table Section
const tableSectionMarker = '      {/* Table Section - Exact Grid Layout with Category Headers */}';
content = content.replace(tableSectionMarker, coalFormBlock + '\n\n' + tableSectionMarker);

// Re-add CRLF
content = content.replace(/\n/g, '\r\n');

fs.writeFileSync(path, content, 'utf8');
console.log('Success: Reordered Coal Form and Table Section.');
