class Renderer {
    constructor(canvas: HTMLCanvasElement) {
        const ctx2d = canvas.getContext('2d');
        ctx2d.fillRect(0, 0, 100, 200);
    }

    start() {}
}

export { Renderer };
