import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTemplatePermalink } from '../utils/templateUrl.js';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
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
  }, []);

  async function copyTemplatePermalink(templateId) {
    try {
      await navigator.clipboard.writeText(getTemplatePermalink(templateId));
      setCopiedId(templateId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('Failed to copy permalink.');
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
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel templates-panel">
      <div className="templates-panel__header">
        <h2>Templates</h2>
        <button type="button" className="text-btn" onClick={() => navigate('/templates/new')}>
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
          <button type="button" className="generate-btn" onClick={() => navigate('/templates/new')}>
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
                onClick={() => navigate(`/templates/${template.id}`)}
              >
                <img
                  src={`/api/templates/${template.id}/reference`}
                  alt={`${template.name} reference`}
                  className="template-card__image"
                />
                <div className="template-card__content">
                  <h3>{template.name}</h3>
                  <p className="template-card__description">{template.description}</p>
                  <p>{template.questions.length} question{template.questions.length === 1 ? '' : 's'}</p>
                </div>
              </button>
              <div className="template-card__actions">
                <button
                  type="button"
                  className="template-card__edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/templates/${template.id}/edit`);
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
  );
}
