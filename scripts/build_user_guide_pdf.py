#!/usr/bin/env python3
"""Build docs/USER_GUIDE.pdf from docs/USER_GUIDE.md.

Requires ReportLab: python -m pip install reportlab
Run from any directory: python scripts/build_user_guide_pdf.py
"""
from __future__ import annotations

import html
import math
import re
from pathlib import Path

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import (
        Flowable,
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )
    from reportlab.platypus.tableofcontents import TableOfContents
except ImportError as exc:  # pragma: no cover - helpful message for fresh checkouts
    raise SystemExit(
        "PDF generation requires ReportLab. Install it with: "
        "python -m pip install reportlab"
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "USER_GUIDE.md"
OUTPUT = ROOT / "docs" / "USER_GUIDE.pdf"
COVER_IMAGE = ROOT / "frontend" / "src" / "assets" / "hero-botanical.jpg"
PAGE_WIDTH, PAGE_HEIGHT = A4
LEFT_MARGIN = 0.72 * inch
RIGHT_MARGIN = 0.72 * inch
TOP_MARGIN = 0.78 * inch
BOTTOM_MARGIN = 0.66 * inch
CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN

FOREST = colors.HexColor("#174D3A")
FOREST_DARK = colors.HexColor("#0C2E23")
GREEN = colors.HexColor("#267653")
PALE_GREEN = colors.HexColor("#EEF6F0")
PALE_BLUE = colors.HexColor("#EEF4F8")
PALE_AMBER = colors.HexColor("#FFF7E8")
INK = colors.HexColor("#26332C")
MUTED = colors.HexColor("#66736B")
RULE = colors.HexColor("#DDE6DF")


def find_font(candidates: list[str]) -> str | None:
    for candidate in candidates:
        path = Path(candidate)
        if path.is_file():
            return str(path)
    return None


def register_fonts() -> tuple[str, str, str]:
    regular = find_font([
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ])
    bold = find_font([
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ])
    mono = find_font([
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/Library/Fonts/Courier New.ttf",
        "/System/Library/Fonts/Supplemental/Courier New.ttf",
        "C:/Windows/Fonts/consola.ttf",
    ])

    if regular and bold and mono:
        pdfmetrics.registerFont(TTFont("GuideSans", regular))
        pdfmetrics.registerFont(TTFont("GuideSans-Bold", bold))
        pdfmetrics.registerFont(TTFont("GuideMono", mono))
        return "GuideSans", "GuideSans-Bold", "GuideMono"

    # Built-in fonts are a usable fallback on systems without a common TTF font.
    return "Helvetica", "Helvetica-Bold", "Courier"


FONT, FONT_BOLD, FONT_MONO = register_fonts()


def inline_markup(raw: str) -> str:
    """Convert the small inline-Markdown subset used by the guide to Paragraph XML."""
    token_re = re.compile(
        r"(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*.+?\*\*|(?<!\*)\*[^*]+\*(?!\*))"
    )
    output: list[str] = []
    position = 0
    for match in token_re.finditer(raw):
        output.append(html.escape(raw[position:match.start()], quote=False))
        token = match.group(0)
        if token.startswith("["):
            link_match = re.fullmatch(r"\[([^\]]+)\]\(([^)]+)\)", token)
            if link_match:
                label = html.escape(link_match.group(1), quote=False)
                href = html.escape(link_match.group(2), quote=True)
                output.append(f'<link href="{href}" color="#267653"><u>{label}</u></link>')
            else:
                output.append(html.escape(token, quote=False))
        elif token.startswith("`"):
            code = html.escape(token[1:-1], quote=False)
            output.append(f'<font name="{FONT_MONO}" color="#174D3A">{code}</font>')
        elif token.startswith("**"):
            output.append(f"<b>{html.escape(token[2:-2], quote=False)}</b>")
        else:
            output.append(f"<i>{html.escape(token[1:-1], quote=False)}</i>")
        position = match.end()
    output.append(html.escape(raw[position:], quote=False))
    return "".join(output)


class CodeBlock(Flowable):
    """Compact, wrapping code panel that can split safely over pages."""

    def __init__(self, code: str, font_name: str, width: float = CONTENT_WIDTH):
        super().__init__()
        self.code = code
        self.font_name = font_name
        self.font_size = 7.3
        self.leading = 10.1
        self.padding = 8
        self.width = width
        self._lines: list[str] = []
        self.height = 0

    def _wrap_code(self, width: float) -> list[str]:
        available = max(30, width - 2 * self.padding)
        sample = pdfmetrics.stringWidth("M", self.font_name, self.font_size)
        max_chars = max(30, int(available / sample))
        result: list[str] = []
        for source_line in self.code.splitlines() or [""]:
            if len(source_line) <= max_chars:
                result.append(source_line)
                continue
            line = source_line
            while len(line) > max_chars:
                boundary = line.rfind(" ", 0, max_chars + 1)
                if boundary < max_chars // 2:
                    boundary = max_chars
                    result.append(line[:boundary])
                    line = "    " + line[boundary:]
                else:
                    result.append(line[:boundary])
                    line = "    " + line[boundary:].lstrip()
            result.append(line)
        return result

    def wrap(self, avail_width: float, avail_height: float) -> tuple[float, float]:
        self.width = avail_width
        self._lines = self._wrap_code(avail_width)
        self.height = self.padding * 2 + max(1, len(self._lines)) * self.leading
        return self.width, self.height

    def draw(self) -> None:
        canvas = self.canv
        canvas.saveState()
        canvas.setFillColor(PALE_GREEN)
        canvas.setStrokeColor(colors.HexColor("#D9E9DD"))
        canvas.roundRect(0, 0, self.width, self.height, 5, fill=1, stroke=1)
        text = canvas.beginText(self.padding, self.height - self.padding - self.font_size)
        text.setFont(self.font_name, self.font_size)
        text.setFillColor(colors.HexColor("#20382B"))
        text.setLeading(self.leading)
        for line in self._lines:
            text.textLine(line)
        canvas.drawText(text)
        canvas.restoreState()

    def split(self, avail_width: float, avail_height: float) -> list[Flowable]:
        self.wrap(avail_width, avail_height)
        usable = avail_height - 2 * self.padding
        fit = math.floor(usable / self.leading)
        if fit < 1 or len(self._lines) <= fit:
            return [self] if len(self._lines) <= fit else []
        first = self._lines[:fit]
        remainder = self._lines[fit:]
        return [
            WrappedCodeLines(first, self.font_name, self.font_size, self.leading, self.padding),
            WrappedCodeLines(remainder, self.font_name, self.font_size, self.leading, self.padding),
        ]


class WrappedCodeLines(CodeBlock):
    def __init__(self, lines: list[str], font_name: str, font_size: float, leading: float, padding: float):
        super().__init__("", font_name)
        self._lines = lines
        self.font_size = font_size
        self.leading = leading
        self.padding = padding

    def wrap(self, avail_width: float, avail_height: float) -> tuple[float, float]:
        self.width = avail_width
        self.height = self.padding * 2 + max(1, len(self._lines)) * self.leading
        return self.width, self.height


class UserGuideDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable: Flowable) -> None:  # noqa: N802 - ReportLab API
        if not isinstance(flowable, Paragraph) or flowable.style.name != "GuideHeading1":
            return
        title = flowable.getPlainText()
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
        key = f"section-{slug}"
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(title, key, level=0, closed=False)
        # TOC numbers align with the footer, which omits the unnumbered cover.
        self.notify("TOCEntry", (0, title, self.page - 1, key))


