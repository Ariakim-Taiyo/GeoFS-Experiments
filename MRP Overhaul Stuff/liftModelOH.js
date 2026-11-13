/* DEVELOPER NOTES AS OF 11/12/2026:
As with the "f16DynamicDamage.js" script, this was also largely written by AI. 
It's almost nostalgic seeing how old AI used to work; it definitely took a lot more user intervention 
to get anywhere with it. Nowadays you can just ask Claude for whatever you want and come back an hour later
to a finished script (Probably very bug-riddled though).
There's still a lot to be improved with this approach, but for an experiment I'd call it a success.
It only works with the C172, or at least it did like a year ago. Not sure about that now...
*/
geofs.aircraft.instance.definition.dragFactor = 1;
geofs.aircraft.instance.definition.liftFactor = 1;
weather.atmosphericDisturbanceScale = 200

var propellers = {
    "1": {
        name: "propeller",
        isRudder: false,
        position: [0, 2.3, -0.5], //origin of the propeller object, in meters (local coordinates)
        rotation: [90, 3, 0], //angle of the propellers, in degrees (local coordinates)
        bladePitch: 0, //additional angle of the propeller blades, in degrees (local coordinates). Can be used to simulate a constant speed propeller.
        bladeStartPitch: 60, //angle of the propeller blades at the hub, in degrees (local coordinates)
        bladeEndPitch: 40, //angle of the propeller blades at the tip, in degrees (local coordinates), can be used to simulate washout
        radius: 1, //radius from the center of rotation to the blade tips, in meters
        hubRadius: 0.1, //radius from the center of rotation to the point where blades are attached, in meters
        bladeCount: 4, //number of blades
        bladeWidth: 0.01, //in meters
        propDrag: 0.5, //drag factor of the propeller
        propLift: 1, //lift factor of the propeller
        inertia: 20.0, //inertia of the propeller, in kg*m^2, if specified then no need to specify bladeMass.
        bladeMass: 0.0, //mass of a single blade, in kg
        isConstantSpeed: false, //if true, the propeller will rotate at a constant speed. If false, the propeller will rotate at a speed proportional to the rpm of the engine.
    }
}
var airfoils = {
    "1": {
        name: "rightWing",
        isRudder: false,
        span: 5, //total wingspan of the airfoil, in meters
        rootChord: 2, //in meters
        tipChord: 0.7, //in meters
        startPosition: [0.5, 0.7, 0.1], //at wing root, in meters (local coordinates)
        startRotation: [-1.5, 1, 0], //at wing root, in degrees (local coordinates)
        endRotation: [1.5, 1, 0], //at wing tip, in degrees (local coordinates), can be used to simulate washout
        type: "NACA-2412", //airfoil type, currently should just be "NACA-2412", but we can add new airfoil arrays later.
        "controlSurfaces": [
            {
                name: "flap",
                startLength: 0, //at what length along the airfoil should this surface start? , in meters
                surfaceLength: 2, //length of the control surface itself, in meters (local coordinates)
                depth: 1500, //how far into the wing should this surface's hinge point be? in meters (local coordinates)
                position: 0, //0 = placed along the trailing edge of the airfoil, 1 = placed along the leading edge.
                deflection: 2, //maximum surface deflection, in degrees
                value: "flapsPositionRatio", //name of the geofs animation value to control this surface
                ratio: -0.75 //multiply "value" by this number before computing the deflection. This can be used to make ailerons turn in opposite directions, for example.
            },
            {
                name: "aileron",
                startLength: 2.1, //at what length along the airfoil should this surface start? , in meters
                surfaceLength: 2.5, //length of the control surface itself, in meters (local coordinates)
                depth: 100, //how far into the wing should this surface's hinge point be? in meters (local coordinates)
                position: 0, //0 = placed along the trailing edge of the airfoil, 1 = placed along the leading edge.
                deflection: 5, //maximum surface deflection, in degrees
                value: "roll", //name of the geofs animation value to control this surface
                ratio: 1 //multiply "value" by this number before computing the deflection. This can be used to make ailerons turn in opposite directions, for example.
            }
        ]
    },
    "2": {
        name: "leftWing",
        isRudder: false,
        span: 5, //total wingspan of the airfoil, in meters
        rootChord: 2, //in meters
        tipChord: 0.7, //in meters
        startPosition: [-0.5, 0.7, 0.1], //at wing root, in meters (local coordinates)
        startRotation: [-1.5, -1, 0], //at wing root, in degrees (local coordinates)
        endRotation: [1.5, -1, 0], //at wing tip, in degrees (local coordinates), can be used to simulate washout
        type: "NACA-2412", //airfoil type, currently should just be "NACA-2412", but we can add new airfoil arrays later.
        "controlSurfaces": [
            {
                name: "flap",
                startLength: 0, //at what length along the airfoil should this surface start? , in meters
                surfaceLength: 2, //length of the control surface itself, in meters (local coordinates)
                depth: 1500, //how far into the wing should this surface's hinge point be? in meters (local coordinates)
                position: 0, //0 = placed along the trailing edge of the airfoil, 1 = placed along the leading edge.
                deflection: 2, //maximum surface deflection, in degrees
                value: "flapsPositionRatio", //name of the geofs animation value to control this surface
                ratio: -0.75 //multiply "value" by this number before computing the deflection. This can be used to make ailerons turn in opposite directions, for example.
            },
            {
                name: "aileron",
                startLength: 2.1, //at what length along the airfoil should this surface start? , in meters
                surfaceLength: 2.5, //length of the control surface itself, in meters (local coordinates)
                depth: 100, //how far into the wing should this surface's hinge point be? in meters (local coordinates)
                position: 0, //0 = placed along the trailing edge of the airfoil, 1 = placed along the leading edge.
                deflection: 5, //maximum surface deflection, in degrees
                value: "roll", //name of the geofs animation value to control this surface
                ratio: -1 //multiply "value" by this number before computing the deflection. This can be used to make ailerons turn in opposite directions, for example.
            }
        ]
    },
    "3": {
        name: "horizontalStabilizerLeft",
        isRudder: false,
        span: 1.6, //total wingspan of the airfoil, in meters
        rootChord: 1.1, //in meters
        tipChord: 0.8, //in meters
        startPosition: [-0.1, -4.2, -0.2], //at wing root, in meters (local coordinates)
        startRotation: [0, 0, 0], //at wing root, in degrees (local coordinates)
        endRotation: [0, 0, 0], //at wing tip, in degrees (local coordinates), can be used to simulate washout
        type: "NACA-2412", //airfoil type, currently should just be "NACA-2412", but we can add new airfoil arrays later.
        "controlSurfaces": [
            {
                name: "elevator",
                startLength: 0.1, //at what length along the airfoil should this surface start? , in meters
                surfaceLength: 1.4, //length of the control surface itself, in meters (local coordinates)
                depth: 10, //how far into the wing should this surface's hinge point be? in meters (local coordinates)
                position: 0, //0 = placed along the trailing edge of the airfoil, 1 = placed along the leading edge.
                deflection: 15, //maximum surface deflection, in degrees
                value: "pitch", //name of the geofs animation value to control this surface
                ratio: 1 //multiply "value" by this number before computing the deflection. This can be used to make ailerons turn in opposite directions, for example.
            }
        ]
    },
    "4": {
        name: "horizontalStabilizerRight",
        isRudder: false,
        span: 1.6, //total wingspan of the airfoil, in meters
        rootChord: 1.1, //in meters
        tipChord: 0.8, //in meters
        startPosition: [0.1, -4.2, -0.2], //at wing root, in meters (local coordinates)
        startRotation: [0, 0, 0], //at wing root, in degrees (local coordinates)
        endRotation: [0, 0, 0], //at wing tip, in degrees (local coordinates), can be used to simulate washout
        type: "NACA-2412", //airfoil type, currently should just be "NACA-2412", but we can add new airfoil arrays later.
        "controlSurfaces": [
            {
                name: "elevator",
                startLength: 0.1, //at what length along the airfoil should this surface start? , in meters
                surfaceLength: 1.4, //length of the control surface itself, in meters (local coordinates)
                depth: 10, //how far into the wing should this surface's hinge point be? in meters (local coordinates)
                position: 0, //0 = placed along the trailing edge of the airfoil, 1 = placed along the leading edge.
                deflection: 15, //maximum surface deflection, in degrees
                value: "pitch", //name of the geofs animation value to control this surface
                ratio: 1 //multiply "value" by this number before computing the deflection. This can be used to make ailerons turn in opposite directions, for example.
            }
        ]
    },
    "5": {
        name: "rudder",
        isRudder: true, //this is a rudder
        span: 1.6, //total wingspan of the airfoil, in meters
        rootChord: 1.5, //in meters
        tipChord: 0.8, //in meters
        startPosition: [0.1, -4.2, 0.0], //at wing root, in meters (local coordinates)
        startRotation: [0, 90, 0], //at wing root, in degrees (local coordinates)
        endRotation: [0, 90, 0], //at wing tip, in degrees (local coordinates), can be used to simulate washout
        type: "NACA-2412", //airfoil type, currently should just be "NACA-2412", but we can add new airfoil arrays later.
        "controlSurfaces": [
            {
                name: "elevator",
                startLength: 0.1, //at what length along the airfoil should this surface start? , in meters
                surfaceLength: 1.4, //length of the control surface itself, in meters (local coordinates)
                depth: 10, //how far into the wing should this surface's hinge point be? in meters (local coordinates)
                position: 0, //0 = placed along the trailing edge of the airfoil, 1 = placed along the leading edge.
                deflection: 15, //maximum surface deflection, in degrees
                value: "yaw", //name of the geofs animation value to control this surface
                ratio: -1 //multiply "value" by this number before computing the deflection. This can be used to make ailerons turn in opposite directions, for example.
            }
        ]
    },
    "6": {
        name: "bodyLateral",
        isRudder: true,
        span: 1, //total wingspan of the airfoil, in meters
        rootChord: 0.5, //in meters
        tipChord: 0.5, //in meters
        startPosition: [-0.1, 0, 0.0], //at wing root, in meters (local coordinates)
        startRotation: [90, 90, 0], //at wing root, in degrees (local coordinates)
        endRotation: [90, 90, 0], //at wing tip, in degrees (local coordinates), can be used to simulate washout
        type: "NACA-2412", //airfoil type, currently should just be "NACA-2412", but we can add new airfoil arrays later.
    },
    "7": {
        name: "bodyLongitudinal",
        isRudder: false,
        span: 0.5, //total wingspan of the airfoil, in meters
        rootChord: 1, //in meters
        tipChord: 1, //in meters
        startPosition: [-0.01, 0, 0.0], //at wing root, in meters (local coordinates)
        startRotation: [0, 90, 90], //at wing root, in degrees (local coordinates)
        endRotation: [0, 90, 90], //at wing tip, in degrees (local coordinates), can be used to simulate washout
        type: "NACA-2412", //airfoil type, currently should just be "NACA-2412", but we can add new airfoil arrays later.
    }
}

var DEBUG_LIFT_VECTORS = true;   // yellow
var DEBUG_AIRFOIL_SURFACES = true;
var DEBUG_PROP_VECTORS = true;   // green
class Trajectory {
    constructor(color = Cesium.Color.RED, width = 4) {
        this.trailLla = []; this.color = color; this.width = width;
    }
    get positionsProperty() { return new Cesium.CallbackProperty(() => this.trailLla, false); }
    get trajectoryDescriptor() { return { type: 'Trajectory', polyline: { positions: this.positionsProperty, width: this.width, material: this.color, clampToGround: false } }; }
    addPosition(lla) { this.trailLla.push(Cesium.Cartesian3.fromDegrees(lla[1], lla[0], lla[2])); }
    setColor(color) { this.color = color; }
    clear() { this.trailLla = []; }
}
class SurfaceOverlay {
    constructor() {
        this.viewer = geofs.api.viewer;
        this.ds = new Cesium.CustomDataSource('BladeSurfaces');
        this.viewer.dataSources.add(this.ds);
        this.entities = [];                 // keep a handle for later clear
    }
    clear() {
        this.entities.forEach(e => this.ds.entities.remove(e));
        this.entities.length = 0;
    }
    addQuad(p1, p2, p3, p4) {
        var ent = this.ds.entities.add({
            polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArrayHeights([
                    p1[1], p1[0], p1[2],
                    p2[1], p2[0], p2[2],
                    p3[1], p3[0], p3[2],
                    p4[1], p4[0], p4[2]
                ]),
                material: Cesium.Color.CYAN.withAlpha(0.25),
                outline: true,
                outlineColor: Cesium.Color.CYAN.withAlpha(0.6)
            }
        });
        this.entities.push(ent);
    }
}
var surfaceDbg = new SurfaceOverlay();

var DEG2RAD = Math.PI / 180, RAD2DEG = 180 / Math.PI;
var lerp = (a, b, t) => a + (b - a) * t;

