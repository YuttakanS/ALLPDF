# OCR Pipeline (`src/ocr/`)

Implements client-side OCR for Thai documents:
- Preprocessing (deskew, binarization via WASM SIMD)
- Candidate OCR engine orchestration (Tesseract WASM / ONNX)
- Searchable PDF generation (invisible text layer, render mode 3, ToUnicode)
- Model caching via Cache API and IndexedDB
