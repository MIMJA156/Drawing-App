import { invoke } from "@tauri-apps/api";
import { listen } from "@tauri-apps/api/event";

let mainDisplay: HTMLCanvasElement | null;
let backgroundDisplay: HTMLCanvasElement | null;

let mainPath = new Path2D();

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

window.addEventListener("DOMContentLoaded", () => {
	mainDisplay = <HTMLCanvasElement>document.getElementById("canvas");
	let mainDisplayContext = mainDisplay!.getContext("2d")!;

	backgroundDisplay = <HTMLCanvasElement>document.getElementById("canvas-background");
	let backgroundDisplayContext = backgroundDisplay!.getContext("2d")!;

	let lastPoint = { x: 0, y: 0 };
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

	let mouseMoveCallback = (event: MouseEvent) => {
		mainDisplayContext.clearRect(0, 0, mainDisplay!.width, mainDisplay!.height);

		mainPath.moveTo(lastPoint.x, lastPoint.y);
		mainPath.lineTo(event.offsetX, event.offsetY);

		mainDisplayContext.strokeStyle = "grey";
		mainDisplayContext.stroke(mainPath);

		lastPoint.x = event.offsetX;
		lastPoint.y = event.offsetY;
	};

	mainDisplay.addEventListener("mouseenter", (event) => {
		lastPoint.x = event.offsetX;
		lastPoint.y = event.offsetY;
	});

	mainDisplay.addEventListener("mouseleave", (event) => {
		if (mouseIsDown) {
			mouseIsDown = false;
			mouseMoveCallback(event);
		}

		mainDisplay?.removeEventListener("mousemove", mouseMoveCallback);
	});

	mainDisplay.addEventListener("mousedown", (event) => {
		mouseIsDown = true;
		lastPoint.x = event.offsetX;
		lastPoint.y = event.offsetY;

		mainDisplay?.addEventListener("mousemove", mouseMoveCallback);
	});

	mainDisplay.addEventListener("mouseup", () => {
		mouseIsDown = false;
		mainDisplay?.removeEventListener("mousemove", mouseMoveCallback);
	});
});

await listen("save", (event) => {
	console.log(event);
});
