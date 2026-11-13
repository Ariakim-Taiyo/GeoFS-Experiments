/* DEVELOPER NOTES AS OF 11/12/2026:
Despite the name, this also contains an early global illumination shader version. It's not easily configurable.
It also looks like hot garbage, just like its predecessor which is the SSR shader I published like 4 years ago or something.
*/
geofs["rrt.glsl"] = "" + `
//Using a modified version of the default CesiumJS AO shader for base functions
uniform sampler2D depthTexture;
uniform sampler2D colorTexture;
uniform int viewType;
uniform bool smoothNormals;
uniform bool isEnabled;
uniform bool metalDetection;
uniform float strength;
varying vec2 v_textureCoordinates;
#ifdef GL_OES_standard_derivatives
    #extension GL_OES_standard_derivatives : enable
#endif  

//#define CZM_SELECTED_FEATURE 

float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec4 clipToEye(vec2 uv, float depth)
{
    vec2 xy = vec2((uv.x * 2.0 - 1.0), ((1.0 - uv.y) * 2.0 - 1.0));
    vec4 posEC = czm_inverseProjection * vec4(xy, depth, 1.0);
    posEC = posEC / posEC.w;
    return posEC;
}

vec4 depthToView(vec2 texCoord, float depth) {
    vec4 ndc = vec4(texCoord, depth, 1.0) * 2.0 - 1.0;
    vec4 viewPos = czm_inverseProjection * ndc;
    return viewPos / viewPos.w;
}

vec3 viewToDepth(vec3 pos)
{
  vec4 clip = czm_projection * vec4(pos,1.0);
  vec3 ndc = clip.xyz / clip.w;
  return ndc * .5 + .5;
}

//Reconstruct Normal Without Edge Removation
vec3 getNormalXEdge(vec3 posInCamera, float depthU, float depthD, float depthL, float depthR, vec2 pixelSize)
{
    vec4 posInCameraUp = clipToEye(v_textureCoordinates - vec2(0.0, pixelSize.y), depthU);
    vec4 posInCameraDown = clipToEye(v_textureCoordinates + vec2(0.0, pixelSize.y), depthD);
    vec4 posInCameraLeft = clipToEye(v_textureCoordinates - vec2(pixelSize.x, 0.0), depthL);
    vec4 posInCameraRight = clipToEye(v_textureCoordinates + vec2(pixelSize.x, 0.0), depthR);

    vec3 up = posInCamera.xyz - posInCameraUp.xyz;
    vec3 down = posInCameraDown.xyz - posInCamera.xyz;
    vec3 left = posInCamera.xyz - posInCameraLeft.xyz;
    vec3 right = posInCameraRight.xyz - posInCamera.xyz;

    vec3 DX = length(left) < length(right) ? left : right;
    vec3 DY = length(up) < length(down) ? up : down;

    return normalize(cross(DY, DX));
}

float softLight( float s, float d )
{
	return (s < 0.5) ? d - (1.0 - 2.0 * s) * d * (1.0 - d) 
		: (d < 0.25) ? d + (2.0 * s - 1.0) * d * ((16.0 * d - 12.0) * d + 3.0) 
					 : d + (2.0 * s - 1.0) * (sqrt(d) - d);
}

vec3 softLight( vec3 s, vec3 d )
{
	vec3 c;
	c.x = softLight(s.x,d.x);
	c.y = softLight(s.y,d.y);
	c.z = softLight(s.z,d.z);
	return c;
}

vec4 checkSurface(vec2 uv) {
  vec4 color = texture2D(colorTexture, uv);

	vec3 finalImage;
	
	finalImage.r = softLight((1.0-color.r),color.r);
	finalImage.g = softLight((1.0-color.g),color.g);
	finalImage.b = softLight((1.0-color.b),color.b);

  vec4 reference = vec4(1.0, 1.0, 1.0, 1.0);
  return vec4(vec3(1.0 - length(reference.rgb - finalImage.rgb)), 1.0);
}

//smooth normals with blur
vec3 recNormals(vec3 pos) {
  float dMp = 0.006 * pos.z; //how far we sample from the original point
  vec3 P0 = depthToView(pos.xy, pos.z).xyz;
  vec3 normal = normalize(cross(dFdx(P0), dFdy(P0)));
  float d1 = czm_readDepth(depthTexture, vec2(pos.x + dMp, pos.y + dMp));
  float d2 = czm_readDepth(depthTexture, vec2(pos.x - dMp, pos.y + dMp));
  float d3 = czm_readDepth(depthTexture, vec2(pos.x + dMp, pos.y - dMp));
  float d4 = czm_readDepth(depthTexture, vec2(pos.x - dMp, pos.y - dMp));

  float dd = d1 - d2;
  float dd1 = d1 - d3;
  float dd2 = d1 - d4;
  
  vec3 P1 = depthToView(vec2(pos.x + dMp, pos.y + dMp), d1).xyz;
  vec3 P2 = depthToView(vec2(pos.x - dMp, pos.y + dMp), d2).xyz;
  vec3 P3 = depthToView(vec2(pos.x + dMp, pos.y - dMp), d3).xyz;
  vec3 P4 = depthToView(vec2(pos.x - dMp, pos.y - dMp), d4).xyz;
  vec3 normal1 = normalize(cross(dFdx(P1), dFdy(P1)));
  vec3 normal2 = normalize(cross(dFdx(P2), dFdy(P2)));
  vec3 normal3 = normalize(cross(dFdx(P3), dFdy(P3)));
  vec3 normal4 = normalize(cross(dFdx(P4), dFdy(P4)));
  if (normal1 == vec3(0.0)) { // fix edge blending
    normal1 = normal;
  }

  if (normal2 == vec3(0.0)) {
    normal2 = normal;
  }

  if (normal3 == vec3(0.0)) {
    normal3 = normal;
  }

  if (normal4 == vec3(0.0)) {
    normal4 = normal;
  }

  if(smoothNormals == true) {
  return (normal + normal1 + normal2 + normal3 + normal4) / 5.0;
  } else {
return normal;
  }
}



vec3 blurNormals(vec2 uv) {

    const float Directions = 4.0; // BLUR DIRECTIONS (Default 16.0 - More is better but slower)
    const float Quality = 1.0; // BLUR QUALITY (Default 4.0 - More is better but slower)
    const float Size = 8.0; // BLUR SIZE (Radius)
    // GAUSSIAN BLUR SETTINGS }}}
   
    vec2 Radius = Size/czm_viewport.zw;
    const float Pi = czm_twoPi;
    const float PidD = Pi/Directions;
    // Pixel colour
    float depth = czm_readDepth(depthTexture, uv);
    vec3 Color = recNormals(vec3(uv, depth));
    
    // Blur calculations
    for( float d=0.0; d<Pi; d+=PidD)
    {
		for(float i=1.0/Quality; i<=1.0; i+=1.0/Quality)
        {
      vec2 newUv = uv+vec2(cos(d),sin(d))*Radius*i;
      float newDepth = czm_readDepth(depthTexture, newUv);
			Color += recNormals(vec3(newUv, newDepth));		
        }
    }
    
    // Output to screen
    Color /= Quality * Directions - 15.0;
    return Color;
}

void main(void)
{
#ifdef CZM_SELECTED_FEATURE
    if (!czm_selected()) {
      gl_FragColor = texture2D(colorTexture, v_textureCoordinates);
      return;
    }
#endif
    if (isEnabled == false) {
      gl_FragColor = texture2D(colorTexture, v_textureCoordinates);
      return;
    }
    if (viewType == 1) {
      gl_FragColor = texture2D(colorTexture, v_textureCoordinates);
    return;
    }
    vec4 color;
    vec4 colAtRef;
    vec3 normals;
    float depth1 = czm_readDepth(depthTexture, v_textureCoordinates);
    vec4 posInCamera = clipToEye(v_textureCoordinates, depth1);
    vec4 initialPos = depthToView(v_textureCoordinates, depth1); //just vec3 version of posInCamera ig lol
    if (smoothNormals == true) {
       normals = blurNormals(v_textureCoordinates);
    } else {
       normals = recNormals(vec3(v_textureCoordinates, depth1));
    }
    vec2 pixelSize = czm_pixelRatio / czm_viewport.zw;
    float depthU = czm_readDepth(depthTexture, v_textureCoordinates - vec2(0.0, pixelSize.y));
    float depthD = czm_readDepth(depthTexture, v_textureCoordinates + vec2(0.0, pixelSize.y));
    float depthL = czm_readDepth(depthTexture, v_textureCoordinates - vec2(pixelSize.x, 0.0));
    float depthR = czm_readDepth(depthTexture, v_textureCoordinates + vec2(pixelSize.x, 0.0));
    vec3 normalInCamera = getNormalXEdge(posInCamera.xyz, depthU, depthD, depthL, depthR, pixelSize);
    //normalInCamera = 2.0 * normalInCamera - 1.0;
float maxDistance = 8.0;
float resolution  = 0.5;
int   steps       = 5;
float thickness   = 0.1;

vec4 uv;
vec2 texSize  = czm_viewport.zw;
vec2 texCoord = v_textureCoordinates / texSize;
vec4 positionFrom     = initialPos;
vec3 unitPositionFrom = normalize(positionFrom.xyz);
vec3 normal           = normalize(normals);
vec3 pivot            = normalize(reflect(unitPositionFrom, normal));


vec3 diffVec = clamp((unitPositionFrom.xyz - abs(normal)) * 10.0 * (10.0 * depth1), 0.0, 10.0);
float dotP = clamp(-dot(normal, unitPositionFrom) * 10.0 * (4.0 * depth1), 0.0, 10.0);
float diffTest = clamp(1.0 - dot(pivot, unitPositionFrom), 0.0, 1.0);
vec4 startView = vec4(positionFrom.xyz + (pivot * 0.0), 1.0);
vec4 endView   = vec4(positionFrom.xyz + (pivot * maxDistance), 1.0);
float distTo = length(startView - endView);

  vec4 startFrag      = startView;
       // Project to screen space.
       startFrag      = czm_projection * startFrag;
       // Perform the perspective divide.
       startFrag.xyz /= startFrag.w;
       // Convert the screen-space XY coordinates to UV coordinates.
       startFrag.xy   = startFrag.xy * 0.5 + 0.5;
       // Convert the UV coordinates to fragment/pixel coordnates.
       startFrag.xy  *= texSize;

  vec4 endFrag      = endView;
       endFrag      = czm_projection * endFrag;
       endFrag.xyz /= endFrag.w;
       endFrag.xy   = endFrag.xy * 0.5 + 0.5;
       endFrag.xy  *= texSize;

  vec2 frag  = startFrag.xy;
       uv.xy = frag / texSize;

 float deltaX    = endFrag.x - startFrag.x;
  float deltaY    = endFrag.y - startFrag.y;
 float useX      = abs(deltaX) >= abs(deltaY) ? 1.0 : 0.0;
  float delta     = mix(abs(deltaY), abs(deltaX), useX) * clamp(resolution, 0.0, 1.0);

  vec2  increment = vec2(deltaX, deltaY) / max(delta, 0.001);


  float search0 = 0.0;
  float search1 = 0.0;

float currentX = (startFrag.x) * (1.0 - search1) + (endFrag.x) * search1;
float currentY = (startFrag.y) * (1.0 - search1) + (endFrag.y) * search1;

  float hit0 = 0.0;
  float hit1 = 0.0;

  float viewDistance = startView.z;
  float depth        = thickness;

  for (int i = 0; i < 10000; ++i) {
    if (i > int(delta)) {
      break;
    }
    if (depth1 > 0.99) {
      break;
    }
    if (diffTest > 0.9 ) {
      break;

}
    frag      += increment;
    uv.xy      = frag / texSize;
    vec4 positionTo = clipToEye(uv.xy, uv.z);
              search1 =
              mix
              ((frag.y - startFrag.y) / deltaY
              ,(frag.x - startFrag.x) / deltaX
              ,useX
              );
        viewDistance = (startView.y * endView.y) / mix(endView.y, startView.y, search1);
        depth        = viewDistance - positionTo.y;

    if (depth > 0.5 && depth < thickness) {
      hit0 = 1.0;
      break;
    } else {
      search0 = search1;
    }
    search1 = search0 + ((search1 - search0) / 2.0);
    steps *= int(hit0);

    for (int i = 0; i < 10000; ++i) {
    if (i > steps) {
      break;
    }
    frag       = mix(startFrag.xy, endFrag.xy, search1);
    uv.xy      = frag / texSize;
    positionTo = clipToEye(uv.xy, uv.z);
    viewDistance = (startView.y * endView.y) / mix(endView.y, startView.y, search1);
    depth        = viewDistance - positionTo.y;
    if (depth > 0.0 && depth < thickness) {
      hit1 = 1.0;
      search1 = search0 + ((search1 - search0) / 2.0);
    } else {
      float temp = search1;
      search1 = search1 + ((search1 - search0) / 2.0);
      search0 = temp;
    }
    float visibility = hit1 * positionTo.w * ( 1.0 - max(dot(-unitPositionFrom, pivot), 0.0)) * (1.0 - clamp(depth / thickness, 0.0, 1.0)) * (1.0 - clamp(length(positionTo - positionFrom) / maxDistance, 0.0, 1.0)) * (uv.x < 0.0 || uv.x > 1.0 ? 0.0 : 1.0) * (uv.y < 0.0 || uv.y > 1.0 ? 0.0 : 1.0);
      
  visibility = clamp(visibility, 0.0, 1.0);
  uv.ba = vec2(visibility);
         colAtRef = texture2D(colorTexture, uv.xy);
        //gl_FragColor = uv; //display uv debug
          //gl_FragColor = texture2D(colorTexture, uv.xy); //display reflections
         //gl_FragColor = vec4(1.0) *  diffTest;
        //gl_FragColor = vec4(normals, 1.0);
    }
  }
  color = texture2D(colorTexture, v_textureCoordinates);
 if (colAtRef.rgb == vec3(0.0)) {
    gl_FragColor = color;
  } else {
  
  float specular;
  if (metalDetection) {
    specular = checkSurface(v_textureCoordinates).r;
    } else {
    specular = 1.0;
    }
  vec4 mix = mix(color, colAtRef, strength * specular);
  gl_FragColor = mix; //Ref+Col
  } 
}`

