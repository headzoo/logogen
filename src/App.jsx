import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from './constants/options.js';
import CreateTemplatePage from './pages/CreateTemplatePage.jsx';
import GeneratePage from './pages/GeneratePage.jsx';
import LegacyTemplateRedirect from './pages/LegacyTemplateRedirect.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';
import UseTemplatePage from './pages/UseTemplatePage.jsx';

function isTemplatesNavActive(pathname) {
  if (pathname === '/templates') {
    return true;
  }
  if (pathname === '/templates/new') {
    return false;
  }
  if (/^\/templates\/[^/]+\/edit$/.test(pathname)) {
    return false;
  }
  return /^\/templates\/[^/]+$/.test(pathname);
}

function isCreateNavActive(pathname) {
  return pathname === '/templates/new' || /^\/templates\/[^/]+\/edit$/.test(pathname);
}

function navTabClass(isActive) {
  return `nav-tab${isActive ? ' nav-tab--active' : ''}`;
}

export default function App() {
  const { pathname } = useLocation();

  return (
    <div className="app">
      <LegacyTemplateRedirect />

      <header className="header">
        <div className="logo-mark">LG</div>
        <div className="header-copy">
          <h1>LogoGen</h1>
          <p>AI-powered logo generator using OpenAI</p>
        </div>
        <nav className="nav-tabs" aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => navTabClass(isActive)}>
            {NAV_ITEMS[0].label}
          </NavLink>
          <NavLink
            to="/templates"
            className={() => navTabClass(isTemplatesNavActive(pathname))}
          >
            {NAV_ITEMS[1].label}
          </NavLink>
          <NavLink
            to="/templates/new"
            className={() => navTabClass(isCreateNavActive(pathname))}
          >
            {NAV_ITEMS[2].label}
          </NavLink>
        </nav>
      </header>

      <main className={`main${pathname === '/templates' ? ' main--single' : ''}`}>
        <Routes>
          <Route path="/" element={<GeneratePage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/templates/new" element={<CreateTemplatePage />} />
          <Route path="/templates/:templateId/edit" element={<CreateTemplatePage />} />
          <Route path="/templates/:templateId" element={<UseTemplatePage />} />
        </Routes>
      </main>

      <footer className="footer">
        <p>Powered by OpenAI gpt-image-1 · API key stays on the server</p>
      </footer>
    </div>
  );
}
