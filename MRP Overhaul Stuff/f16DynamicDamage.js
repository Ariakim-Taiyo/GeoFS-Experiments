/* DEVELOPER NOTES AS OF 11/12/2026:
This was written almost entirely by AI, which was rather crude at the time.
There was no way I was going to figure out how to do this on my own at the time.
I'm sure you'll definitely enjoy perusing this due to the incredibly descriptive comments
that I did not write because I don't have time for that...
There's also several ways I can think of doing this much better now rather than attempting to reconstruct the
GLTF model itself and project a decal onto the color texture.
You'll have to uncomment the bottom line and load into an F16 for this to work.
*/
var model = geofs.aircraft.instance.object3d.model._model;
var gltf = model.gltf;
var bufferDef = gltf.buffers[0];       // both likely index 0
var baseURL = geofs.url + geofs.aircraft.instance.fullPath;
var bin = await fetch(baseURL + bufferDef.uri).then(r => r.arrayBuffer());

var texCanvas = new geofs.api.Canvas(512, 512); // create a canvas for the decal texture
var planeTexture = geofs.url + geofs.aircraft.instance.fullPath + gltf.images[3].uri

async function getClickPos() {

    var scene   = geofs.api.viewer.scene;
    var viewer  = geofs.api.viewer;         // need access to the entity layer
    var camera  = scene.camera;

    /*----------------------------------------------------*/
    /* 1) get cursor → ray                                */
    /*----------------------------------------------------*/
    var click = new Cesium.Cartesian2(
        controls.mouse.originalX - controls.mouse.oX,
        controls.mouse.originalY - controls.mouse.oY
    );
    var ray   = camera.getPickRay(click);

    /*----------------------------------------------------*/
    /* 2) pick first intersection                         */
    /*----------------------------------------------------*/
    var res = await scene.pickFromRayMostDetailed(ray, []);

    if (!res) return null;                    // nothing hit

    var hit = res.position;                 // Cesium.Cartesian3

    /*----------------------------------------------------*/
    /* 3) visualise: polyline + point                     */
    /*----------------------------------------------------*/
    var VIS_DURATION = 3.0;                 // seconds until auto‑remove

    // Polyline from ray origin to the hit point
    var dbgLine = viewer.entities.add({
        polyline : {
            positions : [ray.origin, hit],
            width     : 2,
            material  : Cesium.Color.YELLOW.withAlpha(0.9)
        }
    });

    // Small red sphere/billboard at the hit
    var dbgPoint = viewer.entities.add({
        position : hit,
        point    : {
            color : Cesium.Color.RED,
            pixelSize : 6,
            outlineColor : Cesium.Color.WHITE,
            outlineWidth : 1
        }
    });

    // remove both after VIS_DURATION seconds
    setTimeout(() => {
        viewer.entities.remove(dbgLine);
        viewer.entities.remove(dbgPoint);
    }, VIS_DURATION * 1000);

    /*----------------------------------------------------*/
    /* 4) return the Cartesian3 to caller                 */
    /*----------------------------------------------------*/
    return hit;
}