def draw_cover(canvas, doc) -> None:
    canvas.saveState()
    if COVER_IMAGE.is_file():
        from reportlab.lib.utils import ImageReader

        image = ImageReader(str(COVER_IMAGE))
        image_width, image_height = image.getSize()
        scale = max(PAGE_WIDTH / image_width, PAGE_HEIGHT / image_height)
        draw_width = image_width * scale
        draw_height = image_height * scale
        canvas.drawImage(
            image,
            (PAGE_WIDTH - draw_width) / 2,
            (PAGE_HEIGHT - draw_height) / 2,
            width=draw_width,
            height=draw_height,
            mask="auto",
        )
    else:  # graceful fallback if the botanical cover asset is moved later
        canvas.setFillColor(FOREST_DARK)
        canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)

    canvas.setFillColor(FOREST_DARK)
    if hasattr(canvas, "setFillAlpha"):
        canvas.setFillAlpha(0.76)
    canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    if hasattr(canvas, "setFillAlpha"):
        canvas.setFillAlpha(1)

    left = 0.78 * inch
    canvas.setFillColor(colors.HexColor("#BCE3C9"))
    canvas.setFont(FONT_BOLD, 9)
    canvas.drawString(left, PAGE_HEIGHT - 0.82 * inch, "HERBACAM  /  CAMEROONIAN PLANT KNOWLEDGE")

    canvas.setFillColor(colors.white)
    canvas.setFont(FONT_BOLD, 39)
    canvas.drawString(left, PAGE_HEIGHT - 3.28 * inch, "HERBACAM")
    canvas.setFillColor(colors.HexColor("#C5E8CE"))
    canvas.setFont(FONT_BOLD, 30)
    canvas.drawString(left, PAGE_HEIGHT - 3.80 * inch, "USER GUIDE")

    canvas.setFillColor(colors.white)
    canvas.setFont(FONT, 13)
    canvas.drawString(left, PAGE_HEIGHT - 4.28 * inch, "Backend setup  ·  Frontend setup  ·  Application walkthrough")

    canvas.setStrokeColor(colors.HexColor("#8CC89D"))
    canvas.setLineWidth(2)
    canvas.line(left, PAGE_HEIGHT - 4.63 * inch, left + 0.76 * inch, PAGE_HEIGHT - 4.63 * inch)

    canvas.setFillColor(colors.HexColor("#F1F7F1"))
    canvas.setFont(FONT, 10)
    canvas.drawString(left, 0.92 * inch, "The app is branded Ancestor in its interface; HerbaCam is the project name.")
    canvas.setFillColor(colors.HexColor("#C6D4C9"))
    canvas.setFont(FONT, 9)
    canvas.drawString(left, 0.65 * inch, "Local development and user workflows  ·  Revision 6 October 2026")
    canvas.restoreState()