/*  Simple NACA-2412 polar  (–20…+20 deg, 0.5 deg / bin)  */
var POLAR_MIN = -180, POLAR_MAX = 180, POLAR_RES = 1;
var naca2412 = [{ "alpha": "-180.0", "cL": "0.14000", "cD": "0.03000" }, { "alpha": "-179.0", "cL": "0.19712", "cD": "0.05233" }, { "alpha": "-178.0", "cL": "0.25424", "cD": "0.07465" }, { "alpha": "-177.0", "cL": "0.31136", "cD": "0.09695" }, { "alpha": "-176.0", "cL": "0.36848", "cD": "0.11921" }, { "alpha": "-175.0", "cL": "0.42560", "cD": "0.14144" }, { "alpha": "-174.0", "cL": "0.48272", "cD": "0.16363" }, { "alpha": "-173.0", "cL": "0.53420", "cD": "0.18577" }, { "alpha": "-172.0", "cL": "0.57962", "cD": "0.20785" }, { "alpha": "-171.0", "cL": "0.61899", "cD": "0.22987" }, { "alpha": "-170.0", "cL": "0.65230", "cD": "0.25181" }, { "alpha": "-169.0", "cL": "0.67955", "cD": "0.27368" }, { "alpha": "-168.0", "cL": "0.70075", "cD": "0.29547" }, { "alpha": "-167.0", "cL": "0.71589", "cD": "0.31717" }, { "alpha": "-166.0", "cL": "0.72497", "cD": "0.33877" }, { "alpha": "-165.0", "cL": "0.72800", "cD": "0.36027" }, { "alpha": "-164.0", "cL": "0.62493", "cD": "0.38165" }, { "alpha": "-163.0", "cL": "0.54779", "cD": "0.40292" }, { "alpha": "-162.0", "cL": "0.45288", "cD": "0.42407" }, { "alpha": "-161.0", "cL": "0.34420", "cD": "0.44509" }, { "alpha": "-160.0", "cL": "0.22400", "cD": "0.46598" }, { "alpha": "-159.0", "cL": "0.28177", "cD": "0.48672" }, { "alpha": "-158.0", "cL": "0.33931", "cD": "0.50731" }, { "alpha": "-157.0", "cL": "0.39639", "cD": "0.52775" }, { "alpha": "-156.0", "cL": "0.45279", "cD": "0.54803" }, { "alpha": "-155.0", "cL": "0.50830", "cD": "0.56814" }, { "alpha": "-154.0", "cL": "0.56267", "cD": "0.58808" }, { "alpha": "-153.0", "cL": "0.61572", "cD": "0.60784" }, { "alpha": "-152.0", "cL": "0.66721", "cD": "0.62741" }, { "alpha": "-151.0", "cL": "0.71696", "cD": "0.64679" }, { "alpha": "-150.0", "cL": "0.76476", "cD": "0.66598" }, { "alpha": "-149.0", "cL": "0.81043", "cD": "0.68496" }, { "alpha": "-148.0", "cL": "0.85378", "cD": "0.70374" }, { "alpha": "-147.0", "cL": "0.89465", "cD": "0.72230" }, { "alpha": "-146.0", "cL": "0.93287", "cD": "0.74064" }, { "alpha": "-145.0", "cL": "0.96830", "cD": "0.75875" }, { "alpha": "-144.0", "cL": "1.00078", "cD": "0.77664" }, { "alpha": "-143.0", "cL": "1.03020", "cD": "0.79428" }, { "alpha": "-142.0", "cL": "1.05644", "cD": "0.81169" }, { "alpha": "-141.0", "cL": "1.07939", "cD": "0.82884" }, { "alpha": "-140.0", "cL": "1.09897", "cD": "0.84575" }, { "alpha": "-139.0", "cL": "1.11510", "cD": "0.86240" }, { "alpha": "-138.0", "cL": "1.12770", "cD": "0.87878" }, { "alpha": "-137.0", "cL": "1.13675", "cD": "0.89490" }, { "alpha": "-136.0", "cL": "1.14218", "cD": "0.91074" }, { "alpha": "-135.0", "cL": "1.14400", "cD": "0.92631" }, { "alpha": "-134.0", "cL": "1.14330", "cD": "0.94159" }, { "alpha": "-133.0", "cL": "1.14121", "cD": "0.95659" }, { "alpha": "-132.0", "cL": "1.13773", "cD": "0.97130" }, { "alpha": "-131.0", "cL": "1.13287", "cD": "0.98571" }, { "alpha": "-130.0", "cL": "1.12662", "cD": "0.99982" }, { "alpha": "-129.0", "cL": "1.11900", "cD": "1.01363" }, { "alpha": "-128.0", "cL": "1.11002", "cD": "1.02712" }, { "alpha": "-127.0", "cL": "1.09968", "cD": "1.04031" }, { "alpha": "-126.0", "cL": "1.08801", "cD": "1.05318" }, { "alpha": "-125.0", "cL": "1.07501", "cD": "1.06572" }, { "alpha": "-124.0", "cL": "1.06070", "cD": "1.07794" }, { "alpha": "-123.0", "cL": "1.04510", "cD": "1.08984" }, { "alpha": "-122.0", "cL": "1.02822", "cD": "1.10140" }, { "alpha": "-121.0", "cL": "1.01009", "cD": "1.11263" }, { "alpha": "-120.0", "cL": "0.99073", "cD": "1.12351" }, { "alpha": "-119.0", "cL": "0.97017", "cD": "1.13406" }, { "alpha": "-118.0", "cL": "0.94842", "cD": "1.14426" }, { "alpha": "-117.0", "cL": "0.92552", "cD": "1.15411" }, { "alpha": "-116.0", "cL": "0.90148", "cD": "1.16361" }, { "alpha": "-115.0", "cL": "0.87636", "cD": "1.17275" }, { "alpha": "-114.0", "cL": "0.85016", "cD": "1.18154" }, { "alpha": "-113.0", "cL": "0.82292", "cD": "1.18997" }, { "alpha": "-112.0", "cL": "0.79469", "cD": "1.19803" }, { "alpha": "-111.0", "cL": "0.76549", "cD": "1.20573" }, { "alpha": "-110.0", "cL": "0.73535", "cD": "1.21307" }, { "alpha": "-109.0", "cL": "0.70432", "cD": "1.22003" }, { "alpha": "-108.0", "cL": "0.67243", "cD": "1.22662" }, { "alpha": "-107.0", "cL": "0.63972", "cD": "1.23284" }, { "alpha": "-106.0", "cL": "0.60623", "cD": "1.23868" }, { "alpha": "-105.0", "cL": "0.57200", "cD": "1.24415" }, { "alpha": "-104.0", "cL": "0.53708", "cD": "1.24924" }, { "alpha": "-103.0", "cL": "0.50150", "cD": "1.25394" }, { "alpha": "-102.0", "cL": "0.46531", "cD": "1.25827" }, { "alpha": "-101.0", "cL": "0.42855", "cD": "1.26221" }, { "alpha": "-100.0", "cL": "0.39127", "cD": "1.26576" }, { "alpha": "-99.0", "cL": "0.35352", "cD": "1.26893" }, { "alpha": "-98.0", "cL": "0.31533", "cD": "1.27172" }, { "alpha": "-97.0", "cL": "0.27676", "cD": "1.27412" }, { "alpha": "-96.0", "cL": "0.23785", "cD": "1.27612" }, { "alpha": "-95.0", "cL": "0.19865", "cD": "1.27774" }, { "alpha": "-94.0", "cL": "0.15921", "cD": "1.27897" }, { "alpha": "-93.0", "cL": "0.11958", "cD": "1.27982" }, { "alpha": "-92.0", "cL": "0.07980", "cD": "1.28027" }, { "alpha": "-91.0", "cL": "0.03993", "cD": "1.28033" }, { "alpha": "-90.0", "cL": "0.00000", "cD": "1.28000" }, { "alpha": "-89.0", "cL": "-0.03992", "cD": "1.28033" }, { "alpha": "-88.0", "cL": "-0.07980", "cD": "1.28027" }, { "alpha": "-87.0", "cL": "-0.11958", "cD": "1.27982" }, { "alpha": "-86.0", "cL": "-0.15921", "cD": "1.27897" }, { "alpha": "-85.0", "cL": "-0.19865", "cD": "1.27774" }, { "alpha": "-84.0", "cL": "-0.23785", "cD": "1.27612" }, { "alpha": "-83.0", "cL": "-0.27676", "cD": "1.27412" }, { "alpha": "-82.0", "cL": "-0.31533", "cD": "1.27172" }, { "alpha": "-81.0", "cL": "-0.35352", "cD": "1.26893" }, { "alpha": "-80.0", "cL": "-0.39127", "cD": "1.26576" }, { "alpha": "-79.0", "cL": "-0.42855", "cD": "1.26221" }, { "alpha": "-78.0", "cL": "-0.46531", "cD": "1.25827" }, { "alpha": "-77.0", "cL": "-0.50150", "cD": "1.25394" }, { "alpha": "-76.0", "cL": "-0.53708", "cD": "1.24924" }, { "alpha": "-75.0", "cL": "-0.57200", "cD": "1.24415" }, { "alpha": "-74.0", "cL": "-0.60623", "cD": "1.23868" }, { "alpha": "-73.0", "cL": "-0.63972", "cD": "1.23284" }, { "alpha": "-72.0", "cL": "-0.67243", "cD": "1.22662" }, { "alpha": "-71.0", "cL": "-0.70432", "cD": "1.22003" }, { "alpha": "-70.0", "cL": "-0.73535", "cD": "1.21307" }, { "alpha": "-69.0", "cL": "-0.76549", "cD": "1.20573" }, { "alpha": "-68.0", "cL": "-0.79469", "cD": "1.19803" }, { "alpha": "-67.0", "cL": "-0.82292", "cD": "1.18997" }, { "alpha": "-66.0", "cL": "-0.85016", "cD": "1.18154" }, { "alpha": "-65.0", "cL": "-0.87635", "cD": "1.17275" }, { "alpha": "-64.0", "cL": "-0.90148", "cD": "1.16361" }, { "alpha": "-63.0", "cL": "-0.92552", "cD": "1.15411" }, { "alpha": "-62.0", "cL": "-0.94842", "cD": "1.14426" }, { "alpha": "-61.0", "cL": "-0.97017", "cD": "1.13406" }, { "alpha": "-60.0", "cL": "-0.99073", "cD": "1.12351" }, { "alpha": "-59.0", "cL": "-1.01009", "cD": "1.11263" }, { "alpha": "-58.0", "cL": "-1.02822", "cD": "1.10140" }, { "alpha": "-57.0", "cL": "-1.04510", "cD": "1.08984" }, { "alpha": "-56.0", "cL": "-1.06070", "cD": "1.07794" }, { "alpha": "-55.0", "cL": "-1.07501", "cD": "1.06572" }, { "alpha": "-54.0", "cL": "-1.08801", "cD": "1.05318" }, { "alpha": "-53.0", "cL": "-1.09968", "cD": "1.04031" }, { "alpha": "-52.0", "cL": "-1.11002", "cD": "1.02712" }, { "alpha": "-51.0", "cL": "-1.11900", "cD": "1.01363" }, { "alpha": "-50.0", "cL": "-1.12662", "cD": "0.99982" }, { "alpha": "-49.0", "cL": "-1.13287", "cD": "0.98571" }, { "alpha": "-48.0", "cL": "-1.13773", "cD": "0.97130" }, { "alpha": "-47.0", "cL": "-1.14121", "cD": "0.95659" }, { "alpha": "-46.0", "cL": "-1.14330", "cD": "0.94159" }, { "alpha": "-45.0", "cL": "-1.14400", "cD": "0.92631" }, { "alpha": "-44.0", "cL": "-1.14155", "cD": "0.91074" }, { "alpha": "-43.0", "cL": "-1.13419", "cD": "0.89490" }, { "alpha": "-42.0", "cL": "-1.12197", "cD": "0.87878" }, { "alpha": "-41.0", "cL": "-1.10492", "cD": "0.86240" }, { "alpha": "-40.0", "cL": "-1.08311", "cD": "0.84138" }, { "alpha": "-39.0", "cL": "-1.05664", "cD": "0.81511" }, { "alpha": "-38.0", "cL": "-1.02560", "cD": "0.78653" }, { "alpha": "-37.0", "cL": "-0.99013", "cD": "0.75593" }, { "alpha": "-36.0", "cL": "-0.95034", "cD": "0.72361" }, { "alpha": "-35.0", "cL": "-0.90642", "cD": "0.68987" }, { "alpha": "-34.0", "cL": "-0.85852", "cD": "0.65497" }, { "alpha": "-33.0", "cL": "-0.80684", "cD": "0.61918" }, { "alpha": "-32.0", "cL": "-0.75158", "cD": "0.58276" }, { "alpha": "-31.0", "cL": "-0.69296", "cD": "0.54595" }, { "alpha": "-30.0", "cL": "-0.63120", "cD": "0.50897" }, { "alpha": "-29.0", "cL": "-0.56657", "cD": "0.47204" }, { "alpha": "-28.0", "cL": "-0.49930", "cD": "0.43539" }, { "alpha": "-27.0", "cL": "-0.42967", "cD": "0.39920" }, { "alpha": "-26.0", "cL": "-0.35795", "cD": "0.36365" }, { "alpha": "-25.0", "cL": "-0.28442", "cD": "0.32894" }, { "alpha": "-24.0", "cL": "-0.20937", "cD": "0.29521" }, { "alpha": "-23.0", "cL": "-0.13310", "cD": "0.26262" }, { "alpha": "-22.0", "cL": "-0.05591", "cD": "0.23132" }, { "alpha": "-21.0", "cL": "0.02189", "cD": "0.20143" }, { "alpha": "-20.0", "cL": "0.10000", "cD": "0.17308" }, { "alpha": "-19.9", "cL": "0.07769", "cD": "0.17033" }, { "alpha": "-19.8", "cL": "0.05556", "cD": "0.16760" }, { "alpha": "-19.7", "cL": "0.03362", "cD": "0.16489" }, { "alpha": "-19.6", "cL": "0.01186", "cD": "0.16219" }, { "alpha": "-19.5", "cL": "-0.00971", "cD": "0.15951" }, { "alpha": "-19.4", "cL": "-0.03109", "cD": "0.15685" }, { "alpha": "-19.3", "cL": "-0.05228", "cD": "0.15420" }, { "alpha": "-19.2", "cL": "-0.07327", "cD": "0.15157" }, { "alpha": "-19.1", "cL": "-0.09406", "cD": "0.14896" }, { "alpha": "-19.0", "cL": "-0.11465", "cD": "0.14637" }, { "alpha": "-18.9", "cL": "-0.13503", "cD": "0.14379" }, { "alpha": "-18.8", "cL": "-0.15521", "cD": "0.14123" }, { "alpha": "-18.7", "cL": "-0.17517", "cD": "0.13869" }, { "alpha": "-18.6", "cL": "-0.19493", "cD": "0.13616" }, { "alpha": "-18.5", "cL": "-0.21446", "cD": "0.13366" }, { "alpha": "-18.4", "cL": "-0.23377", "cD": "0.13117" }, { "alpha": "-18.3", "cL": "-0.25285", "cD": "0.12870" }, { "alpha": "-18.2", "cL": "-0.27171", "cD": "0.12624" }, { "alpha": "-18.1", "cL": "-0.29033", "cD": "0.12381" }, { "alpha": "-18.0", "cL": "-0.30871", "cD": "0.12139" }, { "alpha": "-17.9", "cL": "-0.32685", "cD": "0.11899" }, { "alpha": "-17.8", "cL": "-0.34473", "cD": "0.11661" }, { "alpha": "-17.7", "cL": "-0.36237", "cD": "0.11425" }, { "alpha": "-17.6", "cL": "-0.37975", "cD": "0.11191" }, { "alpha": "-17.5", "cL": "-0.39686", "cD": "0.10958" }, { "alpha": "-17.4", "cL": "-0.41370", "cD": "0.10728" }, { "alpha": "-17.3", "cL": "-0.43026", "cD": "0.10499" }, { "alpha": "-17.2", "cL": "-0.44653", "cD": "0.10272" }, { "alpha": "-17.1", "cL": "-0.46251", "cD": "0.10047" }, { "alpha": "-17.0", "cL": "-0.47819", "cD": "0.09824" }, { "alpha": "-16.9", "cL": "-0.49356", "cD": "0.09603" }, { "alpha": "-16.8", "cL": "-0.50861", "cD": "0.09384" }, { "alpha": "-16.7", "cL": "-0.52333", "cD": "0.09166" }, { "alpha": "-16.6", "cL": "-0.53771", "cD": "0.08951" }, { "alpha": "-16.5", "cL": "-0.55173", "cD": "0.08737" }, { "alpha": "-16.4", "cL": "-0.56538", "cD": "0.08526" }, { "alpha": "-16.3", "cL": "-0.57865", "cD": "0.08316" }, { "alpha": "-16.2", "cL": "-0.59151", "cD": "0.08108" }, { "alpha": "-16.1", "cL": "-0.60395", "cD": "0.07903" }, { "alpha": "-16.0", "cL": "-0.61595", "cD": "0.07699" }, { "alpha": "-15.9", "cL": "-0.62748", "cD": "0.07497" }, { "alpha": "-15.8", "cL": "-0.63850", "cD": "0.07297" }, { "alpha": "-15.7", "cL": "-0.64899", "cD": "0.07099" }, { "alpha": "-15.6", "cL": "-0.65889", "cD": "0.06903" }, { "alpha": "-15.5", "cL": "-0.66815", "cD": "0.06709" }, { "alpha": "-15.4", "cL": "-0.67670", "cD": "0.06517" }, { "alpha": "-15.3", "cL": "-0.68442", "cD": "0.06327" }, { "alpha": "-15.2", "cL": "-0.69117", "cD": "0.06139" }, { "alpha": "-15.1", "cL": "-0.69665", "cD": "0.05953" }, { "alpha": "-15.0", "cL": "-0.70000", "cD": "0.05770" }, { "alpha": "-14.9", "cL": "-0.79995", "cD": "0.05688" }, { "alpha": "-14.8", "cL": "-0.79978", "cD": "0.05608" }, { "alpha": "-14.7", "cL": "-0.79951", "cD": "0.05528" }, { "alpha": "-14.6", "cL": "-0.79913", "cD": "0.05450" }, { "alpha": "-14.5", "cL": "-0.79865", "cD": "0.05373" }, { "alpha": "-14.4", "cL": "-0.79805", "cD": "0.05297" }, { "alpha": "-14.3", "cL": "-0.79735", "cD": "0.05222" }, { "alpha": "-14.2", "cL": "-0.79654", "cD": "0.05148" }, { "alpha": "-14.1", "cL": "-0.79562", "cD": "0.05076" }, { "alpha": "-14.0", "cL": "-0.79459", "cD": "0.05004" }, { "alpha": "-13.9", "cL": "-0.79346", "cD": "0.04933" }, { "alpha": "-13.8", "cL": "-0.79221", "cD": "0.04864" }, { "alpha": "-13.7", "cL": "-0.79086", "cD": "0.04795" }, { "alpha": "-13.6", "cL": "-0.78940", "cD": "0.04728" }, { "alpha": "-13.5", "cL": "-0.78783", "cD": "0.04661" }, { "alpha": "-13.4", "cL": "-0.78616", "cD": "0.04596" }, { "alpha": "-13.3", "cL": "-0.78437", "cD": "0.04531" }, { "alpha": "-13.2", "cL": "-0.78248", "cD": "0.04468" }, { "alpha": "-13.1", "cL": "-0.78048", "cD": "0.04405" }, { "alpha": "-13.0", "cL": "-0.77837", "cD": "0.04344" }, { "alpha": "-12.9", "cL": "-0.77615", "cD": "0.04283" }, { "alpha": "-12.8", "cL": "-0.77383", "cD": "0.04224" }, { "alpha": "-12.7", "cL": "-0.77139", "cD": "0.04165" }, { "alpha": "-12.6", "cL": "-0.76885", "cD": "0.04108" }, { "alpha": "-12.5", "cL": "-0.76620", "cD": "0.04051" }, { "alpha": "-12.4", "cL": "-0.76345", "cD": "0.03995" }, { "alpha": "-12.3", "cL": "-0.76058", "cD": "0.03940" }, { "alpha": "-12.2", "cL": "-0.75761", "cD": "0.03886" }, { "alpha": "-12.1", "cL": "-0.75452", "cD": "0.03833" }, { "alpha": "-12.0", "cL": "-0.75133", "cD": "0.03781" }, { "alpha": "-11.9", "cL": "-0.74803", "cD": "0.03730" }, { "alpha": "-11.8", "cL": "-0.74463", "cD": "0.03680" }, { "alpha": "-11.7", "cL": "-0.74111", "cD": "0.03630" }, { "alpha": "-11.6", "cL": "-0.73749", "cD": "0.03582" }, { "alpha": "-11.5", "cL": "-0.73376", "cD": "0.03534" }, { "alpha": "-11.4", "cL": "-0.72992", "cD": "0.03487" }, { "alpha": "-11.3", "cL": "-0.72597", "cD": "0.03441" }, { "alpha": "-11.2", "cL": "-0.72192", "cD": "0.03396" }, { "alpha": "-11.1", "cL": "-0.71775", "cD": "0.03352" }, { "alpha": "-11.0", "cL": "-0.71348", "cD": "0.03308" }, { "alpha": "-10.9", "cL": "-0.70910", "cD": "0.03266" }, { "alpha": "-10.8", "cL": "-0.70461", "cD": "0.03224" }, { "alpha": "-10.7", "cL": "-0.70002", "cD": "0.03183" }, { "alpha": "-10.6", "cL": "-0.69531", "cD": "0.03143" }, { "alpha": "-10.5", "cL": "-0.69050", "cD": "0.03103" }, { "alpha": "-10.4", "cL": "-0.68558", "cD": "0.03065" }, { "alpha": "-10.3", "cL": "-0.68055", "cD": "0.03027" }, { "alpha": "-10.2", "cL": "-0.67541", "cD": "0.02990" }, { "alpha": "-10.1", "cL": "-0.67017", "cD": "0.02953" }, { "alpha": "-10.0", "cL": "-0.66481", "cD": "0.02918" }, { "alpha": "-9.9", "cL": "-0.65935", "cD": "0.02883" }, { "alpha": "-9.8", "cL": "-0.65378", "cD": "0.02848" }, { "alpha": "-9.7", "cL": "-0.64811", "cD": "0.02815" }, { "alpha": "-9.6", "cL": "-0.64232", "cD": "0.02782" }, { "alpha": "-9.5", "cL": "-0.63643", "cD": "0.02750" }, { "alpha": "-9.4", "cL": "-0.63042", "cD": "0.02719" }, { "alpha": "-9.3", "cL": "-0.62431", "cD": "0.02688" }, { "alpha": "-9.2", "cL": "-0.61809", "cD": "0.02659" }, { "alpha": "-9.1", "cL": "-0.61177", "cD": "0.02629" }, { "alpha": "-9.0", "cL": "-0.60533", "cD": "0.02601" }, { "alpha": "-8.9", "cL": "-0.59879", "cD": "0.02573" }, { "alpha": "-8.8", "cL": "-0.59214", "cD": "0.02546" }, { "alpha": "-8.7", "cL": "-0.58538", "cD": "0.02519" }, { "alpha": "-8.6", "cL": "-0.57851", "cD": "0.02493" }, { "alpha": "-8.5", "cL": "-0.57154", "cD": "0.02468" }, { "alpha": "-8.4", "cL": "-0.56445", "cD": "0.02443" }, { "alpha": "-8.3", "cL": "-0.55726", "cD": "0.02419" }, { "alpha": "-8.2", "cL": "-0.54996", "cD": "0.02395" }, { "alpha": "-8.1", "cL": "-0.54255", "cD": "0.02373" }, { "alpha": "-8.0", "cL": "-0.53504", "cD": "0.02350" }, { "alpha": "-7.9", "cL": "-0.52741", "cD": "0.02329" }, { "alpha": "-7.8", "cL": "-0.51968", "cD": "0.02308" }, { "alpha": "-7.7", "cL": "-0.51184", "cD": "0.02287" }, { "alpha": "-7.6", "cL": "-0.50389", "cD": "0.02267" }, { "alpha": "-7.5", "cL": "-0.49583", "cD": "0.02248" }, { "alpha": "-7.4", "cL": "-0.48767", "cD": "0.02229" }, { "alpha": "-7.3", "cL": "-0.47939", "cD": "0.02210" }, { "alpha": "-7.2", "cL": "-0.47101", "cD": "0.02193" }, { "alpha": "-7.1", "cL": "-0.46252", "cD": "0.02175" }, { "alpha": "-7.0", "cL": "-0.45393", "cD": "0.02158" }, { "alpha": "-6.9", "cL": "-0.44522", "cD": "0.02142" }, { "alpha": "-6.8", "cL": "-0.43641", "cD": "0.02126" }, { "alpha": "-6.7", "cL": "-0.42748", "cD": "0.02111" }, { "alpha": "-6.6", "cL": "-0.41845", "cD": "0.02096" }, { "alpha": "-6.5", "cL": "-0.40931", "cD": "0.02082" }, { "alpha": "-6.4", "cL": "-0.40007", "cD": "0.02068" }, { "alpha": "-6.3", "cL": "-0.39071", "cD": "0.02055" }, { "alpha": "-6.2", "cL": "-0.38125", "cD": "0.02042" }, { "alpha": "-6.1", "cL": "-0.37168", "cD": "0.02029" }, { "alpha": "-6.0", "cL": "-0.36200", "cD": "0.02017" }, { "alpha": "-5.9", "cL": "-0.35180", "cD": "0.02006" }, { "alpha": "-5.8", "cL": "-0.34160", "cD": "0.01995" }, { "alpha": "-5.7", "cL": "-0.33140", "cD": "0.01984" }, { "alpha": "-5.6", "cL": "-0.32120", "cD": "0.01973" }, { "alpha": "-5.5", "cL": "-0.31100", "cD": "0.01963" }, { "alpha": "-5.4", "cL": "-0.30080", "cD": "0.01954" }, { "alpha": "-5.3", "cL": "-0.29060", "cD": "0.01945" }, { "alpha": "-5.2", "cL": "-0.28040", "cD": "0.01936" }, { "alpha": "-5.1", "cL": "-0.27020", "cD": "0.01927" }, { "alpha": "-5.0", "cL": "-0.26000", "cD": "0.01919" }, { "alpha": "-4.9", "cL": "-0.24980", "cD": "0.01911" }, { "alpha": "-4.8", "cL": "-0.23960", "cD": "0.01904" }, { "alpha": "-4.7", "cL": "-0.22940", "cD": "0.01897" }, { "alpha": "-4.6", "cL": "-0.21920", "cD": "0.01890" }, { "alpha": "-4.5", "cL": "-0.20900", "cD": "0.01884" }, { "alpha": "-4.4", "cL": "-0.19880", "cD": "0.01878" }, { "alpha": "-4.3", "cL": "-0.18860", "cD": "0.01872" }, { "alpha": "-4.2", "cL": "-0.17840", "cD": "0.01866" }, { "alpha": "-4.1", "cL": "-0.16820", "cD": "0.01861" }, { "alpha": "-4.0", "cL": "-0.15800", "cD": "0.01856" }, { "alpha": "-3.9", "cL": "-0.14780", "cD": "0.01852" }, { "alpha": "-3.8", "cL": "-0.13760", "cD": "0.01847" }, { "alpha": "-3.7", "cL": "-0.12740", "cD": "0.01843" }, { "alpha": "-3.6", "cL": "-0.11720", "cD": "0.01839" }, { "alpha": "-3.5", "cL": "-0.10700", "cD": "0.01835" }, { "alpha": "-3.4", "cL": "-0.09680", "cD": "0.01832" }, { "alpha": "-3.3", "cL": "-0.08660", "cD": "0.01829" }, { "alpha": "-3.2", "cL": "-0.07640", "cD": "0.01826" }, { "alpha": "-3.1", "cL": "-0.06620", "cD": "0.01823" }, { "alpha": "-3.0", "cL": "-0.05600", "cD": "0.01821" }, { "alpha": "-2.9", "cL": "-0.04580", "cD": "0.01818" }, { "alpha": "-2.8", "cL": "-0.03560", "cD": "0.01816" }, { "alpha": "-2.7", "cL": "-0.02540", "cD": "0.01814" }, { "alpha": "-2.6", "cL": "-0.01520", "cD": "0.01812" }, { "alpha": "-2.5", "cL": "-0.00500", "cD": "0.01811" }, { "alpha": "-2.4", "cL": "0.00520", "cD": "0.01809" }, { "alpha": "-2.3", "cL": "0.01540", "cD": "0.01808" }, { "alpha": "-2.2", "cL": "0.02560", "cD": "0.01806" }, { "alpha": "-2.1", "cL": "0.03580", "cD": "0.01805" }, { "alpha": "-2.0", "cL": "0.04600", "cD": "0.01804" }, { "alpha": "-1.9", "cL": "0.05620", "cD": "0.01804" }, { "alpha": "-1.8", "cL": "0.06640", "cD": "0.01803" }, { "alpha": "-1.7", "cL": "0.07660", "cD": "0.01802" }, { "alpha": "-1.6", "cL": "0.08680", "cD": "0.01802" }, { "alpha": "-1.5", "cL": "0.09700", "cD": "0.01801" }, { "alpha": "-1.4", "cL": "0.10720", "cD": "0.01801" }, { "alpha": "-1.3", "cL": "0.11740", "cD": "0.01801" }, { "alpha": "-1.2", "cL": "0.12760", "cD": "0.01800" }, { "alpha": "-1.1", "cL": "0.13780", "cD": "0.01800" }, { "alpha": "-1.0", "cL": "0.14800", "cD": "0.01800" }, { "alpha": "-0.9", "cL": "0.15820", "cD": "0.01800" }, { "alpha": "-0.8", "cL": "0.16840", "cD": "0.01800" }, { "alpha": "-0.7", "cL": "0.17860", "cD": "0.01800" }, { "alpha": "-0.6", "cL": "0.18880", "cD": "0.01800" }, { "alpha": "-0.5", "cL": "0.19900", "cD": "0.01800" }, { "alpha": "-0.4", "cL": "0.20920", "cD": "0.01800" }, { "alpha": "-0.3", "cL": "0.21940", "cD": "0.01800" }, { "alpha": "-0.2", "cL": "0.22960", "cD": "0.01800" }, { "alpha": "-0.1", "cL": "0.23980", "cD": "0.01800" }, { "alpha": "0.0", "cL": "0.25000", "cD": "0.01800" }, { "alpha": "0.1", "cL": "0.26020", "cD": "0.01800" }, { "alpha": "0.2", "cL": "0.27040", "cD": "0.01800" }, { "alpha": "0.3", "cL": "0.28060", "cD": "0.01801" }, { "alpha": "0.4", "cL": "0.29080", "cD": "0.01801" }, { "alpha": "0.5", "cL": "0.30100", "cD": "0.01801" }, { "alpha": "0.6", "cL": "0.31120", "cD": "0.01802" }, { "alpha": "0.7", "cL": "0.32140", "cD": "0.01802" }, { "alpha": "0.8", "cL": "0.33160", "cD": "0.01803" }, { "alpha": "0.9", "cL": "0.34180", "cD": "0.01803" }, { "alpha": "1.0", "cL": "0.35200", "cD": "0.01804" }, { "alpha": "1.1", "cL": "0.36220", "cD": "0.01805" }, { "alpha": "1.2", "cL": "0.37240", "cD": "0.01806" }, { "alpha": "1.3", "cL": "0.38260", "cD": "0.01807" }, { "alpha": "1.4", "cL": "0.39280", "cD": "0.01809" }, { "alpha": "1.5", "cL": "0.40300", "cD": "0.01810" }, { "alpha": "1.6", "cL": "0.41320", "cD": "0.01812" }, { "alpha": "1.7", "cL": "0.42340", "cD": "0.01814" }, { "alpha": "1.8", "cL": "0.43360", "cD": "0.01816" }, { "alpha": "1.9", "cL": "0.44380", "cD": "0.01818" }, { "alpha": "2.0", "cL": "0.45400", "cD": "0.01820" }, { "alpha": "2.1", "cL": "0.46420", "cD": "0.01823" }, { "alpha": "2.2", "cL": "0.47440", "cD": "0.01825" }, { "alpha": "2.3", "cL": "0.48460", "cD": "0.01828" }, { "alpha": "2.4", "cL": "0.49480", "cD": "0.01831" }, { "alpha": "2.5", "cL": "0.50500", "cD": "0.01835" }, { "alpha": "2.6", "cL": "0.51520", "cD": "0.01838" }, { "alpha": "2.7", "cL": "0.52540", "cD": "0.01842" }, { "alpha": "2.8", "cL": "0.53560", "cD": "0.01846" }, { "alpha": "2.9", "cL": "0.54580", "cD": "0.01851" }, { "alpha": "3.0", "cL": "0.55600", "cD": "0.01855" }, { "alpha": "3.1", "cL": "0.56620", "cD": "0.01860" }, { "alpha": "3.2", "cL": "0.57640", "cD": "0.01865" }, { "alpha": "3.3", "cL": "0.58660", "cD": "0.01871" }, { "alpha": "3.4", "cL": "0.59680", "cD": "0.01876" }, { "alpha": "3.5", "cL": "0.60700", "cD": "0.01883" }, { "alpha": "3.6", "cL": "0.61720", "cD": "0.01889" }, { "alpha": "3.7", "cL": "0.62740", "cD": "0.01896" }, { "alpha": "3.8", "cL": "0.63760", "cD": "0.01903" }, { "alpha": "3.9", "cL": "0.64780", "cD": "0.01910" }, { "alpha": "4.0", "cL": "0.65800", "cD": "0.01918" }, { "alpha": "4.1", "cL": "0.66820", "cD": "0.01926" }, { "alpha": "4.2", "cL": "0.67840", "cD": "0.01934" }, { "alpha": "4.3", "cL": "0.68860", "cD": "0.01943" }, { "alpha": "4.4", "cL": "0.69880", "cD": "0.01952" }, { "alpha": "4.5", "cL": "0.70900", "cD": "0.01961" }, { "alpha": "4.6", "cL": "0.71920", "cD": "0.01971" }, { "alpha": "4.7", "cL": "0.72940", "cD": "0.01982" }, { "alpha": "4.8", "cL": "0.73960", "cD": "0.01992" }, { "alpha": "4.9", "cL": "0.74980", "cD": "0.02003" }, { "alpha": "5.0", "cL": "0.76000", "cD": "0.02015" }, { "alpha": "5.1", "cL": "0.77020", "cD": "0.02027" }, { "alpha": "5.2", "cL": "0.78040", "cD": "0.02039" }, { "alpha": "5.3", "cL": "0.79060", "cD": "0.02052" }, { "alpha": "5.4", "cL": "0.80080", "cD": "0.02066" }, { "alpha": "5.5", "cL": "0.81100", "cD": "0.02079" }, { "alpha": "5.6", "cL": "0.82120", "cD": "0.02094" }, { "alpha": "5.7", "cL": "0.83140", "cD": "0.02108" }, { "alpha": "5.8", "cL": "0.84160", "cD": "0.02123" }, { "alpha": "5.9", "cL": "0.85180", "cD": "0.02139" }, { "alpha": "6.0", "cL": "0.86200", "cD": "0.02155" }, { "alpha": "6.1", "cL": "0.87168", "cD": "0.02172" }, { "alpha": "6.2", "cL": "0.88125", "cD": "0.02189" }, { "alpha": "6.3", "cL": "0.89071", "cD": "0.02207" }, { "alpha": "6.4", "cL": "0.90007", "cD": "0.02225" }, { "alpha": "6.5", "cL": "0.90931", "cD": "0.02244" }, { "alpha": "6.6", "cL": "0.91845", "cD": "0.02263" }, { "alpha": "6.7", "cL": "0.92748", "cD": "0.02283" }, { "alpha": "6.8", "cL": "0.93641", "cD": "0.02303" }, { "alpha": "6.9", "cL": "0.94522", "cD": "0.02324" }, { "alpha": "7.0", "cL": "0.95393", "cD": "0.02346" }, { "alpha": "7.1", "cL": "0.96252", "cD": "0.02368" }, { "alpha": "7.2", "cL": "0.97101", "cD": "0.02391" }, { "alpha": "7.3", "cL": "0.97939", "cD": "0.02414" }, { "alpha": "7.4", "cL": "0.98767", "cD": "0.02438" }, { "alpha": "7.5", "cL": "0.99583", "cD": "0.02463" }, { "alpha": "7.6", "cL": "1.00389", "cD": "0.02488" }, { "alpha": "7.7", "cL": "1.01184", "cD": "0.02514" }, { "alpha": "7.8", "cL": "1.01968", "cD": "0.02540" }, { "alpha": "7.9", "cL": "1.02741", "cD": "0.02567" }, { "alpha": "8.0", "cL": "1.03504", "cD": "0.02595" }, { "alpha": "8.1", "cL": "1.04255", "cD": "0.02624" }, { "alpha": "8.2", "cL": "1.04996", "cD": "0.02653" }, { "alpha": "8.3", "cL": "1.05726", "cD": "0.02683" }, { "alpha": "8.4", "cL": "1.06445", "cD": "0.02713" }, { "alpha": "8.5", "cL": "1.07154", "cD": "0.02744" }, { "alpha": "8.6", "cL": "1.07851", "cD": "0.02776" }, { "alpha": "8.7", "cL": "1.08538", "cD": "0.02809" }, { "alpha": "8.8", "cL": "1.09214", "cD": "0.02842" }, { "alpha": "8.9", "cL": "1.09879", "cD": "0.02876" }, { "alpha": "9.0", "cL": "1.10533", "cD": "0.02911" }, { "alpha": "9.1", "cL": "1.11177", "cD": "0.02946" }, { "alpha": "9.2", "cL": "1.11809", "cD": "0.02982" }, { "alpha": "9.3", "cL": "1.12431", "cD": "0.03019" }, { "alpha": "9.4", "cL": "1.13042", "cD": "0.03057" }, { "alpha": "9.5", "cL": "1.13643", "cD": "0.03096" }, { "alpha": "9.6", "cL": "1.14232", "cD": "0.03135" }, { "alpha": "9.7", "cL": "1.14811", "cD": "0.03175" }, { "alpha": "9.8", "cL": "1.15378", "cD": "0.03216" }, { "alpha": "9.9", "cL": "1.15935", "cD": "0.03258" }, { "alpha": "10.0", "cL": "1.16481", "cD": "0.03300" }, { "alpha": "10.1", "cL": "1.17017", "cD": "0.03343" }, { "alpha": "10.2", "cL": "1.17541", "cD": "0.03387" }, { "alpha": "10.3", "cL": "1.18055", "cD": "0.03432" }, { "alpha": "10.4", "cL": "1.18558", "cD": "0.03478" }, { "alpha": "10.5", "cL": "1.19050", "cD": "0.03525" }, { "alpha": "10.6", "cL": "1.19531", "cD": "0.03572" }, { "alpha": "10.7", "cL": "1.20002", "cD": "0.03621" }, { "alpha": "10.8", "cL": "1.20461", "cD": "0.03670" }, { "alpha": "10.9", "cL": "1.20910", "cD": "0.03720" }, { "alpha": "11.0", "cL": "1.21348", "cD": "0.03771" }, { "alpha": "11.1", "cL": "1.21775", "cD": "0.03823" }, { "alpha": "11.2", "cL": "1.22192", "cD": "0.03876" }, { "alpha": "11.3", "cL": "1.22597", "cD": "0.03930" }, { "alpha": "11.4", "cL": "1.22992", "cD": "0.03984" }, { "alpha": "11.5", "cL": "1.23376", "cD": "0.04040" }, { "alpha": "11.6", "cL": "1.23749", "cD": "0.04096" }, { "alpha": "11.7", "cL": "1.24111", "cD": "0.04154" }, { "alpha": "11.8", "cL": "1.24463", "cD": "0.04212" }, { "alpha": "11.9", "cL": "1.24803", "cD": "0.04272" }, { "alpha": "12.0", "cL": "1.25133", "cD": "0.04332" }, { "alpha": "12.1", "cL": "1.25452", "cD": "0.04393" }, { "alpha": "12.2", "cL": "1.25761", "cD": "0.04456" }, { "alpha": "12.3", "cL": "1.26058", "cD": "0.04519" }, { "alpha": "12.4", "cL": "1.26345", "cD": "0.04583" }, { "alpha": "12.5", "cL": "1.26620", "cD": "0.04648" }, { "alpha": "12.6", "cL": "1.26885", "cD": "0.04715" }, { "alpha": "12.7", "cL": "1.27139", "cD": "0.04782" }, { "alpha": "12.8", "cL": "1.27383", "cD": "0.04850" }, { "alpha": "12.9", "cL": "1.27615", "cD": "0.04920" }, { "alpha": "13.0", "cL": "1.27837", "cD": "0.04990" }, { "alpha": "13.1", "cL": "1.28048", "cD": "0.05062" }, { "alpha": "13.2", "cL": "1.28248", "cD": "0.05134" }, { "alpha": "13.3", "cL": "1.28437", "cD": "0.05208" }, { "alpha": "13.4", "cL": "1.28616", "cD": "0.05282" }, { "alpha": "13.5", "cL": "1.28783", "cD": "0.05358" }, { "alpha": "13.6", "cL": "1.28940", "cD": "0.05435" }, { "alpha": "13.7", "cL": "1.29086", "cD": "0.05513" }, { "alpha": "13.8", "cL": "1.29221", "cD": "0.05592" }, { "alpha": "13.9", "cL": "1.29346", "cD": "0.05672" }, { "alpha": "14.0", "cL": "1.29459", "cD": "0.05753" }, { "alpha": "14.1", "cL": "1.29562", "cD": "0.05836" }, { "alpha": "14.2", "cL": "1.29654", "cD": "0.05919" }, { "alpha": "14.3", "cL": "1.29735", "cD": "0.06004" }, { "alpha": "14.4", "cL": "1.29805", "cD": "0.06090" }, { "alpha": "14.5", "cL": "1.29865", "cD": "0.06177" }, { "alpha": "14.6", "cL": "1.29913", "cD": "0.06265" }, { "alpha": "14.7", "cL": "1.29951", "cD": "0.06355" }, { "alpha": "14.8", "cL": "1.29978", "cD": "0.06445" }, { "alpha": "14.9", "cL": "1.29995", "cD": "0.06537" }, { "alpha": "15.0", "cL": "1.30000", "cD": "0.06630" }, { "alpha": "15.1", "cL": "1.19665", "cD": "0.06822" }, { "alpha": "15.2", "cL": "1.19117", "cD": "0.07017" }, { "alpha": "15.3", "cL": "1.18442", "cD": "0.07213" }, { "alpha": "15.4", "cL": "1.17670", "cD": "0.07412" }, { "alpha": "15.5", "cL": "1.16815", "cD": "0.07613" }, { "alpha": "15.6", "cL": "1.15889", "cD": "0.07815" }, { "alpha": "15.7", "cL": "1.14899", "cD": "0.08020" }, { "alpha": "15.8", "cL": "1.13850", "cD": "0.08226" }, { "alpha": "15.9", "cL": "1.12748", "cD": "0.08434" }, { "alpha": "16.0", "cL": "1.11595", "cD": "0.08645" }, { "alpha": "16.1", "cL": "1.10395", "cD": "0.08857" }, { "alpha": "16.2", "cL": "1.09151", "cD": "0.09072" }, { "alpha": "16.3", "cL": "1.07865", "cD": "0.09288" }, { "alpha": "16.4", "cL": "1.06538", "cD": "0.09506" }, { "alpha": "16.5", "cL": "1.05173", "cD": "0.09726" }, { "alpha": "16.6", "cL": "1.03771", "cD": "0.09948" }, { "alpha": "16.7", "cL": "1.02333", "cD": "0.10172" }, { "alpha": "16.8", "cL": "1.00861", "cD": "0.10398" }, { "alpha": "16.9", "cL": "0.99356", "cD": "0.10626" }, { "alpha": "17.0", "cL": "0.97819", "cD": "0.10855" }, { "alpha": "17.1", "cL": "0.96251", "cD": "0.11087" }, { "alpha": "17.2", "cL": "0.94653", "cD": "0.11320" }, { "alpha": "17.3", "cL": "0.93026", "cD": "0.11555" }, { "alpha": "17.4", "cL": "0.91370", "cD": "0.11793" }, { "alpha": "17.5", "cL": "0.89686", "cD": "0.12032" }, { "alpha": "17.6", "cL": "0.87975", "cD": "0.12272" }, { "alpha": "17.7", "cL": "0.86237", "cD": "0.12515" }, { "alpha": "17.8", "cL": "0.84473", "cD": "0.12760" }, { "alpha": "17.9", "cL": "0.82685", "cD": "0.13006" }, { "alpha": "18.0", "cL": "0.80871", "cD": "0.13254" }, { "alpha": "18.1", "cL": "0.79033", "cD": "0.13504" }, { "alpha": "18.2", "cL": "0.77171", "cD": "0.13756" }, { "alpha": "18.3", "cL": "0.75285", "cD": "0.14009" }, { "alpha": "18.4", "cL": "0.73377", "cD": "0.14264" }, { "alpha": "18.5", "cL": "0.71446", "cD": "0.14521" }, { "alpha": "18.6", "cL": "0.69493", "cD": "0.14780" }, { "alpha": "18.7", "cL": "0.67517", "cD": "0.15041" }, { "alpha": "18.8", "cL": "0.65521", "cD": "0.15303" }, { "alpha": "18.9", "cL": "0.63503", "cD": "0.15567" }, { "alpha": "19.0", "cL": "0.61465", "cD": "0.15833" }, { "alpha": "19.1", "cL": "0.59406", "cD": "0.16100" }, { "alpha": "19.2", "cL": "0.57327", "cD": "0.16369" }, { "alpha": "19.3", "cL": "0.55228", "cD": "0.16640" }, { "alpha": "19.4", "cL": "0.53109", "cD": "0.16913" }, { "alpha": "19.5", "cL": "0.50971", "cD": "0.17187" }, { "alpha": "19.6", "cL": "0.48814", "cD": "0.17463" }, { "alpha": "19.7", "cL": "0.46638", "cD": "0.17740" }, { "alpha": "19.8", "cL": "0.44444", "cD": "0.18019" }, { "alpha": "19.9", "cL": "0.42231", "cD": "0.18300" }, { "alpha": "20.0", "cL": "0.40000", "cD": "0.18582" }, { "alpha": "21.0", "cL": "0.44672", "cD": "0.21492" }, { "alpha": "22.0", "cL": "0.49325", "cD": "0.24551" }, { "alpha": "23.0", "cL": "0.53941", "cD": "0.27745" }, { "alpha": "24.0", "cL": "0.58503", "cD": "0.31062" }, { "alpha": "25.0", "cL": "0.62991", "cD": "0.34487" }, { "alpha": "26.0", "cL": "0.67388", "cD": "0.38002" }, { "alpha": "27.0", "cL": "0.71678", "cD": "0.41592" }, { "alpha": "28.0", "cL": "0.75842", "cD": "0.45237" }, { "alpha": "29.0", "cL": "0.79866", "cD": "0.48919" }, { "alpha": "30.0", "cL": "0.83731", "cD": "0.52617" }, { "alpha": "31.0", "cL": "0.87424", "cD": "0.56309" }, { "alpha": "32.0", "cL": "0.90930", "cD": "0.59972" }, { "alpha": "33.0", "cL": "0.94235", "cD": "0.63583" }, { "alpha": "34.0", "cL": "0.97326", "cD": "0.67117" }, { "alpha": "35.0", "cL": "1.00191", "cD": "0.70548" }, { "alpha": "36.0", "cL": "1.02818", "cD": "0.73847" }, { "alpha": "37.0", "cL": "1.05197", "cD": "0.76988" }, { "alpha": "38.0", "cL": "1.07319", "cD": "0.79940" }, { "alpha": "39.0", "cL": "1.09175", "cD": "0.82674" }, { "alpha": "40.0", "cL": "1.10759", "cD": "0.84575" }, { "alpha": "41.0", "cL": "1.12063", "cD": "0.86240" }, { "alpha": "42.0", "cL": "1.13082", "cD": "0.87878" }, { "alpha": "43.0", "cL": "1.13813", "cD": "0.89490" }, { "alpha": "44.0", "cL": "1.14253", "cD": "0.91074" }, { "alpha": "45.0", "cL": "1.14400", "cD": "0.92631" }, { "alpha": "46.0", "cL": "1.14330", "cD": "0.94159" }, { "alpha": "47.0", "cL": "1.14121", "cD": "0.95659" }, { "alpha": "48.0", "cL": "1.13773", "cD": "0.97130" }, { "alpha": "49.0", "cL": "1.13287", "cD": "0.98571" }, { "alpha": "50.0", "cL": "1.12662", "cD": "0.99982" }, { "alpha": "51.0", "cL": "1.11900", "cD": "1.01363" }, { "alpha": "52.0", "cL": "1.11002", "cD": "1.02712" }, { "alpha": "53.0", "cL": "1.09968", "cD": "1.04031" }, { "alpha": "54.0", "cL": "1.08801", "cD": "1.05318" }, { "alpha": "55.0", "cL": "1.07501", "cD": "1.06572" }, { "alpha": "56.0", "cL": "1.06070", "cD": "1.07794" }, { "alpha": "57.0", "cL": "1.04510", "cD": "1.08984" }, { "alpha": "58.0", "cL": "1.02822", "cD": "1.10140" }, { "alpha": "59.0", "cL": "1.01009", "cD": "1.11263" }, { "alpha": "60.0", "cL": "0.99073", "cD": "1.12351" }, { "alpha": "61.0", "cL": "0.97017", "cD": "1.13406" }, { "alpha": "62.0", "cL": "0.94842", "cD": "1.14426" }, { "alpha": "63.0", "cL": "0.92552", "cD": "1.15411" }, { "alpha": "64.0", "cL": "0.90148", "cD": "1.16361" }, { "alpha": "65.0", "cL": "0.87635", "cD": "1.17275" }, { "alpha": "66.0", "cL": "0.85016", "cD": "1.18154" }, { "alpha": "67.0", "cL": "0.82292", "cD": "1.18997" }, { "alpha": "68.0", "cL": "0.79469", "cD": "1.19803" }, { "alpha": "69.0", "cL": "0.76549", "cD": "1.20573" }, { "alpha": "70.0", "cL": "0.73535", "cD": "1.21307" }, { "alpha": "71.0", "cL": "0.70432", "cD": "1.22003" }, { "alpha": "72.0", "cL": "0.67243", "cD": "1.22662" }, { "alpha": "73.0", "cL": "0.63972", "cD": "1.23284" }, { "alpha": "74.0", "cL": "0.60623", "cD": "1.23868" }, { "alpha": "75.0", "cL": "0.57200", "cD": "1.24415" }, { "alpha": "76.0", "cL": "0.53708", "cD": "1.24924" }, { "alpha": "77.0", "cL": "0.50150", "cD": "1.25394" }, { "alpha": "78.0", "cL": "0.46531", "cD": "1.25827" }, { "alpha": "79.0", "cL": "0.42855", "cD": "1.26221" }, { "alpha": "80.0", "cL": "0.39127", "cD": "1.26576" }, { "alpha": "81.0", "cL": "0.35352", "cD": "1.26893" }, { "alpha": "82.0", "cL": "0.31533", "cD": "1.27172" }, { "alpha": "83.0", "cL": "0.27676", "cD": "1.27412" }, { "alpha": "84.0", "cL": "0.23785", "cD": "1.27612" }, { "alpha": "85.0", "cL": "0.19865", "cD": "1.27774" }, { "alpha": "86.0", "cL": "0.15921", "cD": "1.27897" }, { "alpha": "87.0", "cL": "0.11958", "cD": "1.27982" }, { "alpha": "88.0", "cL": "0.07980", "cD": "1.28027" }, { "alpha": "89.0", "cL": "0.03992", "cD": "1.28033" }, { "alpha": "90.0", "cL": "-0.00000", "cD": "1.28000" }, { "alpha": "91.0", "cL": "-0.03993", "cD": "1.28033" }, { "alpha": "92.0", "cL": "-0.07980", "cD": "1.28027" }, { "alpha": "93.0", "cL": "-0.11958", "cD": "1.27982" }, { "alpha": "94.0", "cL": "-0.15921", "cD": "1.27897" }, { "alpha": "95.0", "cL": "-0.19865", "cD": "1.27774" }, { "alpha": "96.0", "cL": "-0.23785", "cD": "1.27612" }, { "alpha": "97.0", "cL": "-0.27676", "cD": "1.27412" }, { "alpha": "98.0", "cL": "-0.31533", "cD": "1.27172" }, { "alpha": "99.0", "cL": "-0.35352", "cD": "1.26893" }, { "alpha": "100.0", "cL": "-0.39127", "cD": "1.26576" }, { "alpha": "101.0", "cL": "-0.42855", "cD": "1.26221" }, { "alpha": "102.0", "cL": "-0.46531", "cD": "1.25827" }, { "alpha": "103.0", "cL": "-0.50150", "cD": "1.25394" }, { "alpha": "104.0", "cL": "-0.53708", "cD": "1.24924" }, { "alpha": "105.0", "cL": "-0.57200", "cD": "1.24415" }, { "alpha": "106.0", "cL": "-0.60623", "cD": "1.23868" }, { "alpha": "107.0", "cL": "-0.63972", "cD": "1.23284" }, { "alpha": "108.0", "cL": "-0.67243", "cD": "1.22662" }, { "alpha": "109.0", "cL": "-0.70432", "cD": "1.22003" }, { "alpha": "110.0", "cL": "-0.73535", "cD": "1.21307" }, { "alpha": "111.0", "cL": "-0.76549", "cD": "1.20573" }, { "alpha": "112.0", "cL": "-0.79469", "cD": "1.19803" }, { "alpha": "113.0", "cL": "-0.82292", "cD": "1.18997" }, { "alpha": "114.0", "cL": "-0.85016", "cD": "1.18154" }, { "alpha": "115.0", "cL": "-0.87636", "cD": "1.17275" }, { "alpha": "116.0", "cL": "-0.90148", "cD": "1.16361" }, { "alpha": "117.0", "cL": "-0.92552", "cD": "1.15411" }, { "alpha": "118.0", "cL": "-0.94842", "cD": "1.14426" }, { "alpha": "119.0", "cL": "-0.97017", "cD": "1.13406" }, { "alpha": "120.0", "cL": "-0.99073", "cD": "1.12351" }, { "alpha": "121.0", "cL": "-1.01009", "cD": "1.11263" }, { "alpha": "122.0", "cL": "-1.02822", "cD": "1.10140" }, { "alpha": "123.0", "cL": "-1.04510", "cD": "1.08984" }, { "alpha": "124.0", "cL": "-1.06070", "cD": "1.07794" }, { "alpha": "125.0", "cL": "-1.07501", "cD": "1.06572" }, { "alpha": "126.0", "cL": "-1.08801", "cD": "1.05318" }, { "alpha": "127.0", "cL": "-1.09968", "cD": "1.04031" }, { "alpha": "128.0", "cL": "-1.11002", "cD": "1.02712" }, { "alpha": "129.0", "cL": "-1.11900", "cD": "1.01363" }, { "alpha": "130.0", "cL": "-1.12662", "cD": "0.99982" }, { "alpha": "131.0", "cL": "-1.13287", "cD": "0.98571" }, { "alpha": "132.0", "cL": "-1.13773", "cD": "0.97130" }, { "alpha": "133.0", "cL": "-1.14121", "cD": "0.95659" }, { "alpha": "134.0", "cL": "-1.14330", "cD": "0.94159" }, { "alpha": "135.0", "cL": "-1.14400", "cD": "0.92631" }, { "alpha": "136.0", "cL": "-1.14163", "cD": "0.91074" }, { "alpha": "137.0", "cL": "-1.13454", "cD": "0.89490" }, { "alpha": "138.0", "cL": "-1.12274", "cD": "0.87878" }, { "alpha": "139.0", "cL": "-1.10630", "cD": "0.86240" }, { "alpha": "140.0", "cL": "-1.08527", "cD": "0.84575" }, { "alpha": "141.0", "cL": "-1.05973", "cD": "0.82884" }, { "alpha": "142.0", "cL": "-1.02979", "cD": "0.81169" }, { "alpha": "143.0", "cL": "-0.99557", "cD": "0.79428" }, { "alpha": "144.0", "cL": "-0.95719", "cD": "0.77664" }, { "alpha": "145.0", "cL": "-0.91482", "cD": "0.75875" }, { "alpha": "146.0", "cL": "-0.86862", "cD": "0.74064" }, { "alpha": "147.0", "cL": "-0.81876", "cD": "0.72230" }, { "alpha": "148.0", "cL": "-0.76546", "cD": "0.70374" }, { "alpha": "149.0", "cL": "-0.70891", "cD": "0.68496" }, { "alpha": "150.0", "cL": "-0.64934", "cD": "0.66598" }, { "alpha": "151.0", "cL": "-0.58699", "cD": "0.64679" }, { "alpha": "152.0", "cL": "-0.52210", "cD": "0.62741" }, { "alpha": "153.0", "cL": "-0.45494", "cD": "0.60784" }, { "alpha": "154.0", "cL": "-0.38575", "cD": "0.58808" }, { "alpha": "155.0", "cL": "-0.31482", "cD": "0.56814" }, { "alpha": "156.0", "cL": "-0.24243", "cD": "0.54803" }, { "alpha": "157.0", "cL": "-0.16886", "cD": "0.52775" }, { "alpha": "158.0", "cL": "-0.09440", "cD": "0.50731" }, { "alpha": "159.0", "cL": "-0.01935", "cD": "0.48672" }, { "alpha": "160.0", "cL": "0.05600", "cD": "0.46598" }, { "alpha": "161.0", "cL": "-0.06420", "cD": "0.44509" }, { "alpha": "162.0", "cL": "-0.17288", "cD": "0.42407" }, { "alpha": "163.0", "cL": "-0.26779", "cD": "0.40292" }, { "alpha": "164.0", "cL": "-0.34493", "cD": "0.38165" }, { "alpha": "165.0", "cL": "-0.39200", "cD": "0.36027" }, { "alpha": "166.0", "cL": "-0.44497", "cD": "0.33877" }, { "alpha": "167.0", "cL": "-0.43589", "cD": "0.31717" }, { "alpha": "168.0", "cL": "-0.42075", "cD": "0.29547" }, { "alpha": "169.0", "cL": "-0.39955", "cD": "0.27368" }, { "alpha": "170.0", "cL": "-0.37230", "cD": "0.25181" }, { "alpha": "171.0", "cL": "-0.33899", "cD": "0.22987" }, { "alpha": "172.0", "cL": "-0.29962", "cD": "0.20785" }, { "alpha": "173.0", "cL": "-0.25420", "cD": "0.18577" }, { "alpha": "174.0", "cL": "-0.20272", "cD": "0.16363" }, { "alpha": "175.0", "cL": "-0.14560", "cD": "0.14144" }, { "alpha": "176.0", "cL": "-0.08848", "cD": "0.11921" }, { "alpha": "177.0", "cL": "-0.03136", "cD": "0.09695" }, { "alpha": "178.0", "cL": "0.02576", "cD": "0.07465" }, { "alpha": "179.0", "cL": "0.08288", "cD": "0.05233" }, { "alpha": "180.0", "cL": "0.14000", "cD": "0.03000" }]

