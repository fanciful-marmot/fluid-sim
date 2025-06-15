import { FluidSim } from './fluidsim';
import { BlitPass } from './utils/blitPass';
import { createFullScreenTriangle } from './utils/fullscreenTriangle';
import { getDevice } from './utils/webgpu';

class Renderer {
    #size: { width: number; height: number } = { width: 1, height: 1 };

    #device: GPUDevice | null = null;
    #context: GPUCanvasContext;
    #loopId: number;

    #renderPipeline: GPURenderPipeline | null = null;
    #blitPass: BlitPass;
    #fluidSim: FluidSim;

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

        const { width, height } = this.#size;

        this.#blitPass = new BlitPass(
            this.#device,
            this.#context,
            width,
            height,
            navigator.gpu.getPreferredCanvasFormat()
        );

        this.#fluidSim = new FluidSim(this.#device, 100, 100);

        await Promise.all([this.#blitPass.init(), this.#fluidSim.init()]);
    }

    destroy() {
        this.#device?.destroy();
        this.#blitPass?.destroy();
        this.#fluidSim?.destroy();
    }

    start() {
        // Setup render loop
        const loop = (delta: number) => {
            // this.#loopId = requestAnimationFrame(loop);

            this.#render(delta);
        };
        loop(0);
    }

    stop() {
        cancelAnimationFrame(this.#loopId);
    }

    #render(_delta: number) {
        const encoder = this.#device.createCommandEncoder();

        this.#fluidSim.encodePass(encoder);
        this.#blitPass.encodePass(encoder, this.#fluidSim.getOutputBindGroup());
        this.#device.queue.submit([encoder.finish()]);
    }
}

export { Renderer };
