import { Facet } from '@codemirror/state'

export interface PreviewOptions {
  focus: boolean
  theme: string
}

export const previewOptions = Facet.define<PreviewOptions, PreviewOptions>({
  combine(values) {
    return values[0] ?? { focus: false, theme: 'inkwell' }
  },
})