def draw_page(canvas, doc) -> None:
    if doc.page == 1:
        draw_cover(canvas, doc)
        return

    canvas.saveState()
    canvas.setFillColor(FOREST)
    canvas.setFont(FONT_BOLD, 8)
    canvas.drawString(LEFT_MARGIN, PAGE_HEIGHT - 0.43 * inch, "HERBACAM  /  USER GUIDE")
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 7.5)
    canvas.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 0.43 * inch, "LOCAL SETUP + APPLICATION WORKFLOWS")
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.6)
    canvas.line(LEFT_MARGIN, PAGE_HEIGHT - 0.53 * inch, PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 0.53 * inch)
    canvas.line(LEFT_MARGIN, 0.48 * inch, PAGE_WIDTH - RIGHT_MARGIN, 0.48 * inch)
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 7.5)
    canvas.drawString(LEFT_MARGIN, 0.31 * inch, "Development guide  ·  6 October 2026")
    canvas.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, 0.31 * inch, f"Page {doc.page - 1}")
    canvas.restoreState()


def build_styles():
    sample = getSampleStyleSheet()
    styles = {}
    styles["Body"] = ParagraphStyle(
        "GuideBody",
        parent=sample["BodyText"],
        fontName=FONT,
        fontSize=8.8,
        leading=12.6,
        textColor=INK,
        spaceAfter=5.4,
        allowWidows=0,
        allowOrphans=0,
    )
    styles["Heading1"] = ParagraphStyle(
        "GuideHeading1",
        parent=sample["Heading1"],
        fontName=FONT_BOLD,
        fontSize=16.1,
        leading=19.3,
        textColor=FOREST,
        spaceBefore=14,
        spaceAfter=7,
        keepWithNext=True,
    )
    styles["Heading2"] = ParagraphStyle(
        "GuideHeading2",
        parent=sample["Heading2"],
        fontName=FONT_BOLD,
        fontSize=11.7,
        leading=14.1,
        textColor=colors.HexColor("#286247"),
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    )
    styles["Heading3"] = ParagraphStyle(
        "GuideHeading3",
        parent=sample["Heading3"],
        fontName=FONT_BOLD,
        fontSize=9.9,
        leading=12.1,
        textColor=INK,
        spaceBefore=5.5,
        spaceAfter=3,
        keepWithNext=True,
    )
    styles["Bullet"] = ParagraphStyle(
        "GuideBullet",
        parent=styles["Body"],
        leftIndent=15,
        firstLineIndent=-10,
        bulletFontName=FONT,
        bulletFontSize=8.5,
        bulletColor=GREEN,
        bulletIndent=2,
        spaceAfter=2.5,
    )
    styles["Table"] = ParagraphStyle(
        "GuideTableCell",
        parent=styles["Body"],
        fontSize=7.8,
        leading=10.2,
        spaceAfter=0,
    )
    styles["TableHeader"] = ParagraphStyle(
        "GuideTableHeader",
        parent=styles["Table"],
        fontName=FONT_BOLD,
        textColor=colors.white,
    )
    styles["Callout"] = ParagraphStyle(
        "GuideCallout",
        parent=styles["Body"],
        fontSize=8.6,
        leading=12.2,
        spaceAfter=0,
        textColor=colors.HexColor("#34443A"),
    )
    styles["TOCTitle"] = ParagraphStyle(
        "GuideTOCTitle",
        parent=styles["Heading1"],
        fontSize=19,
        leading=22,
        spaceBefore=0,
        spaceAfter=14,
    )
    return styles


