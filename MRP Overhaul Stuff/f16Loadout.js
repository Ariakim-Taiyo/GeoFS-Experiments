/* DEVELOPER NOTES AS OF 11/12/2026:
This is the script I showcased a while ago that added physics-driven missiles. It's been a considerable amount of time since
I last worked on this, so I don't entirely remember how everything works unfortunately.
Missiles are very unstable in this version, and I'm sure I could do better now with a bit more knowledge of how missiles
keep themselves stable in flight, but it's not a plan as of now.
*/   
   var DEBUG_LIFT_VECTORS = true;        // turn off when not needed
    var LIFT_SCALE = 0.005;               // 0.005 m per newton
    var DRAG_SCALE = 0.005;   // meters per newton
    var maxSurfaceDeflection = 2;        // degrees

    // Missile stability tuning
    var MISSILE_MAX_OMEGA = 8;           // rad/s cap (~458 deg/s)
    var MISSILE_SPIN_DAMP_TORQUE = 3.0;  // N*m per (rad/s), scaled up at low airspeed
    var MISSILE_POINT_SPEED_CAP_MIN = 50; // m/s cap for spin-induced point airflow at low translational speed
    
    var _PLANFORM_EFFICIENCY_FACTOR = (typeof PLANFORM_EFFICIENCY_FACTOR !== "undefined") ? PLANFORM_EFFICIENCY_FACTOR : 0.8;
    var _DRAG_CONSTANT = 0.01 //(typeof DRAG_CONSTANT !== "undefined") ? DRAG_CONSTANT : 0.02;
    var _MIN_DRAG_COEF = 0.01 //(typeof MIN_DRAG_COEF !== "undefined") ? MIN_DRAG_COEF : 0.02;

    var airfoilPosOffset = [0, 0, 0]; // offset from store position to airfoil position
    var f16Stations = {
        1: { name: "Wingtip-L", pos: [-5.35, -1.5, 0.2], maxKg: 150, model: null }, // wingtip left
        2: { name: "Outer-L", pos: [-3.8, -1.5, 0.0], maxKg: 450, model: null },
        3: { name: "Inner-L", pos: [-1.75, -1.0, 0.0], maxKg: 1000, model: null },
        4: { name: "Centerline", pos: [0.0, -0.5, -1.2], maxKg: 1000, model: null },
        5: { name: "Inner-R", pos: [1.75, -1.0, 0.0], maxKg: 1000, model: null },
        6: { name: "Outer-R", pos: [3.8, -1.5, 0.0], maxKg: 450, model: null },
        7: { name: "Wingtip-R", pos: [5.35, -1.5, 0.2], maxKg: 150, model: null },
    };

    var DEG = Math.PI / 180
    var stores = {
        AIM9X: {
            burnTime: 7.75,
            thrustN: 16771.9,
            massKg: 130, //130
            drag: 0.1,
            url: "https://raw.githack.com/Ariakim-Taiyo/GeoFS-Shaders-Repository/main/resources/aim9x.glb",
            /* local surfaces */
            surfaces: [
                {
                    name: "canardL", pos: [-4, 0.1, 0], normal: [0, 0, 1],
                    area: 2.1, aspectRatio: 1, efficiencyFactor: 0.98, stalls: true, forceDirection: 2,
                    role: "roll", sign: 1, CLdelta: 3.5, deltamax: maxSurfaceDeflection * DEG, stallIncidence: 5, zeroLiftIncidence: 15
                },
                {
                    name: "canardR", pos: [4, 0.1, 0], normal: [0, 0, 1],
                    area: 2.1, aspectRatio: 1, efficiencyFactor: 0.98, stalls: true, forceDirection: 2,
                    role: "roll", sign: -1, CLdelta: 3.5, deltamax: maxSurfaceDeflection * DEG, stallIncidence: 5, zeroLiftIncidence: 15
                },
                {
                    name: "canardT", pos: [0, 1.1, 2], normal: [1, 0, 0],
                    area: 2.1, aspectRatio: 1, efficiencyFactor: 0.98, stalls: true, forceDirection: 0, stallIncidence: 5, zeroLiftIncidence: 15
                },
                {
                    name: "canardB", pos: [0, 1.1, -2], normal: [1, 0, 0],
                    area: 2.1, aspectRatio: 1, efficiencyFactor: 0.98, stalls: true, forceDirection: 0, stallIncidence: 5, zeroLiftIncidence: 15
                },
                {
                    name: "finL", pos: [-2, -4, 0], normal: [0, 0, 1],
                    area: 1.5, aspectRatio: 1, efficiencyFactor: 0.98, stalls: true, forceDirection: 2,
                    role: "pitch", sign: 1, CLdelta: 3.5, deltamax: maxSurfaceDeflection * DEG, stallIncidence: 15, zeroLiftIncidence: 25
                },
                {
                    name: "finR", pos: [2, -4, 0], normal: [0, 0, 1],
                    area: 1.5, aspectRatio: 1, efficiencyFactor: 0.98, stalls: true, forceDirection: 2,
                    role: "pitch", sign: 1, CLdelta: 3.5, deltamax: maxSurfaceDeflection * DEG, stallIncidence: 15, zeroLiftIncidence: 25
                },
                {
                    name: "finT", pos: [0, -4, 2], normal: [1, 0, 0],
                    area: 1.5, aspectRatio: 1, efficiencyFactor: 0.98, stalls: true, forceDirection: 0,
                    role: "yaw", sign: 1, CLdelta: 3.5, deltamax: maxSurfaceDeflection * DEG, stallIncidence: 15, zeroLiftIncidence: 25
                },
                {
                    name: "finB", pos: [0, -4, -2], normal: [1, 0, 0],
                    area: 1.5, aspectRatio: 1, efficiencyFactor: 0.98, stalls: true, forceDirection: 0,
                    role: "yaw", sign: 1, CLdelta: 3.5, deltamax: maxSurfaceDeflection * DEG, stallIncidence: 15, zeroLiftIncidence: 25
                }
            ]
        },          // Sidewinder
        AIM120C: {
            CLalpha: 3.1,
            burnTime: 8.0,
            thrustN: 6500 * 5,
            massKg: 251,
            drag: 1,
            url: "https://raw.githack.com/Ariakim-Taiyo/GeoFS-Shaders-Repository/main/resources/aim120c.glb",
            /* local surfaces -----------------------------------------------------*/
            surfaces: [
                {
                    name: "leftwing", pos: [-1, 0.5, 0], normal: [0, 0, 1], span: 0.18, chord: 0.11,
                    area: 0.1, aspectRatio: 1.6, efficiencyFactor: 0.7, stalls: true, forceDirection: 2,
                    role: "roll", sign: +1, CLdelta: 3.5, deltamax: 0.2 * DEG, stallIncidence: 5, zeroLiftIncidence: 10
                },
                {
                    name: "rightwing", pos: [1, 0.5, 0], normal: [0, 0, 1], span: 0.18, chord: 0.11,
                    area: 0.1, aspectRatio: 1.6, efficiencyFactor: 0.7, stalls: true, forceDirection: 2,
                    role: "roll", sign: -1, CLdelta: 3.5, deltamax: 0.2 * DEG, stallIncidence: 5, zeroLiftIncidence: 10
                },
                {
                    name: "horizontalStab", pos: [0, -4.7, 0], normal: [0, 0, 1], span: 0.18, chord: 0.11,
                    area: 0.20, aspectRatio: 1.6, efficiencyFactor: 0.7, stalls: true, forceDirection: 2,
                    role: "pitch", sign: +1, CLdelta: 3.5, deltamax: 5 * DEG, stallIncidence: 5, zeroLiftIncidence: 10
                },
                {
                    name: "rudder-R", pos: [0, -2.7, 0], normal: [1, 0, 0], span: 0.18, chord: 0.11,
                    area: 0.1, aspectRatio: 1.6, efficiencyFactor: 0.9, stalls: true, forceDirection: 0, stallIncidence: 5, zeroLiftIncidence: 10
                }
            ]
        },          // AMRAAM
        AGM65D: { burnTime: 2.5, thrustN: 9000 * 2, massKg: 218, drag: 2.0, url: undefined },          // Maverick
        GBU12: { massKg: 227, drag: 2.2, url: undefined },          // 500 lb LGB
        GBU31: { massKg: 925, drag: 3.8, url: undefined },          // JDAM-2000 
        TANK370: { massKg: 443, fuelKg: 1130, drag: 4.0, url: undefined }, // empty mass only
    };

    var prevTimeMs = Date.now();
    var activeStores = [];
    var activeIndices = [];  // indices of active stores in the loadout array
    var lastMissile = null;      // global
    var lookOrientation = [0, 0, 0]; // global for camera orientation

    // Missile autopilot setpoints (edit at runtime)
    // Heading degrees: 0=N, 90=E. Altitude meters: llaLocation[2] reference.
    var MISSILE_AUTOPILOT_ENABLED = true;
    var MISSILE_TARGET_HEADING_DEG = 180;
    var MISSILE_TARGET_ALTITUDE_M = 3000;

    // Missile autopilot gains (outputs are fin deflection in radians)
    // Roll steering: convert heading error -> bank command -> roll deflection.
    var MISSILE_AP_MAX_BANK_DEG = 1;
    var MISSILE_AP_BANK_PER_DEG_HDG = 10.2; // deg bank / deg heading error
    var MISSILE_AP_KP_BANK = 0.0;       // rad / deg (bank error)

    // Yaw is kept mostly neutral; use damping (and optionally small assist)
    var MISSILE_AP_KP_YAW = 0.1;           // rad / deg (heading error)
    var MISSILE_AP_KD_YAWRATE = 0.05;    // rad / (deg/s)
    var MISSILE_AP_KP_ALT = 0.0;     // rad / m
    var MISSILE_AP_KD_VS = 0.0;        // rad / (m/s)
    var MISSILE_AP_KD_PITCHRATE = 0.0;   // rad / (rad/s)
    var MISSILE_AP_KD_ROLLRATE = 0.0;    // rad / (rad/s)

    // Altitude hold (outer loop): altitude error -> vertical speed target (m/s)
    // Then (inner loop): vertical speed error -> pitch fin deflection.
    // These caps/deadband prevent "runaway" vertical speeds when altitude is off.
    var MISSILE_AP_ALT_ERR_CLAMP_M = 500;     // clamp altitude error used by guidance
    var MISSILE_AP_ALT_DEADBAND_M = 2;        // ignore tiny errors (reduces hunting)
    var MISSILE_AP_VS_TARGET_PER_M = 0.25;    // (m/s) per m altitude error
    var MISSILE_AP_VS_TARGET_MAX = 160;        // max commanded climb/sink rate (m/s)
    var MISSILE_AP_KP_VS = 0.0002;              // rad per (m/s) vertical speed error

    function getVisibleUserCo(userId) {
        if (typeof multiplayer === "undefined" || !multiplayer || !multiplayer.visibleUsers) return null;
        var u = multiplayer.visibleUsers[userId];
        if (!u || !u.lastUpdate || !u.lastUpdate.co) return null;
        var co = u.lastUpdate.co;
        if (!Array.isArray(co) || co.length < 3) return null;
        if (!isFinite(co[0]) || !isFinite(co[1]) || !isFinite(co[2])) return null;
        return co; // [lat, lon, altM]
    }

    function wrapAngle180(deg) {
        deg = (deg + 180) % 360;
        if (deg < 0) deg += 360;
        return deg - 180;
    }

    /* helper: clamp radians */
    function clampRad(x) { return clamp(x, -15 * DEG, 15 * DEG); }


    var missileCamObj = {
        name: "missile",
        parent: null,                 // independent of aircraft
        distance: 20,                 // meters behind missile
        offsets: { current: [0, 0, 0] },
        orientations: { current: [0, 0, 0] },
        position: [0, 0, 0],
        lastUsedHtr: [0, 0, 0],
    };
    geofs.camera.definitions.missile = missileCamObj; // add to camera definitions

    (function () {

        var originalUpdate = geofs.camera.update;

        let lastVel = [1, 0, 0];

        geofs.camera.update = function (dt) {

            if (geofs.camera.currentModeName === "missile" && lastMissile) {

                var mLla = lastMissile.llaLocation;
                let vE = lastMissile.body.v_linearVelocity;   // ENU m/s
                var vMag = V3.length(vE);

                if (vMag < 1) vE = lastVel;
                else lastVel = vE;

                let fwd = V3.normalize([vE[0], vE[1], 0]);
                if (V3.length(fwd) < 1e-3) fwd = [1, 0, 0];

                var back = V3.scale(fwd, - (geofs.camera.currentDefinition.distance || 20));
                var up = [0, 0, 2];                              // 2 m above

                let camOff = V3.add(back, up);

                // mouse orbit in world plane
                var yaw = controls.mouse.xValue * Math.PI;     // +-180
                var pitch = controls.mouse.yValue * Math.PI / 2;   // +-90
                camOff = M33.transform(M33.rotationZ(M33.identity(), yaw), camOff);
                var right = V3.normalize([camOff[1], -camOff[0], 0]);
                camOff = M33.transform(M33.rotate(M33.identity(), right, pitch), camOff);

                var camLla = V3.add(mLla, xyz2lla(camOff, mLla));
                var htr = lookAt(mLla, camLla, [0, 0, 1]);      // world-level

                geofs.camera.lla = camLla;
                geofs.camera.htr = [fixAngle360(htr[0]),
                fixAngle360(-htr[1]),
                    0];                            // no roll
                geofs.api.setCameraPositionAndOrientation(
                    geofs.camera.cam,
                    camLla,
                    geofs.camera.htr
                );

                geofs.camera.avoidGround();
                geofs.camera.radianRoll = 0;
                return;
            }

            originalUpdate.call(geofs.camera, dt);
        };

    })();
    function dtSec() {
        var t = Date.now();
        var dt = (t - prevTimeMs) * 0.001;
        prevTimeMs = t;
        dt = clamp(dt, 1 / 240, 1 / 20);
        return dt;
    }

    class Trajectory {
        constructor(color = Cesium.Color.RED, width = 4) {
            this.trailLla = []; // Array of [lon, lat, alt] positions
            this.color = color;
            this.width = width;
        }
        get positionsProperty() {
            return new Cesium.CallbackProperty(() => {
                return this.trailLla;
            }, false);
        }
        get trajectoryDescriptor() {
            return {
                type: 'Trajectory',
                polyline: {
                    positions: this.positionsProperty,
                    width: this.width,
                    material: this.color,
                    clampToGround: false
                }
            };
        }

        addPosition(lla) {
            this.trailLla.push(Cesium.Cartesian3.fromDegrees(lla[1], lla[0], lla[2]));
        }

        clear() {
            this.trailLla = [];
        }
    }
    // The missile knows where it is at all times. It knows this because it knows where it isn't. By subtracting where it is from where it isn't...
    class Missile {
        constructor(storeID, stationLLA, stationRot, jettisonImpulse, model) {
            this.manualControl = false; // autopilot by default
            this.targetUserId = null;   // multiplayer user ID to home on (optional)
            this.model = model
            this.storeID = storeID;          // store key
            this.object3d = new Object3D({
                name: "missileRoot",
                "3dmodel": this.model,
                rotation: [0, 0, 0],
                position: [0, 0, 0],
                scale: 1
            });
            this.pathEnded = false; // flag to indicate if the missile has hit the ground
            this.llaLocation = stationLLA.slice();        // [lon, lat, alt m]
            this.rotationMat = M33.dup(stationRot);       // 3x3 body frame
            this.deflectionCmd = { roll: 0, pitch: 0, yaw: 0 };
            this.object3d._initialRotation = M33.dup(this.rotationMat); // body -> ENU
            this.object3d._rotation = M33.dup(this.rotationMat);
            /* 3. Physics */
            this.body = new rigidBody();
            var mKg = stores[storeID].massKg;
            this.body.setMassProps(mKg, 0.002);             // crude tensorFactor

            this.body.setLinearVelocity(
                V3.dup(geofs.aircraft.instance.rigidBody.v_linearVelocity)
            );
            this.body.setAngularVelocity([0, 0, 0]);

            if (jettisonImpulse) {
                this.body.applyCentralImpulse(jettisonImpulse);
            }
            this.thrustN = stores[storeID].thrustN || 0;   // N
            this.burnTime = stores[storeID].burnTime || 0;   // s
            this.burnLeft = this.burnTime;                    // s
            var czViewer = geofs.api.viewer;
            this.trajectory = new Trajectory();
            this.trailEntity = czViewer.entities.add(this.trajectory.trajectoryDescriptor);
            if (this.burnTime > 0) {
                this.smoke = new geofs.fx.ParticleEmitter({
                    location: this.llaLocation.slice(),
                    duration: 1e10,
                    rate: .05,
                    life: 4e4,
                    easing: "easeOutQuart",
                    startScale: .01,
                    endScale: .01,
                    randomizeStartScale: .02,
                    randomizeEndScale: .15,
                    startOpacity: .1,
                    endOpacity: 1e-5,
                    startRotation: "random",
                    texture: "whitesmoke"
                });
            }
            this.buildAirfoils()
            this.model.setPositionOrientationAndScale(this.llaLocation, M33.getOrientation(this.rotationMat));
        }

        forwardENU() {
            // third row of row-major body -> ENU matrix
            return V3.normalize([this.rotationMat[2][0], this.rotationMat[2][1], this.rotationMat[2][2]]);
        }

        readJoystick() {
            if (!this.manualControl) return;
            var s = controls.joystick.sticks[1] || { axes: [0, 0, 0] };
            var sY = controls.joystick.sticks[0] || { axes: [0, 0, 0] };
            var max = maxSurfaceDeflection * DEG;
            this.deflectionCmd.roll = s.axes[0] * max;
            this.deflectionCmd.pitch = -s.axes[1] * max;
            this.deflectionCmd.yaw = (sY.axes[5] || 0) * max;
        }

        buildAirfoils() {
            var frame = this.model.object3d;

            this.airfoils = stores[this.storeID].surfaces.map(s => {
                var of = {
                    name: s.name,
                    store: s,
                    deltamax: s.deltamax,
                    object3d: frame, // same world frame
                    points: {
                        forceSourcePoint: {
                            worldPosition: V3.add(s.pos, airfoilPosOffset) // filled each tick
                        }
                    },
                    forceDirection: s.forceDirection, // index of local Z for lift dir
                    stalls: (s.stalls !== undefined) ? s.stalls : true,
                    stallIncidence: s.stallIncidence || 0, // deg
                    zeroLiftIncidence: s.zeroLiftIncidence || 0,

                    area: s.area,
                    span: s.span,
                    chord: s.chord,
                    aspectRatio: s.aspectRatio,
                    efficiencyFactor: s.efficiencyFactor,
                    liftFactor: null, dragFactor: null
                };
                return of;
            });
            if (DEBUG_LIFT_VECTORS) {
                var viewer = geofs.api.viewer;
                this.airfoils.forEach(af => {
                    af.debugTraj = new Trajectory(Cesium.Color.LIME, 4);
                    af.debugEntity = viewer.entities.add(af.debugTraj.trajectoryDescriptor);
                    /* ---------- NEW: drag line (yellow) ----------------- */
                    af.debugDragTraj = new Trajectory(Cesium.Color.YELLOW, 2);
                    af.debugDragEnt = viewer.entities.add(af.debugDragTraj.trajectoryDescriptor);
                });
            }

        }

        axisByIndex(i) {
            switch (i) {
                case 0: return [1, 0, 0];   // +X  right
                case 1: return [0, 1, 0];   // +Y  forward
                default: return [0, 0, 1];   // +Z  up
            }
        }

        spanFromNormal(normal) {
            let span = V3.cross(normal, [0, 1, 0]);     // x forward
            if (V3.length(span) < 1e-6) {                // parallel case
                span = V3.cross(normal, [0, 0, 1]);     // x up
            }
            return V3.normalize(span);
        }

        applyGeoFSairfoils() {
            var c = this;

            for (let y = 0, M = c.airfoils.length; y < M; y++) {

                var Y = c.airfoils[y];
                var store = Y.store || stores[this.storeID].surfaces[y];

                var wp = M33.transform(this.rotationMat, store.pos);       // body -> ENU (vector from CG)
                var X = Y.points.forceSourcePoint;
                X.worldPosition = wp;

                var Q = c.body.getVelocityInLocalPoint(X.worldPosition); // ENU

                var w = (typeof weather !== "undefined") ? weather : null;
                if (w && w.currentWindVector) {
                    Q = V3.sub(Q, w.currentWindVector);
                }
                if (w && w.thermals && w.thermals.currentVector) {
                    Q = V3.sub(Q, w.thermals.currentVector);
                }
                if (w && typeof w.getLocalTurbulence === "function") {
                    var ee = (Object3D && Object3D.utilities && typeof Object3D.utilities.getPointLla === "function")
                        ? Object3D.utilities.getPointLla(X, this.llaLocation)
                        : V3.add(this.llaLocation, xyz2lla(X.worldPosition, this.llaLocation));
                    Q = V3.add(Q, w.getLocalTurbulence(ee));
                }

                Y.velocity = V3.length(Q);
                if (Y.velocity < 0.5) continue;

                var et = V3.normalize(Q);

                if (!Y._lastEt) {
                    Y._lastEt = V3.dup(et);
                } else {
                    var blend = clamp((Y.velocity - 1) / 25, 0, 1); // 0=slow -> heavily smoothed
                    et = V3.normalize([
                        Y._lastEt[0] * (1 - blend) + et[0] * blend,
                        Y._lastEt[1] * (1 - blend) + et[1] * blend,
                        Y._lastEt[2] * (1 - blend) + et[2] * blend
                    ]);
                    Y._lastEt = V3.dup(et);
                }

                var vAirLin = V3.dup(this.body.v_linearVelocity || [0, 0, 0]);
                if (w && w.currentWindVector) vAirLin = V3.sub(vAirLin, w.currentWindVector);
                if (w && w.thermals && w.thermals.currentVector) vAirLin = V3.sub(vAirLin, w.thermals.currentVector);
                var vAirLinMag = V3.length(vAirLin);
                var pointSpeedCap = Math.max(MISSILE_POINT_SPEED_CAP_MIN, vAirLinMag * 1.5);
                var vEff = Math.min(Y.velocity, pointSpeedCap);
                var ei = vEff * vEff;

                var eaBody = (store && store.normal) ? V3.normalize(store.normal) : this.axisByIndex(Y.forceDirection);

                var hingeAxisBody = null;
                if (store && store.hingeAxis) {
                    hingeAxisBody = V3.normalize(store.hingeAxis);
                } else if (store && store.role) {
                    switch (store.role) {
                        case "pitch":
                            hingeAxisBody = [1, 0, 0];
                            break;
                        case "roll":
                            hingeAxisBody = [1, 0, 0];
                            break;
                        case "yaw":
                            hingeAxisBody = [0, 0, 1];
                            break;
                        default:
                            hingeAxisBody = null;
                    }
                }
                if (!hingeAxisBody) {
                    hingeAxisBody = this.spanFromNormal(eaBody);
                }

                var defl = 0;
                if (store && store.role) {
                    var cmd = this.deflectionCmd[store.role] || 0;
                    defl = clamp(cmd, -store.deltamax, store.deltamax) * (store.sign || 1);
                }
                // Control authority should fade at low airspeed to avoid wild flips.
                defl *= clamp(Y.velocity / 30, 0, 1);
                if (defl && V3 && typeof V3.rotate === "function") {
                    eaBody = V3.rotate(eaBody, hingeAxisBody, defl);
                }
                var ea = V3.normalize(M33.transform(this.rotationMat, eaBody));

                var eo = -V3.dot(ea, et);
                Y.angleOfAttack = eo;
                var en = V3.cross(ea, et);
                var er = ea;
                if (V3.length(en) > 1e-9 && V3 && typeof V3.rotate === "function") {
                    er = V3.rotate(ea, en, Y.angleOfAttack);
                }

                var rho = (w && w.atmosphere && w.atmosphere.airDensityAtAltitude) ? w.atmosphere.airDensityAtAltitude : 1.225;
                var lift = [0, 0, 0];
                var drag = [0, 0, 0];
                var qLift = 0;
                var Hdrag = 0;

                if (Y.span) {
                    var el = Y.aspectRatio || (Y.span / Y.chord);
                    var ec = Y.area || (Y.span * Y.chord);
                    ec *= clamp(Y.velocity / 100, 0, 1) //stability
                    var ed = Y.angleOfAttack * TWO_PI * (el / (el + 2));

                    if (!0 == Y.stalls) {
                        var ep = Math.abs(Y.angleOfAttack * RAD_TO_DEGREES);
                        // Missile-specific: allow lift to roll off to ~0 in deep stall.
                        ep > Y.stallIncidence && (ed *= 1 - clamp((ep - Y.stallIncidence) / (Y.zeroLiftIncidence || 1), 0, 1));
                    }

                    var eu = ed * ed / (PI * el * (Y.efficiencyFactor || _PLANFORM_EFFICIENCY_FACTOR)) + 0;
                    var eh = .5 * rho * ei * ec;
                    Hdrag = eu * eh;
                    qLift = ed * eh;
                } else if (Y.area) {
                    var em = Y.angleOfAttack * TWO_PI;

                    if (!0 == Y.stalls) {
                        var ep = Math.abs(Y.angleOfAttack * RAD_TO_DEGREES);
                        ep > Y.stallIncidence && (em *= 1 - clamp((ep - Y.stallIncidence) / (Y.zeroLiftIncidence || 1), 0, 1));
                    }
                    Hdrag = .5 * ei * (_MIN_DRAG_COEF + _DRAG_CONSTANT * em * em) * rho;
                    qLift = rho * ei * .5 * Y.area * em;
                } else {
                    var ef = Y.liftFactor;
                    var eg = Y.dragFactor;
                    if (ef && eg) {
                        if (!0 == Y.stalls) {
                            var ep = Math.abs(Y.angleOfAttack * RAD_TO_DEGREES);
                            ep > Y.stallIncidence && (ef *= 1 - clamp((ep - Y.stallIncidence) / (Y.zeroLiftIncidence || 1), 0, 1));
                        }
                        var e$ = Y.angleOfAttack * ei;
                        qLift = ef * e$ * rho;
                        Hdrag = eg * Math.abs(e$) * rho;
                    }
                }

                if (qLift) {
                    lift = V3.scale(er, qLift);
                    c.body.applyForce(lift, X.worldPosition);
                }
                if (Hdrag) {
                    drag = V3.scale(et, -Hdrag);
                    c.body.applyForce(drag, X.worldPosition);
                }

                if (DEBUG_LIFT_VECTORS && Y.debugTraj) {
                    var baseLla = V3.add(this.llaLocation, xyz2lla(wp, this.llaLocation));
                    var tipLla = V3.add(baseLla,
                        xyz2lla(V3.scale(lift, LIFT_SCALE), baseLla));
                    var traj = Y.debugTraj;
                    traj.clear();
                    traj.addPosition(baseLla);
                    traj.addPosition(tipLla);
                }
                if (DEBUG_LIFT_VECTORS && Y.debugDragTraj) {
                    var baseLlaD = V3.add(this.llaLocation, xyz2lla(wp, this.llaLocation));

                    var tipLlaD = V3.add(baseLlaD,
                        xyz2lla(V3.scale(drag, DRAG_SCALE), baseLlaD));

                    var dtraj = Y.debugDragTraj;
                    dtraj.clear();
                    dtraj.addPosition(baseLlaD);
                    dtraj.addPosition(tipLlaD);
                }
            }
        }


        integrateTransform(dt) {

            var dLla = xyz2lla(
                V3.scale(this.body.v_linearVelocity, dt),
                this.llaLocation
            );
            this.llaLocation = V3.add(this.llaLocation, dLla);

            let dEulerBody = V3.scale(this.body.v_angularVelocity, dt);

            dEulerBody = M33.transformByTranspose(
                this.object3d._initialRotation,
                dEulerBody
            );

            this.object3d.rotateInitialRotation(dEulerBody);

            this.rotationMat = this.object3d._rotation;

            this.object3d.compute(this.llaLocation);
            this.object3d.render(this.llaLocation);
        }
        updateLevelHold(dt) {

            if (this.manualControl) return; // stick in charge
            if (!MISSILE_AUTOPILOT_ENABLED) return;

            var mat = this.rotationMat; // body -> ENU
            var eul = M33.getOrientation(mat) || [0, 0, 0]; // [heading, pitch, roll] deg
            var headingDeg = eul[0] || 0;
            var rollDeg = eul[2] || 0;


            var targetHeadingDeg = (MISSILE_TARGET_HEADING_DEG || 0);
            var targetAltM = (MISSILE_TARGET_ALTITUDE_M || 0);
            if (this.targetUserId !== null && this.targetUserId !== undefined) {
                var tgtCo = getVisibleUserCo(this.targetUserId);
                if (tgtCo && geofs && geofs.utils && typeof geofs.utils.bearingBetweenLocations === "function") {
                    var missileCo = [
                        this.llaLocation ? this.llaLocation[1] : 0,
                        this.llaLocation ? this.llaLocation[0] : 0,
                        this.llaLocation ? this.llaLocation[2] : 0
                    ];
                    targetHeadingDeg = geofs.utils.bearingBetweenLocations(missileCo, tgtCo);
                    targetAltM = tgtCo[2];
                }
            }

            // errors (deg / m)
            if (!isFinite(targetHeadingDeg)) targetHeadingDeg = (MISSILE_TARGET_HEADING_DEG || 0);
            if (!isFinite(targetAltM)) targetAltM = (MISSILE_TARGET_ALTITUDE_M || 0);
            var hdgErrDeg = wrapAngle180(targetHeadingDeg - headingDeg);
            var altNow = (this.llaLocation && isFinite(this.llaLocation[2])) ? this.llaLocation[2] : 0;
            var altErrM = clamp(targetAltM - altNow, -MISSILE_AP_ALT_ERR_CLAMP_M, MISSILE_AP_ALT_ERR_CLAMP_M);

            // rates in BODY (rad/s)
            var ratesWorld = (this.body && typeof this.body.getAngularVelocity === "function")
                ? this.body.getAngularVelocity()
                : (this.body && this.body.v_angularVelocity) || [0, 0, 0];
            var ratesB = M33.transformByTranspose(mat, ratesWorld) || [0, 0, 0];
            var rollRate = ratesB[0] || 0;
            var pitchRate = ratesB[1] || 0;
            var yawRate = ratesB[2] || 0;

            // vertical speed (m/s, +up)
            var vWorld = (this.body && this.body.v_linearVelocity) || [0, 0, 0];
            var verticalSpeed = vWorld[2] || 0;

            // altitude -> vertical speed target (outer loop)
            var altErrAbs = Math.abs(altErrM);
            var altErrForVs = (altErrAbs <= MISSILE_AP_ALT_DEADBAND_M)
                ? 0
                : (altErrM - Math.sign(altErrM) * MISSILE_AP_ALT_DEADBAND_M);
            var verticalSpeedTarget = clamp(
                altErrForVs * MISSILE_AP_VS_TARGET_PER_M,
                -MISSILE_AP_VS_TARGET_MAX,
                MISSILE_AP_VS_TARGET_MAX
            );
            if (!isFinite(verticalSpeedTarget)) verticalSpeedTarget = 0;
            var vsErr = verticalSpeedTarget - verticalSpeed;
            // control laws (outputs are fin deflection radians)
            var yawSteerDeg = clamp(
                MISSILE_AP_BANK_PER_DEG_HDG * hdgErrDeg,
                -MISSILE_AP_MAX_BANK_DEG,
                MISSILE_AP_MAX_BANK_DEG
            );

            // Heading -> yaw deflection (P) with yaw-rate damping (D).
            var yawCmd = (MISSILE_AP_KP_BANK * yawSteerDeg)
                + (MISSILE_AP_KP_YAW * hdgErrDeg)
                - (MISSILE_AP_KD_ROLLRATE * yawRate)
                - (MISSILE_AP_KD_YAWRATE * (yawRate * RAD_TO_DEGREES));

            var rollCmd = (MISSILE_AP_KP_BANK * wrapAngle180(0 - rollDeg)) - (MISSILE_AP_KD_ROLLRATE * rollRate);
            // Pitch
            var pitchCmd = (MISSILE_AP_KP_VS * vsErr) - (MISSILE_AP_KD_VS * verticalSpeed) - (MISSILE_AP_KD_PITCHRATE * pitchRate);

            if (!isFinite(yawCmd)) yawCmd = 0;
            if (!isFinite(pitchCmd)) pitchCmd = 0;
            if (!isFinite(rollCmd)) rollCmd = 0;

            this.deflectionCmd.roll = clampRad(rollCmd);
            this.deflectionCmd.pitch = -clampRad(pitchCmd);
            this.deflectionCmd.yaw = clampRad(yawCmd);
        }
        step(dt) {

            this.body.v_totalForce = V3.dup(this.body.gravityForce);


            var wVec = this.body.v_angularVelocity || [0, 0, 0];
            var omega = V3.length(wVec);
            if (omega > MISSILE_MAX_OMEGA && typeof this.body.setAngularVelocity === "function") {
                this.body.setAngularVelocity(V3.scale(wVec, MISSILE_MAX_OMEGA / omega));
                wVec = this.body.v_angularVelocity || wVec;
                omega = MISSILE_MAX_OMEGA;
            }
            if (omega > 0.01 && typeof this.body.applyTorque === "function") {
                var vAir = V3.dup(this.body.v_linearVelocity || [0, 0, 0]);
                var w = (typeof weather !== "undefined") ? weather : null;
                if (w && w.currentWindVector) vAir = V3.sub(vAir, w.currentWindVector);
                if (w && w.thermals && w.thermals.currentVector) vAir = V3.sub(vAir, w.thermals.currentVector);
                var vMag = V3.length(vAir);
                // Stronger damping when slow (prevents "spin-up" at low speed)
                var gain = clamp((40 - vMag) / 40, 0, 1);
                var dampTorque = V3.scale(wVec, -MISSILE_SPIN_DAMP_TORQUE * gain);
                this.body.applyTorque(dampTorque);
            }
            if (this.burnLeft > 0) {
                var fwd = M33.transform(this.rotationMat, [0, 1, 0]); // forward vector in body frame
                this.body.applyCentralForce(V3.scale(fwd, this.thrustN));

                this.burnLeft -= dt;
                if (this.burnLeft <= 0 && this.smoke) {
                    this.smoke.turnOff();    // cease emission
                }
            }
            this.readJoystick()
            this.updateLevelHold(dt);
            this.applyGeoFSairfoils();
            this.body.integrateVelocities(dt);
            this.integrateTransform(dt);
            if (this.smoke && this.smoke.isOn()) {
                this.smoke._options.location = this.llaLocation.slice();
                this.smoke.update();
            }
            if (this.llaLocation[2] < 0) this.pathEnded = true;
            if (!this.pathEnded) this.trajectory.addPosition(this.llaLocation);
        }
    }

    //geofs.aircraft.instance.rigidBody.setMassProps(geofs.aircraft.instance.definition.mass, geofs.aircraft.instance.definition.tensorFactor) - used to set the mass and inertia tensor of the aircraft
    //geofs.aircraft.instance.rigidBody.applyTorqueImpulse([0, 0, 0]); - used to apply a torque impulse to the aircraft
    //geofs.aircraft.instance.rigidBody.applyCentralImpulse([0, 0, 0]); - used to apply a central impulse to the aircraft


    function getLocalAngularVelocity() {
        // Returns an array [wx, wy, wz] representing the angular velocity in local coordinates

        if (!geofs.aircraft || !geofs.aircraft.instance || !geofs.aircraft.instance.rigidBody) {
            console.error("Aircraft instance or rigid body is not defined.");
            return null;
        }

        var wWorld = geofs.aircraft.instance.rigidBody.v_angularVelocity;   // [wx, wy, wz]

        var R = geofs.aircraft.instance.object3d._initialRotation;

        var wLocal = M33.transformByTranspose(R, wWorld);

        return wLocal;  // [wx, wy, wz]
    }

    function convertToWorldAngularVelocity(wLocal) {
        var R = geofs.aircraft.instance.object3d._initialRotation;

        return M33.transform(R, wLocal);
    }



    var loadout = {};              // key = station number, value = store key

    var emptyMass = geofs.aircraft.instance.definition.mass;          // kg
    var tensorFactor = geofs.aircraft.instance.definition.tensorFactor;  // scalar

    function setMassAndInertia(totalMassKg) {
        geofs.aircraft.instance.rigidBody.setMassProps(totalMassKg, tensorFactor);
    }

    function recalcMass() {
        var extra = 0;
        Object.values(loadout).forEach(id => extra += stores[id].massKg);
        setMassAndInertia(emptyMass + extra);
    }


    function currentDragIndex() {
        var d = 0;
        Object.values(loadout).forEach(id => d += stores[id].drag);
        return d;
    }


    function mount(storeID, stationID) {
        activeStores.forEach((store) => {
            store.model.destroy();
        })
        activeIndices = []
        activeStores = [];  // clear the active stores list

        if (!stores[storeID]) { console.warn("Unknown store"); return; }
        if (!f16Stations[stationID]) { console.warn("Bad station"); return; }
        loadout[stationID] = storeID;
        if (storeID === "AIM9X") {
            var slotL = f16Stations[stationID].pos;  // local offset in meters
            f16Stations[stationID].model = new geofs.api.Model(
                "https://raw.githack.com/Ariakim-Taiyo/GeoFS-Shaders-Repository/main/resources/aim9x.glb"
            );  // store the model for later use
            geofs.api.addFrameCallback(function () { assignPos(slotL, f16Stations[stationID].model, stationID) });
        }
        if (storeID === "AIM120C") {
            var slotL = f16Stations[stationID].pos;  // local offset in meters
            f16Stations[stationID].model = new geofs.api.Model(
                "https://raw.githack.com/Ariakim-Taiyo/GeoFS-Shaders-Repository/main/resources/aim120c.glb"
            );  // store the model for later use
            geofs.api.addFrameCallback(function () { assignPos(slotL, f16Stations[stationID].model, stationID) });
        }

        recalcMass();
    }

    function jettison(stationID) {
        var id = loadout[stationID];
        if (!id) { return; }

        // torque because of off-axis drop
        var R = geofs.aircraft.instance.object3d._rotation;
        var arm = f16Stations[stationID].pos;
        var torque = [
            0,
            arm[0] * 1000,
            0
        ];
        geofs.aircraft.instance.rigidBody.applyTorqueImpulse(M33.transform(R, torque)); // apply torque in body frame
        //f16Stations[stationID].model.destroy();  // destroy the model if it exists
        delete loadout[stationID];
        recalcMass();
    }

    function clearLoadout() {
        var stationIDs = Object.keys(loadout);


        stationIDs.forEach((station, index) => {
            setTimeout(() => {
                if (f16Stations[station].model === null) return;
                launchStation(station);
            }, index * 250); // 250ms = 0.25 seconds
        });
    }


    function assignPos(slotL, model, index) {
        if (activeIndices.includes(index)) {
            var activeStore = activeStores.find(store => activeIndices.indexOf(index) === activeStores.indexOf(store));
            if (activeStore) {
                var location = activeStore.llaLocation;
                //model.setPositionOrientationAndScale(location, M33.getOrientation(activeStore.rotationMat));
                return;
            }
        };
        var R = geofs.aircraft.instance.object3d._rotation;
        var degTipPos = V3.add(geofs.aircraft.instance.llaLocation, xyz2lla(M33.transform(R, slotL), geofs.aircraft.instance.llaLocation));
        var missileRot1 = M33.getOrientation(geofs.aircraft.instance.object3d._rotation);

        model.setPositionOrientationAndScale(degTipPos, missileRot1);
    }

    function launchStation(stationID, follow) {
        var storeID = loadout[stationID];
        if (!storeID) return;
        if (f16Stations[stationID].model === null) return;
        var R = geofs.aircraft.instance.object3d._rotation;
        var slotPos = f16Stations[stationID].pos;
        var posLLA = V3.add(geofs.aircraft.instance.llaLocation, xyz2lla(M33.transform(R, slotPos), geofs.aircraft.instance.llaLocation));

        var mKg = stores[storeID].massKg;
        var impulse = [0, 0, 0];

        var missileModel = f16Stations[stationID].model;
        var missile = new Missile(storeID, posLLA, R, impulse, missileModel);
        activeStores.push(missile);
        activeIndices.push(parseInt(stationID));
        lastMissile = missile;
        if (follow) geofs.camera.currentModeName = "missile";
        jettison(stationID);
        recalcMass();
        return missile;
    }

    // Fire a missile from a station and home it on a multiplayer user.
    // Usage (console): fireMissileAtUserId(12345, 1, true)
    window.fireMissileAtUserId = function (targetUserId, stationID, follow) {
        var id = Number(targetUserId);
        if (!isFinite(id)) {
            console.warn("fireMissileAtUserId: targetUserId must be a number");
            return null;
        }
        if (stationID === undefined || stationID === null) stationID = 1;
        if (follow === undefined) follow = true;

        // Optional: warn early if target isn't visible.
        if (!getVisibleUserCo(id)) {
            console.warn("fireMissileAtUserId: target user not visible (yet):", id);
        }

        var missile = launchStation(stationID, follow);
        if (!missile) {
            console.warn("fireMissileAtUserId: could not launch from station:", stationID);
            return null;
        }
        missile.manualControl = false;
        missile.targetUserId = id;
        return missile;
    };

    function stepMissiles() {
        var dtTotal = dtSec();

        // Physics substepping
        var baseDt = (geofs && geofs.api && geofs.api.renderingSettings && geofs.api.renderingSettings.physicsDeltaMs)
            ? geofs.api.renderingSettings.physicsDeltaMs * 0.001
            : (1 / 120);
        var subSteps = clamp(Math.floor(dtTotal / baseDt), 1, 10);
        var dt = dtTotal / subSteps;

        if (lastMissile.llaLocation[2] < 0) { // if the last missile is below ground level, reset camera
            geofs.camera.currentModeName = "follow";
            if (lastMissile.trailEntity) {
                lastMissile.trajectory.clear();
                lastMissile.trailEntity = null;
            }
        }
        for (let s = 0; s < subSteps; s++) {
            for (let i = activeStores.length - 1; i >= 0; --i) {
                activeStores[i].step(dt);

                if (activeStores[i].llaLocation[2] < 0) {
                    activeStores[i].model.destroy();
                }
            }
        }
    }
    geofs.api.addFrameCallback(function () { stepMissiles(); });

