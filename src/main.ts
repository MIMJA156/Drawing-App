import { invoke } from "@tauri-apps/api";
import { listen } from "@tauri-apps/api/event";
import { save, open, ask } from "@tauri-apps/api/dialog";

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
	pen = 0,
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

let currentTool: ToolType = ToolType.pen;
let currentPressedButton: KeyTypes = KeyTypes.none;

let currentPath: Path2D | null;
let pathsInSession: Path2D[] = [];

let pencilBuffer: Point[] = [];
let eraserBuffer: Point[] = [];

function setCanvasContextSizeToSelf(canvas: HTMLCanvasElement) {
	canvas.width = canvas.getBoundingClientRect().width;
	canvas.height = canvas.getBoundingClientRect().height;
}

function setCanvasContextSizeToReference(canvas: HTMLCanvasElement, reference: HTMLCanvasElement) {
	canvas.width = reference.getBoundingClientRect().width;
	canvas.height = reference.getBoundingClientRect().height;
}

function drawAllSessionLines() {
	for (let i = 0; i < pathsInSession.length; i++) {
		let path = pathsInSession[i];

		shadowDisplayContext!.save();
		shadowDisplayContext!.strokeStyle = "grey";
		shadowDisplayContext!.lineWidth = 5;
		shadowDisplayContext!.lineJoin = "round";
		shadowDisplayContext!.lineCap = "round";
		shadowDisplayContext!.stroke(path);
		shadowDisplayContext!.restore();
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
			currentPath!.lineTo(point.x, point.y);
		}

		pencilBuffer = [];

		viewPortContext!.clearRect(0, 0, viewPort!.width, viewPort!.height);
		shadowDisplayContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);

		if (oldCanvasContent) shadowDisplayContext?.drawImage(oldCanvasContent!, 0, 0);

		shadowDisplayContext!.save();
		shadowDisplayContext!.strokeStyle = "grey";
		shadowDisplayContext!.lineWidth = 5;
		shadowDisplayContext!.lineJoin = "round";
		shadowDisplayContext!.lineCap = "round";
		shadowDisplayContext!.stroke(currentPath!);
		shadowDisplayContext!.restore();

		drawAllSessionLines();
		viewPortContext!.drawImage(shadowDisplay!, 0, 0);
	}

	if (eraserBuffer.length > 0) {
		for (let point of eraserBuffer) {
			shadowDisplayContext!.save();
			shadowDisplayContext!.beginPath();
			shadowDisplayContext!.arc(point.x, point.y, 50, 0, Math.PI * 2);
			shadowDisplayContext!.clip();
			shadowDisplayContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);
			shadowDisplayContext!.closePath();
			shadowDisplayContext!.restore();
		}

		eraserBuffer = [];
	}

	window.requestAnimationFrame(drawBuffers);
}

function updatePencilBuffer(event: PointerEvent) {
	let events = event.getCoalescedEvents();

	if (events.length > 0) {
		for (let e of events) {
			pencilBuffer.push(new Point(e.offsetX, e.offsetY));
		}
	} else {
		pencilBuffer.push(new Point(event.offsetX, event.offsetY));
	}
}

function updateEraserBuffer(event: PointerEvent) {
	let events = event.getCoalescedEvents();

	if (events.length > 0) {
		for (let e of events) {
			eraserBuffer.push(new Point(e.offsetX, e.offsetY));
		}
	} else {
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

	setCanvasContextSizeToReference(shadowDisplay, viewPort);
	setCanvasContextSizeToSelf(viewPort);
	setCanvasContextSizeToSelf(backgroundDisplay);

	drawBackground();

	window.addEventListener("resize", () => {
		setCanvasContextSizeToReference(shadowDisplay!, viewPort!);
		setCanvasContextSizeToSelf(viewPort!);
		setCanvasContextSizeToSelf(backgroundDisplay!);

		drawBackground();
		if (oldCanvasContent) shadowDisplayContext?.drawImage(oldCanvasContent!, 0, 0);
		drawAllSessionLines();

		viewPortContext!.drawImage(shadowDisplay!, 0, 0);
	});

	viewPort.addEventListener("pointerleave", (event) => {
		if (currentPressedButton != KeyTypes.none) {
			currentPressedButton = KeyTypes.none;

			if (currentTool == ToolType.pen) {
				viewPort?.removeEventListener("pointermove", updatePencilBuffer);
				updatePencilBuffer(event);
			}

			if (currentTool == ToolType.eraser) {
				viewPort?.removeEventListener("pointermove", updateEraserBuffer);
				updateEraserBuffer(event);
			}
		}
	});

	viewPort.addEventListener("pointerdown", (event) => {
		currentPressedButton = event.button;

		if (currentTool == ToolType.pen) {
			currentPath = new Path2D();
			viewPort?.addEventListener("pointermove", updatePencilBuffer, { passive: true });
		}

		if (currentTool == ToolType.eraser) {
			viewPort?.addEventListener("pointermove", updateEraserBuffer, { passive: true });
		}
	});

	viewPort.addEventListener("pointerup", () => {
		currentPressedButton = KeyTypes.none;

		if (currentTool == ToolType.pen) {
			pathsInSession.push(currentPath!);
			viewPort?.removeEventListener("pointermove", updatePencilBuffer);
		}

		if (currentTool == ToolType.eraser) {
			viewPort?.removeEventListener("pointermove", updateEraserBuffer);
		}
	});

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
			shadowDisplayContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);
			viewPortContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);
		}
	});

	await listen("tool-change", (event) => {
		loadCanvasState(shadowDisplay?.toDataURL("image/png"));

		currentTool = event.payload as number;

		let container = document.getElementById("canvas-container");
		if (currentTool == ToolType.eraser) container!.style.borderStyle = "dashed";
		if (currentTool == ToolType.pen) container!.style.borderStyle = "solid";
	});
});
