import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QUALITY_OPTIONS, SIZE_OPTIONS } from '../constants/options.js';
import ResultsPanel from '../components/ResultsPanel.jsx';

export default function UseTemplatePage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [size, setSize] = useState('1024x1024');
  const [quality, setQuality] = useState('medium');
  const [count, setCount] = useState(1);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadTemplate() {
      setTemplateLoading(true);
      setError('');

      try {
        const res = await fetch(`/api/templates/${templateId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Template not found.');
        }

        if (!cancelled) {
          setTemplate(data.template);
          setAnswers(
            Object.fromEntries(
              (data.template.questions ?? []).map((question) => [question.id, '']),
            ),
          );
          setSize(data.template.size ?? '1024x1024');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setTemplateLoading(false);
        }
      }
    }

    loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  async function handleTemplateGenerate(e) {
    e.preventDefault();
    setImages([]);
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/templates/${template.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, size, quality, n: count }),
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

  if (templateLoading) {
    return (
      <section className="panel form-panel">
        <div className="loading">
          <div className="spinner" />
          <p>Loading template…</p>
        </div>
      </section>
    );
  }

  if (!template) {
    return (
      <section className="panel form-panel">
        {error && <div className="error">{error}</div>}
        <button type="button" className="back-btn" onClick={() => navigate('/templates')}>
          ← Back to templates
        </button>
      </section>
    );
  }

  const templateGenerateValid = template.questions.every(
    (question) => answers[question.id]?.trim(),
  );

  return (
    <>
      <section className="panel form-panel">
        <button type="button" className="back-btn" onClick={() => navigate('/templates')}>
          ← Back to templates
        </button>
        <h2 style={{ marginBottom: 0 }}>{template.name}</h2>
        <p className="panel-intro">{template.description}</p>
        <div className="template-use-preview">
          <img
            src={`/api/templates/${template.id}/reference`}
            alt={`${template.name} reference`}
          />
          <small>Reference image</small>
        </div>

        <form onSubmit={handleTemplateGenerate}>
          {template.questions.map((question) => (
            <label key={question.id} className="field">
              <span>{question.label} *</span>
              <input
                type="text"
                value={answers[question.id] ?? ''}
                onChange={(e) =>
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: e.target.value,
                  }))
                }
                required
              />
            </label>
          ))}

          <div className="controls-grid">
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

          <button
            type="submit"
            className="generate-btn"
            disabled={loading || !templateGenerateValid}
          >
            {loading ? 'Generating…' : 'Generate from Template'}
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
