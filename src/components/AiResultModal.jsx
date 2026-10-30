import React from 'react'

const BADGE = {
  read: { text: 'Read by AI - please review', cls: 'bg-sky-100 text-sky-800 border-sky-300' },
  verified: { text: 'Verified', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  corrected: { text: 'Corrected by verifier', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  unverified: { text: 'Not verified', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
}

/**
 * Shows the AI read result + verification outcome before anything is put on the page.
 * Props: result ({data, verification}), onApply(data), onClose()
 */
const AiResultModal = ({ result, onApply, onClose }) => {
  const { data, verification: v } = result
  const quality = result.quality || { ok: true, issues: [] }
  const badge = !quality.ok ? BADGE.read : (BADGE[v.status] || BADGE.unverified)
  const rowCount = data?.rows?.length || 0

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto border border-slate-100">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Image read result</h3>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.cls}`}>{badge.text}</span>
        </div>

        <div className="p-6 space-y-4 text-sm text-slate-700">
          <p>
            <strong>{rowCount}</strong> row{rowCount === 1 ? '' : 's'} found. Review the values on the page after applying; nothing is saved until you save it.
          </p>

          {!quality.ok && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-amber-900">
              <p className="font-semibold mb-1">Photo quality warning</p>
              <ul className="list-disc pl-5">
                {quality.issues.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
              <p className="mt-1 text-xs">Numbers from a poor photo can look right but be wrong. Check each value against the paper, or retake the photo.</p>
            </div>
          )}

          {v.status === 'unverified' && (
            <p className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-800">
              The second check could not run{v.message ? ` (${v.message})` : ''}. Please check every value carefully.
            </p>
          )}

          {v.corrections.length > 0 && (
            <div>
              <p className="font-semibold mb-1">Corrections made ({v.corrections.length})</p>
              <ul className="space-y-1">
                {v.corrections.map((c, i) => (
                  <li key={i} className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    Row {c.row + 1}, <em>{c.field}</em>:{' '}
                    <span className="line-through text-slate-500">{c.from || '(empty)'}</span> →{' '}
                    <strong>{c.to || '(empty)'}</strong>
                    {c.reason && <span className="block text-xs text-slate-500">{c.reason}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {v.unreadable.length > 0 && (
            <div>
              <p className="font-semibold mb-1">Could not read (left empty)</p>
              <ul className="list-disc pl-5 text-slate-600">
                {v.unreadable.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
            </div>
          )}

          {v.warnings.length > 0 && (
            <div>
              <p className="font-semibold mb-1">Figures that don't add up (check these rows)</p>
              <ul className="space-y-1">
                {v.warnings.map((w, i) => (
                  <li key={i} className="bg-rose-50 border border-rose-200 rounded-md px-3 py-2 text-rose-800">{w}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-slate-500">
            {v.status === 'verified' || v.status === 'corrected'
              ? '"Verified" means a second AI pass compared the values with the image. It is not a guarantee, so please review before saving.'
              : 'The values were read directly from the image. The AI can still misread digits, so please review before saving.'}
          </p>
        </div>

        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={() => onApply(data)}
            disabled={rowCount === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            Apply to page
          </button>
        </div>
      </div>
    </div>
  )
}

export default AiResultModal
