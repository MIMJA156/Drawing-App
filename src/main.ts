import { invoke } from "@tauri-apps/api";
import { listen } from "@tauri-apps/api/event";
import { save, open, ask } from "@tauri-apps/api/dialog";

let mainDisplay: HTMLCanvasElement | null;
let backgroundDisplay: HTMLCanvasElement | null;

let oldCanvasContent: HTMLImageElement | null;

let currentOpenFilePath: String | String[] | null;

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

let currentTool: ToolType = ToolType.pen;
let currentPressedButton: KeyTypes = KeyTypes.none;

function setCanvasContextSize(canvas: HTMLCanvasElement) {
	canvas.width = canvas.getBoundingClientRect().width;
	canvas.height = canvas.getBoundingClientRect().height;
}

function drawBackground(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
	let spacing = 30;
	let size = 1;

	for (let i = 1; i <= canvas.height / spacing; i++) {
		for (let l = 1; l <= canvas.width / spacing; l++) {
			ctx.beginPath();
			ctx.arc(l * spacing, i * spacing, size, 0, Math.PI * 2);
			ctx.closePath();
			ctx.fillStyle = "#616161";
			ctx.fill();
			ctx.closePath();
		}
	}
}

let lastPoint = { x: 0, y: 0 };
let mainPath = new Path2D();

window.addEventListener("DOMContentLoaded", async () => {
	mainDisplay = <HTMLCanvasElement>document.getElementById("canvas");
	let mainDisplayContext = mainDisplay!.getContext("2d", { willReadFrequently: true })!;

	backgroundDisplay = <HTMLCanvasElement>document.getElementById("canvas-background");
	let backgroundDisplayContext = backgroundDisplay!.getContext("2d")!;

	setCanvasContextSize(mainDisplay!);
	setCanvasContextSize(backgroundDisplay!);

	drawBackground(backgroundDisplayContext, backgroundDisplay!);

	window.addEventListener("resize", () => {
		setCanvasContextSize(mainDisplay!);
		setCanvasContextSize(backgroundDisplay!);

		if (oldCanvasContent) {
			mainDisplayContext.drawImage(oldCanvasContent!, 0, 0);
		}

		mainDisplayContext.strokeStyle = "grey";
		mainDisplayContext.stroke(mainPath);

		drawBackground(backgroundDisplayContext, backgroundDisplay!);
	});

	let mouseMoveCallback = (event: MouseEvent) => {
		if (currentPressedButton == KeyTypes.leftClick) {
			if (currentTool == ToolType.pen) {
				mainDisplayContext.clearRect(0, 0, mainDisplay!.width, mainDisplay!.height);

				if (oldCanvasContent) {
					mainDisplayContext.drawImage(oldCanvasContent, 0, 0);
				}

				mainPath.moveTo(lastPoint.x, lastPoint.y);
				mainPath.lineTo(event.offsetX, event.offsetY);

				mainDisplayContext.strokeStyle = "grey";
				mainDisplayContext.stroke(mainPath);

				lastPoint.x = event.offsetX;
				lastPoint.y = event.offsetY;
			}

			if (currentTool == ToolType.eraser) {
				oldCanvasContent = null;
				mainPath = new Path2D();

				mainDisplayContext.save();
				mainDisplayContext.beginPath();
				mainDisplayContext.arc(event.offsetX, event.offsetY, 50, 0, Math.PI * 2);
				mainDisplayContext.clip();
				mainDisplayContext.clearRect(0, 0, mainDisplay!.width, mainDisplay!.height);
				mainDisplayContext.closePath();
				mainDisplayContext.restore();

				let data = mainDisplay?.toDataURL("image/png");

				oldCanvasContent = new Image();
				oldCanvasContent.src = data!;

				oldCanvasContent.onload = () => {
					mainDisplayContext.clearRect(0, 0, mainDisplay!.width, mainDisplay!.height);
					mainDisplayContext.drawImage(oldCanvasContent!, 0, 0);
				};
			}
		}
	};

	mainDisplay.addEventListener("mouseleave", (event) => {
		if (currentPressedButton != KeyTypes.none) {
			mouseMoveCallback(event);
			currentPressedButton = KeyTypes.none;
		}

		mainDisplay?.removeEventListener("mousemove", mouseMoveCallback);
	});

	mainDisplay.addEventListener("mousedown", (event) => {
		currentPressedButton = event.button;

		lastPoint.x = event.offsetX;
		lastPoint.y = event.offsetY;

		mainDisplay?.addEventListener("mousemove", mouseMoveCallback);
	});

	mainDisplay.addEventListener("mouseup", () => {
		currentPressedButton = KeyTypes.none;
		mainDisplay?.removeEventListener("mousemove", mouseMoveCallback);
	});

	await listen("save", () => {
		if (currentOpenFilePath) {
			let data = mainDisplay?.toDataURL("image/png");
			invoke("save_canvas_state_as", { givenValue: data, givenPath: currentOpenFilePath });
		}
	});

	await listen("load", () => {
		if (currentOpenFilePath) {
			invoke("load_canvas_state_from", { givenPath: currentOpenFilePath })
				.then((data) => {
					let givenString = data as string;

					mainPath = new Path2D();
					mainDisplayContext.clearRect(0, 0, mainDisplay!.width, mainDisplay!.height);

					oldCanvasContent = new Image();
					oldCanvasContent.src = givenString;

					oldCanvasContent.onload = () => {
						mainDisplayContext.drawImage(oldCanvasContent!, 0, 0);
					};
				})
				.catch();
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

			invoke("load_canvas_state_from", { givenPath: path })
				.then((data) => {
					let givenString = data as string;

					mainPath = new Path2D();
					mainDisplayContext.clearRect(0, 0, mainDisplay!.width, mainDisplay!.height);

					oldCanvasContent = new Image();
					oldCanvasContent.src = givenString;

					oldCanvasContent.onload = () => {
						mainDisplayContext.drawImage(oldCanvasContent!, 0, 0);
					};
				})
				.catch();
		}
	});

	await listen("clear", async () => {
		let agreed = await ask("Are you sure?", { title: "Tauri", type: "warning" });

		if (agreed) {
			mainPath = new Path2D();
			oldCanvasContent = null;
			mainDisplayContext.clearRect(0, 0, mainDisplay!.width, mainDisplay!.height);
		}
	});

	await listen("tool-change", (event) => {
		currentTool = event.payload as number;

		let container = document.getElementById("canvas-container");
		if (currentTool == ToolType.eraser) container!.style.borderStyle = "dashed";
		if (currentTool == ToolType.pen) container!.style.borderStyle = "solid";
	});
});
