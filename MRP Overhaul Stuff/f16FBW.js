/* DEVELOPER NOTES AS OF 11/12/2026:
The title is pretty slef-explanatory. It's a recreation of the F16's actual FBW system. I recall testing it against the DCS F16 module for accuracy
and it felt comparable, though there are a few issues (primarily in the transition between alpha and pitch rate law) to be ironed out.
I haven't tested this on the new GeoFS version, and if the F16's aircraft.json has been altered since this was written then it is likely
that it will not perform entirely correctly. 
I tend to use comments to keep units consistent, so this one should hopefully be a bit easier to read through than some of the other scripts.
*/
var f16Tune = {
    maxPullG: 9,   // stick full-aft  -> +9 g command
    maxPushG: -3,   // stick full-forward -> –3 g command

    kpNz: 1.5,  // proportional gain  (deg stab / g-error)
    kiNz: 0.5,  // integral gain      (deg stab / g-error·s)
    kdNz: 0.05, // derivative gain    (deg stab / (g-error/s))

    alphaMax: 25,   // hard AoA ceiling (deg)
    alphaBlend: 15,   // start blending Nz-law into alpha-law above this (deg)

    kffNz: 0.85, // open-loop stab-per-g @ sea-level, ref-speed (deg/g)
    intLim: 2,    // +/-deg of stabilator that the integrator alone may command
    // (anti-wind-up guard)

    qCmdMax: 2000,   // stick full-aft / fwd (gear-down) -> +/-30 deg/s commanded q
    kpQ: 0.05,// proportional on pitch-rate error (deg stab / (deg/s))
    kiQ: 0.005,// integral on pitch-rate error (deg stab / (deg/s)·s)
    kdQ: 0.0001,// derivative on pitch-rate error rate (deg stab / (deg/s)/s)

    stabDeflMax: 20,   // physical stabilator authority (+/-deg)

    easRef: 50,   // reference EAS (m/s). Gains scale as  (easRef / EAS)

    kpTheta: 0.6,  // proportional on attitude error  (deg stab / deg pitch)
    kiTheta: 0.2,   // integral on attitude error      (deg stab / deg·s)
    flapGearDn: 0.45, // Flap deflection when gear is down (0.45 = 45%)

    pMaxLow: 10000,   // deg/s  (alpha <= 5 deg)
    pMaxHigh: 5000,   // deg/s  (alpha >= 25 deg)

    kpP: 0.03,       // deg flaperon / (deg/s) error   @ ρ0, easRef
    kiP: 0.0,       // deg flaperon / (deg/s)·s
    kdP: 0.0,       // deg flaperon / (deg/s)/s

    flapDiffMax: 23, // +/- differential deflection (trailing-edge up positive)
    tailDiffMax: 11, // each stab +/-11deg about symmetric pos

    alphaWashStart: 15,   // alpha where flaperon diff begins to wash out
    alphaWashEnd: 25,   // alpha where it is fully gone

    rudCoupleGain: -0.05, // fbwYaw  = rudCoupleGain * fbwFlaperons

    slatMax: 25,      // absolute LEF down limit (deg)
    slatMin: -2,      // slight up-rig at high Mach (deg)
    slatMach0: 25,      // σ=1  at M ~ 0, alpha = 0
    slatMach06: 2,      // σ=0.5 at M >= 0.6, alpha = 0
    slatAlphaGain: 0.4,     // additional deg per deg alpha  (low Mach only)

    krYaw: 0.01,   // rudder per deg/s yaw-rate  (primary damper)
    kbBeta: 0.0,    // rudder per unit slip-ball  (trim only!)
    rudQRef: 20000,   // N/m^2 -> full rud authority   (~ 90 kt IAS)
    rudRatioMin: 0.3      // never allow <30 % of max throw
};



geofs.animation.values.fbwPitch = 0.0;
geofs.animation.values.fbwYaw = 0.0;
geofs.animation.values.fbwRoll = 0.0;
geofs.animation.values.fbwFlaps = 0.0; //For just the flap functionality of the flaperons
geofs.animation.values.fbwFlaperons = 0.0; //For the aileron functionality of the flaperons
geofs.animation.values.fbwSlats = 0.0; //For the slats functionality

var ISA = {
    g: 9.80665,
    R: 287.058,        // J/(kg·K)
    T0: 288.15,         // K  (15 degC)
    P0: 101325,         // Pa
    L: 0.0065          // K/m  (lapse rate up to 11 km)
};

function airDensity(h, tempC) {           // h [m], tempC [degC]
    var T = ISA.T0 - ISA.L * h;        
    var P = ISA.P0 * Math.pow(T / ISA.T0, ISA.g / (ISA.R * ISA.L));
    // use *actual* temperature if sim provides one (GeoFS does)
    var Tamb = (tempC + 273.15);
    return P / (ISA.R * Tamb);
}

