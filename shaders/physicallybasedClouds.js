/* DEVELOPER NOTES AS OF 11/12/2026:
This looks like one of the oldest versions of my cloud shaders, and therefore runs like crap
and looks only marginally less like crap. Still better than the stock GeoFS clouds at the time, but very expensive and
unoptimized. Even my beefy computer dips into the 40fps range when running this, even though I can run Deferred on nearly max settings without 
framerate loss (shameless Deferred plug i guess).
Among the many things missing are proper ambient lighting and aerial perspective.
*/
geofsShaders["atmosphereCommon.glsl"] = `
    precision highp float;

    // Atmosphere parameters
    uniform float planetRadius;          // e.g. approximate WGS84 Earth radius
    uniform float realPlanetRadius;      // actual planet radius for height computations
    uniform float atmoRadiusSquared;     // (planetRadius + atmosphereHeight)^2
    uniform sampler2D volNoiseTexture;

    // If volumetric clouds are enabled, these uniforms will be present
    #ifdef VOLUMETRIC_CLOUDS
    const float windSpeedRatio = 0.0002;         // base speed ratio for wind
    uniform float cloudCover;                    // coverage from 0..1
    uniform float cloudBase;                     // base altitude of cloud layer
    uniform float cloudTop;                      // top altitude of cloud layer
    uniform float cloudThickness;                // thickness of the entire cloud layer
    uniform vec3  windVector;                    // direction and relative strength of wind
    uniform float layerPosition;                 // controls layering (unused in this version, but can help position layers)
    uniform float baseThickness;                 // partial thickness from base for sub-layers
    uniform float layer;                         // absolute altitude of a sub-layer
    uniform float cloudBaseRadius;               // realPlanetRadius + cloudBase
    uniform float cloudTopRadius;                // realPlanetRadius + cloudTop
    uniform float density;
    #ifdef REALTIME_CLOUDS
        uniform sampler2D coverageTexture;         // optional coverage map
    #endif
    #endif

    // Basic constants
    const float PI      = 3.14159265359;
    const float TWO_PI  = 6.28318530718;
    const float FOUR_PI = 12.5663706144;

    // Quality-based macros (just placeholders-feel free to tune)
    #ifdef QUALITY_7
    #define PRIMARY_STEPS           16
    #define LIGHT_STEPS             4
    #define CLOUDS_MAX_LOD          1
    #define CLOUDS_MARCH_STEP       500.0
    #define CLOUDS_DENS_MARCH_STEP  100.0
    #define MAXIMUM_CLOUDS_STEPS    300
    #define DISTANCE_QUALITY_RATIO  0.00003
    #define CLOUD_SHADOWS
    #define CLOUD_BLEND
    #define GODRAYS
    #elif defined QUALITY_6
    #define PRIMARY_STEPS           12
    #define LIGHT_STEPS             4
    #define CLOUDS_MAX_LOD          1
    #define CLOUDS_MARCH_STEP       500.0
    #define CLOUDS_DENS_MARCH_STEP  100.0
    #define MAXIMUM_CLOUDS_STEPS    200
    #define DISTANCE_QUALITY_RATIO  0.00004
    #define CLOUD_SHADOWS
    #define CLOUD_BLEND
    #elif defined QUALITY_5
    #define PRIMARY_STEPS           9
    #define LIGHT_STEPS             3
    #define CLOUDS_MAX_LOD          1
    #define CLOUDS_MARCH_STEP       750.0
    #define CLOUDS_DENS_MARCH_STEP  150.0
    #define MAXIMUM_CLOUDS_STEPS    150
    #define DISTANCE_QUALITY_RATIO  0.00005
    #define CLOUD_SHADOWS
    #elif defined QUALITY_4
    #define PRIMARY_STEPS           9
    #define LIGHT_STEPS             3
    #define CLOUDS_MAX_LOD          1
    #define CLOUDS_MARCH_STEP       750.0
    #define CLOUDS_DENS_MARCH_STEP  150.0
    #define MAXIMUM_CLOUDS_STEPS    100
    #define DISTANCE_QUALITY_RATIO  0.00007
    #define CLOUD_SHADOWS
    #elif defined QUALITY_3
    #define PRIMARY_STEPS           6
    #define LIGHT_STEPS             2
    #define CLOUDS_MAX_LOD          0
    #define CLOUDS_MARCH_STEP       750.0
    #define CLOUDS_DENS_MARCH_STEP  150.0
    #define MAXIMUM_CLOUDS_STEPS    75
    #define DISTANCE_QUALITY_RATIO  0.0001
    #define CLOUD_SHADOWS
    #elif defined QUALITY_2
    #define PRIMARY_STEPS           6
    #define LIGHT_STEPS             1
    #define CLOUDS_MAX_LOD          0
    #define CLOUDS_MARCH_STEP       1000.0
    #define CLOUDS_DENS_MARCH_STEP  200.0
    #define MAXIMUM_CLOUDS_STEPS    50
    #define DISTANCE_QUALITY_RATIO  0.0002
    #define CLOUD_SHADOWS
    #elif defined QUALITY_1
    #define PRIMARY_STEPS           3
    #define LIGHT_STEPS             1
    #define CLOUDS_MAX_LOD          0
    #define CLOUDS_MARCH_STEP       1000.0
    #define CLOUDS_DENS_MARCH_STEP  200.0
    #define MAXIMUM_CLOUDS_STEPS    20
    #define DISTANCE_QUALITY_RATIO  0.0004
    #elif defined QUALITY_0
    #define PRIMARY_STEPS           3
    #define LIGHT_STEPS             1
    #define CLOUDS_MAX_LOD          0
    #define CLOUDS_MARCH_STEP       1000.0
    #define CLOUDS_DENS_MARCH_STEP  200.0
    #define MAXIMUM_CLOUDS_STEPS    10
    #define DISTANCE_QUALITY_RATIO  0.0004
    #else // DEFAULT
    #define PRIMARY_STEPS           9
    #define LIGHT_STEPS             2
    #define CLOUDS_MAX_LOD          1
    #define CLOUDS_MARCH_STEP       750.0
    #define CLOUDS_DENS_MARCH_STEP  150.0
    #define MAXIMUM_CLOUDS_STEPS    40
    #define DISTANCE_QUALITY_RATIO  0.0002
    #define CLOUD_SHADOWS
    #endif

    #define CLOUDS_MAX_VIEWING_DISTANCE 250000.0

    //------------------------------------------------------
    // HELPER FUNCTIONS
    //------------------------------------------------------

    vec2 raySphereIntersect(vec3 r0, vec3 rd, float sphereRadius)
    {
        // Intersection of ray with sphere of radius sphereRadius
        float a = dot(rd, rd);
        float b = 2.0 * dot(rd, r0);
        float c = dot(r0, r0) - (sphereRadius * sphereRadius);
        float d = (b * b) - 4.0 * a * c;
        if (d < 0.0) return vec2(-1.0, -1.0);

        float sqrtD = sqrt(d);
        return vec2(
            (-b - sqrtD) / (2.0 * a),
            (-b + sqrtD) / (2.0 * a)
        );
    }

    float reMap (float value, float old_low, float old_high, float new_low, float new_high)
    {
        return new_low + (value - old_low) * (new_high - new_low) / (old_high - old_low);
    }

    float saturate(float x)
    {
        return clamp(x, 0.0, 1.0);
    }

    // Basic scattering phase approximations
    float isotropic()
    {
        // 1 / (4 * PI)
        return 0.07957747154594767;
    }

    float HenyeyGreenstein(float g, float costh)
    {
        // (1 - g^2) / [ (4π) * (1 + g^2 - 2g*costh)^(3/2) ]
        return (1.0 - g*g) / (FOUR_PI * pow(1.0 + g*g - 2.0*g*costh, 1.5));
    }

    float Schlick(float k, float costh)
    {
        // Schlick phase function approximation
        // (1 - k^2) / [ (4π) * (1 - k * cosθ)^2 ]
        return (1.0 - k*k) / (FOUR_PI * pow(1.0 - k*costh, 2.0));
    }

    /*vec3 MultipleOctaveScattering(float density, float mu) {
        float attenuation = 0.2;
        float contribution = 0.2;
        float phaseAttenuation = 0.5;

        float a = 1.0;
        float b = 1.0;
        float c = 1.0;
        float g = 0.85;
        const float scatteringOctaves = 4.0;
        
        vec3 luminance = vec3(0.0);

        for (float i = 0.0; i < scatteringOctaves; i++) {
            float phaseFunction = PhaseFunction(0.3 * c, mu);
            vec3 beers = exp(-density * EXTINCTION_MULT * a);

            luminance += b * phaseFunction * beers;

            a *= attenuation;
            b *= contribution;
            c *= (1.0 - phaseAttenuation);
        }
        return luminance;
    }*/
    
    //------------------------------------------------------
    // ATMOSPHERE SCATTERING CONSTANTS
    //------------------------------------------------------

    // Increase/decrease for brightness
    vec3 light_intensity = vec3(60.0);

    // Rayleigh scattering coefficients (B, G, R)
    vec3 beta_ray = vec3(5.5e-6, 13.0e-6, 22.4e-6);

    // Mie scattering coefficient
    vec3 beta_mie = vec3(21e-6);

    // Any constant ambient
    vec3 beta_ambient = vec3(0.0);

    // Mie direction
    float g = 0.8;

    // Scale heights
    float height_ray = 10000.0;  // ~10km
    float height_mie = 3200.0;   // ~3.2km

    // Extra multiplier for absorption
    float density_multiplier = 2.0;

    //------------------------------------------------------
    // ADVANCED ATMOSPHERE (single scattering + partial Mie)
    //------------------------------------------------------
    #ifdef ADVANCED_ATMOSPHERE
    vec4 calculate_scattering(
        vec3 start,       // camera/world position
        vec3 dir,         // ray direction
        float maxDistance,// distance to a surface or horizon
        vec3 light_dir,
        bool lowRes
    )
    {
        int pSteps = PRIMARY_STEPS;
        int lSteps = LIGHT_STEPS;
        if (lowRes) {
            pSteps /= 4;
            lSteps /= 4;
        }
        // Solve for atmosphere intersection
        float a = dot(dir, dir);
        float b = 2.0 * dot(dir, start);
        float c = dot(start, start) - atmoRadiusSquared;
        float d = (b * b) - 4.0 * a * c;
        if(d < 0.0) return vec4(0.0);

        float sqrtD = sqrt(d);
        // entry, exit for atmosphere
        vec2 rayT = vec2(
            max( (-b - sqrtD) / (2.0 * a), 0.0 ),
            min( (-b + sqrtD) / (2.0 * a), maxDistance )
        );

        if(rayT.x > rayT.y) return vec4(0.0);

        bool allowMie = (maxDistance > rayT.y);

        float segment = rayT.y - rayT.x;
        float stepSize = segment / float(pSteps);

        float accumRayPos = rayT.x;

        vec3 totalRay = vec3(0.0);  // integrated Rayleigh
        vec3 totalMie = vec3(0.0);  // integrated Mie
        vec2 opticalDepth = vec2(0.0);

        vec2 scaleHeight = vec2(height_ray, height_mie);

        float mu = dot(dir, light_dir);
        float mu2 = mu * mu;
        float gg = g*g;

        // Phase function approximations
        float phaseRay = 3.0 / (16.0*PI) * (1.0 + mu2);
        float phaseMie = (allowMie ? 3.0 : 0.5) / (8.0*PI)
                    * ( (1.0 - gg) * (mu2 + 1.0) )
                    / pow(1.0 + gg - 2.0*g*mu, 1.5);

        for(int i = 0; i < pSteps; i++)
        {
            // sample position
            float sampleT = accumRayPos + 0.5 * stepSize;
            vec3 pos = start + dir * sampleT;
            float heightLocal = length(pos) - planetRadius;
            vec2 localDensity = exp(-heightLocal / scaleHeight) * stepSize;

            opticalDepth += localDensity;

            // sunlight steps
            // a quick approximation of how much atmosphere is between this sample and the sun
            float aL = dot(light_dir, light_dir);
            float bL = 2.0 * dot(light_dir, pos);
            float cL = dot(pos, pos) - atmoRadiusSquared;
            float dL = (bL*bL) - 4.0*aL*cL;
            if(dL < 0.0) dL = 1.0; // avoid negative

            float sunT = (-bL + sqrt(dL)) / (2.0*aL*float(lSteps));
            float sunAccum = 0.0;
            vec2 sunOptDepth = vec2(0.0);

            for(int l = 0; l < lSteps; l++)
            {
                float sT = sunAccum + 0.5*sunT;
                vec3 sunPos = pos + light_dir * sT;
                float sunHeight = length(sunPos) - planetRadius;
                sunOptDepth += exp(-sunHeight / scaleHeight) * sunT;
                sunAccum += sunT;
            }

            // combined attenuation
            vec3 attenuation = exp( - (beta_mie*(opticalDepth.y + sunOptDepth.y)
                                    + beta_ray*(opticalDepth.x + sunOptDepth.x)) );

            totalRay += localDensity.x * attenuation;
            totalMie += localDensity.y * attenuation;

            accumRayPos += stepSize;
        }

        float opacity = length( exp(- (beta_mie * opticalDepth.y + beta_ray * opticalDepth.x) * density_multiplier) );

        // final single scattering
        vec3 colorRay = phaseRay * beta_ray * totalRay;
        vec3 colorMie = phaseMie * beta_mie * totalMie;
        vec3 color = (colorRay + colorMie + opticalDepth.x * beta_ambient) * light_intensity;

        return vec4(color, 1.0 - opacity);
    }
    #endif // ADVANCED_ATMOSPHERE

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

    vec4 sampleVolume(vec3 p, vec2 atlasRes) {
        // Total number of slices in the atlas.
        float gridRows = 6.0;
        float gridCols = 6.0;
        float totalSlices = (gridRows * gridCols);
        
        // Recover the slice index from p.z.
        // (The atlas generator mapped sliceIndex to a normalized value as:
        //    sliceNormalized = sliceIndex / (totalSlices - 1)
        // so here we do the inverse.)
        float sliceIndex = round(p.z * (totalSlices - 1.0));
        
        // Compute the (integer) tile coordinates in the atlas.
        float tileX = mod(sliceIndex, float(gridCols));
        float tileY = floor(sliceIndex / float(gridCols));
        
        // Each tile’s pixel dimensions:
        vec2 tileSize = atlasRes / vec2(float(gridCols), float(gridRows));
        
        // Compute the tile’s origin (in pixels).
        vec2 tileOrigin = vec2(tileX, tileY) * tileSize;
        
        // p.x and p.y are assumed to be in [0,1] (local to the slice).
        // Compute the absolute atlas UV coordinate in pixels.
        vec2 uvAtlas = tileOrigin + vec2(p.x, p.y) * tileSize;
        
        // Normalize back to [0,1] by dividing by the atlas resolution.
        return texture2D(volNoiseTexture, uvAtlas / atlasRes);
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
    vec3 pDetail = p;

    float shape = noise(p * 0.3);
    float shapeHeight = noise(p * 0.05);
    float bn = 0.50000 * noise(p);
    p = p * 2.0;
    if (lod >= 1)
        bn += 0.20000 * noise(p);
    p = p * 2.11;

    float cumuloNimbus = saturate((shapeHeight - 0.5) * 2.0);
    cumuloNimbus *= saturate(1.0 - pow(heightRatio - 0.5, 2.0) * 4.0);
    float cumulus = saturate(1.0 - pow(heightRatio - 0.25, 2.0) * 25.0) * shapeHeight;
    float stratoCumulus = saturate(1.0 - pow(heightRatio - 0.12, 2.0) * 60.0) * (1.0 - shapeHeight);
    
    float dens = saturate(stratoCumulus + cumulus + cumuloNimbus) * 2.0 * finalCoverage;
    dens -= 1.0 - shape;
    dens -= bn;
    if (lod == 1) {
            float detailNoise = sampleVolume(fract(pDetail * 1.0), vec2(500.0)).r;
            float detailIntensity = 1.0;  // Adjust this factor to taste.
            if (dens > 0.01) {
                dens += (detailNoise - 0.5) * detailIntensity;
            } else {
                dens += (detailNoise - 0.5) * detailIntensity / 2.0;
            }
        }
    // Apply the uniform density factor to reduce (or increase) overall cloud density.
    dens *= density;

    return clamp(dens, 0.0, 1.0);
    }
    #endif
`

