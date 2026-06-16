import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SIZE_OPTIONS } from '../constants/options.js';
import { createQuestion } from '../utils/questions.js';

export default function CreateTemplatePage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(templateId);
  const [pageLoading, setPageLoading] = useState(isEditing);

  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [questions, setQuestions] = useState([createQuestion('Brand / company name')]);
  const [templateSize, setTemplateSize] = useState('1024x1024');
  const [referenceFile, setReferenceFile] = useState(null);
  const [referencePreview, setReferencePreview] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createSuccess, setCreateSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEditing) {
      return undefined;
    }

    let cancelled = false;

    async function loadTemplate() {
      setPageLoading(true);
      setError('');

      try {
        const res = await fetch(`/api/templates/${templateId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load template.');
        }

        if (!cancelled) {
          const full = data.template;
          setTemplateName(full.name);
          setTemplateDescription(full.description ?? '');
          setSystemPrompt(full.systemPrompt);
          setTemplateSize(full.size ?? '1024x1024');
          setQuestions(full.questions.map((question) => ({ ...question })));
          setReferencePreview(`/api/templates/${templateId}/reference`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    }

    loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [isEditing, templateId]);

  useEffect(() => {
    return () => {
      if (referencePreview.startsWith('blob:')) {
        URL.revokeObjectURL(referencePreview);
      }
    };
  }, [referencePreview]);

  function resetTemplateForm() {
    setTemplateName('');
    setTemplateDescription('');
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
    navigate('/templates');
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
        isEditing ? `/api/templates/${templateId}/reference` : '',
      );
      return;
    }

    setReferenceFile(file);
    setReferencePreview(URL.createObjectURL(file));
  }

  async function handleSaveTemplate(e) {
    e.preventDefault();
    setError('');
    setCreateSuccess('');
    setCreateLoading(true);

    const formData = new FormData();
    formData.append('name', templateName.trim());
    formData.append('description', templateDescription.trim());
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

    const url = isEditing ? `/api/templates/${templateId}` : '/api/templates';
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
        navigate('/templates');
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

  const saveValid =
    templateName.trim() &&
    templateDescription.trim() &&
    systemPrompt.trim() &&
    (isEditing || referenceFile) &&
    questions.every((question) => question.label.trim());

  if (pageLoading) {
    return (
      <section className="panel form-panel">
        <div className="loading">
          <div className="spinner" />
          <p>Loading template…</p>
        </div>
      </section>
    );
  }

  return (
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
          <span>Description *</span>
          <textarea
            value={templateDescription}
            onChange={(e) => setTemplateDescription(e.target.value)}
            placeholder="What this template is for…"
            rows={3}
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
  );
}
