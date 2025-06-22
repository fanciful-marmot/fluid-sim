struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
};

@group(0) @binding(0) var fieldSampler: sampler;
@group(0) @binding(1) var fieldTexture: texture_2d<f32>;

@fragment
fn blit_main(in: VertexOutput) -> @location(0) vec4f {
    var rgb = vec3f(textureSample(fieldTexture, fieldSampler, in.uv).r, 0.0, 0.0);
    return vec4(rgb, 1.0);
}
