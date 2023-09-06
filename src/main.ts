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

    upArrow = "ArrowUp",
    leftArrow = "ArrowLeft",
    rightArrow = "ArrowRight",
    downArrow = "ArrowDown",
}

enum ToolType {
    pencil = 0,
    eraser = 1,
}

let cursorIndicator: HTMLDivElement | null;

let shadowDisplay: HTMLCanvasElement | null;
let shadowDisplayContext: CanvasRenderingContext2D | null;

let viewPort: HTMLCanvasElement | null;
let viewPortContext: CanvasRenderingContext2D | null;

let backgroundDisplay: HTMLCanvasElement | null;
let backgroundDisplayContext: CanvasRenderingContext2D | null;

let oldCanvasContent: HTMLImageElement | null;
let currentOpenFilePath: String | String[] | null;

let pencilSizeInput: HTMLInputElement | null;
let eraserSizeInput: HTMLInputElement | null;

let currentTool: ToolType = ToolType.pencil;
let currentPressedButton: KeyTypes = KeyTypes.none;

let currentPath: Path2DWithMeta | null;
let pathsInSession: Path2DWithMeta[] = [];
let lastUndoes: Path2DWithMeta[] = [];

let pencilBuffer: Point[] = [];
let eraserBuffer: Point[] = [];

let eraserSize = 50;
let pencilSize = 5;

let lastPointDrawn: Point | null;
let hasBeganNewPath: boolean = false;

let offsetY = 0;
let offsetX = 0;
let offsetStep = 15;

let displayOffsetY = 0;
let displayOffsetX = 0;

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

function drawAllSessionLines(offset: { x: number; y: number } | undefined = undefined) {
    for (let i = 0; i < pathsInSession.length; i++) {
        let path = pathsInSession[i];

        if (path.type == "pencil") {
            shadowDisplayContext!.save();
            shadowDisplayContext!.lineWidth = path.size;
            shadowDisplayContext!.strokeStyle = "grey";
            shadowDisplayContext!.lineJoin = "round";
            shadowDisplayContext!.lineCap = "round";

            if (offset) {
                let matrix = new DOMMatrix();
                matrix.a = 1;
                matrix.b = 0;
                matrix.c = 0;
                matrix.d = 1;
                matrix.e = offset.x; // x
                matrix.f = offset.y; // y

                let newPath = new Path2D();
                newPath.addPath(path.path, matrix);

                path.path = newPath;
            }

            shadowDisplayContext!.stroke(path.path);
            shadowDisplayContext!.restore();
        }

        if (path.type == "eraser") {
            shadowDisplayContext!.save();
            shadowDisplayContext!.globalCompositeOperation = "destination-out";
            shadowDisplayContext!.lineWidth = path.size;
            shadowDisplayContext!.lineJoin = "round";
            shadowDisplayContext!.lineCap = "round";

            if (offset) {
                let matrix = new DOMMatrix();
                matrix.a = 1;
                matrix.b = 0;
                matrix.c = 0;
                matrix.d = 1;
                matrix.e = offset.x; // x
                matrix.f = offset.y; // y

                let newPath = new Path2D();
                newPath.addPath(path.path, matrix);

                path.path = newPath;
            }

            shadowDisplayContext!.stroke(path!.path);
            shadowDisplayContext!.restore();
        }
    }
}