var polar2412 = naca2412.map(e => ({
    alpha: +e.alpha,    //   -180 … +180 (degrees)
    cL: +e.cL,
    cD: +e.cD
}));


function samplePolar(alphaDeg) {
    var first = polar2412[0];               //  α = –180
    var last = polar2412[polar2412.length - 1]; //  α = +180

    /* clamp the requested AoA into the existing range */
    let a = Math.max(first.alpha, Math.min(last.alpha, alphaDeg));

    /* walk forward until we pass the desired α */
    for (let i = 1; i < polar2412.length; i++) {
        var prev = polar2412[i - 1];
        var next = polar2412[i];

        if (next.alpha >= a) {                 // found the surrounding slot
            var t = (a - prev.alpha) / (next.alpha - prev.alpha);

            return {
                cL: prev.cL + (next.cL - prev.cL) * t,
                cD: prev.cD + (next.cD - prev.cD) * t
            };
        }
    }

    /* fallback (shouldn’t happen after clamping) */
    return { cL: last.cL, cD: last.cD };
}

// symmetricAirfoil.js


/**
 *  Returns {cN, cD} for a symmetric, thin airfoil
 *  α in **radians** for math speed inside physics loop.
 */
function sampleSymmetric(alphaRad) {
    var CN_SLOPE = 2 * Math.PI;        // 2π  per radian
    var ALPHA_STALL_DEG = 17;            // +/- 17°
    var CD0Sym = 0.01;               // profile drag
    var kSym = 0.06;               // induced/pressure drag term
    var RAD = Math.PI / 180;
    var ALPHA_STALL = ALPHA_STALL_DEG * RAD;
    var CN_MAX = CN_SLOPE * ALPHA_STALL;                // plateau value
    var absA = Math.abs(alphaRad);

    // ---------- Normal-force  ( “lift” for the fin ) ------------ //
    let cL;
    if (absA <= ALPHA_STALL) {               // attached flow
        cL = CN_SLOPE * alphaRad;           // sign preserved
    } else {                                  // stalled – clamp or fade
        var sign = Math.sign(alphaRad);
        cL = sign * CN_MAX;                 // simple plateau
        // a linear “fade” variant would be:
        // cN = sign * ( CN_MAX - (absA-ALPHA_STALL)*CN_MAX*0.25 );
    }

    // ---------- Drag  ( profile + pressure ) -------------------- //
    var cD = CD0Sym + kSym * cL * cL;           // always positive

    return { cL, cD };
}