geofsShaders["volumetricCloudsFS.glsl"] = `
// =============================================================================
// Physically Accurate Volumetric Clouds Shader for GeoFS (with Δ–Eddington Two-Stream)
// =============================================================================

precision highp float;

// ----- Uniforms and Varyings -----
uniform sampler2D noiseTexture;
uniform sampler2D depthTexture;
uniform sampler2D mieLUT;
uniform sampler2D mieLUTAdvanced;
uniform float cloudScatter;      // scattering coefficient
uniform float cloudExtinct;      // extinction coefficient
uniform float dropletSize;       // in microns
uniform vec3 aircraftPos;
varying vec2 v_textureCoordinates;

// Δ–Eddington asymmetry parameter (water droplets ~0.85)
const float ASYMMETRY_G = 0.85;

// ----- Ray-march & light integration settings -----
const float minDistance = 10.0;
const int PHYSICAL_PRIMARY_STEPS = MAXIMUM_CLOUDS_STEPS;
const int PHYSICAL_LIGHT_STEPS   = LIGHT_STEPS;
const float CLOUD_LIGHT_DISTANCE = 500.0;

// ACES tone mapping
vec3 ACESFilm(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// Linear fog factor
float fogFactorLinear(float dist, float start, float end) {
    return 1.0 - clamp((end - dist) / (end - start), 0.0, 1.0);
}

// Compute Δ–Eddington corrected albedo and asymmetry
float deltaEddingtonAlbedo(float omega0) {
    float num = omega0 * (1.0 - ASYMMETRY_G * ASYMMETRY_G);
    float den = max(0.0001, (1.0 - omega0 * ASYMMETRY_G * ASYMMETRY_G));
    return num / den;
}
float deltaEddingtonAsymmetry() {
    return 2.0 * ASYMMETRY_G / (1.0 + ASYMMETRY_G * ASYMMETRY_G);
}

// Beer-Powder attenuation (unchanged)
float beerPowderAttenuation(float extinction, float dist) {
    float beerTerm   = exp(-extinction * dist);
    float powderTerm = 1.0 - exp(-2.0 * extinction * dist);
    return mix(beerTerm, powderTerm, 0.1);
}

// Light transmittance toward sun (unchanged)
float computeLightTransmittance(vec3 p, vec3 lightDir, vec3 wind, out float shadowFact) {
    float trans = 1.0;
    float stepL = CLOUD_LIGHT_DISTANCE / float(PHYSICAL_LIGHT_STEPS);
    for (int j = 0; j < PHYSICAL_LIGHT_STEPS; ++j) {
        float tL = (float(j) + 0.5) * stepL;
        vec3 pos = p + lightDir * tL;
        float sdf = length(pos - aircraftPos) - 50.0;
        shadowFact = clamp(smoothstep(-75.0, 75.0, sdf), 0.0, 1.0);
        float dummy; 
        float dens = cloudDensity(pos, wind, CLOUDS_MAX_LOD, dummy) * density;
        float sigmaE = cloudExtinct * dens;
        float att = mix(
            beerPowderAttenuation(sigmaE, stepL),
            beerPowderAttenuation(sigmaE * 0.2, stepL) * 0.75,
            0.5
        );
        trans *= att * shadowFact;
        if (trans < 0.01) break;
    }
    return clamp(trans, 0.0, 1.0);
}

// Main Δ–Eddington two-stream integration
vec4 calculate_clouds_physical(
    vec3 start, vec3 dir, float maxDistance,
    vec3 sunDir, vec3 wind, vec3 pixelWorld
) {
    // Ray-sphere intersect to find tmin/tmax (unchanged)...
    vec2 topHit  = raySphereIntersect(start, dir, cloudTopRadius);
    vec2 baseHit = raySphereIntersect(start, dir, cloudBaseRadius);
    float h0 = length(start) - realPlanetRadius;
    float tmin = minDistance;
    float tmax = min(maxDistance, CLOUDS_MAX_VIEWING_DISTANCE);
    if (h0 > cloudTop) {
        if (topHit.x < 0.0) return vec4(0.0);
        tmin = topHit.x;
        tmax = (baseHit.x>0.0) ? min(baseHit.x, maxDistance) : min(topHit.y, maxDistance);
    } else if (h0 < cloudBase) {
        if (baseHit.y>0.0) tmin = baseHit.y;
        tmax = min(topHit.y, maxDistance);
    } else {
        tmax = (baseHit.x>0.0) ? min(baseHit.x, maxDistance) : min(topHit.y, maxDistance);
    }
    if (tmax < tmin) return vec4(0.0);

    float stepSize = (tmax - tmin) / float(PHYSICAL_PRIMARY_STEPS);
    vec2 noiseUV = mod(gl_FragCoord.xy / 512.0, vec2(1.0));
    float dither = (texture2D(noiseTexture, noiseUV).r * 2.0 - 1.0) * 0.5;
    float totalTrans = 1.0;
    vec3  accumColor  = vec3(0.0);

    // Precompute Δ–Eddington
    float omega0 = clamp(cloudScatter / max(0.0001, cloudExtinct), 0.0, 1.0);
    float w0p    = deltaEddingtonAlbedo(omega0);
    float gp     = deltaEddingtonAsymmetry();

    float tt = -1.0;
    for (int i = 0; i < PHYSICAL_PRIMARY_STEPS; ++i) {
        float t = tmin + dither * stepSize + (float(i) + 0.5) * stepSize;
        if (t > tmax) break;
        vec3 pos = start + dir * t;
        int lod = CLOUDS_MAX_LOD - int(t * DISTANCE_QUALITY_RATIO);
        float heightRatio;
        float dens = cloudDensity(pos, wind, lod, heightRatio) * density;
        if (dens < 1e-4) continue;
        if (tt < 0.0) tt = t;

        // Extinction & two-stream optical depth
        float sigmaT = cloudExtinct * dens;
        float tau    = sigmaT * stepSize * (1.0 - omega0 * ASYMMETRY_G * ASYMMETRY_G);
        float Tdir   = clamp(exp(-tau), 0.0, 1.0);

        // Single and diffuse sources
        float mu      = dot(dir, sunDir);
        float phase   = HenyeyGreenstein(gp, mu);
        float Sdir    = w0p * phase * Tdir;
        float Sdiff   = (w0p / max(1e-4, (1.0 - w0p))) * (1.0 - Tdir);

        // Light & shadow
        float shadow;
        float lightT = computeLightTransmittance(pos, sunDir, wind, shadow);
        vec3 ambient = czm_lightColor * mix(0.0, 0.2, heightRatio) * 0.5;
        vec3 Lslice  = (czm_lightColor * (Sdir + Sdiff) * lightT + ambient) * shadow;

        accumColor     += totalTrans * Lslice;
        totalTrans    *= Tdir;
        if (totalTrans < 0.01) break;
    }

    float alpha = clamp(1.0 - totalTrans, 0.0, 1.0);
    vec3  backColor = czm_lightColor;
#ifdef CLOUD_BLEND
    if (tt > 1000.0) {
        backColor = calculate_scattering(czm_viewerPositionWC, dir, tt, sunDir, true).rgb;
    }
#endif
    float mixF = fogFactorLinear(clamp(tt/100000.0, 0.0, 0.99), 0.0, 1.0);
    vec3  color = mix(accumColor, backColor, mixF);
    return vec4(color, alpha);
}

void main() {
    vec4 raw = vec4(0.0);
    if (cloudCover < 0.01) {
        gl_FragColor = raw;
        return;
    }
    vec4 dc = texture(czm_globeDepthTexture, v_textureCoordinates);
    float d1 = dc.r;
    float d2 = clamp(czm_unpackDepth(texture2D(depthTexture, gl_FragCoord.xy / czm_viewport.zw)), 0.0, 1.0);
#ifdef VOLUMETRIC_CLOUDS
    vec3  wind     = windVector * float(czm_frameNumber) * windSpeedRatio;
    vec4  posEC    = czm_windowToEyeCoordinates(gl_FragCoord.xy, d2);
    vec4  wEC      = czm_inverseView * posEC;
    vec3  worldPos = wEC.xyz / wEC.w;
    vec3  dir      = normalize(worldPos - czm_viewerPositionWC);
    vec3  sunDir   = normalize(czm_sunPositionWC);
    float maxD     = (d1 == 1.0) ? CLOUDS_MAX_VIEWING_DISTANCE : length(worldPos - czm_viewerPositionWC);
    raw = calculate_clouds_physical(czm_viewerPositionWC, dir, maxD, sunDir, wind, worldPos);
#endif
    vec3 tone = ACESFilm(raw.rgb * 0.25);
    gl_FragColor = vec4(pow(tone, vec3(1.0/2.2)), raw.a);
}
`;




