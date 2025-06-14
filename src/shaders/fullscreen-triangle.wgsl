struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@location(0) pos: vec3<f32>, @location(1) uv: vec2<f32>) -> VSOut {
    var vs_out: VSOut;
    vs_out.position = vec4<f32>(pos, 1.0);
    vs_out.uv = uv;
    return vs_out;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(uv, 1.0, 1.0);
}
