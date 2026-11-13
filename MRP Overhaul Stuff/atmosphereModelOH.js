/* DEVELOPER NOTES AS OF 11/12/2026:
This appears to be some sort of extremely unfinished shader experiment. Probably for a unified cloud + atmosphere volume, which
I now know is a very poor idea for this sort of raymarched implementation.
It doesn't do anything special. Load it into the console and adjust your graphics settings to update with the new shader.
(That puts into perspective how old this likely is, since it was written before I found the function to do that inline.)
*/

var noiseTexture = 'https://rawcdn.githack.com/Ariakim-Taiyo/GeoFS-Shaders-Repository/b83ea40b7be449747e953e6a6db8f2356f7cb30e/resources/download%20(4).png' // 2D tileable noise atlas for clouds
var atmosphereSource = `
precision highp float;

// New uniforms for medium composition control.
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
//uniform sampler2D noiseTexture;         // used for clouds texturing
const int mediumType = 0;                 // 0: atmosphere, 1: smoke, 2: rain, 3: clouds
const float densityMultiplier = 100.0;        // overall density multiplier
//uniform float noiseScale;               // scale factor for noise lookup
varying vec2 v_textureCoordinates;

const float EarthRadius = 6371.0;
const float ScaleHeight = 80000.0; // scale height in meters for air density falloff
const int numViewSteps = 100;
const int numLightSteps = 50;
const float lightMarchDistance = 100000.0; // maximum march distance toward the sun

// Integrate along the view ray, computing wavelength-dependent absorption.
vec4 marchAtmosphereVolume(vec3 rayDir, vec3 camPos, float geomDist) {
    float t = 0.0;
    float dt = geomDist / float(numViewSteps);
    vec3 totalScattering = vec3(0.0);
    
    for (int i = 0; i < numViewSteps; i++) {
        vec3 pos = camPos + rayDir * t;
        float height = max(length(pos) - EarthRadius, 0.0);
        
        // Base density with exponential falloff.
        float density = exp(-height / ScaleHeight) * densityMultiplier;
        
        // For clouds, modulate density with a noise texture.
        //if(mediumType == 3) {
        //    float noiseVal = texture2D(noiseTexture, v_textureCoordinates * noiseScale).r;
        //    density *= noiseVal;
        //}
        
        // Define absorption coefficients for each medium (per wavelength).
        vec3 absorptionCoeff;
        if(mediumType == 1) {             // Smoke
            absorptionCoeff = vec3(0.8, 0.7, 0.6);
        } else if(mediumType == 2) {      // Rain
            absorptionCoeff = vec3(1.0, 0.9, 0.8);
        } else if(mediumType == 3) {      // Clouds
            absorptionCoeff = vec3(0.9, 0.9, 0.9);
        } else {                        // Default atmosphere
            absorptionCoeff = vec3(0.7, 0.85, 1.0);
        }
        
        // Compute wavelength-dependent optical depth along light ray.
        vec3 opticalDepth = vec3(0.0);
        float ds = lightMarchDistance / float(numLightSteps);
        vec3 sunDir = normalize(czm_sunPositionWC - pos);
        for (int j = 0; j < numLightSteps; j++) {
            vec3 samplePoint = pos + sunDir * (float(j) * ds);
            float sampleHeight = max(length(samplePoint) - EarthRadius, 0.0);
            float sampleDensity = exp(-sampleHeight / ScaleHeight) * densityMultiplier;
            //if(mediumType == 3) {
            //    float sampleNoise = texture2D(noiseTexture, v_textureCoordinates * noiseScale).r;
            //    sampleDensity *= sampleNoise;
            //}
            opticalDepth += sampleDensity * absorptionCoeff * ds;
        }
        // Apply wavelength-dependent Beer-Lambert attenuation.
        vec3 transmittance = vec3(exp(-opticalDepth.r), exp(-opticalDepth.g), exp(-opticalDepth.b));
        
        totalScattering += density * transmittance * dt;
        t += dt;
    }
    
    // Compute an average scattering factor for alpha blending.
    float scatteringAlpha = (totalScattering.r + totalScattering.g + totalScattering.b) / 3.0;
    
    return vec4(totalScattering, scatteringAlpha);
}

void main(void)
{
    vec2 uv = gl_FragCoord.xy / czm_viewport.zw;
    vec3 sceneRGB = texture2D(colorTexture, uv).rgb;

    float depth = czm_unpackDepth(texture2D(depthTexture, uv));
    vec3 camPos = czm_viewerPositionWC;
    vec4 posEC = czm_windowToEyeCoordinates(gl_FragCoord.xy, depth);
    vec4 worldPosEC = czm_inverseView * posEC;
    vec3 wp = worldPosEC.xyz / worldPosEC.w;
    vec3 toEye = wp - czm_viewerPositionWC;
    vec3 rayDir = normalize(toEye);
    
    float geomDist = length(toEye);
    vec4 atmosphereColor = marchAtmosphereVolume(rayDir, camPos, geomDist);
    
    // Blend the original scene color with the computed medium effect.
    vec3 outColor = mix(sceneRGB, atmosphereColor.rgb, atmosphereColor.a);
    gl_FragColor = vec4(outColor, 1.0);
}
`;

var atmosphereStage = new Cesium.PostProcessStage({
    fragmentShader: atmosphereSource,          // the GLSL you now have
    uniforms: {
    }
});
geofs.api.viewer.scene.postProcessStages.add(atmosphereStage);
