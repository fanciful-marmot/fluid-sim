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
    var dt = 1.0 / dimensions.x;
    var dt0 = dt * dimensions.x;
    var ij: vec2f = floor(in.uv / pixelStep);

    var x = ij.x - dt0 * data.g;

    // TODO: Since the field repeats this doesn't seem needed?
    // x = max(0.5, min(dimensions.x - 0.5, x));

    var i0 = floor(x);
    var i1 = i0 + 1.0;

    var y = ij.y - dt0 * data.b;

    // TODO: Since the field repeats this doesn't seem needed?
    // y = max(0.5, min(dimensions.y - 0.5, y));

    var j0 = floor(y);
    var j1 = j0 + 1.0;

    var s1 = x - i0;
    var s0 = 1.0 - s1;

    var t1 = y - j0;
    var t0 = 1.0 - t1;

    var p00 = getTXY(vec2f(i0,j0), dimensions).r;
    var p01 = getTXY(vec2f(i0,j1), dimensions).r;
    var p10 = getTXY(vec2f(i1,j0), dimensions).r;
    var p11 = getTXY(vec2f(i1,j1), dimensions).r;

    var density = 
        s0 * (t0 * p00 + t1 * p01) +
        s1 * (t0 * p10 + t1 * p11);

    var color_out = vec4f(density, data.gba);

    return color_out;
}
