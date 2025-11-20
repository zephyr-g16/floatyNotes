import { useEffect, useState, useRef} from "react";
import {invoke} from "@tauri-apps/api/core";
import {listen} from "@tauri-apps/api/event"
import {WebviewWindow} from "@tauri-apps/api/webviewWindow";
import "./App.css";

type Note = { ts: string; title: string; content: string};
type UserConfigs = {openSame: boolean; keyCmd: string};

export default function App() {
	const titleRef = useRef<HTMLInputElement | null>(null);
	const contentRef = useRef<HTMLTextAreaElement | null>(null);
	const [notes, setNotes] = useState<Note[]>([]);
	const [selected, setSelected] = useState<number | null>(null);
	const [sideBarOpen, setSideBarOpen] = useState(true);
	const [mode, setMode] = useState<"view" | "new" | "settings">("view");
	const [draftTitle, setDraftTitle] = useState("");
	const [draftContent, setDraftContent] = useState("");
	const [draftNoteIndex, setDraftIndex] = useState<number | null>(null);
	const [lastFocused, setLastFocused] = useState<"title" | "content" | null>(null);
	const selectedNote = selected !== null ? notes[selected] : null;
	const [searchTerm, setSearchTerm] = useState("");
	const [userConfig, setUserConfig] = useState<UserConfigs | null>(null);
	const isPromptWindoe = window.location.hash === "#prompt";

	if (isPromptWindoe) {
		return <PromptApp />;
	}

	async function refreshNotes() {
		try {
			const data = await invoke<Note[]>("list_notes");
			setNotes(data);
		} catch (e) {
			console.error("Failed to load notes: ", e);
		}
	}

	async function newNote() {
		setDraftContent("");
		setMode("new");
		setDraftTitle("");
		setDraftIndex(null);
		setLastFocused("title");
		setSelected(null);

		requestAnimationFrame(() => {
			titleRef.current?.focus();
		});
	}
	async function cancel() {
		setDraftContent("");
		setLastFocused(null);
		setDraftTitle("");
		setDraftIndex(null);
		setSelected(null);
		setMode("view");
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

	function PromptApp() {
		return (
			<div className="floatingWindow">
				<div style={{minWidth: 400, maxWidth: 600, padding: 16, borderRadius: 8}}>
					<textarea placeholder="type your note ..." autoFocus></textarea>
				</div>
			</div>
		)
	}

	async function closeWindow() {
		await invoke("close_window");
	}

	async function minWindow() {
		await invoke("min_window");
	}

	async function maxWindow() {
		await invoke("max_window");
	}

	//Search filtering, need to update this to handle phrases instead of just single strings like it does now
	const normalizedTerm = searchTerm.trim().toLowerCase();
	const visibleNotes = normalizedTerm ? notes.filter((n) => {
		const hay = (n.title + " " + n.content).toLowerCase();
		return hay.includes(normalizedTerm);
	}) : notes;

	useEffect(() => {
		refreshNotes();
	}, []);

	//Auto-save for when the user is inputting. After 800ms of not typing, it saves the new content to the note
	useEffect(() => {
		if (!draftTitle.trim() && draftContent.trim()) return;

		const handle = window.setTimeout(() => {
			saveNote();
		}, 800);

		return () => {
			window.clearTimeout(handle);
		};
	}, [draftTitle, draftContent, mode])

	//Effect to switch modes after an auto-save, once the note has an index generated
	useEffect(() => {
		if (mode === "new" && draftNoteIndex !== null) {
			setMode("view");
		}
	}, [mode, draftNoteIndex]);

	//Effect to handle entering the last typed in field, this is for when an auto-save occurs on a new note and flips the 
	// mode to edit, this allows the user to continue uninterrupted
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

	// Effect to handle key inputs like cmd+n for new note, or pressing escape to stop input.
	useEffect(() => {
		function handleKeydown(e: KeyboardEvent) {
			console.log("keydown: ", e.key, "meta: ", e.metaKey, "ctrl: ", e.ctrlKey);

			const isEscape = e.key.toLowerCase() === "escape";
			const isNewNoteShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n";

			if (isEscape) {
				titleRef.current?.blur();
				contentRef.current?.blur();
				if (mode === "new") {
					cancel();
				}
			}
			if (isNewNoteShortcut) {
				e.preventDefault();
				newNote();
			}
		}
		window.addEventListener("keydown", handleKeydown);
		return () => {window.removeEventListener("keydown", handleKeydown);};
	}, [mode]);

	//Effect to load user config automatically
	useEffect(() => {
		async function loadSettings() {
			try {
				const cfg = await invoke<UserConfigs>("get_config");
				setUserConfig(cfg);
			} catch (e) {
				console.error("Failed to load settings: ", e);
				setUserConfig({openSame: false, keyCmd: "CommandOrControl+N"});
			}
		}
		console.log("Settings loaded use: ", userConfig?.keyCmd)
		loadSettings();
	}, []);

	//Global key command listener for prompt window
	useEffect(() => {
		let off: (() => void) | null = null;

		listen("shortcut-event", async () => {
			invoke("open_prompt_window");
		}).then((unlistenFn) => {
			off = unlistenFn;
		});

		return () => {
			off?.();
		};
	}, []);

/* 	//This is the global keyCmd listener. Its what brings up and hides the note prompt
	useEffect(() => {
		async function setup() {
			const unlisten = listen("shortcut-event", async () => {
				await invoke("open_prompt_window");
			});
			return unlisten;
		}

		let cleanup: (() => void) | null = null;

		setup().then((unlisten) => {
			cleanup = unlisten;
		});

		return () => {
			cleanup?.();
		};
	}, []); */

	return (
		<div className="container">
			<div data-tauri-drag-region className="mainWindow" style={{position: "relative", height: "100vh"}}>
				<div className="trafficLightsContainer">
					<button className="redLight" onClick={() => closeWindow()}></button>
					<button className="yellowLight" onClick={() => minWindow()}></button>
					<button className="greenLight" onClick={() => maxWindow()}></button>
				</div>
				<div data-tauri-drag-region className="titleBar">
					<div className="sideBarToggle" style={{marginLeft: sideBarOpen ? 175 : 72, transition: "margin-left 200ms ease"}}>	
						<button onClick={() => {setSideBarOpen(o => !o)}} style={{width: "24px", height: "22px", padding: "2px"}}>|=</button>
					</div>
				</div>
				<aside style={{transform: sideBarOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 200ms ease", zIndex: 2}}>
					<div style={{display: "grid", gridTemplateColumns: "1fr auto", marginBottom: "12px", rowGap: "0px", marginTop: "5px"}}>
						<h2 style={{marginTop: "2px", marginLeft: "72px"}}>Notes</h2>
						<button style={{justifySelf: "right",  }}
						  onClick={() => newNote()}>
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
												(e.currentTarget as HTMLElement).blur();
												requestAnimationFrame(() => {
													titleRef.current?.focus();
												});
											}
										}}>
										<div style={{marginLeft: "6px"}}>{n.title || "(untitled)"}</div>
									</li>);
								})}
							</ul>
					)}
				</aside>
				<main className="mainCard" style={{marginLeft: sideBarOpen ? 260 : 20, transition: "margin-left 200ms ease"}}>
					<div className="noteCard">					
						{mode === "new" ? (
							<div style={{display: "grid", gridTemplateColumns: "auto 1fr", marginTop: "24px"}}>
								<input ref={titleRef} type="text" placeholder="Enter Title..." style={{ gridColumn: "1 / -1", marginBottom: "8px"}} value={draftTitle} onChange={(e) => {setDraftTitle(e.target.value); setLastFocused("title");}} onFocus={() => setLastFocused("title")}/>
								<textarea ref={contentRef} placeholder="Enter note..." rows={10} style={{gridColumn: "1 / -1"}} value={draftContent} onChange={(e) => {setDraftContent(e.target.value); setLastFocused("content");}} onFocus={() => setLastFocused("content")}/>
								<button style={{ }} onClick={() => cancel()}>Cancel</button>
							</div>
						) : (
							selectedNote ? (
								<div style={{ display: "grid", gridTemplateColumns: "auto 1fr", marginLeft: "12px"}}>
									<div style={{ opacity: 0.7, fontSize: 12}}>{selectedNote.ts}</div>
									<input ref={titleRef} type="text" placeholder="Title" style={{gridColumn: "1/ -1", marginBottom: "8px"}} value={draftTitle} onChange={(e) => {setDraftTitle(e.target.value); setLastFocused("title");}}/>
									<textarea ref={contentRef} placeholder="Edit note..." rows={12} style={{gridColumn: "1 / -1"}} value={draftContent} onChange={(e) => {setDraftContent(e.target.value); setLastFocused("content");}}/>
									<button style={{ }} onClick={() => handleDeleteCurrent()}>Delete</button>
								</div>
							) : (
								mode === "settings" ? (
								<div className="settings">
									<ul>
										{[userConfig].map()}
									</ul>
								</div>
							) : (
								<div style={{ opacity: 0.6}}>Select a note from the left</div>
						)))}
					</div>
				</main>
		</div>
	</div>)
}
