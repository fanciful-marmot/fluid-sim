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
        bindGroups: {
            densityAdvect: GPUBindGroup;
            velocityAdvect: GPUBindGroup;
            densityDiffusion: GPUBindGroup;
            output: GPUBindGroup;
        };
        data: {
            density: {
                texture: GPUTexture;
                view: GPUTextureView;
            };
            velocity: {
                texture: GPUTexture;
                view: GPUTextureView;
            };
            pressure: {
                texture: GPUTexture;
                view: GPUTextureView;
            };
            divergence: {
                texture: GPUTexture;
                view: GPUTextureView;
            };
        };
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
        const densityFieldData = new Float32Array(w * h * 4);
        for (let x = w / 4; x < (3 * w) / 4; x++) {
            for (let y = h / 4; y < (3 * h) / 4; y++) {
                densityFieldData[(x + y * w) * 4] = 1;
            }
        }
        const velocityFieldData = new Float32Array(w * h * 4);
        for (let i = 0; i < w * h * 4; i += 4) {
            velocityFieldData[i + 0] = 0;
            velocityFieldData[i + 1] = 2;
            velocityFieldData[i + 2] = 1;
            velocityFieldData[i + 3] = 0;
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
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
            ],
        });
        const outputBindGroupLayout = this.#device.createBindGroupLayout({
            label: 'Output',
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
            const densityTexture = this.#device.createTexture(fieldDescriptor);
            const densityView = densityTexture.createView();
            this.#device.queue.writeTexture(
                { texture: densityTexture },
                densityFieldData,
                { bytesPerRow: w * 4 * 4 },
                { width: w, height: h }
            );

            const velocityTexture = this.#device.createTexture(fieldDescriptor);
            const velocityView = velocityTexture.createView();
            this.#device.queue.writeTexture(
                { texture: velocityTexture },
                velocityFieldData,
                { bytesPerRow: w * 4 * 4 },
                { width: w, height: h }
            );

            const pressureTexture = this.#device.createTexture(fieldDescriptor);
            const pressureView = pressureTexture.createView();
            // this.#device.queue.writeTexture(
            //     { texture: pressureTexture },
            //     pressureFieldData,
            //     { bytesPerRow: w * 4 * 4 },
            //     { width: w, height: h }
            // );

            const divergenceTexture =
                this.#device.createTexture(fieldDescriptor);
            const divergenceView = divergenceTexture.createView();
            // this.#device.queue.writeTexture(
            //     { texture: divergenceTexture },
            //     divergenceFieldData,
            //     { bytesPerRow: w * 4 * 4 },
            //     { width: w, height: h }
            // );

            const bindGroups = {
                densityAdvect: this.#device.createBindGroup({
                    label: `Sim Compute ${i} - densityAdvect`,
                    layout: bindGroupLayout,
                    entries: [
                        {
                            binding: 0,
                            resource: sampler,
                        },
                        {
                            binding: 1,
                            resource: densityView,
                        },
                        {
                            binding: 2,
                            resource: velocityView,
                        },
                    ],
                }),
                velocityAdvect: this.#device.createBindGroup({
                    label: `Sim Compute ${i} - velocityAdvect`,
                    layout: bindGroupLayout,
                    entries: [
                        {
                            binding: 0,
                            resource: sampler,
                        },
                        {
                            binding: 1,
                            resource: velocityView,
                        },
                        {
                            binding: 2,
                            resource: velocityView,
                        },
                    ],
                }),
                densityDiffusion: this.#device.createBindGroup({
                    label: `Sim Compute ${i} - densityAdvect`,
                    layout: bindGroupLayout,
                    entries: [
                        {
                            binding: 0,
                            resource: sampler,
                        },
                        {
                            binding: 1,
                            resource: densityView,
                        },
                        {
                            binding: 2,
                            resource: velocityView,
                        },
                    ],
                }),
                output: this.#device.createBindGroup({
                    label: `Sim Compute ${i} - Output`,
                    layout: outputBindGroupLayout,
                    entries: [
                        {
                            binding: 0,
                            resource: sampler,
                        },
                        {
                            binding: 1,
                            resource: densityView,
                        },
                    ],
                }),
            };

            return {
                bindGroups,
                data: {
                    density: {
                        texture: densityTexture,
                        view: densityView,
                    },
                    velocity: {
                        texture: velocityTexture,
                        view: velocityView,
                    },
                    pressure: {
                        texture: pressureTexture,
                        view: pressureView,
                    },
                    divergence: {
                        texture: divergenceTexture,
                        view: divergenceView,
                    },
                },
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
        return this.#bindGroups[this.#pingpong].bindGroups.output;
    }

    #swap(): void {
        this.#pingpong = this.#pingpong === 0 ? 1 : 0;
    }

    encodePass(encoder: GPUCommandEncoder) {
        // Steps:
        // advect
        // diffuse
        // addForces
        // computePressure
        // subtractPressureGradient

        // Encode advection
        {
            const pass = encoder.beginRenderPass({
                label: 'FluidSim density advect',
                colorAttachments: [
                    {
                        view: this.#bindGroups[(this.#pingpong + 1) % 2].data
                            .density.view,
                        clearValue: { r: 0, g: 0, b: 0, a: 1 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            });
            pass.setPipeline(this.#advectPipeline);
            pass.setViewport(0, 0, this.#size[0], this.#size[1], 0, 1);
            pass.setScissorRect(0, 0, this.#size[0], this.#size[1]);
            pass.setBindGroup(
                0,
                this.#bindGroups[this.#pingpong].bindGroups.densityAdvect
            );
            this.#advectPass.draw(pass);
            pass.end();
        }
        // {
        //     const pass = encoder.beginRenderPass({
        //         label: 'FluidSim velocity advect',
        //         colorAttachments: [
        //             {
        //                 view: this.#bindGroups[(this.#pingpong + 1) % 2].data
        //                     .velocity.view,
        //                 clearValue: { r: 0, g: 0, b: 0, a: 1 },
        //                 loadOp: 'clear',
        //                 storeOp: 'store',
        //             },
        //         ],
        //     });
        //     pass.setPipeline(this.#advectPipeline);
        //     pass.setViewport(0, 0, this.#size[0], this.#size[1], 0, 1);
        //     pass.setScissorRect(0, 0, this.#size[0], this.#size[1]);
        //     pass.setBindGroup(
        //         0,
        //         this.#bindGroups[this.#pingpong].bindGroups.velocityAdvect
        //     );
        //     this.#advectPass.draw(pass);
        //     pass.end();
        // }
        this.#swap();

        // Encode the diffusion step
        for (let k = 0; k < 20; k++) {
            const pass = encoder.beginRenderPass({
                label: `FluidSim Diffusion Step ${k}`,
                colorAttachments: [
                    {
                        view: this.#bindGroups[(this.#pingpong + 1) % 2].data
                            .density.view,
                        clearValue: { r: 0, g: 0, b: 0, a: 1 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            });
            pass.setPipeline(this.#diffusePipeline);
            pass.setViewport(0, 0, this.#size[0], this.#size[1], 0, 1);
            pass.setScissorRect(0, 0, this.#size[0], this.#size[1]);
            pass.setBindGroup(
                0,
                this.#bindGroups[this.#pingpong].bindGroups.densityDiffusion
            );
            this.#diffusePass.draw(pass);
            pass.end();

            this.#swap();
        }
    }
}

export { FluidSim };
