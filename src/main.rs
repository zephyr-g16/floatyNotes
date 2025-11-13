use serde::{Deserialize, Serialize};
use std::fs;
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

struct App {
    notes: Vec<Note>,
    loaded: bool,
}

impl App {
    fn new() -> Self {
        Self {
            notes: Vec::new(),
            loaded: false,
        }
    }
    fn ensure_loaded(&mut self) -> io::Result<()> {
        if !self.loaded {
            self.notes = load_notes()?;
            self.loaded = true;
        }
        Ok(())
    }
    fn invalidate(&mut self) {
        self.notes.clear();
        self.loaded = false;
    }
}

// -----Function to get to the notes file -----
fn notes_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("notes.jsonl")
}

// -----Atomic Rewrite for editing a note and deleting a note from the list-----
fn rewrite_all(notes: &[Note]) -> io::Result<()> {
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
fn now_string() -> String {
    use chrono::Local;
    Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

// -----Generic confirmation prompting code since i use it in many places -----
fn confirm_prompt(label: &str) -> io::Result<String> {
    print!("{label}");
    io::stdout().flush()?;
    let mut s = String::new();
    io::stdin().read_line(&mut s)?;
    Ok(s.trim_end().to_lowercase().to_string())
}

fn read_multiline(end_marker: &str) -> io::Result<String> {
    print!("A line with only {} will end input mode: ", end_marker);
    io::stdout().flush()?;
    let mut out = String::new();
    let mut first = true;
    loop {
        let mut line = String::new();
        io::stdin().read_line(&mut line)?;
        let l = line.trim_end_matches(['\r', '\n']);
        if l == end_marker {
            break;
        }
        if !first {
            out.push('\n');
        }
        out.push_str(l);
        first = false;
    }
    Ok(out)
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
    let mut app = App::new();

    loop {
        input.clear();
        println!("Pick an option: add | list | open | search | delete | clear | quit ");
        io::stdout().flush()?;
        io::stdin().read_line(&mut input)?;

        let line = input.trim();
        if line == "quit" {
            break;
        }

        let mut parts = line.splitn(2, ' ');
        let cmd = parts.next().unwrap_or("");
        let arg = parts.next().unwrap_or("");

        match cmd {
            "add" => cmd_add(&mut app)?,
            "list" => cmd_list(&mut app, arg)?,
            "open" => cmd_open(&mut app, arg)?,
            "search" => cmd_search(&mut app)?,
            "delete" => cmd_delete(&mut app, arg)?,
            "clear" => cmd_clear(&mut app)?,
            "" => {}
            other => {
                println!("Unknown command, {other}, please try again...",);
            }
        }
    }
    Ok(())
}

fn cmd_add(app: &mut App) -> io::Result<()> {
    let mut title = String::new();
    let mut content = String::new();

    print!("Enter note title: ");
    io::stdout().flush()?;
    io::stdin().read_line(&mut title)?;
    let title = title.trim_end().to_string();

    println!("Enter Note ----------");
    let buf = read_multiline(".")?;
    if !buf.is_empty() {
        content = buf;
    }
    let n = Note {
        ts: now_string(),
        title,
        content,
    };
    append_note(&n)?;
    if app.loaded {
        app.notes.push(n)
    }
    println!("Saved.");
    Ok(())
}

fn preview_line(s: &String) -> String {
    let preview = s.lines().next().unwrap_or("");
    if preview.len() > 60 {
        let mut cut = preview.to_string();
        cut.truncate(57);
        cut.push_str("...");
        cut
    } else {
        preview.to_string()
    }
}

fn cmd_list(app: &mut App, arg: &str) -> io::Result<()> {
    app.ensure_loaded()?;
    let nts = &app.notes;

    let n: usize = if arg.is_empty() {
        5
    } else {
        arg.parse().unwrap_or(5)
    };
    if nts.is_empty() {
        println!("No notes yet...");
        return Ok(());
    }

    let show = nts.len().saturating_sub(n);
    for (i, note) in nts.iter().enumerate().skip(show) {
        println!(
            "{:>2} | {} | {} - {}",
            i + 1,
            note.ts,
            note.title,
            preview_line(&note.content)
        );
    }
    println!("Type `open <index> to view full note \n");
    Ok(())
}

fn cmd_open(app: &mut App, arg: &str) -> io::Result<()> {
    app.ensure_loaded()?;
    if arg.is_empty() {
        println!("Usage: open <index>\n");
        return Ok(());
    }
    let idx: usize = match arg.parse() {
        Ok(v) => v,
        Err(_) => {
            println!("Invalid index\n");
            return Ok(());
        }
    };
    if idx == 0 || idx > app.notes.len() {
        println!("Index out of range\n");
        return Ok(());
    }
    let n = &app.notes[idx - 1];
    println!(
        "== Note {} - {}\n--------------------\n{}\n",
        idx, n.title, n.content
    );

    let prompt = "Would you like to edit or delete this note? (enter choice): ";
    let confirm_str = confirm_prompt(prompt)?;
    match confirm_str.as_str() {
        "edit" => {
            cmd_edit(app, idx)?;
            return Ok(());
        }
        "delete" => {
            cmd_delete(app, arg)?;
            return Ok(());
        }
        _ => {
            println!("Note {} unmodified", idx);
            return Ok(());
        }
    }
}

fn cmd_clear(app: &mut App) -> io::Result<()> {
    let path = notes_path();
    std::fs::File::create(path)?;
    app.notes.clear();
    app.loaded = true;
    println!("Cleared notes");
    Ok(())
}

fn cmd_search(app: &mut App) -> io::Result<()> {
    app.ensure_loaded()?;
    if app.notes.is_empty() {
        println!("No notes to search\n");
        return Ok(());
    }
    print!("Enter term to search for: ");
    io::stdout().flush()?;
    let mut term = String::new();
    io::stdin().read_line(&mut term)?;
    let term = term.trim().to_lowercase();
    if term.is_empty() {
        println!("No term entered\n");
        return Ok(());
    }

    let mut hits = 0usize;
    for (i, n) in app.notes.iter().enumerate() {
        let hay = format!("{} {}\n{}", n.title, n.ts, n.content).to_lowercase();
        if hay.contains(&term) {
            println!(
                "{:>2} | {} | {} - {}",
                i + 1,
                n.ts,
                n.title,
                preview_line(&n.content)
            );
            hits += 1;
        }
    }
    if hits == 0 {
        println!("No matches");
    }
    Ok(())
}

fn cmd_delete(app: &mut App, arg: &str) -> io::Result<()> {
    app.ensure_loaded()?;

    if arg.is_empty() {
        println!("Usage: delete <index>");
        return Ok(());
    }

    let idx: usize = match arg.parse() {
        Ok(v) => v,
        Err(_) => {
            println!("Invalid index");
            return Ok(());
        }
    };
    if idx == 0 || idx > app.notes.len() {
        println!("Index out of range \n");
        return Ok(());
    }

    let n = &app.notes[idx - 1];
    println!(
        "Delete note {} | {} - {} ?",
        idx,
        n.title,
        preview_line(&n.content)
    );
    let confirm = confirm_prompt("(y/n): ")?;
    if !matches!(confirm.as_str(), "y" | "yes") {
        println!("Cancelled");
        return Ok(());
    }

    app.notes.remove(idx - 1);
    rewrite_all(&app.notes)?;
    println!("Deleted");
    Ok(())
}

fn cmd_edit(app: &mut App, idx1: usize) -> io::Result<()> {
    app.ensure_loaded()?;
    if idx1 == 0 || idx1 > app.notes.len() {
        println!("index out of range");
        return Ok(());
    }
    let n = &mut app.notes[idx1 - 1];

    println!("Current title: {}", n.title);
    let new_title = confirm_prompt("Enter new title (Leave empty to keep current): ")?;
    if !new_title.is_empty() {
        n.title = new_title;
    }

    let conf_edit = confirm_prompt("Would you like to change content? (y/n): ")?;
    if matches!(conf_edit.as_str(), "y" | "yes") {
        let buf = read_multiline(".")?;
        if !buf.is_empty() {
            n.content = buf;
        }
        n.ts = now_string();

        rewrite_all(&app.notes)?;
        println!("Updated.");
        return Ok(());
    }
    Ok(())
}
