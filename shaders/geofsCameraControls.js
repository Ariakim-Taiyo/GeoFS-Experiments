/* DEVELOPER NOTES AS OF 11/12/2026:
I think this was some sort of cockpit camera improvement addon.
*/

//Angular Velocity Rotation Calculations by Ariakim
// Customisation
let mouseDownOrientation = [0.0, 0.0, 0.0];
let max_horizon_alignment_rot = 25;
let horizion_alignment_offset_multiplier = -0.75;
let horizon_alignement_lerp_alpha = 0.1;
let in_game_g_force_motion_sensitivity = 0.3;
let angular_scale = 10.0;
let horizon_roll_override_multiplier = 0.5;
let stop_on_mouse_down = true;
// X = Pitch
// Y = Roll
// Z = Yaw
function calcVectorAdjustments(scale) {
    return V3.scale(M33.multiplyV((geofs.aircraft.instance.object3d.getRotation()), geofs.aircraft.instance.rigidBody.v_angularVelocity), scale);
}


function apply_camera_rotation(rot, speed) { 
    if (controls.mouse.down) {
        mouseDownOrientation = geofs.camera.currentDefinition.orientations.current;
        if (stop_on_mouse_down) return;
    }
    var newRot = calcVectorAdjustments(angular_scale);
    rot /= horizon_roll_override_multiplier * (Math.abs(newRot[1]) + 1.0);
    var finRotX = geofs.perlin.lerp(mouseDownOrientation[0], -newRot[2], speed);
    var finRotY = geofs.perlin.lerp(mouseDownOrientation[1], -newRot[0], speed);
    var finRotZ = geofs.perlin.lerp(0.0, newRot[1] + rot, speed);
    geofs.camera.setRotation(finRotX, finRotY, finRotZ); 
    // X +R
    // Y +U
    // Z +L
}

function calculate_horizon_alignment_rot() {
    
    if (geofs.camera.currentDefinition.name == "cockpit") {
        var aroll = geofs.animation.values.aroll;
        apply_camera_rotation(clamp(aroll, -max_horizon_alignment_rot, max_horizon_alignment_rot) * horizion_alignment_offset_multiplier, horizon_alignement_lerp_alpha);
    }
}

geofs.aircraft.instance.definition.motionSensitivity = in_game_g_force_motion_sensitivity;
geofs.api.viewer.scene.preRender.addEventListener(function() {
    calculate_horizon_alignment_rot();
});