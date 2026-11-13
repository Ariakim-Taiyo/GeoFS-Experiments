/* DEVELOPER NOTES AS OF 11/12/2026:
So this is the actual point lights shader. Go look in volumetricEffects.js for the 
actual notes because I'm lazy and I'm not writing all of that here.
I guess I could copy and paste but nah.
*/
var scene = geofs.api.viewer.scene;
var lightPosArr = [];
var lightColArr = [];
var lightStrengthArr = [];
var rwLightPosArr = [];
var rwLightColArr = [];
var rwLightStrengthArr = [];
var lightCount = 0;
var lightShader = `
    precision highp float;
    uniform sampler2D colorTexture;
    uniform highp sampler2D depthTexture;
    uniform int sceneLightsCount;
    uniform vec3 lightPositions[128];
    uniform int lightColors[128];
    uniform float lightStrengths[128];
    uniform bool shadowed;
    uniform int MAX_MARCH_STEPS;
    uniform float SHADOW_BIAS;
    uniform float MARCH_STEP_LENGTH;
    uniform float SHADOW_DOT_BIAS;
    uniform float SHADOW_OFFSET;
    uniform float LIGHT_STRENGTH;
    varying vec2 v_textureCoordinates;

    const float distanceCutoff = 100.0;
    const float lightIntensity = 1.0;

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
        vec3 viewPos = getViewPosition(uv, depth);
        vec3 viewPosLeft = getViewPosition(uv - vec2(pixelSize.x, 0.0), depthLeft);
        vec3 viewPosRight = getViewPosition(uv + vec2(pixelSize.x, 0.0), depthRight);
        vec3 viewPosUp = getViewPosition(uv - vec2(0.0, pixelSize.y), depthUp);
        vec3 viewPosDown = getViewPosition(uv + vec2(0.0, pixelSize.y), depthDown);
        
        vec3 dx = viewPosRight - viewPosLeft;
        vec3 dy = viewPosDown - viewPosUp;

        vec3 viewNormal = normalize(cross(dy, dx));
        
        return viewNormal;  // Return the view-space normal
    }

    vec3 smoothNormalsFromDepth(vec2 texcoords) {
        float depth = (texelFetch(depthTexture, ivec2(texcoords), 0).r);
        vec3 sharpNormalC = calculateViewNormal(texcoords + vec2(0.0, 0.0));

        return (sharpNormalC);  // Already in world space from normal_from_depth

    }
    // Transform view-space normal to world-space normal
    vec3 viewToWorldNormal(vec3 viewNormal) {
        return normalize((mat3(czm_inverseView) * viewNormal));
    }

    vec3 sampleWorldNormal(vec2 uv) {
        vec3 viewNormal = smoothNormalsFromDepth(uv);
        vec3 worldNormal = viewToWorldNormal(viewNormal);
        vec3 normalColor = worldNormal * 0.5 + 0.5;
        return worldNormal;
    }


    float getDepthLog(vec2 texCoords){
        float z_window = czm_reverseLogDepth(texelFetch(depthTexture, ivec2(texCoords), 0).r);
        float n_range = czm_depthRange.near;
        float f_range = czm_depthRange.far;
        float z_ndc = (2.0 * z_window - n_range - f_range) / (f_range - n_range);
        return (z_ndc);
    }

    float getDepthLogFORUV(vec2 texCoords){
        float z_window = czm_readDepth(depthTexture, texCoords);
        float n_range = -1000.0;
        float f_range = czm_depthRange.far;
        return (2.0 * z_window - n_range - f_range) / (f_range - n_range);
    }

    float getDepthLogFORUVDEPTHIN(vec2 texCoords, float depth){
        float z_window = depth;
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

    vec4 clipToEye(vec2 uv, float depth)
    {
        vec2 xy = 2.0 * uv - vec2(1.0);
        vec4 posEC = czm_inverseProjection * vec4(xy, depth, 1.0);
        posEC = posEC / posEC.w;
        return posEC;
    }

    vec3 screenToEye(vec2 screenCoordinate)
    {
        float depth = czm_readDepth(depthTexture, screenCoordinate);
        return clipToEye(screenCoordinate, depth).xyz;
    }

    vec3 pixelToEye(vec2 screenCoordinate)
    {
        float depth = getDepthLog(screenCoordinate);
        ivec2 screenDimensions = textureSize(depthTexture, 0);
        vec2 normalizedCoordinate = screenCoordinate / vec2(screenDimensions);
        return clipToEye(normalizedCoordinate, depth).xyz;
    }

    vec3 getTerrainECFORUV(vec2 texCoords) {
        float depth = getDepthLogFORUV(texCoords);
        // Go from 0.0 -> 1.0 to -1.0 -> 1.0
        vec2 xy = texCoords * 2.0 - 1.0;
        // Get position in eye coordinates
        vec4 eyeCoordinate = czm_inverseProjection * vec4(xy, depth, 1.0);
        return eyeCoordinate.xyz / eyeCoordinate.w;
    }

    vec3 getTerrainECFORUVDEPTHIN(vec2 texCoords, float depth) {
        float depth1 = getDepthLogFORUVDEPTHIN(texCoords, depth);
        // Go from 0.0 -> 1.0 to -1.0 -> 1.0
        vec2 xy = texCoords * 2.0 - 1.0;
        // Get position in eye coordinates
        vec4 eyeCoordinate = czm_inverseProjection * vec4(xy, depth1, 1.0);
        return eyeCoordinate.xyz / eyeCoordinate.w;
    }

    vec3 getTerrainWC(vec2 texCoords) {
        vec3 eyeCoordinate = pixelToEye(texCoords); // gl_FragCoord
        // Get position in world coordinates
        vec4 worldCoordinate4 = czm_inverseView * vec4(eyeCoordinate, 1.0);
        bool doOffset = false;
        vec3 worldPosition = worldCoordinate4.xyz / worldCoordinate4.w;
        return vec3(worldPosition);
    }

    vec3 getTerrainWCFORUV(vec2 texCoords) { // v_textureCoordinates or gl_FragColor / czm_viewport.zw
        vec3 eyeCoordinate = getTerrainECFORUV(texCoords);
        // Get position in world coordinates
        vec4 worldCoordinate4 = czm_inverseView * vec4(eyeCoordinate, 1.0);
        bool doOffset = false;
        vec3 worldPosition = worldCoordinate4.xyz / worldCoordinate4.w;
        return vec3(worldPosition);
    }

    vec3 getTerrainWCFORUVDEPTHIN(vec2 texCoords, float depth) { // v_textureCoordinates or gl_FragColor / czm_viewport.zw
        vec3 eyeCoordinate = getTerrainECFORUVDEPTHIN(texCoords, depth);
        // Get position in world coordinates
        vec4 worldCoordinate4 = czm_inverseView * vec4(eyeCoordinate, 1.0);
        bool doOffset = false;
        vec3 worldPosition = worldCoordinate4.xyz / worldCoordinate4.w;
        return vec3(worldPosition);
    }
    vec3 getWP(vec2 uv, float depth, inout vec4 wCoord) {
        vec4 posEC = czm_windowToEyeCoordinates(uv, depth);
        vec4 wc = czm_inverseView * posEC;
        wCoord = wc;
        vec3 wp = wc.xyz / wc.w;
        vec3 mp = wp - czm_viewerPositionWC;
        return wp;
    }

    vec3 getUVD(vec4 wCoord) {
        vec4 ec = czm_view * wCoord;
        vec4 wic = czm_eyeToWindowCoordinates(ec);
        vec3 wicDiv = wic.xyz / wic.w;
        vec3 uvd = wicDiv * 0.5 + 0.5;
        return uvd;
    }

    vec2 worldToUV(vec3 worldPosition) {
        vec4 clipSpacePosition = czm_viewProjection * vec4(worldPosition, 1.0);

        vec3 ndc = clipSpacePosition.xyz / clipSpacePosition.w;

        vec2 uv = ndc.xy * 0.5 + 0.5;

        uv = clamp(uv, 0.0, 1.0);
        return uv;
    }

    vec3 getDirection3D(vec3 pointA, vec3 pointB) {
        return normalize(pointB - pointA);
    }


    vec3 worldToUVDepth(vec3 worldPosition, mat4 viewMatrix, mat4 projectionMatrix) {
        vec4 eyeCoordinate = viewMatrix * vec4(worldPosition, 1.0);

        vec4 clipCoordinate = projectionMatrix * eyeCoordinate;

        clipCoordinate /= clipCoordinate.w;

        vec2 uv;
        uv.x = (clipCoordinate.x + 1.0) * 0.5; // X to [0, 1]
        uv.y = (clipCoordinate.y + 1.0) * 0.5; // Y to [0, 1]

        float z_window = (clipCoordinate.z);

        return vec3(uv, z_window);
    }

    vec3 getUVAndDepth(vec3 worldPosition, mat4 viewMatrix, mat4 projectionMatrix) {
        vec3 uvAndDepth = worldToUVDepth(worldPosition, viewMatrix, projectionMatrix);
        return uvAndDepth; // Returns UV and depth as vec2, where .xy = UV and .z = depth
    }

    float traceShadows(vec3 startPos, vec3 endPos, vec4 startCoord, vec4 endCoord) { //Start at light, end at fragment
        float shadowFactor = 1.0;

        vec3 startUVd = getUVAndDepth(startPos, czm_view, czm_projection);
        vec3 endUVd = getUVAndDepth(endPos, czm_view, czm_projection);
        vec3 startNormal = sampleWorldNormal(startUVd.xy);
        vec3 endNormal = sampleWorldNormal(endUVd.xy);
        if (dot(startNormal, endNormal) < SHADOW_DOT_BIAS) {
            shadowFactor = 0.0;
        }

        float offset = 0.2;
        vec3 lightDir = -getDirection3D(endPos, startPos);
        float maxDist = length(startPos - endPos);       
        float currentDist = SHADOW_OFFSET;

        for (int i = 0; i < MAX_MARCH_STEPS; i++) {
            currentDist += MARCH_STEP_LENGTH; //may need to use a hardcoded value.
            vec3 currentPos = startPos + (currentDist * lightDir);
            vec3 currentUVd = getUVD(vec4(currentPos, endCoord.z));
            vec3 currentNormal = sampleWorldNormal(currentUVd.xy / czm_viewport.zw);
            float depthAtRay = (currentUVd.z);
            float depthAtPix = (texture2D(depthTexture, currentUVd.xy / czm_viewport.zw).r);
            vec4 currentWorldCoord;
            vec3 currentPixPos = getWP(currentUVd.xy, depthAtPix, currentWorldCoord);
            float shadowDot = dot(lightDir, currentNormal);
            shadowFactor = clamp(shadowDot, 0.0, 1.0);
            if (length(depthAtRay - depthAtPix) < SHADOW_BIAS) {
                shadowFactor = length(depthAtRay - depthAtPix);
                break;
            }
            if (currentDist > maxDist) {
                break;
            }
        }
        return (shadowFactor);
    }
    vec4 getLightColorFromUV(vec2 uv) {
        vec4 pixelColor = vec4(0.0);
        float depth = czm_unpackDepth(texture2D(depthTexture, uv / czm_viewport.zw));
        vec4 currentCoord;
        vec3 currentWP = getWP(uv, depth, currentCoord); //here
        for (int i = 0; i < sceneLightsCount + 1; ++i) {
        int j = i;
            vec3 lightPos = lightPositions[i];
            float distance = distance(currentWP, lightPos);
            if (distance < distanceCutoff) {
                float intensity = lightIntensity / (0.1 + dot(distance, distance));
                intensity *= lightStrengths[i] * LIGHT_STRENGTH;
                //return vec4(intensity) * 0.1;
                float shadowFactor = 1.0;
                if (shadowed) {
                    shadowFactor = traceShadows(lightPos, currentWP, vec4(lightPos, length(lightPos - czm_viewerPositionWC)), currentCoord);
                }
                intensity *= shadowFactor;
                if (lightColors[i] == 1) pixelColor += intensity * vec4(1.0, 0.0, 0.0, 1.0);
                if (lightColors[i] == 2) pixelColor += intensity * vec4(1.0, 1.0, 1.0, 1.0);
                if (lightColors[i] == 3) pixelColor += intensity * vec4(0.0, 1.0, 0.0, 1.0);
                
            }
        }
            return pixelColor;
    }

    void main(void) {
    vec2 uv = gl_FragCoord.xy;
        vec4 lightColors = getLightColorFromUV(uv);
        gl_FragColor = texture2D(colorTexture, uv / czm_viewport.zw) + lightColors;
    }
`