function findAllVertices() {

    /*---------------------------------------------------------------*\
     * 0. gather model + glTF references                              *
    \*---------------------------------------------------------------*/
    var model = geofs.aircraft.instance.object3d.model._model;
    var gltf  = model.gltf;

    /*---------------------------------------------------------------*\
     * 1. helpers                                                     *
    \*---------------------------------------------------------------*/
    function componentSize(ct) {
        switch (ct) {
            case 5120: case 5121: return 1;      // BYTE / UBYTE
            case 5122: case 5123: return 2;      // SHORT / USHORT
            case 5125: case 5126: return 4;      // UINT / FLOAT
        }
    }
    var nComp = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4,
                    MAT2:4,  MAT3:9, MAT4:16 };

    function sliceAccessor(acc, bv, bin) {
        var compSize   = componentSize(acc.componentType);
        var comps      = nComp[acc.type];
        var stride     = bv.byteStride || compSize * comps;
        var offset     = (bv.byteOffset || 0) + (acc.byteOffset || 0);
        var lenBytes   = acc.count * stride;
        var ctor       = {
            5120:Int8Array, 5121:Uint8Array,
            5122:Int16Array,5123:Uint16Array,
            5125:Uint32Array,5126:Float32Array
        }[acc.componentType];

        if (!bv.byteStride) {
            return new ctor(bin, offset, acc.count * comps);
        }

        // de‑interleave
        var dense = new ctor(acc.count * comps);
        var dv    = new DataView(bin, offset, lenBytes);
        for (let i=0, p=0; i<acc.count; ++i, p+=stride) {
            for (let c=0; c<comps; ++c) {
                var q = p + c*compSize;
                let v;
                switch (acc.componentType) {
                    case 5120: v=dv.getInt8 (q); break;
                    case 5121: v=dv.getUint8(q); break;
                    case 5122: v=dv.getInt16(q,true); break;
                    case 5123: v=dv.getUint16(q,true); break;
                    case 5125: v=dv.getUint32(q,true); break;
                    case 5126: v=dv.getFloat32(q,true); break;
                }
                dense[i*comps+c]=v;
            }
        }
        return dense;
    }


    /*---------------------------------------------------------------*\
     * 3. iterate meshes & primitives                                 *
    \*---------------------------------------------------------------*/
    var posArrays = [];
    var uvArrays  = [];
    var ranges    = {};                // meshName → {start,count}

    let vertexOffset = 0;

    for (var mesh of gltf.meshes) {
        var start = vertexOffset;      // remember starting vertex of this mesh

        for (var prim of mesh.primitives) {

            var accPos = gltf.accessors[ prim.attributes.POSITION ];
            var bvPos  = gltf.bufferViews[ accPos.bufferView ];
            var pos    = sliceAccessor(accPos, bvPos, bin);   // typed array

            var accUV  = gltf.accessors[ prim.attributes.TEXCOORD_0 ];
            var uv     = accUV ? sliceAccessor(
                                        accUV,
                                        gltf.bufferViews[ accUV.bufferView ],
                                        bin ) : null;

            posArrays.push(pos);
            if (uv) uvArrays.push(uv);          // may be missing on some primitives

            vertexOffset += accPos.count;
        }

        ranges[mesh.name || ("mesh"+ranges.length)] =
            { start, count: vertexOffset - start };
    }

    /*---------------------------------------------------------------*\
     * 4. concatenate into single Float32Arrays                       *
    \*---------------------------------------------------------------*/
    function concat(arrays, itemSize) {
        var total = arrays.reduce((s,a)=>s+a.length, 0);
        var out   = new Float32Array(total);
        let off=0;
        for (var a of arrays) {
            out.set(a, off);
            off += a.length;
        }
        return out;
    }
    var positions = concat(posArrays, 3);
    var uvs       = concat(uvArrays, 2);

    console.log("total vertices:", positions.length/3);
    console.log("meshes & ranges:", ranges);

    return { positions, uvs, ranges };
}

