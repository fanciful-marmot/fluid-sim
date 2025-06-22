struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
};

@group(0) @binding(0) var fieldSampler: sampler;
@group(0) @binding(1) var fieldTexture: texture_2d<f32>;


fn getTUV(uv: vec2f) -> vec4f {
    return textureSample(fieldTexture, fieldSampler, uv);
}

fn getTXY(xy: vec2f, dimensions: vec2f) -> vec4f {
    return getTUV((xy + vec2f(0.5)) / dimensions);
}

@fragment
fn fluid_diffuse(in: VertexOutput) -> @location(0) vec4f {
    var dimensions = vec2f(textureDimensions(fieldTexture));
    var pixelStep = vec2(1.0) / dimensions;

    var data = getTUV(in.uv);

    // Diffuse
    var dt = 1.0 / 144.0;
    var diff = 0.0001;
    var a = dt * diff * dimensions.x * dimensions.y;
    var density = data.r + a * (
        getTUV(in.uv + pixelStep * vec2(-1.0, 0.0)).r +
        getTUV(in.uv + pixelStep * vec2(1.0, 0.0)).r +
        getTUV(in.uv + pixelStep * vec2(0.0, 1.0)).r +
        getTUV(in.uv + pixelStep * vec2(0.0, -1.0)).r -
        4.0 * data.r
    );

    var color_out = vec4f(density, data.gba);

    return color_out;
}

@fragment
fn fluid_advect(in: VertexOutput) -> @location(0) vec4f {
    var dimensions = vec2f(textureDimensions(fieldTexture));
    var pixelStep = vec2(1.0) / dimensions;

    var data = getTUV(in.uv);

    // Advect
    var dt = 1.0 / 144.0;
    var dt0 = dt * dimensions.x;
    var ij: vec2f = floor(in.uv / pixelStep);

    var x = ij.x - dt0 * data.g;
    var y = ij.y - dt0 * data.b;

    var xy = ij - dt0 * data.gb;

    var ij0 = floor(xy);
    var ij1 = ij0 + 1.0;

    var st1 = xy - ij0;
    var st0 = 1.0 - st1;

    var p00 = getTXY(ij0, dimensions).r;
    var p01 = getTXY(vec2f(ij0.x, ij1.y), dimensions).r;
    var p10 = getTXY(vec2f(ij1.x, ij0.y), dimensions).r;
    var p11 = getTXY(ij1, dimensions).r;

    var density = 
        st0.x * (st0.y * p00 + st1.y * p01) +
        st1.x * (st0.y * p10 + st1.y * p11);

    var color_out = vec4f(density, data.gba);

    return color_out;
}
