const VALID_SIZES = ['1024x1024', '1024x1536', '1536x1024'];
const VALID_QUALITIES = ['low', 'medium', 'high'];
const VALID_STYLES = ['minimal', 'flat', 'vintage', '3D', 'mascot', 'lettermark'];
const VALID_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_NAME_LENGTH = 120;
const MAX_SYSTEM_PROMPT_LENGTH = 4000;
const MAX_QUESTIONS = 20;
const MAX_QUESTION_LABEL_LENGTH = 200;
const MAX_ANSWER_LENGTH = 1000;

const STYLE_DESCRIPTIONS = {
  minimal: 'minimal and clean with simple geometric shapes',
  flat: 'flat design with bold colors and no gradients',
  vintage: 'vintage retro style with classic typography',
  '3D': 'modern 3D rendered with depth and lighting',
  mascot: 'playful mascot character illustration',
  lettermark: 'typographic lettermark focused on initials',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildLogoPrompt(brief, style) {
  const styleDesc = STYLE_DESCRIPTIONS[style] || STYLE_DESCRIPTIONS.minimal;
  return [
    'Professional logo design,',
    styleDesc + ',',
    'for:',
    brief + '.',
    'Vector-style, clean background, centered composition,',
    'high contrast, suitable for branding and print.',
    'No text watermarks, no mockup frames.',
  ].join(' ');
}

function buildTemplatePrompt(systemPrompt, questions, answers) {
  const lines = [systemPrompt.trim()];

  for (const question of questions) {
    const answer = answers[question.id];
    if (answer && answer.trim()) {
      lines.push(`${question.label}: ${answer.trim()}`);
    }
  }

  return lines.join('\n\n');
}

function parseQuestions(raw) {
  let parsed;

  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error('Questions must be valid JSON.');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('At least one question is required.');
  }

  if (parsed.length > MAX_QUESTIONS) {
    throw new Error(`No more than ${MAX_QUESTIONS} questions are allowed.`);
  }

  const questions = parsed.map((item, index) => {
    const label = typeof item?.label === 'string' ? item.label.trim() : '';
    const id = typeof item?.id === 'string' && item.id.trim()
      ? item.id.trim()
      : `q${index + 1}`;

    if (!label) {
      throw new Error(`Question ${index + 1} must have a label.`);
    }

    if (label.length > MAX_QUESTION_LABEL_LENGTH) {
      throw new Error(`Question ${index + 1} label is too long.`);
    }

    return { id, label };
  });

  return questions;
}

function templateFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    systemPrompt: row.system_prompt,
    questions: JSON.parse(row.questions),
    size: row.size ?? '1024x1024',
    referenceType: row.reference_type,
    createdAt: row.created_at,
  };
}

function templateSummaryFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    questions: JSON.parse(row.questions),
    size: row.size ?? '1024x1024',
    referenceType: row.reference_type,
    createdAt: row.created_at,
  };
}

async function getTemplateRow(env, id) {
  const result = await env.DB.prepare(
    'SELECT id, name, system_prompt, questions, reference_key, reference_type, size, created_at FROM templates WHERE id = ?',
  )
    .bind(id)
    .first();

  return result ?? null;
}

function validateGenerationOptions(body) {
  const { size = '1024x1024', quality = 'medium', n = 1 } = body;

  if (!VALID_SIZES.includes(size)) {
    return { error: `Invalid size. Must be one of: ${VALID_SIZES.join(', ')}` };
  }

  if (!VALID_QUALITIES.includes(quality)) {
    return {
      error: `Invalid quality. Must be one of: ${VALID_QUALITIES.join(', ')}`,
    };
  }

  const count = Number(n);
  if (!Number.isInteger(count) || count < 1 || count > 4) {
    return { error: 'n must be an integer between 1 and 4.' };
  }

  return { size, quality, count };
}

function mapOpenAiImages(data) {
  return (data.data ?? [])
    .filter((item) => item.b64_json)
    .map((item) => `data:image/png;base64,${item.b64_json}`);
}

