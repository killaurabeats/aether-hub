fn main() {
    println!("cargo:rerun-if-changed=vendor/monocypher/monocypher.c");
    println!("cargo:rerun-if-changed=vendor/monocypher/monocypher.h");

    cc::Build::new()
        .file("vendor/monocypher/monocypher.c")
        .include("vendor/monocypher")
        .warnings(false)
        .compile("monocypher");

    tauri_build::build()
}
