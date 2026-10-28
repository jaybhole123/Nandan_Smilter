const fs = require('fs');
let code = fs.readFileSync('src/pages/SaudaPurchase.jsx', 'utf8');

// 1. Add editForm state
code = code.replace(
  'const [editingId, setEditingId] = useState(null)',
  'const [editingId, setEditingId] = useState(null)\n  const [editForm, setEditForm] = useState(initialForm)'
);

// 2. Modify resetForm
code = code.replace(
  /const resetForm = \(\) => \{[^}]*setEditingId\(null\)\n  \}/s,
  `const resetForm = () => {
    setForm({
      ...initialForm,
      date: new Date().toISOString().split('T')[0]
    })
  }`
);

// 3. Modify handleSubmit
code = code.replace(
  /if \(editingId\) \{[^{]*setEntries[^}]*\}[^{]*else \{/,
  'if (false) {\n    } else {'
);

// 4. Update handleEdit
code = code.replace(
  /const handleEdit = \([^)]*\) => \{\s*const item = [^\n]*\n\s*if \(item\) \{\s*setForm\(item\)\s*setEditingId\(id\)\s*\}\s*\}/s,
  `const handleEdit = (id) => {
    const item = entries.find(i => i.id === id)
    if (item) {
      setEditForm(item)
      setEditingId(id)
    }
  }`
);

// 5. Add handleSaveInline and handleCancelInline
code = code.replace(
  'const handleDelete',
  `const handleSaveInline = () => {
    if (!editForm.partyName.trim() || !editForm.itemName.trim()) {
      showToast('Item Name and Party Name are required.', 'error')
      return
    }
    const order = Number(editForm.orderQuantity) || 0
    const prv = Number(editForm.prvPending) || 0
    const dispatch = Number(editForm.qtyDisptch) || 0
    const balPending = (order + prv) - dispatch

    const updatedEntry = {
      ...editForm,
      balPending
    }

    setEntries(prev => prev.map(item => item.id === editingId ? { ...updatedEntry, id: item.id } : item))
    showToast('Purchase entry updated successfully.')
    setEditingId(null)
  }

  const handleCancelInline = () => {
    setEditingId(null)
  }

  const handleDelete`
);

// 6. Update Table Rendering
code = code.replace(
  /<tr key=\{item\.id\}[^>]*>([\s\S]*?)<\/tr>/g,
  (match, p1) => {
    if (match.includes('border-t-[2px]') || match.includes('bg-[#B4C6E7]')) return match;
    
    return `
              <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                {editingId === item.id ? (
                  <>
                    <td className="border border-slate-400 px-2 py-1 text-center"><input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="w-full border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"/></td>
                    <td className="border border-slate-400 px-2 py-1"><input type="text" value={editForm.itemName} onChange={e => setEditForm({...editForm, itemName: e.target.value})} className="w-full border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase" placeholder="ITEM" /></td>
                    <td className="border border-slate-400 px-2 py-1"><input type="text" value={editForm.partyName} onChange={e => setEditForm({...editForm, partyName: e.target.value})} className="w-full border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase" placeholder="PARTY" /></td>
                    <td className="border border-slate-400 px-2 py-1 text-center"><input type="number" value={editForm.orderQuantity} onChange={e => setEditForm({...editForm, orderQuantity: e.target.value})} className="w-20 border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none" placeholder="QTY" /></td>
                    <td className="border border-slate-400 px-2 py-1 text-center"><input type="number" value={editForm.rateMt} onChange={e => setEditForm({...editForm, rateMt: e.target.value})} className="w-16 border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                    <td className="border border-slate-400 px-2 py-1 text-center"><input type="number" value={editForm.prvPending} onChange={e => setEditForm({...editForm, prvPending: e.target.value})} className="w-20 border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                    <td className="border border-slate-400 px-2 py-1 text-center"><input type="number" value={editForm.qtyDisptch} onChange={e => setEditForm({...editForm, qtyDisptch: e.target.value})} className="w-20 border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                    <td className="border border-slate-400 px-2 py-1 text-center font-bold text-slate-800 bg-slate-50">{formatNumber(((Number(editForm.orderQuantity)||0) + (Number(editForm.prvPending)||0)) - (Number(editForm.qtyDisptch)||0))}</td>
                    <td className="border border-slate-400 px-2 py-1 text-center"><input type="text" value={editForm.broker} onChange={e => setEditForm({...editForm, broker: e.target.value})} className="w-20 border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                    <td className="border border-slate-400 px-2 py-1 text-center"><input type="text" value={editForm.deliveryTerms} onChange={e => setEditForm({...editForm, deliveryTerms: e.target.value})} className="w-20 border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                    <td className="border border-slate-400 px-2 py-1 text-center"><input type="text" value={editForm.remarks} onChange={e => setEditForm({...editForm, remarks: e.target.value})} className="w-full border rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                    <td className="border border-slate-400 px-2 py-1 text-center bg-white align-middle">
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
                    <td className="border border-slate-400 px-2 py-1.5 text-center text-slate-700">{new Date(item.date).toLocaleDateString('en-GB')}</td>
                    <td className="border border-slate-400 px-2 py-1.5 font-medium text-slate-900 uppercase">{item.itemName}</td>
                    <td className="border border-slate-400 px-2 py-1.5 text-slate-700 uppercase">{item.partyName}</td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center">{formatNumber(item.orderQuantity)}</td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center">{item.rateMt || '-'}</td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center">{formatNumber(item.prvPending)}</td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center">{formatNumber(item.qtyDisptch)}</td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center font-bold text-slate-800 bg-slate-50/50">{formatNumber(item.balPending)}</td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center text-slate-600">{item.broker || '-'}</td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center text-slate-600">{item.deliveryTerms || '-'}</td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center text-slate-600 break-words" title={item.remarks}>{item.remarks || '-'}</td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center bg-white align-middle">
                      <div className="flex flex-row justify-center items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(item.id)} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Edit">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded" title="Delete">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
`
  }
);

// 7. Remove conditional text in submit button and form header
code = code.replace(/\{editingId \? '[^']*' : '([^']*)'\}/g, "'$1'");

fs.writeFileSync('src/pages/SaudaPurchase.jsx', code);
console.log('SaudaPurchase updated successfully.');