var prevTimeMs = Date.now();

function dtSec() {
    var t = Date.now();
    var dt = (t - prevTimeMs) * 0.001;
    prevTimeMs = t;
    return Math.max(dt, 1 / 120);   // clamp to a sane value
}

function lerp(a, b, t) { return a + (b - a) * t; }

// For pitch-rate law we need body pitch-rate q (deg/s)
let prevPitchRad = 0;

function setupSurfaces() {
    geofs.aircraft.instance.parts.aileronLeft.animations[0].value = 'fbwFlaperons';
    geofs.aircraft.instance.parts.aileronLeft.animations[1].value = 'fbwFlaps';
    geofs.aircraft.instance.parts.aileronRight.animations[0].value = 'fbwFlaperons';
    geofs.aircraft.instance.parts.aileronRight.animations[1].value = 'fbwFlaps';

    geofs.aircraft.instance.parts.elevatorLeft.animations[0].value = 'fbwPitch';
    geofs.aircraft.instance.parts.elevatorLeft.animations[1].value = 'fbwRoll';
    geofs.aircraft.instance.parts.elevatorRight.animations[0].value = 'fbwPitch';
    geofs.aircraft.instance.parts.elevatorRight.animations[1].value = 'fbwRoll';

    geofs.aircraft.instance.parts.rudder.animations[0].value = 'fbwYaw';

    geofs.aircraft.instance.parts.slatLeft.animations[0].value = 'fbwSlats';
    geofs.aircraft.instance.parts.slatRight.animations[0].value = 'fbwSlats';
    geofs.aircraft.instance.parts.virtualFlaps.animations[0].value = 'fbwFlaps';

    geofs.aircraft.instance.parts.bodyH.dragFactor = 10;
}


var intNzErr = 0,
    intQErr = 0,
    prevNzErr = 0,
    prevQErr = 0,
    stabUnsatPrev = 0,      // for anti-wind-up
    intPErr = 0,
    prevPErr = 0,
    flapUnsatPrev = 0;

