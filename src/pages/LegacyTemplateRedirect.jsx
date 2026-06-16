import { Navigate, useSearchParams } from 'react-router-dom';

export default function LegacyTemplateRedirect() {
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');

  if (!templateId) {
    return null;
  }

  return <Navigate to={`/templates/${templateId}`} replace />;
}
