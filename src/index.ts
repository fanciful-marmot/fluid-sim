import { Renderer } from './renderer.ts';
import './index.css';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const { width, height } = canvas.getBoundingClientRect();
const dpr = window.devicePixelRatio;
canvas.width = width * dpr;
canvas.height = height * dpr;

const renderer = new Renderer(canvas);
renderer.start();