geofsShaders["atmosphereOnlyFS.glsl"] = `
    precision highp float;
    uniform sampler2D colorTexture;
    uniform bool godRaysEnabled;
    uniform sampler2D depthTexture;
    uniform sampler2D noiseTexture;
    #ifdef VOLUMETRIC_CLOUDS
    uniform sampler2D volumetricCloudsTexture;
    #endif
    uniform float backgroundFogDensity;
    uniform vec4 backgroundFogColor;
    uniform float volumetricFogDensity;
    uniform float volumetricFogBottom;
    uniform float volumetricFogTop;
    in vec2 v_textureCoordinates;

    vec3 WorldPosFromDepth(float depth, vec2 screenSize, mat4 invViewProj) {
        vec2 ndc = (gl_FragCoord.xy / screenSize) * 2.0 - 1.0;
        vec4 clipPos = vec4(ndc, depth, 1.0);
        vec4 worldPos = invViewProj * clipPos;
        return worldPos.xyz / worldPos.w;
    }

    vec3 computeVolumetricLightShafts(vec3 direction, vec3 wind) {
        // Retrieve the depth at this fragment.
        float depth = (czm_readDepth(depthTexture, gl_FragCoord.xy / czm_viewport.zw));
        //if (depth >= 1.0) return vec3(0.0);
        // Reconstruct the world-space position at the near plane (depth = 0) and at the current depth.
        vec3 rayStart = czm_viewerPositionWC;//WorldPosFromDepth(0.0, czm_viewport.zw, czm_inverseViewProjection);
        vec3 rayEnd =   WorldPosFromDepth(depth, czm_viewport.zw, czm_inverseViewProjection);
        vec3 rayDir   = direction;//normalize(rayEnd - rayStart);
        float maxDist = distance(rayStart, rayEnd);// * 1000.0;
        float totalDistance = 10000.0;
        //if (maxDist >= 5000.0) {
        //    maxDist = 5000.0;
        //}
        // Define the number of steps for our low-resolution march.
        const int NUM_STEPS = 20;
        float rayStep = totalDistance / float(NUM_STEPS);
        vec3 sunDir = normalize(czm_sunPositionWC);
        // Use blue noise to dither the starting sample position.
        vec2 noiseUV = mod(gl_FragCoord.xy / czm_viewport.zw, vec2(1.0));
        float noiseVal = texture2D(noiseTexture, noiseUV).r;
        float sunStretchNoise = texture2D(noiseTexture, noiseUV + vec2(0.5)).r;
        float stretchScale = 100.0; // Adjust this value as needed

        vec3 rayPos = rayStart + rayDir * rayStep * (noiseVal * 1.0);// + (sunDir * stretchScale);
        
        // Initialize accumulation of clear-sky (lit) samples.
        float accum = 0.0;
        
        // For this low-res integration, we assume no wind (or you can supply a wind vector).
        // Use the sun’s world-space direction (normalize czm_sunPositionWC).
        // March along the view ray.
        for (int i = 0; i < NUM_STEPS; i++) {
            float dummyMain;
            float densMain = cloudDensity(rayPos, wind, 0, dummyMain) * density;
            if (densMain > 0.05) {
                break;
            }
            if (maxDist < distance(rayStart, rayPos)) {
                break;
            }
            // At each sample point, cast a short ray toward the sun to check if clouds are present.
            const int SUN_STEPS = 5;
            const float sunStepSize = 1000.0; // in meters (adjust as needed)
            bool inShadow = false;
            for (int j = 0; j < SUN_STEPS; j++) {
                vec3 sunRayPos = rayPos + sunDir * (float(j) + 0.5) * sunStepSize;
                float dummy;
                // Call your cloudDensity function (lod 0 is used here).  
                // If density exceeds a threshold, consider the sample in shadow.
                float dens = cloudDensity(sunRayPos, wind, 0, dummy);
                if (dens > 0.05) {
                    inShadow = true;
                    accum += 0.5;
                    break;
                }
            }
            // If the sample is clear (not in shadow), add to the accumulation.
            if (!inShadow) {
                accum += 0.0;
            }
            rayPos += rayDir * rayStep;
        }
        
        // Compute an effective light amount.
        float intensity = 0.0002; // overall scaling factor (adjust as needed)
        float d = accum * rayStep * intensity;
        
        // Apply a "powder" and Beer–Lambert combination:
        float powder = 1.0 - exp(-2.0 * d);
        float beer   = exp(-d);
        vec3 final = vec3((1.0 - beer) * powder);
        // Return the final volumetric light shaft contribution.
        return final;
    }

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
        vec3 godrays;
        if (godRaysEnabled) {
            godrays = computeVolumetricLightShafts(direction, windVector * czm_frameNumber * windSpeedRatio);
        } else {
            godrays = vec3(0.0);
        }
        #ifdef GODRAYS
            godrays = computeVolumetricLightShafts(direction, windVector * czm_frameNumber * windSpeedRatio);
        #endif

        #ifdef RETRO
        if (depth >= 0.9) {
            gl_FragColor = color;
            return;
        }
        #endif
        if (depth >= 1.0) {
            elevation = length(czm_viewerPositionWC) - (realPlanetRadius);
            distance = max(distance, 10000000.0); // max out the distance when looking at the sky to avoid clamp/arc artefact
        } else {
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
            mask = clamp(1.0 - dens * 2.0, 0.2, 1.0);
            color *= mask;
        }
        #endif
        #endif
        #ifdef ADVANCED_ATMOSPHERE
        vec4 atmosphereColor = calculate_scattering(
            czm_viewerPositionWC,
            direction,
            distance,
            lightDirection,
            false
        );
        color = atmosphereColor + color * (1.0 - atmosphereColor.a);
        #ifdef VOLUMETRIC_CLOUDS
        vec4 clouds = texture(volumetricCloudsTexture, v_textureCoordinates);
        clouds.rgb *= 3.0;
        color = mix(color, clouds, clouds.a); // * clouds.a * clamp((depth - depthMaskDistance) * 100.0, 0.0, 1.0)
        #endif
        float exposure = 1.2;
        color = vec4(1.0 - exp(-exposure * color));
        #endif
        float backFogDensity;
        backFogDensity += backgroundFogDensity * depth;
        color = mix(color, vec4(backgroundFogColor.rgb, 1.0), clamp(backFogDensity, 0.0, 1.0));
        color.rgb /= clamp(godrays * 2.5, 1.0, 100.0);
        gl_FragColor = color;
    }

`
var godRays = false;