function findVertices() {
    var click = new Cesium.Cartesian2(
        controls.mouse.originalX,
        controls.mouse.originalY
    );
    var pickedObj = geofs.api.viewer.scene.pick(click)

    // ----- helpers ---------------------------------------------------------
    function componentSize(componentType) {
        // glTF / WebGL enum → bytes
        switch (componentType) {
            case 5120: /* BYTE           */ return 1;
            case 5121: /* UNSIGNED_BYTE  */ return 1;
            case 5122: /* SHORT          */ return 2;
            case 5123: /* UNSIGNED_SHORT */ return 2;
            case 5125: /* UNSIGNED_INT   */ return 4;
            case 5126: /* FLOAT          */ return 4;
            default: throw "unknown componentType " + componentType;
        }
    }
    function numComponents(type) {
        // "SCALAR","VEC2","VEC3","VEC4","MAT2","MAT3","MAT4"
        return {
            SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4,
            MAT2: 4, MAT3: 9, MAT4: 16
        }[type];
    }
    function sliceAccessor(accessor, bufferView, bin) {
        var compSize = componentSize(accessor.componentType);
        var nComp = numComponents(accessor.type);
        var byteStride = bufferView.byteStride || (compSize * nComp);

        // byte offsets in the binary blob
        var viewStart = (bufferView.byteOffset || 0);
        var accStart = viewStart + (accessor.byteOffset || 0);

        var lenBytes = accessor.count * byteStride;
        var slice = new Uint8Array(bin, accStart, lenBytes); // raw bytes

        // build a *dense* typed-array copy (dropping stride if any)
        var ctor = {
            5120: Int8Array, 5121: Uint8Array,
            5122: Int16Array, 5123: Uint16Array,
            5125: Uint32Array, 5126: Float32Array,
        }[accessor.componentType];

        if (!bufferView.byteStride) {
            // tightly packed → view directly
            return new ctor(bin, accStart, accessor.count * nComp);
        } else {
            // need to de‑interleave
            var dense = new ctor(accessor.count * nComp);
            var view = new DataView(bin, accStart, lenBytes);
            for (let i = 0, off = 0; i < accessor.count; ++i, off += byteStride) {
                for (let c = 0; c < nComp; ++c) {
                    var elemOff = off + c * compSize;
                    let v;
                    switch (accessor.componentType) {
                        case 5120: v = view.getInt8(elemOff); break;
                        case 5121: v = view.getUint8(elemOff); break;
                        case 5122: v = view.getInt16(elemOff, true); break;
                        case 5123: v = view.getUint16(elemOff, true); break;
                        case 5125: v = view.getUint32(elemOff, true); break;
                        case 5126: v = view.getFloat32(elemOff, true); break;
                    }
                    dense[i * nComp + c] = v;
                }
            }
            return dense;
        }
    }
    // -----------------------------------------------------------------------

    var mesh = gltf.meshes.find(b => b.name === pickedObj.mesh._name)    // first mesh
    var prim = mesh.primitives[0];               // first primitive
    console.log("Mesh: ", mesh.name);
    // Accessor + BufferView for POSITION
    var accPos = gltf.accessors[prim.attributes.POSITION];
    var bvPos = gltf.bufferViews[accPos.bufferView];

    // Accessor + BufferView for TEXCOORD_0
    var accUV = gltf.accessors[prim.attributes.TEXCOORD_0];
    var bvUV = gltf.bufferViews[accUV.bufferView];

    // Fetch (or reuse) the binary .bin blob


    // Decode the two attributes
    var positions = sliceAccessor(accPos, bvPos, bin);   // Float32Array xyz xyz …
    var uvs = sliceAccessor(accUV, bvUV, bin);   // Float32Array uv uv …

    console.log("vertex count:", positions.length / 3);
    console.log("first vertex local xyz:", positions.slice(0, 3));
    console.log("first vertex uv:", uvs.slice(0, 2));

    return { positions, uvs };
}