async function handleGenerate(request, env) {
  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const { prompt, size = '1024x1024', quality = 'medium', n = 1, style = 'minimal' } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return json({ error: 'A logo brief (prompt) is required.' }, 400);
  }

  if (prompt.trim().length > 1000) {
    return json({ error: 'Prompt must be 1000 characters or fewer.' }, 400);
  }

  if (!VALID_SIZES.includes(size)) {
    return json({ error: `Invalid size. Must be one of: ${VALID_SIZES.join(', ')}` }, 400);
  }

  if (!VALID_QUALITIES.includes(quality)) {
    return json({
      error: `Invalid quality. Must be one of: ${VALID_QUALITIES.join(', ')}`,
    }, 400);
  }

  const count = Number(n);
  if (!Number.isInteger(count) || count < 1 || count > 4) {
    return json({ error: 'n must be an integer between 1 and 4.' }, 400);
  }

  if (style && !VALID_STYLES.includes(style)) {
    return json({
      error: `Invalid style. Must be one of: ${VALID_STYLES.join(', ')}`,
    }, 400);
  }

  if (!env.OPENAI_API_KEY) {
    return json({ error: 'Server misconfigured: OPENAI_API_KEY is not set.' }, 500);
  }

  const logoPrompt = buildLogoPrompt(prompt.trim(), style);

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: logoPrompt,
        size,
        quality,
        n: count,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return json(
        { error: data.error?.message ?? 'Failed to generate logo. Please try again.' },
        response.status,
      );
    }

    const images = mapOpenAiImages(data);

    if (images.length === 0) {
      return json({ error: 'OpenAI returned no image data.' }, 502);
    }

    return json({ images, prompt: logoPrompt });
  } catch (err) {
    console.error('OpenAI error:', err);
    return json(
      { error: err.message ?? 'Failed to generate logo. Please try again.' },
      500,
    );
  }
}