var lightModStage = new Cesium.PostProcessStage({
    fragmentShader: lightShader,
    uniforms: {
        sceneLightsCount: lightCount,
        lightPositions: lightPosArr,
        lightColors: lightColArr,
        lightStrengths: lightStrengthArr,
        shadowed: true,
        SHADOW_BIAS: 0.1,
        MAX_MARCH_STEPS: 5,
        MARCH_STEP_LENGTH: 2.0,
        SHADOW_DOT_BIAS: -1.0,
        SHADOW_OFFSET: 0.0,
        LIGHT_STRENGTH: 1.0
    }
})

function getNearRWLights() {
    rwLightPosArr = [];
    rwLightColArr = [];
    rwLightStrengthArr = [];
    var rwLightObject = geofs.fx.litRunways;
    var maxDist = 100.0
    var currentPos = Cesium.Matrix4.getTranslation(geofs.aircraft.instance.object3d.model._model.modelMatrix, new Cesium.Cartesian3);
    Object.values(rwLightObject).forEach(function(rw) {
        rw.lights.forEach(function(light){
            var lightPos = light._billboard._billboard._actualPosition;
            var lightLLA = Cesium.Cartographic.fromCartesian(lightPos);
            lightLLA.height += 15.0;
            var adjustedLightPos = Cesium.Cartographic.toCartesian(lightLLA);
            if (Cesium.Cartesian3.distance(currentPos, lightPos) < maxDist) {
                rwLightPosArr.push(adjustedLightPos);
                var lightCol = light._billboard._billboard._imageId;
                if (lightCol.includes("red")) rwLightColArr.push(1.0);
                if (lightCol.includes("yellow")) rwLightColArr.push(2.0);
                if (lightCol.includes("green")) rwLightColArr.push(3.0);
                rwLightStrengthArr.push(3.0)
            }
        })
    })
}

