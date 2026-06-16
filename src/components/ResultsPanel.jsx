import { downloadImage } from '../utils/download.js';

export default function ResultsPanel({ loading, images, error, emptyMessage }) {
  return (
    <section className="panel results-panel">
      <h2>Results</h2>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <p>Creating your logo… this may take a moment.</p>
        </div>
      )}

      {!loading && images.length === 0 && !error && (
        <div className="empty">
          <p>{emptyMessage}</p>
        </div>
      )}

      {!loading && images.length > 0 && (
        <div className={`results-grid results-grid--${images.length}`}>
          {images.map((src, i) => (
            <div key={i} className="result-card">
              <img src={src} alt={`Generated logo ${i + 1}`} />
              <button
                type="button"
                className="download-btn"
                onClick={() =>
                  downloadImage(src, `logo-${Date.now()}-${i + 1}.png`)
                }
              >
                Download PNG
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
