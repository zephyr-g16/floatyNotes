// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod notes;
use notes::{append_note, now_string, load_notes, rewrite_all, save_settings, load_settings, Note, UserSettings};
use tauri::{Manager, Emitter};
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};
use tauri::webview::{WebviewWindowBuilder};

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

#[tauri::command]
fn get_config() -> UserSettings {
    notes::load_settings().unwrap_or(UserSettings { open_same: false, key_cmd: "CommandOrControl+N".into(),})
}

#[tauri::command]
fn set_config(config: UserSettings) -> Result<(),String> {
    notes::save_settings(&config).map_err(|e| e.to_string())
}

#[tauri::command]
async fn close_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.close();
    }
    return;
}

#[tauri::command]
async fn min_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.minimize();
    }
    return;
}

#[tauri::command]
async fn fullscreen_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let max = win.is_maximized().unwrap_or(false);
        if (!max) {
            let _ = win.set_fullscreen(true);
        } else {
            let _ = win.set_fullscreen(false);
        }
    } 
    return;
}

#[tauri::command]
async fn max_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.maximize();
    }
}

#[tauri::command]
async fn open_prompt_window(app: tauri::AppHandle) {
    //section here is to check if the window is made, and focused, and if not it decides to either close it if it is focused, or show it if it isnt focused, 
    //or it moves on the the window builder to make it if it doesnt exist
    if let Some(win) = app.get_webview_window("prompt") {
        let visible = win.is_visible().unwrap_or(false);
        let focused = win.is_focused().unwrap_or(false);
        if visible && focused {
            let _ = win.hide();
        } else if visible && !focused {
            let _ = win.set_focus();
            if let Some(main) = app.get_webview_window("main") {
                let main_focused = main.is_minimized().unwrap_or(true);
                if !main_focused {
                    let _ = main.minimize();
                }
            }
        } else {
            let _ = win.show();
            let _ = win.set_focus();
            if let Some(main) = app.get_webview_window("main") {
                let main_focused = main.is_minimized().unwrap_or(true);
                if !main_focused {
                    let _ = main.minimize();
                }
            }
        }
        return;
    }
    
    let _ = tauri::webview::WebviewWindowBuilder::new(
        &app, "prompt", tauri::WebviewUrl::App("index.html#prompt".into()),
    )
    .title("").always_on_top(true).decorations(false).inner_size(500.0, 600.0).build();
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                    .with_shortcuts(["alt+n"])?
                    .with_handler(|app, shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            if shortcut.matches(Modifiers::ALT, Code::KeyN) {
                                let _ = app.emit("shortcut-event", "Alt+n triggered");
                            }
                        }
                    })
                    .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![list_notes, add_note, edit_note, delete_note, set_config, get_config, open_prompt_window, close_window, min_window, fullscreen_window, max_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
