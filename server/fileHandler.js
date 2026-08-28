const path = require("path");

/**
 * FILE HANDLER & MULTIMODAL INGESTION
 * -----------------------------------
 * Processes uploaded files (images, PDFs, CSVs, text/code) for Sia's multimodal reasoning.
 */

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_DOC_CHARS = 100000;

function isImageMime(mimeType = "") {
  return (
    mimeType.startsWith("image/") ||
    /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(mimeType)
  );
}

function isTabular(mimeType = "", fileName = "") {
  return (
    mimeType.includes("csv") ||
    mimeType.includes("spreadsheet") ||
    /\.(csv|tsv)$/i.test(fileName)
  );
}

function isDocumentOrCode(fileName = "") {
  return /\.(txt|md|json|js|ts|py|html|css|cpp|c|java|go|rs|sh|ps1|sql|yaml|yml|xml)$/i.test(fileName);
}

/**
 * Parses CSV raw text into a neat summary and Markdown preview table.
 */
function parseCsvToMarkdown(csvText, fileName = "CSV Dataset", maxRows = 10) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return `(Empty CSV file: ${fileName})`;

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const headerRow = `| ${headers.join(" | ")} |`;
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;

  const dataRows = lines.slice(1, maxRows + 1).map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
    return `| ${cells.join(" | ")} |`;
  });

  const preview = [headerRow, separatorRow, ...dataRows].join("\n");
  const totalRows = lines.length - 1;
  return `### ${fileName} (${totalRows} total rows, showing first ${Math.min(totalRows, maxRows)}):\n${preview}`;
}

/**
 * Normalizes uploaded files and builds OpenRouter-compatible multimodal payload.
 */
function processUploadedFile({ name, type, dataUrl, textContent }) {
  const ext = path.extname(name || "").toLowerCase();
  const mime = type || "application/octet-stream";

  if (isImageMime(mime) || /\.(png|jpe?g|webp|gif)$/i.test(name)) {
    return {
      kind: "image",
      name,
      mime: mime.startsWith("image/") ? mime : "image/jpeg",
      dataUrl, // Base64 data URL
      preview: `[Attached Image: ${name}]`,
    };
  }

  if (isTabular(mime, name) && textContent) {
    return {
      kind: "tabular",
      name,
      summary: parseCsvToMarkdown(textContent, name),
      rawText: textContent.slice(0, MAX_DOC_CHARS),
      preview: `[CSV Dataset: ${name}]`,
    };
  }

  if (textContent) {
    const truncated = textContent.slice(0, MAX_DOC_CHARS);
    return {
      kind: "document",
      name,
      ext,
      rawText: truncated,
      preview: `[File Attachment: ${name} (${truncated.length} chars)]`,
    };
  }

  return {
    kind: "unsupported",
    name,
    preview: `[Attached File: ${name}]`,
  };
}

/**
 * Constructs the message content payload for OpenRouter.
 * For images, creates OpenAI-style array of text + image_url parts.
 * For text/documents/CSV, inlines the extracted data cleanly.
 */
function formatMultimodalMessage(userText, files = []) {
  if (!files || files.length === 0) {
    return userText;
  }

  const imageFiles = files.filter((f) => f.kind === "image" && f.dataUrl);
  const textFiles = files.filter((f) => f.kind === "document" || f.kind === "tabular");

  let textAttachmentsBlock = "";
  if (textFiles.length > 0) {
    textAttachmentsBlock = "\n\n" + textFiles.map((f) => {
      if (f.kind === "tabular") {
        return `--- Attached File: ${f.name} ---\n${f.summary}\n\nFull Raw Data:\n${f.rawText}\n--- End of ${f.name} ---`;
      }
      return `--- Attached File: ${f.name} ---\n${f.rawText}\n--- End of ${f.name} ---`;
    }).join("\n\n");
  }

  const fullPromptText = `${userText}${textAttachmentsBlock}`;

  if (imageFiles.length === 0) {
    return fullPromptText;
  }

  // OpenRouter Multimodal format (array of content blocks)
  const contentParts = [
    { type: "text", text: fullPromptText },
    ...imageFiles.map((img) => ({
      type: "image_url",
      image_url: {
        url: img.dataUrl,
      },
    })),
  ];

  return contentParts;
}

module.exports = {
  processUploadedFile,
  formatMultimodalMessage,
  parseCsvToMarkdown,
};
