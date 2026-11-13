/* DEVELOPER NOTES AS OF 11/12/2026:
This appears to be an experimental global illumination shader. One of many.
It doesn't work, it crashes when ran, probably due to some obsolete code (this is like 2 years old you know.).
Feel free to try to fix it, I'm not going to because GeoFS Deferred will make all of this obsolete anyway.
*/
var scene = geofs.api.viewer.scene;

var giShader = `
    precision highp float;
    uniform sampler2D colorTexture; // Original scene color
    uniform sampler2D depthTexture;  // Screen-space depth texture
    uniform float u_rayStepSize;  // Step size for advancing rays
    uniform int u_maxSteps;       // Max number of steps per ray
    uniform int u_numRays;        // Number of rays cast per pixel
    uniform float u_strength;
    uniform int u_numSecondaryRays; //Number of rays cast from intersections
    uniform vec3 modelWorldPosition;
    varying vec2 v_textureCoordinates;
    uniform mat4 inverseView;  // Inverse view matrix for transforming normals to world space

    const float PI = 3.14159265359;

    float rand(vec2 co) {
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    vec3 normal_from_depth(vec2 texcoords) {
        vec2 pixelSize = czm_pixelRatio / czm_viewport.zw;
        vec2 offset1   = vec2(0.0, pixelSize.y);
        vec2 offset2   = vec2(pixelSize.x, 0.0);

        float depth    = texture2D(depthTexture, texcoords).r;
        float depth1   = texture2D(depthTexture, texcoords + offset1).r;
        float depth2   = texture2D(depthTexture, texcoords + offset2).r;

        highp vec3 p1  = vec3(offset1, depth1 - depth);
        highp vec3 p2  = vec3(offset2, depth2 - depth);

        highp vec3 normal = cross(p1, p2);
        normal.z = -normal.z;

            return normalize(normal);
    }

    // Function to get depth value
    float getDepth(vec2 uv) {
        return czm_unpackDepth(texture2D(depthTexture, uv));
    }

    // Reconstruct the view-space position from the depth buffer
    vec3 getViewPosition(vec2 uv, float depth) {
        vec2 xy = (uv * 2.0 - 1.0);  // Map to normalized device coordinates
        vec4 clipSpacePosition = vec4(xy, depth, 1.0);
        vec4 viewSpacePosition = czm_inverseProjection * clipSpacePosition;
        return viewSpacePosition.xyz / viewSpacePosition.w;  // View-space position
    }

    // Reconstruct normal using depth differences and view-space positions
    vec3 calculateViewNormal(vec2 uv) {
        float depth = czm_readDepth(depthTexture, uv);
        vec2 pixelSize = czm_pixelRatio / czm_viewport.zw;  // Get pixel size in NDC
        float depthLeft = czm_readDepth(depthTexture, uv - vec2(pixelSize.x, 0.0));
        float depthRight = czm_readDepth(depthTexture, uv + vec2(pixelSize.x, 0.0));
        float depthUp = czm_readDepth(depthTexture, uv - vec2(0.0, pixelSize.y));
        float depthDown = czm_readDepth(depthTexture, uv + vec2(0.0, pixelSize.y));
        // Get view-space positions for neighboring pixels
        vec3 viewPos = getViewPosition(uv, depth);
        vec3 viewPosLeft = getViewPosition(uv - vec2(pixelSize.x, 0.0), depthLeft);
        vec3 viewPosRight = getViewPosition(uv + vec2(pixelSize.x, 0.0), depthRight);
        vec3 viewPosUp = getViewPosition(uv - vec2(0.0, pixelSize.y), depthUp);
        vec3 viewPosDown = getViewPosition(uv + vec2(0.0, pixelSize.y), depthDown);
        
        // Calculate differences between positions
        vec3 dx = viewPosRight - viewPosLeft;
        vec3 dy = viewPosDown - viewPosUp;

        // Compute the view-space normal using the cross product of the tangent vectors
        vec3 viewNormal = normalize(cross(dy, dx));
        
        return viewNormal;  // Return the view-space normal
    }

    vec3 smoothNormalsFromDepth(vec2 texcoords) {
        float depth = czm_readDepth(depthTexture, texcoords);
        vec3 sharpNormalC = calculateViewNormal(texcoords + vec2(0.0, 0.0));

        return (sharpNormalC);  // Already in world space from normal_from_depth

    }
    // Transform view-space normal to world-space normal
    vec3 viewToWorldNormal(vec3 viewNormal) {
        // Transform the view-space normal to world space using the inverse view matrix (rotation only)
        return normalize((mat3(inverseView) * viewNormal));
    }

    vec3 sampleWorldNormal(vec2 uv) {
        vec3 viewNormal = smoothNormalsFromDepth(uv);
        vec3 worldNormal = viewToWorldNormal(viewNormal);
        vec3 normalColor = worldNormal * 0.5 + 0.5;
        return worldNormal;
    }

    vec3 randomSpherePoint(vec3 rand) {
        float ang1 = (rand.x + 1.0) * PI; // [-1..1) -> [0..2*PI)
        float u = rand.y; // [-1..1), cos and acos(2v-1) cancel each other out, so we arrive at [-1..1)
        float u2 = u * u;
        float sqrt1MinusU2 = sqrt(1.0 - u2);
        float x = sqrt1MinusU2 * cos(ang1);
        float y = sqrt1MinusU2 * sin(ang1);
        float z = u;
        return vec3(x, y, z);
    }

    vec3 randomHemispherePoint(vec3 rand, vec3 n) {
        vec3 v = randomSpherePoint(rand);
        return v * sign(dot(v, n));
    }


    // Helper to convert depth to world space position
    vec3 getWorldPosition(vec2 uv) {
        float depth = texture2D(depthTexture, uv).r;
        vec2 xy = uv * 2.0 - 1.0;
        vec4 clipSpacePosition = vec4(xy, depth * 2.0 - 1.0, 1.0);
        vec4 eyeSpacePosition = czm_inverseProjection * clipSpacePosition;
        eyeSpacePosition /= eyeSpacePosition.w;
        vec4 worldSpacePosition = czm_inverseView * eyeSpacePosition;
        return worldSpacePosition.xyz;
    }

    float getDepthLog(vec2 texCoords){
        float z_window = czm_readDepth(depthTexture, texCoords);
        float n_range = -1000.0;
        float f_range = czm_depthRange.far;
        return (2.0 * z_window - n_range - f_range) / (f_range - n_range);
    }

    vec3 getTerrainEC(vec2 texCoords) {
        float depth = getDepthLog(texCoords);
        // Go from 0.0 -> 1.0 to -1.0 -> 1.0
        vec2 xy = texCoords * 2.0 - 1.0;
        // Get position in eye coordinates
        vec4 eyeCoordinate = czm_inverseProjection * vec4(xy, depth, 1.0);
        return eyeCoordinate.xyz / eyeCoordinate.w;
    }

    vec3 getTerrainWC(vec2 texCoords) {
        vec3 eyeCoordinate = getTerrainEC(texCoords);
        // Get position in world coordinates
        vec4 worldCoordinate4 = czm_inverseView * vec4(eyeCoordinate, 1.0);
        bool doOffset = false;
        vec3 worldPosition = worldCoordinate4.xyz / worldCoordinate4.w;
        if (doOffset) {
            vec3 scaledWP = vec3(
                (worldPosition.x - modelWorldPosition.x),
                (worldPosition.y - modelWorldPosition.y),
                (worldPosition.z - modelWorldPosition.z)
            );
            return scaledWP;
        } else {
            return vec3(worldPosition);
        } 
    }

    vec2 worldToUV(vec3 worldPosition) {
        // Transform world position to clip space
        vec4 clipSpacePosition = czm_viewProjection * vec4(worldPosition, 1.0);

        // Handle precision issues if w component is very small
        if (abs(clipSpacePosition.w) < 1e-6) {
            return vec2(0.0); // Prevent division by zero or too-small values
        }

        // Perform perspective divide to get normalized device coordinates (NDC)
        vec3 ndc = clipSpacePosition.xyz / clipSpacePosition.w;

        // Convert NDC (-1 to 1 range) to UV coordinates (0 to 1 range)
        vec2 uv = ndc.xy * 0.5 + 0.5;

        // Additional clamping for extreme angles or edge cases
        uv = clamp(uv, 0.0, 1.0);
        return uv;
    }

    vec2 generateBlurredWSUVs(vec3 worldPosition) {
        float offset = 2.0;
        vec3 positions[8] = vec3[8](
            worldPosition + vec3(offset, offset, offset),
            worldPosition + vec3(offset, offset, -offset),
            worldPosition + vec3(offset, -offset, offset),
            worldPosition + vec3(offset, -offset, -offset),
            worldPosition + vec3(-offset, offset, offset),
            worldPosition + vec3(-offset, offset, -offset),
            worldPosition + vec3(-offset, -offset, offset),
            worldPosition + vec3(-offset, -offset, -offset)
        );

        vec2 averageUV = vec2(0.0, 0.0);
        for (int i = 0; i < 8; i++) {
            averageUV += worldToUV(positions[i]);
        }
        averageUV /= 8.0;

        return averageUV;
    }

    // Main ray-marching function
    vec3 rayMarch(vec3 origin, vec3 rayDir, vec3 normal, inout bool hitSurface, inout float distance) {
        vec3 trueOrigin = origin;
        vec2 trueUv = worldToUV(origin);
        float offset = 10.1;
        origin += rayDir * offset;
        for (int i = 0; i < u_maxSteps; ++i) {
            origin += rayDir * u_rayStepSize;
            vec2 uvt = worldToUV(origin);
            if (uvt.x < 0.0 || uvt.x > 1.0 || uvt.y < 0.0 || uvt.y > 1.0) break; // Ray exits the screen

            float depth = texture2D(depthTexture, uvt).r;
            vec3 worldNormal = normalize(sampleWorldNormal(trueUv));
            vec3 worldPos = getTerrainWC(uvt);
            vec3 surfaceNormal = normal_from_depth(uvt);
            vec3 worldSurfaceNormal = normalize(sampleWorldNormal(uvt));
            if (length(worldPos - origin) > u_rayStepSize * 1.0) {
                if (dot(worldNormal, worldSurfaceNormal) < 0.5) {
                    distance = length(trueOrigin - origin);
                    if (distance < 1000.0) {
                        hitSurface = true;
                        return texture2D(colorTexture, uvt).rgb; // Return color at hit point
                    }  
                }
            }
        }
        return vec3(0.0); // No hit
    }

    // Function for secondary bounce ray
    vec3 castSecondaryBounce(vec3 hitPos, vec3 hitNormal, vec2 uv) {
        vec3 totalColor = vec3(0.0);
        float weight = 0.0;
        vec3 start2WorldNormal = normalize(sampleWorldNormal(uv));
        for (int i = 0; i < u_numSecondaryRays; ++i) {
            vec3 secondaryRayDir = randomHemispherePoint(vec3(rand(uv.xy), rand(uv.yx), rand(uv.yy)), start2WorldNormal);
            bool hitSurface = false;
            float distance = 0.0;
            vec3 secondaryHitColor = rayMarch(hitPos, secondaryRayDir, hitNormal, hitSurface, distance);

            if (hitSurface) {
                vec3 hitPosition2 = hitPos + (secondaryRayDir * distance);
                vec2 hitUV2 = worldToUV(hitPosition2);
                vec3 hitNormal2 = normal_from_depth(hitUV2);
                vec3 hitWorldNormal2 = normalize(sampleWorldNormal(hitUV2));
                float worldNormalFactor = max(dot(start2WorldNormal, hitWorldNormal2), 0.0);
                float attenuation = 1.0 / (1.0 + (distance / 1000.0) * (distance / 1000.0));
                float normalFactor = max(dot(hitNormal, hitNormal2), 0.0);
                totalColor += secondaryHitColor * worldNormalFactor * attenuation;
                weight += worldNormalFactor * attenuation;
            }
        }

        if (weight > 0.0) totalColor /= weight;
        return totalColor;
    }

    // Primary ray generation
    vec3 castRays(vec3 origin, vec3 normal, vec3 originalColor, vec2 uv) {
        vec3 totalColor = vec3(0.0);
        vec3 secColorTestView = vec3(0.0);
        float weight = 0.0;
        vec3 startWorldNormal = normalize(sampleWorldNormal(uv));
        for (int i = 0; i < u_numRays; ++i) {
            vec3 rayDir = randomHemispherePoint(vec3(rand(uv.xy), rand(uv.yx), rand(uv.yy)), startWorldNormal); //maybe revert this if it causes issues in WS
            bool hitSurface = false;
            float distance = 0.0;
            vec3 hitColor = rayMarch(origin, rayDir, normal, hitSurface, distance);
            if (hitSurface) {
                vec3 hitPosition = origin + (rayDir * distance);
                vec2 hitUV = worldToUV(hitPosition);
                vec3 hitNormal = normal_from_depth(hitUV);
                vec3 hitWorldNormal = normalize(sampleWorldNormal(hitUV));
                float attenuation = (1.0 / (1.0 + (distance / 1000.0) * (distance / 1000.0)));
                float normalFactor = max(dot(normal, hitNormal), 0.0);
                float worldNormalFactor = max(dot(startWorldNormal, hitWorldNormal), 0.0);
                totalColor += hitColor * worldNormalFactor * attenuation;
                weight += worldNormalFactor * attenuation;
                // Cast secondary bounce ray from the hit point
                
                vec3 secondaryColor = castSecondaryBounce(hitPosition, hitNormal, hitUV);
                secColorTestView = secondaryColor;
                totalColor += secondaryColor * 0.5; // Contribute half of the secondary bounce color
            }
        }

        if (weight > 0.0) totalColor /= weight;
        return totalColor * u_strength;
    }

    void main() {
        vec2 uv = v_textureCoordinates;
        vec3 originalColor = texture2D(colorTexture, uv).rgb;
        vec3 normal = normal_from_depth(uv);
        vec3 worldPos = getTerrainWC(uv);
        //vec2 uv2 = worldToUV(worldPos);
        // Cast primary and secondary rays for GI
        if (!czm_selected()) {
            gl_FragColor = vec4(vec3(0.0), 1.0);
        } else {
            vec3 giColor = castRays(worldPos, normal, originalColor, uv);
            gl_FragColor = vec4(giColor, (giColor.r + giColor.g + giColor.b) / 3.0);
        }
    }
`;

