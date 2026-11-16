"""Generate the synthetic placeholder fixtures. Run: python tests/fixtures/make_placeholders.py"""

from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent

PLATES = {
    "plate_01_pasta_tomato": [("#E8A93B", (150, 120, 490, 380))],
    "plate_02_rice_curry": [("#FFFAF2", (140, 130, 330, 370)), ("#D2693C", (320, 130, 500, 370))],
    "plate_03_burger_fries": [("#8E4A5B", (130, 160, 320, 350)), ("#E8A93B", (340, 150, 520, 360))],
    "plate_04_salad_bread": [("#8BA888", (140, 120, 420, 380)), ("#E6DCCD", (430, 200, 540, 300))],
    "plate_05_breakfast_juice": [("#E6DCCD", (120, 170, 360, 350)), ("#E8A93B", (420, 110, 520, 330))],
}
LABELS = ["label_01_fr_cereales", "label_02_en_soda", "label_03_de_joghurt"]


def plate(name: str, shapes) -> None:
    img = Image.new("RGB", (640, 480), "#6E625A")
    d = ImageDraw.Draw(img)
    d.ellipse((90, 60, 550, 440), fill="#FFFAF2", outline="#E6DCCD", width=6)
    for colour, box in shapes:
        d.ellipse(box, fill=colour)
    d.text((12, 10), f"PLACEHOLDER {name}", fill="#FFFAF2")
    img.save(HERE / "plates" / f"{name}.jpg", "JPEG", quality=80)


def label(name: str) -> None:
    img = Image.new("RGB", (480, 640), "#FFFAF2")
    d = ImageDraw.Draw(img)
    d.rectangle((30, 60, 450, 600), outline="#2B2420", width=3)
    for i in range(8):
        y = 110 + i * 60
        d.line((30, y, 450, y), fill="#2B2420", width=1)
    d.line((300, 60, 300, 600), fill="#2B2420", width=1)
    d.text((12, 10), f"PLACEHOLDER {name}", fill="#2B2420")
    img.save(HERE / "labels" / f"{name}.jpg", "JPEG", quality=80)


if __name__ == "__main__":
    for n, s in PLATES.items():
        plate(n, s)
    for n in LABELS:
        label(n)
