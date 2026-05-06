import React from 'react';
import { createRoot } from 'react-dom/client';
import { DialRoot } from 'dialkit';
import 'dialkit/styles.css';
import './styles.css';
import { CarouselControls } from './controls.jsx';
import './carousel.js';

const mount = document.getElementById('dialkit-root');
createRoot(mount).render(
    <React.StrictMode>
        <CarouselControls />
        <DialRoot position="bottom-right" defaultOpen={false} />
    </React.StrictMode>
);
