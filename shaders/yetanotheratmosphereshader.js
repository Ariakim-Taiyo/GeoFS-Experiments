/* DEVELOPER NOTES AS OF 11/12/2026:
?
Yeah I don't know what I was doing here. I already had an aurora shader, or maybe this was an earlier iteration before
I merged it into the atmosphere shader?
Regardless, it's extremely broken and I'm only uploading it because it's funny.
Enjoy. Try not to get a seizure or something.

YOU ACKNOWLEDGE THE POSSIBILITY OF PAIN AND SEIZURE


*/
let auroraShader = `
    uniform sampler2D colorTexture;
    uniform sampler2D depthTexture;
    varying vec2 v_textureCoordinates;

    // Aurora parameters
    const mat2 m2 = mat2(0.95534, 0.29552, -0.29552, 0.95534);
    float tri(in float x) { return clamp(abs(fract(x) - 0.5), 0.01, 0.49); }
    vec2 tri2(in vec2 p) { return vec2(tri(p.x) + tri(p.y), tri(p.y + tri(p.x))); }

    float triNoise2d(in vec2 p, float spd) {
        float z = 1.8;
        float z2 = 2.5;
        float rz = 0.0;
        p *= mat2(cos(p.x * 0.06), sin(p.x * 0.06), -sin(p.x * 0.06), cos(p.x * 0.06));
        vec2 bp = p;
        for (float i = 0.0; i < 5.0; i++) {
            vec2 dg = tri2(bp * 1.85) * 0.75;
            dg *= mat2(cos(czm_frameNumber * spd), sin(czm_frameNumber * spd), -sin(czm_frameNumber * spd), cos(czm_frameNumber * spd));
            p -= dg / z2;
            bp *= 1.3;
            z2 *= 0.45;
            z *= 0.42;
            p *= 1.21 + (rz - 1.0) * 0.02;
            rz += tri(p.x + tri(p.y)) * z;
            p *= -m2;
        }
        return clamp(1.0 / pow(rz * 29.0, 1.3), 0.0, 0.55);
    }

    vec4 aurora(vec3 worldPos, vec3 rayDir) {
        vec4 col = vec4(0.0);
        vec4 avgCol = vec4(0.0);
        for (float i = 0.0; i < 50.0; i++) {
            float pt = ((0.8 + pow(i, 1.4) * 0.002) - worldPos.y) / (rayDir.y * 2.0 + 0.4);
            vec3 bpos = worldPos + pt * rayDir;
            vec2 p = bpos.zx;
            float rzt = triNoise2d(p, 0.06);
            vec4 col2 = vec4(0.0, 0.0, 0.0, rzt);
            col2.rgb = (sin(1.0 - vec3(2.15, -0.5, 1.2) + i * 0.043) * 0.5 + 0.5) * rzt;
            avgCol = mix(avgCol, col2, 0.5);
            col += avgCol * exp2(-i * 0.065 - 2.5) * smoothstep(0.0, 5.0, i);
        }
        return col * 1.8;
    }

    void main() {
        // Screen resolution is replaced by czm_viewport.zw
        vec2 fragCoord = v_textureCoordinates * czm_viewport.zw;

        // Sample color and depth from the previous stage
        vec4 color = texture(colorTexture, v_textureCoordinates);
        float depth = texture(depthTexture, v_textureCoordinates).r;

        // Convert screen coordinates to world space
        vec4 worldPosition4 = czm_inverseViewProjection * vec4((fragCoord / czm_viewport.zw) * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
        worldPosition4 /= worldPosition4.w;
        vec3 worldPosition = worldPosition4.xyz;

        // Camera ray direction using Cesium's built-in world-space camera position
        vec3 rayDir = normalize(worldPosition - czm_viewerPositionWC);

        // Apply aurora effect only near the poles or high latitudes (arbitrary cutoff)
        if (abs(czm_viewerPositionWC.y) > 0.7) {
            vec4 auroraCol = aurora(worldPosition, rayDir);
            color.rgb = mix(color.rgb, auroraCol.rgb, auroraCol.a);
        }

        // Output final color
        gl_FragColor = color;
    }
`
var auroraStage = new Cesium.PostProcessStage({
    fragmentShader: auroraShader,
    uniforms: {
    }
})

geofs.api.viewer.scene.postProcessStages.add(auroraStage);



`
    varying vec2 v_textureCoordinates;
    void main () {
        vec2 fragCoordRegenerated = v_textureCoordinates * czm_viewport.zw;
        vec2 texCoordRegenerated = gl_FragCoord.xy / czm_viewport.zw;
        gl_FragColor = vec4(texCoordRegenerated, 0.0, 1.0);
    }
    `