def is_table_delimiter(line: str) -> bool:
    if "|" not in line:
        return False
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def table_cells(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def make_table(rows: list[list[str]], styles: dict) -> Table:
    if not rows:
        return Table([[]])
    columns = max(len(row) for row in rows)
    normalized = [row + [""] * (columns - len(row)) for row in rows]
    data = []
    for row_index, row in enumerate(normalized):
        style = styles["TableHeader"] if row_index == 0 else styles["Table"]
        data.append([Paragraph(inline_markup(cell), style) for cell in row])
    col_width = CONTENT_WIDTH / columns
    table = Table(
        data,
        colWidths=[col_width] * columns,
        repeatRows=1,
        hAlign="LEFT",
        splitByRow=1,
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), FOREST),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FAF8")]),
    ]))
    return table


def make_callout(text: str, styles: dict) -> Table:
    paragraph = Paragraph(inline_markup(text.strip()), styles["Callout"])
    callout = Table([[paragraph]], colWidths=[CONTENT_WIDTH], hAlign="LEFT")
    callout.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE_AMBER if "Important" in text or "Destructive" in text else PALE_BLUE),
        ("LINEBEFORE", (0, 0), (0, 0), 3, GREEN),
        ("BOX", (0, 0), (-1, -1), 0.35, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return callout


def make_toc() -> TableOfContents:
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle(
        "GuideTOCLevel0",
        fontName=FONT,
        fontSize=9,
        leading=14.2,
        textColor=FOREST,
        leftIndent=2,
        firstLineIndent=0,
        rightIndent=26,
        spaceBefore=2,
        spaceAfter=1,
    )]
    toc.dotsMinLevel = 0
    return toc


