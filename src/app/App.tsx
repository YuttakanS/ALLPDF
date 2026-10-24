import React, { useEffect, useState } from 'react';

export const App: React.FC = () => {
  const [isIsolated, setIsIsolated] = useState<boolean>(false);

  useEffect(() => {
    setIsIsolated(window.crossOriginIsolated === true);
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <header>
        <h1>ALLPDF - Thai-first PDF Web Toolkit</h1>
        <p>เครื่องมือจัดการเอกสาร PDF ภาษาไทย ประมวลผลบนเบราว์เซอร์อย่างปลอดภัย 100%</p>
      </header>
      <section style={{ marginTop: '1.5rem' }}>
        <div>
          <span>Cross-Origin Isolated: </span>
          <span data-testid="cross-origin-isolated-status">{isIsolated ? 'true' : 'false'}</span>
        </div>
      </section>
    </main>
  );
};