geofs["gi.glsl"] = "" + `
uniform float threshold;
uniform float smoothness;
uniform bool isEnabled;
uniform bool giOnly;
uniform bool filtering;
uniform int resolution;
uniform float strength;
uniform sampler2D depthTexture;
uniform sampler2D colorTexture;
varying vec2 v_textureCoordinates;

float getBrightness(vec3 color) {
  return (color.r + color.g + color.b) / 3.0;
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

vec3 normal_from_pixels(sampler2D tex, vec2 texcoords1, vec2 texcoords2, out float dist) {
    // Fetch depth from depth buffer
    float depth1 = texture2D(tex, texcoords1).r;
    float depth2 = texture2D(depthTexture, texcoords2).r;

    highp vec3 normal = vec3(texcoords2 - texcoords1, depth2 - depth1);
    normal.z = -normal.z;

    dist = length(normal);

    return normalize(normal);
}

vec3 smoothNormalsFromDepth(vec2 texcoords) {
  vec2 pixelSize = czm_pixelRatio / czm_viewport.zw;
  vec2 offset = smoothness * pixelSize;
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
    return vec3(sharpNormalC);
  } else {
    return vec3(smoothNormal);
  }
}

vec3 Calculate_GI(vec3 pixel_normal, vec2 coord)
{
    vec3 light_color;
    vec3 pixel_to_light_normal;
    vec3 light_normal, light_to_pixel_normal;
    float dist;
    vec3 gi = vec3(0.0);

    light_to_pixel_normal = normal_from_pixels(depthTexture, coord, v_textureCoordinates, dist);
    pixel_to_light_normal = -light_to_pixel_normal;

    light_color           = texture2D(colorTexture, coord).rgb;
    light_normal          = smoothNormalsFromDepth(coord);
    gi += light_color * max(0.0, dot(light_normal, light_to_pixel_normal)) * max(0.0, dot(pixel_normal, pixel_to_light_normal)) / dist;

    light_to_pixel_normal = normal_from_pixels(depthTexture, coord, v_textureCoordinates, dist);
    pixel_to_light_normal = -light_to_pixel_normal;

    light_color = texture2D(colorTexture, coord).rgb;
    light_normal = smoothNormalsFromDepth(coord);
    light_normal = -light_normal;

    // Calculate GI
    gi += light_color * max(0.0, dot(light_normal, light_to_pixel_normal)) * max(0.0, dot(pixel_normal, pixel_to_light_normal)) / dist;

    return gi;
}

void main(void) {
    if(!isEnabled) {
      gl_FragColor = texture2D(colorTexture, v_textureCoordinates);
      return;
    }
    int regions = resolution;
    vec3 pixel_normal;
    vec3 gi = vec3(0.0);
    vec3 lastGI = vec3(0.0);
    pixel_normal = smoothNormalsFromDepth(v_textureCoordinates);
    
    for (int y = 0; y < regions; ++y) {
        for (int x = 0; x < regions; ++x) {
        if (filtering) {
          if (czm_readDepth(depthTexture, v_textureCoordinates) > 0.99) {
            gl_FragColor = texture2D(colorTexture, v_textureCoordinates);
            return;
          }
        }
          vec3 giToAdd = Calculate_GI(pixel_normal, vec2((float(x) + 0.5) / float(regions), (float(y) + 0.5) / float(regions)));
          if (getBrightness(gi) - getBrightness(giToAdd) > -threshold) {
            gi += giToAdd;
          } else {
            gi += lastGI;
          }
          lastGI = gi;
        }
    }

    gi /= float(regions * regions / 3);
    gi *= strength;
    if (filtering) gi /= czm_readDepth(depthTexture, v_textureCoordinates);
    if (giOnly) {
        gl_FragColor = vec4(gi, 1.0);
    } else {
        gl_FragColor = (texture2D(colorTexture, v_textureCoordinates) + vec4(gi, 1.0));
  }
}
`

