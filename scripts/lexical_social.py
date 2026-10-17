"""Exact, locally rendered social cards from the approved public projection only."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

PAPER = '#f5efdf'
INK = '#193d38'
GOLD = '#d9bd72'


def font(size, serif=False):
    name = 'DejaVuSerif.ttf' if serif else 'DejaVuSans.ttf'
    return ImageFont.truetype(name, size)


def social_name(term):
    fields = [term.get(key, '') for key in ('headword', 'definition', 'definitionStatus', 'stage')]
    digest = hashlib.sha256(json.dumps(fields, ensure_ascii=False).encode()).hexdigest()[:12]
    return f"{term['slug']}-{digest}.png"


def wrapped(draw, value, face, width):
    lines, line = [], ''
    for word in value.split():
        trial = f'{line} {word}'.strip()
        if draw.textlength(trial, font=face) <= width:
            line = trial
            continue
        if line:
            lines.append(line)
        line = word
        # A headword may contain no spaces at all.
        while draw.textlength(line, font=face) > width:
            cut = len(line) - 1
            while cut > 1 and draw.textlength(line[:cut], font=face) > width:
                cut -= 1
            lines.append(line[:cut])
            line = line[cut:]
    if line:
        lines.append(line)
    return lines


def fit(draw, value, width, height, size, minimum=24, serif=False):
    for point in range(size, minimum - 1, -1):
        face = font(point, serif)
        lines = wrapped(draw, value, face, width)
        if len(lines) * int(point * 1.35) <= height:
            return face, lines, int(point * 1.35)
    face = font(minimum, serif)
    lines = wrapped(draw, value, face, width)
    count = max(1, height // int(minimum * 1.35))
    if len(lines) > count:
        lines = lines[:count]
        while draw.textlength(lines[-1] + '…', font=face) > width:
            lines[-1] = lines[-1][:-1]
        lines[-1] = lines[-1].rstrip(' ,;:') + '…'
    return face, lines, int(minimum * 1.35)


def mark(image, box):
    """The site's botanical ampersand, legible even at favicon size."""
    x, y, size = box
    layer = Image.new('RGBA', (400, 400))
    d = ImageDraw.Draw(layer)
    d.ellipse((8, 8, 392, 392), fill=INK)
    d.ellipse((32, 32, 368, 368), outline=GOLD, width=4)
    for angle in (-35, 35):
        orbit = Image.new('RGBA', layer.size)
        ImageDraw.Draw(orbit).ellipse((65, 130, 335, 265), outline=PAPER, width=4)
        layer.alpha_composite(orbit.rotate(angle, resample=Image.Resampling.BICUBIC))
    d = ImageDraw.Draw(layer)
    d.line((200, 196, 200, 333), fill=PAPER, width=5)
    d.arc((110, 220, 205, 305), 10, 170, fill=PAPER, width=5)
    d.arc((195, 260, 300, 330), 190, 350, fill=PAPER, width=5)
    d.ellipse((134, 128, 266, 260), fill=INK)
    d.text((200, 194), '&', font=font(112, True), fill=PAPER, anchor='mm')
    d.ellipse((80, 120, 99, 139), fill=GOLD)
    image.paste(layer.resize((size, size), Image.Resampling.LANCZOS), (x, y), layer.resize((size, size), Image.Resampling.LANCZOS))


def render_card(path, term=None):
    image = Image.new('RGB', (1200, 630), PAPER)
    d = ImageDraw.Draw(image)
    d.rectangle((0, 0, 19, 630), fill=INK)
    d.rectangle((38, 30, 1170, 600), outline='#b6baa6', width=2)
    d.line((74, 124, 1124, 124), fill='#b6baa6', width=2)
    d.text((76, 64), 'LEXICAL OBSERVATORY', font=font(25), fill=INK)
    d.text((1124, 69), 'B’sMyth', anchor='ra', font=font(22, True), fill=INK)
    # Deliberately restrained decoration leaves the actual definition dominant.
    mark(image, (956, 168, 160))
    heading = term['headword'] if term else 'A thought walks\ninto a word.'
    heading = ' '.join(heading.split())
    face, lines, leading = fit(d, heading, 845, 180, 81, 34, True)
    for i, line in enumerate(lines):
        d.text((74, 150 + i * leading), line, font=face, fill=INK)
    definition = term.get('definition', '').strip() if term else 'Words are not merely invented. They are observed becoming.'
    definition = definition or 'A word in the making. Definition pending.'
    if len(definition) > 1200:
        definition = definition[:1199].rstrip() + '…'
    face, lines, leading = fit(d, definition, 1020, 158, 34)
    for i, line in enumerate(lines):
        d.text((76, 355 + i * leading), line, font=face, fill=INK)
    states = {'author_supplied': 'AUTHOR-SUPPLIED DEFINITION', 'conversation_recovered': 'RECOVERED WORKING DEFINITION',
              'inferred_definition': 'PROVISIONAL INTERPRETATION', 'awaiting_definition': 'DEFINITION PENDING'}
    caption = states.get(term.get('definitionStatus'), 'WORKING DEFINITION') if term else 'LANGUAGE / CURIOSITY / A LITTLE MISCHIEF'
    d.line((74, 542, 1124, 542), fill='#b6baa6', width=2)
    d.text((76, 562), caption, font=font(18), fill=INK)
    d.text((1124, 562), term['stage'].upper() if term else 'EXPLORE THE ARCHIVE', anchor='ra', font=font(18), fill=INK)
    image.save(path, optimize=True)


def build_social(terms, out):
    out = Path(out)
    social = out / 'social'
    social.mkdir(parents=True, exist_ok=True)
    keep = {'observatory.png'} | {social_name(term) for term in terms}
    for old in social.glob('*.png'):
        if old.name not in keep:
            old.unlink()
    render_card(social / 'observatory.png')
    for term in terms:
        render_card(social / social_name(term), term)
    icon = Image.new('RGBA', (512, 512))
    mark(icon, (0, 0, 512))
    icon.save(out / 'icon-512.png')
    icon.resize((180, 180), Image.Resampling.LANCZOS).save(out / 'apple-touch-icon.png')
    icon.save(out / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
