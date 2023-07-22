// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{CustomMenuItem, Manager, Menu, Submenu};

#[derive(Clone, serde::Serialize)]
struct Payload {
    message: String,
}

fn main() {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let save = CustomMenuItem::new("save".to_string(), "Save");

    let submenu = Submenu::new("File", Menu::new().add_item(save).add_item(quit));
    let menu = Menu::new().add_submenu(submenu);

    tauri::Builder::default()
        .menu(menu)
        .on_menu_event(|event| match event.menu_item_id() {
            "quit" => {
                std::process::exit(0);
            }

            "save" => {
                event.window().emit("save", 0).unwrap();
            }

            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
