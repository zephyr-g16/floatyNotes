use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{self, BufRead, BufReader, Write};
use std::path::PathBuf;

// -----Note Structure -----
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Note {
    ts: String,
    title: String,
    content: String,
}

// -----Function to get to the notes file -----
fn notes_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("notes.jsonl")
}

// -----Function to genereate a timestamp using the current local time, standard formatting -----
fn now_string() -> String {
    use chrono::Local;
    Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

// ----- Function to add a note to the File -----
fn append_note(n: &Note) -> io::Result<()> {
    // n: &Note borrows the struct, no copy/mutability
    let path = notes_path();
    let mut file = OpenOptions::new().create(true).append(true).open(path)?; // the ? is err handle
    serde_json::to_writer(&mut file, n)?;
    file.write_all(b"\n")?;
    Ok(())
}

fn load_notes() -> io::Result<Vec<Note>> {
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

fn main() -> io::Result<()> {
    let mut input = String::new();

    loop {
        input.clear();
        println!("Pick an option: add | list | quit ");
        io::stdout().flush()?;
        io::stdin().read_line(&mut input)?;

        let cmd = input.trim();
        match cmd {
            "add" => cmd_add()?,
            "list" => cmd_list()?,
            "quit" => break,
            other => {
                println!("Unknown command, {other}, please try again...",);
            }
        }
    }
    Ok(())
}

fn cmd_add() -> io::Result<()> {
    let mut title = String::new();
    let mut content = String::new();

    print!("Enter note title: ");
    io::stdout().flush()?;
    io::stdin().read_line(&mut title)?;
    let title = title.trim_end().to_string();

    println!("Enter Note (A single '.' on its own ends the note): ");
    loop {
        let mut line = String::new();
        io::stdin().read_line(&mut line)?;
        let l = line.trim_end_matches(['\r', '\n']);
        if l == "." {
            break;
        }
        if !content.is_empty() {
            content.push('\n');
        }
        content.push_str(l);
    }

    let n = Note {
        ts: now_string(),
        title,
        content,
    };
    append_note(&n)?;
    println!("Saved.");
    Ok(())
}

fn cmd_list() -> io::Result<()> {
    let notes = load_notes()?;
    if notes.is_empty() {
        println!("No Notes.");
        return Ok(());
    }

    let show = notes.len().saturating_sub(5);
    for (i, n) in notes.iter().enumerate().skip(show) {
        let mut preview = n.content.lines().next().unwrap_or("").to_string();
        if preview.len() > 60 {
            preview.truncate(57);
            preview.push_str("...");
        }
        println!("{:>2} | {} | {} - {}", i + 1, n.ts, n.title, preview);
    }
    println!("Type `open <index> to view full note \n");
    Ok(())
}
