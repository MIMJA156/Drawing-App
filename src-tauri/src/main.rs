// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::File;
use std::io::prelude::*;

use tauri::{CustomMenuItem, Menu, Submenu};

#[derive(Clone, serde::Serialize)]
struct Payload {
    message: String,
}

#[tauri::command]
async fn save_canvas_state_as(given_value: String, given_path: String) {
    let mut file = File::create(given_path).expect("Could not create file!");
    write!(file, "{}", given_value).expect("Unable to write to file!");
}

#[tauri::command]
async fn load_canvas_state_from(given_path: String) -> String {
    let mut file = File::open(given_path).expect("Can't Open File!");
    let mut contents = String::new();

    file.read_to_string(&mut contents)
        .expect("Can't Read File!");

    return contents;
}

fn main() {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let save_as = CustomMenuItem::new("save-as".to_string(), "Save As");
    let load_from = CustomMenuItem::new("load-from".to_string(), "Load From");

    let save = CustomMenuItem::new("save".to_string(), "Save").disabled();
    let load = CustomMenuItem::new("load".to_string(), "Load").disabled();

    let file_submenu = Submenu::new(
        "File",
        Menu::new()
            .add_item(save)
            .add_item(load)
            .add_native_item(tauri::MenuItem::Separator)
            .add_item(save_as)
            .add_item(load_from)
            .add_native_item(tauri::MenuItem::Separator)
            .add_item(quit),
    );

    let draw = CustomMenuItem::new("pen".to_string(), "Pen");
    let erase = CustomMenuItem::new("eraser".to_string(), "Eraser");

    let tools_submenu = Submenu::new("Tools", Menu::new().add_item(draw).add_item(erase));

    let clear = CustomMenuItem::new("clear".to_string(), "Clear All");
    let action_submenu = Submenu::new("Actions", Menu::new().add_item(clear));

    let menu: Menu = Menu::new()
        .add_submenu(file_submenu)
        .add_submenu(tools_submenu)
        .add_submenu(action_submenu);

    tauri::Builder::default()
        .menu(menu)
        .invoke_handler(tauri::generate_handler![
            save_canvas_state_as,
            load_canvas_state_from
        ])
        .on_menu_event(|event| match event.menu_item_id() {
            "quit" => { /* std::process::exit(0); */ }

            "save" => event.window().emit("save", 0).unwrap(),
            "load" => event.window().emit("load", 0).unwrap(),

            "save-as" => event.window().emit("save-as", 0).unwrap(),
            "load-from" => {
                event.window().emit("load-from", 0).unwrap();

                let main_window = event.window();
                let menu_handle = main_window.menu_handle();
                std::thread::spawn(move || {
                    // you can also `set_selected`, `set_enabled` and `set_native_image` (macOS only).
                    menu_handle
                        .get_item("save")
                        .set_enabled(true)
                        .expect("Error Updating Items!");

                    menu_handle
                        .get_item("load")
                        .set_enabled(true)
                        .expect("Error Updating Items!");
                });
            }

            "clear" => event.window().emit("clear", 0).unwrap(),

            "pen" => event.window().emit("tool-change", 0).unwrap(),
            "eraser" => event.window().emit("tool-change", 1).unwrap(),

            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
