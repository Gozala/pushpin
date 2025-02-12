import React, { useRef } from 'react'

import './TitleEditor.css'
import { HypermergeUrl } from '../ShareLink'
import { useDocument } from '../Hooks'

interface AnyDoc {
  [field: string]: string
}

interface Props {
  url: HypermergeUrl
  field?: string
  placeholder?: string
  preventDrag?: boolean
}

// `preventDrag` is a little kludgey, but is required to enable text selection if the
// input is in a draggable element.
export default function TitleEditor(props: Props) {
  const [doc, changeDoc] = useDocument<AnyDoc>(props.url)
  const input = useRef<HTMLInputElement>(null)
  const { field = 'title', preventDrag = false, placeholder = '' } = props

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Escape') {
      input.current && input.current.blur()
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    changeDoc((doc: AnyDoc) => {
      doc[field] = e.target.value
    })
  }

  // Required to prevent draggable parent elements from blowing away edit capability.
  function onDragStart(e: React.DragEvent) {
    if (preventDrag) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  if (!doc) {
    return null
  }

  return (
    <input
      ref={input}
      draggable={preventDrag}
      onDragStart={onDragStart}
      type="text"
      className="TitleEditor"
      value={doc[field]}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      onChange={onChange}
    />
  )
}