geofs.fx.gi = {
  create: function() {
    geofs.fx.gi.shader = new Cesium.PostProcessStage({
      fragmentShader: geofs["gi.glsl"],
      uniforms: {
        strength: 1,
        currentTime: weather.localTime,
        isEnabled: geofs.ssr.isEnabled,
        giOnly: geofs.ssr.giOnly,
        resolution: geofs.ssr.resolution,
        filtering: geofs.ssr.filtering,
        smoothness: geofs.ssr.smoothness,
        threshold: geofs.ssr.threshold
      }
    })
    geofs.api.viewer.scene.postProcessStages.add(geofs.fx.gi.shader);
  },
  update: function() {
    geofs.fx.gi.shader.uniforms.isEnabled = geofs.ssr.isEnabled;
    geofs.fx.gi.shader.uniforms.strength = geofs.ssr.giStrength;
    geofs.fx.gi.shader.uniforms.giOnly = geofs.ssr.giOnly;
    geofs.fx.gi.shader.uniforms.resolution = geofs.ssr.resolution;
    geofs.fx.gi.shader.uniforms.filtering = geofs.ssr.filtering;
    geofs.fx.gi.shader.uniforms.smoothness = geofs.ssr.smoothness;
    geofs.fx.gi.shader.uniforms.threshold = geofs.ssr.threshold;
  }
};

