import { invoke } from "@tauri-apps/api";
import { listen } from "@tauri-apps/api/event";
import { save, open, ask } from "@tauri-apps/api/dialog";

class Path2DWithMeta {
	path: Path2D;
	type: String;
	size: number;

	constructor(gPath: Path2D, gType: String, gSize: number) {
		this.path = gPath;
		this.type = gType;
		this.size = gSize;
	}
}

class Point {
	x: number;
	y: number;

	constructor(gx: number, gy: number) {
		this.x = gx;
		this.y = gy;
	}
}

enum KeyTypes {
	none = -1,
	leftClick = 0,
	middleClick = 1,
	rightClick = 2,
}

enum ToolType {
	pencil = 0,
	eraser = 1,
}

let shadowDisplay: HTMLCanvasElement | null;
let shadowDisplayContext: CanvasRenderingContext2D | null;

let viewPort: HTMLCanvasElement | null;
let viewPortContext: CanvasRenderingContext2D | null;

let backgroundDisplay: HTMLCanvasElement | null;
let backgroundDisplayContext: CanvasRenderingContext2D | null;

let oldCanvasContent: HTMLImageElement | null;
let currentOpenFilePath: String | String[] | null;

let pencilSizeInput: HTMLInputElement | null;

let currentTool: ToolType = ToolType.pencil;
let currentPressedButton: KeyTypes = KeyTypes.none;

let currentPath: Path2DWithMeta | null;
let pathsInSession: Path2DWithMeta[] = [];
let lastUndoes: Path2DWithMeta[] = [];

let pencilBuffer: Point[] = [];
let eraserBuffer: Point[] = [];

let eraserSize = 50;
let pencilSize = 5;

function setCanvasSizeToSelf(canvas: HTMLCanvasElement) {
	canvas.width = canvas.getBoundingClientRect().width;
	canvas.height = canvas.getBoundingClientRect().height;
}

function setCanvasSizeToReference(canvas: HTMLCanvasElement, reference: HTMLCanvasElement) {
	canvas.width = reference.getBoundingClientRect().width;
	canvas.height = reference.getBoundingClientRect().height;
}

function setCanvasSizeToVal(canvas: HTMLCanvasElement, width: number, height: number) {
	canvas.width = width;
	canvas.height = height;
}

function drawAllSessionLines() {
	for (let i = 0; i < pathsInSession.length; i++) {
		let path = pathsInSession[i];

		if (path.type == "pencil") {
			shadowDisplayContext!.save();
			shadowDisplayContext!.lineWidth = path.size;
			shadowDisplayContext!.strokeStyle = "grey";
			shadowDisplayContext!.lineJoin = "round";
			shadowDisplayContext!.lineCap = "round";
			shadowDisplayContext!.stroke(path.path);
			shadowDisplayContext!.restore();
		}

		if (path.type == "eraser") {
			shadowDisplayContext!.save();
			shadowDisplayContext!.globalCompositeOperation = "destination-out";
			shadowDisplayContext!.lineWidth = path.size;
			shadowDisplayContext!.lineJoin = "round";
			shadowDisplayContext!.lineCap = "round";
			shadowDisplayContext!.stroke(path!.path);
			shadowDisplayContext!.restore();
		}
	}
}

function drawBackground() {
	let spacing = 30;
	let size = 1;

	for (let i = 1; i <= backgroundDisplay!.height / spacing; i++) {
		for (let l = 1; l <= backgroundDisplay!.width / spacing; l++) {
			backgroundDisplayContext!.beginPath();
			backgroundDisplayContext!.arc(l * spacing, i * spacing, size, 0, Math.PI * 2);
			backgroundDisplayContext!.closePath();
			backgroundDisplayContext!.fillStyle = "#616161";
			backgroundDisplayContext!.fill();
			backgroundDisplayContext!.closePath();
		}
	}
}