function getAoAColor(aoaDeg) {
    var aoaClamped = Math.max(0, Math.min(18, aoaDeg)); // 0 … 18
    var t = aoaClamped / 18;                            // 0 → 1
    // Cesium.Color.lerp( from, to, t,  resultColor )
    return Cesium.Color.lerp(Cesium.Color.LIME, Cesium.Color.RED, t, new Cesium.Color());
}
/*  Per-strip forces + debug lines  */
var LIFT_DRAW = 0.01, DRAG_DRAW = 0.01;
var liftMult = 1;

function rotX(rad) {
    var c = Math.cos(rad), s = Math.sin(rad);
    return [[1, 0, 0],
    [0, c, -s],
    [0, s, c]];
}

function buildBladeStrips(prop) {

    var BLADES_PER_STRIP = 10;                  // spanwise resolution
    var r0 = prop.hubRadius;
    var r1 = prop.radius;
    var dr = (r1 - r0) / BLADES_PER_STRIP;    // span of each strip
    var area = prop.bladeWidth * dr;            // plan-form area of strip
    var span = r1 - r0;

    /* one trajectory for the hub axis (unchanged) */
    prop.dbgAxis = new Trajectory(Cesium.Color.RED, 2);

    /* ── pre-compute a step in azimuth ──────────────────────────────── */
    var bladeCnt = Math.max(1, prop.bladeCount || 1);      // safety
    var dAz = TWO_PI / bladeCnt;                      // rad / blade

    var out = [];

    for (let b = 0; b < bladeCnt; ++b) {           // <-- loop blades
        var az = b * dAz;                        // azimuth of this blade

        for (let i = 0; i < BLADES_PER_STRIP; ++i) {            // spanwise
            var rMid = r0 + (i + 0.5) * dr;       // mid-radius (m)

            /* centre of the strip in prop-local coordinates (XZ disc)  */
            var localPos = [                      // before blade-pitch
                rMid * Math.sin(az),  // X
                0,                     // Y  (axis)
                rMid * Math.cos(az)   // Z  (top strip has +Z)
            ];

            /* build the strip object --------------------------------- */
            var u = (rMid - r0) / span;                  // 0 … 1
            var pitchDeg =
                prop.bladeStartPitch +
                u * (prop.bladeEndPitch - prop.bladeStartPitch) +
                (prop.bladePitch || 0);                  // global offset

            var strip = {
                az,                 // blade azimuth  (rad)
                rMid,
                area,
                localPos,
                pitchRad: pitchDeg * DEG2RAD                // store once
            };

            /* optional debug trajectories */
            if (DEBUG_PROP_VECTORS) {
                strip.dbgL = new Trajectory(Cesium.Color.LIME, 2); // lift
                strip.dbgD = new Trajectory(Cesium.Color.YELLOW, 2); // drag
                strip.dbgT = new Trajectory(Cesium.Color.WHITE, 2); // thrust dir
            }

            out.push(strip);
        }
    }

    /* create viewer entities once (so they persist) */
    if (DEBUG_PROP_VECTORS) {
        var v = geofs.api.viewer;
        v.entities.add(prop.dbgAxis.trajectoryDescriptor);
        out.forEach(s => {
            v.entities.add(s.dbgL.trajectoryDescriptor);
            v.entities.add(s.dbgD.trajectoryDescriptor);
            v.entities.add(s.dbgT.trajectoryDescriptor);
        });
    }

    return out;
}

