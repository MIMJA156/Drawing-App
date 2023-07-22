let canvas: HTMLCanvasElement | null;

function setCanvasContextSize(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
	ctx.canvas.width = canvas.getBoundingClientRect().width - 8;
	ctx.canvas.height = canvas.getBoundingClientRect().height - 8;
}

function drawFromPointer(path: Path2D, ctx: CanvasRenderingContext2D, event: MouseEvent, lastPoint: { x: number; y: number }) {
	path.moveTo(lastPoint.x, lastPoint.y);
	path.lineTo(event.offsetX, event.offsetY);

	ctx.strokeStyle = "grey";
	ctx.stroke(path);

	lastPoint.x = event.offsetX;
	lastPoint.y = event.offsetY;
}

function drawBackground() {}

window.addEventListener("DOMContentLoaded", () => {
	canvas = <HTMLCanvasElement>document.getElementById("canvas");
	let ctx = canvas!.getContext("2d")!;

	let path = new Path2D();
	let lastPoint = { x: 0, y: 0 };

	setCanvasContextSize(ctx, canvas!);
	window.addEventListener("resize", () => {
		setCanvasContextSize(ctx, canvas!);

		ctx.strokeStyle = "grey";
		ctx.stroke(path);
	});

	let mouseMoveCallback = (event: MouseEvent) => {
		ctx.clearRect(0, 0, canvas!.width, canvas!.height);

		path.moveTo(lastPoint.x, lastPoint.y);
		path.lineTo(event.offsetX, event.offsetY);

		ctx.strokeStyle = "grey";
		ctx.stroke(path);

		lastPoint.x = event.offsetX;
		lastPoint.y = event.offsetY;
	};

	canvas.addEventListener("mouseenter", (event) => {
		lastPoint.x = event.offsetX;
		lastPoint.y = event.offsetY;
	});

	canvas.addEventListener("mouseleave", (event) => {
		mouseMoveCallback(event);
		canvas?.removeEventListener("mousemove", mouseMoveCallback);
	});

	canvas.addEventListener("mousedown", (event) => {
		lastPoint.x = event.offsetX;
		lastPoint.y = event.offsetY;

		canvas!.addEventListener("mousemove", mouseMoveCallback);
	});

	canvas.addEventListener("mouseup", () => {
		canvas?.removeEventListener("mousemove", mouseMoveCallback);
	});
});