function getVolOrigin() {
    try {
        var currentPos = Cesium.Matrix4.getTranslation(geofs.aircraft.instance.object3d.model._model.modelMatrix, new Cesium.Cartesian3);
        return currentPos;
    } catch (e) {
        console.log(e, " likely aircraft change");
    }
}

geofs.preferences.weather.advanced.cloudDensity = 1.0;
geofs.preferences.weather.advanced.cloudScatter = 0.15;
geofs.preferences.weather.advanced.cloudExtinct = 0.05;
geofs.preferences.weather.advanced.dropletSize = 10.0;
geofs.fx.atmosphere.create = function (a, b, c, d, e) {
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
            , n = d ? "#define REALTIME_CLOUDS\n" : ""
            , q = e ? "#define RETRO\n" : ""
            , u = weather.definition.cloudCover * .01;
        this.quality = b;
        this.advancedAtmosphere = a;
        this.volumetricClouds = c && a;
        this.realTimeClouds = d;
        this.retro = e;
        geofs.api.useNativeAtmosphere(!this.advancedAtmosphere);
        a = geofs.fx.atmosphere.planetRadius + geofs.fx.atmosphere.atmosphereThickness;
        geofs.fx.atmosphere.realPlanetRadius = geofs.fx.atmosphere.planetRadius + geofs.fx.atmosphere.planetRadiusOffset;
        a *= a;
        geofs.fx.atmosphere.atmospherePostProcessStage = new Cesium.PostProcessStage({
            fragmentShader: g + q + n + m + k + geofsShaders["atmosphereCommon.glsl"] + geofsShaders["atmosphereOnlyFS.glsl"],
            uniforms: {
                planetRadius: geofs.fx.atmosphere.planetRadius,
                realPlanetRadius: geofs.fx.atmosphere.realPlanetRadius,
                atmoRadiusSquared: a,
                backgroundFogDensity: 0,
                backgroundFogColor: geofs.fx.atmosphere.color,
                volumetricFogDensity: 0,
                volumetricFogBottom: 0,
                volumetricFogTop: 0,
                density: geofs.preferences.weather.advanced.cloudDensity,
                godRaysEnabled: godRays,
                noiseTexture: "/shaders/noise/bluenoise.png",
                volNoiseTexture: "https://rawcdn.githack.com/Ariakim-Taiyo/GeoFS-Shaders-Repository/b83ea40b7be449747e953e6a6db8f2356f7cb30e/resources/download%20(4).png"
            }
        });
        if (c) {
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.volumetricCloudsTexture = "volumetricClouds";
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.windVector = weather.currentWindVectorWC;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudCover = u;
            c = weather.definition.cloudTop - weather.definition.cloudBase;
            e = c * geofs.fx.atmosphere.cloudLayerPosition;
            var z = weather.definition.cloudBase + e
                , B = geofs.fx.atmosphere.realPlanetRadius + weather.definition.cloudBase
                , p = B + c;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudBase = weather.definition.cloudBase;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudTop = weather.definition.cloudTop;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.layerPosition = geofs.fx.atmosphere.cloudLayerPosition;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudThickness = c;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.baseThickness = e;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.layer = z;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudBaseRadius = B;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudTopRadius = p;
            var r = clamp(b * .12, .25, 1);
            geofs.fx.atmosphere.cloudsPostProcessStage = new Cesium.PostProcessStage({
                textureScale: r,
                fragmentShader: g + q + n + m + k + geofsShaders["atmosphereCommon.glsl"] + geofsShaders["volumetricCloudsFS.glsl"],
                uniforms: {
                    planetRadius: geofs.fx.atmosphere.planetRadius,
                    realPlanetRadius: geofs.fx.atmosphere.realPlanetRadius,
                    atmoRadiusSquared: a,
                    windVector: weather.currentWindVectorWC,
                    cloudCover: u,
                    cloudBase: weather.definition.cloudBase,
                    cloudTop: weather.definition.cloudTop,
                    layerPosition: geofs.fx.atmosphere.cloudLayerPosition,
                    cloudThickness: c,
                    baseThickness: e,
                    layer: z,
                    cloudBaseRadius: B,
                    cloudTopRadius: p,
                    noiseTexture: "/shaders/noise/bluenoise.png",
                    mieLUT: "https://rawcdn.githack.com/Ariakim-Taiyo/GeoFS-Shaders-Repository/6091474efb0ae04310b541fb99192ce0d8c88faa/resources/mie_phase_function%20(1).png",
                    mieLUTAdvanced: "https://rawcdn.githack.com/Ariakim-Taiyo/GeoFS-Shaders-Repository/568f3729609b82430c7a6ed01d0d3063db166184/resources/mieLutSmooth.png",
                    dropletSize: geofs.preferences.weather.advanced.dropletSize,
                    density: geofs.preferences.weather.advanced.cloudDensity,
                    cloudScatter: geofs.preferences.weather.advanced.cloudScatter,
                    cloudExtinct: geofs.preferences.weather.advanced.cloudExtinct,
                    volNoiseTexture: "https://rawcdn.githack.com/Ariakim-Taiyo/GeoFS-Shaders-Repository/b83ea40b7be449747e953e6a6db8f2356f7cb30e/resources/download%20(4).png",
                    aircraftPos: function() {return new getVolOrigin()}
                }
            });
            d && (u = 1,
                geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.coverageTexture = weather.realTimeCloudTexture + "?t=" + geofs.utils.hourStamp(),
                geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudCover = u,
                geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.coverageTexture = weather.realTimeCloudTexture + "?t=" + geofs.utils.hourStamp(),
                geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.cloudCover = u);
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
        $(document).on("terrainProviderWillUpdate", function () {
            geofs.fx.globeLoaded = !1;
            f.destroy()
        });
        $(document).on("globeLoaded", function () {
            geofs.fx.atmosphere.addPostProcessingStage();
            geofs.fx.atmosphere.tileLoadProgressListener()
        });
        geofs.fx.atmosphere.tileLoadProgressListener = geofs.api.viewer.scene.globe.tileLoadProgressEvent.addEventListener(function (C) {
            C > 2 && (geofs.fx.globeLoaded = !0,
                $("body").trigger("globeLoaded"))
        });
        geofs.fx.atmosphere.addPostProcessingStage()
    }
}

