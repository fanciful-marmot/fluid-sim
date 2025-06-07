import { fullscreenTriangle } from './utils/fullscreenTriangle';
import { createBuffer, getDevice } from './utils/webgpu';
import basicShader from './shaders/basic.wgsl?raw';

class Renderer {
    #size: { width: number; height: number } = { width: 1, height: 1 };

    #device: GPUDevice | null = null;
    #context: GPUCanvasContext;
    #loopId: number;

    #buffers: {
        position: GPUBuffer;
        color: GPUBuffer;
        index: GPUBuffer;
    } | null = null;
    #shaders: {
        basic: GPUShaderModule;
    } | null = null;
    #renderPipeline: GPURenderPipeline | null = null;

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

        this.#buffers = {
            color: createBuffer(
                this.#device,
                fullscreenTriangle.colors,
                GPUBufferUsage.VERTEX
            ),
            position: createBuffer(
                this.#device,
                fullscreenTriangle.vertices,
                GPUBufferUsage.VERTEX
            ),
            index: createBuffer(
                this.#device,
                fullscreenTriangle.indices,
                GPUBufferUsage.INDEX
            ),
        };

        this.#shaders = {
            basic: this.#device.createShaderModule({ code: basicShader }),
        };

        // Pipeline
        const layout = this.#device.createPipelineLayout({
            bindGroupLayouts: [],
        });

        const vertex: GPUVertexState = {
            module: this.#shaders.basic,
            entryPoint: 'vs_main',
            buffers: [
                // Position
                {
                    attributes: [
                        {
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x3',
                        },
                    ],
                    arrayStride: 4 * 3,
                    stepMode: 'vertex',
                },
                // Color
                {
                    attributes: [
                        {
                            shaderLocation: 1,
                            offset: 0,
                            format: 'float32x3',
                        },
                    ],
                    arrayStride: 4 * 3,
                    stepMode: 'vertex',
                },
            ],
        };

        const fragment: GPUFragmentState = {
            module: this.#shaders.basic,
            entryPoint: 'fs_main',
            targets: [
                {
                    format: navigator.gpu.getPreferredCanvasFormat(),
                },
            ],
        };

        this.#renderPipeline = await this.#device.createRenderPipelineAsync({
            layout,
            vertex,
            fragment,
            primitive: {
                frontFace: 'cw',
                cullMode: 'none',
                topology: 'triangle-list',
            },
        });
    }

    destroy() {
        this.#device?.destroy();
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
        passEncoder.setVertexBuffer(0, this.#buffers.position);
        passEncoder.setVertexBuffer(1, this.#buffers.color);
        passEncoder.setIndexBuffer(this.#buffers.index, 'uint16');
        passEncoder.drawIndexed(3);
        passEncoder.end();

        this.#device.queue.submit([encoder.finish()]);
    }
}

export { Renderer };
