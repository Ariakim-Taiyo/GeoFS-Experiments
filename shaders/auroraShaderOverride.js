/* DEVELOPER NOTES AS OF 11/12/2026:
This was the fabled "Aurora Shader" I made because someone in the GE2 server suggested it jokingly. 
I think it was Speedbird, or at least one of the many people who go by Speedbird because this is an aviation community after all.
Sometimes I wonder if it's the same Speedbird I got banned like 6 years ago for being underage on Discord. Fun times.
Anywayyy...
Looks I hadn't figured out that geofs.api.advancedRenderingQuality(); exists so you'll need to
change a setting in the graphics panel to load it in. Otherwise it just kicks you out of 
advanced atmosphere.

Another fun fact; I decided to release all of these scripts because someone on the GeoFS subreddit vibecoded their own aurora addon
and it reminded me of my old stuff that I need to actually release and not let rot on my dying third hard drive.
*/
geofsShaders["atmosphereCommon.glsl"] = `
precision highp float;
uniform float planetRadius;
uniform float realPlanetRadius;
uniform float atmoRadiusSquared;
uniform vec3 cameraRotation;
#ifdef VOLUMETRIC_CLOUDS
const float windSpeedRatio = 0.0002;
uniform float cloudCover;
uniform float cloudBase;
uniform float cloudTop;
uniform vec3 windVector;
uniform float cloudThickness;
uniform float layerPosition;
uniform float baseThickness;
uniform float layer;
uniform float cloudBaseRadius;
uniform float cloudTopRadius;
#ifdef REALTIME_CLOUDS
uniform sampler2D coverageTexture;
#endif
#endif
/*
float cloudThickness = cloudTop - cloudBase;
float layerPosition = 0.1; // set the layer base to 10% of the cloud height
float baseThickness = cloudThickness * layerPosition;
float layer = cloudBase + baseThickness;
float cloudBase_radius = realPlanetRadius + cloudBase;
float cloudTop_radius = cloudBase_radius + cloudThickness;
*/
const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;
const float FOUR_PI = 12.5663706144;
#ifdef QUALITY_7
#define PRIMARY_STEPS 16
#define LIGHT_STEPS 4
#define CLOUDS_MAX_LOD 1
#define CLOUDS_MARCH_STEP 500.0
#define CLOUDS_DENS_MARCH_STEP 100.0
#define MAXIMUM_CLOUDS_STEPS 300
#define DISTANCE_QUALITY_RATIO 0.00003
#define CLOUD_SHADOWS
#elif defined QUALITY_6
#define PRIMARY_STEPS 12
#define LIGHT_STEPS 4
#define CLOUDS_MAX_LOD 1
#define CLOUDS_MARCH_STEP 500.0
#define CLOUDS_DENS_MARCH_STEP 100.0
#define MAXIMUM_CLOUDS_STEPS 200
#define DISTANCE_QUALITY_RATIO 0.00004
#define CLOUD_SHADOWS
#elif defined QUALITY_5
#define PRIMARY_STEPS 9
#define LIGHT_STEPS 3
#define CLOUDS_MAX_LOD 1
#define CLOUDS_MARCH_STEP 750.0
#define CLOUDS_DENS_MARCH_STEP 150.0
#define MAXIMUM_CLOUDS_STEPS 150
#define DISTANCE_QUALITY_RATIO 0.00005
#define CLOUD_SHADOWS
#elif defined QUALITY_4
#define PRIMARY_STEPS 9
#define LIGHT_STEPS 3
#define CLOUDS_MAX_LOD 1
#define CLOUDS_MARCH_STEP 750.0
#define CLOUDS_DENS_MARCH_STEP 150.0
#define MAXIMUM_CLOUDS_STEPS 100
#define DISTANCE_QUALITY_RATIO 0.00007
#define CLOUD_SHADOWS
#elif defined QUALITY_3
#define PRIMARY_STEPS 6
#define LIGHT_STEPS 2
#define CLOUDS_MAX_LOD 0
#define CLOUDS_MARCH_STEP 750.0
#define CLOUDS_DENS_MARCH_STEP 150.0
#define MAXIMUM_CLOUDS_STEPS 75
#define DISTANCE_QUALITY_RATIO 0.0001
#define CLOUD_SHADOWS
#elif defined QUALITY_2
#define PRIMARY_STEPS 6
#define LIGHT_STEPS 1
#define CLOUDS_MAX_LOD 0
#define CLOUDS_MARCH_STEP 1000.0
#define CLOUDS_DENS_MARCH_STEP 200.0
#define MAXIMUM_CLOUDS_STEPS 50
#define DISTANCE_QUALITY_RATIO 0.0002
#define CLOUD_SHADOWS
#elif defined QUALITY_1
#define PRIMARY_STEPS 3
#define LIGHT_STEPS 1
#define CLOUDS_MAX_LOD 0
#define CLOUDS_MARCH_STEP 1000.0
#define CLOUDS_DENS_MARCH_STEP 200.0
#define MAXIMUM_CLOUDS_STEPS 20
#define DISTANCE_QUALITY_RATIO 0.0004
#elif defined QUALITY_0
#define PRIMARY_STEPS 3
#define LIGHT_STEPS 1
#define CLOUDS_MAX_LOD 0
#define CLOUDS_MARCH_STEP 1000.0
#define CLOUDS_DENS_MARCH_STEP 200.0
#define MAXIMUM_CLOUDS_STEPS 10
#define DISTANCE_QUALITY_RATIO 0.0004
#else //DEFAULT
#define PRIMARY_STEPS 9
#define LIGHT_STEPS 2
#define CLOUDS_MAX_LOD 1
#define CLOUDS_MARCH_STEP 750.0
#define CLOUDS_DENS_MARCH_STEP 150.0
#define MAXIMUM_CLOUDS_STEPS 40
#define DISTANCE_QUALITY_RATIO 0.0002
#define CLOUD_SHADOWS
#endif
#define CLOUDS_MAX_VIEWING_DISTANCE 250000.0
vec2 raySphereIntersect(vec3 r0, vec3 rd, float sr) {
float a = dot(rd, rd);
float b = 2.0 * dot(rd, r0);
float c = dot(r0, r0) - (sr * sr);
float d = (b * b) - 4.0 * a * c;
    if (d < 0.0) return vec2(-1.0, -1.0);
float squaredD = sqrt(d);
    return vec2(
        (-b - squaredD) / (2.0 * a),
        (-b + squaredD) / (2.0 * a)
    );
}
float reMap(float value, float old_low, float old_high, float new_low, float new_high) {
    return new_low + (value - old_low) * (new_high - new_low) / (old_high - old_low);
}
float saturate(float value) {
    return clamp(value, 0.0, 1.0);
}
float isotropic() {
    return 0.07957747154594767; //1.0 / (4.0 * PI);
}
float rayleigh(float costh) {
    return (3.0 / (16.0 * PI)) * (1.0 + pow(costh, 2.0));
}
float HenyeyGreenstein(float g, float costh)
{
    return (1.0 - g * g) / (FOUR_PI * pow(1.0 + g * g - 2.0 * g * costh, 3.0 / 2.0));
}
float Schlick(float k, float costh) {
    return (1.0 - k * k) / (FOUR_PI * pow(1.0 - k * costh, 2.0));
}

mat3 createXYRotationMatrix(float xDegrees, float yDegrees) {
    float xRadians = radians(xDegrees);
    float yRadians = radians(yDegrees);

    float cosX = cos(xRadians);
    float sinX = sin(xRadians);
    float cosY = cos(yRadians);
    float sinY = sin(yRadians);
    
    // Rotation around the X axis (Technically Z axis but oh well)
    mat3 xRotation = mat3(cosX, -sinX, 0.0,
                sinX,  cosX, 0.0,
                0.0,       0.0,      1.0);
    
    // Rotation around the Y axis
    mat3 yRotation = mat3(cosY,  0.0, sinY,
                          0.0,   1.0,  0.0,
                         -sinY,  0.0, cosY);
    
    // Combine the two rotations
    return yRotation * xRotation;
}

mat4 contrastMatrix( float contrast )
{
	float t = ( 1.0 - contrast ) / 2.0;
    
    return mat4( contrast, 0, 0, 0,
                 0, contrast, 0, 0,
                 0, 0, contrast, 0,
                 t, t, t, 1 );

}

vec4 computeAuroraNoiseValues(vec3 auroraSkyRotation) {
    vec4 fullNoise = vec4(1.0, 1.8, 1.5, 0.01);
    vec4 minNoise = vec4(0.2, 1.8, 40.9, 0.0);
    float latValue = abs(auroraSkyRotation.y - 90.0);
    float mixValue = clamp((latValue / 180.0) * 2.5, 0.0, 1.0);
    return mix(minNoise, fullNoise, mixValue);
}

vec4 computeColorMultiplier(vec3 auroraSkyRotation) {
    vec4 maxColor = vec4(1.15, -1.5, 1.2, 0.043);
    vec4 minColor = vec4(2.15, -0.5, 1.2, 0.1);
    float latValue = abs(auroraSkyRotation.y - 90.0);
    float mixValue = clamp(0.5 + (latValue / 180.0), 0.0, 1.0);
    return mix(maxColor, minColor, mixValue);
}

float computeMixValue(vec3 auroraSkyRotation) {
    float latValue = abs(auroraSkyRotation.y - 90.0);
    float mixValue = clamp((latValue / 180.0) * 2.5, 0.0, 1.0);
    return mixValue;
}

const mat2 m2 = mat2(0.95534, 0.29552, -0.29552, 0.95534);
    float tri(in float x) { return clamp(abs(fract(x) - 0.5), 0.01, 0.49); }
    vec2 tri2(in vec2 p) { return vec2(tri(p.x) + tri(p.y), tri(p.y + tri(p.x))); }

    float triNoise2d(in vec2 p, float spd) {
    vec4 noiseValues = computeAuroraNoiseValues(cameraRotation);
    float z = noiseValues.y;
    float z2 = noiseValues.z;
    float rz = noiseValues.w;

    // Adjust this scale factor to change the overall scale of the noise
    float noiseScale = noiseValues.x; // Decrease this value to make the noise larger, increase to make it smaller
    p *= noiseScale;
    
    p *= mat2(cos(p.x * 0.06), sin(p.x * 0.06), -sin(p.x * 0.06), cos(p.x * 0.06));
    vec2 bp = p;
    for (float i = 0.0; i < 5.0; i++) {
        // Adjust this scale factor to change the detail scale
        float detailScale = 1.85; // Decrease for larger details, increase for smaller details
        vec2 dg = tri2(bp * detailScale) * 0.75;
        dg *= mat2(cos(czm_frameNumber * spd), sin(czm_frameNumber * spd), -sin(czm_frameNumber * spd), cos(czm_frameNumber * spd));
        p -= dg / z2;
        bp *= 1.3;
        z2 *= 0.55;
        z *= 0.62;
        p *= 1.21 + (rz - 1.0) * 0.02;
        rz += tri(p.x + tri(p.y)) * z;
        p *= -m2;
    }
    
    // Adjust this factor to change the intensity of the noise
    float intensityFactor = 29.0; // Increase for more contrast, decrease for less contrast
    return clamp(1.0 / pow(rz * intensityFactor, 1.3), 0.0, 0.55);
}

vec3 light_intensity = vec3(150.0);//vec3(100.0); // how bright the light is, affects the brightness of the atmosphere
vec3 beta_ray = vec3(5.5e-6, 13.0e-6, 22.4e-6);//vec3(5.5e-6, 13.0e-6, 22.4e-6); // the amount rayleigh scattering scatters the colors (for earth: causes the blue atmosphere)
vec3 beta_mie = vec3(21e-6); // vec3(21e-6);// the amount mie scattering scatters colors
vec3 beta_ambient = vec3(0.0); // the amount of scattering that always occurs, can help make the back side of the atmosphere a bit brighter
float g = 0.9; // the direction mie scatters the light in (like a cone). closer to -1 means more towards a single direction
float height_ray = 10e3; // how high do you have to go before there is no rayleigh scattering?
float height_mie = 3.2e3; // the same, but for mie
float density_multiplier = 4.0; // 1.0 - how much extra the atmosphere blocks light
#ifdef ADVANCED_ATMOSPHERE
vec4 calculate_scattering(
  vec3 start, // the start of the ray (the camera position)
  vec3 dir, // the direction of the ray (the camera vector)
  float maxDistance, // the maximum distance the ray can travel (because something is in the way, like an object)
  vec3 light_dir
) {
  float a = dot(dir, dir);
  float b = 2.0 * dot(dir, start);
  float c = dot(start, start) - atmoRadiusSquared;
  float d = (b * b) - 4.0 * a * c;
  if (d < 0.0) return vec4(0.0);
  float squaredD = sqrt(d);
  vec2 ray_length = vec2(
    max((-b - squaredD) / (2.0 * a), 0.0),
    min((-b + squaredD) / (2.0 * a), maxDistance)
  );
  if (ray_length.x > ray_length.y) return vec4(0.0);
  bool allow_mie = maxDistance > ray_length.y;
  float step_size_i = (ray_length.y - ray_length.x) / float(PRIMARY_STEPS);
  float ray_pos_i = ray_length.x;
  vec3 total_ray = vec3(0.0); // for rayleigh
  vec3 total_mie = vec3(0.0); // for mie
  vec2 opt_i = vec2(0.0);
  vec2 scale_height = vec2(height_ray, height_mie);
  float mu = dot(dir, light_dir);
  float mumu = mu * mu;
  float gg = g * g;
  float phase_ray = 3.0 / (50.2654824574) * (1.0 + mumu);
  float phase_mie = (allow_mie ? 3.0 : 0.5) / (25.1327412287) * ((1.0 - gg) * (mumu + 1.0)) / (pow(1.0 + gg - 2.0 * mu * g, 1.5) * (2.0 + gg));
  for (int i = 0; i < PRIMARY_STEPS; ++i) {
    vec3 pos_i = start + dir * (ray_pos_i + step_size_i);
    float height_i = length(pos_i) - planetRadius;
    vec2 density = exp(-height_i / scale_height) * step_size_i;
    opt_i += density;
    a = dot(light_dir, light_dir);
    b = 2.0 * dot(light_dir, pos_i);
    c = dot(pos_i, pos_i) - atmoRadiusSquared;
    d = (b * b) - 4.0 * a * c;
    if (d <= 0.0) d = 1.0; // not supposed to be required but this avoids the black singularity line at dusk and dawn
    float step_size_l = (-b + sqrt(d)) / (2.0 * a * float(LIGHT_STEPS));
    float ray_pos_l = 0.0;
    vec2 opt_l = vec2(0.0);
    for (int l = 0; l < LIGHT_STEPS; ++l) {
      vec3 pos_l = pos_i + light_dir * (ray_pos_l + step_size_l * 0.5);
      float height_l = length(pos_l) - planetRadius;
      opt_l += exp(-height_l / scale_height) * step_size_l;
      ray_pos_l += step_size_l;
    }
    vec3 attn = exp(-((beta_mie * (opt_i.y + opt_l.y)) + (beta_ray * (opt_i.x + opt_l.x))));
    total_ray += density.x * attn;
    total_mie += density.y * attn;
    ray_pos_i += step_size_i;
  }
  float opacity = length(exp(-((beta_mie * opt_i.y) + (beta_ray * opt_i.x)) * density_multiplier));
  return vec4((
      phase_ray * beta_ray * total_ray // rayleigh color
      + phase_mie * beta_mie * total_mie // mie
      + opt_i.x * beta_ambient // and ambient
    ) * light_intensity, 1.0 - opacity);
}

vec4 calculate_aurora_scattering(
    vec3 start,             // the start of the ray (the camera position)
    vec3 dir,               // the direction of the ray (the camera vector)
    float maxDistance      // the maximum distance the ray can travel (because something is in the way, like an object)
) {
    float a = dot(dir, dir);
    float b = 2.0 * dot(dir, start);
    float c = dot(start, start) - atmoRadiusSquared;
    float d = (b * b) - 4.0 * a * c;
    if (d < 0.0) return vec4(0.0);
    
    float squaredD = sqrt(d);
    vec2 ray_length = vec2(
        max((-b - squaredD) / (2.0 * a), 0.0),
        min((-b + squaredD) / (2.0 * a), maxDistance)
    );
        
    float step_size_i = (ray_length.y - ray_length.x) / float(50);
    float ray_pos_i = ray_length.x;

    // Aurora addition
    vec4 colorMult = computeColorMultiplier(cameraRotation);
    vec4 total_aurora = vec4(0.0);
    vec4 avgCol = vec4(0.0);
    float contrast = 1.02;
    for (int i = 0; i < 50; ++i) {
        mat3 rotMat = createXYRotationMatrix(cameraRotation.x, cameraRotation.y);
        mat3 rotMatDoubled = createXYRotationMatrix(cameraRotation.x * 2.0, cameraRotation.y * 2.0);
            vec3 dirCorrect = (rotMat * dir);
            vec3 startAur = (start - (czm_viewerPositionWC)).xyz;
            vec3 lightDef = vec3(0.0, 0.0, 1.0);
            float directionalIntensity = clamp(sqrt(dot(dirCorrect + (rotMatDoubled * vec3(1.0)), (rotMatDoubled) * lightDef) * (computeMixValue(cameraRotation))), 0.0, 1.0);
            startAur.x += mod(cameraRotation.y * 0.5, 10.0);
            startAur.y += mod(cameraRotation.x * 0.25, 10.0);
            float pt = ((.8+pow(float(i),1.4)*.002)-startAur.z)/(dirCorrect.z*2.+0.4);
            vec3 bpos = startAur + pt * dirCorrect;
            vec2 p = bpos.yx;
            float rzt = triNoise2d(p, 0.002);
            vec4 ARVTV = contrastMatrix(contrast) * vec4(vec3(rzt), 1.0);
            float adjustedRZT = (ARVTV.x + ARVTV.y + ARVTV.z) / 3.0;
            vec4 col2 = vec4(0.0, 0.0, 0.0, adjustedRZT);
            col2.rgb = (sin(1.0 - colorMult.xyz + float(i) * colorMult.w) * 0.5 + 0.5) * adjustedRZT;
            avgCol = mix(avgCol, col2, 0.5);
            total_aurora += avgCol * exp2(-float(i) * 0.065 - 2.5) * smoothstep(0.0, 5.0, float(i));
            total_aurora *= (clamp(dirCorrect.z*15.+1.,0.,1.));
            total_aurora *= directionalIntensity;
        ray_pos_i += step_size_i;
        float sceneDepth = maxDistance/10000.0;
        if (pt < 0.1 || sceneDepth < 0.9) {
            total_aurora = vec4(0.0);
        }
            //return vec4(vec3(directionalIntensity), 1.0);
    }
    return total_aurora * 2.8;
}

#endif
#ifdef VOLUMETRIC_CLOUDS
float hash(float p)
{
    p = fract(p * .1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}
float noise(in vec3 x) {
vec3 p = floor(x);
vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
float n = p.x + p.y * 157.0 + 113.0 * p.z;
    return mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
        mix(hash(n + 157.0), hash(n + 158.0), f.x), f.y),
        mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
            mix(hash(n + 270.0), hash(n + 271.0), f.x), f.y), f.z);
}
int lastFlooredPosition;
float lastLiveCoverageValue = 0.0;
float cloudDensity(vec3 p, vec3 wind, int lod, inout float heightRatio) {
float finalCoverage = cloudCover;
    #ifdef REALTIME_CLOUDS
vec3 sphericalNormal = normalize(p);
vec2 positionSurfaceC = czm_ellipsoidWgs84TextureCoordinates(sphericalNormal);
float sampledValue = texture(coverageTexture, positionSurfaceC).r;
    lastLiveCoverageValue = clamp((sampledValue - 0.3) * 10.0, 0.0, 1.0);
    finalCoverage *= lastLiveCoverageValue;
    #endif
    if (finalCoverage <= 0.1) return 0.0;
float height = length(p) - realPlanetRadius;
    heightRatio = (height - cloudBase) / cloudThickness;
float positionResolution = 0.002;
    p = p * positionResolution + wind;
float shape = noise(p * 0.3);
float shapeHeight = noise(p * 0.05);
float bn = 0.50000 * noise(p); p = p * 2.0;
    if (lod >= 1) bn += 0.20000 * noise(p); p = p * 2.11;
float cumuloNimbus = saturate((shapeHeight - 0.5) * 2.0);
    cumuloNimbus *= saturate(1.0 - pow(heightRatio - 0.5, 2.0) * 4.0);
float cumulus = saturate(1.0 - pow(heightRatio - 0.25, 2.0) * 25.0) * shapeHeight;
float stratoCumulus = saturate(1.0 - pow(heightRatio - 0.12, 2.0) * 60.0) * (1.0 - shapeHeight);
float dens = saturate(stratoCumulus + cumulus + cumuloNimbus) * 2.0 * finalCoverage;
    dens -= 1.0 - shape;
    dens -= bn;
    return clamp(dens, 0.0, 1.0);
}
#endif
`
geofsShaders["atmosphereOnlyFS.glsl"] = `
precision highp float;
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
#ifdef VOLUMETRIC_CLOUDS
uniform sampler2D volumetricCloudsTexture;
#endif
uniform float backgroundFogDensity;
uniform vec4 backgroundFogColor;
uniform float volumetricFogDensity;
uniform float volumetricFogBottom;
uniform float volumetricFogTop;
in vec2 v_textureCoordinates;
void main() {
  vec4 color = texture(colorTexture, v_textureCoordinates);
  vec4 rawDepthColor = texture(depthTexture, v_textureCoordinates);
  float depth = rawDepthColor.r; // depth packing algo appears to be buggy on mobile so only use the most significant element for now
  vec4 positionEC = czm_windowToEyeCoordinates(gl_FragCoord.xy, depth);
  vec4 worldCoordinate = czm_inverseView * positionEC;
  vec3 vWorldPosition = worldCoordinate.xyz / worldCoordinate.w;
  vec3 posToEye = vWorldPosition - czm_viewerPositionWC;
  vec3 direction = normalize(posToEye);
  vec3 lightDirection = normalize(czm_sunPositionWC);
  float distance = length(posToEye);
  float elevation;

  #ifdef RETRO
  if (depth >= 0.9) {
    gl_FragColor = color;
    return;
  }
  #endif
  if (depth >= 1.0) {
    elevation = length(czm_viewerPositionWC) - (realPlanetRadius);
    distance = max(distance, 10000000.0); // max out the distance when looking at the sky to avoid clamp/arc artefact
  }
  else {
    elevation = length(vWorldPosition) - (realPlanetRadius);
  }
  float fragFogDensity;
  fragFogDensity = clamp((volumetricFogTop - elevation) / (volumetricFogTop - volumetricFogBottom), 0.0, 1.0) * volumetricFogDensity * depth; // volumetric
  color = mix(color, vec4(czm_lightColor, 1.0), clamp(fragFogDensity, 0.0, 1.0));
  #if defined(VOLUMETRIC_CLOUDS)
    float depthMaskDistance = 0.5;
    if (length(czm_viewerPositionWC) < cloudBaseRadius) {
        depthMaskDistance = 0.9; // try to include distant trees and object in the mask
    }
    #if defined(CLOUD_SHADOWS)
        float baseDistance = cloudBaseRadius + baseThickness;
        if (depth < 1.0 && czm_lightColor.z > 0.15 && length(vWorldPosition) < baseDistance) {
            vec3 wind = windVector * czm_frameNumber * windSpeedRatio;
            float mask = 1.0;
            vec2 toClouds = raySphereIntersect(vWorldPosition, -lightDirection, baseDistance);
            vec3 position = vWorldPosition + (-lightDirection * toClouds.x);
            float hr;
            float dens = cloudDensity(position, wind, 0, hr);
            mask = clamp(1.0 - dens, 0.2, 1.0);
            color *= mask;
        }
    #endif
  #endif
  #ifdef ADVANCED_ATMOSPHERE
    vec4 atmosphereColor = calculate_scattering(
        czm_viewerPositionWC,
        direction,
        distance,
        lightDirection
    );
    vec4 auroraColor = calculate_aurora_scattering(
        czm_viewerPositionWC,
        direction,
        distance
    );
    color = atmosphereColor + color * (1.0 - atmosphereColor.a);
    float pixelBrightness = 1.0 * (((atmosphereColor.r / 2.0) + (atmosphereColor.g * 6.0) + (atmosphereColor.b * 700.0)) / 3.0);
    auroraColor *= clamp(1.0 / pixelBrightness, 0.0, 1.0);
    color = auroraColor + color;
    #ifdef VOLUMETRIC_CLOUDS
        vec4 clouds = texture(volumetricCloudsTexture, v_textureCoordinates);
        clouds.rgb *= 3.0;
        color = mix(color, clouds, clouds.a * clouds.a * clamp((depth - depthMaskDistance) * 100.0, 0.0, 1.0));
    #endif
        float exposure = 1.2;
        color = vec4(1.0 - exp(-exposure * color));
  #endif
  float backFogDensity;
  backFogDensity += backgroundFogDensity * depth;
  color = mix(color, vec4(backgroundFogColor.rgb, 1.0), clamp(backFogDensity, 0.0, 1.0));
  gl_FragColor = color;
}

`

