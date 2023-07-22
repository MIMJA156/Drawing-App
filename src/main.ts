import { invoke } from "@tauri-apps/api";
import { listen } from "@tauri-apps/api/event";

let mainDisplay: HTMLCanvasElement | null;
let backgroundDisplay: HTMLCanvasElement | null;

let currentInputData: any = [];

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
		}
	}
}

let lastPoint = { x: 0, y: 0 };
let mainPath = new Path2D();
window.addEventListener("DOMContentLoaded", async () => {
	mainDisplay = <HTMLCanvasElement>document.getElementById("canvas");
	let mainDisplayContext = mainDisplay!.getContext("2d")!;

	backgroundDisplay = <HTMLCanvasElement>document.getElementById("canvas-background");
	let backgroundDisplayContext = backgroundDisplay!.getContext("2d")!;

	let mouseIsDown = false;

	setCanvasContextSize(mainDisplay!);
	setCanvasContextSize(backgroundDisplay!);

	drawBackground(backgroundDisplayContext, backgroundDisplay!);

	window.addEventListener("resize", () => {
		setCanvasContextSize(mainDisplay!);
		setCanvasContextSize(backgroundDisplay!);

		mainDisplayContext.strokeStyle = "grey";
		mainDisplayContext.stroke(mainPath);

		drawBackground(backgroundDisplayContext, backgroundDisplay!);
	});

	let mouseMoveCallback = (event: MouseEvent, isAsCallback: boolean = true) => {
		mainDisplayContext.clearRect(0, 0, mainDisplay!.width, mainDisplay!.height);

		mainPath.moveTo(lastPoint.x, lastPoint.y);
		mainPath.lineTo(event.offsetX, event.offsetY);

		mainDisplayContext.strokeStyle = "grey";
		mainDisplayContext.stroke(mainPath);

		lastPoint.x = event.offsetX;
		lastPoint.y = event.offsetY;

		if (isAsCallback) {
			currentInputData.push(lastPoint.x);
			currentInputData.push(lastPoint.y);
		}
	};

	mainDisplay.addEventListener("mouseleave", (event) => {
		if (mouseIsDown) {
			mouseIsDown = false;
			mouseMoveCallback(event);

			currentInputData.push("!");
		}

		mainDisplay?.removeEventListener("mousemove", mouseMoveCallback);
	});

	mainDisplay.addEventListener("mousedown", (event) => {
		mouseIsDown = true;
		lastPoint.x = event.offsetX;
		lastPoint.y = event.offsetY;

		currentInputData.push(lastPoint.x);
		currentInputData.push(lastPoint.y);

		mainDisplay?.addEventListener("mousemove", mouseMoveCallback);
	});

	mainDisplay.addEventListener("mouseup", () => {
		mouseIsDown = false;
		mainDisplay?.removeEventListener("mousemove", mouseMoveCallback);

		currentInputData.push("!");
	});

	await listen("save", () => {
		let data = new Map();

		let index = 0;
		currentInputData.forEach((value: any) => {
			data.set(index, `${value}`);
			index++;
		});

		invoke("save_canvas_state", { givenValue: data });
	});

	class CustomMouseEvent extends MouseEvent {
		override offsetX: number;
		override offsetY: number;

		constructor(offsetX: number, offsetY: number) {
			super("");

			this.offsetX = offsetX;
			this.offsetY = offsetY;
		}
	}

	await listen("load", () => {
		invoke("load_canvas_state", { path: "./../output.txt" })
			.then((data) => {
				let betterData = data as Object;
				currentInputData = [];
				mainPath = new Path2D();

				for (let keys in Object.keys(betterData)) {
					//@ts-ignore
					currentInputData.push(betterData[keys]);
				}

				let setLastPoint = true;
				for (let i = 0; i < currentInputData.length; i += 2) {
					if (currentInputData[i] == "!") {
						i = i - 1;
						setLastPoint = true;
						continue;
					}

					let c = {
						x: currentInputData[i],
						y: currentInputData[i + 1],
					};

					if (setLastPoint) {
						setLastPoint = false;

						lastPoint.x = c.x;
						lastPoint.y = c.y;
					}

					let mouse = new CustomMouseEvent(c.x, c.y);
					mouseMoveCallback(mouse, false);
				}
			})
			.catch();
	});
});
