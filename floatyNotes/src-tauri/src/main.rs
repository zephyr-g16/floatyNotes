// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod notes;
use notes::{append_note, load_notes, rewrite_all, Note};

#[tauri::command]
fn list_notes() -> Result<Vec<Note>, String> {
    load_notes().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_note(title: String, content: String) -> Result<(), String> {
    append_note(&title, &content).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_notes, add_note])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
