import { Node, mergeAttributes } from '@tiptap/core'

export const EditorialImage = Node.create({
  name: 'editorialImage',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      credit: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-editorial-image]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, credit, ...figureAttributes } = HTMLAttributes
    return [
      'figure',
      mergeAttributes(figureAttributes, { 'data-editorial-image': '' }),
      ['img', { src, alt }],
      ...(credit ? [['figcaption', {}, credit]] : []),
    ]
  },
})
