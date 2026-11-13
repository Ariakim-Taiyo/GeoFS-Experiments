/* DEVELOPER NOTES AS OF 11/12/2026:
I believe this was one of the early cinematic camera scripts I used in making the L1011 trailer video. 
In the XCub video, I used an updated version that I can't find for some reason.
*/

var camPointsArr = [];
var isActive = false;
var camRefreshRate = 10;
flight.recorder.period = 20;

var tickCamInt = setInterval(function() {
    if (flight.recorder.tape.length < 10) {
        camPointsArr = [];
    }
    if (isActive) {
        evalCam();
    }
}, camRefreshRate);

function toggleActive() {
    if (!isActive) {
        geofs.camera.set(4)
        isActive = true;
    } else {
        geofs.camera.set(5)
        isActive = false;
    }
}

function saveCurrentPoint() {
    var step = flight.recorder.currentStep;
    var lla = geofs.camera.lla;
    var htr = geofs.camera.htr;
    var camPointObj = {
        step: step,
        loc: lla,
        or: htr,
        camStep: flight.recorder.tape[step].cm
    };

    var insertIndex = camPointsArr.findIndex(camPoint => camPoint.step > step);

    if (insertIndex === -1) {
        camPointsArr.push(camPointObj);
    } else {
        camPointsArr.splice(insertIndex, 0, camPointObj);
    }
}

function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
}

function smoothInterpolation(currentStep, nextStep, currentValue) {
    const t = (currentValue - currentStep) / (nextStep - currentStep);
    const clampedT = Math.min(Math.max(t, 0), 1);
    return easeInOutSine(clampedT);
}

function getSpline() {
    var llaArr = [];
    var timeArr = [];
    camPointsArr.forEach(function(point) {
        timeArr.push(point.step); //step
        llaArr = llaArr.concat(point.loc)
    })
    var spline = new Cesium.CatmullRomSpline({
        times: timeArr,
        points: Cesium.Cartesian3.fromDegreesArrayHeights(llaArr)
      });
    return spline;
}

function evalCam() {
    var step = flight.recorder.currentStep;
    if (step == 0) return;
    if (camPointsArr[camPointsArr.length - 1].step <= step) return;
    var currentStepObj = {};
    var nextStepObj = {};
    for (const camPoint of camPointsArr) {
        if (camPoint.step < step) {
            currentStepObj = camPoint;
        } else {
            nextStepObj = camPoint;
            break;
        }
    }

    var spline = getSpline();
    var posAtStep = spline.evaluate(step);
    var intLLACF = Cesium.Cartographic.fromCartesian(posAtStep);
    var intLLA = [
        Cesium.Math.toDegrees(intLLACF.longitude),
        Cesium.Math.toDegrees(intLLACF.latitude),
        intLLACF.height
    ]
    var mixFactor = (step - currentStepObj.step) / (nextStepObj.step - currentStepObj.step)//smoothInterpolation(currentStepObj.camStep, nextStepObj.camStep, playbackTick);
    var startQuat = Cesium.Quaternion.fromHeadingPitchRoll(
        Cesium.HeadingPitchRoll.fromDegrees(
            currentStepObj.or[0], 
            currentStepObj.or[1], 
            currentStepObj.or[2], 
            new Cesium.HeadingPitchRoll
        ), 
        new Cesium.Quaternion
    );

    var endQuat = Cesium.Quaternion.fromHeadingPitchRoll(
        Cesium.HeadingPitchRoll.fromDegrees(
            nextStepObj.or[0], 
            nextStepObj.or[1], 
            nextStepObj.or[2], 
            new Cesium.HeadingPitchRoll
        ), 
        new Cesium.Quaternion
    );
    var intQuat = Cesium.Quaternion.fastSlerp(startQuat, endQuat, mixFactor, new Cesium.Quaternion);
    var intHTRCF = Cesium.HeadingPitchRoll.fromQuaternion(intQuat, new Cesium.HeadingPitchRoll);
    var intHTR = [
        fixAngle360(Cesium.Math.toDegrees(intHTRCF.heading)),
        fixAngle360(Cesium.Math.toDegrees(intHTRCF.pitch)),
        fixAngle360(Cesium.Math.toDegrees(intHTRCF.roll))
    ]
    geofs.api.setCameraPositionAndOrientation(geofs.camera.cam, intLLA, intHTR);
}
//flight.recorder.clear()