geofs.fx.atmosphere.update = function(a, b) {
    if (geofs.fx.atmosphere.postProcessingStages && (geofs.utils.updateTime(this, this.updatePeriod) || b)) {
        a = geofs.api.viewer.scene.globe.ellipsoid.cartographicToCartesian(new Cesium.Cartographic(a[1] * DEGREES_TO_RAD,a[0] * DEGREES_TO_RAD,0));
        var c = Cesium.Cartesian3.magnitude(a);
        a = c - geofs.fx.atmosphere.planetRadiusOffset;
        b = a + geofs.fx.atmosphere.atmosphereThickness;
        geofs.fx.atmosphere.realPlanetRadius = c;
        c = weather.definition.cloudTop - weather.definition.cloudBase;
        var d = c * geofs.fx.atmosphere.cloudLayerPosition
          , e = weather.definition.cloudBase + d
          , f = geofs.fx.atmosphere.realPlanetRadius + weather.definition.cloudBase
          , g = f + c;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.planetRadius = a;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.realPlanetRadius = geofs.fx.atmosphere.realPlanetRadius;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.atmoRadiusSquared = b * b;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudBase = weather.definition.cloudBase;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudTop = weather.definition.cloudTop;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.layerPosition = geofs.fx.atmosphere.cloudLayerPosition;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudThickness = c;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.baseThickness = d;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.layer = e;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudBaseRadius = f;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudTopRadius = g;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.godRaysEnabled = godRays;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.density = geofs.preferences.weather.advanced.cloudDensity;
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.density = geofs.preferences.weather.advanced.cloudDensity;
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.dropletSize = geofs.preferences.weather.advanced.dropletSize;
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.cloudScatter = geofs.preferences.weather.advanced.cloudScatter;
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.cloudExtinct = geofs.preferences.weather.advanced.cloudExtinct;
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.aircraftPos = function() {return new getVolOrigin()};
        geofs.fx.atmosphere.cloudsPostProcessStage && (geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.planetRadius = a,
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.realPlanetRadius = geofs.fx.atmosphere.realPlanetRadius,
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.cloudBase = weather.definition.cloudBase,
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.cloudTop = weather.definition.cloudTop,
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.layerPosition = geofs.fx.atmosphere.cloudLayerPosition,
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.cloudThickness = c,
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.baseThickness = d,
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.layer = e,
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.cloudBaseRadius = f,
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.cloudTopRadius = g);
        this.realTimeClouds && geofs.utils.updateTime(this, this.cloudsUpdatePeriod) && (geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.coverageTexture = weather.realTimeCloudTexture + "?t=" + geofs.utils.hourStamp(),
        geofs.fx.atmosphere.cloudsPostProcessStage && (geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.coverageTexture = weather.realTimeCloudTexture + "?t=" + geofs.utils.hourStamp()))
    }
}