geofs.ssr = {};
geofs.ssr.isEnabled = false;
geofs.ssr.sNorm = true;
geofs.ssr.metal = false;
geofs.ssr.strength = 1.0;
geofs.ssr.giStrength = 1.0;
geofs.ssr.giOnly = false;
geofs.ssr.resolution = 32;
geofs.ssr.filtering = true;
geofs.ssr.threshold = 0.3;
geofs.ssr.smoothness = 3.0;
geofs.ssr.update = function() {
  if (geofs.ssr.isEnabled) {
    geofs.ssr.isEnabled = false;
    toggle.setAttribute("class", "mdl-switch mdl-js-switch mdl-js-ripple-effect mdl-js-ripple-effect--ignore-events is-upgraded");
  } else {
    geofs.ssr.isEnabled = true;
    toggle.setAttribute("class", "mdl-switch mdl-js-switch mdl-js-ripple-effect mdl-js-ripple-effect--ignore-events is-upgraded is-checked")
  }
}
geofs.ssr.update1 = function() {
  if (geofs.ssr.sNorm) {
    geofs.ssr.sNorm = false;
    normals.setAttribute("class", "mdl-switch mdl-js-switch mdl-js-ripple-effect mdl-js-ripple-effect--ignore-events is-upgraded");

  } else {
    geofs.ssr.sNorm = true;
    normals.setAttribute("class", "mdl-switch mdl-js-switch mdl-js-ripple-effect mdl-js-ripple-effect--ignore-events is-upgraded is-checked")

  }
}

