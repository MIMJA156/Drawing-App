// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::File;
use std::io::prelude::*;
use std::{collections::HashMap, io::Write};

use tauri::{CustomMenuItem, Menu, Submenu};

#[derive(Clone, serde::Serialize)]
struct Payload {
    message: String,
}

#[tauri::command]
async fn save_canvas_state(given_value: HashMap<i32, String>) {
    let mut sorted_given_value: Vec<_> = given_value.iter().collect();
    sorted_given_value.sort_by(|a, b| a.cmp(b));

    let mut file = File::create("./../output.txt").expect("Could not create file!");

    println!("saving...");

    for (k, x) in &sorted_given_value {
        write!(file, "{}:{} ", k, x).expect("Unable to write to file!");
    }
}

#[tauri::command]
async fn load_canvas_state(path: String) -> HashMap<i32, String> {
    let mut file = File::open(path).expect("Can't Open File!");
    let mut contents = String::new();

    file.read_to_string(&mut contents)
        .expect("Can't Read File!");

    let data_to_send: HashMap<i32, String> = contents
        .split_whitespace()
        .map(|s| s.split_at(s.find(":").unwrap()))
        .map(|(key, val)| (key, &val[1..]))
        .map(|(key, val)| (key.parse().unwrap(), val.parse().unwrap()))
        .collect();

    return data_to_send;
}

fn main() {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let save = CustomMenuItem::new("save".to_string(), "Save");
    let load = CustomMenuItem::new("load".to_string(), "Load");

    let submenu = Submenu::new(
        "File",
        Menu::new().add_item(save).add_item(load).add_item(quit),
    );
    let menu = Menu::new().add_submenu(submenu);

    tauri::Builder::default()
        .menu(menu)
        .invoke_handler(tauri::generate_handler![
            save_canvas_state,
            load_canvas_state
        ])
        .on_menu_event(|event| match event.menu_item_id() {
            "quit" => {
                std::process::exit(0);
            }

            "save" => {
                event.window().emit("save", 0).unwrap();
            }

            "load" => {
                event.window().emit("load", 0).unwrap();
            }

            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
