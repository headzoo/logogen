import { useState } from 'react';
import {
  QUALITY_OPTIONS,
  SIZE_OPTIONS,
  STYLE_OPTIONS,
} from '../constants/options.js';
import ResultsPanel from '../components/ResultsPanel.jsx';

export default function GeneratePage() {
  const [brief, setBrief] = useState('');
  const [details, setDetails] = useState('');
  const [style, setStyle] = useState('minimal');
  const [size, setSize] = useState('1024x1024');
  const [quality, setQuality] = useState('medium');
  const [count, setCount] = useState(1);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate(e) {
    e.preventDefault();
    setImages([]);
    setError('');
    setLoading(true);

    const prompt = [brief.trim(), details.trim()].filter(Boolean).join('. ');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style, size, quality, n: count }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Generation failed.');
      }

      setImages(data.images);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="panel form-panel">
        <h2>Describe your logo</h2>
        <form onSubmit={handleGenerate}>
          <label className="field">
            <span>Brand / idea *</span>
            <input
              type="text"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. Sunrise Coffee, a cozy neighborhood café"
              required
            />
          </label>

          <label className="field">
            <span>Additional details</span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Industry, colors, mood, symbols…"
              rows={3}
            />
          </label>

          <div className="controls-grid">
            <label className="field">
              <span>Style</span>
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                {STYLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Size</span>
              <select value={size} onChange={(e) => setSize(e.target.value)}>
                {SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Quality</span>
              <select value={quality} onChange={(e) => setQuality(e.target.value)}>
                {QUALITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Variations</span>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button type="submit" className="generate-btn" disabled={loading || !brief.trim()}>
            {loading ? 'Generating…' : 'Generate Logo'}
          </button>
        </form>

        {error && <div className="error">{error}</div>}
      </section>

      <ResultsPanel
        loading={loading}
        images={images}
        error={error}
        emptyMessage="Your generated logos will appear here."
      />
    </>
  );
}