function computeControls() {
    var v = geofs.animation.values;
    var ctl = controls;

    var dt = dtSec();
    if (!dt) return;    // avoid NaNs on first frame



    var rho = airDensity(v.altitudeMeters, v.airTemp);
    var eas = v.airspeedms * Math.sqrt(rho / 1.225);      // ~ EAS
    var gsF = clamp(f16Tune.easRef / Math.max(eas, 50), 0, 1);

    var qbar = 0.5 * rho * v.airspeedms * v.airspeedms;               // N/m^2
    var qbarRef = 0.5 * 1.225 * f16Tune.easRef * f16Tune.easRef;         // ref dynamic-pressure

    var inPitch = ctl.pitch;
    var inRoll = ctl.roll;
    var inYaw = ctl.yaw;

    var pMax = lerp(f16Tune.pMaxHigh,
        f16Tune.pMaxLow,
        clamp(1 - v.aoa / f16Tune.alphaWashStart, 0, 1));

    var pCmd = ctl.roll * pMax;          // –pMax ... +pMax  deg/s

    var pDeg = -((v.aroll - (computeControls.rollPrev || v.aroll)) / dt) * 57.2958;
    computeControls.rollPrev = v.aroll;

    var pErr = pCmd - pDeg;
    var dPErr = (pErr - prevPErr) / dt;
    prevPErr = pErr;
    intPErr += pErr * dt;

    var kpP = f16Tune.kpP * gsF;
    var kiP = f16Tune.kiP * gsF;
    var kdP = f16Tune.kdP * gsF;

    if (Math.abs(flapUnsatPrev) > f16Tune.flapDiffMax - 0.5) intPErr -= pErr * dt;

    let flapDiffDeg = kpP * pErr + kiP * intPErr + kdP * dPErr;

    var wash = (v.aoa <= f16Tune.alphaWashStart) ? 1 :
        (v.aoa >= f16Tune.alphaWashEnd) ? 0 :
            1 - (v.aoa - f16Tune.alphaWashStart) /
            (f16Tune.alphaWashEnd - f16Tune.alphaWashStart);

    flapDiffDeg *= wash;      // full authority low-alpha, none above 25deg

    var qRelief = clamp(qbar / 8000, 1, 2);   // heuristic
    flapDiffDeg /= qRelief;

    flapUnsatPrev = flapDiffDeg;
    flapDiffDeg = clamp(flapDiffDeg, -f16Tune.flapDiffMax, f16Tune.flapDiffMax);

    var tailDiffDeg = clamp(flapDiffDeg * 0.25,       // 25 % of flap signal
        -f16Tune.tailDiffMax,
        f16Tune.tailDiffMax);

    var flapNorm = flapDiffDeg / f16Tune.flapDiffMax;
    var tailNorm = tailDiffDeg / f16Tune.tailDiffMax;

    var rudCouple = flapNorm * f16Tune.rudCoupleGain;


    let baseSlat;
    if (v.mach <= 0.6) {
        baseSlat = lerp(f16Tune.slatMach0, f16Tune.slatMach06,
            v.mach / 0.6);
    } else {
        // retract further toward slatMin up to Mach 1.3
        baseSlat = lerp(f16Tune.slatMach06, f16Tune.slatMin,
            clamp((v.mach - 0.6) / 0.7, 0, 1));
    }

    // add extra camber at low Mach proportional to AoA
    var lowMachBoost = (v.mach < 0.6)
        ? f16Tune.slatAlphaGain * v.aoa
        : 0;

    let slatDeg = clamp(baseSlat + lowMachBoost,
        f16Tune.slatMin,
        f16Tune.slatMax);
    var slatNorm = slatDeg / 25;   // assume +/-25deg maps to +/-1 in JSON

    var NzCmd = (inPitch >= 0)
        ? 1 + inPitch * (f16Tune.maxPullG - 1)
        : 1 + inPitch * (1 - f16Tune.maxPushG);

    var gearDown = (v.gearPosition < 0.5);   // true when gear DN
    let stabCmdDeg;

    if (!gearDown || eas > 140) { // if gear up or EAS > 140 m/s

        var stabFF = (NzCmd - 1) * f16Tune.kffNz * (qbarRef / qbar);

        var nzErr = NzCmd - v.loadFactor;
        var dNzErr = (nzErr - prevNzErr) / dt;
        prevNzErr = nzErr;

        var kp = f16Tune.kpNz * gsF;
        var ki = f16Tune.kiNz       // * gsF;
        var kd = f16Tune.kdNz * gsF;

        if (Math.abs(stabUnsatPrev) < f16Tune.stabDeflMax - 0.5) {
            intNzErr += nzErr * dt;
            var intDegLimit = f16Tune.intLim;            // deg worth of I
            intNzErr = clamp(intNzErr, -intDegLimit / ki, intDegLimit / ki);
        }

        stabCmdDeg = stabFF + kp * nzErr + ki * intNzErr + kd * dNzErr;

        var a = v.aoa;
        if (a > f16Tune.alphaBlend) {
            var t = clamp((a - f16Tune.alphaBlend) /
                (f16Tune.alphaMax - f16Tune.alphaBlend), 0, 1);
            var aCmd = Math.sign(inPitch) * f16Tune.alphaMax;
            stabCmdDeg = lerp(stabCmdDeg, kp * (aCmd - a), t);
        }

    } else { // pitch-rate 
        var qDeg = -((v.atilt - (computeControls.pPrev || v.atilt)) / dt) * 57.2958;
        computeControls.pPrev = v.atilt;

        var qCmd = ctl.pitch * f16Tune.qCmdMax;

        var qErr = qCmd - qDeg;
        intQErr += qErr * dt;                     // integrator
        var dQErr = (qErr - prevQErr) / dt;        // derivative
        prevQErr = qErr;

        var intDegLim = 3;
        intQErr = clamp(intQErr,
            -intDegLim / f16Tune.kiQ,
            intDegLim / f16Tune.kiQ);

        var kpQ = f16Tune.kpQ * gsF;
        var kiQ = f16Tune.kiQ * gsF;
        var kdQ = f16Tune.kdQ * gsF;

        stabCmdDeg = kpQ * qErr + kiQ * intQErr + kdQ * dQErr;

        intNzErr = 0;
    }

    stabUnsatPrev = stabCmdDeg;

    var stabNorm = clamp(stabCmdDeg / f16Tune.stabDeflMax, -1, 1);

    v.fbwPitch = stabNorm;
    v.fbwRoll = tailNorm;
    var rDeg = v.aAccZ * 57.2958;             // body yaw-rate ~ aAccZ (deg/s)
    var yawDamper = -f16Tune.krYaw * rDeg;     // P on r  (primary)

    var betaTrim = -f16Tune.kbBeta * v.slipball; // small steady beta correction

    var rudRatio = clamp(f16Tune.rudQRef / qbar,
        f16Tune.rudRatioMin, 1);

    v.fbwYaw = clamp((inYaw          // pilot pedals
        + ((rudCouple    // roll-coupling
        + yawDamper    // r-damper
        + betaTrim)    // residual beta trim
        * rudRatio) * gsF), -1, 1); // scale by dynamic pressure
    v.fbwFlaperons = flapNorm;
    v.fbwSlats = slatNorm;
    var gearExtRatio = clamp(1 - v.gearPosition, 0, 1);   // 0 (up) ... 1 (down)
    v.fbwFlaps = gearExtRatio * f16Tune.flapGearDn;          // e.g. 0 -> +0.45
}

geofs.api.addFrameCallback(computeControls);
setupSurfaces() 