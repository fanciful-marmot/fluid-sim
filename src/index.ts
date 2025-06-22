import { Renderer } from './renderer.ts';
import './index.css';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const { width, height } = canvas.getBoundingClientRect();
const dpr = window.devicePixelRatio;
canvas.width = width * dpr;
canvas.height = height * dpr;

const renderer = new Renderer(canvas);

// Handle canvas resize
const observer = new ResizeObserver((entries: ResizeObserverEntry[]) => {
    for (const entry of entries) {
        if (entry.target === canvas) {
            const dpr = window.devicePixelRatio;
            const { width, height } = entry.contentRect;
            canvas.width = width * dpr;
            canvas.height = height * dpr;

            renderer.setSize(canvas.width, canvas.height);
        }
    }
});
observer.observe(canvas, { box: 'device-pixel-content-box' });

await renderer.init();

renderer.start();

window.addEventListener('keydown', () => {
    renderer.requestRender();
});