var denoiseShader = `
    uniform sampler2D colorTexture;
    uniform float u_S;
    uniform float u_kS;
    uniform float u_edge;
    varying vec2 v_textureCoordinates;
    #define INV_SQRT_OF_2PI 0.39894228040143267793994605993439  // 1.0/SQRT_OF_2PI
    #define INV_PI 0.31830988618379067153776752674503

    vec4 smartDeNoise(sampler2D tex, vec2 uv, float sigma, float kSigma, float threshold)
    {
        float radius = round(kSigma*sigma);
        float radQ = radius * radius;
        
        float invSigmaQx2 = .5 / (sigma * sigma);      // 1.0 / (sigma^2 * 2.0)
        float invSigmaQx2PI = INV_PI * invSigmaQx2;    // 1.0 / (sqrt(PI) * sigma)
        
        float invThresholdSqx2 = .5 / (threshold * threshold);     // 1.0 / (sigma^2 * 2.0)
        float invThresholdSqrt2PI = INV_SQRT_OF_2PI / threshold;   // 1.0 / (sqrt(2*PI) * sigma)
        
        vec4 centrPx = texture2D(tex,uv);
        
        float zBuff = 0.0;
        vec4 aBuff = vec4(0.0);
        vec2 size = czm_viewport.zw;
        
        for(float x=-radius; x <= radius; x++) {
            float pt = sqrt(radQ-x*x);  // pt = yRadius: have circular trend
            for(float y=-pt; y <= pt; y++) {
                vec2 d = vec2(x,y);

                float blurFactor = exp( -dot(d , d) * invSigmaQx2 ) * invSigmaQx2PI; 
                
                vec4 walkPx =  texture2D(tex,uv+d/size);

                vec4 dC = walkPx-centrPx;
                float deltaFactor = exp( -dot(dC, dC) * invThresholdSqx2) * invThresholdSqrt2PI * blurFactor;
                                    
                zBuff += deltaFactor;
                aBuff += deltaFactor*walkPx;
            }
        }
        return aBuff/zBuff;
    }

    void main(void) {
        gl_FragColor = smartDeNoise(colorTexture, v_textureCoordinates, u_S, u_kS, u_edge);
    }
`
var combineShader = `
    uniform sampler2D colorTexture;
    uniform sampler2D giTexture;
    uniform sampler2D depthTexture;
    varying vec2 v_textureCoordinates;

    void main(void) {
        vec4 giColor = texture2D(giTexture, v_textureCoordinates);
        vec4 color = texture2D(colorTexture, v_textureCoordinates);
        float depth = texture2D(depthTexture, v_textureCoordinates).r;
        if (depth > 0.5) {
            gl_FragColor = color;
        } else {
            gl_FragColor = (giColor + color);
        }
    }
`

