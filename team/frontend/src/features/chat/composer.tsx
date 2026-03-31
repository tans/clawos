import { ChangeEvent, FormEvent, useState } from "react";

export type ComposerSubmitInput = {
  body: string;
  files: File[];
};

type ComposerProps = {
  onSend?: (input: ComposerSubmitInput) => void;
  disabled?: boolean;
};

export function Composer({ onSend, disabled = false }: ComposerProps) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedBody = body.trim();
    if (!trimmedBody && files.length === 0) {
      return;
    }

    onSend?.({
      body: trimmedBody,
      files,
    });

    setBody("");
    setFiles([]);
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="chat-composer-input">
        Message your team
      </label>
      <input
        id="chat-composer-input"
        className="text-input"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Message your team"
        disabled={disabled}
      />
      <label className="secondary-button" htmlFor="chat-composer-files">
        Attach
      </label>
      <input
        id="chat-composer-files"
        className="sr-only"
        type="file"
        multiple
        onChange={handleFileChange}
        disabled={disabled}
      />
      <button className="primary-button" type="submit" disabled={disabled}>
        Send
      </button>
    </form>
  );
}