weather.generateDefinition = function(a, b) {
    a = a || geofs.camera.lla;
    a = parseInt(Math.abs(a[0]));
    var localTime = geofs.preferences.weather.localTime,
        timeRatio = weather.timeRatio,
        quality = geofs.preferences.weather.quality,
        f = quality / 100,
        season = geofs.preferences.weather.season;
    weather.roundedLatitude = a;
    weather.manualQuality = quality;
    weather.manualSeason = season;
    weather.manualTimeOfDay = localTime;
    
    if(b) {
        // These assignments occur when generating a manual definition.
        geofs.preferences.weather.advanced.clouds = Math.min(100, quality * 2);
        geofs.preferences.weather.advanced.cloudBase = weather.defaults.cloudBase;
        geofs.preferences.weather.advanced.cloudThickness = 500 + weather.defaults.cloudThickness * quality * 0.02;
        geofs.preferences.weather.advanced.cloudTop = weather.defaults.cloudBase + 
            (geofs.preferences.weather.advanced.cloudThickness || weather.defaults.cloudThickness);
        geofs.preferences.weather.advanced.fog = (1 - Math.abs(timeRatio - 0.5) * 2) * (f > 0.45 ? 1 - f : 0) * 100;
        geofs.preferences.weather.advanced.fogCeiling = geofs.groundElevation * 2 + 50 || 0;
        geofs.preferences.weather.advanced.precipitationAmount = quality > 50 ? (quality - 50) * 2 : 0;
        geofs.preferences.weather.advanced.windSpeedMS = quality / 6;
        geofs.preferences.weather.advanced.windSpeedKts = geofs.preferences.weather.advanced.windSpeedMS * MS_TO_KNOTS;
        geofs.preferences.weather.advanced.turbulences = f * Math.abs(timeRatio - 0.5) * 2;
        geofs.preferences.weather.advanced.thermals = Math.min(1, f * 4) * Math.abs(timeRatio - 0.5) * 2;
        // Initialize new cloud parameters with defaults if not already set.
        if (geofs.preferences.weather.advanced.cloudDensity === undefined)
            geofs.preferences.weather.advanced.cloudDensity = 1.0; // default in [0,1]
        if (geofs.preferences.weather.advanced.cloudScatter === undefined)
            geofs.preferences.weather.advanced.cloudScatter = 0.15;
        if (geofs.preferences.weather.advanced.cloudExtinct === undefined)
            geofs.preferences.weather.advanced.cloudExtinct = 0.02;
    }
    
    weather.manualDefinition = {
        cloudCover: geofs.preferences.weather.advanced.clouds || weather.defaults.cloudCover,
        cloudBase: geofs.preferences.weather.advanced.cloudBase || weather.defaults.cloudBase,
        cloudTop: (geofs.preferences.weather.advanced.cloudBase || weather.defaults.cloudBase) + 
                  (geofs.preferences.weather.advanced.cloudThickness || weather.defaults.cloudThickness),
        fogDensity: geofs.preferences.weather.advanced.fog || weather.defaults.fogDensity,
        fogBottom: 0,
        fogCeiling: geofs.preferences.weather.advanced.fogCeiling || weather.defaults.fogCeiling,
        precipitationAmount: geofs.preferences.weather.advanced.precipitationAmount || weather.defaults.precipitationAmount,
        precipitationType: season > 75 && weather.isSnowable ? "snow" : "rain",
        thunderstorm: quality > 90 ? (quality - 90) * 10 : 0,
        visibility: 1E4,
        windDirection: geofs.preferences.weather.advanced.windDirection || weather.defaults.windDirection,
        windSpeedMS: geofs.preferences.weather.advanced.windSpeedMS || weather.defaults.windSpeedMS,
        windGustMS: (geofs.preferences.weather.advanced.windSpeedMS || weather.defaults.windSpeedMS) / 4,
        windLayerHeight: 7E3,
        windLayerNb: 3,
        turbulences: geofs.preferences.weather.advanced.turbulences || weather.defaults.turbulences,
        thermals: geofs.preferences.weather.advanced.thermals || weather.defaults.thermals,
        airTemperatureSL: clamp((100 - season - Math.abs(a)) * 0.4 * (1 - timeRatio), -50, 50),
        timestamp: geofs.utils.now(),
        // New parameters:
        cloudDensity: geofs.preferences.weather.advanced.cloudDensity || weather.defaults.cloudDensity,
        cloudScatter: geofs.preferences.weather.advanced.cloudScatter || weather.defaults.cloudScatter,
        cloudExtinct: geofs.preferences.weather.advanced.cloudExtinct || weather.defaults.cloudExtinct,
        dropletSize:  geofs.preferences.weather.advanced.dropletSize  || weather.defaults.dropletSize
    };
    return weather.manualDefinition;
};

