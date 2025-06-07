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
        0.0, // TR
    ]),
    uvs: new Float32Array([
        3.0,
        1.0, // BR
        0.0,
        1.0, // BL
        0.0,
        -3.0, // TR
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

export { fullscreenTriangle };
