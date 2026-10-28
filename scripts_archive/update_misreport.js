const fs = require('fs');
let code = fs.readFileSync('src/pages/MisReport.jsx', 'utf8');

// Replace map variables with filtered arrays
code = code.replace(/Object\.entries\(stockSummary\)/g, 'filteredStock');
code = code.replace(/Object\.keys\(stockSummary\)/g, 'filteredStock');
code = code.replace(/Object\.values\(stockSummary\)/g, 'filteredStock');
code = code.replace(/incomingList/g, 'filteredIncoming');
code = code.replace(/outgoingList/g, 'filteredOutgoing');
code = code.replace(/Object\.entries\(productionSummary\)/g, 'filteredProduction');
code = code.replace(/Object\.keys\(productionSummary\)/g, 'filteredProduction');
code = code.replace(/prodTotalK1(?![F])/g, 'prodTotalK1Filtered');
code = code.replace(/prodTotalK2(?![F])/g, 'prodTotalK2Filtered');
code = code.replace(/prodTotalAll(?![F])/g, 'prodTotalAllFiltered');
code = code.replace(/saudaSaleEntries/g, 'filteredSaudaSale');
code = code.replace(/saudaPurchaseSummary/g, 'filteredSaudaPurchase');

// Because Object.keys(stockSummary) was replaced with filteredStock, we need to fix the [0] index access.
// Originally: Object.keys(stockSummary)[0] -> Now: filteredStock[0][0]
// Originally: Object.values(stockSummary)[0] -> Now: filteredStock[0][1]
code = code.replace(/filteredStock\[0\]/g, 'filteredStock[0][0]'); // wait, regex might be tricky.

// Let's just do targeted string replacements for the table rendering logic
// I'll reload the file and do precise replacements.
