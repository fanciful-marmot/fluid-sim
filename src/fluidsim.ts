import { createFullScreenTriangle } from './utils/fullscreenTriangle';

import fluidSimShaderCode from './shaders/fluid-sim.wgsl?raw';

class FluidSim {
    #device: GPUDevice;
    #size: [number, number];

    #fullscreenTriangle: ReturnType<typeof createFullScreenTriangle>;

    // Need ping-pong buffers to track velocity and density
    #bindGroups: Array<{
        bindGroup: GPUBindGroup;
        view: GPUTextureView;
        texture: GPUTexture; // R=density, G=hor_v, B=ver_v
    }>;
    #pipeline: GPURenderPipeline;
    #pingpong: 0 | 1 = 0;

    constructor(device: GPUDevice, width: number, height: number) {
        this.#device = device;
        this.#size = [width, height];
        this.#fullscreenTriangle = createFullScreenTriangle(
            device,
            'rgba32float',
            {
                module: this.#device.createShaderModule({
                    code: fluidSimShaderCode,
                }),
                entryPoint: 'fluid_main',
            }
        );
    }

    async init() {
        const [w, h] = this.#size;

        // Create initial data
        const fieldData = new Float32Array(w * h * 4);
        for (let i = 0; i < w * h * 4; i += 4) {
            fieldData[i + 0] = Math.random();
            fieldData[i + 1] = 0;
            fieldData[i + 2] = 0;
            fieldData[i + 3] = 0;
        }

        // Update pipeline
        const bindGroupLayout = this.#device.createBindGroupLayout({
            label: 'Sim Update',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {
                        type: 'filtering',
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
            ],
        });

        const fieldDescriptor: GPUTextureDescriptor = {
            label: 'FluidSimTexture',
            size: [w, h, 1],
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.TEXTURE_BINDING,
            format: 'rgba32float',
        };
        const sampler = this.#device.createSampler();
        this.#bindGroups = new Array(2).fill(0).map((_, i) => {
            const texture = this.#device.createTexture(fieldDescriptor);
            const view = texture.createView();

            this.#device.queue.writeTexture(
                { texture },
                fieldData,
                { bytesPerRow: w * 4 * 4 },
                { width: w, height: h }
            );

            return {
                bindGroup: this.#device.createBindGroup({
                    label: `Sim Compute ${i}`,
                    layout: bindGroupLayout,
                    entries: [
                        {
                            binding: 0,
                            resource: sampler,
                        },
                        {
                            binding: 1,
                            resource: view,
                        },
                    ],
                }),
                texture,
                view,
            };
        });

        // Pipeline
        const layout = this.#device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        });

        this.#pipeline = await this.#device.createRenderPipelineAsync({
            layout,
            vertex: this.#fullscreenTriangle.vertex,
            fragment: this.#fullscreenTriangle.fragment,
            primitive: this.#fullscreenTriangle.primitive,
        });
    }

    destroy() {
        this.#fullscreenTriangle.destroy();
    }

    getOutputBindGroup(): GPUBindGroup {
        return this.#bindGroups[this.#pingpong].bindGroup;
    }

    encodePass(encoder: GPUCommandEncoder) {
        // Encode update pass
        const pass = encoder.beginRenderPass({
            label: 'FluidSim',
            colorAttachments: [
                {
                    view: this.#bindGroups[(this.#pingpong + 1) % 2].view,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });
        pass.setPipeline(this.#pipeline);
        pass.setViewport(0, 0, this.#size[0], this.#size[1], 0, 1);
        pass.setScissorRect(0, 0, this.#size[0], this.#size[1]);
        pass.setBindGroup(0, this.#bindGroups[this.#pingpong].bindGroup);
        this.#fullscreenTriangle.draw(pass);
        pass.end();

        this.#pingpong = this.#pingpong === 0 ? 1 : 0;
    }
}

export { FluidSim };
