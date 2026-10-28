const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'trader', 'src', 'pages', 'MisReport.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Container
content = content.replace(
  'className="max-w-[1000px] mx-auto pb-10 bg-white min-h-screen text-slate-900 font-sans shadow-xl"',
  'className="max-w-[1100px] mx-auto my-8 pb-10 bg-white min-h-screen text-slate-800 font-sans shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl overflow-hidden border border-slate-200"'
);

// Header
content = content.replace(
  'className="p-4 bg-slate-50 border-b border-slate-300 flex justify-between items-center print:hidden"',
  'className="p-5 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex justify-between items-center print:hidden shadow-sm"'
);

// Table Wrapper
content = content.replace(
  'className="p-1 sm:p-4"',
  'className="p-4 sm:p-8"'
);

// Main Table
content = content.replace(
  'className="w-full border-collapse border-[3px] border-[#2C5282] text-sm text-black bg-white"',
  'className="w-full border-collapse border border-slate-400 text-[13px] sm:text-sm text-slate-800 bg-white shadow-sm"'
);

// Main Header
content = content.replace(
  /className="bg-\[#2B5C8F\] text-white py-2 text-center font-bold text-lg border-\[3px\] border-\[#2C5282\] uppercase"/g,
  'className="bg-gradient-to-r from-indigo-700 to-blue-800 text-white py-3 text-center font-bold text-lg border border-indigo-900 uppercase tracking-widest shadow-inner"'
);
content = content.replace(
  /className="bg-\[#2B5C8F\] text-white py-2 text-center font-bold text-lg border-\[3px\] border-\[#2C5282\] w-\[150px\]"/g,
  'className="bg-blue-800 text-white py-3 text-center font-bold text-lg border border-indigo-900 w-[180px] shadow-inner"'
);

// Subheaders
content = content.replace(
  /className="bg-\[#B4C6E7\] font-bold text-center p-1\.5 border-\[2px\] border-black uppercase/g,
  'className="bg-indigo-50 text-indigo-900 font-bold text-center p-2.5 border border-slate-300 uppercase tracking-wide'
);

// Borders 2px black -> 1px slate-300
content = content.replace(/border-\[2px\] border-black/g, 'border border-slate-300');
content = content.replace(/border-r-\[2px\] border-black/g, 'border-r border-slate-300');
content = content.replace(/border-b-\[2px\] border-black/g, 'border-b border-slate-300');
content = content.replace(/border-t-\[2px\] border-black/g, 'border-t border-slate-300');
content = content.replace(/border-l-\[2px\] border-black/g, 'border-l border-slate-300');

// Add subtle row hover for the sub-tables
content = content.replace(
  /<tr key={`inc-\$\{item\.id \|\| idx\}`} className="border-b border-slate-300 last:border-b-0">/g,
  '<tr key={`inc-${item.id || idx}`} className="border-b border-slate-300 last:border-b-0 hover:bg-indigo-50/50 transition-colors">'
);
content = content.replace(
  /<tr key={`out-\$\{item\.id \|\| idx\}`} className="border-b border-slate-300 last:border-b-0">/g,
  '<tr key={`out-${item.id || idx}`} className="border-b border-slate-300 last:border-b-0 hover:bg-indigo-50/50 transition-colors">'
);

// Text colors - make standard text slightly softer than black
content = content.replace(
  /text-black/g,
  'text-slate-800'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('UI updated successfully!');
