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
async fn save_canvas_state(given_value: String) {
    let mut file = File::create("./../output.txt").expect("Could not create file!");
    write!(file, "{}", given_value).expect("Unable to write to file!");
}

#[tauri::command]
async fn load_canvas_state(path: String) -> String {
    let mut file = File::open(path).expect("Can't Open File!");
    let mut contents = String::new();

    file.read_to_string(&mut contents)
        .expect("Can't Read File!");

    return contents;
}

fn main() {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let save = CustomMenuItem::new("save".to_string(), "Save");
    let load = CustomMenuItem::new("load".to_string(), "Load");

    let file_submenu = Submenu::new(
        "File",
        Menu::new().add_item(save).add_item(load).add_item(quit),
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
            save_canvas_state,
            load_canvas_state
        ])
        .on_menu_event(|event| match event.menu_item_id() {
            "quit" => { /* std::process::exit(0); */ }

            "save" => event.window().emit("save", 0).unwrap(),
            "load" => event.window().emit("load", 0).unwrap(),
            "clear" => event.window().emit("clear", 0).unwrap(),

            "pen" => event.window().emit("tool-change", 0).unwrap(),
            "eraser" => event.window().emit("tool-change", 1).unwrap(),

            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
