struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
};

@group(0) @binding(0) var fieldSampler: sampler;
@group(0) @binding(1) var fieldTexture: texture_2d<f32>;
@group(0) @binding(2) var fieldTexture2: texture_2d<f32>;

fn getTUV(uv: vec2f, field: texture_2d<f32>) -> vec4f {
    return textureSample(field, fieldSampler, uv);
}

@fragment
fn fluid_advect(in: VertexOutput) -> @location(0) vec4f {
    var dimensions = vec2f(textureDimensions(fieldTexture));
    var pixelStep = vec2(1.0) / dimensions;

    var velocity = getTUV(in.uv, fieldTexture2);

    // Advect
    var dt = 1.0 / 144.0;

    // Step backwards in time
    var xy = in.uv - dt * velocity.rg;

    // Interpolate
    return getTUV(xy, fieldTexture);
}

@fragment
fn fluid_diffuse(in: VertexOutput) -> @location(0) vec4f {
    var dimensions = vec2f(textureDimensions(fieldTexture));
    var pixelStep = vec2(1.0) / dimensions;

    const DIFF = 0.00008;

    var data = getTUV(in.uv, fieldTexture);

    // Diffuse
    var dt = 1.0 / 144.0;
    var a = dt * DIFF * dimensions.x * dimensions.y;
    var density = data.r + a * (
        getTUV(in.uv + pixelStep * vec2(-1.0, 0.0), fieldTexture).r +
        getTUV(in.uv + pixelStep * vec2(1.0, 0.0), fieldTexture).r +
        getTUV(in.uv + pixelStep * vec2(0.0, 1.0), fieldTexture).r +
        getTUV(in.uv + pixelStep * vec2(0.0, -1.0), fieldTexture).r -
        4.0 * data.r
    );

    var color_out = vec4f(density, data.gba);

    return color_out;
}

// @fragment
// fn fluid_divergence(in: VertexOutput) -> @location(0) vec4f {
//     var dimensions = vec2f(textureDimensions(fieldTexture));
//     var pixelStep = vec2(1.0) / dimensions;

//     var data = getTUV(in.uv);

//     var divergence = 0.5 * pixelStep.x * (
//         getTUV(in.uv + pixelStep * vec2(1.0, 0.0)).g -
//         getTUV(in.uv + pixelStep * vec2(-1.0, 0.0)).g +
//         getTUV(in.uv + pixelStep * vec2(0.0, 1.0)).b -
//         getTUV(in.uv + pixelStep * vec2(0.0, -1.0)).b
//     );

//     // Write divergence into alpha temporarily
//     return vec4f(data.rgb, divergence);
// }

// @fragment
// fn fluid_pressure(in: VertexOutput) -> @location(0) vec4f {
//     var dimensions = vec2f(textureDimensions(fieldTexture));
//     var pixelStep = vec2(1.0) / dimensions;

//     const DIFF = 0.00008;

//     var data = getTUV(in.uv);

//     // Diffuse
//     var dt = 1.0 / 144.0;
//     var a = dt * DIFF * dimensions.x * dimensions.y;
//     var density = data.r + a * (
//         getTUV(in.uv + pixelStep * vec2(-1.0, 0.0)).r +
//         getTUV(in.uv + pixelStep * vec2(1.0, 0.0)).r +
//         getTUV(in.uv + pixelStep * vec2(0.0, 1.0)).r +
//         getTUV(in.uv + pixelStep * vec2(0.0, -1.0)).r -
//         4.0 * data.r
//     );

//     var color_out = vec4f(density, data.gba);

//     return color_out;
// }


// @fragment
// fn fluid_subtract_gradient(in: VertexOutput) -> @location(0) vec4f {
//     var dimensions = vec2f(textureDimensions(fieldTexture));
//     var pixelStep = vec2(1.0) / dimensions;

//     var data = getTUV(in.uv);

//     var divergence = 0.5 * pixelStep.x * (
//         getTUV(in.uv + pixelStep * vec2(1.0, 0.0)).g -
//         getTUV(in.uv + pixelStep * vec2(-1.0, 0.0)).g +
//         getTUV(in.uv + pixelStep * vec2(0.0, 1.0)).b -
//         getTUV(in.uv + pixelStep * vec2(0.0, -1.0)).b
//     );

//     // Write divergence into alpha temporarily
//     return vec4f(data.rgb, divergence);
// }
