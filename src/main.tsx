import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// Fonts are bundled with the app (no Google Fonts request: faster, works offline and where Google is slow).
import '@fontsource/vazirmatn/300.css';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/700.css';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
