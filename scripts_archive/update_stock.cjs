const fs = require('fs');
let code = fs.readFileSync('src/pages/Stock.jsx', 'utf8');

// 1. Rename selectedId to editingId or add editForm
code = code.replace(
  'const [selectedId, setSelectedId] = useState(null)',
  'const [selectedId, setSelectedId] = useState(null)\n  const [editingId, setEditingId] = useState(null)\n  const [editForm, setEditForm] = useState(initialForm)'
);

// 2. Modify handleEdit to not use top form
code = code.replace(
  /const handleEdit = \(item\) => \{\s*setForm\(item\)\s*setSelectedId\(item\.id\)\s*window\.scrollTo\([^)]*\)\s*\}/s,
  `const handleEdit = (item) => {
    setEditForm(item)
    setEditingId(item.id)
  }`
);

// 3. Save / Cancel Handlers
code = code.replace(
  'const handleDelete = (id) => {',
  `const handleSaveInline = () => {
    if (!editForm.material.trim()) return showToast('Material name is required', 'error')
    
    // Auto calculate closing
    let op = Number(editForm.openingStock) || 0
    let inw = Number(editForm.inward) || 0
    let cons = Number(editForm.consumption) || 0
    let finesPct = parsePercentValue(editForm.fines3) / 100
    let finesQ = Number(editForm.fines3Qty) || 0
    let prod = Number(editForm.production) || 0
    let dis = Number(editForm.dispatch) || 0
    if (finesPct > 0 && finesPct < 1 && cons > 0 && !editForm.fines3Qty) {
        finesQ = (cons / (1 - finesPct)) * finesPct
        editForm.fines3Qty = finesQ.toFixed(3)
    }
    let closing = op + inw - cons - finesQ + prod - dis
    editForm.closingStock = closing.toFixed(3)

    updateItem(editingId, editForm)
    setToast({ type: 'success', message: 'Stock entry updated inline.' })
    setEditingId(null)
  }
  const handleCancelInline = () => setEditingId(null)

  const handleDelete = (id) => {`
);

