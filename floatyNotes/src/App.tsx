import { useEffect, useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import "./App.css";

type Note = { ts: string; title: string; content: string};

const theme = {
	lbg: "#383938",
	panel: "#1a1a1a",
	sunken: "#161616",
	text: "#eee",
	textDim: "#bbb",
	border: "#222",
	borderHi: "#555",
	primary: "#3b82f6",
	danger: "#ef4444",
	radius: 8,
	gap: 10,
	sidebarW: 300,
	font: "Inter, system-ui, sans-serif",
};

export default function App() {
	const [notes, setNotes] = useState<Note[]>([]);
	const [selected, setSelected] = useState<number | null>(null);
	const [sideBarOpen, setSideBarOpen] = useState(true);
	const [mode, setMode] = useState<"view" | "new">("view");

	const selectedNote = selected !== null ? notes[selected] : null;

	async function refreshNotes() {
		try {
			const data = await invoke<Note[]>("list_notes");
			setNotes(data);
		} catch (e) {
			console.error("Failed to load notes: ", e);
		}
	}

	useEffect(() => {
		refreshNotes();
	}, []);

	return (
		<div style={{position: "relative", height: "100vh"}}>
			<aside style={{transform: sideBarOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 200ms ease", zIndex: 2}}>
				<div style={{display: "grid", gridTemplateColumns: "1fr auto", marginBottom: "12px", rowGap: "0px"}}>
					<h2 style={{marginTop: 0}}>Notes</h2>
					<button style={{justifySelf: "right"}}
					  onClick={() => {setMode("new"); setSideBarOpen(o => !o);}}>
						+ New
					</button>
					<input className="noteSearch" type="search" placeholder="Search" aria-label="Search notes" style={{gridColumn: "1 / -1"}}/>

				</div>
				{notes.length === 0 ? (
					<div style={{ opacity: 0.6 }}>No notes yet</div>
				) : (
					<ul>
							{notes.map((n, i) => (
								<li 
								  key={i} 
								  tabIndex={0} 
								  className={`noteItem ${selected === i ? "selected" : ""}`} 
								  onClick={() => {setSelected(i); setMode("view")}} title={n.title}
								  onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											setSelected(i);
										}
									}}>
									<div style={{marginLeft: "6px"}}>{n.title || "(untitled)"}</div>
								</li>
							))}
						</ul>
				)}
			</aside>
			<main className="mainCard" style={{marginLeft: sideBarOpen ? 260 : 20, transition: "margin-left 200ms ease"}}>
				<button onClick={() => setSideBarOpen(o => !o)} aria-expanded={sideBarOpen} 
				  style={{position: "absolute", top: 10, right: 10, zIndex: 10}}>
					{sideBarOpen ? "Hide" : "Show"} Sidebar
				</button>
				{mode === "new" ? (
					<div style={{display: "grid", gridTemplateColumns: "auto 1fr", marginTop: "24px"}}>
						<input type="text" placeholder="Enter Title..." style={{ gridColumn: "1 / -1", marginBottom: "8px"}}/>
						<textarea placeholder="Enter note..." rows={10} style={{gridColumn: "1 / -1"}}/>
						<button onClick={() => {setMode("view"); setSideBarOpen(o => !o);}}>Cancel</button>
					</div>
				) : (
					selectedNote ? (
						<div style={{ marginLeft: 12}}>
							<div style={{ opacity: 0.7, fontSize: 12}}>{selectedNote.ts}</div>
							<h2 style={{ marginTop: 6}}>{selectedNote.title || "untitled"}</h2>
							<pre style={{ whiteSpace: "pre-wrap", padding: 12, fontFamily: theme.font, fontSize: 14}}>
								{selectedNote.content}
							</pre>
						</div>
					) : (
					<div style={{ opacity: 0.6}}>Select a note from the left</div>
				))}
			</main>
		</div>
	)
}
