import React, { useRef, useState } from 'react'

export const CsvDropzone = ({ onUpload, className, disabled = false, children }) => {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled) return

    const file = e.dataTransfer.files?.[0]
    if (file && file.name.toLowerCase().endsWith('.csv')) {
      onUpload({ target: { files: e.dataTransfer.files, value: '' } })
    }
  }

  const handleChange = (e) => {
    if (disabled) return
    onUpload(e)
    if (fileInputRef.current) {
        fileInputRef.current.value = ''
    }
  }

  const draggingClasses = isDragging ? 'border-dashed !border-emerald-500 !bg-emerald-100 !text-emerald-800 Sale-105 ring-2 ring-emerald-500' : ''

  return (
    <label 
      className={`${className} ${draggingClasses} transition-all duration-300 relative cursor-pointer`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title="Drag & Drop CSV here"
    >
      {isDragging ? (
         <span className="flex items-center gap-1 justify-center whitespace-nowrap">Drop CSV</span>
      ) : (
         children
      )}
      <input 
        ref={fileInputRef}
        type="file" 
        accept=".csv" 
        className="hidden" 
        onChange={handleChange} 
        disabled={disabled}
      />
    </label>
  )
}
