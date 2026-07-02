import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function DocsContent({ content }: { content: string }) {
  return (
    <div className="prose-docs">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.trim()}</ReactMarkdown>
    </div>
  );
}
