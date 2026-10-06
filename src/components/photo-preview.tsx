"use client";
import { useState } from "react";
export function PhotoPreview({
  url,
  filename,
  mime,
}: {
  url: string;
  filename: string;
  mime: string;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="photo-pending" role="status">
      <strong>
        {mime === "image/heic"
          ? "HEIC preview unavailable in this browser."
          : "Photo preview unavailable."}
      </strong>
      <p>Your photo is preserved. Open the original in a compatible app.</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        download={filename}
      >
        Open original photo
      </a>
    </div>
  ) : (
    <img src={url} alt={filename} onError={() => setFailed(true)} />
  );
}
