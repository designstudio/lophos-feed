import type { ReactNode } from 'react'
import type { EditorialDocument, EditorialMark, EditorialNode } from './editorial-types'
import { ZoomableEditorialImage } from './ZoomableEditorialImage'

function withMarks(content: ReactNode, marks: EditorialMark[] | undefined, key: string): ReactNode {
  return (marks || []).reduce<ReactNode>((child, mark, index) => {
    const markKey = `${key}-mark-${index}`
    if (mark.type === 'bold') return <strong key={markKey}>{child}</strong>
    if (mark.type === 'italic') return <em key={markKey}>{child}</em>
    if (mark.type === 'underline') return <u key={markKey}>{child}</u>
    if (mark.type === 'strike') return <s key={markKey}>{child}</s>
    if (mark.type === 'link') {
      const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : '#'
      return <a key={markKey} href={href} target="_blank" rel="noreferrer">{child}</a>
    }
    return child
  }, content)
}

function renderNode(node: EditorialNode, key: string): ReactNode {
  if (node.type === 'text') return withMarks(node.text || '', node.marks, key)
  if (node.type === 'hardBreak') return <br key={key} />
  if (node.type === 'horizontalRule') return <hr key={key} />

  const children = node.content?.map((child, index) => renderNode(child, `${key}-${index}`))

  if (node.type === 'paragraph') return <p key={key}>{children}</p>
  if (node.type === 'heading') {
    const level = Number(node.attrs?.level) === 3 ? 3 : 2
    return level === 3 ? <h3 key={key}>{children}</h3> : <h2 key={key}>{children}</h2>
  }
  if (node.type === 'bulletList') return <ul key={key}>{children}</ul>
  if (node.type === 'orderedList') return <ol key={key}>{children}</ol>
  if (node.type === 'listItem') return <li key={key}>{children}</li>
  if (node.type === 'blockquote') return <blockquote key={key}>{children}</blockquote>
  if (node.type === 'editorialImage') {
    const src = typeof node.attrs?.src === 'string' ? node.attrs.src : ''
    const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''
    const credit = typeof node.attrs?.credit === 'string' ? node.attrs.credit : ''
    if (!src) return null
    return (
      <figure key={key}>
        <ZoomableEditorialImage src={src} alt={alt} credit={credit} />
      </figure>
    )
  }

  return <div key={key}>{children}</div>
}

export function EditorialDocumentView({ document }: { document: EditorialDocument }) {
  return (
    <div className="editorial-document">
      {document.content?.map((node, index) => renderNode(node, `node-${index}`))}
    </div>
  )
}
