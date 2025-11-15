import { useEffect, useState, useRef} from "react";
import {invoke} from "@tauri-apps/api/core";
import "./App.css";

type Note = { ts: string; title: string; content: string};

export default function App() {
	const titleRef = useRef<HTMLInputElement | null>(null);
	const contentRef = useRef<HTMLTextAreaElement | null>(null);
	const [notes, setNotes] = useState<Note[]>([]);
	const [selected, setSelected] = useState<number | null>(null);
	const [sideBarOpen, setSideBarOpen] = useState(true);
	const [mode, setMode] = useState<"view" | "new">("view");
	const [draftTitle, setDraftTitle] = useState("");
	const [draftContent, setDraftContent] = useState("");
	const [draftNoteIndex, setDraftIndex] = useState<number | null>(null);
	const [lastFocused, setLastFocused] = useState<"title" | "content" | null>(null);
	const selectedNote = selected !== null ? notes[selected] : null;
	const [searchTerm, setSearchTerm] = useState("");

	async function refreshNotes() {
		try {
			const data = await invoke<Note[]>("list_notes");
			setNotes(data);
		} catch (e) {
			console.error("Failed to load notes: ", e);
		}
	}

	async function saveNote() {
		const title = draftTitle.trim();
		const content = draftContent.trim();

		try {
			if (draftNoteIndex === null) {
			// First save of a new note	
				if (!title && !content) return;
				await invoke("add_note", {title, content});
				const data = await invoke<Note[]>("list_notes");
				setNotes(data);
				const index = data.length - 1;
				setDraftIndex(index);
				setSelected(index);
				setMode("view");
				await invoke ("edit_note", {
					index: draftNoteIndex,
					title, content
				});
				await refreshNotes();
			} else {
				await invoke("edit_note", {
					index: draftNoteIndex,
					title, content
				});
				await refreshNotes();
			}
		} catch (e) {
			console.error("Failed to add note: ", e);
		}
	}

	async function handleDeleteCurrent() {
		const index = draftNoteIndex ?? selected;

		if (index === null) return;

		try {
			await invoke("delete_note", {index});

			const data = await invoke<Note[]>("list_notes");
			setNotes(data);

			if (data.length === 0) {
				setSelected(null);
				setDraftIndex(null);
				setDraftContent("");
				setDraftTitle("");
				setLastFocused(null);
				return;
			}
			const newIndex = Math.min(index, data.length - 1);

			setSelected(newIndex);
			setDraftIndex(newIndex);
			setDraftTitle(data[newIndex].title);
			setDraftContent(data[newIndex].content);
			setLastFocused(null);
		} catch (e) {
			console.error("failed to delete note: ", e);
		}
	} 

	const normalizedTerm = searchTerm.trim().toLowerCase();
	const visibleNotes = normalizedTerm ? notes.filter((n) => {
		const hay = (n.title + " " + n.content).toLowerCase();
		return hay.includes(normalizedTerm);
	}) : notes;

	useEffect(() => {
		refreshNotes();
	}, []);

	useEffect(() => {
		if (!draftTitle.trim() && draftContent.trim()) return;

		const handle = window.setTimeout(() => {
			saveNote();
		}, 800);

		return () => {
			window.clearTimeout(handle);
		};
	}, [draftTitle, draftContent, mode])

	useEffect(() => {
		if (mode === "new" && draftNoteIndex !== null) {
			setMode("view");
		}
	}, [mode, draftNoteIndex]);

	useEffect(() => {
		if (!lastFocused) return;

		if (lastFocused === "title" && titleRef.current) {
			titleRef.current.focus();

			const len = titleRef.current.value.length;
			titleRef.current.setSelectionRange(len, len);
		} else if (lastFocused === "content" && contentRef.current) {
			contentRef.current.focus();
			const len = contentRef.current.value.length;
			contentRef.current.setSelectionRange(len, len);
			}
		}, [mode, selected, draftNoteIndex, lastFocused]);

	return (
		<div style={{position: "relative", height: "100vh"}}>
			<aside style={{transform: sideBarOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 200ms ease", zIndex: 2}}>
				<div style={{display: "grid", gridTemplateColumns: "1fr auto", marginBottom: "12px", rowGap: "0px"}}>
					<h2 style={{marginTop: 0}}>Notes</h2>
					<button style={{justifySelf: "right"}}
					  onClick={() => {setMode("new"); setDraftTitle(""); setDraftContent(""); setDraftIndex(null); setLastFocused(null); setSelected(null); }}>
						+ New
					</button>
					<input className="noteSearch" type="search" placeholder="Search" aria-label="Search notes" style={{gridColumn: "1 / -1"}} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>

				</div>
				{visibleNotes.length === 0 ? (
					<div style={{ opacity: 0.6 }}>No notes yet</div>
				) : (
					<ul>
							{[...visibleNotes].reverse().map((n) => {
								const realIndex = notes.indexOf(n);
							
								return (
								<li 
								  key={realIndex} 
								  tabIndex={0} 
								  className={`noteItem ${selected === realIndex ? "selected" : ""}`} 
								  onClick={() => {setSelected(realIndex); setMode("view"); setDraftContent(n.content); setDraftTitle(n.title); setDraftIndex(realIndex);}} title={n.title}
								  onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											setSelected(realIndex);
											setDraftContent(n.content);
											setDraftTitle(n.title);
											setDraftIndex(realIndex);
										}
									}}>
									<div style={{marginLeft: "6px"}}>{n.title || "(untitled)"}</div>
								</li>);
							})}
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
						<input ref={titleRef} type="text" placeholder="Enter Title..." style={{ gridColumn: "1 / -1", marginBottom: "8px"}} value={draftTitle} onChange={(e) => {setDraftTitle(e.target.value); setLastFocused("title");}} onFocus={() => setLastFocused("title")}/>
						<textarea ref={contentRef} placeholder="Enter note..." rows={10} style={{gridColumn: "1 / -1"}} value={draftContent} onChange={(e) => {setDraftContent(e.target.value); setLastFocused("content");}} onFocus={() => setLastFocused("content")}/>
						<button onClick={() => {setMode("view"); setDraftTitle(""); setDraftContent(""); setSelected(null); setLastFocused(null); }}>Cancel</button>
					</div>
				) : (
					selectedNote ? (
						<div style={{ display: "grid", gridTemplateColumns: "auto 1fr", marginLeft: "12px"}}>
							<div style={{ opacity: 0.7, fontSize: 12}}>{selectedNote.ts}</div>
							<input ref={titleRef} type="text" placeholder="Title" style={{gridColumn: "1/ -1", marginBottom: "8px"}} value={draftTitle} onChange={(e) => {setDraftTitle(e.target.value); setLastFocused("title");}}/>
							<textarea ref={contentRef} placeholder="Edit note..." rows={12} style={{gridColumn: "1 / -1"}} value={draftContent} onChange={(e) => {setDraftContent(e.target.value); setLastFocused("content");}}/>
							<button onClick={() => handleDeleteCurrent()}>Delete</button>
						</div>
					) : (
					<div style={{ opacity: 0.6}}>Select a note from the left</div>
				))}
			</main>
		</div>
	)
}