function referenceExtension(mimeType) {
  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

function parseTemplateFormData(formData, { requireImage = true } = {}) {
  const name = formData.get('name');
  const systemPrompt = formData.get('systemPrompt');
  const questionsRaw = formData.get('questions');
  const image = formData.get('image');
  const sizeRaw = formData.get('size');
  const size = typeof sizeRaw === 'string' && sizeRaw.trim()
    ? sizeRaw.trim()
    : '1024x1024';
  const hasImage = image instanceof File && image.size > 0;

  if (typeof name !== 'string' || name.trim().length === 0) {
    return { error: 'Template name is required.' };
  }

  if (name.trim().length > MAX_NAME_LENGTH) {
    return { error: `Template name must be ${MAX_NAME_LENGTH} characters or fewer.` };
  }

  if (typeof systemPrompt !== 'string' || systemPrompt.trim().length === 0) {
    return { error: 'System prompt is required.' };
  }

  if (systemPrompt.trim().length > MAX_SYSTEM_PROMPT_LENGTH) {
    return {
      error: `System prompt must be ${MAX_SYSTEM_PROMPT_LENGTH} characters or fewer.`,
    };
  }

  if (requireImage && !hasImage) {
    return { error: 'A reference image is required.' };
  }

  if (!VALID_SIZES.includes(size)) {
    return { error: `Invalid size. Must be one of: ${VALID_SIZES.join(', ')}` };
  }

  if (hasImage) {
    if (!VALID_IMAGE_TYPES.includes(image.type)) {
      return {
        error: `Invalid image type. Must be one of: ${VALID_IMAGE_TYPES.join(', ')}`,
      };
    }

    if (image.size > MAX_IMAGE_BYTES) {
      return { error: 'Reference image must be 4 MB or smaller.' };
    }
  }

  let questions;

  try {
    questions = parseQuestions(questionsRaw);
  } catch (err) {
    return { error: err.message };
  }

  return {
    name: name.trim(),
    systemPrompt: systemPrompt.trim(),
    questions,
    size,
    image: hasImage ? image : null,
  };
}

async function handleCreateTemplate(request, env) {
  if (!env.DB) {
    return json({ error: 'Server misconfigured: DB is not set.' }, 500);
  }

  if (!env.TEMPLATE_ASSETS) {
    return json({ error: 'Server misconfigured: TEMPLATE_ASSETS is not set.' }, 500);
  }

  let formData;

  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'Invalid multipart form data.' }, 400);
  }

  const parsed = parseTemplateFormData(formData, { requireImage: true });

  if (parsed.error) {
    return json({ error: parsed.error }, 400);
  }

  const { name, systemPrompt, questions, size, image } = parsed;
  const id = crypto.randomUUID();
  const referenceKey = `templates/${id}/reference.${referenceExtension(image.type)}`;
  const createdAt = Date.now();

  try {
    await env.TEMPLATE_ASSETS.put(referenceKey, image.stream(), {
      httpMetadata: { contentType: image.type },
    });

    await env.DB.prepare(
      `INSERT INTO templates (
        id, name, system_prompt, questions, reference_key, reference_type, size, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        name,
        systemPrompt,
        JSON.stringify(questions),
        referenceKey,
        image.type,
        size,
        createdAt,
      )
      .run();

    return json({
      template: {
        id,
        name,
        systemPrompt,
        questions,
        size,
        referenceType: image.type,
        createdAt,
      },
    }, 201);
  } catch (err) {
    console.error('Create template error:', err);
    return json({ error: 'Failed to create template.' }, 500);
  }
}

async function handleUpdateTemplate(request, env, id) {
  if (!env.DB) {
    return json({ error: 'Server misconfigured: DB is not set.' }, 500);
  }

  if (!env.TEMPLATE_ASSETS) {
    return json({ error: 'Server misconfigured: TEMPLATE_ASSETS is not set.' }, 500);
  }

  let formData;

  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'Invalid multipart form data.' }, 400);
  }

  const parsed = parseTemplateFormData(formData, { requireImage: false });

  if (parsed.error) {
    return json({ error: parsed.error }, 400);
  }

  try {
    const row = await getTemplateRow(env, id);

    if (!row) {
      return json({ error: 'Template not found.' }, 404);
    }

    const { name, systemPrompt, questions, size, image } = parsed;
    let referenceKey = row.reference_key;
    let referenceType = row.reference_type;

    if (image) {
      referenceKey = `templates/${id}/reference.${referenceExtension(image.type)}`;
      referenceType = image.type;

      await env.TEMPLATE_ASSETS.put(referenceKey, image.stream(), {
        httpMetadata: { contentType: image.type },
      });

      if (referenceKey !== row.reference_key) {
        await env.TEMPLATE_ASSETS.delete(row.reference_key);
      }
    }

    await env.DB.prepare(
      `UPDATE templates
       SET name = ?, system_prompt = ?, questions = ?, reference_key = ?, reference_type = ?, size = ?
       WHERE id = ?`,
    )
      .bind(name, systemPrompt, JSON.stringify(questions), referenceKey, referenceType, size, id)
      .run();

    return json({
      template: {
        id,
        name,
        systemPrompt,
        questions,
        size,
        referenceType,
        createdAt: row.created_at,
      },
    });
  } catch (err) {
    console.error('Update template error:', err);
    return json({ error: 'Failed to update template.' }, 500);
  }
}

async function handleListTemplates(_request, env) {
  if (!env.DB) {
    return json({ error: 'Server misconfigured: DB is not set.' }, 500);
  }

  try {
    const result = await env.DB.prepare(
      'SELECT id, name, questions, reference_type, size, created_at FROM templates ORDER BY created_at DESC',
    ).all();

    const templates = (result.results ?? []).map(templateSummaryFromRow);
    return json({ templates });
  } catch (err) {
    console.error('List templates error:', err);
    return json({ error: 'Failed to load templates.' }, 500);
  }
}

async function handleGetTemplate(_request, env, id) {
  if (!env.DB) {
    return json({ error: 'Server misconfigured: DB is not set.' }, 500);
  }

  try {
    const row = await getTemplateRow(env, id);

    if (!row) {
      return json({ error: 'Template not found.' }, 404);
    }

    return json({ template: templateFromRow(row) });
  } catch (err) {
    console.error('Get template error:', err);
    return json({ error: 'Failed to load template.' }, 500);
  }
}

async function handleGetReference(_request, env, id) {
  if (!env.DB || !env.TEMPLATE_ASSETS) {
    return json({ error: 'Server misconfigured.' }, 500);
  }

  try {
    const row = await getTemplateRow(env, id);

    if (!row) {
      return json({ error: 'Template not found.' }, 404);
    }

    const object = await env.TEMPLATE_ASSETS.get(row.reference_key);

    if (!object) {
      return json({ error: 'Reference image not found.' }, 404);
    }

    const headers = new Headers();
    headers.set('Content-Type', row.reference_type);
    headers.set('Cache-Control', 'public, max-age=3600');

    return new Response(object.body, { headers });
  } catch (err) {
    console.error('Get reference error:', err);
    return json({ error: 'Failed to load reference image.' }, 500);
  }
}

async function handleDeleteTemplate(_request, env, id) {
  if (!env.DB || !env.TEMPLATE_ASSETS) {
    return json({ error: 'Server misconfigured.' }, 500);
  }

  try {
    const row = await getTemplateRow(env, id);

    if (!row) {
      return json({ error: 'Template not found.' }, 404);
    }

    await env.TEMPLATE_ASSETS.delete(row.reference_key);
    await env.DB.prepare('DELETE FROM templates WHERE id = ?').bind(id).run();

    return json({ ok: true });
  } catch (err) {
    console.error('Delete template error:', err);
    return json({ error: 'Failed to delete template.' }, 500);
  }
}

async function handleTemplateGenerate(request, env, id) {
  if (!env.DB || !env.TEMPLATE_ASSETS) {
    return json({ error: 'Server misconfigured.' }, 500);
  }

  if (!env.OPENAI_API_KEY) {
    return json({ error: 'Server misconfigured: OPENAI_API_KEY is not set.' }, 500);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const options = validateGenerationOptions(body);
  if (options.error) {
    return json({ error: options.error }, 400);
  }

  const { answers } = body;

  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return json({ error: 'Answers must be an object keyed by question id.' }, 400);
  }

  try {
    const row = await getTemplateRow(env, id);

    if (!row) {
      return json({ error: 'Template not found.' }, 404);
    }

    const questions = JSON.parse(row.questions);

    for (const question of questions) {
      const answer = answers[question.id];
      if (typeof answer !== 'string' || answer.trim().length === 0) {
        return json({ error: `Answer required for: ${question.label}` }, 400);
      }

      if (answer.trim().length > MAX_ANSWER_LENGTH) {
        return json({ error: `Answer for "${question.label}" is too long.` }, 400);
      }
    }

    const referenceObject = await env.TEMPLATE_ASSETS.get(row.reference_key);

    if (!referenceObject) {
      return json({ error: 'Reference image not found.' }, 404);
    }

    const referenceBytes = await referenceObject.arrayBuffer();
    const logoPrompt = buildTemplatePrompt(row.system_prompt, questions, answers);

    const extension = row.reference_type === 'image/png'
      ? 'png'
      : row.reference_type === 'image/webp'
        ? 'webp'
        : 'jpg';

    const openAiForm = new FormData();
    openAiForm.append('model', 'gpt-image-1');
    openAiForm.append('prompt', logoPrompt);
    openAiForm.append(
      'image',
      new Blob([referenceBytes], { type: row.reference_type }),
      `reference.${extension}`,
    );
    openAiForm.append('size', options.size);
    openAiForm.append('quality', options.quality);
    openAiForm.append('n', String(options.count));

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: openAiForm,
    });

    const data = await response.json();

    if (!response.ok) {
      return json(
        { error: data.error?.message ?? 'Failed to generate logo. Please try again.' },
        response.status,
      );
    }

    const images = mapOpenAiImages(data);

    if (images.length === 0) {
      return json({ error: 'OpenAI returned no image data.' }, 502);
    }

    return json({ images, prompt: logoPrompt, templateId: id });
  } catch (err) {
    console.error('Template generate error:', err);
    return json(
      { error: err.message ?? 'Failed to generate logo. Please try again.' },
      500,
    );
  }
}

function matchTemplateRoute(pathname) {
  const templatesMatch = pathname.match(/^\/api\/templates(?:\/([^/]+)(?:\/(reference|generate))?)?$/);
  return templatesMatch ?? null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/generate' && request.method === 'POST') {
      return handleGenerate(request, env);
    }

    const templateMatch = matchTemplateRoute(url.pathname);

    if (templateMatch) {
      const [, id, action] = templateMatch;

      if (!id && request.method === 'GET') {
        return handleListTemplates(request, env);
      }

      if (!id && request.method === 'POST') {
        return handleCreateTemplate(request, env);
      }

      if (id && !action && request.method === 'GET') {
        return handleGetTemplate(request, env, id);
      }

      if (id && !action && request.method === 'PUT') {
        return handleUpdateTemplate(request, env, id);
      }

      if (id && !action && request.method === 'DELETE') {
        return handleDeleteTemplate(request, env, id);
      }

      if (id && action === 'reference' && request.method === 'GET') {
        return handleGetReference(request, env, id);
      }

      if (id && action === 'generate' && request.method === 'POST') {
        return handleTemplateGenerate(request, env, id);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
