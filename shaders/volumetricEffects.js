/* DEVELOPER NOTES AS OF 11/12/2026:
I'm pretty sure this was the point light shader I made and teased endlessly in the GE2 server.
I recall Zeta making some comments regarding attempting to reconstruct the original colors of surfaces,
which would not have worked given the constraints I was working within here.
As anyone who has attempted to write post-processing shaders for GeoFS / Cesium knows, it's pretty
much impossible to do anything fancy.
As for why this file is called "volumetricEffects.js", I have no clue at all.
Just my amazing naming skills at work I guess.
If you haven't figured it out, all of these files retain their original names.
I think it adds to the charm.

EDIT:
Ok so I actually remember what this is now, it's just a volumetric raymarcher that I was making to try
and add condensation effects to aircraft. Idk why I reused so much of the point light code.
It just renders a primitive shape over the aircraft IIRC.
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
    uniform bool sphereFunction;
    uniform int MAX_MARCH_STEPS;
    uniform float SPHERE_SIZE;
    uniform float MARCH_STEP_LENGTH;
    uniform float SHADOW_DOT_BIAS;
    uniform float SHADOW_OFFSET;
    uniform float LIGHT_STRENGTH;
    uniform vec3 volOrigin;
    uniform mat3 aircraftRotMat;
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
        float depth = (texelFetch(depthTexture, ivec2(texcoords), 0).r);
        vec3 sharpNormalC = calculateViewNormal(texcoords + vec2(0.0, 0.0));

        return (sharpNormalC);  // Already in world space from normal_from_depth

    }
    // Transform view-space normal to world-space normal
    vec3 viewToWorldNormal(vec3 viewNormal) {
        // Transform the view-space normal to world space using the inverse view matrix (rotation only)
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
        // Transform world position to clip space
        vec4 clipSpacePosition = czm_viewProjection * vec4(worldPosition, 1.0);

        // Perform perspective divide to get normalized device coordinates (NDC)
        vec3 ndc = clipSpacePosition.xyz / clipSpacePosition.w;

        // Convert NDC (-1 to 1 range) to UV coordinates (0 to 1 range)
        vec2 uv = ndc.xy * 0.5 + 0.5;

        // Additional clamping for extreme angles or edge cases
        uv = clamp(uv, 0.0, 1.0);
        return uv;
    }

    vec3 getDirection3D(vec3 pointA, vec3 pointB) {
        return normalize(pointB - pointA);
    }


    vec3 worldToUVDepth(vec3 worldPosition, mat4 viewMatrix, mat4 projectionMatrix) {
        // Step 1: Convert world position to eye (camera) space
        vec4 eyeCoordinate = viewMatrix * vec4(worldPosition, 1.0);

        // Step 2: Convert eye space to clip space
        vec4 clipCoordinate = projectionMatrix * eyeCoordinate;

        // Step 3: Perform perspective division
        clipCoordinate /= clipCoordinate.w;

        // Step 4: Convert to UV coordinates
        vec2 uv;
        uv.x = (clipCoordinate.x + 1.0) * 0.5; // X to [0, 1]
        uv.y = (clipCoordinate.y + 1.0) * 0.5; // Y to [0, 1]

        // Step 5: Get depth value in window space (z_window)
        float z_window = (clipCoordinate.z); // Use your depth calculation method

        return vec3(uv, z_window);
    }

    // Wrapper function to return depth as well
    vec3 getUVAndDepth(vec3 worldPosition, mat4 viewMatrix, mat4 projectionMatrix) {
        vec3 uvAndDepth = worldToUVDepth(worldPosition, viewMatrix, projectionMatrix);
        return uvAndDepth; // Returns UV and depth as vec2, where .xy = UV and .z = depth
    }

    float sphereSDF(vec3 pos, vec3 spherePos, float rad) {
        return length(pos - spherePos) - rad;
    }

    vec3 calculateSDFNormal(vec3 p, vec3 sp, float r)
{
    const vec3 small_step = vec3(0.001, 0.0, 0.0);

    float gradient_x = sphereSDF(p + small_step.xyy, sp, r) - sphereSDF(p - small_step.xyy, sp, r);
    float gradient_y = sphereSDF(p + small_step.yxy, sp, r) - sphereSDF(p - small_step.yxy, sp, r);
    float gradient_z = sphereSDF(p + small_step.yyx, sp, r) - sphereSDF(p - small_step.yyx, sp, r);

    vec3 normal = vec3(gradient_x, gradient_y, gradient_z);

    return normalize(normal);
}


    vec4 marchScreenVolume(vec3 origin, vec3 dir) {
        float totalDist = 0.0;
        for (int i = 0; i < 100; ++i) {
             vec3 currentPos = origin + totalDist * dir;
             float closestDist = sphereSDF(currentPos, volOrigin, 3.0);
             if (closestDist < 0.00001) {
                vec3 normal = calculateSDFNormal(currentPos, volOrigin, 3.0) * 0.5 + 0.5;
                return vec4(normal, 1.0);
             }

             if (totalDist > 100000.0) {
             return vec4(0.0);
                break; 
            }

            totalDist += closestDist;
        }
        return vec4(0.0);
    }

    float sdSphere(vec3 p, float radius) {
        return length(aircraftRotMat * (p - volOrigin)) - radius;
    }

    float sdBox( vec3 p, vec3 b )
    {
    vec3 q = abs(aircraftRotMat * (p - (volOrigin))) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
    }

    float sdCappedCylinder( vec3 p, vec3 a, vec3 b, float r )
    {
        vec3  ba = b - a;
        vec3  pa = (aircraftRotMat * (p - volOrigin)) - a;
        float baba = dot(ba,ba);
        float paba = dot(pa,ba);
        float x = length(pa*baba-ba*paba) - r*baba;
        float y = abs(paba-baba*0.5)-baba*0.5;
        float x2 = x*x;
        float y2 = y*y*baba;
        float d = (max(x,y)<0.0)?-min(x2,y2):(((x>0.0)?x2:0.0)+((y>0.0)?y2:0.0));
        return sign(d)*sqrt(abs(d))/baba;
    }

    float scene(vec3 p) {
        float distance = 0.0;
        if (sphereFunction) {
            distance = sdBox(p, vec3(SPHERE_SIZE));
        } else {
            distance = sdCappedCylinder(p, vec3(-10.0, 0.0, 0.0), vec3(10.0, 0.0, 0.0), SPHERE_SIZE);
        }
        return -distance;
    }

    vec4 raymarch(vec3 rayOrigin, vec3 rayDirection) {
        float depth = 0.0;
        vec3 p = rayOrigin + depth * rayDirection;
        
        vec4 res = vec4(0.0);

        for (int i = 0; i < MAX_MARCH_STEPS; i++) {
            float density = scene(p);

            // We only draw the density if it's greater than 0
            if (density > 0.0) {
                // Directional derivative
                // For fast diffuse lighting
                float diffuse = clamp((scene(p) - scene(p + 0.3 * normalize(czm_sunPositionWC))) / 0.3, 0.0, 1.0 );

                vec3 lin = vec3(0.60,0.60,0.75) * 1.1 + 0.8 * czm_lightColor.xyz * diffuse;
                vec4 color = vec4(mix(vec3(1.0, 1.0, 1.0), vec3(0.0, 0.0, 0.0), density), density);
                color.rgb *= lin;

                color.rgb *= color.a;
                res += color * (1.0 - res.a);
            }

            depth += MARCH_STEP_LENGTH;
            p = rayOrigin + depth * rayDirection;
        }

        return res;
    }


    void main(void) {
        // 1. Normalize the screen space UV coordinates (range 0 to 1)
        vec2 uv = gl_FragCoord.xy / czm_viewport.zw;

        // 2. Get the camera's position and depth
        vec3 origin = czm_viewerPositionWC;  // Camera position in world space
        float depth = (czm_unpackDepth(texture2D(czm_globeDepthTexture, uv)));

        // 3. Convert UV to NDC (Normalized Device Coordinates), range (-1 to 1)
        vec2 ndc = uv * 2.0 - 1.0;  // Map UV from [0,1] to [-1,1]

        // 4. Use depth to scale the ray direction
        vec4 rayDir = czm_windowToEyeCoordinates(gl_FragCoord.xy, depth);//vec3(ndc, 1.0);  // The direction vector in camera space

        // 5. Transform the direction vector from camera space to world space
        // Inverse projection matrix converts to view space (camera space),
        // inverse view matrix converts to world space.
        //vec4 rayDirCameraSpace = czm_inverseProjection * vec4(rayDir);
        vec3 rayDirWorldSpace = czm_inverseViewRotation * rayDir.xyz;

        // Normalize the direction to avoid distorted results
        rayDirWorldSpace = (rayDirWorldSpace);

        // 6. Perform the ray march in the world space direction
        vec4 marchResult = raymarch(origin, rayDirWorldSpace.xyz);
        vec4 color = texture2D(colorTexture, uv);
        gl_FragColor = marchResult + color;
    }
`

var lightModStage = new Cesium.PostProcessStage({
    fragmentShader: lightShader,
    uniforms: {
        sceneLightsCount: lightCount,
        lightPositions: lightPosArr,
        lightColors: lightColArr,
        lightStrengths: lightStrengthArr,
        volOrigin: getVolOrigin(),
        aircraftRotMat: getCesiumAircraftRotMat(),
        sphereFunction: true,
        SPHERE_SIZE: 4.0,
        MAX_MARCH_STEPS: 400,
        MARCH_STEP_LENGTH: 0.1,
        SHADOW_DOT_BIAS: -1.0,
        SHADOW_OFFSET: 0.0,
        LIGHT_STRENGTH: 1.0
    }
})
/*
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
*/
function getCesiumAircraftRotMat() {
    var acr = geofs.aircraft.instance.object3d.getRotation();
    return Cesium.Matrix3.fromArray([acr[0][0], acr[0][1], acr[0][1], acr[1][0], acr[1][1], acr[1][1], acr[2][0], acr[2][1], acr[2][1]]);
}

function getVolOrigin() {
    var currentPos = Cesium.Matrix4.getTranslation(geofs.aircraft.instance.object3d.model._model.modelMatrix, new Cesium.Cartesian3);
    var volOrigin = Cesium.Cartographic.fromCartesian(currentPos);
    volOrigin.height += 5.0;
    return currentPos;//Cesium.Cartographic.toCartesian(volOrigin);
}
function getAircraftRotationMatrix() {
    var rot = geofs.aircraft.instance.object3d.worldRotation;
    var rotMat = new Cesium.Matrix3(rot[0][0], rot[0][1], rot[0][2], rot[1][0], rot[1][1], rot[1][2], rot[2][0], rot[2][1], rot[2][2]);
    return rotMat;
}
/*
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
    */


geofs.api.addFrameCallback(function () {
    lightModStage.uniforms.volOrigin = getVolOrigin();
    lightModStage.uniforms.aircraftRotMat = getAircraftRotationMatrix();
}
)




scene.postProcessStages.add(lightModStage);