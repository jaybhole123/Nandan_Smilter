const fs = require('fs');

const pages = ['Production.jsx', 'ItemTransfer.jsx', 'SaudaSale.jsx', 'SaudaPurchase.jsx', 'Stock.jsx'];
pages.forEach(p => {
  if(!fs.existsSync('src/pages/' + p)) return;
  let code = fs.readFileSync('src/pages/' + p, 'utf8');
  
  // Replace flex-col with flex-row in the actions div
  code = code.replace(/<div className="flex flex-col([^"]*?(?:opacity-0|justify-center)[^"]*?)"/g, '<div className="flex flex-row justify-center items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"');
  
  // Replace edit button className
  code = code.replace(
    /className="([^"]*)text-blue-500 hover:bg-blue-50([^"]*)"/g,
    'className={`$1 $2 ${editingId === (typeof item !== "undefined" ? item.id : (typeof list !== "undefined" ? list.id : null)) ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300" : "text-blue-500 hover:bg-blue-50"}`}'
  );
  
  fs.writeFileSync('src/pages/' + p, code);
});
console.log('Action buttons updated');