function createSlider(gespref, defaultValue, min, max, precision, labelText, sliderId) {
    var sliderDiv = document.createElement("div");
    sliderDiv.className = "slider";
    sliderDiv.setAttribute("data-type", "slider");
    sliderDiv.setAttribute("data-gespref", gespref);
    sliderDiv.setAttribute("data-update", "{weather.setAdvanced()}");
    sliderDiv.setAttribute("value", defaultValue);
    sliderDiv.setAttribute("data-min", min);
    sliderDiv.setAttribute("data-max", max);
    sliderDiv.setAttribute("data-precision", precision);
    sliderDiv.id = sliderId || Math.random().toString();
    sliderDiv.tabIndex = 0;
    
    var sliderRail = document.createElement("div");
    sliderRail.className = "slider-rail";
    
    var sliderSelection = document.createElement("div");
    sliderSelection.className = "slider-selection";
    var percentage = ((defaultValue - min) / (max - min)) * 100;
    sliderSelection.style.width = percentage + "%";
    
    var sliderGrippy = document.createElement("div");
    sliderGrippy.className = "slider-grippy";
    
    var sliderInput = document.createElement("input");
    sliderInput.className = "slider-input";
    sliderInput.min = min;
    sliderInput.max = max;
    sliderInput.step = Math.pow(10, -precision);
    sliderInput.value = defaultValue;
    
    sliderGrippy.appendChild(sliderInput);
    sliderSelection.appendChild(sliderGrippy);
    sliderRail.appendChild(sliderSelection);
    sliderDiv.appendChild(sliderRail);
    
    var sliderLabel = document.createElement("label");
    sliderLabel.textContent = labelText;
    sliderDiv.appendChild(sliderLabel);
    
    sliderInput.addEventListener("input", function() {
        var newVal = parseFloat(sliderInput.value);
        if (gespref.indexOf("cloudDensity") !== -1) {
            geofs.preferences.weather.advanced.cloudDensity = newVal;
        } else if (gespref.indexOf("cloudScatter") !== -1) {
            geofs.preferences.weather.advanced.cloudScatter = newVal;
        } else if (gespref.indexOf("cloudExtinct") !== -1) {
            geofs.preferences.weather.advanced.cloudExtinct = newVal;
        }else if (gespref.indexOf("dropletSize") !== -1) {
            geofs.preferences.weather.advanced.dropletSize = newVal;
        }
        var perc = ((newVal - min) / (max - min)) * 100;
        sliderSelection.style.width = perc + "%";
        weather.setAdvanced();
    });
    
    return sliderDiv;
}