function initPropBlades() {

    Object.values(propellers).forEach(prop => {
        prop._strips = buildBladeStrips(prop);
        /*   share the strip definition you already built … */
        var strips = prop._strips;                // from buildBladeStrips
        if (!strips) return;                        // safety

        var userRot = M33.setFromEuler(V3.toRadians(prop.rotation));
        var dPsi = TWO_PI / prop.bladeCount;

        prop._bladeSegs = [];                      // ← new flat list

        for (let b = 0; b < prop.bladeCount; b++) {

            /* azimuth offset matrix (about +Z) */
            var ca = Math.cos(dPsi * b), sa = Math.sin(dPsi * b);
            var Rz = [[ca, -sa, 0],
            [sa, ca, 0],
            [0, 0, 1]];

            var RlocalBlade = M33.multiply(userRot, Rz);

            /* ----- one entry per strip on this blade ----- */
            strips.forEach(str => {

                // rotation about local +X (span) by pitch at this radius
                var Rpitch = rotX(str.pitchRad);

                var seg = {
                    Rlocal: M33.multiply(RlocalBlade, Rpitch),
                    rMid: str.rMid,
                    area: str.area,
                    // pass the debug handles straight through so you keep them
                    dbgL: str.dbgL,
                    dbgD: str.dbgD,
                    dbgT: str.dbgT
                };

                if (DEBUG_PROP_VECTORS) {
                    v = geofs.api.viewer;
                    seg.dbg = new Trajectory(Cesium.Color.CYAN, 2);
                    v.entities.add(seg.dbg.trajectoryDescriptor);
                    v.entities.add(str.dbgL.trajectoryDescriptor);
                    v.entities.add(str.dbgD.trajectoryDescriptor);
                    v.entities.add(prop.dbgAxis.trajectoryDescriptor);
                    v.entities.add(str.dbgT.trajectoryDescriptor);
                }
                prop._bladeSegs.push(seg);
            });
        }
    });
}
initPropBlades();          // run once after propellers are declared


function buildElementsFromJSON(def) {

    var eList = [],
        n = def.numElements || 20,
        dSpan = def.span / n,
        lerpC = u => lerp(def.rootChord, def.tipChord, u);   // taper

    /* ▸ If the root is on the left side (X < 0) we march NEGATIVE (+X is right) */
    var spanSign = (def.startPosition[0] < 0) ? -1 : 1;      // +1 → right-to-left

    for (let i = 0; i < n; i++) {

        /* 1 ─ span fraction & dimensions */
        var uMid = (i + 0.5) / n;
        var halfSpan = dSpan * 0.5;
        var chordMid = lerpC(uMid);

        /* 2 ─ strip centre in local space */
        var centreX = def.startPosition[0] + spanSign * (i + 0.5) * dSpan;
        var centre = [centreX, def.startPosition[1], def.startPosition[2]];

        /* 3 ─ rectangle corners before twist/dihedral (span = ±X, chord = ±Y) */
        var c1 = [centreX - spanSign * halfSpan, centre[1] - chordMid * 0.5, centre[2]];  // root-LE
        var c2 = [centreX - spanSign * halfSpan, centre[1] + chordMid * 0.5, centre[2]];  // root-TE
        var c3 = [centreX + spanSign * halfSpan, centre[1] + chordMid * 0.5, centre[2]];  // tip-TE
        var c4 = [centreX + spanSign * halfSpan, centre[1] - chordMid * 0.5, centre[2]];  // tip-LE

        /* 4 ─ rotation (linear wash-out) */
        var rotMidDeg = [
            lerp(def.startRotation[0], def.endRotation[0], uMid),
            lerp(def.startRotation[1], def.endRotation[1], uMid),
            lerp(def.startRotation[2], def.endRotation[2], uMid)
        ];

        /* 5 ─ store element */
        var el = {
            parent: def,
            local: centre,
            localCorners: [c1, c2, c3, c4],
            rot: rotMidDeg,
            span: dSpan,
            elementChord: chordMid,
            area: chordMid * dSpan,
            u: uMid,
            /* ► extra for tip vortex / ground-effect fixes */
            halfSpan: 0.5 * def.span,                         // constant b/2
            yLocal: spanSign * ((i + 0.5) * dSpan - 0.5 * def.span), // –b/2…+b/2
            dbgLift: new Trajectory(Cesium.Color.LIME, 4),
            dbgDrag: new Trajectory(Cesium.Color.YELLOW, 2),
            dbgQuad: new Trajectory(Cesium.Color.CYAN, 2),
            isRudder: def.isRudder || false, // true for rudder elements
        };
        eList.push(el);

        /* 6 ─ viewer entities (unchanged) */
        var v = geofs.api.viewer;
        if (DEBUG_LIFT_VECTORS) {
            el.entL = v.entities.add(el.dbgLift.trajectoryDescriptor);
            el.entD = v.entities.add(el.dbgDrag.trajectoryDescriptor);
        }
        if (DEBUG_AIRFOIL_SURFACES) {
            el.entQ = v.entities.add(el.dbgQuad.trajectoryDescriptor);
        }
    }
    return eList;
}

var bladeElements = [];
for (var key in airfoils) {
    var af = airfoils[key];
    var els = buildElementsFromJSON(af);
    af._elements = els;
    bladeElements.push(...els);

    if (DEBUG_LIFT_VECTORS) {
        var v = geofs.api.viewer;
        els.forEach(e => {
            e.entL = v.entities.add(e.dbgLift.trajectoryDescriptor);
            e.entD = v.entities.add(e.dbgDrag.trajectoryDescriptor);
        });
    }
}
console.log('[Blade] elements total =', bladeElements.length);

function updateBladeDebugVis() {

    for (var el of bladeElements) {

        /* ── lift / drag needles ─────────────────────────────── */
        if (DEBUG_LIFT_VECTORS && el._dbg) {
            var base = el._dbg.base;
            var tipL = V3.add(base, xyz2lla(el._dbg.liftTip, base));
            var tipD = V3.add(base, xyz2lla(el._dbg.dragTip, base));

            el.dbgLift.clear(); el.dbgDrag.clear();
            el.dbgLift.addPosition(base); el.dbgLift.addPosition(tipL);
            el.dbgDrag.addPosition(base); el.dbgDrag.addPosition(tipD);
        }

        /* ── air-foil quad outline ───────────────────────────── */
        if (DEBUG_AIRFOIL_SURFACES && el._dbgQuad) {

            // convert cached XYZ to Cesium.Cartesian3 on the fly
            var baseLLA = geofs.aircraft.instance.llaLocation;
            var toC3 = xyz => {
                var lla = V3.add(baseLLA, xyz2lla(xyz, baseLLA));
                return Cesium.Cartesian3.fromDegrees(lla[1], lla[0], lla[2]);
            };

            var pts = el.dbgQuad.trailLla;
            pts.length = 0;
            [...el._dbgQuad, el._dbgQuad[0]].forEach(p => pts.push(toC3(p)));
        }
    }
}

