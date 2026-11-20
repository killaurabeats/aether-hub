#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if std::env::args().any(|arg| arg == "--print-machine-id") {
        println!("{}", aether_hub_lib::machine_id_string());
        return;
    }

    aether_hub_lib::run()
}
