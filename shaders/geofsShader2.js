/* DEVELOPER NOTES AS OF 11/12/2026:
This is just a complicated and glorified green screen shader.
It just turns your screen into some flat green color.
Maybe you'll get a different color though, I got green but maybe you'll get yellow or red or something.
That'd be cool.
*/
const ssgiShader = `
uniform sampler2D colorTexture;           // Original scene color texture
uniform sampler2D depthTexture;           // Depth buffer texture
uniform float radius;                     // Sampling radius in world space
uniform float intensity;                  // Intensity of the global illumination effect

varying vec2 v_textureCoordinates;

// Function to reconstruct world position from screen coordinates and depth
vec3 reconstructPosition(vec2 uv) {
    float depth = texture2D(depthTexture, uv).r;
    depth = depth * 2.0 - 1.0;
    vec4 clipSpacePosition = vec4(uv * 2.0 - 1.0, depth, 1.0);
    vec4 viewSpacePosition = czm_inverseProjection * clipSpacePosition;
    vec4 worldPosition = czm_inverseView * viewSpacePosition;
    return worldPosition.xyz / worldPosition.w;
}

vec3 viewToWorldNormal(vec3 normalView) {
    return normalize(mat3(czm_inverseViewProjection) * normalView);
}

vec3 estimateNormal(vec2 uv, float depth) {
    vec2 pixelSize = 1.0 / czm_viewport.zw;
    float c = texture2D(depthTexture, uv).r;
    float l = texture2D(depthTexture, uv - vec2(pixelSize.x, 0.0)).r;
    float r = texture2D(depthTexture, uv + vec2(pixelSize.x, 0.0)).r;
    float t = texture2D(depthTexture, uv + vec2(0.0, pixelSize.y)).r;
    float b = texture2D(depthTexture, uv - vec2(0.0, pixelSize.y)).r;
    
    vec3 center = reconstructPosition(uv);
    vec3 left = reconstructPosition(uv - vec2(pixelSize.x, 0.0));
    vec3 right = reconstructPosition(uv + vec2(pixelSize.x, 0.0));
    vec3 top = reconstructPosition(uv + vec2(0.0, pixelSize.y));
    vec3 bottom = reconstructPosition(uv - vec2(0.0, pixelSize.y));
    
    return normalize(cross(right - left, top - bottom));
}

// Reconstruct normal from depth and convert to world space
vec3 normal_from_depth(vec2 texcoords) {
    vec2 pixelSize = czm_pixelRatio / czm_viewport.zw;
    vec2 offset1   = vec2(0.0, pixelSize.y);
    vec2 offset2   = vec2(pixelSize.x, 0.0);

    float depth    = texture2D(depthTexture, texcoords).r;
    float depth1   = texture2D(depthTexture, texcoords + offset1).r;
    float depth2   = texture2D(depthTexture, texcoords + offset2).r;

    highp vec3 p1  = vec3(offset1, depth1 - depth);
    highp vec3 p2  = vec3(offset2, depth2 - depth);

    // Normal in view space
    highp vec3 normalView = cross(p1, p2);
    normalView.z = -normalView.z;

    // Convert to world space
    return viewToWorldNormal(normalView);
}

// Function to smooth normals and convert to world space
vec3 smoothNormalsFromDepth(vec2 texcoords) {
    vec2 pixelSize = czm_pixelRatio / czm_viewport.zw;
    vec2 offset = 3.0 * pixelSize;
    vec3 sharpNormalC = normal_from_depth(texcoords + vec2(0.0, 0.0));
    vec3 sharpNormalU = normal_from_depth(texcoords + vec2(0.0, offset.y));
    vec3 sharpNormalD = normal_from_depth(texcoords + vec2(0.0, -offset.y));
    vec3 sharpNormalL = normal_from_depth(texcoords + vec2(-offset.x, 0.0));
    vec3 sharpNormalR = normal_from_depth(texcoords + vec2(offset.x, 0.0));

    float angleU = acos(dot(sharpNormalC, sharpNormalU) / length(sharpNormalC) * length(sharpNormalU));
    float angleD = acos(dot(sharpNormalC, sharpNormalD) / length(sharpNormalC) * length(sharpNormalD));
    float angleL = acos(dot(sharpNormalC, sharpNormalL) / length(sharpNormalC) * length(sharpNormalL));
    float angleR = acos(dot(sharpNormalC, sharpNormalR) / length(sharpNormalC) * length(sharpNormalR));

    float totalAngle = (angleU + angleD + angleL + angleR) / 4.0;

    vec3 smoothNormal = (sharpNormalU + sharpNormalD + sharpNormalL + sharpNormalR) / 4.0;

    if (totalAngle >= 0.3) {
        return (sharpNormalC);  // Already in world space from normal_from_depth
    } else {
        return (smoothNormal);  // Already in world space from normal_from_depth
    }
}

// Function to compute the cosine of the angle between two normals
float computeNormalWeight(vec3 normal1, vec3 normal2) {
    return max(dot(normal1, normal2), 0.0);  // Only positive dot product (facing towards)
}

void main() {
    vec3 originalColor = texture2D(colorTexture, v_textureCoordinates).rgb;
    vec3 worldPosition = reconstructPosition(v_textureCoordinates);
    vec3 worldNormal = smoothNormalsFromDepth(v_textureCoordinates);  // Reconstructed normal

    // Global illumination accumulation
    vec3 giColor = vec3(0.0);
    int sampleCount = 0;

    // Poisson disk sample offsets for circular sampling
    vec2 poissonDisk[8];
    poissonDisk[0] = vec2( -0.94201624, -0.39906216 );
    poissonDisk[1] = vec2(  0.94558609, -0.76890725 );
    poissonDisk[2] = vec2( -0.094184101, -0.92938870 );
    poissonDisk[3] = vec2(  0.34495938,  0.29387760 );
    poissonDisk[4] = vec2( -0.91588581,  0.45771432 );
    poissonDisk[5] = vec2( -0.81544232, -0.87912464 );
    poissonDisk[6] = vec2( -0.38277543,  0.27676845 );
    poissonDisk[7] = vec2(  0.97484398,  0.75648379 );

    for (int i = 0; i < 8; i++) {
        vec2 offsetUV = v_textureCoordinates + poissonDisk[i] * 0.01;  // Small circular sample
        vec3 samplePosition = reconstructPosition(offsetUV);
        vec3 sampleNormal = smoothNormalsFromDepth(offsetUV);  // Reconstructed normal for sample

        // Compute distance attenuation in world space
        float distance = length(worldPosition - samplePosition);
        if (distance < radius) {
            // Compute normal-based weight (more contribution from pixels facing each other)
            float normalWeight = computeNormalWeight(worldNormal, sampleNormal);

            // Apply distance attenuation and normal weight
            float attenuation = normalWeight / (distance * distance + 1.0);
            
            // Accumulate GI color
            vec3 sampleColor = texture2D(colorTexture, offsetUV).rgb;
            giColor += sampleColor * attenuation;
            sampleCount++;
        }
    }

    if (sampleCount > 0) {
        giColor /= float(sampleCount);  // Average out accumulated GI color
    }

    // Mix global illumination with original color
    vec3 finalColor = mix(originalColor, giColor, intensity);

    gl_FragColor = vec4(worldNormal, 1.0);
}
`

geofs.fx.gi = {
    create: function() {
      geofs.fx.gi.shader = new Cesium.PostProcessStage({
        fragmentShader: ssgiShader,
        uniforms: {
          intensity: 10.5,
          radius: 5
        }
      })
      geofs.api.viewer.scene.postProcessStages.add(geofs.fx.gi.shader);
    },
    update: function() {
      geofs.fx.gi.shader.uniforms.intensity = geofs.fx.gi.intensity;
      geofs.fx.gi.shader.uniforms.radius = geofs.fx.gi.radius;
    }
  };
  