function drawBuffers() {
	if (pencilBuffer.length > 0) {
		for (let point of pencilBuffer) {
			currentPath!.path.lineTo(point.x, point.y);
		}

		pencilBuffer = [];

		shadowDisplayContext!.save();
		shadowDisplayContext!.strokeStyle = "grey";
		shadowDisplayContext!.lineWidth = currentPath!.size;
		shadowDisplayContext!.lineJoin = "round";
		shadowDisplayContext!.lineCap = "round";
		shadowDisplayContext!.stroke(currentPath!.path);
		shadowDisplayContext!.restore();

		viewPortContext!.clearRect(0, 0, viewPort!.width, viewPort!.height);
		viewPortContext!.drawImage(shadowDisplay!, 0, 0);
	}

	if (eraserBuffer.length > 0) {
		for (let point of eraserBuffer) {
			currentPath!.path.lineTo(point.x, point.y);
		}

		eraserBuffer = [];

		shadowDisplayContext!.save();
		shadowDisplayContext!.globalCompositeOperation = "destination-out";
		shadowDisplayContext!.lineWidth = currentPath!.size;
		shadowDisplayContext!.lineJoin = "round";
		shadowDisplayContext!.lineCap = "round";
		shadowDisplayContext!.stroke(currentPath!.path);
		shadowDisplayContext!.restore();

		viewPortContext!.clearRect(0, 0, viewPort!.width, viewPort!.height);
		viewPortContext!.drawImage(shadowDisplay!, 0, 0);
	}

	window.requestAnimationFrame(drawBuffers);
}

function updatePencilBuffer(event: PointerEvent) {
	try {
		let events = event.getCoalescedEvents();

		if (events.length > 0) {
			for (let e of events) {
				pencilBuffer.push(new Point(e.offsetX, e.offsetY));
			}
		} else {
			pencilBuffer.push(new Point(event.offsetX, event.offsetY));
		}
	} catch (error) {
		pencilBuffer.push(new Point(event.offsetX, event.offsetY));
	}
}

function updateEraserBuffer(event: PointerEvent) {
	try {
		let events = event.getCoalescedEvents();

		if (events.length > 0) {
			for (let e of events) {
				eraserBuffer.push(new Point(e.offsetX, e.offsetY));
			}
		} else {
			eraserBuffer.push(new Point(event.offsetX, event.offsetY));
		}
	} catch (error) {
		eraserBuffer.push(new Point(event.offsetX, event.offsetY));
	}
}

function loadCanvasState(data: unknown) {
	let givenString = data as string;

	pathsInSession = [];
	shadowDisplayContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);
	viewPortContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);

	oldCanvasContent = new Image();
	oldCanvasContent.src = givenString;

	oldCanvasContent.onload = () => {
		setCanvasSizeToVal(shadowDisplay!, oldCanvasContent!.width, oldCanvasContent!.height);

		shadowDisplayContext!.drawImage(oldCanvasContent!, 0, 0);
		viewPortContext!.drawImage(shadowDisplay!, 0, 0);
	};
}

