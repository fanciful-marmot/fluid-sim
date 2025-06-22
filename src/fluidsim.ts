import { createFullScreenTriangle } from './utils/fullscreenTriangle';

import fluidSimShaderCode from './shaders/fluid-sim.wgsl?raw';

class FluidSim {
    #device: GPUDevice;
    #size: [number, number];

    #diffusePass: ReturnType<typeof createFullScreenTriangle>;
    #diffusePipeline: GPURenderPipeline;

    #advectPass: ReturnType<typeof createFullScreenTriangle>;
    #advectPipeline: GPURenderPipeline;

    // Need ping-pong buffers to track velocity and density
    #bindGroups: Array<{
        bindGroup: GPUBindGroup;
        view: GPUTextureView;
        texture: GPUTexture; // R=density, G=hor_v, B=ver_v
    }>;
    #pingpong: 0 | 1 = 0;

    constructor(device: GPUDevice, width: number, height: number) {
        this.#device = device;
        this.#size = [width, height];
        const module = this.#device.createShaderModule({
            code: fluidSimShaderCode,
        });
        this.#diffusePass = createFullScreenTriangle(device, 'rgba32float', {
            module,
            entryPoint: 'fluid_diffuse',
        });
        this.#advectPass = createFullScreenTriangle(device, 'rgba32float', {
            module,
            entryPoint: 'fluid_advect',
        });
    }

    async init() {
        const [w, h] = this.#size;

        // Create initial data
        const fieldData = new Float32Array(w * h * 4);
        for (let i = 0; i < w * h * 4; i += 4) {
            fieldData[i + 0] = Math.random();
            fieldData[i + 1] = Math.sin(i / h / 16.0);
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
        const sampler = this.#device.createSampler({
            addressModeU: 'repeat',
            addressModeV: 'repeat',
        });
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

        this.#diffusePipeline = await this.#device.createRenderPipelineAsync({
            label: 'Fluid Sim Diffusion',
            layout,
            vertex: this.#diffusePass.vertex,
            fragment: this.#diffusePass.fragment,
            primitive: this.#diffusePass.primitive,
        });
        this.#advectPipeline = await this.#device.createRenderPipelineAsync({
            label: 'Fluid Sim Advect',
            layout,
            vertex: this.#advectPass.vertex,
            fragment: this.#advectPass.fragment,
            primitive: this.#advectPass.primitive,
        });
    }

    destroy() {
        this.#diffusePass.destroy();
        this.#advectPass.destroy();
    }

    getOutputBindGroup(): GPUBindGroup {
        return this.#bindGroups[this.#pingpong].bindGroup;
    }

    encodePass(encoder: GPUCommandEncoder) {
        // Encode the diffusion step
        for (let k = 0; k < 20; k++) {
            const pass = encoder.beginRenderPass({
                label: `FluidSim Diffusion Step ${k}`,
                colorAttachments: [
                    {
                        view: this.#bindGroups[(this.#pingpong + 1) % 2].view,
                        clearValue: { r: 0, g: 0, b: 0, a: 1 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            });
            pass.setPipeline(this.#diffusePipeline);
            pass.setViewport(0, 0, this.#size[0], this.#size[1], 0, 1);
            pass.setScissorRect(0, 0, this.#size[0], this.#size[1]);
            pass.setBindGroup(0, this.#bindGroups[this.#pingpong].bindGroup);
            this.#diffusePass.draw(pass);
            pass.end();
            this.#pingpong = this.#pingpong === 0 ? 1 : 0;
        }

        // Encode advection
        const pass = encoder.beginRenderPass({
            label: 'FluidSim Advect',
            colorAttachments: [
                {
                    view: this.#bindGroups[(this.#pingpong + 1) % 2].view,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });
        pass.setPipeline(this.#advectPipeline);
        pass.setViewport(0, 0, this.#size[0], this.#size[1], 0, 1);
        pass.setScissorRect(0, 0, this.#size[0], this.#size[1]);
        pass.setBindGroup(0, this.#bindGroups[this.#pingpong].bindGroup);
        this.#advectPass.draw(pass);
        pass.end();
        this.#pingpong = this.#pingpong === 0 ? 1 : 0;
    }
}

export { FluidSim };
