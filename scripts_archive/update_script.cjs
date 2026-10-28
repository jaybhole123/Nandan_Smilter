const fs = require('fs');
let code = fs.readFileSync('src/pages/MisReport.jsx', 'utf8');

// 1. Stock Section
code = code.replace(
`            {/* STOCK SECTION */}
            {Object.keys(stockSummary).length > 0 && (
              <>
                <tr>
                  <td contentEditable suppressContentEditableWarning rowSpan={Object.keys(stockSummary).length} className="font-bold border border-slate-300 p-2 align-top w-[120px]">
                    STOCK
                  </td>
                  <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2">{Object.keys(stockSummary)[0]}</td>
                  <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2 text-right">{formatNumber(Object.values(stockSummary)[0])}</td>
                </tr>
                {Object.entries(stockSummary).slice(1).map(([material, qty], idx) => (
                  <tr key={\`stock-\${idx}\`}>
                    <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2">{material}</td>
                    <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2 text-right">{formatNumber(qty)}</td>
                  </tr>
                ))}
              </>
            )}
            {Object.keys(stockSummary).length === 0 && (`,
`            {/* STOCK SECTION */}
            {filteredStock.length > 0 && (
              <>
                <tr className="group">
                  <td contentEditable suppressContentEditableWarning rowSpan={filteredStock.length} className="font-bold border border-slate-300 p-2 align-top w-[120px]">
                    STOCK
                  </td>
                  <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2 relative">
                    <HideButton rowKey={\`stock-\${filteredStock[0][0]}\`} />
                    {filteredStock[0][0]}
                  </td>
                  <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2 text-right">{formatNumber(filteredStock[0][1])}</td>
                </tr>
                {filteredStock.slice(1).map(([material, qty], idx) => (
                  <tr key={\`stock-\${idx}\`} className="group">
                    <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2 relative">
                      <HideButton rowKey={\`stock-\${material}\`} />
                      {material}
                    </td>
                    <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2 text-right">{formatNumber(qty)}</td>
                  </tr>
                ))}
              </>
            )}
            {filteredStock.length === 0 && (`
);

// 2. Incoming List
code = code.replace(
`            {incomingList.length > 0 ? (
              <tr>
                <td contentEditable suppressContentEditableWarning colSpan="3" className="p-0 border border-slate-300">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center bg-white w-12">S.No</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-left bg-white">Party Name</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-left bg-white">Material Name</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center bg-white w-24">Vehicle No</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center bg-white w-24">Qty.</th>
                        <th contentEditable suppressContentEditableWarning className="border-b border-slate-300 font-bold p-2 text-center bg-white w-28">RATE 18 %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incomingList.map((item, idx) => (
                        <tr key={\`inc-\${item.id || idx}\`} className="border-b border-slate-300 last:border-b-0 hover:bg-indigo-50/50 transition-colors">
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-300 p-2 text-center font-bold">{idx + 1}</td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-300 p-2 font-bold">{item.partyName}</td>`,
`            {filteredIncoming.length > 0 ? (
              <tr>
                <td contentEditable suppressContentEditableWarning colSpan="3" className="p-0 border border-slate-300">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center bg-white w-12">S.No</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-left bg-white">Party Name</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-left bg-white">Material Name</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center bg-white w-24">Vehicle No</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center bg-white w-24">Qty.</th>
                        <th contentEditable suppressContentEditableWarning className="border-b border-slate-300 font-bold p-2 text-center bg-white w-28">RATE 18 %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIncoming.map((item, idx) => (
                        <tr key={\`inc-\${item.id || idx}\`} className="border-b border-slate-300 last:border-b-0 hover:bg-indigo-50/50 transition-colors group">
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-300 p-2 text-center font-bold relative">
                            <HideButton rowKey={\`inc-\${item.id || idx}\`} />
                            {idx + 1}
                          </td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-300 p-2 font-bold">{item.partyName}</td>`
);

