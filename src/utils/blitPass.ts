import { createFullScreenTriangle } from './fullscreenTriangle';
import blitShader from '../shaders/blit.wgsl?raw';

class BlitPass {
    #size: [number, number] = [1, 1];
    #device: GPUDevice;
    #context: GPUCanvasContext;
    #fullscreenTriangle: ReturnType<typeof createFullScreenTriangle>;
    #pipeline: GPURenderPipeline;

    constructor(
        device: GPUDevice,
        context: GPUCanvasContext,
        width: number,
        height: number,
        format: GPUTextureFormat
    ) {
        this.#device = device;
        this.#context = context;
        this.#size = [width, height];

        const module = device.createShaderModule({
            code: blitShader,
        });
        this.#fullscreenTriangle = createFullScreenTriangle(device, format, {
            module,
            entryPoint: 'blit_main',
        });
    }

    async init() {
        const bindGroupLayout = this.#device.createBindGroupLayout({
            label: 'BlitBindGroupLayout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
            ],
        });
        const pipelineLayoutDesc = { bindGroupLayouts: [bindGroupLayout] };
        const pipelineLayout =
            this.#device.createPipelineLayout(pipelineLayoutDesc);

        this.#pipeline = await this.#device.createRenderPipelineAsync({
            label: 'BlitPipeline',
            layout: pipelineLayout,
            vertex: this.#fullscreenTriangle.vertex,
            fragment: this.#fullscreenTriangle.fragment,
            primitive: this.#fullscreenTriangle.primitive,
        });
    }

    destroy() {
        this.#fullscreenTriangle.destroy();
    }

    // TODO: A better way of providing the texture than just bindgroup
    encodePass(encoder: GPUCommandEncoder, bindGroup: GPUBindGroup) {
        let colorAttachment: GPURenderPassColorAttachment = {
            view: this.#context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
        };

        const renderPassDesc: GPURenderPassDescriptor = {
            label: 'BlitPass',
            colorAttachments: [colorAttachment],
        };

        // Encode drawing commands
        const passEncoder = encoder.beginRenderPass(renderPassDesc);
        passEncoder.setPipeline(this.#pipeline);
        passEncoder.setViewport(0, 0, this.#size[0], this.#size[1], 0, 1);
        passEncoder.setScissorRect(0, 0, this.#size[0], this.#size[1]);
        passEncoder.setBindGroup(0, bindGroup);
        this.#fullscreenTriangle.draw(passEncoder);
        passEncoder.end();
    }
}

export { BlitPass };
