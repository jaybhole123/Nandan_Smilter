import { useRef } from 'react'

const MAX_FILE_SIZE_MB = 10
const ACCEPTED_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export const FileUploader = ({ files = [], onChange, onError }) => {
  const inputRef = useRef(null)

  const handleFiles = async (rawFiles) => {
    const results = []
    for (const file of rawFiles) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        onError?.(`"${file.name}" has an unsupported file type.`)
        continue
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        onError?.(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB} MB limit.`)
        continue
      }
      const dataUrl = await readFileAsDataURL(file)
      results.push({
        id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl,
      })
    }
    if (results.length) {
      onChange([...files, ...results])
    }
  }

  const handleInputChange = (e) => {
    if (e.target.files?.length) handleFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    if (e.dataTransfer.files?.length) handleFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div
      className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-center transition hover:border-blue-500 hover:bg-slate-50 cursor-pointer"
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        onChange={handleInputChange}
      />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-slate-500">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
      </svg>
      <p className="text-xs text-slate-600">
        <span className="font-medium text-blue-600">Click to upload</span> or drag &amp; drop
      </p>
      <p className="text-[10px] text-slate-400">PDF, Excel, CSV, Images — max {MAX_FILE_SIZE_MB} MB</p>
    </div>
  )
}

export const FileAttachments = ({ files = [], onChange }) => {
  if (!files.length) return null

  const remove = (id) => onChange(files.filter((f) => f.id !== id))

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const iconForType = (type) => {
    if (type.startsWith('image/')) return '🖼️'
    if (type === 'application/pdf') return '📄'
    if (type.includes('excel') || type.includes('spreadsheet') || type === 'text/csv') return '📊'
    return '📎'
  }

  return (
    <ul className="mt-2 space-y-1">
      {files.map((file) => (
        <li
          key={file.id}
          className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 shadow-sm"
        >
          <span className="text-base leading-none">{iconForType(file.type)}</span>
          <span className="flex-1 truncate">{file.name}</span>
          <span className="shrink-0 text-slate-500">{formatSize(file.size)}</span>
          <button
            type="button"
            onClick={() => remove(file.id)}
            className="ml-1 shrink-0 rounded p-0.5 text-slate-400 hover:text-rose-500 transition"
            aria-label={`Remove ${file.name}`}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  )
}