window.addEventListener("DOMContentLoaded", async () => {
	window.requestAnimationFrame(drawBuffers);

	shadowDisplay = <HTMLCanvasElement>document.createElement("canvas");
	shadowDisplayContext = shadowDisplay!.getContext("2d")!;

	viewPort = <HTMLCanvasElement>document.getElementById("canvas");
	viewPortContext = viewPort!.getContext("2d")!;

	backgroundDisplay = <HTMLCanvasElement>document.getElementById("canvas-background");
	backgroundDisplayContext = backgroundDisplay!.getContext("2d")!;

	pencilSizeInput = <HTMLInputElement>document.getElementById("pencil-size-input");
	pencilSizeInput.value = `${pencilSize}`;

	setCanvasSizeToReference(shadowDisplay, viewPort);
	setCanvasSizeToSelf(viewPort);
	setCanvasSizeToSelf(backgroundDisplay);
	drawBackground();

	window.addEventListener("resize", () => {
		setCanvasSizeToSelf(viewPort!);

		let didResizeShadow = false;

		if (viewPort!.width > shadowDisplay!.width) {
			shadowDisplay!.width = viewPort!.width;
			didResizeShadow = true;
		}

		if (viewPort!.height > shadowDisplay!.height) {
			shadowDisplay!.height = viewPort!.height;
			didResizeShadow = true;
		}

		if (didResizeShadow) {
			if (oldCanvasContent) shadowDisplayContext?.drawImage(oldCanvasContent!, 0, 0);
			drawAllSessionLines();
		}

		setCanvasSizeToSelf(backgroundDisplay!);
		drawBackground();

		viewPortContext!.drawImage(shadowDisplay!, 0, 0);
	});

	viewPort.addEventListener("pointerleave", (event) => {
		if (currentPressedButton != KeyTypes.none) {
			currentPressedButton = KeyTypes.none;

			if (currentTool == ToolType.pencil) {
				viewPort?.removeEventListener("pointermove", updatePencilBuffer);
				pencilBuffer.push(new Point(event.offsetX, event.offsetY));
				drawBuffers();
				pathsInSession.push(currentPath!);
			}

			if (currentTool == ToolType.eraser) {
				viewPort?.removeEventListener("pointermove", updateEraserBuffer);
				eraserBuffer.push(new Point(event.offsetX, event.offsetY));
				drawBuffers();
				pathsInSession.push(currentPath!);
			}
		}
	});

	viewPort.addEventListener("pointerdown", (event) => {
		currentPressedButton = event.button;

		if (currentTool == ToolType.pencil) {
			currentPath! = new Path2DWithMeta(new Path2D(), "pencil", pencilSize);
			viewPort?.addEventListener("pointermove", updatePencilBuffer, { passive: true });
		}

		if (currentTool == ToolType.eraser) {
			currentPath! = new Path2DWithMeta(new Path2D(), "eraser", pencilSize);
			viewPort?.addEventListener("pointermove", updateEraserBuffer, { passive: true });
		}
	});

	viewPort.addEventListener("pointerup", () => {
		currentPressedButton = KeyTypes.none;

		if (currentTool == ToolType.pencil) {
			pathsInSession.push(currentPath!);
			viewPort?.removeEventListener("pointermove", updatePencilBuffer);
		}

		if (currentTool == ToolType.eraser) {
			pathsInSession.push(currentPath!);
			viewPort?.removeEventListener("pointermove", updateEraserBuffer);
		}
	});

	//--

	pencilSizeInput.addEventListener("input", () => {
		pencilSize = Number(pencilSizeInput!.value);
	});

	//--

	await listen("save", () => {
		if (currentOpenFilePath) {
			invoke("save_canvas_state_as", { givenValue: shadowDisplay?.toDataURL("image/png"), givenPath: currentOpenFilePath });
		}
	});

	await listen("load", () => {
		if (currentOpenFilePath) {
			invoke("load_canvas_state_from", { givenPath: currentOpenFilePath }).then(loadCanvasState).catch();
		}
	});

	await listen("save-as", async () => {
		const path = await save({
			filters: [
				{
					name: "Drawing Data",
					extensions: ["drawing"],
				},
			],
		});

		if (path) {
			currentOpenFilePath = path;
			invoke("save_canvas_state_as", { givenValue: shadowDisplay?.toDataURL("image/png"), givenPath: path });
		}
	});

	await listen("load-from", async () => {
		const path = await open({
			multiple: false,
			filters: [
				{
					name: "Drawing Data",
					extensions: ["drawing"],
				},
			],
		});

		if (path) {
			currentOpenFilePath = path;
			invoke("load_canvas_state_from", { givenPath: path }).then(loadCanvasState).catch();
		}
	});

	await listen("clear", async () => {
		let agreed = await ask("Are you sure?", { title: "Tauri", type: "warning" });

		if (agreed) {
			oldCanvasContent = null;
			pathsInSession = [];
			lastUndoes = [];
			shadowDisplayContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);
			viewPortContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);
		}
	});

	await listen("undo", async () => {
		if (pathsInSession.length == 0) return;

		lastUndoes.push(pathsInSession.pop()!);

		shadowDisplayContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);
		drawAllSessionLines();

		viewPortContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);
		viewPortContext!.drawImage(shadowDisplay!, 0, 0);
	});

	await listen("redo", async () => {
		if (lastUndoes.length == 0) return;

		pathsInSession.push(lastUndoes.pop()!);

		shadowDisplayContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);
		drawAllSessionLines();

		viewPortContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);
		viewPortContext!.drawImage(shadowDisplay!, 0, 0);
	});

	await listen("tool-change", (event) => {
		currentTool = event.payload as number;

		let container = document.getElementById("canvas-container");
		if (currentTool == ToolType.eraser) container!.style.borderStyle = "dashed";
		if (currentTool == ToolType.pencil) container!.style.borderStyle = "solid";
	});

	await listen("pencil-size", () => {
		document.getElementById("pencil-size")!.style.display = "grid";
	});
});