if (DEBUG_LIFT_VECTORS || DEBUG_AIRFOIL_SURFACES) {
    geofs.api.viewer.scene.preRender.addEventListener(updateBladeDebugVis);
}

weather.getLocalTurbulence = function (e) {
    return [0, 0, geofs.perlin.get(e[0], e[1], weather.atmosphericDisturbanceScale) * weather.definition.turbulences * 8]
}


var VoxelGrid = (function () {

    /* ---- CONFIG *you can tune these* ---- */
    var CELLS_PER_AXIS = 15;        // odd number → symmetric about origin
    var CELL_SIZE = 0.55;      // edge length of one voxel (m)
    var HALF_EXT = (CELLS_PER_AXIS - 1) * 0.5 * CELL_SIZE;

    /* utility ---------------------------------------------------------------- */
    var viewer = geofs.api.viewer;
    var toCartesian = (lla) =>
        Cesium.Cartesian3.fromDegrees(lla[1], lla[0], lla[2]);

    /* create the static voxel list */
    var voxels = [];         // { offset:[x,y,z], traj:Trajectory, field:{} }

    for (let k = 0; k < CELLS_PER_AXIS; ++k) {
        for (let j = 0; j < CELLS_PER_AXIS; ++j) {
            for (let i = 0; i < CELLS_PER_AXIS; ++i) {

                var ox = (i * CELL_SIZE - HALF_EXT )+ 0.1;
                var oy = j * CELL_SIZE - HALF_EXT;
                var oz = k * CELL_SIZE - HALF_EXT;

                /* tiny cross (2 cm) for visualisation */
                var cross = new Trajectory(Cesium.Color.GOLD, 1);
                cross.addPosition([0, 0, 0]); cross.addPosition([0, 0, 0]); // dummy
                viewer.entities.add(cross.trajectoryDescriptor);

                voxels.push({
                    offset: [ox, oy, oz],   // body-local coords
                    traj: cross,
                    field: {},              // place for flow quantities later
                    centerWorld: [0, 0, 0],
                    vWind: [0, 0, 0]    // wind vector in body-local coords
                });
            }
        }
    }

    /* live update – runs every rendered frame (not physics tick) */
    geofs.api.addFrameCallback(() => {
        var ac = geofs.aircraft.instance;
        var wfB = ac.object3d.getWorldFrame();     // body → world matrix
        var LLAbase = ac.llaLocation;
        var posW = ac.object3d.worldPosition;

        voxels.forEach(v => {
            /* body-local → world */
            var w = V3.add(posW, M33.transform(wfB, v.offset));
            v.centerWorld = w;
            /* world xyz → absolute LLA (for the polyline) */
            var lla = V3.add(LLAbase, xyz2lla(w, LLAbase));

            /* refresh the tiny cross */
            v.traj.clear();
            v.traj.addPosition(lla);
            v.traj.addPosition([lla[0], lla[1], lla[2] + 0.02]);
        });
    });

    /* ---------- public helper functions ------------ */
    return {

        /* iterate over every voxel: cb(voxel, idx)    */
        forEachVoxel(cb) {
            voxels.forEach(cb);
        },

        /* nearest-neighbour lookup in local coords    */
        getVoxel(x, y, z) {
            var ix = clamp(Math.round((x + HALF_EXT) / CELL_SIZE), 0, CELLS_PER_AXIS - 1);
            var iy = clamp(Math.round((y + HALF_EXT) / CELL_SIZE), 0, CELLS_PER_AXIS - 1);
            var iz = clamp(Math.round((z + HALF_EXT) / CELL_SIZE), 0, CELLS_PER_AXIS - 1);
            //if (ix<0||iy<0||iz<0||
            //    ix>=CELLS_PER_AXIS||iy>=CELLS_PER_AXIS||iz>=CELLS_PER_AXIS)
            //    return null;
            return voxels[iz * CELLS_PER_AXIS * CELLS_PER_AXIS +
                iy * CELLS_PER_AXIS + ix];
        },

        /* store / accumulate any scalar or vector field */
        addField(voxel, key, value) {
            voxel.field[key] = value;
        },

        cellSize: CELL_SIZE,
        halfExtent: HALF_EXT,
        voxelCount: voxels.length
    };

})();   // end VoxelGrid IIFE


/*======================================================================
  V O X E L   G R I D   –  slip-stream helpers & visualiser
======================================================================*/
(function (G) {                // G = VoxelGrid you already created
    if (!G) return;            // safety

    /* ── per-voxel fields ─────────────────────────────────────────────── */
    var VIEWER = geofs.api.viewer;
    var SCALE = 0.35;       // metres arrow-length per (m·s-1)
    var MIN_V = 0.5;        // hide arrows below this speed

    var MAG2LEN = 0.3;                    // metres / (m · s⁻¹)
    var MIN_MAG = 0.5;                    // don’t draw tiny arrows

    /*G.forEachVoxel(v => {
        var V = v.vWind;
        var Vm = V3.length(V);
        if (Vm < MIN_MAG) { v.traj.clear(); return; }

        var dir = V3.scale(V, 1 / Vm);
        var len = Vm * MAG2LEN;           // proportional length

        var baseLLA = V3.add(ac.llaLocation,
            xyz2lla(v.centerWorld, ac.llaLocation));
        var tipLLA = V3.add(baseLLA,
            xyz2lla(V3.scale(dir, len), baseLLA));

        v.traj.clear();
        v.traj.addPosition(baseLLA);
        v.traj.addPosition(tipLLA);
    });*/

    /* ── public helper: clear field each physics step ─────────────────── */
    G.resetSlip = function () {
        G.forEachVoxel(v => {
            var vv = v.slip.vel;
            vv[0] = vv[1] = vv[2] = 0;
        });
    };

    /* ── public helper: add wind vector at WORLD position pW ──────────── */
    G.addSlipAt = function (pWorld, vWorld) {

        /* 1 ▸ get body-local offset so we can voxelise */
        var ac = geofs.aircraft.instance;
        var wfB = ac.object3d.getWorldFrame();

        /* offset in world → body space */
        var relW = V3.sub(pWorld, ac.object3d.worldPosition);
        var relB = M33.transform(wfB, relW);   // inv-rot

        var vox = G.getVoxel(relB[0], relB[1], relB[2])

        /* 3 ▸ accumulate */
        var vv = vox.slip.vel;
        vv[0] += vWorld[0];
        vv[1] += vWorld[1];
        vv[2] += vWorld[2];
    };

    /* ── visualiser – runs once per rendered frame ────────────────────── */
    geofs.api.addFrameCallback(() => {
        var MAG2LEN = 0.1;                    // metres / (m · s⁻¹)
        var MIN_MAG = 0.1;                    // don’t draw tiny arrows
        var ac = geofs.aircraft.instance;
        G.forEachVoxel(v => {
            var V = v.vWind;
            if (isNaN(V[0])) return;
            var Vm = V3.length(V);
            if (Vm < MIN_MAG) { v.traj.clear(); return; }
            var dir = V3.scale(V, 1 / Vm);
            var len = Vm * MAG2LEN;           // proportional length
            var adjustedOffset = M33.transform(ac.object3d.getWorldFrame(), v.offset);
            var baseLLA = V3.add(ac.llaLocation,
                xyz2lla(adjustedOffset, ac.llaLocation));
            var tipLLA = V3.add(baseLLA,
                xyz2lla(V3.scale(dir, len), baseLLA));

            v.traj.clear();
            v.traj.addPosition(baseLLA);
            v.traj.addPosition(tipLLA);
        });
    });

})(VoxelGrid);



function voxelGrid_applyPropWash(prop, hubW, axisDirW,
                                 thrust, torque, omega, rho) {

    /* -------------------------------------------------------------
       1 ─ basic jet speeds on the prop-plane
    ------------------------------------------------------------- */
    var R   = prop.radius * 0.5;
    var A   = Math.PI * R * R;
    var Vi  = Math.sqrt(2 * Math.abs(thrust) / (rho * A));           // axial
    var Vt0 = torque / (rho * omega * Math.pow(R, 3));               // swirl

    /* -------------------------------------------------------------
       2 ─ choose the *real* downstream direction
           tractor prop  (thrust > 0) : jet is  -axisDirW
           pusher  prop  (thrust < 0) : jet is  +axisDirW
    ------------------------------------------------------------- */
    var thrustMag = 1;
    var twistMag = 1; // 0.5 m/s is a good default for the twist
    var downstreamDir = V3.scale(V3.scale(axisDirW, -Math.sign(thrust || 1)), thrustMag);  // unit-vec
    var Vaxial0       =  Vi;                                          // speed is +

    /* simple decay parameters */
    var Laxial   = 5 * R;
    var sigma0   = 0.4 * R;
    var sigmaExp = 1.2;
    /* -------------------------------------------------------------
       3 ─ walk over all voxels
    ------------------------------------------------------------- */
    VoxelGrid.forEachVoxel(v => {
        /* A. where is the voxel centre in WORLD coordinates? */
        var cW  = v.centerWorld;        // **<- use the helper added earlier**
        /* B. vector hub ➜ voxel, axial distance & radius ---------------- */
        var rel = V3.sub(cW, hubW);
        var x   = V3.dot(rel, downstreamDir);     // >0: downstream, <0: upstream
        if (x < 0) return;                          // ignore upstream cells

        var rVec = V3.sub(rel, V3.scale(downstreamDir, x));
        var r    = V3.length(rVec);
        if (r > 3 * R) return;                      // outside influence cone

        /* C. local jet profile ------------------------------------------ */
        var sigma   = sigma0 * Math.pow(1 + x / R, sigmaExp);
        var Gauss   = Math.exp(-(r*r) / (2*sigma*sigma));
        var Vaxial  = Vaxial0 * Gauss * Math.exp(-x / Laxial);

        /* swirl: θ-direction = downstreamDir × r̂ ------------------------ */
        var rHat    = (r > 1e-6) ? V3.scale(rVec, 1/r) : [1,0,0];
        var swirlDir= V3.cross(downstreamDir, rHat);  // right-hand rule
        var Vswirl  = twistMag * -Vt0 * (R / r) * Gauss * Math.exp(-x / Laxial);

        /* D. resulting velocity vector */
        var jet = V3.add( V3.scale(downstreamDir, Vaxial),
                            V3.scale(swirlDir,      Vswirl) );

        /* E. accumulate into the voxel */
        v.vWind = V3.add(v.vWind, jet);
    });
}
/*********************************************************************
 * 2.  Reset the field each physics step
 *********************************************************************/
function voxelGrid_clearWinds() {
    VoxelGrid.forEachVoxel(v => { v.vWind = [0, 0, 0]; });
}





function bladeElementStep(ac, weather) {

    var rho = weather.atmosphere.airDensityAtAltitude;
    var wfAircraft = ac.object3d.getWorldFrame();       // body axes
    var posAircraft = ac.object3d.worldPosition;

    for (var el of bladeElements) {
        var washMult = 1;
        if (el.parent.name.includes("rudder")) washMult = 3; // skip non-rudder elements
        /* 2. rotate element’s own frame (wash-out, dihedral etc) */
        let Rloc = M33.setFromEuler(V3.toRadians(el.rot));           // local deg
        let RlocAlt = M33.setFromEuler((el.rot));           // local deg
        let R = M33.multiply(wfAircraft, Rloc);                   // ENU matrix

        let pRotLocal = M33.transform(RlocAlt, el.local); // local position
        let pBody = M33.transform(R, el.local); // body
        let pWorld = V3.add(posAircraft, pBody);
        var spanAxis = R[0];   // local +X  (root → tip)
        var chordDir = R[1];   // local +Y  (leading-edge → trailing-edge)
        let liftAxis = R[2]; // local +Z  (normal of the strip)
        var ee = Object3D.utilities.getPointLla(pBody, geofs.aircraft.instance.llaLocation);
        /* 3. airflow at element point --------------------------- */
        let V = ac.rigidBody.getVelocityInLocalPoint(pWorld);
        V = V3.sub(V, weather.currentWindVector);
        V = V3.sub(V, weather.thermals.currentVector);
        V = V3.add(V, weather.getLocalTurbulence(ee))
        V = V3.sub(V, V3.scale(VoxelGrid.getVoxel(pRotLocal[0], pRotLocal[1], pRotLocal[2]).vWind, washMult));
        var Vm = V3.length(V); if (Vm < 0.5) continue;
        var vhat = V3.scale(V, 1 / Vm);

        /* 4. control-surface deflection (flaps/ailerons) -------- */
        let deflDeg = 0,          // signed deflection +-deg  (aircraft convention)
            depth = 0;          // how far *into* the wing that surface reaches

        if (el.parent.controlSurfaces) {
            for (var cs of el.parent.controlSurfaces) {

                var root = cs.startLength;                  //   metres
                var tip = root + cs.surfaceLength;         // ^ along span

                if (el.u * el.parent.span >= root &&
                    el.u * el.parent.span <= tip) {

                    var anim = geofs.animation.values[cs.value] || 0;
                    deflDeg += anim * cs.ratio * cs.deflection;
                    depth = Math.max(depth, cs.depth || 0);
                }
            }
        }
        var liftOrig = liftAxis;
        var chordOrig = el.elementChord; // original chord length
        var areaOrig = el.area; // original area

        if (Math.abs(deflDeg) > 1e-3) {        // skip the maths if ~zero

            /* ► 4-A  rotate chord & local lift-axis exactly like before */
            var dRad = deflDeg * DEG2RAD;

            chordDir = V3.rotate(chordDir, spanAxis, -dRad);
            liftAxis = V3.rotate(liftAxis, spanAxis, -dRad);

            /* ► 4-B  translate the *trailing edge* aft
               ----------------------------------------------------------
               Simple thin-flap model: hinge lies at `depth` from the
               trailing-edge towards the leading-edge.  After rotation the new
               trailing-edge point (P2) is:
        
                   P2 =  R(-δ)·(-depth * chordDir0)
        
               The shift ∆x is the component along the *original* chord-dir:   */
            var dx = depth * (1 - Math.cos(dRad));   // ≈ depth · δ²/2 for small δ

            /* ► 4-C  bump the *effective* chord & area of this strip
               (works fine even if depth == 0 for e.g. a spoiler)             */
            var chordGain = dx;               // metres
            var areaGain = chordGain * el.span;    // el.span = strip width

            el.elementChord += chordGain;       // animate chord-length
            el.area += areaGain;        // ─┐   only for *this* frame
        }

        /* 5. AoA, coefficients, forces -------------------------- */
        var sinAoA = -V3.dot(liftAxis, vhat);
        var aoaDeg = Math.asin(clamp(sinAoA, -1, 1)) * RAD2DEG;
        var { cL, cD } = el.isRudder
            ? sampleSymmetric(sinAoA)   // α already in rad, faster
            : samplePolar(aoaDeg);        // legacy table   (needs deg)

        liftAxis = liftOrig;

        var q = 0.5 * rho * Vm * Vm;
        let Lmag = q * el.area * cL;
        let Dmag = q * el.area * cD;
        el.elementChord = chordOrig; // reset for next frame
        el.area = areaOrig; // reset for next frame

        var liftDir = V3.cross(spanAxis, vhat);      // perpendicular to v̂
        var len = V3.length(liftDir);
        if (len < 1e-6) {            // edge case: flow exactly along span
            liftDir = liftAxis;      //  fall back to old normal
        } else {
            liftDir = V3.scale(liftDir, 1 / len);            // normalise
            if (V3.dot(liftDir, liftAxis) < 0)               // keep sign
                liftDir = V3.scale(liftDir, -1);
        }

        /* 5-D:  forces ------------------------------------------------------ */
        var lift = V3.scale(liftDir, Lmag * ac.definition.liftFactor);
        var drag = V3.scale(vhat, -Dmag * ac.definition.dragFactor);

        /* 5-E:  ground-effect tweak (unchanged) ----------------------------- */
        var heightAGL = ac.llaLocation[2] - geofs.groundElevation;
        if (heightAGL < el.parent.span) {
            var geFactor = 1 / (1 + 16 * Math.pow(heightAGL / el.parent.span, 2));
            lift = V3.scale(lift, 1 + (geFactor * 0.5));
        }

        /* 5-F:  stall buffet noise (keep your existing check) -------------- */
        if (aoaDeg > 18)
            lift = V3.add(
                lift,
                V3.scale(liftDir, -clamp(Math.random() * Math.abs(aoaDeg * clamp(Vm * 0.01, 0, 10)), 0, 1e4))
            );

        /* 5-G:  apply forces ------------------------------------------------ */
        ac.rigidBody.applyForce(lift, pWorld);
        ac.rigidBody.applyForce(drag, pWorld);

        /* 7. Debug needles -------------------------------------- */
        if (DEBUG_LIFT_VECTORS) {
            el._dbg = {
                base: V3.add(ac.llaLocation, xyz2lla(pWorld, ac.llaLocation)),
                liftTip: V3.scale(lift, 0.01),
                dragTip: V3.scale(drag, 0.05)
            };
        }
        if (DEBUG_AIRFOIL_SURFACES) {
            var worldCorners = el.localCorners.map(cLocal =>
                V3.add(posAircraft, M33.transform(R, cLocal)));
            el._dbgQuad = worldCorners;          // already computed above
        }
    }
}

