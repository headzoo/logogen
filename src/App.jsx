import { useEffect, useState } from 'react';

const STYLE_OPTIONS = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'flat', label: 'Flat' },
  { value: 'vintage', label: 'Vintage' },
  { value: '3D', label: '3D' },
  { value: 'mascot', label: 'Mascot' },
  { value: 'lettermark', label: 'Lettermark' },
];

const SIZE_OPTIONS = [
  { value: '1024x1024', label: 'Square (1024×1024)' },
  { value: '1024x1536', label: 'Portrait (1024×1536)' },
  { value: '1536x1024', label: 'Landscape (1536×1024)' },
];

const QUALITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const NAV_ITEMS = [
  { id: 'generate', label: 'Generate' },
  { id: 'templates', label: 'Templates' },
  { id: 'create', label: 'Create Template' },
];

function downloadImage(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function createQuestion(label = '') {
  return {
    id: crypto.randomUUID(),
    label,
  };
}

function getTemplatePermalink(templateId) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('template', templateId);
  return url.toString();
}

function setTemplateQueryParam(templateId) {
  const url = new URL(window.location.href);
  url.searchParams.set('template', templateId);
  window.history.replaceState({}, '', url);
}

function clearTemplateQueryParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('template')) {
    return;
  }

  url.searchParams.delete('template');
  window.history.replaceState({}, '', url);
}