function drawBackground() {
    return;

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
        if (hasBeganNewPath) {
            lastPointDrawn = null;
            hasBeganNewPath = false;
        }

        if (!lastPointDrawn) lastPointDrawn = pencilBuffer[0];
        shadowDisplayContext!.beginPath();

        shadowDisplayContext!.save();
        shadowDisplayContext!.lineWidth = currentPath!.size;
        shadowDisplayContext!.strokeStyle = "grey";
        shadowDisplayContext!.lineJoin = "round";
        shadowDisplayContext!.lineCap = "round";

        for (let point of pencilBuffer) {
            currentPath!.path.lineTo(point.x - offsetX, point.y - offsetY);

            shadowDisplayContext!.moveTo(lastPointDrawn.x - offsetX, lastPointDrawn.y - offsetY);
            shadowDisplayContext!.lineTo(point.x - offsetX, point.y - offsetY);

            lastPointDrawn = point;
        }

        shadowDisplayContext!.stroke();
        shadowDisplayContext!.restore();

        pencilBuffer = [];

        viewPortContext!.clearRect(0, 0, viewPort!.width, viewPort!.height);
        viewPortContext!.drawImage(shadowDisplay!, offsetX, offsetY);
    }

    if (eraserBuffer.length > 0) {
        for (let point of eraserBuffer) {
            currentPath!.path.lineTo(point.x - offsetX, point.y - offsetY);
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
        viewPortContext!.drawImage(shadowDisplay!, offsetX, offsetY);
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

function updateCursorIndicator(event?: PointerEvent) {
    let size = 0;

    if (currentTool === ToolType.pencil) {
        size = pencilSize;
        cursorIndicator!.style.borderColor = "var(--sea-foam-green)";
        cursorIndicator!.style.backgroundColor = "var(--sea-foam-green-trans)";
    }

    if (currentTool === ToolType.eraser) {
        size = eraserSize;
        cursorIndicator!.style.borderColor = "var(--pastel-red)";
        cursorIndicator!.style.backgroundColor = "var(--pastel-red-trans)";
    }

    cursorIndicator!.style.width = size + "px";
    cursorIndicator!.style.height = size + "px";

    if (event) {
        let left = event.pageX;
        let top = event.pageY;
        cursorIndicator!.style.left = left + "px";
        cursorIndicator!.style.top = top + "px";
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
        viewPortContext!.drawImage(shadowDisplay!, offsetX, offsetY);
    };
}

window.addEventListener("DOMContentLoaded", async () => {
    window.requestAnimationFrame(drawBuffers);

    cursorIndicator = <HTMLDivElement>document.getElementById("circle");

    shadowDisplay = <HTMLCanvasElement>document.createElement("canvas");
    shadowDisplayContext = shadowDisplay!.getContext("2d")!;

    viewPort = <HTMLCanvasElement>document.getElementById("canvas");
    viewPortContext = viewPort!.getContext("2d")!;

    backgroundDisplay = <HTMLCanvasElement>document.getElementById("canvas-background");
    backgroundDisplayContext = backgroundDisplay!.getContext("2d")!;

    pencilSizeInput = <HTMLInputElement>document.getElementById("pencil-size-input");
    pencilSizeInput.value = `${pencilSize}`;

    eraserSizeInput = <HTMLInputElement>document.getElementById("eraser-size-input");
    eraserSizeInput.value = `${eraserSize}`;

    setCanvasSizeToReference(shadowDisplay, viewPort);
    setCanvasSizeToSelf(viewPort);
    setCanvasSizeToSelf(backgroundDisplay);
    drawBackground();

    viewPort.addEventListener("pointermove", updateCursorIndicator);

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

        viewPortContext!.drawImage(shadowDisplay!, offsetX, offsetY);
    });

    window.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key == KeyTypes.leftArrow) {
            offsetX -= offsetStep;

            if (shadowDisplay!.width + offsetX < viewPort!.width) {
                shadowDisplay!.width += offsetStep;
                offsetX += offsetStep;

                displayOffsetX -= offsetStep;
                if (oldCanvasContent) shadowDisplayContext?.drawImage(oldCanvasContent!, displayOffsetX, displayOffsetY);
                drawAllSessionLines({ x: offsetStep * -1, y: 0 });
            }

            viewPortContext!.clearRect(0, 0, viewPort!.width, viewPort!.height);
            viewPortContext!.drawImage(shadowDisplay!, offsetX, offsetY);
        }

        if (event.key == KeyTypes.upArrow) {
            offsetY -= offsetStep;

            if (shadowDisplay!.height + offsetY < viewPort!.height) {
                shadowDisplay!.height += offsetStep;
                offsetY += offsetStep;

                displayOffsetY -= offsetStep;
                if (oldCanvasContent) shadowDisplayContext?.drawImage(oldCanvasContent!, displayOffsetX, displayOffsetY);
                drawAllSessionLines({ x: 0, y: offsetStep * -1 });
            }

            viewPortContext!.clearRect(0, 0, viewPort!.width, viewPort!.height);
            viewPortContext!.drawImage(shadowDisplay!, offsetX, offsetY);
        }

        if (event.key == KeyTypes.rightArrow) {
            offsetX += offsetStep;

            if (offsetX > 0) {
                shadowDisplay!.width += offsetStep;
                offsetX -= offsetStep;

                displayOffsetX += offsetStep;
                if (oldCanvasContent) shadowDisplayContext?.drawImage(oldCanvasContent!, displayOffsetX, displayOffsetY);
                drawAllSessionLines({ x: offsetStep, y: 0 });
            }

            viewPortContext!.clearRect(0, 0, viewPort!.width, viewPort!.height);
            viewPortContext!.drawImage(shadowDisplay!, offsetX, offsetY);
        }

        if (event.key == KeyTypes.downArrow) {
            offsetY += offsetStep;

            if (offsetY > 0) {
                shadowDisplay!.height += offsetStep;
                offsetY -= offsetStep;

                displayOffsetY += offsetStep;
                if (oldCanvasContent) shadowDisplayContext?.drawImage(oldCanvasContent!, displayOffsetX, displayOffsetY);
                drawAllSessionLines({ x: 0, y: offsetStep });
            }

            viewPortContext!.clearRect(0, 0, viewPort!.width, viewPort!.height);
            viewPortContext!.drawImage(shadowDisplay!, offsetX, offsetY);
        }

        // if (event.key == KeyTypes.leftArrow || event.key == KeyTypes.rightArrow || event.key == KeyTypes.downArrow || event.key == KeyTypes.upArrow) {
        //     console.log(shadowDisplay!.width + offsetX > viewPort!.width ? "X overflow left" : "X normal left");
        //     console.log(shadowDisplay!.height + offsetY > viewPort!.height ? "Y overflow top" : "Y normal top");

        //     console.log(shadowDisplay!.width + offsetX < viewPort!.width ? "X overflow right" : "X normal right");
        //     console.log(shadowDisplay!.height + offsetY < viewPort!.height ? "Y overflow bottom" : "Y normal bottom");

        //     console.log("--/--/--/--/--/--/--/--/--/--/--");
        // }
    });

    viewPort.addEventListener("pointerenter", () => {
        cursorIndicator!.style.display = "block";
    });

    viewPort.addEventListener("pointerleave", (event) => {
        cursorIndicator!.style.display = "none";

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
        hasBeganNewPath = true;
        currentPressedButton = event.button;

        if (currentTool == ToolType.pencil) {
            currentPath! = new Path2DWithMeta(new Path2D(), "pencil", pencilSize);
            viewPort?.addEventListener("pointermove", updatePencilBuffer, { passive: true });
        }

        if (currentTool == ToolType.eraser) {
            currentPath! = new Path2DWithMeta(new Path2D(), "eraser", eraserSize);
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

    eraserSizeInput.addEventListener("input", () => {
        eraserSize = Number(eraserSizeInput!.value);
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
        if (oldCanvasContent) shadowDisplayContext?.drawImage(oldCanvasContent!, 0, 0);
        drawAllSessionLines();

        viewPortContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);
        viewPortContext!.drawImage(shadowDisplay!, offsetX, offsetY);
    });

    await listen("redo", async () => {
        if (lastUndoes.length == 0) return;

        pathsInSession.push(lastUndoes.pop()!);

        shadowDisplayContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);
        if (oldCanvasContent) shadowDisplayContext?.drawImage(oldCanvasContent!, 0, 0);
        drawAllSessionLines();

        viewPortContext!.clearRect(0, 0, shadowDisplay!.width, shadowDisplay!.height);
        viewPortContext!.drawImage(shadowDisplay!, offsetX, offsetY);
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

    await listen("eraser-size", () => {
        document.getElementById("eraser-size")!.style.display = "grid";
    });
});
