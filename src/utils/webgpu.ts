const getDevice = async () => {
    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
    });

    return await adapter.requestDevice({
        label: 'WebGPU Sim Device',
        requiredFeatures: ['float32-filterable'] as any,
    });
};

const createBuffer = (
    device: GPUDevice,
    arr: Float32Array | Uint16Array,
    usage: GPUBufferUsageFlags
): GPUBuffer => {
    // 📏 Align to 4 bytes (thanks @chrimsonite)
    let desc: GPUBufferDescriptor = {
        size: (arr.byteLength + 3) & ~3,
        usage,
        mappedAtCreation: true,
    };
    let buffer = device.createBuffer(desc);

    const writeArray =
        arr instanceof Uint16Array
            ? new Uint16Array(buffer.getMappedRange())
            : new Float32Array(buffer.getMappedRange());
    writeArray.set(arr);
    buffer.unmap();
    return buffer;
};

export { getDevice, createBuffer };
