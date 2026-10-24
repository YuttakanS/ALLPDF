# Thai Text Engine (`src/thai/`)

Implements Thai language-specific text processing modules:
- Complex text shaping via HarfBuzz WASM (harfbuzzjs)
- Word segmentation using `Intl.Segmenter('th', { granularity: 'word' })`
- ToUnicode CMap analysis, PUA remapping, and repair utilities
- Font embedding helpers (Noto Sans Thai, Sarabun)
