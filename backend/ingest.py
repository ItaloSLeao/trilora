import io
import json
import re
import sys
import zipfile
from pathlib import PurePosixPath

from defusedxml import ElementTree
from pypdf import PdfReader

LIMIT = 4 * 1024 * 1024


def filename(value):
    name = PurePosixPath(value.replace(chr(92), "/")).name
    return re.sub(r"[^\w .()-]", "_", name)[:150]


def check(name, blob):
    ext = name.rsplit(".", 1)[-1].lower()
    if not 0 < len(blob) <= LIMIT or ext not in {"pdf", "docx", "txt", "md"}:
        raise ValueError("Formato ou tamanho inválido (máximo 4 MiB).")
    if ext == "pdf" and not blob.startswith(b"%PDF-"):
        raise ValueError("Assinatura PDF inválida.")
    if ext == "docx":
        try:
            with zipfile.ZipFile(io.BytesIO(blob)) as archive:
                entries = archive.infolist()
                if (
                    len(entries) > 1500
                    or sum(i.file_size for i in entries) > 16 * LIMIT
                    or not {"word/document.xml", "[Content_Types].xml"}
                    <= set(archive.namelist())
                ):
                    raise ValueError("DOCX incompatível.")
        except zipfile.BadZipFile:
            raise ValueError("Arquivo DOCX inválido.")
    if ext in {"md", "txt"}:
        try:
            text = blob.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise ValueError("Use texto UTF-8.")
        if any(ord(c) < 32 and c not in "\r\n\t" for c in text):
            raise ValueError("Conteúdo binário.")
    return ext


def fragments(name, blob):
    ext = check(name, blob)
    if ext == "pdf":
        pdf = PdfReader(io.BytesIO(blob))
        if pdf.is_encrypted or len(pdf.pages) > 160:
            raise ValueError("PDF protegido ou muito extenso.")
        pages = ((i, p.extract_text() or "") for i, p in enumerate(pdf.pages, 1))
    elif ext == "docx":
        with zipfile.ZipFile(io.BytesIO(blob)) as archive:
            types = ElementTree.fromstring(archive.read("[Content_Types].xml"))
            if not any(
                n.get("PartName") == "/word/document.xml"
                and n.get("ContentType")
                == "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
                for n in types
            ):
                raise ValueError("Tipo de documento Word inválido.")
            xml = ElementTree.fromstring(archive.read("word/document.xml"))
            if xml.tag not in {
                "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}document",
                "{http://purl.oclc.org/ooxml/wordprocessingml/main}document",
            }:
                raise ValueError("Documento Word inválido.")
        pages = [
            (None, "\n".join("".join(n.itertext()) for n in xml.findall(".//{*}p")))
        ]
    else:
        pages = [(None, blob.decode("utf-8-sig"))]
    chunks = []
    for page, text in pages:
        text = text.strip().replace("\x00", "")
        for start in range(0, len(text), 900):
            body = text[start : start + 1020].strip()
            if body:
                chunks.append({"page": page, "body": body})
            if len(chunks) > 160:
                raise ValueError("Texto excede 160 fragmentos.")
            if start + 1020 >= len(text):
                break
    if not chunks:
        raise ValueError(
            "Documento sem texto extraível. PDFs digitalizados precisam de OCR prévio."
        )
    return chunks


if __name__ == "__main__":
    import resource

    resource.setrlimit(resource.RLIMIT_AS, (512 * 1024**2, 512 * 1024**2))
    resource.setrlimit(resource.RLIMIT_CPU, (15, 15))
    try:
        print(json.dumps(fragments(sys.argv[1], sys.stdin.buffer.read(LIMIT + 1))))
    except Exception as exc:
        print(
            str(exc) if isinstance(exc, ValueError) else "Falha na extração.",
            file=sys.stderr,
        )
        sys.exit(2)