// 3. Outgoing List
code = code.replace(
`            {outgoingList.length > 0 ? (
              <tr>
                <td contentEditable suppressContentEditableWarning colSpan="3" className="p-0 border border-slate-300">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center bg-white w-12">S.No</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-left bg-white">Party Name</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-left bg-white">Material Name</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center bg-white w-24">Vehicle No</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center bg-white w-24">Qty.</th>
                        <th contentEditable suppressContentEditableWarning className="border-b border-slate-300 font-bold p-2 text-center bg-white w-28">RATE 18 %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outgoingList.map((item, idx) => (
                        <tr key={\`out-\${item.id || idx}\`} className="border-b border-slate-300 last:border-b-0 hover:bg-indigo-50/50 transition-colors">
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-300 p-2 text-center font-bold">{idx + 1}</td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-300 p-2 font-bold">{item.partyName}</td>`,
`            {filteredOutgoing.length > 0 ? (
              <tr>
                <td contentEditable suppressContentEditableWarning colSpan="3" className="p-0 border border-slate-300">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center bg-white w-12">S.No</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-left bg-white">Party Name</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-left bg-white">Material Name</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center bg-white w-24">Vehicle No</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center bg-white w-24">Qty.</th>
                        <th contentEditable suppressContentEditableWarning className="border-b border-slate-300 font-bold p-2 text-center bg-white w-28">RATE 18 %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOutgoing.map((item, idx) => (
                        <tr key={\`out-\${item.id || idx}\`} className="border-b border-slate-300 last:border-b-0 hover:bg-indigo-50/50 transition-colors group">
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-300 p-2 text-center font-bold relative">
                            <HideButton rowKey={\`out-\${item.id || idx}\`} />
                            {idx + 1}
                          </td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-300 p-2 font-bold">{item.partyName}</td>`
);

// 4. Production
code = code.replace(
`            {Object.keys(productionSummary).length > 0 ? (
              <tr>
                <td contentEditable suppressContentEditableWarning colSpan="3" className="p-0 border border-slate-300">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center bg-white">GRADE</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center w-[150px] bg-white">KILN 1</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center w-[150px] bg-white">KILN 2</th>
                        <th contentEditable suppressContentEditableWarning className="border-b border-slate-300 font-bold p-2 text-center w-[150px] bg-white">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(productionSummary).map(([metric, values], idx) => (
                        <tr key={\`prod-\${idx}\`}>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-300 font-bold p-2 uppercase">{metric}</td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-300 font-bold p-2 text-center">{formatNumber(values.k1)}</td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-300 font-bold p-2 text-center">{formatNumber(values.k2)}</td>
                          <td contentEditable suppressContentEditableWarning className="font-bold p-2 text-center">{formatNumber(values.total)}</td>
                        </tr>
                      ))}
                      {/* Sub-total for production */}
                      <tr className="bg-[#B4C6E7]">
                        <td contentEditable suppressContentEditableWarning colSpan="3" className="border-t-[2px] border-r border-slate-300 font-bold p-2 text-center uppercase">TOTAL</td>
                        <td contentEditable suppressContentEditableWarning className="border-t border-slate-300 font-bold p-2 text-center">{formatNumber(prodTotalAll)}</td>
                      </tr>
                    </tbody>`,
`            {filteredProduction.length > 0 ? (
              <tr>
                <td contentEditable suppressContentEditableWarning colSpan="3" className="p-0 border border-slate-300">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center bg-white">GRADE</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center w-[150px] bg-white">KILN 1</th>
                        <th contentEditable suppressContentEditableWarning className="border-b-[2px] border-r border-slate-300 font-bold p-2 text-center w-[150px] bg-white">KILN 2</th>
                        <th contentEditable suppressContentEditableWarning className="border-b border-slate-300 font-bold p-2 text-center w-[150px] bg-white">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProduction.map(([metric, values], idx) => (
                        <tr key={\`prod-\${idx}\`} className="group">
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-300 font-bold p-2 uppercase relative">
                            <HideButton rowKey={\`prod-\${metric}\`} />
                            {metric}
                          </td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-300 font-bold p-2 text-center">{formatNumber(values.k1)}</td>
                          <td contentEditable suppressContentEditableWarning className="border-r border-slate-300 font-bold p-2 text-center">{formatNumber(values.k2)}</td>
                          <td contentEditable suppressContentEditableWarning className="font-bold p-2 text-center">{formatNumber(values.total)}</td>
                        </tr>
                      ))}
                      {/* Sub-total for production */}
                      <tr className="bg-[#B4C6E7]">
                        <td contentEditable suppressContentEditableWarning colSpan="3" className="border-t-[2px] border-r border-slate-300 font-bold p-2 text-center uppercase">TOTAL</td>
                        <td contentEditable suppressContentEditableWarning className="border-t border-slate-300 font-bold p-2 text-center">{formatNumber(prodTotalAllFiltered)}</td>
                      </tr>
                    </tbody>`
);