var LIFT_K = 0.1;
var DRAG_K = 0.1;
var THRUST_K = 0.8;
flight.tick = function (e, t, a) {
    var o, n = clamp(Math.floor(t / geofs.api.renderingSettings.physicsDeltaMs), 1, 10), r = e / n, s = 1 / e, c = geofs.aircraft.instance, d = geofs.animation.values;
    c.totalThrust = 0;
    var u = 1
        , p = 1
        , h = c.definition.zeroThrustAltitude
        , m = c.definition.zeroRPMAltitude;
    h ? u = clamp(h - d.altitude, 0, h) / h : m && (p = clamp(m - d.altitude, 0, m) / m);
    for (let i = 0; i < geofs.aircraft.instance.engines.length; i++) {
        if (i === 0) voxelGrid_clearWinds();    // once per physics step
        var eng = geofs.aircraft.instance.engines[i];
        var prop = propellers[i + 1];            // “1”, “2”, … from your JSON
        if (!prop) continue;                       // nothing defined → skip

        /* 1 ─ RPM handling -------------------------------------------------- */
        var throttle = controls.throttle;
        if (c.engine.on) {
            var tgtRPM = (c.definition.maxRPM - c.definition.minRPM) * throttle
                + c.definition.minRPM;
            var diff = tgtRPM - eng.rpm;
            eng.rpm += diff * c.definition.engineInertia * e;  // RPM lag
        } else {
            eng.rpm = Math.max(0,
                eng.rpm - eng.rpm * c.definition.engineInertia * e);
        }

        var rpm = Math.max(0.01, eng.rpm);         // avoid zero-div
        var omega = rpm * TWO_PI / 60;               // rad s⁻¹  (scalar)

        /* 2 ─ frames & helpers --------------------------------------------- */
        var wfB = c.object3d.getWorldFrame();      // body frame 3×3
        var hubL = prop.position;                   // hub in body-local
        var hubW = V3.add(c.object3d.worldPosition,
            M33.transform(wfB, hubL));

        /* prop.rotation is the static pitch / toe-in of the blades           */
        var Rprop = M33.setFromEuler(V3.toRadians([0, 0, 0])); // local->body
        var rho = weather.atmosphere.airDensityAtAltitude;
        var V_ac = c.velocity;                      // aircraft linear vel (ENU)

        /* axis is body +Y (wfB[1]) so ω × r gives  ➜  right / down / left …  */
        var axisDirW = wfB[1];                       // unit vector (world)
        var omegaVec = V3.scale(axisDirW, omega);    // angular-velocity vector

        let thrustSum = 0;
        let torqueSum = 0;

        // 0.  Moment of inertia for a thin disk  (default if not supplied)
        //     I = ½ m r²     –  mass and radius in SI units.
        var mass = prop.bladeMass || 10;           // kg  (add/tune in JSON)
        var Izz = prop.inertia || 0.5 * mass * prop.radius * prop.radius;

        // 1.  Angular-momentum vector of the prop in **world** coordinates
        //     (axisDirW already points + along the shaft)
        var L_vec = V3.scale(axisDirW, Izz * omega);  // units:  kg·m²·s⁻¹

        // 2.  Aircraft rotational-rate vector  Ω_body  (rad s⁻¹) in BODY frame.
        //     GeoFS exposes it as rigidBody.w_angularVelocity  (x-pitch, y-roll, z-yaw)
        var wBody = c.rigidBody.v_angularVelocity || [0, 0, 0];

        // 3.  Bring Ω into WORLD coordinates so both vectors share the same basis
        var wWorld = M33.transform(wfB, wBody);

        // 4.  Gyroscopic torque applied to the airframe
        var gyroTorque = V3.cross(wBody, L_vec);     // τ = Ω × L

        // 5.  Apply once per physics step
        if (gyroTorque[0] || gyroTorque[1] || gyroTorque[2])          // skip zeros
            c.rigidBody.applyTorque(gyroTorque);

        /* 3 ─ loop blades & strips ----------------------------------------- */
        var dAz = TWO_PI / prop.bladeCount;

        for (let b = 0; b < prop.bladeCount; ++b) {

            var az = b * dAz;                                // rad


            for (var sTr of prop._strips) {
                var pitchRad = sTr.pitchRad;          // scalar → rad

                /* local radial (span) axis of this strip,   |r| = 1  */
                let radialLocal = V3.normalize([                  // lies in X-Z disc plane
                    Math.sin(sTr.az),        // X
                    0,                   // Y (prop axis)
                    Math.cos(sTr.az)         // Z  (az = 0 ⇒ strip “up”)
                ]);

                /* chord for zero-pitch = tangential to the disc (points with rotation) */
                let chord0 = [                          // still in prop-local space
                    -Math.cos(sTr.az),  // −cos, not +cos, to follow right-hand rotation
                    0,
                    Math.sin(sTr.az)
                ];

                /* rotate that chord around its own span axis by the blade-pitch angle  */
                let chordLocal = V3.rotate(chord0, radialLocal, pitchRad);

                /* now bring the chord into body- and then world-space                  */
                chordLocal = M33.transform(Rprop, chordLocal);   // toe-in / mounting
                let chordDirW = V3.normalize(M33.transform(wfB, chordLocal));
                /* rotate by pitch / toe-in, then into world space            */
                var rBody = M33.transform(Rprop, sTr.localPos);      // s.localPos already has azimuth
                var stripW = V3.add(hubW, M33.transform(wfB, rBody));
                var rVecW = V3.sub(stripW, hubW);

                /* 3-B  local velocity (ω × r + aircraft motion) -------------- */
                var VrotW = V3.cross(omegaVec, rVecW);
                var VlocW = V3.add([0.0, 0.0, 0.0], VrotW); //replace 0.0 with V_ac for aircraft velocity

                var Vmag = V3.length(VlocW);
                if (Vmag < 0.5) continue;

                var vHat = V3.scale(VlocW, 1 / Vmag);

                /* 3-C  AoA & coefficients (use blade-specific chord) --------- */
                var sinAoA = -V3.dot(chordDirW, vHat);
                var aoaDeg = Math.asin(clamp(sinAoA, -1, 1)) * RAD2DEG;

                var { cL, cD } = samplePolar(aoaDeg);

                /* 3-D  forces ---------------------------------------------- */
                var q = 0.5 * rho * Vmag * Vmag;
                var Lmag = q * sTr.area * cL;
                var Dmag = q * sTr.area * cD;

                /* lift ⟂ flow, drag ‖ –vHat                                 */
                var liftDirW = V3.normalize(axisDirW);  // in disc plane
                var dragDirW = V3.scale(vHat, -1);

                var L = V3.scale(liftDirW, Lmag * prop.propLift);
                var D = V3.scale(dragDirW, Dmag * prop.propDrag);
                var F = V3.add(L, D);

                /* 3-E  thrust & torque contributions ----------------------- */
                var thrust = V3.dot(F, axisDirW);
                var tangential = V3.length(V3.sub(F,
                    V3.scale(axisDirW, thrust)));
                var torque = tangential * sTr.rMid;          // Nm

                thrustSum += thrust;
                torqueSum += torque;

                /* 3-F  apply to rigid body -------------------------------- */
                c.rigidBody.applyForce(F, stripW);

                /* 3-G  debug needles -------------------------------------- */
                if (DEBUG_PROP_VECTORS) {
                    var baseLLA = V3.add(c.llaLocation,
                        xyz2lla(stripW, c.llaLocation));
                    var toLLA = (vec, k) =>
                        V3.add(baseLLA, xyz2lla(V3.scale(vec, k), baseLLA));

                    sTr.dbgL.clear();
                    sTr.dbgL.addPosition(baseLLA);
                    sTr.dbgL.addPosition(toLLA(L, LIFT_K));

                    sTr.dbgD.clear();
                    sTr.dbgD.addPosition(baseLLA);
                    sTr.dbgD.addPosition(toLLA(D, DRAG_K));

                    sTr.dbgT.clear();
                    sTr.dbgT.addPosition(baseLLA);
                    sTr.dbgT.addPosition(toLLA((chordDirW), THRUST_K));
                }
            }
        }

        /* 4 ─ bookkeeping -------------------------------------------------- */
        eng.currentThrust = thrustSum;
        eng.currentTorque = torqueSum;
        c.totalThrust += thrustSum;
        c.engine.rpm = Math.round(rpm);
        voxelGrid_applyPropWash(
            prop,          // same object you loop over
            hubW,          // world position of hub
            axisDirW,      // +Y body transformed to world
            thrustSum,
            torqueSum,
            omega,
            rho);
        /* axis debug line --------------------------------------------------- */
        if (DEBUG_PROP_VECTORS) {
            var AXIS_LEN = 2;                      // metres, visual only
            var tipLLA = V3.add(
                V3.add(c.llaLocation, xyz2lla(hubW, c.llaLocation)),
                xyz2lla(V3.scale(axisDirW, AXIS_LEN),
                    V3.add(c.llaLocation, xyz2lla(hubW, c.llaLocation))));
            prop.dbgAxis.clear();
            prop.dbgAxis.addPosition(
                V3.add(c.llaLocation, xyz2lla(hubW, c.llaLocation)));
            prop.dbgAxis.addPosition(tipLLA);
        }
    }
    for (var V = 0, y = 0, M = geofs.aircraft.instance.balloons.length; y < M; y++) {
        var D = geofs.aircraft.instance.balloons[y]
            , O = clamp(controls[D.controller.name] * D.controller.ratio || 0, 0, 1);
        V = D.temperature;
        var E = (V += O * D.heatingSpeed * e) - weather.atmosphere.airTempAtAltitude;
        V -= D.coolingSpeed * E * e,
            V = clamp(V, 0, 300),
            D.temperature = V;
        var I = V + KELVIN_OFFSET
            , N = weather.atmosphere.airPressureAtAltitude / (GAS_CONSTANT * I)
            , F = (weather.atmosphere.airDensityAtAltitude - N) * D.volume;
        D.liftingForce = F * GRAVITY,
            c.envelopeTemp = V
    }
    if (geofs.waterDepth = geofs.api.waterDetection.getWaterDepth(c.llaLocation[0], c.llaLocation[1]),
        geofs.waterDepth > 0) {
        if (geofs.groundIsWater = !0,
            geofs.groundElevation < .1) {
            geofs.waterIsSea = !0;
            let z = geofs.fx.water.getWaveHeight(c.llaLocation[0], c.llaLocation[1], -1)
                , B = geofs.fx.water.getWaveHeight(c.llaLocation[0], c.llaLocation[1], 0);
            geofs.waveVerticalSpeed = (z - B) / e,
                geofs.waveHeight = B
        } else
            geofs.waterIsSea = !1,
                geofs.waveHeight = 0
    } else
        geofs.groundIsWater = !1,
            geofs.waterIsSea = !1,
            geofs.waveHeight = 0;
    weather.atmosphere.update(c.llaLocation[2]),
        c.stalling = !1;
    for (var j = 0; j < n; j++) {
        c.velocity = c.rigidBody.v_linearVelocity,
            c.velocityDirection = V3.normalize(c.velocity),
            c.velocityScalar = V3.length(c.velocity),
            c.groundSpeed = V2.length([c.velocity[0], c.velocity[1]]),
            c.velocityScalar,
            c.airVelocity = V3.sub(c.velocity, weather.currentWindVector),
            c.airVelocityDirection = V3.normalize(c.airVelocity),
            c.trueAirSpeed = V3.length(c.airVelocity),
            geofs.aircraft.instance.object3d.getWorldFrame()[2];
        for (var y = 0, M = c.balloons.length; y < M; y++) {
            var D = c.balloons[y];
            c.rigidBody.applyForce([0, 0, D.liftingForce], D.points.forceSourcePoint.worldPosition)
        }
        for (var y = 0; y < c.engines.length; y++) {
            var v = c.engines[y]
                , U = v.object3d.getWorldFrame()[v.forceDirection];
            c.rigidBody.applyForce(V3.scale(U, v.currentThrust), v.points.forceSourcePoint.worldPosition)
        }
        if (c.trueAirSpeed > .01) {
            var G = c.trueAirSpeed * c.trueAirSpeed;
            W = c.definition.dragCoefficient ? .5 * c.definition.dragCoefficient * weather.atmosphere.airDensityAtAltitude * G : c.definition.dragFactor * G * weather.atmosphere.airDensityAtAltitude;
            var H = V3.scale(c.airVelocityDirection, -W);
            c.rigidBody.applyCentralForce(H);

            /* =====================================================
               REPLACED SEGMENT – old for-loop deleted
               ===================================================== */
            bladeElementStep(c, weather);
        }
        var ey = 0;
        if (c.groundContact = !1,
            c.waterContact = !1,
            c.rigidBody.applyForce(c.rigidBody.gravityForce, c.parts.root.points.centerOfMass.worldPosition),
            geofs.withinCollisionRange) {
            for (var ev = geofs.aircraft.instance.collisionPoints, e_ = [], ew = 0, y = 0, M = ev.length; y < M; y++) {
                var eb, ex = ev[y];
                ex.id = y;
                var eS = ex.part;
                ex.groundContact = c.groundContact,
                    eS.contact = null;
                var eP = V3.add(c.llaLocation, xyz2lla(ex.worldPosition, c.llaLocation));
                c.rigidBody.getVelocityInLocalPoint(ex.worldPosition);
                var eA = geofs.getCollisionResult(eP, ex.worldPosition, c.collResult, ex)
                    , e0 = eA.location[2]
                    , ek = eS.object3d.getWorldFrame()
                    , eT = c.collResult.normal;
                if (geofs.waterDepth > 0 && eS.buoyancy && !eA.object) {
                    var eC = Math.min(e0 + geofs.waveHeight - eP[2], 10);
                    if (eC > 0 && !ex.wrongAltitude) {
                        let e8 = Math.min(eC, 1);
                        eb = {
                            collisionPoint: ex,
                            normal: [0, 0, 1],
                            depth: eC,
                            submersionRatio: e8,
                            force: e8 * eS.buoyancy,
                            type: "buoyancy"
                        },
                            eS.contact = eb,
                            e_.push(eb)
                    }
                    e0 -= geofs.waterDepth
                } else if (eS.suspension) {
                    var eR = eS.points.suspensionOrigin
                        , eV = eR.worldPosition[2] + c.llaLocation[2] - e0
                        , eM = eS.suspension.restLength - eV
                        , e1 = clamp(eM / eS.suspension.restLength, 0, 1)
                        , eL = e1 * eS.suspension.restLength;
                    if (e1 > 0 && eR.worldPosition[2] >= ex.worldPosition[2] && !ex.wrongAltitude) {
                        var eD = V3.dot(eT, ek[2]);
                        eb = {
                            collisionPoint: ex,
                            normal: eT,
                            force: eS.suspension.stiffness * eL,
                            type: "raycast",
                            contactFwdDir: V3.cross(eT, V3.normalize(ek[0])),
                            contactSideDir: V3.cross(eT, V3.normalize(ek[1]))
                        },
                            (e1 >= eS.suspension.hardPoint || eD < .4) && (eb.type = "hardpoint",
                                eb.penetration = e0 - (ex.worldPosition[2] + c.llaLocation[2]),
                                ew = Math.max(ew, eb.penetration)),
                            eS.contact = eb,
                            e_.push(eb),
                            eR[2] = -eM;
                        var eO = eS.name + "Suspension";
                        d[eO] = eM,
                            eS.suspension.rest = !1
                    } else if (!eS.suspension.rest) {
                        var eO = eS.name + "Suspension";
                        d[eO] = 0,
                            eS.points.suspensionOrigin[2] = 0,
                            eS.suspension.rest = !0
                    }
                    var eE = {};
                    eE[eS.name] = eS,
                        c.placeParts(eE)
                } else if (eS.hook) {
                    if (eA.object && eA.object.arrestingCable && !c.arrestingCableContact) {
                        var eI = e0 - eP[2];
                        eI >= -eA.object.arrestingCableHeight && (c.arrestingCableContact = {
                            collisionPoint: ex,
                            normal: eT,
                            type: "arrestingCable",
                            object: eA.object,
                            contactFwdDir: V3.cross(eT, V3.normalize(ek[0])),
                            contactSideDir: V3.cross(eT, V3.normalize(ek[1]))
                        })
                    }
                    if (c.arrestingCableContact) {
                        var eN = geofs.utils.llaDistanceInMeters(eP, c.arrestingCableContact.object.location);
                        c.velocityScalar < flight.arrestingHookDiscardVelocity || eN > flight.arrestingHookDiscardLength ? (c.arrestingCableContact.object.model.setPositionOrientationAndScale(c.arrestingCableContact.object.location, null, 1),
                            c.arrestingCableContact = null) : (eS.contact = c.arrestingCableContact,
                                e_.push(c.arrestingCableContact),
                                c.arrestingCableContact.object.model.setPositionOrientationAndScale(eP, null, [1.6 * eN, 1, 1]))
                    }
                } else if (eS.catapult) {
                    if (c.launchBarContact = null,
                        c.onCatapult = !1,
                        eA.object && eA.object.catapult) {
                        var eI = e0 - eP[2];
                        eI > -.1 && (c.onCatapult = !0,
                            controls.throttle > .5 && (c.launchBarContact = {
                                collisionPoint: ex,
                                normal: eT,
                                type: "launchBar",
                                object: eA.object,
                                contactFwdDir: V3.normalize(ek[1]),
                                contactSideDir: null
                            },
                                e_.push(c.launchBarContact)))
                    }
                } else {
                    var eI = e0 - eP[2];
                    if (eI >= 0 && !ex.wrongAltitude) {
                        ew = Math.max(ew, eI);
                        var eb = {
                            collisionPoint: ex,
                            normal: eT,
                            penetration: eI,
                            type: "standard",
                            contactFwdDir: V3.cross(eT, V3.normalize(ek[0])),
                            contactSideDir: V3.cross(eT, V3.normalize(ek[1]))
                        };
                        eS.contact = eb,
                            e_.push(eb)
                    }
                }
            }
            if (e_.length && (c.groundContact = !0,
                !flight.skipCollisionResponse)) {
                ew > flight.minPenetrationThreshold && !geofs.cautiousWithTerrain && (c.llaLocation[2] = c.llaLocation[2] + ew,
                    ew = 0);
                for (var eF = 0, M = e_.length; eF < M; eF++) {
                    var eb = e_[eF]
                        , ex = eb.collisionPoint
                        , eS = ex.part
                        , e3 = ex.contactProperties
                        , ez = c.rigidBody.getVelocityInLocalPoint(ex.worldPosition);
                    ez = V3.add(ez, [0, 0, geofs.waveVerticalSpeed]);
                    var e2 = V3.dot(eb.normal, ez);
                    ey = Math.max(ey, Math.abs(e2));
                    var e4 = 0;
                    if ("buoyancy" == eb.type) {
                        let eB = clamp(.1 * eb.force * e2, 0, eb.force);
                        var ej = eb.force - eB;
                        c.rigidBody.applyForce(V3.scale(eb.normal, ej), ex.worldPosition);
                        let eU = V3.normalize(ez)
                            , eG = V3.length(ez)
                            , eH = eG * eG * .5;
                        if ("float" == eS.type) {
                            let eW = eS.object3d.getWorldFrame()[eS.forceDirection]
                                , e6 = -V3.dot(eW, eU) * TWO_PI
                                , e5 = .01
                                , eq = WATER_DENSITY * eH * eS.area * e6 * e5;
                            c.rigidBody.applyForce(V3.scale(eW, eq), ex.worldPosition)
                        }
                        let e7 = eH * WATER_DENSITY * eb.submersionRatio;
                        geofs.aircraft.instance.object3d.setVectorWorldPosition(eS.dragVector);
                        let eY = V3.mult(eU, V3.abs(eS.dragVector.worldPosition))
                            , eX = V3.scale(eY, -e7);
                        c.rigidBody.applyForce(eX, ex.worldPosition),
                            c.waterContact = !0
                    }
                    if (("raycast" == eb.type || "hardpoint" == eb.type) && (e4 = (eb.force - eS.suspension.damping * e2) * c.rigidBody.mass * r) > 0 && c.rigidBody.applyImpulse(V3.scale(eb.normal, e4), ex.worldPosition),
                        "arrestingCable" == eb.type && (c.arrestingCableContact.force = V3.scale(ez, -eS.hook.strength),
                            c.rigidBody.applyForce(c.arrestingCableContact.force, ex.worldPosition)),
                        "launchBar" == eb.type && (c.launchBarContact.force = V3.scale(geofs.aircraft.instance.object3d.getWorldFrame()[1], eS.catapult.strength),
                            c.launchBarContact.force[2] = 0,
                            controls.steering = 0,
                            controls.yaw = 0,
                            c.rigidBody.applyForce(c.launchBarContact.force, [0, 0, 0])),
                        ("standard" == eb.type || "hardpoint" == eb.type) && e2 < 0) {
                        var eZ = c.rigidBody.computeJacobian(0, e2, ex.worldPosition, eb.normal)
                            , e9 = V3.scale(eb.normal, eZ);
                        c.rigidBody.applyImpulse(e9, ex.worldPosition),
                            e4 = eZ
                    }
                    var eQ = e4 * e3.frictionCoef;
                    if (eQ = clamp(eQ, eQ, 2 * c.rigidBody.mass * r * e3.frictionCoef),
                        "buoyancy" == eb.type)
                        ;
                    else if ("wheel" == eS.type) {
                        var eK = eb.contactFwdDir
                            , eJ = eb.contactSideDir
                            , te = V3.dot(eJ, ez)
                            , tt = V3.dot(eK, ez);
                        eb.forwardProjVel = tt,
                            eb.sideProjVel = te;
                        var ti = c.rigidBody.computeJacobian(0, te, ex.worldPosition, eJ)
                            , ta = c.rigidBody.computeJacobian(0, tt, ex.worldPosition, eK)
                            , to = Math.abs(ti)
                            , tn = Math.abs(ta)
                            , tr = 1
                            , ts = 1;
                        Math.abs(tt) > e3.lockSpeed ? ts = e3.rollingFriction : (eb.forwardProjVel = 0,
                            eb.sideProjVel = 0);
                        var tl = eS.brakesController;
                        if (tl && tn > 0) {
                            var tc = clamp(d[tl] * eS.brakesControllerRatio, 0, 1);
                            ts = clamp(eQ / (tn * e3.frictionCoef), 0, 1) * tc
                        }
                        var td = c.definition.brakeDamping || 3;
                        controls.brakes > .05 && (ts = clamp(eQ / (tn * e3.frictionCoef * td) * controls.brakes, 0, 1)),
                            to > eQ && (tr = clamp(eQ / (to * to), e3.dynamicFriction, 1)),
                            c.rigidBody.applyImpulse(V3.scale(eJ, ti * tr), ex.worldPosition),
                            c.rigidBody.applyImpulse(V3.scale(eK, ta * ts), ex.worldPosition)
                    } else {
                        var tu = V3.sub(ez, V3.scale(eb.normal, e2))
                            , tp = V3.normalize(tu)
                            , th = V3.length(tu);
                        if (th) {
                            var tm = c.rigidBody.computeJacobian(0, th, ex.worldPosition, tp)
                                , tf = Math.abs(tm)
                                , tg = 1;
                            tf > eQ && (tg = clamp(eQ / (tf * tf), e3.dynamicFriction, 1)),
                                c.rigidBody.applyImpulse(V3.scale(tp, tg * tm), ex.worldPosition)
                        }
                    }
                }
            }
        } else
            for (var y = 0, M = geofs.aircraft.instance.suspensions.length; y < M; y++) {
                var eS = geofs.aircraft.instance.suspensions[y];
                if (eS.suspension && !eS.suspension.rest) {
                    var eO = eS.name + "Suspension";
                    d[eO] = 0,
                        eS.points.suspensionOrigin[2] = 0,
                        eS.suspension.rest = !0
                }
            }
        flight.recorder.playing || flight.sharing.on || (c.rigidBody.integrateVelocities(r),
            c.rigidBody.integrateTransform(r),
            geofs.aircraft.instance.object3d.compute(c.llaLocation),
            geofs.aircraft.instance.htr = geofs.aircraft.instance.object3d.htr,
            flight.setAnimationValues(r, a),
            geofs.autopilot.update(r),
            flight.recorder.record())
    }
    !0 == flight.recorder.playing ? (flight.recorder.play(t),
        flight.setAnimationValues(e, a)) : flight.sharing.on ? (flight.sharing.update(t),
            flight.setAnimationValues(e, a)) : (c.rigidBody.setCurrentAcceleration(s, e),
                c.placeParts()),
        c.render(),
        geofs.preferences.crashDetection && ey > 10 && !c.crashed && (c.crashNotified = !0,
            ui.showCrashNotification(),
            c.crash()),
        c.htrAngularSpeed = V3.sub(c.object3d.htr, c.htr),
        c.htrAngularSpeed = fixAngles(c.htrAngularSpeed),
        c.htrAngularSpeed = V3.scale(c.htrAngularSpeed, 1 / t),
        c.htr = c.object3d.htr,
        c.maxAngularVRatio = 0;
    for (var y = 0, M = c.wheels.length; y < M; y++) {
        var t$ = c.wheels[y];
        if (t$.oldAngularVelocity = t$.angularVelocity,
            t$.contact) {
            t$.angularVelocity = t$.contact.forwardProjVel * e / t$.arcDegree;
            var ty = t$.angularVelocity / t$.oldAngularVelocity;
            t$.contact.forwardProjVel > 30 && ty > 40 && new geofs.fx.ParticleEmitter({
                anchor: t$.contact.collisionPoint,
                duration: 200,
                rate: .05,
                life: 2e3,
                startScale: .001,
                endScale: .05,
                startOpacity: .3,
                endOpacity: .001,
                startRotation: "random",
                endRotation: "random",
                texture: "smoke"
            }),
                c.maxAngularVRatio = Math.max(c.maxAngularVRatio, ty)
        } else
            t$.angularVelocity > .01 && (t$.angularVelocity *= .9);
        var tv = t$.name + "Rotation"
            , t_ = d[tv] || 0;
        d[tv] = fixAngle360(t_ + t$.angularVelocity),
            d[tv + "Ratio"] = d[tv] / 360
    }
}

