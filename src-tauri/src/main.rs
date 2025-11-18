// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod notes;
use notes::{append_note, now_string, load_notes, rewrite_all, Note};

#[tauri::command]
fn list_notes() -> Result<Vec<Note>, String> {
    load_notes().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_note(title: String, content: String) -> Result<(), String> {
    append_note(&title, &content).map_err(|e| e.to_string())
}

#[tauri::command]
fn edit_note(index: usize, title: String, content: String) -> Result<(), String> {
    let mut notes = load_notes().map_err(|e| e.to_string())?;
    if index >= notes.len() {
        return Err("Index out of range".into());
    }

    if (title.is_empty() && content.is_empty()) {
        delete_note(index)?;
        return Ok(());
    }

    let current_title = &notes[index].title;
    let current_content = &notes[index].content;
    if (&current_title.as_str() == &title.as_str() && &current_content.as_str() == &content.as_str()) {return Ok(())}
    notes[index].title = title;
    notes[index].content = content;
    notes[index].ts = now_string();
    rewrite_all(&notes).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_note(index: usize) -> Result<(), String> {
    let mut notes = load_notes().map_err(|e| e.to_string())?;
    notes.remove(index);
    rewrite_all(&notes).map_err(|e| e.to_string())?;
    Ok(())
}

/* #[tauri::command]
fn save_settings(settings: &str) -> Result<(), String> {
    save_settings(&settings)?;
    Ok(())
} */

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_notes, add_note, edit_note, delete_note])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