// 5. Sauda Sale
code = code.replace(
`            {saudaSaleEntries.map((item, idx) => (
              <tr key={\`sale-\${idx}\`}>
                {idx === 0 && <td contentEditable suppressContentEditableWarning rowSpan={Math.max(1, saudaSaleEntries.length)} className="font-bold border border-slate-300 p-2 align-top uppercase">SALE</td>}
                <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2 uppercase">{item.itemName} {item.partyName ? \`(\${item.partyName})\` : ''}</td>
                <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2 text-right">{formatNumber(item.balPending)}</td>
              </tr>
            ))}
            {saudaSaleEntries.length === 0 && (`,
`            {filteredSaudaSale.map((item, idx) => (
              <tr key={\`sale-\${idx}\`} className="group">
                {idx === 0 && <td contentEditable suppressContentEditableWarning rowSpan={Math.max(1, filteredSaudaSale.length)} className="font-bold border border-slate-300 p-2 align-top uppercase">SALE</td>}
                <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2 uppercase relative">
                  <HideButton rowKey={\`sale-\${item.id || idx}\`} />
                  {item.itemName} {item.partyName ? \`(\${item.partyName})\` : ''}
                </td>
                <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2 text-right">{formatNumber(item.balPending)}</td>
              </tr>
            ))}
            {filteredSaudaSale.length === 0 && (`
);

// 6. Sauda Purchase
code = code.replace(
`            {saudaPurchaseSummary.map((item, idx) => (
              <tr key={\`pur-\${idx}\`}>
                {idx === 0 && <td contentEditable suppressContentEditableWarning rowSpan={Math.max(1, saudaPurchaseSummary.length)} className="font-bold border border-slate-300 p-2 align-top uppercase">PURCHASE</td>}
                <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2 uppercase">{item.itemName}</td>
                <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2 text-right">{formatNumber(item.balPending)}</td>
              </tr>
            ))}
            {saudaPurchaseSummary.length === 0 && (`,
`            {filteredSaudaPurchase.map((item, idx) => (
              <tr key={\`pur-\${idx}\`} className="group">
                {idx === 0 && <td contentEditable suppressContentEditableWarning rowSpan={Math.max(1, filteredSaudaPurchase.length)} className="font-bold border border-slate-300 p-2 align-top uppercase">PURCHASE</td>}
                <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2 uppercase relative">
                  <HideButton rowKey={\`pur-\${item.itemName || idx}\`} />
                  {item.itemName}
                </td>
                <td contentEditable suppressContentEditableWarning className="font-bold border border-slate-300 p-2 text-right">{formatNumber(item.balPending)}</td>
              </tr>
            ))}
            {filteredSaudaPurchase.length === 0 && (`
);

fs.writeFileSync('src/pages/MisReport.jsx', code);
console.log('MisReport updated!');