geofs.ssr.update2 = function() {
  if (geofs.ssr.metal) {
    geofs.ssr.metal = false;
    detection.setAttribute("class", "mdl-switch mdl-js-switch mdl-js-ripple-effect mdl-js-ripple-effect--ignore-events is-upgraded");

  } else {
    geofs.ssr.metal = true;
    detection.setAttribute("class", "mdl-switch mdl-js-switch mdl-js-ripple-effect mdl-js-ripple-effect--ignore-events is-upgraded is-checked")

  }
}
let elementSel = document.getElementsByClassName('geofs-preference-list')[0].getElementsByClassName('geofs-advanced')[0].getElementsByClassName('geofs-stopMousePropagation')[0];

let toggle = document.createElement("label");
toggle.setAttribute("class", "mdl-switch mdl-js-switch mdl-js-ripple-effect mdl-js-ripple-effect--ignore-events is-upgraded");
toggle.setAttribute("for", "ssr");
toggle.setAttribute("id", "ssr");
toggle.setAttribute("tabindex", "0");
toggle.setAttribute("dataUpgraded", ",MaterialSwitch,MaterialRipple");
toggle.innerHTML = '<input type="checkbox" id="airports" class="mdl-switch__input" data-gespref="geofs.ssr.isEnabled"><span class="mdl-switch__label">Screen Space Reflections</span>';


