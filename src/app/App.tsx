import React, { useEffect, useState } from 'react';
import { PdfDocument } from '../engine';
import { PdfViewer } from './viewer';

export const App: React.FC = () => {
  const [isIsolated, setIsIsolated] = useState<boolean>(false);
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsIsolated(window.crossOriginIsolated === true);

    // Support automatic test harness loading via URL query ?synthetic=100
    const params = new URLSearchParams(window.location.search);
    const syntheticCount = params.get('synthetic');
    if (syntheticCount) {
      const count = parseInt(syntheticCount, 10);
      if (!isNaN(count) && count > 0) {
        loadSynthetic(count);
      }
    }
  }, []);

  const loadSynthetic = async (pageCount: number) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { createSyntheticPdf } = await import('../../tests/helpers/synthetic-pdf');
      const buffer = createSyntheticPdf({ pageCount, width: 612, height: 792 });
      const pdf = await PdfDocument.open(buffer);
      setDoc(pdf);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const buffer = await file.arrayBuffer();
      const pdf = await PdfDocument.open(buffer);
      setDoc(pdf);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        margin: 0,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          backgroundColor: '#1a73e8',
          color: '#ffffff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>ALLPDF - Thai-first PDF Web Toolkit</h1>
          <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
            ประมวลผลบนเบราว์เซอร์ 100% | Isolated:{' '}
            <span data-testid="cross-origin-isolated-status">{isIsolated ? 'true' : 'false'}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            data-testid="file-input"
            style={{ display: 'none' }}
            id="pdf-upload-input"
          />
          <label
            htmlFor="pdf-upload-input"
            data-testid="upload-btn"
            style={{
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              color: '#1a73e8',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.9rem',
            }}
          >
            เปิดไฟล์ PDF (Open)
          </label>

          <button
            onClick={() => loadSynthetic(100)}
            data-testid="load-synthetic-100-btn"
            style={{
              padding: '6px 12px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            100-Page Demo
          </button>
        </div>
      </header>

      {errorMsg && (
        <div
          data-testid="error-toast"
          style={{
            padding: '10px 20px',
            backgroundColor: '#d93025',
            color: '#fff',
            fontWeight: 500,
          }}
        >
          {errorMsg}
        </div>
      )}

      {isLoading && (
        <div
          data-testid="loading-indicator"
          style={{
            padding: '20px',
            textAlign: 'center',
            color: '#555',
          }}
        >
          กำลังเปิดเอกสาร... (Loading document...)
        </div>
      )}

      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {doc ? (
          <PdfViewer doc={doc} />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#666',
            }}
          >
            <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>
              ลากไฟล์ PDF มาวางที่นี่ หรือกดปุ่มเปิดไฟล์ด้านบน
            </p>
            <p style={{ fontSize: '0.9rem', color: '#888' }}>
              Drag and drop a PDF file here, or click Open above
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