var giStage = new Cesium.PostProcessStage({
    fragmentShader: giShader,
    uniforms: {
        modelWorldPosition: getWSOffset(),
        inverseView: function () {
            return geofs.api.viewer.camera.inverseViewMatrix;
        },
        u_rayStepSize: 500.0,  // Tune based on scene size
        u_maxSteps: 5,     // Max number of raymarching steps
        u_numRays: 2,        // Number of rays per pixel
        u_numSecondaryRays: 1,
        u_strength: 1.0
    }
})


var denoiseStage = new Cesium.PostProcessStage({
    fragmentShader: denoiseShader,
    uniforms: {
        u_S: 15.0,
        u_kS: 2.0,
        u_edge: 5.0
    }
})

var compositeGIstage = new Cesium.PostProcessStageComposite({
    inputPreviousStageTexture: true,
    stages: [giStage, denoiseStage],
    name: "compositeStage"
})

var combineGItoOriginalStage = new Cesium.PostProcessStageComposite({
    inputPreviousStageTexture: false,
    stages: [
        compositeGIstage, 
        new Cesium.PostProcessStage({
            fragmentShader: combineShader,
            uniforms: {
                giTexture: "compositeStage"
            }
        })
    ]
})

function getWSOffset() {
    try {
        return Cesium.Matrix4.getTranslation(geofs.aircraft.instance.object3d.model._model.modelMatrix, new Cesium.Cartesian3);
    } catch(error) {
        console.log("Likely aircraft change, disregard: ", error);
    }
}