flight.setAnimationValues = function (e, t) {
    var a = geofs.aircraft.instance
        , o = geofs.animation.values
        , n = a.llaLocation[2] * METERS_TO_FEET
        , r = (n - a.oldAltitude * METERS_TO_FEET) * 60 / e || 0;
    a.oldAltitude = a.llaLocation[2];
    var s = fixAngle(weather.currentWindDirection - a.htr[0])
        , c = a.engine.rpm * a.definition.RPM2PropAS * e;
    o.acceleration = M33.transform(M33.transpose(a.object3d._rotation), a.rigidBody.v_acceleration),
        o.accX = o.acceleration[0],
        o.accY = o.acceleration[1],
        o.accZ = o.acceleration[2],
        o.jerk = M33.transform(M33.transpose(a.object3d._rotation), a.rigidBody.v_jerk),
        o.angularAcceleration = M33.transform(M33.transpose(a.object3d._rotation), a.rigidBody.v_angularAcceleration),
        o.aAccX = o.angularAcceleration[0],
        o.aAccY = o.angularAcceleration[1],
        o.aAccZ = o.angularAcceleration[2],
        o.loadFactor = o.acceleration[2] / GRAVITY,
        o.slipball = exponentialSmoothing("slipball", clamp(o.acceleration[0] / Math.abs(o.acceleration[2] - 9.81), -1, 1), .02),
        o.airspeedms = a.trueAirSpeed,
        o.ktas = a.trueAirSpeed * MS_TO_KNOTS,
        o.kiasChangeRate = (o.kias - o.ktas) * e,
        o.kias = o.ktas,
        o.kiasUnits = o.ktas % 10,
        o.kiasTens = o.ktas % 100,
        o.kiasHundreds = o.ktas % 1e3,
        o.kiasThousands = o.ktas % 1e4,
        o.groundSpeed = a.groundSpeed,
        o.groundSpeedKnt = a.groundSpeed * MS_TO_KNOTS;
    let d = clamp(a.trueAirSpeed / 50, 0, 1);
    o.airVibration = Math.random() * d,
        o.airVibration2 = Math.random() * d,
        o.altitudeMeters = a.llaLocation[2],
        o.altitude = n,
        o.haglMeters = geofs.relativeAltitude,
        o.haglFeet = geofs.relativeAltitude * METERS_TO_FEET,
        o.groundElevationFeet = geofs.groundElevation * METERS_TO_FEET,
        o.verticalSpeed = r,
        o.climbrate = r,
        o.aoa = a.trueAirSpeed > 1 ? a.angleOfAttackDeg : 0,
        o.turnrate = 60 * fixAngle(a.htr[0] - o.heading) / e,
        o.heading = a.htr[0],
        o.heading360 = fixAngle360(a.htr[0]),
        o.atilt = a.htr[1],
        o.aroll = a.htr[2],
        o.enginesOn = a.engine.on,
        o.engineVibration = a.engine.rpm > 100 ? Math.random() * clamp(1e3 / a.engine.rpm, 0, 1) : 0,
        o.prop = fixAngle360(o.prop + c),
        o.thrust = a.totalThrust,
        o.rpm = a.engine.rpm,
        o.throttle = controls.throttle,
        o.mixture = controls.mixture,
        o.carbHeat = controls.carbHeat,
        o.smoothThrottle = exponentialSmoothing("throttle", o.throttle, .02),
        o.pitch = controls.pitch,
        o.rawPitch = controls.rawPitch,
        o.roll = controls.roll,
        o.invRoll = -controls.roll,
        o.yaw = controls.yaw,
        o.rawYaw = controls.rawYaw,
        o.steering = controls.steering,
        o.trim = controls.elevatorTrim,
        o.brakes = controls.brakes,
        o.gearPosition = controls.gear.position,
        o.invGearPosition = 1 - controls.gear.position,
        o.gearTarget = controls.gear.target,
        o.flapsValue = controls.flaps.position / controls.flaps.maxPosition,
        o.accessoriesPosition = controls.accessories.position,
        o.accessoriesTarget = controls.accessories.target,
        o.flapsPosition = controls.flaps.position,
        o.flapsTarget = controls.flaps.target,
        o.flapsPositionRatio = controls.flaps.positionRatio,
        o.flapsPositionTarget = controls.flaps.positionTarget,
        o.flapsSteps = geofs.aircraft.instance.definition.flapsSteps,
        o.airbrakesPosition = controls.airbrakes.position,
        o.optionalAnimatedPartPosition = controls.optionalAnimatedPart.position,
        o.optionalAnimatedPartTarget = controls.optionalAnimatedPart.target,
        o.airbrakesTarget = controls.airbrakes.target,
        o.parkingBrake = a.brakesOn,
        o.groundContact = a.groundContact ? 1 : 0,
        o.arrestingHookTension = a.arrestingCableContact ? V3.length(a.arrestingCableContact.force) : 0,
        o.onCatapult = a.onCatapult,
        o.catapult = !!a.launchBarContact,
        o.stalling = !geofs.aircraft.instance.groundContact && a.stalling,
        o.airTemp = weather.atmosphere.airTempAtAltitude;
    let u = new Date;
    if (o.compHours = u.getHours(),
        o.compMinutes = u.getMinutes(),
        o.compSeconds = u.getSeconds(),
        o.mach = geofs.utils.msToMach(a.trueAirSpeed),
        o.machUnits = Math.floor(o.mach),
        o.machTenth = Math.floor(10 * (o.mach % 1).toPrecision(2)),
        o.machHundredth = Math.floor(100 * (o.mach % .1).toPrecision(2)),
        o.altTenThousands = n % 1e5,
        o.altThousands = n % 1e4,
        o.altHundreds = n % 1e3,
        o.altTens = n % 100,
        o.altTensShift = Math.floor(n % 1e5 / 1e4),
        o.altUnits = n % 10,
        o.relativeWind = s,
        o.windSpeed = weather.currentWindSpeed,
        o.windSpeedLabel = parseInt(weather.currentWindSpeed) + " kts",
        o.view = geofs.camera.currentView,
        o.insideView = geofs.camera.currentDefinition.insideView,
        o.cameraDotAircraftForward = geofs.camera.dotAircraftForward,
        o.envelopeTemp = a.envelopeTemp,
        o.maxAngularVRatio = a.maxAngularVRatio,
        a.groundContact ? o.rollingSpeed = a.velocityScalar : o.rollingSpeed = 0,
        "free" == geofs.camera.currentModeName || "chase" == geofs.camera.currentModeName) {
        var p = geofs.utils.llaDistanceInMeters3D(geofs.camera.lla, a.llaLocation);
        o.cameraAircraftSpeed = (o.cameraAircraftDistance - p) / e,
            o.cameraAircraftDistance = p
    } else
        o.cameraAircraftSpeed = 0,
            o.cameraAircraftDistance = 0;
    o.geofsTime = t
}