def parse_markdown(source: str, styles: dict) -> list[Flowable]:
    marker = "<!-- PDF:START -->"
    if marker not in source:
        raise ValueError(f"Could not find {marker!r} in {SOURCE}")
    lines = source.split(marker, 1)[1].splitlines()
    story: list[Flowable] = [PageBreak()]
    index = 0

    while index < len(lines):
        raw = lines[index]
        stripped = raw.strip()
        if not stripped or stripped.startswith("<!--"):
            if stripped == "<!-- TOC -->":
                story.append(Paragraph("Contents", styles["TOCTitle"]))
                story.append(make_toc())
                story.append(Spacer(1, 8))
                story.append(Paragraph(
                    "Section names in this contents list link to their place in the PDF.",
                    styles["Body"],
                ))
                story.append(PageBreak())
            index += 1
            continue

        if stripped.startswith("```"):
            code_lines: list[str] = []
            index += 1
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code_lines.append(lines[index].rstrip())
                index += 1
            story.append(CodeBlock("\n".join(code_lines), FONT_MONO))
            story.append(Spacer(1, 5))
            index += 1
            continue

        if stripped.startswith("## "):
            title = stripped[3:].strip()
            story.append(Paragraph(inline_markup(title), styles["Heading1"]))
            index += 1
            continue
        if stripped.startswith("### "):
            title = stripped[4:].strip()
            story.append(Paragraph(inline_markup(title), styles["Heading2"]))
            index += 1
            continue
        if stripped.startswith("#### "):
            title = stripped[5:].strip()
            story.append(Paragraph(inline_markup(title), styles["Heading3"]))
            index += 1
            continue

        # Markdown table: header row, delimiter row, then data rows.
        if "|" in stripped and index + 1 < len(lines) and is_table_delimiter(lines[index + 1].strip()):
            rows = [table_cells(stripped)]
            index += 2
            while index < len(lines) and "|" in lines[index].strip() and lines[index].strip():
                rows.append(table_cells(lines[index].strip()))
                index += 1
            story.append(make_table(rows, styles))
            story.append(Spacer(1, 7))
            continue

        # Consecutive blockquote lines become a compact, colored callout.
        if stripped.startswith(">"):
            quote_lines = []
            while index < len(lines) and lines[index].strip().startswith(">"):
                quote_lines.append(lines[index].strip()[1:].strip())
                index += 1
            story.append(make_callout(" ".join(quote_lines), styles))
            story.append(Spacer(1, 7))
            continue

        # Ordered and unordered list items. The text is a bullet in the PDF,
        # with the original list number preserved for ordered steps.
        unordered = re.match(r"^\s*[-*]\s+(.*)$", raw)
        ordered = re.match(r"^\s*(\d+)\.\s+(.*)$", raw)
        if unordered or ordered:
            while index < len(lines):
                list_line = lines[index]
                bullet = re.match(r"^\s*[-*]\s+(.*)$", list_line)
                number = re.match(r"^\s*(\d+)\.\s+(.*)$", list_line)
                if not bullet and not number:
                    break
                if bullet:
                    label, text = "•", bullet.group(1)
                else:
                    label, text = f"{number.group(1)}.", number.group(2)
                story.append(Paragraph(
                    inline_markup(text),
                    styles["Bullet"],
                    bulletText=label,
                ))
                index += 1
            story.append(Spacer(1, 3))
            continue

        if stripped == "---":
            story.append(Spacer(1, 5))
            index += 1
            continue

        # Join wrapped Markdown source lines into a normal paragraph.
        paragraph_lines = [stripped]
        index += 1
        while index < len(lines):
            next_stripped = lines[index].strip()
            if (
                not next_stripped
                or next_stripped.startswith("<!--")
                or next_stripped.startswith("```")
                or next_stripped.startswith("## ")
                or next_stripped.startswith("### ")
                or next_stripped.startswith("#### ")
                or next_stripped.startswith(">")
                or next_stripped == "---"
                or re.match(r"^\s*[-*]\s+", lines[index])
                or re.match(r"^\s*\d+\.\s+", lines[index])
                or ("|" in next_stripped and index + 1 < len(lines) and is_table_delimiter(lines[index + 1].strip()))
            ):
                break
            paragraph_lines.append(next_stripped)
            index += 1
        story.append(Paragraph(inline_markup(" ".join(paragraph_lines)), styles["Body"]))

    return story


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"User guide source not found: {SOURCE}")
    source = SOURCE.read_text(encoding="utf-8")
    styles = build_styles()
    story = parse_markdown(source, styles)

    doc = UserGuideDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=RIGHT_MARGIN,
        leftMargin=LEFT_MARGIN,
        topMargin=TOP_MARGIN,
        bottomMargin=BOTTOM_MARGIN,
        title="HerbaCam User Guide",
        author="HerbaCam project",
        subject="Local backend/frontend setup and application user workflows",
        pageCompression=1,
    )
    doc.multiBuild(story, onFirstPage=draw_page, onLaterPages=draw_page)
    print(f"Created {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
