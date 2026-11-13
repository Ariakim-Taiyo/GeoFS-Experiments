/* DEVELOPER NOTES AS OF 11/12/2026:
This was one of my last iterations on the old cloud and atmosphere shader before starting work on what would 
later become Deferred. Initially I ported this shader directly into the later project, but with more control over the rendering
engine, I was able to experiment more with better methods. I was never quite sucessful, and I 
ended up throwing in the towel after I realized I'd have to rewrite it all for GeoFS 4.0 anyway.
I passed the project onto the current lead developer who was able to implement an incredibly impressive cloud system.
True wizardry, I tell you. 
Or,
MiRaClEs :o)
We may never know.

Anyway, this is probably the latest cloud shader that will be present in this repository, it is the 
most feature-complete, prettiest, and still crappily performing version.
*/
geofs.preferences.weather.advanced.cloudDensity = 1;
geofs.preferences.weather.advanced.cloudScatter = 1;
geofs.preferences.weather.advanced.cloudExtinct = 0.05;
geofs.preferences.weather.advanced.dropletSize = 10.0;

geofs.fx.atmosphere.create = function(e, t, a, o, n) {
        if (this.advancedAtmosphere != e && this.destroy(),
        this.volumetricClouds != a && this.destroy(),
        this.quality != t && this.destroy(),
        this.realTimeClouds != o && this.destroy(),
        this.retro != n && this.destroy(),
        geofs.fx.atmosphere.postProcessingStages)
            return;
        this.reset();
        var r = e ? "#define ADVANCED_ATMOSPHERE\n" : ""
          , s = "#define QUALITY_" + t + "\n"
          , c = a ? "#define VOLUMETRIC_CLOUDS\n" : ""
          , d = o ? "#define REALTIME_CLOUDS\n" : ""
          , u = n ? "#define RETRO\n" : ""
          , p = .01 * weather.definition.cloudCover;
        this.quality = t,
        this.advancedAtmosphere = e,
        this.volumetricClouds = a && e,
        this.realTimeClouds = o,
        this.retro = n,
        geofs.api.useNativeAtmosphere(!this.advancedAtmosphere);
        let h = geofs.fx.atmosphere.planetRadius + geofs.fx.atmosphere.atmosphereThickness;
        geofs.fx.atmosphere.realPlanetRadius = geofs.fx.atmosphere.planetRadius + geofs.fx.atmosphere.planetRadiusOffset;
        let m = h * h;
        if (geofs.fx.atmosphere.atmospherePostProcessStage = new Cesium.PostProcessStage({
            fragmentShader: r + u + d + c + s + geofsShaders["atmosphereCommon.glsl"] + geofsShaders["atmosphereOnlyFS.glsl"],
            uniforms: {
                planetRadius: geofs.fx.atmosphere.planetRadius,
                realPlanetRadius: geofs.fx.atmosphere.realPlanetRadius,
                atmoRadiusSquared: m,
                backgroundFogDensity: 0,
                backgroundFogColor: geofs.fx.atmosphere.color,
                volumetricFogDensity: 0,
                volumetricFogBottom: 0,
                volumetricFogTop: 0,
                noiseTexture: "/shaders/noise/bluenoise.png",
                volNoiseTexture: "https://rawcdn.githack.com/Ariakim-Taiyo/GeoFS-Shaders-Repository/b83ea40b7be449747e953e6a6db8f2356f7cb30e/resources/download%20(4).png",
                density: geofs.preferences.weather.advanced.cloudDensity,
                cloudScatter: geofs.preferences.weather.advanced.cloudScatter,
                cloudExtinct: geofs.preferences.weather.advanced.cloudExtinct
            }
        }),
        a) {
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.volumetricCloudsTexture = "volumetricClouds",
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.windVector = weather.currentWindVectorWC,
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudCover = p;
            let f = weather.definition.cloudTop - weather.definition.cloudBase
              , g = f * geofs.fx.atmosphere.cloudLayerPosition
              , y = weather.definition.cloudBase + g
              , v = geofs.fx.atmosphere.realPlanetRadius + weather.definition.cloudBase
              , _ = v + f;
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudBase = weather.definition.cloudBase,
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudTop = weather.definition.cloudTop,
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.layerPosition = geofs.fx.atmosphere.cloudLayerPosition,
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudThickness = f,
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.baseThickness = g,
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.layer = y,
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudBaseRadius = v,
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudTopRadius = _;
            let b = clamp(.12 * t, .25, 1);
            geofs.fx.atmosphere.cloudsPostProcessStage = new Cesium.PostProcessStage({
                textureScale: b,
                fragmentShader: r + u + d + c + s + geofsShaders["atmosphereCommon.glsl"] + geofsShaders["volumetricCloudsFS.glsl"],
                uniforms: {
                    planetRadius: geofs.fx.atmosphere.planetRadius,
                    realPlanetRadius: geofs.fx.atmosphere.realPlanetRadius,
                    atmoRadiusSquared: m,
                    windVector: weather.currentWindVectorWC,
                    cloudCover: p,
                    cloudBase: weather.definition.cloudBase,
                    cloudTop: weather.definition.cloudTop,
                    layerPosition: geofs.fx.atmosphere.cloudLayerPosition,
                    cloudThickness: f,
                    baseThickness: g,
                    layer: y,
                    cloudBaseRadius: v,
                    cloudTopRadius: _,
                    noiseTexture: "/shaders/noise/bluenoise.png",
                    volNoiseTexture: "https://rawcdn.githack.com/Ariakim-Taiyo/GeoFS-Shaders-Repository/b83ea40b7be449747e953e6a6db8f2356f7cb30e/resources/download%20(4).png",
                    density: geofs.preferences.weather.advanced.cloudDensity,
                    cloudScatter: geofs.preferences.weather.advanced.cloudScatter,
                    cloudExtinct: geofs.preferences.weather.advanced.cloudExtinct
                }
            }),
            o && (p = 1,
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.coverageTexture = weather.realTimeCloudTexture + "?t=" + geofs.utils.hourStamp(),
            geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudCover = p,
            geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.coverageTexture = weather.realTimeCloudTexture + "?t=" + geofs.utils.hourStamp(),
            geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.cloudCover = p),
            geofs.fx.atmosphere.blurStage = Cesium.PostProcessStageLibrary.createDepthOfFieldStage(),
            geofs.fx.atmosphere.blurStage.uniforms.delta = 1,
            geofs.fx.atmosphere.blurStage.uniforms.focalDistance = 0.5,
            geofs.fx.atmosphere.blurStage.uniforms.sigma = 1.8,
            geofs.fx.atmosphere.blurStage.uniforms.stepSize = clamp(6 - t, 1, 4),
            geofs.fx.atmosphere.postProcessingStages = new Cesium.PostProcessStageComposite({
                inputPreviousStageTexture: !1,
                stages: [new Cesium.PostProcessStageComposite({
                    inputPreviousStageTexture: !0,
                    stages: [geofs.fx.atmosphere.atmospherePostProcessStage],
                    name: "volumetricClouds"
                })]
            })
        } else
            geofs.fx.atmosphere.postProcessingStages = geofs.fx.atmosphere.atmospherePostProcessStage;
        $(document).on("terrainProviderWillUpdate", () => {
            geofs.fx.globeLoaded = !1,
            this.destroy()
        }
        ),
        $(document).on("globeLoaded", () => {
            geofs.fx.atmosphere.addPostProcessingStage(),
            geofs.fx.atmosphere.tileLoadProgressListener()
        }
        ),
        geofs.fx.atmosphere.tileLoadProgressListener = geofs.api.viewer.scene.globe.tileLoadProgressEvent.addEventListener(e => {
            e > 2 && (geofs.fx.globeLoaded = !0,
            $("body").trigger("globeLoaded"))
        }
        ),
        geofs.fx.atmosphere.addPostProcessingStage()
    }