var updateUniformInterval = setInterval(function(){ //Cannot add these to the rendering loop since it will break when no aircraft is loaded.
    try {
        giStage.uniforms.modelWorldPosition = getWSOffset();
        giStage.selected = [geofs.aircraft.instance.object3d._children[3].model._model];
        geofs.aircraft.instance.object3d._children.forEach(function(child){
            if (typeof child.model !== "undefined") if (typeof child.model._model !== "undefined") giStage.selected.push(child.model._model);
            if (typeof child["3dmodel"] !== "undefined") if (typeof child["3dmodel"]._model !== "undefined") giStage.selected.push(child["3dmodel"]._model);
        })
        Object.values(geofs.aircraft.instance.parts).forEach(function(child){
            if (typeof child.model !== "undefined") if (typeof child.model._model !== "undefined") giStage.selected.push(child.model._model);
            if (typeof child["3dmodel"] !== "undefined") if (typeof child["3dmodel"]._model !== "undefined") giStage.selected.push(child["3dmodel"]._model);
        })
    } catch (error) {
        console.log("Likely Aircraft Change Detected, ", error);
    }
}, 1000)

setTimeout(function() { //Setting a delay so that the interval can initialize before the shaders.
    scene.postProcessStages.add(combineGItoOriginalStage);
}, 1001)
