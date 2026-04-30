// point cloud: billboarded triangles from interleaved ion data

const FIELD_COUNT: u32 = 11u;
const PALETTE_SIZE: u32 = 128u;

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

// palette entry: rgb = color, scale = point size multiplier
struct PaletteEntry {
    r: f32,
    g: f32,
    b: f32,
    visibility: f32,
};

struct PointCloudConfig {
    point_size: f32,
    ion_count: u32,
    viewport_width: f32,
    viewport_height: f32,
    palette: array<PaletteEntry, 128>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) @interpolate(flat) mq_index: u32,
};

@group(0) @binding(0) var<storage, read> ion_data: array<f32>;
@group(1) @binding(0) var<uniform> camera: CameraUniforms;
@group(2) @binding(0) var<uniform> config: PointCloudConfig;

// oversized triangle (3 vertices)
const TRI_OFFSETS = array<vec2<f32>, 3>(
    vec2<f32>(-1.732, -1.0),
    vec2<f32>(1.732, -1.0),
    vec2<f32>(0.0, 2.0),
);

@vertex
fn vs_main(
    @builtin(vertex_index) vertex_index: u32,
    @builtin(instance_index) instance_index: u32,
) -> VertexOutput {
    let base = instance_index * FIELD_COUNT;
    let pos = vec3<f32>(
        ion_data[base],
        ion_data[base + 1u],
        ion_data[base + 2u],
    );
    let mq = ion_data[base + 3u];

    let clip = camera.view_projection_matrix * vec4<f32>(pos, 1.0);

    let mq_index = u32(clamp(round(mq), 0.0, 127.0));
    let entry = config.palette[mq_index];

    let corner = TRI_OFFSETS[vertex_index % 3u];
    let attenuation = config.point_size * entry.visibility / max(clip.w, 0.001);
    let offset = corner * attenuation;

    var output: VertexOutput;
    output.position = vec4<f32>(
        clip.x + offset.x * clip.w,
        clip.y + offset.y * clip.w,
        clip.z,
        clip.w,
    );
    output.uv = corner;
    output.mq_index = mq_index;
    return output;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Would be nice to draw circles, but disables early Z testing - big performance hit.
    //if dot(in.uv, in.uv) > 1.0 {
    //    discard;
    //}
    let e = config.palette[in.mq_index];
    return vec4<f32>(e.r, e.g, e.b, 1.0);
}