function getAngleOffset() {
    var latitude = geofs.aircraft.instance.llaLocation[0];
    var longitude = geofs.aircraft.instance.llaLocation[1];

    var degreesRotationY = 90 * (1 - latitude / 90);

    var degreesRotationX = longitude;

    return new Cesium.Cartesian3(degreesRotationX, degreesRotationY, 0.0);
}


geofs.fx.atmosphere.create = function(a, b, c, d, e) {
    var f = this;
    this.advancedAtmosphere != a && this.destroy();
    this.volumetricClouds != c && this.destroy();
    this.quality != b && this.destroy();
    this.realTimeClouds != d && this.destroy();
    this.retro != e && this.destroy();
    if (!geofs.fx.atmosphere.postProcessingStages) {
        this.reset();
        var g = a ? "#define ADVANCED_ATMOSPHERE\n" : ""
          , k = "#define QUALITY_" + b + "\n"
          , m = c ? "#define VOLUMETRIC_CLOUDS\n" : ""
          , p = d ? "#define REALTIME_CLOUDS\n" : ""
          , q = e ? "#define RETRO\n" : ""
          , x = .01 * weather.definition.cloudCover;
        this.quality = b;
        this.advancedAtmosphere = a;
        this.volumetricClouds = c && a;
        this.realTimeClouds = d;
        this.retro = e;
        geofs.api.useNativeAtmosphere(!this.advancedAtmosphere);
        a = geofs.fx.atmosphere.planetRadius + 111E3;
        geofs.fx.atmosphere.realPlanetRadius = geofs.fx.atmosphere.planetRadius + 1E4;
        a *= a;
        geofs.fx.atmosphere.atmospherePostProcessStage = new Cesium.PostProcessStage({
            fragmentShader: g + q + p + m + k + geofsShaders["atmosphereCommon.glsl"] + geofsShaders["atmosphereOnlyFS.glsl"],
            uniforms: {
                planetRadius: geofs.fx.atmosphere.planetRadius,
                realPlanetRadius: geofs.fx.atmosphere.realPlanetRadius,
                atmoRadiusSquared: a,
                backgroundFogDensity: 0,
                backgroundFogColor: geofs.fx.atmosphere.color,
                volumetricFogDensity: 0,
                volumetricFogBottom: 0,
                volumetricFogTop: 0,
                cameraRotation: function() {return new getAngleOffset();}
            }
        });
        if (c) {
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.volumetricCloudsTexture = "volumetricClouds";
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.windVector = weather.currentWindVectorWC;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudCover = x;
            c = weather.definition.cloudTop - weather.definition.cloudBase;
            e = c * geofs.fx.atmosphere.cloudLayerPosition;
            var z = weather.definition.cloudBase + e
              , A = geofs.fx.atmosphere.realPlanetRadius + weather.definition.cloudBase
              , n = A + c;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudBase = weather.definition.cloudBase;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudTop = weather.definition.cloudTop;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.layerPosition = geofs.fx.atmosphere.cloudLayerPosition;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudThickness = c;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.baseThickness = e;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.layer = z;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudBaseRadius = A;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudTopRadius = n;
            var r = clamp(.12 * b, .25, 1);
            geofs.fx.atmosphere.cloudsPostProcessStage = new Cesium.PostProcessStage({
                textureScale: r,
                fragmentShader: g + q + p + m + k + geofsShaders["atmosphereCommon.glsl"] + geofsShaders["volumetricCloudsFS.glsl"],
                uniforms: {
                    planetRadius: geofs.fx.atmosphere.planetRadius,
                    realPlanetRadius: geofs.fx.atmosphere.realPlanetRadius,
                    atmoRadiusSquared: a,
                    windVector: weather.currentWindVectorWC,
                    cloudCover: x,
                    cloudBase: weather.definition.cloudBase,
                    cloudTop: weather.definition.cloudTop,
                    layerPosition: geofs.fx.atmosphere.cloudLayerPosition,
                    cloudThickness: c,
                    baseThickness: e,
                    layer: z,
                    cloudBaseRadius: A,
                    cloudTopRadius: n,
                    noiseTexture: "/shaders/noise/bluenoise.png",
                    cameraRotation: function() {return getAngleOffset();}
                }
            });
            d && (x = 1,
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.coverageTexture = weather.realTimeCloudTexture + "?t=" + geofs.utils.hourStamp(),
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudCover = x,
            geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.coverageTexture = weather.realTimeCloudTexture + "?t=" + geofs.utils.hourStamp(),
            geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.cloudCover = x);
            geofs.fx.atmosphere.blurStage = Cesium.PostProcessStageLibrary.createBlurStage();
            geofs.fx.atmosphere.blurStage.uniforms.delta = 1;
            geofs.fx.atmosphere.blurStage.uniforms.sigma = 2;
            geofs.fx.atmosphere.blurStage.uniforms.stepSize = clamp(6 - b, 1, 4);
            geofs.fx.atmosphere.postProcessingStages = new Cesium.PostProcessStageComposite({
                inputPreviousStageTexture: !1,
                stages: [new Cesium.PostProcessStageComposite({
                    inputPreviousStageTexture: !0,
                    stages: [geofs.fx.atmosphere.cloudsPostProcessStage, geofs.fx.atmosphere.blurStage],
                    name: "volumetricClouds"
                }), geofs.fx.atmosphere.atmospherePostProcessStage]
            })
        } else
            geofs.fx.atmosphere.postProcessingStages = geofs.fx.atmosphere.atmospherePostProcessStage;
        $(document).on("terrainProviderWillUpdate", function() {
            geofs.fx.globeLoaded = !1;
            f.destroy()
        });
        $(document).on("globeLoaded", function() {
            geofs.fx.atmosphere.addPostProcessingStage();
            geofs.fx.atmosphere.tileLoadProgressListener()
        });
        geofs.fx.atmosphere.tileLoadProgressListener = geofs.api.viewer.scene.globe.tileLoadProgressEvent.addEventListener(function(D) {
            2 < D && (geofs.fx.globeLoaded = !0,
            $("body").trigger("globeLoaded"))
        });
        geofs.fx.atmosphere.addPostProcessingStage()
    }
}

geofs.fx.atmosphere.destroy();
geofs.fx.atmosphere.create();
geofs.api.viewer.scene.preRender.addEventListener(function() {
    var angleOffset = getAngleOffset();
    geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cameraRotation = angleOffset;
})
