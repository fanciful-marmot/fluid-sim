import { createBuffer } from './webgpu';
import basicShader from '../shaders/fullscreen-triangle.wgsl?raw';

const fullscreenTriangle = {
    vertices: new Float32Array([
        3.0,
        -1.0,
        0.0, // BR
        -1.0,
        -1.0,
        0.0, // BL
        -1.0,
        3.0,
        0.0, // TL
    ]),
    uvs: new Float32Array([
        2.0,
        1.0, // BR
        0.0,
        1.0, // BL
        0.0,
        -1.0, // TL
    ]),
    colors: new Float32Array([
        3.0,
        0.0,
        0.0, // 🔴
        0.0,
        1.0,
        0.0, // 🟢
        0.0,
        0.0,
        3.0, // 🔵
    ]),
    indices: new Uint16Array([0, 1, 2]),
};

const createFullScreenTriangle = (
    device: GPUDevice,
    format: GPUTextureFormat,
    shader?: {
        module: GPUShaderModule;
        entryPoint: string;
    }
) => {
    const buffers = {
        uv: createBuffer(device, fullscreenTriangle.uvs, GPUBufferUsage.VERTEX),
        position: createBuffer(
            device,
            fullscreenTriangle.vertices,
            GPUBufferUsage.VERTEX
        ),
        index: createBuffer(
            device,
            fullscreenTriangle.indices,
            GPUBufferUsage.INDEX
        ),
    };

    const module = device.createShaderModule({ code: basicShader });

    const vertex: GPUVertexState = {
        module,
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
            // UV
            {
                attributes: [
                    {
                        shaderLocation: 1,
                        offset: 0,
                        format: 'float32x2',
                    },
                ],
                arrayStride: 4 * 2,
                stepMode: 'vertex',
            },
        ],
    };

    const fragment: GPUFragmentState = {
        module: shader?.module ?? module,
        entryPoint: shader?.entryPoint ?? 'fs_main',
        targets: [
            {
                format,
            },
        ],
    };

    return {
        buffers,
        vertex,
        fragment,
        primitive: {
            frontFace: 'cw' as const,
            cullMode: 'none' as const,
            topology: 'triangle-list' as const,
        },
        draw(encoder: GPURenderPassEncoder) {
            const { position, uv, index } = buffers;
            encoder.setVertexBuffer(0, position);
            encoder.setVertexBuffer(1, uv);
            encoder.setIndexBuffer(index, 'uint16');
            encoder.drawIndexed(3);
        },
        destroy() {
            buffers.uv.destroy();
            buffers.index.destroy();
            buffers.position.destroy();
        },
    };
};

export { createFullScreenTriangle };
