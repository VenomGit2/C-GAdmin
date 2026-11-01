import React from 'react';
import { createRoot } from 'react-dom/client';
import AuthGate from './components/AuthGate.jsx';
import PublicRequest from './pages/PublicRequest.jsx';
import './style/global.css';
import './style/login.css';
import './style/public-request.css';
const isRequestPage = window.location.hostname === 'request.circuitgrain.shop' || /^\/request\/?$/.test(window.location.pathname);
createRoot(document.getElementById('root')).render(<React.StrictMode>{isRequestPage ? <PublicRequest /> : <AuthGate />}</React.StrictMode>);