var sliderContainer = $(".geofs-advancedWeather")[0].children[1];

var cloudDensitySlider = createSlider(
    "geofs.preferences.weather.advanced.cloudDensity", 0.50, 0, 1, 2, "Cloud Density", "cloudDensitySlider"
);
var cloudScatterSlider = createSlider(
    "geofs.preferences.weather.advanced.cloudScatter", 0.50, 0, 1, 2, "Cloud Scatter", "cloudScatterSlider"
);
var cloudExtinctSlider = createSlider(
    "geofs.preferences.weather.advanced.cloudExtinct", 0.50, 0, 1, 2, "Cloud Extinction", "cloudExtinctSlider"
);
var dropletSizeSlider = createSlider(
    "geofs.preferences.weather.advanced.dropletSize", 50.0, 0.3, 1000.0, 2, "Droplet Size", "dropletSizeSlider"
);

var targetDiv = $(".geofs-advancedWeather .slider").filter(function() {
    return $(this).find("label").text().trim() === "Clouds Thickness m.";
});

if (typeof alreadyRun === "undefined") alreadyRun = false;
if (!alreadyRun) {
    alreadyRun = true;
    if (targetDiv.length > 0) {
        targetDiv.last().after(cloudDensitySlider, cloudScatterSlider, cloudExtinctSlider, dropletSizeSlider);
    } else {
        var sliderContainer = $(".geofs-advancedWeather")[0].children[1];
        sliderContainer.appendChild(cloudDensitySlider);
        sliderContainer.appendChild(cloudScatterSlider);
        sliderContainer.appendChild(cloudExtinctSlider);
        sliderContainer.appendChild(dropletSizeSlider);
    }
}


geofs.fx.atmosphere.destroy();
geofs.fx.atmosphere.create();
geofs.api.advancedRenderingQuality();