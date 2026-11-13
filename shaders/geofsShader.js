/* DEVELOPER NOTES AS OF 11/12/2026:
This looks like another GI attempt. It doesn't really look like anything is happening
and I don't really want to bother further testing it.
This would have been one of my earliest attempts, so it's likely not worth messing with anyway.

EDIT:
Nevermind hooly crap this is trippy...
Yeah turns out you need to actually call geofs.fx.gi.create() for it to do anything.
Who woulda thought!
It's even funnier because I'm currently doing all of this from my secondary computer
while remoted into my primary computer which is literally right behind me.
Like I literally can just turn my chair around and start working on this there instead.
See I am writing theis sentencefrom my primary computer.
My monitors were off lol.
It's a mess on that desk I need to clean it up but I was too busy with other stuff today. 
But it's funnier because this shader absolutely kills the video compression on the remote session.
RIP.


*/
const ssgiShader = `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
varying vec2 v_textureCoordinates;
uniform float intensity;
uniform float radius;

const int NUM_SAMPLES = 16;

vec3 getWorldPos(vec2 uv, float depth) {
    vec4 clipSpacePosition = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 viewSpacePosition = czm_inverseProjection * clipSpacePosition;
    viewSpacePosition /= viewSpacePosition.w;
    return (czm_inverseView * viewSpacePosition).xyz;
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
    return vec3(sharpNormalC);
  } else {
    return vec3(smoothNormal);
  }
}

vec3 estimateNormal(vec2 uv, float depth) {
    vec2 pixelSize = 1.0 / czm_viewport.zw;
    float c = texture2D(depthTexture, uv).r;
    float l = texture2D(depthTexture, uv - vec2(pixelSize.x, 0.0)).r;
    float r = texture2D(depthTexture, uv + vec2(pixelSize.x, 0.0)).r;
    float t = texture2D(depthTexture, uv + vec2(0.0, pixelSize.y)).r;
    float b = texture2D(depthTexture, uv - vec2(0.0, pixelSize.y)).r;
    
    vec3 center = getWorldPos(uv, c);
    vec3 left = getWorldPos(uv - vec2(pixelSize.x, 0.0), l);
    vec3 right = getWorldPos(uv + vec2(pixelSize.x, 0.0), r);
    vec3 top = getWorldPos(uv + vec2(0.0, pixelSize.y), t);
    vec3 bottom = getWorldPos(uv - vec2(0.0, pixelSize.y), b);
    
    return normalize(cross(right - left, top - bottom));
}

void main() {
    vec2 uv = v_textureCoordinates;
    vec3 color = texture2D(colorTexture, uv).rgb;
    float depth = texture2D(depthTexture, uv).r;
    vec3 normal = smoothNormalsFromDepth(uv);
    
    vec3 worldPos = getWorldPos(uv, depth);
    
    vec3 gi = vec3(0.0);
    
    for (int i = 0; i < NUM_SAMPLES; i++) {
        float angle = float(i) * (2.0 * 3.14159 / float(NUM_SAMPLES));
        vec2 offset = vec2(cos(angle), sin(angle)) * radius / czm_viewport.zw;
        
        vec2 sampleUv = uv + offset;
        float sampleDepth = texture2D(depthTexture, sampleUv).r;
        vec3 sampleWorldPos = getWorldPos(sampleUv, sampleDepth);
        
        vec3 sampleVector = normalize(sampleWorldPos - worldPos);
        float nDotS = max(dot(normal, sampleVector), 0.0);
        
        gi += texture2D(colorTexture, sampleUv).rgb * nDotS;
    }
    
    gi /= float(NUM_SAMPLES);
    
    vec3 finalColor = color + gi * intensity;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`

geofs.fx.gi = {
    create: function() {
      geofs.fx.gi.shader = new Cesium.PostProcessStage({
        fragmentShader: ssgiShader,
        uniforms: {
          intensity: 10,
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
  