function ResultsPanel({ loading, images, error, emptyMessage }) {
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

export default function App() {
  const [view, setView] = useState('generate');

  const [brief, setBrief] = useState('');
  const [details, setDetails] = useState('');
  const [style, setStyle] = useState('minimal');
  const [size, setSize] = useState('1024x1024');
  const [quality, setQuality] = useState('medium');
  const [count, setCount] = useState(1);

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [answers, setAnswers] = useState({});

  const [templateName, setTemplateName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [questions, setQuestions] = useState([createQuestion('Brand / company name')]);
  const [templateSize, setTemplateSize] = useState('1024x1024');
  const [referenceFile, setReferenceFile] = useState(null);
  const [referencePreview, setReferencePreview] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createSuccess, setCreateSuccess] = useState('');

  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    const templateId = new URLSearchParams(window.location.search).get('template');
    if (!templateId) {
      return undefined;
    }

    let cancelled = false;

    async function loadTemplateFromUrl() {
      try {
        const res = await fetch(`/api/templates/${templateId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Template not found.');
        }

        if (!cancelled) {
          resetResults();
          setSelectedTemplate(data.template);
          setAnswers(
            Object.fromEntries(
              (data.template.questions ?? []).map((question) => [question.id, '']),
            ),
          );
          setSize(data.template.size ?? '1024x1024');
          setView('use');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          clearTemplateQueryParam();
        }
      }
    }

    loadTemplateFromUrl();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (view !== 'templates') {
      return undefined;
    }

    let cancelled = false;

    async function loadTemplates() {
      setTemplatesLoading(true);
      setError('');

      try {
        const res = await fetch('/api/templates');
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load templates.');
        }

        if (!cancelled) {
          setTemplates(data.templates ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setTemplatesLoading(false);
        }
      }
    }

    loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [view]);

  useEffect(() => {
    return () => {
      if (referencePreview.startsWith('blob:')) {
        URL.revokeObjectURL(referencePreview);
      }
    };
  }, [referencePreview]);

  function resetTemplateForm() {
    setEditingTemplateId(null);
    setTemplateName('');
    setSystemPrompt('');
    setQuestions([createQuestion('Brand / company name')]);
    setTemplateSize('1024x1024');
    setReferenceFile(null);

    if (referencePreview.startsWith('blob:')) {
      URL.revokeObjectURL(referencePreview);
    }

    setReferencePreview('');
    setCreateSuccess('');
  }

  function cancelEdit() {
    resetTemplateForm();
    setError('');
    setView('templates');
  }

  function resetResults() {
    setImages([]);
    setError('');
  }

  function switchView(nextView) {
    setView(nextView);
    setError('');
    setCreateSuccess('');

    if (nextView === 'create') {
      resetTemplateForm();
    }

    if (nextView !== 'use') {
      setSelectedTemplate(null);
      setAnswers({});
      clearTemplateQueryParam();
      setSize('1024x1024');
    }
  }

  function openTemplate(template) {
    resetResults();
    setSelectedTemplate(template);
    setAnswers(
      Object.fromEntries(
        (template.questions ?? []).map((question) => [question.id, '']),
      ),
    );
    setSize(template.size ?? '1024x1024');
    setView('use');
    setTemplateQueryParam(template.id);
  }

  function selectTemplate(template) {
    openTemplate(template);
  }

  async function copyTemplatePermalink(templateId) {
    try {
      await navigator.clipboard.writeText(getTemplatePermalink(templateId));
      setCopiedId(templateId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('Failed to copy permalink.');
    }
  }

  function updateQuestion(id, label) {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, label } : question,
      ),
    );
  }

  function addQuestion() {
    setQuestions((current) => [...current, createQuestion('')]);
  }

  function removeQuestion(id) {
    setQuestions((current) =>
      current.length === 1 ? current : current.filter((question) => question.id !== id),
    );
  }

  function handleReferenceChange(e) {
    const file = e.target.files?.[0];

    if (referencePreview.startsWith('blob:')) {
      URL.revokeObjectURL(referencePreview);
    }

    if (!file) {
      setReferenceFile(null);
      setReferencePreview(
        editingTemplateId ? `/api/templates/${editingTemplateId}/reference` : '',
      );
      return;
    }

    setReferenceFile(file);
    setReferencePreview(URL.createObjectURL(file));
  }

  async function startEditTemplate(template) {
    setError('');
    setCreateSuccess('');

    try {
      const res = await fetch(`/api/templates/${template.id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load template.');
      }

      const full = data.template;
      resetTemplateForm();
      setEditingTemplateId(template.id);
      setTemplateName(full.name);
      setSystemPrompt(full.systemPrompt);
      setTemplateSize(full.size ?? '1024x1024');
      setQuestions(full.questions.map((question) => ({ ...question })));
      setReferencePreview(`/api/templates/${template.id}/reference`);
      setView('create');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    resetResults();
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

  async function handleSaveTemplate(e) {
    e.preventDefault();
    setError('');
    setCreateSuccess('');
    setCreateLoading(true);

    const formData = new FormData();
    formData.append('name', templateName.trim());
    formData.append('systemPrompt', systemPrompt.trim());
    formData.append('size', templateSize);
    formData.append(
      'questions',
      JSON.stringify(
        questions.map(({ id, label }) => ({
          id,
          label: label.trim(),
        })),
      ),
    );

    if (referenceFile) {
      formData.append('image', referenceFile);
    }

    const isEditing = Boolean(editingTemplateId);
    const url = isEditing ? `/api/templates/${editingTemplateId}` : '/api/templates';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to ${isEditing ? 'update' : 'create'} template.`);
      }

      if (isEditing) {
        setCreateSuccess(`Template "${data.template.name}" updated.`);
        resetTemplateForm();
        setView('templates');
      } else {
        setCreateSuccess(`Template "${data.template.name}" created.`);
        resetTemplateForm();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleTemplateGenerate(e) {
    e.preventDefault();
    resetResults();
    setLoading(true);

    try {
      const res = await fetch(`/api/templates/${selectedTemplate.id}/generate`, {
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

  async function handleDeleteTemplate(templateId) {
    if (!window.confirm('Delete this template? This cannot be undone.')) {
      return;
    }

    setError('');

    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete template.');
      }

      setTemplates((current) => current.filter((template) => template.id !== templateId));

      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
        setAnswers({});
        clearTemplateQueryParam();
        setView('templates');
      }

      if (editingTemplateId === templateId) {
        resetTemplateForm();
        setView('templates');
      }
    } catch (err) {
      setError(err.message);
    }
  }

  const saveValid =
    templateName.trim() &&
    systemPrompt.trim() &&
    (editingTemplateId || referenceFile) &&
    questions.every((question) => question.label.trim());

  const isEditing = Boolean(editingTemplateId);

  const templateGenerateValid =
    selectedTemplate &&
    selectedTemplate.questions.every(
      (question) => answers[question.id]?.trim(),
    );

  return (
    <div className="app">
      <header className="header">
        <div className="logo-mark">LG</div>
        <div className="header-copy">
          <h1>LogoGen</h1>
          <p>AI-powered logo generator using OpenAI</p>
        </div>
        <nav className="nav-tabs" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-tab${view === item.id || (item.id === 'templates' && view === 'use') || (item.id === 'create' && isEditing) ? ' nav-tab--active' : ''}`}
              onClick={() => switchView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className={`main${view === 'templates' ? ' main--single' : ''}`}>
        {view === 'generate' && (
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
        )}

        {view === 'create' && (
          <section className="panel form-panel">
            <h2>{isEditing ? 'Edit template' : 'Create a template'}</h2>
            <p className="panel-intro">
              {isEditing
                ? 'Update the system prompt, questions, and optionally replace the reference image.'
                : 'Define a system prompt, upload a reference image, and add questions users will answer when generating.'}
            </p>
            <form onSubmit={handleSaveTemplate}>
              <label className="field">
                <span>Template name *</span>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Minimal wordmark refresh"
                  required
                />
              </label>

              <label className="field">
                <span>System prompt *</span>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Instructions for the AI when using this template…"
                  rows={5}
                  required
                />
              </label>

              <label className="field">
                <span>Default image size *</span>
                <select
                  value={templateSize}
                  onChange={(e) => setTemplateSize(e.target.value)}
                >
                  {SIZE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Reference image{isEditing ? '' : ' *'}</span>
                {isEditing && (
                  <span className="field-hint">Leave empty to keep the current image.</span>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleReferenceChange}
                  required={!isEditing && !referenceFile}
                />
              </label>

              {referencePreview && (
                <div className="reference-preview">
                  <img src={referencePreview} alt="Reference preview" />
                </div>
              )}

              <div className="question-builder">
                <div className="question-builder__header">
                  <span>Questions *</span>
                  <button type="button" className="text-btn" onClick={addQuestion}>
                    + Add question
                  </button>
                </div>

                {questions.map((question, index) => (
                  <div key={question.id} className="question-row">
                    <input
                      type="text"
                      value={question.label}
                      onChange={(e) => updateQuestion(question.id, e.target.value)}
                      placeholder={`Question ${index + 1}`}
                      required
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => removeQuestion(question.id)}
                      disabled={questions.length === 1}
                      aria-label={`Remove question ${index + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="form-actions">
                {isEditing && (
                  <button type="button" className="secondary-btn" onClick={cancelEdit}>
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="generate-btn"
                  disabled={createLoading || !saveValid}
                >
                  {createLoading ? 'Saving…' : isEditing ? 'Save Changes' : 'Save Template'}
                </button>
              </div>
            </form>

            {error && <div className="error">{error}</div>}
            {createSuccess && <div className="success">{createSuccess}</div>}
          </section>
        )}

        {view === 'templates' && (
          <section className="panel templates-panel">
            <div className="templates-panel__header">
              <h2>Templates</h2>
              <button type="button" className="text-btn" onClick={() => switchView('create')}>
                + New template
              </button>
            </div>

            {templatesLoading && (
              <div className="loading">
                <div className="spinner" />
                <p>Loading templates…</p>
              </div>
            )}

            {!templatesLoading && templates.length === 0 && (
              <div className="empty">
                <p>No templates yet. Create one to get started.</p>
                <button type="button" className="generate-btn" onClick={() => switchView('create')}>
                  Create Template
                </button>
              </div>
            )}

            {!templatesLoading && templates.length > 0 && (
              <div className="template-grid">
                {templates.map((template) => (
                  <article key={template.id} className="template-card">
                    <button
                      type="button"
                      className="template-card__body"
                      onClick={() => selectTemplate(template)}
                    >
                      <img
                        src={`/api/templates/${template.id}/reference`}
                        alt={`${template.name} reference`}
                        className="template-card__image"
                      />
                      <div className="template-card__content">
                        <h3>{template.name}</h3>
                        <p>{template.questions.length} question{template.questions.length === 1 ? '' : 's'}</p>
                      </div>
                    </button>
                    <div className="template-card__actions">
                      <button
                        type="button"
                        className="template-card__edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditTemplate(template);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="template-card__delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(template.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <button
                      type="button"
                      className={`template-card__copy${copiedId === template.id ? ' template-card__copy--copied' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyTemplatePermalink(template.id);
                      }}
                    >
                      {copiedId === template.id ? 'Copied!' : 'Copy Permalink'}
                    </button>
                  </article>
                ))}
              </div>
            )}

            {error && <div className="error">{error}</div>}
          </section>
        )}

        {view === 'use' && selectedTemplate && (
          <section className="panel form-panel">
            <button type="button" className="back-btn" onClick={() => switchView('templates')}>
              ← Back to templates
            </button>
            <h2>{selectedTemplate.name}</h2>
            <div className="template-use-preview">
              <img
                src={`/api/templates/${selectedTemplate.id}/reference`}
                alt={`${selectedTemplate.name} reference`}
              />
            </div>

            <form onSubmit={handleTemplateGenerate}>
              {selectedTemplate.questions.map((question) => (
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
        )}

        {(view === 'generate' || view === 'use') && (
          <ResultsPanel
            loading={loading}
            images={images}
            error={error}
            emptyMessage="Your generated logos will appear here."
          />
        )}
      </main>

      <footer className="footer">
        <p>Powered by OpenAI gpt-image-1 · API key stays on the server</p>
      </footer>
    </div>
  );
}
