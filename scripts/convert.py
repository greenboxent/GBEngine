import math
from pathlib import Path
from PIL import Image

RATIOS = {
    "1": ("4:3", (4, 3)),
    "2": ("3:4", (3, 4)),
    "3": ("16:10", (16, 10)),
    "4": ("10:16", (10, 16)),
    "5": ("1:1", (1, 1)),
    "6": ("16:9", (16, 9)),
    "7": ("9:16", (9, 16)),
}

RATIO_BY_NAME = {name: dims for name, dims in RATIOS.values()}
VALID_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}


def clean_path(raw: str) -> Path:
    """Strips surrounding quotes added when dragging/dropping folders into VS Code terminal."""
    return Path(raw.strip().strip('"').strip("'"))


def get_exact_target_size(w: int, h: int, rw: int, rh: int, min_side: int) -> tuple[int, int]:
    """Calculates the smallest exact integer multiple of (rw, rh) where width >= w, height >= h, and both >= min_side."""
    multiplier = max(
        math.ceil(w / rw),
        math.ceil(h / rh),
        math.ceil(min_side / rw),
        math.ceil(min_side / rh),
    )
    return multiplier * rw, multiplier * rh


def process_image(img_path: Path, output_dir: Path, ratio_name: str, rw: int, rh: int, mode: str, min_side: int):
    with Image.open(img_path) as img:
        if img.mode != "RGB":
            img = img.convert("RGB")

        w, h = img.size
        new_w, new_h = get_exact_target_size(w, h, rw, rh, min_side)

        if mode == "s":
            # Stretch directly to exact target dimensions
            result = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            mode_label = "stretch"
        else:
            # If min_side forced the canvas larger than the image on both axes,
            # scale the image up proportionally so it touches two edges (avoids 4-sided black bars)
            scale = min(new_w / w, new_h / h)
            if scale > 1.0:
                scaled_w = min(new_w, round(w * scale))
                scaled_h = min(new_h, round(h * scale))
                img = img.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
                cur_w, cur_h = scaled_w, scaled_h
            else:
                cur_w, cur_h = w, h

            result = Image.new("RGB", (new_w, new_h), (0, 0, 0))
            offset_x = (new_w - cur_w) // 2
            offset_y = (new_h - cur_h) // 2
            result.paste(img, (offset_x, offset_y))
            mode_label = "fill"

        safe_ratio = ratio_name.replace(":", "x")
        out_name = f"{img_path.stem}_{safe_ratio}_{mode_label}_{new_w}x{new_h}.png"
        out_path = output_dir / out_name

        result.save(out_path, format="PNG")
        print(f"\n[OK] Saved ({mode_label}): {out_path}")
        print(f"     {w}x{h} -> {new_w}x{new_h} ({ratio_name})\n")


def get_images(folder: Path) -> list[Path]:
    return sorted(
        [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in VALID_EXTENSIONS],
        key=lambda p: p.name.lower(),
    )


def main():
    print("=== Aspect Ratio Converter ===\n")

    # 1. Input Folder
    while True:
        in_str = input("Input folder path (or drag & drop here): ").strip()
        if not in_str:
            print("Please enter a valid folder path.")
            continue
        input_dir = clean_path(in_str)
        if input_dir.is_dir():
            break
        print(f"Folder not found: {input_dir}\n")

    # 2. Output Folder
    default_out = input_dir / "output"
    out_str = input(f"Output folder path [Enter for {default_out}]: ").strip()
    output_dir = clean_path(out_str) if out_str else default_out
    output_dir.mkdir(parents=True, exist_ok=True)

    # 3. Minimum Side Length (Up Front)
    while True:
        min_str = input("Minimum side length in px [Enter for 0 / no minimum]: ").strip()
        if min_str == "":
            min_side = 0
            break
        if min_str.isdigit():
            min_side = int(min_str)
            break
        print("Please enter a whole number (e.g., 1080) or press Enter for 0.")

    # 4. Stretch or Fill Mode (Up Front)
    while True:
        mode_choice = input("Mode - [s]tretch or [f]ill with black bars [Enter for f]: ").strip().lower()
        if mode_choice == "":
            mode_choice = "f"
        if mode_choice in ("s", "f"):
            break
        print("Please enter 's' for stretch or 'f' for fill.")

    mode_name = "Stretch" if mode_choice == "s" else "Fill (Black Bars)"
    print(f"\nSettings locked: Mode = {mode_name} | Min Side = {min_side}px")

    # 5. Interactive Conversion Loop
    while True:
        images = get_images(input_dir)
        if not images:
            print(f"\nNo images found in {input_dir}.")
            retry = input("Press Enter to refresh, or type 'q' to quit: ").strip().lower()
            if retry == "q":
                break
            continue

        print("\n--- Files in Input Folder ---")
        for idx, p in enumerate(images, start=1):
            with Image.open(p) as img:
                w, h = img.size
            print(f"  {idx}. {p.name} ({w}x{h})")

        file_choice = input("\nSelect file (number or filename), 'r' to refresh, or 'q' to quit: ").strip()
        if file_choice.lower() == "q":
            break
        if file_choice.lower() == "r":
            continue

        selected_file = None
        if file_choice.isdigit():
            idx = int(file_choice) - 1
            if 0 <= idx < len(images):
                selected_file = images[idx]
        else:
            candidate = input_dir / file_choice
            if candidate.is_file():
                selected_file = candidate

        if not selected_file:
            print("Invalid file selection. Try again.")
            continue

        # Select Ratio
        print("\n--- Target Ratio ---")
        for key, (name, _) in RATIOS.items():
            print(f"  {key}. {name}")

        ratio_choice = input("\nSelect ratio (1-7 or e.g. 10:16), or 'b' to go back: ").strip()
        if ratio_choice.lower() == "b":
            continue

        if ratio_choice in RATIOS:
            ratio_name, (rw, rh) = RATIOS[ratio_choice]
        elif ratio_choice in RATIO_BY_NAME:
            ratio_name = ratio_choice
            rw, rh = RATIO_BY_NAME[ratio_choice]
        else:
            print("Invalid ratio. Try again.")
            continue

        process_image(selected_file, output_dir, ratio_name, rw, rh, mode_choice, min_side)

    print("Done.")


if __name__ == "__main__":
    main()