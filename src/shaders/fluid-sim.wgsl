struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
};

@group(0) @binding(0) var fieldSampler: sampler;
@group(0) @binding(1) var fieldTexture: texture_2d<f32>;

@fragment
fn fluid_main(in: VertexOutput) -> @location(0) vec4f {
    var pixelStep = vec2(1.0) / vec2f(textureDimensions(fieldTexture));

    var data = textureSample(fieldTexture, fieldSampler, in.uv);

    var density = data.r;

    // TODO Simulate
    
    var color_out = max(vec4f(), vec4f(density - 0.001, data.gba));

    return color_out;
}