var rwLightUpdateInt = setInterval(function(){getNearRWLights()}, 1000);

function getLightInfo() {
    try {
        if (typeof geofs.aircraft.instance.lights === "undefined") return;
        lightPosArr = [];
        lightColArr = [];
        lightStrengthArr = [];
        lightCount = 0;
        geofs.aircraft.instance.lights.forEach(function(light){
            lightPosArr.push(light.lightBillboard._billboard._billboard._actualPosition);
            if (light.light === "red") lightColArr.push(1.0);
            if (light.light === "white") lightColArr.push(2.0);
            if (light.light === "green") lightColArr.push(3.0);

            if (light.lightBillboard._billboard._billboard._show == false) {
                lightStrengthArr.push(0.0);
            } else {
                if (JSON.stringify(light.animations).includes("strobe")) {
                    lightStrengthArr.push(2.0);
                } else {
                    lightStrengthArr.push(1.0);
                }
            }
        })
        lightPosArr = lightPosArr.concat(rwLightPosArr);
        lightColArr = lightColArr.concat(rwLightColArr);
        lightStrengthArr = lightStrengthArr.concat(rwLightStrengthArr);
        lightCount = lightPosArr.length;
    } catch(error) {
        console.log(error);
    }
}
geofs.api.viewer.scene.preRender.addEventListener(function(){
    getLightInfo();
    lightModStage.uniforms.sceneLightsCount = lightCount;
    lightModStage.uniforms.lightPositions = lightPosArr;
    lightModStage.uniforms.lightColors = lightColArr;
    lightModStage.uniforms.lightStrengths = lightStrengthArr;
})
scene.postProcessStages.add(lightModStage);