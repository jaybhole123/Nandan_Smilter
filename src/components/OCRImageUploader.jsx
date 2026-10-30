import React, { useState, useRef, useEffect } from 'react'
import { extractFromImage } from '../utils/aiOcr'
import AiResultModal from './AiResultModal'

/**
 * AI image reader button. The image is sent to our own /api/ocr endpoint (the OpenAI key stays on the server),
 * the structured result is shown in a review modal, and `onAiResult(data)` is called when the user applies it.
 *
 * - `aiPage`: 'stock_raw' | 'stock_coal' | 'transfer' | 'production' | 'sauda_sale' | 'sauda_purchase'
 * - Works with click (file dialog / camera), drag and drop onto the button, and Ctrl+V paste of a screenshot.
 */
const OCRImageUploader = ({ aiPage, onAiResult, buttonLabel = 'Scan Image', className = '' }) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const fileInputRef = useRef(null)

  const processFile = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, JPEG, WEBP, etc.)')
      return
    }
    setIsProcessing(true)
    try {
      setAiResult(await extractFromImage(file, aiPage))
    } catch (error) {
      console.error('[AI image read]', error)
      alert(error.message || 'Failed to read the image.')
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // The paste listener is registered once; keep it pointed at the latest closure
  const processFileRef = useRef(processFile)
  processFileRef.current = processFile
  const busyRef = useRef(false)
  busyRef.current = isProcessing || !!aiResult

  useEffect(() => {
    const handlePaste = (e) => {
      // Several uploaders can be mounted on one page: the first one that takes the image wins
      if (e.defaultPrevented || busyRef.current) return
      const tag = document.activeElement?.tagName?.toLowerCase()
      if ((tag === 'input' || tag === 'textarea') && !e.clipboardData?.files?.length) return
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile()
          if (file) {
            e.preventDefault()
            processFileRef.current(file)
            break
          }
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => processFile(e.target.files?.[0])}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!isProcessing) setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(false)
          if (!isProcessing) processFile(e.dataTransfer.files?.[0])
        }}
        disabled={isProcessing}
        className={`px-4 py-2.5 bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 hover:border-violet-300 font-medium rounded-md transition-all shadow-sm flex items-center gap-2 ${
          isDragging ? '!border-violet-500 !bg-violet-200 ring-2 ring-violet-400' : ''
        } ${isProcessing ? 'opacity-60 cursor-wait' : ''} ${className}`}
        title="Click to browse, drag & drop an image, or press Ctrl+V to paste a screenshot"
      >
        {isProcessing ? (
          <>
            <span className="animate-spin h-4 w-4 border-2 border-violet-500 border-t-transparent rounded-full"></span>
            <span>Reading image…</span>
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{isDragging ? 'Drop Image Here' : buttonLabel}</span>
          </>
        )}
      </button>

      {aiResult && (
        <AiResultModal
          result={aiResult}
          onClose={() => setAiResult(null)}
          onApply={(data) => {
            setAiResult(null)
            onAiResult?.(data)
          }}
        />
      )}
    </>
  )
}

export default OCRImageUploader
