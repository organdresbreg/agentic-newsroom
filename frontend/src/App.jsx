import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import News from './pages/News';

import Sources from './pages/Sources';

import Trash from './pages/Trash';


import Entities from './pages/Entities';
import Settings from './pages/Settings';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { HighlightProvider } from './context/HighlightContext';

function App() {
    return (
        <ThemeProvider>
            <ToastProvider>
                <HighlightProvider>
                    <Router>
                        <Routes>
                            <Route path="/" element={<Layout />}>
                                <Route index element={<News />} />



                                <Route path="sources" element={<Sources />} />
                                <Route path="entities" element={<Entities />} />

                                <Route path="settings" element={<Settings />} />
                                <Route path="trash" element={<Trash />} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Route>
                        </Routes>
                    </Router>
                </HighlightProvider>
            </ToastProvider>
        </ThemeProvider>
    );
}

export default App;
