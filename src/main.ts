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

let mainDisplay: HTMLCanvasElement | null;
let mainDisplayContext: CanvasRenderingContext2D | null;

let backgroundDisplay: HTMLCanvasElement | null;
let backgroundDisplayContext: CanvasRenderingContext2D | null;

let oldCanvasContent: HTMLImageElement | null;
let currentOpenFilePath: String | String[] | null;

let currentTool: ToolType = ToolType.pen;
let currentPressedButton: KeyTypes = KeyTypes.none;

let mainPath = new Path2D();

let pencilBuffer: Point[] = [];
let eraserBuffer: Point[] = [];

let movementOffsetX = 0;
let movementOffsetY = 0;

let allTimeLargeX: number | null;
let allTimeSmallX: number | null;

let allTimeLargeY: number | null;
let allTimeSmallY: number | null;

function setCanvasContextSize(canvas: HTMLCanvasElement) {
	canvas.width = canvas.getBoundingClientRect().width;
	canvas.height = canvas.getBoundingClientRect().height;
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

function draw() {
	mainDisplayContext!.clearRect(0, 0, mainDisplay!.width, mainDisplay!.height);

	if (oldCanvasContent) mainDisplayContext!.drawImage(oldCanvasContent!, movementOffsetX, movementOffsetY);

	mainDisplayContext!.strokeStyle = "grey";
	mainDisplayContext!.lineWidth = 5;
	mainDisplayContext!.lineJoin = "round";
	mainDisplayContext!.lineCap = "round";
	mainDisplayContext!.stroke(mainPath);
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

function drawBuffers() {
	if (pencilBuffer.length > 0) {
		for (let point of pencilBuffer) {
			mainPath.lineTo(point.x, point.y);

			if (oldCanvasContent) {
				mainDisplayContext!.drawImage(oldCanvasContent!, movementOffsetX, movementOffsetY);
			}
		}

		pencilBuffer = [];

		draw();
	}

	if (eraserBuffer.length > 0) {
		for (let point of eraserBuffer) {
			mainDisplayContext!.save();
			mainDisplayContext!.beginPath();
			mainDisplayContext!.arc(point.x, point.y, 50, 0, Math.PI * 2);
			mainDisplayContext!.clip();
			mainDisplayContext!.clearRect(0, 0, mainDisplay!.width, mainDisplay!.height);
			mainDisplayContext!.closePath();
			mainDisplayContext!.restore();
		}

		eraserBuffer = [];
	}
}

function panCanvasContents(data: PointerEvent) {
	movementOffsetX += data.movementX;
	movementOffsetY += data.movementY;

	mainDisplayContext!.clearRect(0, 0, mainDisplay!.width, mainDisplay!.height);
	mainDisplayContext!.drawImage(oldCanvasContent!, movementOffsetX, movementOffsetY);
}

function loadCanvasState(data: unknown) {
	let givenString = data as string;

	mainPath = new Path2D();
	oldCanvasContent = new Image();
	oldCanvasContent.src = givenString;

	oldCanvasContent.onload = () => {
		mainDisplayContext!.clearRect(0, 0, mainDisplay!.width, mainDisplay!.height);
		mainDisplayContext!.drawImage(oldCanvasContent!, movementOffsetX, movementOffsetY);
	};
}

window.addEventListener("DOMContentLoaded", async () => {
	setInterval(drawBuffers, 25);

	mainDisplay = <HTMLCanvasElement>document.getElementById("canvas");
	mainDisplayContext = mainDisplay!.getContext("2d", { willReadFrequently: true })!;

	backgroundDisplay = <HTMLCanvasElement>document.getElementById("canvas-background");
	backgroundDisplayContext = backgroundDisplay!.getContext("2d")!;

	setCanvasContextSize(mainDisplay!);
	setCanvasContextSize(backgroundDisplay!);

	drawBackground();

	window.addEventListener("resize", () => {
		setCanvasContextSize(mainDisplay!);
		setCanvasContextSize(backgroundDisplay!);

		drawBackground();
		draw();
	});

	mainDisplay.addEventListener("pointerleave", (event) => {
		if (currentPressedButton != KeyTypes.none) {
			loadCanvasState(mainDisplay?.toDataURL("image/png"));

			if (currentPressedButton == KeyTypes.middleClick) {
				mainDisplay?.removeEventListener("pointermove", panCanvasContents);
			}

			currentPressedButton = KeyTypes.none;

			if (currentTool == ToolType.pen) {
				mainDisplay?.removeEventListener("pointermove", updatePencilBuffer);
				updatePencilBuffer(event);
			}

			if (currentTool == ToolType.eraser) {
				mainDisplay?.removeEventListener("pointermove", updateEraserBuffer);
				updateEraserBuffer(event);
			}
		}
	});

	mainDisplay.addEventListener("pointerdown", (event) => {
		currentPressedButton = event.button;

		if (currentPressedButton == KeyTypes.leftClick) {
			if (currentTool == ToolType.pen) {
				mainPath?.moveTo(event.offsetX, event.offsetY);
				mainDisplay?.addEventListener("pointermove", updatePencilBuffer, { passive: true });
			}

			if (currentTool == ToolType.eraser) {
				mainDisplay?.addEventListener("pointermove", updateEraserBuffer, { passive: true });
			}
		}

		if (currentPressedButton == KeyTypes.middleClick) {
			mainDisplay?.addEventListener("pointermove", panCanvasContents, { passive: true });
		}
	});

	mainDisplay.addEventListener("pointerup", () => {
		let newCanvas = document.createElement("canvas");

		newCanvas.width = mainDisplay!.width + Math.abs(movementOffsetX);
		newCanvas.height = mainDisplay!.height + Math.abs(movementOffsetY);

		let newCanvasContext = newCanvas.getContext("2d");
		if (oldCanvasContent) newCanvasContext!.drawImage(oldCanvasContent!, 0, 0);
		newCanvasContext!.strokeStyle = "grey";
		newCanvasContext!.lineWidth = 5;
		newCanvasContext!.lineJoin = "round";
		newCanvasContext!.lineCap = "round";

		newCanvasContext?.save();
		newCanvasContext?.translate(Math.abs(movementOffsetX), Math.abs(movementOffsetY));
		newCanvasContext!.stroke(mainPath);
		newCanvasContext?.restore();

		loadCanvasState(newCanvas?.toDataURL("image/png"));

		if (currentPressedButton == KeyTypes.middleClick) {
			mainDisplay?.removeEventListener("pointermove", panCanvasContents);
		}

		currentPressedButton = KeyTypes.none;

		if (currentTool == ToolType.pen) {
			mainDisplay?.removeEventListener("pointermove", updatePencilBuffer);
		}

		if (currentTool == ToolType.eraser) {
			mainDisplay?.removeEventListener("pointermove", updateEraserBuffer);
		}
	});

	await listen("save", () => {
		if (currentOpenFilePath) {
			let data = mainDisplay?.toDataURL("image/png");
			invoke("save_canvas_state_as", { givenValue: data, givenPath: currentOpenFilePath });
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

			let data = mainDisplay?.toDataURL("image/png");
			invoke("save_canvas_state_as", { givenValue: data, givenPath: path });
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
			movementOffsetX = 0;
			movementOffsetY = 0;

			mainPath = new Path2D();
			oldCanvasContent = null;
			mainDisplayContext!.clearRect(0, 0, mainDisplay!.width, mainDisplay!.height);
		}
	});

	await listen("tool-change", (event) => {
		currentTool = event.payload as number;

		let container = document.getElementById("canvas-container");
		if (currentTool == ToolType.eraser) container!.style.borderStyle = "dashed";
		if (currentTool == ToolType.pen) container!.style.borderStyle = "solid";
	});
});