geofs.fx.atmosphere.update = function (a, b) {
    if (geofs.fx.atmosphere.postProcessingStages && (geofs.utils.updateTime(this, this.updatePeriod) || b)) {
        a = geofs.api.viewer.scene.globe.ellipsoid.cartographicToCartesian(new Cesium.Cartographic(a[1] * DEGREES_TO_RAD, a[0] * DEGREES_TO_RAD, 0));
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
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.density = geofs.preferences.weather.advanced.cloudDensity;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.density = geofs.preferences.weather.advanced.cloudDensity;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.dropletSize = geofs.preferences.weather.advanced.dropletSize;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudScatter = geofs.preferences.weather.advanced.cloudScatter;
        geofs.fx.atmosphere.atmospherePostProcessStage.uniforms.cloudExtinct = geofs.preferences.weather.advanced.cloudExtinct;
        geofs.fx.atmosphere.cloudsPostProcessStage.uniforms.aircraftPos = function () { return new getVolOrigin() };
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

weather.generateDefinition = function (a, b) {
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

    if (b) {
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
        dropletSize: geofs.preferences.weather.advanced.dropletSize || weather.defaults.dropletSize
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

    sliderInput.addEventListener("input", function () {
        var newVal = parseFloat(sliderInput.value);
        if (gespref.indexOf("cloudDensity") !== -1) {
            geofs.preferences.weather.advanced.cloudDensity = newVal;
        } else if (gespref.indexOf("cloudScatter") !== -1) {
            geofs.preferences.weather.advanced.cloudScatter = newVal;
        } else if (gespref.indexOf("cloudExtinct") !== -1) {
            geofs.preferences.weather.advanced.cloudExtinct = newVal;
        } else if (gespref.indexOf("dropletSize") !== -1) {
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

var targetDiv = $(".geofs-advancedWeather .slider").filter(function () {
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




geofsShaders['volumetricCloudsFS.glsl'] = `precision highp float;
in vec2 v_textureCoordinates;
vec3 skyAmbientColor = vec3(0.705, 0.850, 0.952); //0.219, 0.380, 0.541
vec3 groundAmbientColor = vec3(0.5, 0.55, 0.5); //vec3(0.741, 0.898, 0.823); //0.639, 0.858, 0.721
float distanceQualityR = 0.00005; // LOD/quality ratio
float minDistance = 10.0; // avoid cloud in cockpit
#undef PRIMARY_STEPS
#undef LIGHT_STEPS
#define PRIMARY_STEPS 1
#define LIGHT_STEPS 0
vec4 calculate_clouds(
vec3 start,
vec3 dir,
float maxDistance,
vec3 light_dir,
vec3 wind
) {
vec4 cloud = vec4(0.0, 0.0, 0.0, 1.0);
vec2 toTop = raySphereIntersect(start, dir, cloudTopRadius);
vec2 toCloudBase = raySphereIntersect(start, dir, cloudBaseRadius);
float startHeight = length(start) - realPlanetRadius;
float absoluteMaxDistance = CLOUDS_MAX_VIEWING_DISTANCE;
float tmin = minDistance;
float tmax = maxDistance;
if (startHeight > cloudTop) {
if (toTop.x < 0.0) return vec4(0.0); // no intersection with cloud layer
tmin = toTop.x;
if (toCloudBase.x > 0.0) {
tmax = min(toCloudBase.x, maxDistance);
}
else {
tmax = min(toTop.y, maxDistance);
}
}
else if (startHeight < cloudBase) {
tmin = toCloudBase.y;
tmax = min(toTop.y, maxDistance);
}
else {
if (toCloudBase.x > 0.0) {
tmax = min(toCloudBase.x, maxDistance);
}
else {
tmax = min(toTop.y, maxDistance);
}
}
tmin = max(tmin, minDistance);
tmax = min(tmax, absoluteMaxDistance);
if (tmax < tmin) return vec4(0.0); // object obstruction
float rayLength = tmax - tmin;
float longMarchStep = rayLength / float(MAXIMUM_CLOUDS_STEPS);
longMarchStep = max(longMarchStep, CLOUDS_MARCH_STEP);
float shortMarchStep = CLOUDS_DENS_MARCH_STEP;
float numberApproachSteps = (CLOUDS_MARCH_STEP / CLOUDS_DENS_MARCH_STEP) * 2.0;
float ditherAmount = texture(noiseTexture, mod(gl_FragCoord.xy / 512.0, 1.0)).r * 2.0 - 1.0;
float ditherDistance = ditherAmount * shortMarchStep;
float distance = tmin + ditherDistance;
float dens = 0.0;
float marchStep;
float distanceToFirstCloud = 0.0;
float lastDensity;
float gInScattering = 0.9;
float gOutScattering = 0.0;
float kInScattering = 0.99;
float dotLightRay = dot(dir, light_dir);
float inScattering = Schlick(kInScattering, dotLightRay); //HenyeyGreenstein(gInScattering, dotLightRay);
float outScattering = isotropic(); //HenyeyGreenstein(gOutScattering, dotLightRay);
float sunScatteringPhase = mix(outScattering, inScattering, dotLightRay);
float ambientScatteringPhase = isotropic();
bool inCloud = false;
bool rayComplete = false;
float stepsBeforeExitingCloud = 0.0;
for (int i = 0; i < MAXIMUM_CLOUDS_STEPS; i++) {
vec3 position = start + dir * distance;
float depth = distance / CLOUDS_MAX_VIEWING_DISTANCE;
int qualityRatio = int(distance * distanceQualityR);
int lod = CLOUDS_MAX_LOD - qualityRatio;
float heightRatio;
if (inCloud == true) {
marchStep = shortMarchStep;
}
else {
marchStep = longMarchStep;
lod = 0;
}
dens = cloudDensity(position, wind, lod, heightRatio);
if(dens > 0.01) {
if (inCloud != true) {
inCloud = true;
stepsBeforeExitingCloud = numberApproachSteps;
distance = clamp(distance - CLOUDS_MARCH_STEP, tmin, tmax); // take one step back
continue;
}
float deltaDens = clamp((dens - lastDensity) * 10.0, -1.0, 1.0);
float lighting = (abs(deltaDens - dotLightRay) / 2.0) * clamp((heightRatio - 0.02) * 20.0, 0.5, 1.0);
lastDensity = dens;
float scatteringCoeff = 0.25 * dens;
float extinctionCoeff = 0.01 * dens;
cloud.a *= exp(-extinctionCoeff * marchStep);
float sunIntensityAtSurface = clamp(0.2 - dens, 0.0, 1.0);
vec3 sunLight = lighting * czm_lightColor * sunIntensityAtSurface * czm_lightColor.z;
vec3 ambientSun = czm_lightColor * sunIntensityAtSurface * czm_lightColor.z * isotropic();
vec3 skyAmbientLight = (skyAmbientColor * czm_lightColor.z + ambientSun);
vec3 groundAmbientLight = (groundAmbientColor * czm_lightColor.z * 0.5 + ambientSun);
vec3 ambientLight = mix(groundAmbientLight, skyAmbientLight, heightRatio);
vec3 stepScattering = scatteringCoeff * marchStep * (sunScatteringPhase * sunLight + ambientScatteringPhase * ambientLight);
cloud.rgb += cloud.a * stepScattering;
if (cloud.a < 0.01) {
cloud.a = 0.0;
break;
}
if (distanceToFirstCloud == 0.0) {
distanceToFirstCloud = distance;
}
}
else {
if (stepsBeforeExitingCloud > 0.0) {
stepsBeforeExitingCloud--;
}
else {
inCloud = false;
}
}
distance += marchStep;
if (distance > tmax) {
if (rayComplete == true) {
break;
}
else {
rayComplete = true;
distance = tmax;
}
}
}
vec4 atmosphereAtDistance = calculate_scattering(
czm_viewerPositionWC,
dir,
distanceToFirstCloud,
light_dir
) * 0.2; // account for tone mapping
cloud.rgb = cloud.rgb * (1.0 - atmosphereAtDistance.a) + atmosphereAtDistance.rgb;
cloud.a = (1.0 - cloud.a);
return cloud;
}
void main() {
vec4 color = vec4(0.0);
if (cloudCover < 0.1) {
gl_FragColor = color;
return;
}
vec4 rawDepthColor = texture(czm_globeDepthTexture, v_textureCoordinates);
#if !defined(GL_EXT_frag_depth)
float depth = rawDepthColor.r; // depth packing algo appears to be buggy on mobile so only use the most significant element for now
#else
float depth = czm_unpackDepth(rawDepthColor);
#endif
if (depth == 0.0) {
depth = 1.0;
}
#ifdef VOLUMETRIC_CLOUDS
vec4 positionEC = czm_windowToEyeCoordinates(gl_FragCoord.xy, depth);
vec4 worldCoordinate = czm_inverseView * positionEC;
vec3 vWorldPosition = worldCoordinate.xyz / worldCoordinate.w;
vec3 posToEye = vWorldPosition - czm_viewerPositionWC;
vec3 direction = normalize(posToEye);
vec3 lightDirection = normalize(czm_sunPositionWC);
float distance = length(posToEye);
if (depth == 1.0) {
distance = CLOUDS_MAX_VIEWING_DISTANCE;
}
vec3 wind = windVector * czm_frameNumber * windSpeedRatio;
color = calculate_clouds(
czm_viewerPositionWC, // the position of the camera
direction, // the camera vector (ray direction of this pixel)
distance, // max dist, essentially the scene depth
lightDirection, // light direction
wind
);
#endif
gl_FragColor = color;
}
`

geofsShaders["atmosphereOnlyFS.glsl"] = `precision highp float;
uniform sampler2D colorTexture;
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
float depth = rawDepthColor.r;// depth packing algo appears to be buggy on mobile so only use the most significant element for now
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
lightDirection
);
color = atmosphereColor + color * (1.0 - atmosphereColor.a);
/*#ifdef VOLUMETRIC_CLOUDS
vec4 clouds = texture(volumetricCloudsTexture, v_textureCoordinates);
clouds.rgb *= 3.0;
color = mix(color, clouds, clouds.a * clouds.a * clamp((depth - depthMaskDistance) * 100.0, 0.0, 1.0));
#endif*/
float exposure = 1.2;
color = vec4(1.0 - exp(-exposure * color));
#endif
float backFogDensity;
backFogDensity += backgroundFogDensity * depth;
color = mix(color, vec4(backgroundFogColor.rgb, 1.0), clamp(backFogDensity, 0.0, 1.0));
gl_FragColor = color;
}
`
geofsShaders["atmosphereCommon.glsl"] = `
precision highp float;
uniform sampler2D depthTexture;
uniform sampler2D noiseTexture;
uniform sampler2D volNoiseTexture;

uniform float density;
uniform float cloudScatter;
uniform float cloudExtinct;

uniform float planetRadius;
uniform float realPlanetRadius;
uniform float atmoRadiusSquared;
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
#define PRIMARY_STEPS 64
#define LIGHT_STEPS 8
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
float HenyeyGreenstein(float g, float costh) {
    return (1.0 - g * g) / (FOUR_PI * pow(1.0 + g * g - 2.0 * g * costh, 3.0 / 2.0));
}
float Schlick(float k, float costh) {
    return (1.0 - k * k) / (FOUR_PI * pow(1.0 - k * costh, 2.0));
}
float getDepth(in vec4 depth) {
    float z_window = czm_unpackDepth(depth);
    z_window = czm_reverseLogDepth(z_window);
    float n_range = czm_depthRange.near;
    float f_range = czm_depthRange.far;
    return (2.0 * z_window - n_range - f_range) / (f_range - n_range);
}
#ifdef VOLUMETRIC_CLOUDS
float hash(float p) {
    p = fract(p * .1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}
float noise( in vec3 x) {
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
        // (The atlas generator maps sliceIndex to a normalized value as:
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

vec3 light_intensity = vec3(100.0); //vec3(100.0); // how bright the light is, affects the brightness of the atmosphere
vec3 beta_ray = vec3(5.5e-6, 13.0e-6, 22.4e-6); //vec3(5.5e-6, 13.0e-6, 22.4e-6); // the amount rayleigh scattering scatters the colors (for earth: causes the blue atmosphere)
vec3 beta_mie = vec3(21e-6); // vec3(21e-6);// the amount mie scattering scatters colors
vec3 beta_ambient = vec3(0.0); // the amount of scattering that always occurs, can help make the back side of the atmosphere a bit brighter
vec3 beta_absorption = vec3(2.04e-5, 4.97e-5, 1.95e-6);
float g = 0.7; // the direction mie scatters the light in (like a cone). closer to -1 means more towards a single direction
float height_ray = 8e3; // how high do you have to go before there is no rayleigh scattering?
float height_mie = 1.2e3; // the same, but for mie
float height_absorption = 30e3;
float absorption_falloff = 4e3;
float density_multiplier = 4.0; // 1.0 - how much extra the atmosphere blocks light

#ifdef ADVANCED_ATMOSPHERE
vec4 calculate_scattering(
    vec3 start,               // camera position (world)
    vec3 dir,                 // view ray direction (world)
    float max_dist,           // scene depth / far march distance for this pixel
    vec3 light_dir            // sun direction (world)
) {

    float effectiveMaxDist = max_dist;

    vec3  cloudRGB = vec3(0.0);
    float T_view   = 1.0;   // view transmittance through clouds
    float t_first  = 0.0;   // first cloud hit distance
    bool  hitCloud = false;

    #ifdef VOLUMETRIC_CLOUDS
    

    // Intersect ray with cloud shell
    vec2 toTop  = raySphereIntersect(start, dir, cloudTopRadius);
    vec2 toBase = raySphereIntersect(start, dir, cloudBaseRadius);
    float startH = length(start) - realPlanetRadius;

    float tmin = 10.0;               // avoid cockpit
    float tmax = max_dist;

    if (startH > cloudTop) {
        if (toTop.x >= 0.0) {
            tmin = max(tmin, toTop.x);
            tmax = (toBase.x > 0.0) ? min(toBase.x, max_dist) : min(toTop.y, max_dist);
        } else { tmax = -1.0; }
    } else if (startH < cloudBase) {
        if (toBase.y >= 0.0) {
            tmin = max(tmin, toBase.y);
            tmax = min(toTop.y, max_dist);
        } else { tmax = -1.0; }
    } else {
        tmin = max(tmin, 0.0);
        tmax = (toBase.x > 0.0) ? min(toBase.x, max_dist) : min(toTop.y, max_dist);
    }

    tmax = min(tmax, CLOUDS_MAX_VIEWING_DISTANCE);

    if (tmax > tmin && cloudCover > 0.01) {
        float seg     = tmax - tmin;
        float stepLen = max(seg / float(MAXIMUM_CLOUDS_STEPS), CLOUDS_MARCH_STEP);

        // blue-noise dither
        float dither = (texture2D(noiseTexture, mod(gl_FragCoord.xy / (512.0), 1.0)).r * 2.0 - 1.0) * 0.5;
        
        float t = tmin + dither * stepLen;

        vec3 wind = windVector * float(czm_frameNumber) * windSpeedRatio;

        float mu    = dot(dir, light_dir);
        float phase = mix(HenyeyGreenstein(-0.3, mu), HenyeyGreenstein(0.3, mu), 0.6);

        for (int i = 0; i < MAXIMUM_CLOUDS_STEPS; ++i) {
            if (t > tmax) break;

            vec3  p   = start + dir * t;
            int   qR  = int(t * DISTANCE_QUALITY_RATIO);
            int   lod = max(0, CLOUDS_MAX_LOD - qR);

            float hr = 0.0;
            float dens = cloudDensity(p, wind, lod, hr) * density;

            if (dens > 0.01) {
                if (!hitCloud) { hitCloud = true; t_first = t; }

                float sigmaE = cloudExtinct * dens;
                float sigmaS = cloudScatter * dens;

                // simple ambient vs height in layer
                vec3 ambient = czm_lightColor * mix(0.0, 0.2, clamp(hr, 0.0, 1.0)) * 0.5;

                float Ltrans = 1.0;
                const int   LSTEPS     = (LIGHT_STEPS > 0 ? LIGHT_STEPS : 1);
                const float LSTEP_DIST = 500.0;
                for (int l = 0; l < LSTEPS; ++l) {
                    vec3 lp = p + light_dir * (float(l) + 0.5) * LSTEP_DIST;
                    float hrL = 0.0;
                    float dL  = cloudDensity(lp, wind, CLOUDS_MAX_LOD, hrL) * density;
                    float sE  = cloudExtinct * dL;
                    Ltrans *= exp(-sE * LSTEP_DIST);
                    if (Ltrans < 0.01) break;
                }

                vec3 Lin = czm_lightColor * phase * Ltrans + ambient;

                float stepT = exp(-sigmaE * stepLen);
                cloudRGB += T_view * (sigmaS * Lin * (1.0 - stepT) / max(sigmaE, 1e-4));
                T_view   *= stepT;

                if (T_view < 0.01) break;
            }

            t += stepLen;
        }
    }

    
    float cloudAlpha = 1.0 - T_view;
    if (hitCloud) {
        effectiveMaxDist = min(max_dist, t_first + 10000.0); // clamp atmo to first cloud
    }
    #endif // VOLUMETRIC_CLOUDS

    float a = dot(dir, dir);
    float b = 2.0 * dot(dir, start);
    float c = dot(start, start) - (atmoRadiusSquared);
    float d = (b * b) - 4.0 * a * c;
    if (d < 0.0) {
        #ifdef VOLUMETRIC_CLOUDS
        return vec4(cloudRGB, cloudAlpha);
        #else
        return vec4(0.0);
        #endif
    }

    vec2 ray_length = vec2(
        max((-b - sqrt(d)) / (2.0 * a), 0.0),
        min((-b + sqrt(d)) / (2.0 * a), effectiveMaxDist)
    );
    if (ray_length.x > ray_length.y) {
        #ifdef VOLUMETRIC_CLOUDS
        return vec4(cloudRGB, cloudAlpha);
        #else
        return vec4(0.0);
        #endif
    }

    bool allow_mie = (effectiveMaxDist > ray_length.y);

    float step_size_i = (ray_length.y - ray_length.x) / float(PRIMARY_STEPS);
    float ray_pos_i   = ray_length.x + step_size_i * 0.5;

    vec3 total_ray = vec3(0.0);
    vec3 total_mie = vec3(0.0);
    vec3 opt_i     = vec3(0.0);          // x: Rayleigh, y: Mie, z: Absorption
    vec2 scale_h   = vec2(height_ray, height_mie);

    float muA = dot(dir, light_dir);
    float mumu = muA * muA;
    float gg = g * g;
    float phase_ray = 3.0 / (50.2654824574) * (1.0 + mumu);
    float phase_mie = allow_mie ? 3.0 / (25.1327412287) *
        ((1.0 - gg) * (mumu + 1.0)) / (pow(1.0 + gg - 2.0 * muA * g, 1.5) * (2.0 + gg)) : 0.0;

    for (int i = 0; i < PRIMARY_STEPS; ++i) {
        vec3  pos_i = start + dir * ray_pos_i;
        float h_i   = length(pos_i) - planetRadius;

        vec3 density_i = vec3(exp(-h_i / scale_h), 0.0);

        float denom = (height_absorption - h_i) / absorption_falloff;
        density_i.z = (1.0 / (denom * denom + 1.0)) * density_i.x;

        density_i *= step_size_i;
        opt_i += density_i;

        float aL = dot(light_dir, light_dir);
        float bL = 2.0 * dot(light_dir, pos_i);
        float cL = dot(pos_i, pos_i) - (atmoRadiusSquared);
        float dL = (bL * bL) - 4.0 * aL * cL;

        float step_size_l = (-bL + sqrt(max(dL, 0.0))) / (2.0 * aL * float(max(LIGHT_STEPS,1)));
        float ray_pos_l   = step_size_l * 0.5;
        vec3  opt_l       = vec3(0.0);
        float occluded    = 1.0;

        float ditherAmount   = texture2D(noiseTexture, mod(gl_FragCoord.xy / 212.0, 1.0)).r * 2.0 - 1.0;
        float ditherDistance = ditherAmount * step_size_l * 0.04;

        for (int l = 0; l < LIGHT_STEPS; ++l) {
            vec3 pos_l = pos_i + normalize(czm_sunPositionWC - pos_i) * (ray_pos_l + ditherDistance);

            // project to screen to query depth
            vec4 clipPos = czm_viewProjection * vec4(pos_l, 1.0);
            vec3 ndc     = clipPos.xyz / clipPos.w;
            vec2 uv      = ndc.xy * 0.5 + 0.5;

            float sceneDepth = czm_unpackDepth(texture2D(depthTexture, uv));
            if (sceneDepth < 0.0 || sceneDepth > 1.0) sceneDepth = 1.0;

            vec2 windowXY = uv * czm_viewport.zw + czm_viewport.xy;
            vec4 fragCoord = vec4(windowXY, sceneDepth, 1.0);

            vec4 eyePos       = czm_windowToEyeCoordinates(fragCoord);
            vec4 occluderPosE = (czm_inverseView * eyePos);
            vec3 occluderPos  = occluderPosE.xyz / occluderPosE.w;

            vec3 vToOcc = normalize(occluderPos - pos_l);
            vec3 vToSun = normalize(czm_sunPositionWC - pos_l);
            float dotToSun = dot(vToOcc, vToSun);
            if (dotToSun < 0.0 && effectiveMaxDist < 1000000.0) {
                occluded = 2.0; // thicken optical depth if occluded
            }

            float h_l   = length(pos_l) - planetRadius;
            vec3 dens_l = vec3(exp(-h_l / scale_h), 0.0);

            float denom2 = (height_absorption - h_l) / absorption_falloff;
            dens_l.z = (1.0 / (denom2 * denom2 + 1.0)) * dens_l.x;

            dens_l *= step_size_l;
            opt_l += dens_l * occluded;

            ray_pos_l += step_size_l;
        }

        vec3 attn = exp(-beta_ray * (opt_i.x + opt_l.x)
                        - beta_mie * (opt_i.y + opt_l.y)
                        - beta_absorption * (opt_i.z + opt_l.z));

        total_ray += density_i.x * attn;
        total_mie += density_i.y * attn;

        ray_pos_i += step_size_i;
    }

    vec3 atmoOpacityVec = exp(-(beta_mie * opt_i.y + beta_ray * opt_i.x + beta_absorption * opt_i.z));
    float atmoAlpha = 1.0 - ((atmoOpacityVec.r + atmoOpacityVec.g + atmoOpacityVec.b) / 3.0);

    vec3 atmoRGB = (
        phase_ray * beta_ray * total_ray
      + phase_mie * beta_mie * total_mie
      + opt_i.x * beta_ambient
    ) * light_intensity;


    #ifdef VOLUMETRIC_CLOUDS
    vec3 outRGB = atmoRGB + (1.0 - atmoAlpha) * cloudRGB;
    float outA  = atmoAlpha + (1.0 - atmoAlpha) * cloudAlpha;
    return vec4(outRGB, outA);
    #else
    return vec4(atmoRGB, atmoAlpha);
    #endif
}
#endif

`

geofs.fx.atmosphere.create();
geofs.api.advancedRenderingQuality();


var viewer = geofs.api.viewer

if (viewer.__taa && typeof viewer.__taa.destroy === 'function') {
  viewer.__taa.destroy();
  viewer.__taa = null;
}

viewer.__taa = setupTemporalDenoiser(viewer, {
  alpha: 0.12,
  clampK: 1.0,
  maxVelPx: 120.0,
  jitterEnabled: true,
  jitterScale: 1.0,         // ~ +/-0.5 px
  jitterLength: 8,
  velocityIncludesJitter: false // true if velocity adds camera jitter
});

function setupTemporalDenoiser(viewer, opts = {}) {
  const scene = viewer.scene;
  const gl = scene.context._gl;

let params = {
  alpha:     opts.alpha     ?? 0.12,
  clampK:    opts.clampK    ?? 1.0,
  maxVelPx:  opts.maxVelPx  ?? 120.0,

  depthThreshold:     opts.depthThreshold     ?? 1.0,
  depthThresholdRel:  opts.depthThresholdRel  ?? 0.02,
  depthEdgeCutoff:    opts.depthEdgeCutoff    ?? 2.0,
  depthEdgeCutoffRel: opts.depthEdgeCutoffRel ?? 0.04,

  lumaDiffSoft:  opts.lumaDiffSoft  ?? 0.05,  // start easing history at ~5% luma change
  lumaDiffHard:  opts.lumaDiffHard  ?? 0.12,  // kill history by ~12% luma change
  velSoftPx:     opts.velSoftPx     ?? 0.75,  // start reducing at ~0.75 px motion
  velHardPx:     opts.velHardPx     ?? 2.0    // kill history by ~2 px motion
};

  let jitterEnabled = opts.jitterEnabled ?? true;
  let jitterScale   = opts.jitterScale   ?? 1.0;
  let jitterLength  = Math.max(1, Math.floor(opts.jitterLength ?? 8));
  let jitterIndex   = 0;

  function halton(i, base) {
    let f = 1.0, r = 0.0;
    while (i > 0) { f /= base; r += f * (i % base); i = (i / base) | 0; }
    return r;
  }
  function nextJitter(width, height) {
    const k = ((jitterIndex % jitterLength) + 1);
    jitterIndex++;
    const jx_px = (halton(k, 2) - 0.5) * jitterScale; // pixels
    const jy_px = (halton(k, 3) - 0.5) * jitterScale; // pixels
    return {
      pxX: jx_px, pxY: jy_px,
      ndcX: (jx_px / width)  * 2.0,
      ndcY: (jy_px / height) * 2.0
    };
  }

  let historyTex = null;
  let historyValid = false;
  function allocHistory() {
    const w = scene.drawingBufferWidth, h = scene.drawingBufferHeight;
    if (historyTex) historyTex.destroy();
    historyTex = new Cesium.Texture({
      context: scene.context,
      width: w, height: h,
      pixelFormat: Cesium.PixelFormat.RGB,
      pixelDatatype: Cesium.PixelDatatype.UNSIGNED_BYTE
    });
  }

  let velocityTex = null;
  function setVelocityTexture(tex) { velocityTex = tex || null; }
  const velocityIncludesJitter = !!opts.velocityIncludesJitter;

  let prevJitterPx = { x: 0, y: 0 };
  let currJitterPx = { x: 0, y: 0 };

  let prevVP = Cesium.Matrix4.multiply(
    viewer.camera.frustum.projectionMatrix,
    viewer.camera.viewMatrix,
    new Cesium.Matrix4()
  );

  const stage = scene.postProcessStages.add(new Cesium.PostProcessStage({
    name: 'taa_unjittered',
    fragmentShader: `
  uniform sampler2D colorTexture;     // jittered color
  uniform sampler2D depthTexture;
  uniform sampler2D u_history;        // PREVIOUS unjittered filtered
  uniform sampler2D u_velocity;       // optional velocity (RG, pixels)
  uniform mat4 u_prevVP;              // previous (jittered) VP
  uniform bool u_useVelocityTex;
  uniform bool u_velocityHasCameraJitter;
  uniform bool u_historyValid;
  uniform float u_alpha;
  uniform float u_clampK;
  uniform float u_maxVelPx;
  uniform vec2  u_currJitterPx;       // pixels
  uniform vec2  u_prevJitterPx;       // pixels

  uniform float u_depthThreshold;
  uniform float u_depthThresholdRel;
  uniform float u_depthEdgeCutoff;
  uniform float u_depthEdgeCutoffRel;

  uniform float u_lumaDiffSoft;
  uniform float u_lumaDiffHard;
  uniform float u_velSoftPx;
  uniform float u_velHardPx;

  varying vec2 v_textureCoordinates;

  vec2 clampUV(vec2 uv, vec2 viewport) {
    vec2 eps = 0.5 / viewport; // half-pixel pad
    return clamp(uv, eps, 1.0 - eps);
  }
  float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

  float linearDepthAt(vec2 uv) {
    float d = czm_unpackDepth(texture2D(depthTexture, uv));
    if (d == 0.0) return 1e20; // sky / no depth
    d = czm_reverseLogDepth(d);
    vec2 winXY = uv * czm_viewport.zw + czm_viewport.xy;
    vec4 posEC = czm_windowToEyeCoordinates(vec4(winXY, d, 1.0));
    return -posEC.z; // eye looks -Z
  }

  bool prevUV_fromDepth_jittered(vec2 uvCurrJittered, out vec2 prevUV_jittered) {
    float d = czm_unpackDepth(texture2D(depthTexture, uvCurrJittered));
    if (d < 0.5) return false; // <<< FIX: only reject sky/no depth
    d = czm_reverseLogDepth(d);
    vec2 winXY = uvCurrJittered * czm_viewport.zw + czm_viewport.xy;
    vec4 posEC = czm_windowToEyeCoordinates(vec4(winXY, d, 1.0));
    vec4 posWC = czm_inverseView * posEC;
    vec4 prevClip = u_prevVP * posWC;
    if (prevClip.w == 0.0) return false;
    vec2 prevNDC = prevClip.xy / prevClip.w;
    prevUV_jittered = prevNDC * 0.5 + 0.5;
    return all(greaterThanEqual(prevUV_jittered, vec2(0.0))) &&
           all(lessThanEqual(prevUV_jittered,  vec2(1.0)));
  }

  vec3 clipAABB(vec3 lo, vec3 hi, vec3 x) { return clamp(x, lo, hi); }

  void main() {
    vec2 uvOut = v_textureCoordinates;      // final UNJITTERED coords
    vec2 viewport = czm_viewport.zw;
    vec2 texel = 1.0 / viewport;

    vec2 uvCurr_jittered = clampUV(uvOut - (u_currJitterPx / viewport), viewport);

    vec3 curr = texture2D(colorTexture, uvCurr_jittered).rgb;
    if (!u_historyValid) { gl_FragColor = vec4(curr, 1.0); return; }

    vec2 prevUV_jittered; bool ok = true;
    vec2 velPxCenter = vec2(0.0);
    if (u_useVelocityTex) {
      vec2 velPx = texture2D(u_velocity, uvCurr_jittered).rg;   // prev->curr in px
      if (!u_velocityHasCameraJitter) velPx += (u_currJitterPx - u_prevJitterPx);
      velPxCenter = velPx;
      if (length(velPx) > u_maxVelPx) ok = false;
      prevUV_jittered = clampUV(uvCurr_jittered - (velPx / viewport), viewport);
    } else {
      ok = prevUV_fromDepth_jittered(uvCurr_jittered, prevUV_jittered);
      if (ok) prevUV_jittered = clampUV(prevUV_jittered, viewport);
      // derive a pseudo velocity (camera-only) in pixels for gating
      velPxCenter = (uvCurr_jittered - prevUV_jittered) * viewport;
    }

    vec2 prevUV_unjittered = clampUV(prevUV_jittered + (u_prevJitterPx / viewport), viewport);

    vec3 history = ok ? texture2D(u_history, prevUV_unjittered).rgb : curr;

    float centerDepth = linearDepthAt(uvCurr_jittered);

    vec3 lo = vec3( 1e9), hi = vec3(-1e9);
    float cnt = 0.0;
    float dMin = 1e20, dMax = -1e20;
    float neighTol = u_depthThreshold + u_depthThresholdRel * centerDepth;

    for (int j = -1; j <= 1; ++j) {
      for (int i = -1; i <= 1; ++i) {
        vec2 suv = clampUV(uvCurr_jittered + vec2(float(i),float(j)) * texel, viewport);
        float dn = linearDepthAt(suv);
        dMin = min(dMin, dn);
        dMax = max(dMax, dn);
        if (abs(dn - centerDepth) <= neighTol) {
          vec3 c = texture2D(colorTexture, suv).rgb;
          lo = min(lo, c); hi = max(hi, c); cnt += 1.0;
        }
      }
    }
    if (cnt < 1.0) { lo = curr; hi = curr; } // nothing compatible? clamp to curr

    vec3 center = (lo + hi) * 0.5;
    vec3 extent = (hi - lo) * 0.5 * u_clampK;
    history = clipAABB(center - extent, center + extent, history);

    float edgeCut = u_depthEdgeCutoff + u_depthEdgeCutoffRel * centerDepth;
    float spread  = max(0.0, dMax - dMin);
    float wDepth  = smoothstep(edgeCut * 2.0, edgeCut, spread); // big spread -> 0

    float wReactive = 1.0 - smoothstep(u_lumaDiffSoft, u_lumaDiffHard,
                                       abs(luma(curr) - luma(history)));

    float vmag = length(velPxCenter);
    float wVel = 1.0 - smoothstep(u_velSoftPx, u_velHardPx, vmag);

    float w = wDepth * wReactive * wVel * float(ok);

    float a = u_alpha * w;
    vec3 outColor = mix(curr, history, a);
    gl_FragColor = vec4(outColor, 1.0);
  }
`,

    uniforms: {
  u_history: () => historyTex,
  u_velocity: () => velocityTex ?? historyTex,
  u_prevVP:   () => prevVP,
  u_useVelocityTex: () => !!velocityTex,
  u_velocityHasCameraJitter: () => velocityIncludesJitter,
  u_historyValid: () => historyValid,
  u_alpha: () => params.alpha,
  u_clampK: () => params.clampK,
  u_maxVelPx: () => params.maxVelPx,
  u_currJitterPx: () => new Cesium.Cartesian2(currJitterPx.x, currJitterPx.y),
  u_prevJitterPx: () => new Cesium.Cartesian2(prevJitterPx.x, prevJitterPx.y),

  u_depthThreshold:     () => params.depthThreshold,
  u_depthThresholdRel:  () => params.depthThresholdRel,
  u_depthEdgeCutoff:    () => params.depthEdgeCutoff,
  u_depthEdgeCutoffRel: () => params.depthEdgeCutoffRel,

  u_lumaDiffSoft: () => params.lumaDiffSoft,
  u_lumaDiffHard: () => params.lumaDiffHard,
  u_velSoftPx:    () => params.velSoftPx,
  u_velHardPx:    () => params.velHardPx
}
  }));

  function applyJitter() {
    const cam = viewer.camera;
    const f = cam.frustum;
    if (!f) return;

    if (!jitterEnabled) {
      if (f.xOffset !== undefined) { f.xOffset = 0.0; f.yOffset = 0.0; }
      currJitterPx.x = currJitterPx.y = 0;
      return;
    }

    const w = scene.drawingBufferWidth, h = scene.drawingBufferHeight;
    const j = nextJitter(w, h);

    prevJitterPx.x = currJitterPx.x;
    prevJitterPx.y = currJitterPx.y;

    currJitterPx.x = j.pxX;
    currJitterPx.y = j.pxY;

    if (f.fov !== undefined && f.aspectRatio !== undefined) {
      const near = f.near;
      const top = Math.tan(f.fov * 0.5) * near;
      const right = top * f.aspectRatio;
      f.xOffset = j.ndcX * right;
      f.yOffset = j.ndcY * top;
    } else if (f.width !== undefined && f.aspectRatio !== undefined) {
      const halfW = f.width * 0.5;
      const halfH = halfW / f.aspectRatio;
      if (f.xOffset !== undefined) {
        f.xOffset = j.ndcX * halfW;
        f.yOffset = j.ndcY * halfH;
      }
    }
  }

  function copyFilteredToHistory() {
    const w = scene.drawingBufferWidth, h = scene.drawingBufferHeight;
    if (!historyTex || historyTex.width !== w || historyTex.height !== h) {
      allocHistory();
      historyValid = false;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // copy final backbuffer
    historyTex.copyFromFramebuffer();
    historyValid = true;
  }

  function updatePrevVP() {
    const vp = Cesium.Matrix4.multiply(
      viewer.camera.frustum.projectionMatrix,
      viewer.camera.viewMatrix,
      new Cesium.Matrix4()
    );
    Cesium.Matrix4.clone(vp, prevVP);
  }

  const preRenderJitter = scene.preRender.addEventListener(applyJitter);
  const postRenderCopy  = scene.postRender.addEventListener(copyFilteredToHistory);
  const postRenderPrev  = scene.postRender.addEventListener(updatePrevVP);

  allocHistory();
  historyValid = false;

  function destroy() {
    try { scene.postProcessStages.remove(stage); } catch {}
    try { scene.preRender.removeEventListener(preRenderJitter); } catch {}
    try { scene.postRender.removeEventListener(postRenderCopy); } catch {}
    try { scene.postRender.removeEventListener(postRenderPrev); } catch {}
    if (viewer.camera && viewer.camera.frustum && viewer.camera.frustum.xOffset !== undefined) {
      viewer.camera.frustum.xOffset = 0.0;
      viewer.camera.frustum.yOffset = 0.0;
    }
    if (historyTex) { historyTex.destroy(); historyTex = null; }
  }

  function setParams(newParams) { Object.assign(params, newParams || {}); }
  function setJitterEnabled(v) { jitterEnabled = !!v; jitterIndex = 0; }
  function setJitterOptions({ scale, length } = {}) {
    if (scale  !== undefined) jitterScale  = scale;
    if (length !== undefined) { jitterLength = Math.max(1, Math.floor(length)); jitterIndex = 0; }
  }

  return {
    setVelocityTexture,
    setParams,
    setJitterEnabled,
    setJitterOptions,
    destroy,
    stage
  };
}

viewer.__taa.setParams({alpha: 0.9, clampK: 0.9, jitterLength: 8, jitterScale: 1.0, depthEdgeCutoff: 0.5})
viewer.__taa.setParams({
  depthThreshold: 2.0, depthThresholdRel: 0.05,
  depthEdgeCutoff: 3.0, depthEdgeCutoffRel: 0.06,
  lumaDiffSoft: 100, lumaDiffHard: 100,
  velSoftPx: 1.0, velHardPx: 30.0
});