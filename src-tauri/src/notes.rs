use serde::{Deserialize, Serialize};
use std::{fs, vec};
use std::fs::{File, OpenOptions};
use std::io::{self, BufRead, BufReader, Write};
use std::path::PathBuf;

// -----Note Structure -----
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub ts: String,
    pub title: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSettings {
    pub open_same: bool,
    pub key_cmd: String,
}

// -----Function to get to the notes file -----
fn notes_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("notes.jsonl")
}

fn settings_path() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")).join("user_settings.json")
}

// -----Public function to Atomic Rewrite for editing a note and deleting a note from the list-----
pub fn rewrite_all(notes: &[Note]) -> io::Result<()> {
    let path = notes_path();
    let tmp = path.with_extension("jsonl.tmp");
    {
        let mut f = File::create(&tmp)?; //truncates tmp if exists
        for n in notes {
            serde_json::to_writer(&mut f, n)?;
            f.write_all(b"\n")?;
        }
        f.flush()?; //ensure data is on disk before rename
    }

    //atomic write, replaces current saved file with tmp
    fs::rename(tmp, path)?;
    Ok(())
}

// -----Function to genereate a timestamp using the current local time, standard formatting -----
pub fn now_string() -> String {
    use chrono::Local;
    Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

pub fn save_settings(usr_settings: &UserSettings) -> io::Result<()> {
    let path = settings_path();
    let mut config_file = OpenOptions::new().create(true).write(true).truncate(true).open(path)?;
    { // serde_json writer for user_settings.json
        serde_json::to_writer(&mut config_file, &usr_settings)?;
        config_file.write_all(b"\n")?;
        config_file.flush()?;
    }
    Ok(())
}

pub fn load_settings() -> io::Result<UserSettings> {
    let path = settings_path();
    let config = match File::open(path) {
        Ok(f) => f,
        Err(e) if e.kind() == io::ErrorKind::NotFound => { return Ok(UserSettings {
            open_same: false,
            key_cmd: "cmd+n".to_string(),
            });
        }
        Err(e) => return Err(e),
    };

    let reader = BufReader::new(config);
    match serde_json::from_reader(reader) {
        Ok(settings) => Ok(settings),
        Err(err) => {
            eprintln!("settings file invalid, using defaults: {err}");
            Ok(UserSettings {
                open_same: false,
                key_cmd: "cmd+n".to_string(),
            })
        }
    }
}

// ----- Public Function to add a note to the File -----
pub fn append_note(title: &str, content: &str) -> io::Result<()> {
    // n: &Note borrows the struct, no copy/mutability
    let note = Note {
        ts: now_string(),
        title: title.to_string(),
        content: content.to_string(),
    };
    let path = notes_path();
    let mut file = OpenOptions::new().create(true).append(true).open(path)?; // the ? is err handle
    serde_json::to_writer(&file, &note)?;
    file.write_all(b"\n")?;
    Ok(())
}

// ----- Public function to load notes form file -----
pub fn load_notes() -> io::Result<Vec<Note>> {
    let path = notes_path();
    let file = match File::open(path) {
        Ok(f) => f,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e),
    };

    let reader = BufReader::new(file);
    let mut out = Vec::new();

    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<Note>(&line) {
            Ok(n) => out.push(n),
            Err(err) => {
                eprintln!("Skipping bad line: {err}");
            }
        }
    }
    Ok(out)
}
// thought this was going to be useful but i just put the delete in the main instead lol, its the same logic in both spots
/* pub fn delete_note(notes: &mut [Note], index: usize) -> io::Result<()> {
    let mut notes = load_notes()?;
    notes.remove(index);
    Ok(())
} */