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
async fn save_canvas_state_as(window: tauri::Window, given_value: String, given_path: String) {
    let mut file = File::create(given_path).expect("Could not create file!");
    write!(file, "{}", given_value).expect("Unable to write to file!");

    let menu_handle = window.menu_handle();
    menu_handle
        .get_item("save")
        .set_enabled(true)
        .expect("Error Setting Menu Item Enabled!");
    menu_handle
        .get_item("load")
        .set_enabled(true)
        .expect("Error Setting Menu Item Enabled!");
}

#[tauri::command]
async fn load_canvas_state_from(window: tauri::Window, given_path: String) -> String {
    let mut file = File::open(given_path).expect("Can't Open File!");
    let mut contents = String::new();

    file.read_to_string(&mut contents)
        .expect("Can't Read File!");

    let menu_handle = window.menu_handle();
    menu_handle
        .get_item("save")
        .set_enabled(true)
        .expect("Error Setting Menu Item Enabled!");
    menu_handle
        .get_item("load")
        .set_enabled(true)
        .expect("Error Setting Menu Item Enabled!");

    return contents;
}

fn main() {
    let quit = CustomMenuItem::new("quit", "Quit");
    let save_as = CustomMenuItem::new("save-as", "Save As");
    let load_from = CustomMenuItem::new("load-from", "Load From");

    let save = CustomMenuItem::new("save", "Save").disabled();
    let load = CustomMenuItem::new("load", "Load").disabled();

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

    let draw = CustomMenuItem::new("pen", "Pen").selected();
    let erase = CustomMenuItem::new("eraser", "Eraser");

    let tools_submenu = Submenu::new("Tools", Menu::new().add_item(draw).add_item(erase));

    let clear = CustomMenuItem::new("clear", "Clear All");
    let undo = CustomMenuItem::new("undo", "Undo");
    let redo = CustomMenuItem::new("redo", "Redo");

    let action_submenu = Submenu::new(
        "Actions",
        Menu::new()
            .add_item(clear)
            .add_native_item(tauri::MenuItem::Separator)
            .add_item(undo)
            .add_item(redo),
    );

    let pencil_size = CustomMenuItem::new("pencil-size", "Line Size");

    let settings_submenu = Submenu::new("Settings", Menu::new().add_item(pencil_size));

    let menu: Menu = Menu::new()
        .add_submenu(file_submenu)
        .add_submenu(tools_submenu)
        .add_submenu(action_submenu)
        .add_submenu(settings_submenu);

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
            "load-from" => event.window().emit("load-from", 0).unwrap(),

            "clear" => event.window().emit("clear", 0).unwrap(),
            "undo" => event.window().emit("undo", 0).unwrap(),
            "redo" => event.window().emit("redo", 0).unwrap(),
            "pencil-size" => event.window().emit("pencil-size", 0).unwrap(),

            "pen" => {
                let menu_handle = event.window().menu_handle();
                menu_handle
                    .get_item("pen")
                    .set_selected(true)
                    .expect("Error Setting Menu Item Selected!");
                menu_handle
                    .get_item("eraser")
                    .set_selected(false)
                    .expect("Error Setting Menu Item Selected!");

                event.window().emit("tool-change", 0).unwrap();
            }

            "eraser" => {
                let menu_handle = event.window().menu_handle();
                menu_handle
                    .get_item("pen")
                    .set_selected(false)
                    .expect("Error Setting Menu Item Selected!");
                menu_handle
                    .get_item("eraser")
                    .set_selected(true)
                    .expect("Error Setting Menu Item Selected!");

                event.window().emit("tool-change", 1).unwrap();
            }

            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