let normals = document.createElement("label");
normals.setAttribute("class", "mdl-switch mdl-js-switch mdl-js-ripple-effect mdl-js-ripple-effect--ignore-events is-upgraded");
normals.setAttribute("for", "normals");
normals.setAttribute("id", "normals");
normals.setAttribute("tabindex", "0");
normals.setAttribute("dataUpgraded", ",MaterialSwitch,MaterialRipple");
normals.innerHTML = '<input type="checkbox" id="airports" class="mdl-switch__input" data-gespref="geofs.ssr.sNorm"><span class="mdl-switch__label">Smooth Normals</span>';

let detection = document.createElement("label");
detection.setAttribute("class", "mdl-switch mdl-js-switch mdl-js-ripple-effect mdl-js-ripple-effect--ignore-events is-upgraded");
detection.setAttribute("for", "detection");
detection.setAttribute("id", "detection");
detection.setAttribute("tabindex", "0");
detection.setAttribute("dataUpgraded", ",MaterialSwitch,MaterialRipple");
detection.innerHTML = '<input type="checkbox" id="airports" class="mdl-switch__input" data-gespref="geofs.ssr.metal"><span class="mdl-switch__label">Experimental Metal Detection</span>';

let strength = document.createElement("div");
strength.setAttribute("class", "slider");
strength.setAttribute("data-type", "slider");
strength.setAttribute("id", "strength");
strength.setAttribute("value", "1.0");
strength.setAttribute("data-min", "0.0");
strength.setAttribute("data-max", "1.0");
strength.setAttribute("data-precision", "1.0");
strength.setAttribute("data-gespref", "geofs.ssr.a");
strength.setAttribute("data-update", "{updateStrength()}");
strength.innerHTML = '<div class="slider-rail"><div class="slider-selection" style="width: 100%;"><div class="slider-grippy"><input class="slider-input"></div></div></div><label>Reflection Strength</label>';

