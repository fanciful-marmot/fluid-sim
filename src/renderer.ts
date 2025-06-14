import { createFullScreenTriangle } from './utils/fullscreenTriangle';
import { getDevice } from './utils/webgpu';

class Renderer {
    #size: { width: number; height: number } = { width: 1, height: 1 };

    #device: GPUDevice | null = null;
    #context: GPUCanvasContext;
    #loopId: number;

    #renderPipeline: GPURenderPipeline | null = null;
    #fullscreenTriangle: ReturnType<typeof createFullScreenTriangle>;

    constructor(canvas: HTMLCanvasElement) {
        this.#context = canvas.getContext('webgpu');

        this.#size = {
            width: canvas.width,
            height: canvas.height,
        };
    }

    setSize(width: number, height: number) {
        this.#size = { width, height };
    }

    async init() {
        if (this.#device) {
            throw new Error('Renderer is already been initialized');
        }
        this.#device = await getDevice();

        this.#context.configure({
            device: this.#device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            alphaMode: 'opaque',
        });

        this.#fullscreenTriangle = createFullScreenTriangle(
            this.#device,
            navigator.gpu.getPreferredCanvasFormat()
        );

        // Pipeline
        const layout = this.#device.createPipelineLayout({
            bindGroupLayouts: [],
        });

        this.#renderPipeline = await this.#device.createRenderPipelineAsync({
            layout,
            vertex: this.#fullscreenTriangle.vertex,
            fragment: this.#fullscreenTriangle.fragment,
            primitive: this.#fullscreenTriangle.primitive,
        });
    }

    destroy() {
        this.#device?.destroy();
        this.#fullscreenTriangle?.destroy();
    }

    start() {
        // Setup render loop
        const loop = (delta: number) => {
            this.#loopId = requestAnimationFrame(loop);

            this.#render(delta);
        };
        loop(0);
    }

    stop() {
        cancelAnimationFrame(this.#loopId);
    }

    #render(_delta: number) {
        // Get next output texture
        const colorTexture = this.#context.getCurrentTexture();
        const colorTextureView = colorTexture.createView();

        this.#encodeCommands(colorTextureView);
    }

    #encodeCommands(colorView: GPUTextureView) {
        const colorAttachement: GPURenderPassColorAttachment = {
            view: colorView,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
        };

        const renderPassDesc: GPURenderPassDescriptor = {
            colorAttachments: [colorAttachement],
        };

        const encoder = this.#device.createCommandEncoder();

        const passEncoder = encoder.beginRenderPass(renderPassDesc);
        passEncoder.setPipeline(this.#renderPipeline);
        passEncoder.setViewport(
            0,
            0,
            this.#size.width,
            this.#size.height,
            0,
            1
        );
        passEncoder.setScissorRect(0, 0, this.#size.width, this.#size.height);
        this.#fullscreenTriangle.draw(passEncoder);
        passEncoder.end();

        this.#device.queue.submit([encoder.finish()]);
    }
}

export { Renderer };
