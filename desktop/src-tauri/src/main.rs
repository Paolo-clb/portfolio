// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Desktop binary: just call into the shared library (which mobile uses too).
fn main() {
    light_again_lib::run()
}
