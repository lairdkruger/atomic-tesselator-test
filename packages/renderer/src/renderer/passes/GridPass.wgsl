// volumetric grid: line segments expanded to screen-space quads

struct CameraUniforms {
    view_matrix: mat4x4<f32>,
    projection_matrix: mat4x4<f32>,
    view_projection_matrix: mat4x4<f32>,
    view_matrix_inverse: mat4x4<f32>,
    projection_matrix_inverse: mat4x4<f32>,
    position: vec4<f32>,
    near: f32,
    far: f32,
};

struct GridConfig {
    color: vec4<f32>,
    line_width: f32,
    viewport_width: f32,
    viewport_height: f32,
    _pad: f32,
};

struct LineSegment {
    a: vec3<f32>,
    _pad_a: f32,
    b: vec3<f32>,
    _pad_b: f32,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(1) @binding(0) var<uniform> config: GridConfig;
@group(2) @binding(0) var<storage, read> lines: array<LineSegment>;

// 6 vertices per line segment (2 triangles forming a quad)
const QUAD_OFFSETS = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, 1.0),
);

@vertex
fn vs_main(
    @builtin(vertex_index) vertex_index: u32,
    @builtin(instance_index) instance_index: u32,
) -> VertexOutput {
    let line = lines[instance_index];
    let quad = QUAD_OFFSETS[vertex_index % 6u];

    // lerp between endpoints
    let t = quad.y;
    let world_pos = mix(line.a, line.b, vec3<f32>(t));

    let clip_a = camera.view_projection_matrix * vec4<f32>(line.a, 1.0);
    let clip_b = camera.view_projection_matrix * vec4<f32>(line.b, 1.0);
    let clip = mix(clip_a, clip_b, t);

    // screen-space direction of line for perpendicular offset
    let ndc_a = clip_a.xy / clip_a.w;
    let ndc_b = clip_b.xy / clip_b.w;
    let screen_a = vec2<f32>(ndc_a.x * config.viewport_width, ndc_a.y * config.viewport_height) * 0.5;
    let screen_b = vec2<f32>(ndc_b.x * config.viewport_width, ndc_b.y * config.viewport_height) * 0.5;

    let dir = screen_b - screen_a;
    let len = length(dir);
    var perp = vec2<f32>(0.0);
    if (len > 0.001) {
        let n = normalize(dir);
        perp = vec2<f32>(-n.y, n.x);
    }

    // offset in clip space
    let pixel_offset = perp * quad.x * config.line_width;
    let clip_offset = vec2<f32>(
        pixel_offset.x * 2.0 / config.viewport_width,
        pixel_offset.y * 2.0 / config.viewport_height,
    );

    var output: VertexOutput;
    output.position = vec4<f32>(clip.xy + clip_offset * clip.w, clip.z, clip.w);
    return output;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    return config.color;
}
