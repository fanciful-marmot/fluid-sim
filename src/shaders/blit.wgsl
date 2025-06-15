struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
};

@group(0) @binding(0) var fieldSampler: sampler;
@group(0) @binding(1) var fieldTexture: texture_2d<f32>;

@fragment
fn blit_main(in: VertexOutput) -> @location(0) vec4f {
    return vec4(textureSample(fieldTexture, fieldSampler, in.uv).rgb, 1.0);
}