elementSel.appendChild(toggle);
elementSel.appendChild(normals);
elementSel.appendChild(detection);
elementSel.appendChild(strength);

toggle.addEventListener("click", geofs.ssr.update);
normals.addEventListener("click", geofs.ssr.update1);
detection.addEventListener("click", geofs.ssr.update2);
function updateStrength() {
  return;
}

geofs.fx.rrt = {
  create: function() {
    geofs.fx.rrt.shader = new Cesium.PostProcessStage({
      fragmentShader: geofs["rrt.glsl"],
      uniforms: {
        reflectionMap: "/shaders/reflection.jpg",
        intensity: 3,
        bias: .1,
        lengthCap: .26,
        stepSize: 1.95,
        frustumLength: 1e3,
        viewType: geofs.camera.currentMode,
        isEnabled: geofs.ssr.isEnabled,
        smoothNormals: geofs.ssr.sNorm,
        strength: 0.3,
        metalDetection: geofs.ssr.metal
      }
    })
    geofs.fx.rrt.shader.selected = [geofs.aircraft.instance.object3d.model._model];
    geofs.api.viewer.scene.postProcessStages.add(geofs.fx.rrt.shader);
  },
  update: function() {
    geofs.fx.rrt.shader.uniforms.viewType = geofs.camera.currentMode;
    geofs.fx.rrt.shader.uniforms.isEnabled = geofs.ssr.isEnabled;
    geofs.fx.rrt.shader.uniforms.smoothNormals = geofs.ssr.sNorm;
    geofs.fx.rrt.shader.uniforms.strength = geofs.ssr.strength;
    geofs.fx.rrt.shader.uniforms.metalDetection = geofs.ssr.metal;
    geofs.fx.rrt.shader.selected = [geofs.aircraft.instance.object3d.model._model];
  }
};

geofs.fx.rrt.create();
geofs.fx.gi.create();

setInterval(function() {
  geofs.fx.rrt.update();
  geofs.fx.gi.update();
}, 100)

geofs.setPreferenceFromInput = function(a) {
  try {
    var b = a.getAttribute("data-gespref");
    if (b) {
      var c = a.getAttribute("data-type") || a.getAttribute("type");
      "SELECT" == a.nodeName && (c = "select");
      c = c.toLowerCase();
      var d = b.split(".");
      b = window;
      for (var e = 0; e < d.length - 1; e++)
        b = b[d[e]];
      switch (c) {
        case "radio-button":
          $(a).is(".is-checked") && (b[d[e]] = a.getAttribute("data-matchvalue"));
          break;
        case "checkbox":
          var g = a.getAttribute("data-matchvalue");
          var f = a.checked;
          g ? f && (b[d[e]] = g) : b[d[e]] = f;
          break;
        case "radio":
          g = a.getAttribute("data-matchvalue");
          f = a.checked;
          g ? f && (f = b[d[e]] = g) : b[d[e]] = f;
          break;
        case "slider":
          f = parseFloat($(a).slider("value"));
          if ($(a)[0].id === "strength") {
            geofs.ssr.strength = f;
          }
          b[d[e]] = f;
          break;
        case "keydetect":
          f = a.value;
          b[d[e]].keycode = parseInt(a.getAttribute("keycode"));
          b[d[e]].label = f;
          break;
        default:
          f = a.value,
            b[d[e]] = f
      }
      var k = a.getAttribute("data-update");
      if (k) {
        var m = new Function("value", k);
        try {
          m.call(a, f)
        } catch (p) {
          geofs.debug.error(p, "setPreferenceFromInput updateFunction.call")
        }
      }
    }
  } catch (p) {
    geofs.debug.error(p, "geofs.setPreferenceFromInput")
  }
};