function compareVertices(vertexPositions, hitPosWC, uvs) {
    var maxDistance = 10.0; // Define a threshold for comparison
    var viewer  = geofs.api.viewer;
    var VIS_DURATION = 2.0;                 // seconds
    var modelMat = geofs.aircraft.instance.object3d.model._model.modelMatrix;

    /*---------------------------------------------------------*/
    /* 1‑ collect the 3 closest vertices                       */
    /*---------------------------------------------------------*/
    var closest = [            // running array of {dist, posWC, uv}
        { dist:  Infinity },
        { dist:  Infinity },
        { dist:  Infinity }
    ];

    function tryInsert(d, posWC, uv) {
        // simple insertion sort into closest[0..2]
        for (let k = 2; k >= 0; --k) {
            if (d >= closest[k].dist) break;
            if (k < 2) closest[k+1] = closest[k];
            closest[k] = { dist:d, posWC, uv };
        }
    }

    var tmpLocal = new Cesium.Cartesian3();
    var tmpWorld = new Cesium.Cartesian3();

    for (let i=0, j=0, k=0; i < vertexPositions.length; i+=3, j+=2, ++k) {

        tmpLocal.x = vertexPositions[i];
        tmpLocal.y = vertexPositions[i+1];
        tmpLocal.z = vertexPositions[i+2];

        // local → world
        Cesium.Matrix4.multiplyByPoint(modelMat, tmpLocal, tmpWorld);

        var d = Cesium.Cartesian3.distance(hitPosWC, tmpWorld);

        tryInsert(d,
                  Cesium.Cartesian3.clone(tmpWorld),
                  [ uvs[j], uvs[j+1] ]);

        /* optional debug dots ‑‑ comment out if not needed */
       /* var dot = viewer.entities.add({
            position : Cesium.Cartesian3.clone(tmpWorld),
            point    : { pixelSize:4 / clamp(d, 0.1, 1000), // size based on distance
                         color: Cesium.Color.fromHsl(clamp(d * 0.5, 0, 1),1,0.5,0.8) }
        });
        setTimeout(()=>viewer.entities._entities.remove(dot.id), VIS_DURATION*1000);*/
    }

    // if fewer than 3 verts (degenerate mesh) fall back to the nearest
    if (!closest[2].posWC) return closest[0].uv;

    /*---------------------------------------------------------*/
    /* 2‑ compute barycentric weights of hitPos inside the tri */
    /*---------------------------------------------------------*/
    var A = closest[0].posWC;
    var B = closest[1].posWC;
    var C = closest[2].posWC;
    var P = hitPosWC;

    // helper = vector arithmetic on Cesium.Cartesian3

    var v0 = Cesium.Cartesian3.subtract(B,A,new Cesium.Cartesian3());
    var v1 = Cesium.Cartesian3.subtract(C,A,new Cesium.Cartesian3());
    var v2 = Cesium.Cartesian3.subtract(P,A,new Cesium.Cartesian3());

    var d00 = Cesium.Cartesian3.dot(v0,v0);
    var d01 = Cesium.Cartesian3.dot(v0,v1);
    var d11 = Cesium.Cartesian3.dot(v1,v1);
    var d20 = Cesium.Cartesian3.dot(v2,v0);
    var d21 = Cesium.Cartesian3.dot(v2,v1);

    var denom = d00 * d11 - d01 * d01;

    let wA, wB, wC;

    if (denom > 1e-8) {                         // triangle is non‑degenerate
        wB = ( d11 * d20 - d01 * d21) / denom;
        wC = ( d00 * d21 - d01 * d20) / denom;
        wA = 1 - wB - wC;

        // if P is way outside the triangle, clamp weights to [0,1]
        if (wA < 0 || wB < 0 || wC < 0) {
            wA = Math.max(0, wA); wB = Math.max(0, wB); wC = Math.max(0, wC);
            var s = wA+wB+wC; wA/=s; wB/=s; wC/=s;
        }
    } else {
        /* triangle almost flat -> fall back to inverse‑distance weights */
        var inv0 = 1 / closest[0].dist;
        var inv1 = 1 / closest[1].dist;
        var inv2 = 1 / closest[2].dist;
        var sum  = inv0 + inv1 + inv2;
        wA = inv0 / sum;
        wB = inv1 / sum;
        wC = inv2 / sum;
    }

    /*---------------------------------------------------------*/
    /* 3‑ interpolate UVs                                      */
    /*---------------------------------------------------------*/
    var uvA = closest[0].uv;
    var uvB = closest[1].uv;
    var uvC = closest[2].uv;

    var U = wA*uvA[0] + wB*uvB[0] + wC*uvC[0];
    var V = wA*uvA[1] + wB*uvB[1] + wC*uvC[1];
    if (closest[0].dist > maxDistance) {
        console.warn("No vertex within the threshold distance found.");
        return null; // No vertex found within the threshold distance
    }
    return [U, V];
}


