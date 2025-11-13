import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type Note = { ts: string; title: string; content: string };

export default function App() {
	const [notes, setNotes] = useState<Note[]>([]);
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");

	async function refresh() {
		const data = await invoke<Note[]>("list_notes");
		setNotes(data);
	}

	async function add() {
		if (!title.trim()) return;
		await invoke("add_note", { title, content });
		setTitle("");
		setContent("");
		await refresh();
	}

	useEffect(() => {
		refresh();
	}, []);

	return (
		<div style={{padding: 16, maxWidth: 800, margin: "0 auto", fontFamily: "Inter, system-ui, sans-serif", }}>
			<h1>Notes</h1>

			<div style={{ display: "grid", gap: 8, marginBottom: 16, }}>
				<input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)}/>
				<textarea style={{ backgroundColor: "#1f1f1f", color: "white", fontSize: "14px", border: "1px solid #444", borderRadius: "4px", padding: "8px", resize: "vertical" }} 
					placeholder="Content" rows={5} value={content} onChange={(e) => setContent(e.target.value)}/>
				<button onClick={add}>Add Note</button>
			</div>
			<ul style={{display: "grid", gap: 8, listStyle: "none", padding: 0}}>
				{notes.slice(-3).map((n, i) => {
					const firstLine = n.content.split("\n")[0];
					const preview = firstLine.length > 60 ? firstLine.slice(0, 57) + "..." : firstLine;
					return (
						<li key={`${n.ts}-${i}`} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12}}>
							<div style={{ fontSize: 12, opacity: 0.7, }}>{n.ts}</div>
							<div style={{ fontWeight: 600, }}>{n.title}</div>
							<div style={{ opacity: 0.85 }}>{preview}</div>
						</li>
					)
				})}
			</ul>
		</div>
	);
}

// ----- Default styling from the app creation -----
// ----- Keeping this so i can refer to it when i break my own shit -----
//   return (
//     <main className="container">
//       <h1>Welcome to Tauri + React</h1>
//
//       <div className="row">
//         <a href="https://vite.dev" target="_blank">
//           <img src="/vite.svg" className="logo vite" alt="Vite logo" />
//         </a>
//         <a href="https://tauri.app" target="_blank">
//           <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
//         </a>
//         <a href="https://react.dev" target="_blank">
//           <img src={reactLogo} className="logo react" alt="React logo" />
//         </a>
//       </div>
//       <p>Click on the Tauri, Vite, and React logos to learn more.</p>
//
//       <form
//         className="row"
//         onSubmit={(e) => {
//           e.preventDefault();
//           greet();
//         }}
//       >
//         <input
//           id="greet-input"
//           onChange={(e) => setName(e.currentTarget.value)}
//           placeholder="Enter a name..."
//         />
//         <button type="submit">Greet</button>
//       </form>
//       <p>{greetMsg}</p>
//     </main>
//   );
// }
