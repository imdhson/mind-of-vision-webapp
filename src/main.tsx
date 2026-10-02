import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AppRuntime } from '@/app/AppRuntime';
import '@/styles/globals.css';
registerSW({ immediate: true });
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AppRuntime><App/></AppRuntime></React.StrictMode>);