function compareVerticesSimple(vertexPositions, rayPos, uvs) {
    var viewer  = geofs.api.viewer;         // need access to the entity layer
    var VIS_DURATION = 3.0;                 // seconds until auto‑remove
    var maxDistance = 0.5; // Define a threshold for comparison
    var closestVertPos;
    var currentMinDistance;
    var currentUVLocation; // Store the UV location of the closest vertex
    for (let i = 0; i < vertexPositions.length / 3.0; i += 1) {
        var iVpos = i * 3; // index for the vertex position
        var iUVpos = i * 2; // index for the UV position
        var vertexPosition = Array.from(vertexPositions.slice(iVpos, iVpos + 3));
        var R = geofs.aircraft.instance.object3d._rotation; // get the rotation matrix of the aircraft

        var aircraftOffset = Cesium.Cartesian3.fromArray(M33.transform(R, geofs.aircraft.instance.object3d._initialPosition)); // get the aircraft offset
        var aircraftOriginWP = Cesium.Matrix4.getTranslation(geofs.aircraft.instance.object3d.model._model.modelMatrix, new Cesium.Cartesian3()); // get the world position of the aircraft origin
        var trueVertPos = Cesium.Matrix4.multiplyByPoint(geofs.aircraft.instance.object3d.model._model.modelMatrix, Cesium.Cartesian3.fromArray(vertexPosition), new Cesium.Cartesian3())//Cesium.Cartesian3.add(Cesium.Cartesian3.fromArray(vertexPosition), aircraftOriginWP, new Cesium.Cartesian3()); // transform the vertex position to world coordinates
        var dist = Cesium.Cartesian3.distance(Cesium.Cartesian3.add(rayPos, aircraftOffset, new Cesium.Cartesian3()), trueVertPos); // calculate the distance between the ray position and the vertex position
        if (currentMinDistance === undefined || dist < currentMinDistance) {
            currentMinDistance = dist; // update the minimum distance
            currentUVLocation = uvs.slice(iUVpos, iUVpos + 2); // store the UV location of the closest vertex
            geofs.debug.placeAxis(R, M33.transform(R, vertexPosition));
        }
       /* var vertVisPoint = viewer.entities.add({
            position : trueVertPos,
            point    : {
                color :Cesium.Color.fromHsl(clamp(dist * 0.5, 0, 1), 1, 0.5, 1),
                pixelSize : 6 / clamp(dist, 0.1, 1000)
            }
        });
        setTimeout(() => {
            viewer.entities._entities.remove(vertVisPoint.id);
            vertVisPoint = {};
        }, VIS_DURATION * 1000);*/
    }
    console.log("Closest vertex distance:", currentMinDistance);
    if (currentMinDistance > maxDistance) {
        console.warn("No vertex within the threshold distance found.");
        return null; // No vertex found within the threshold distance
    }
    return currentUVLocation; // return the UV location of the closest vertex
}

function stampDecal(uv, options = {}) {
    var ctx = texCanvas.context;

    var planeImg = new Image();
    planeImg.src = planeTexture;                       
    planeImg.crossOrigin = "anonymous";        
    planeImg.onload = function () {
        texCanvas.canvas.width = planeImg.width;
        texCanvas.canvas.height = planeImg.height;
        ctx.drawImage(planeImg, 0, 0);     
        var bulletImage = new Image();
        bulletImage.src = 'https://138772948-227015667470610340.preview.editmysite.com/uploads/1/3/8/7/138772948/580b585b2edbce24c47b2436.png';
        bulletImage.crossOrigin = "anonymous";  
        bulletImage.onload = function () {
            var px = uv[0] * texCanvas.canvas.width;
            var py = uv[1] * texCanvas.canvas.height;
            var randomOffset = Math.random() * 0.1; // random offset for realism
            var dx = options.width ?? bulletImage.width;
            var dy = options.height ?? bulletImage.height;

            ctx.drawImage(bulletImage, px + randomOffset, py + randomOffset, dx, dy);
            console.log(texCanvas.canvas.toDataURL("image/jpeg"));

            geofs.api.setModelTextureFromCanvas(geofs.aircraft.instance.definition.parts[0]["3dmodel"]._model, texCanvas, 3);
            planeTexture = texCanvas.canvas.toDataURL("image/jpeg");
        };
    }
}

async function doClickDamage() {
    try {
        var worldPos = await getClickPos(); 
        if (!worldPos) {
            console.log("No click position found");
            return;
        }

        var resultVerts = findAllVertices();
        if (!resultVerts.positions) {
            console.warn("No vertices array");
            return;
        }

        var uv = compareVertices(resultVerts.positions, worldPos, resultVerts.uvs);
        if (uv) {
            stampDecal(uv, { width: 25, height: 25 });
            console.log("Stamping decal at UV:", uv);
        } else {
            console.warn("No suitable vertex found for stamping.");
        }
    } catch (err) {
        console.error("click‑damage failed:", err);
    }
}

//document.addEventListener("click", doClickDamage())