// 4. Update the render row logic
code = code.replace(
  /<tr key=\{item\.id\}[^>]*>([\s\S]*?)<\/tr>/g,
  (match) => {
    if (match.includes('Total {group.label}')) return match;
    
    return `
                        <tr key={item.id} className="bg-white hover:bg-slate-50/80 transition-colors group">
                          {editingId === item.id ? (
                            <>
                              <td className="px-6 py-4 text-slate-800 font-medium break-words">
                                <input value={editForm.material} onChange={e => setEditForm({...editForm, material: e.target.value})} className="w-full border rounded px-1 py-0.5 text-xs focus:outline-none" />
                              </td>
                              <td className="px-6 py-4"><input type="number" value={editForm.openingStock} onChange={e => setEditForm({...editForm, openingStock: e.target.value})} className="w-full text-right border rounded px-1 py-0.5 text-xs focus:outline-none" /></td>
                              <td className="px-6 py-4"><input type="number" value={editForm.inward} onChange={e => setEditForm({...editForm, inward: e.target.value})} className="w-full text-right border rounded px-1 py-0.5 text-xs focus:outline-none" /></td>
                              <td className="px-6 py-4"><input type="number" value={editForm.consumption} onChange={e => setEditForm({...editForm, consumption: e.target.value})} className="w-full text-right border rounded px-1 py-0.5 text-xs focus:outline-none" /></td>
                              {activeTab === 'raw_material' ? (
                                <>
                                  <td className="px-6 py-4"><input type="text" value={editForm.crushing} onChange={e => setEditForm({...editForm, crushing: e.target.value})} className="w-full text-right border rounded px-1 py-0.5 text-xs focus:outline-none" /></td>
                                  <td className="px-6 py-4"><input type="text" value={editForm.fines3} onChange={e => setEditForm({...editForm, fines3: e.target.value})} className="w-full text-right border rounded px-1 py-0.5 text-xs focus:outline-none" /></td>
                                  <td className="px-6 py-4"><input type="number" value={editForm.fines3Qty} onChange={e => setEditForm({...editForm, fines3Qty: e.target.value})} className="w-full text-right border rounded px-1 py-0.5 text-xs focus:outline-none" /></td>
                                  <td className="px-6 py-4"><input type="number" value={editForm.production} onChange={e => setEditForm({...editForm, production: e.target.value})} className="w-full text-right border rounded px-1 py-0.5 text-xs focus:outline-none" /></td>
                                  <td className="px-6 py-4"><input type="number" value={editForm.dispatch} onChange={e => setEditForm({...editForm, dispatch: e.target.value})} className="w-full text-right border rounded px-1 py-0.5 text-xs focus:outline-none" /></td>
                                </>
                              ) : (
                                <>
                                  <td className="px-6 py-4"><input type="text" value={editForm.fc} onChange={e => setEditForm({...editForm, fc: e.target.value})} className="w-full text-right border rounded px-1 py-0.5 text-xs focus:outline-none" /></td>
                                  <td className="px-6 py-4"><input type="text" value={editForm.moistLossPct} onChange={e => setEditForm({...editForm, moistLossPct: e.target.value})} className="w-full text-right border rounded px-1 py-0.5 text-xs focus:outline-none" /></td>
                                  <td className="px-6 py-4"><input type="number" value={editForm.moistLossQty} onChange={e => setEditForm({...editForm, moistLossQty: e.target.value})} className="w-full text-right border rounded px-1 py-0.5 text-xs focus:outline-none" /></td>
                                  <td className="px-6 py-4"><input type="number" value={editForm.landedCost} onChange={e => setEditForm({...editForm, landedCost: e.target.value})} className="w-full text-right border rounded px-1 py-0.5 text-xs focus:outline-none" /></td>
                                </>
                              )}
                              <td className="px-6 py-4 text-slate-800 text-right font-semibold bg-slate-50">{formatNumber(((Number(editForm.openingStock)||0) + (Number(editForm.inward)||0) - (Number(editForm.consumption)||0) - (Number(editForm.fines3Qty)||0) + (Number(editForm.production)||0) - (Number(editForm.dispatch)||0)))}</td>
                              <td className="px-6 py-4 text-center align-middle bg-white">
                                <div className="flex flex-row justify-center items-center gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={handleSaveInline} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Save">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  </button>
                                  <button onClick={handleCancelInline} className="p-1 text-rose-500 hover:bg-rose-50 rounded" title="Cancel">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-6 py-4 text-slate-800 font-medium break-words">
                                {item.material}
                              </td>
                              <td className="px-6 py-4 text-slate-600 text-right">{formatNumber(item.openingStock)}</td>
                              <td className="px-6 py-4 text-slate-600 text-right">{formatNumber(item.inward)}</td>
                              <td className="px-6 py-4 text-slate-600 text-right">{formatNumber(item.consumption)}</td>
                              {activeTab === 'raw_material' ? (
                                <>
                                  <td className="px-6 py-4 text-slate-600 text-right">{item.crushing || '0%'}</td>
                                  <td className="px-6 py-4 text-slate-600 text-right">{formatPercentValue(item.fines3)}</td>
                                  <td className="px-6 py-4 text-slate-600 text-right">{formatNumber(item.fines3Qty)}</td>
                                  <td className="px-6 py-4 text-slate-600 text-right">{formatNumber(item.production)}</td>
                                  <td className="px-6 py-4 text-slate-600 text-right">{formatNumber(item.dispatch)}</td>
                                </>
                              ) : (
                                <>
                                  <td className="px-6 py-4 text-slate-600 text-right">{item.fc || '-'}</td>
                                  <td className="px-6 py-4 text-slate-600 text-right">{item.moistLossPct || '0%'}</td>
                                  <td className="px-6 py-4 text-slate-600 text-right">{formatNumber(item.moistLossQty)}</td>
                                  <td className="px-6 py-4 text-slate-600 text-right">{formatNumber(item.landedCost)}</td>
                                </>
                              )}
                              <td className="px-6 py-4 text-slate-800 text-right font-semibold">{formatNumber(item.closingStock)}</td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {activeTab === 'raw_material' && (
                                    <button onClick={() => handleEdit(item)} className="p-1.5 rounded transition-colors text-blue-500 hover:bg-blue-50" title="Edit">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                  )}
                                  <button onClick={() => handleDelete(item.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors" title="Delete">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>`
  }
);

code = code.replace(/\{selectedId \? 'Edit Stock Item' : 'Add New Stock Item'\}/g, "'Add New Stock Item'");

fs.writeFileSync('src/pages/Stock.jsx', code);
console.log('Stock updated successfully.');
